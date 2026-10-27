import { callOpenAI } from '../lib/openaiClient'

const ADVISOR_SYSTEM_PROMPTS = {
  raider: `당신은 공격적인 경영 전략가 The Raider입니다.
짧고 강렬하게 조언합니다. 항상 공격적 확장을 권합니다.
반말로 말하고 2~3문장으로만 답합니다.
경제 개념은 2022 개정 교육과정 고등학교 경제 교과서 용어를 사용합니다.`,

  guardian: `당신은 안정적인 경영 전략가 The Guardian입니다.
리스크 관리를 최우선으로 생각합니다.
정중하게 말하고 2~3문장으로만 답합니다.
경제 개념은 2022 개정 교육과정 고등학교 경제 교과서 용어를 사용합니다.`,

  analyst: `당신은 데이터 분석가 The Analyst입니다.
숫자와 데이터 기반으로 냉철하게 분석합니다.
존댓말로 말하고 2~3문장으로만 답합니다.
경제 개념은 2022 개정 교육과정 고등학교 경제 교과서 용어를 사용합니다.`,

  gambler: `당신은 도박사 The Gambler입니다.
항상 고위험 고수익 전략을 권합니다.
흥분된 톤으로 말하고 2~3문장으로만 답합니다.
경제 개념은 2022 개정 교육과정 고등학교 경제 교과서 용어를 사용합니다.`,
}

export async function generateResultAnalysis(gameState, settlementResult, advisorId) {
  const system = ADVISOR_SYSTEM_PROMPTS[advisorId] || ADVISOR_SYSTEM_PROMPTS.analyst

  const user = `
이번 달 경영 결과:
- 층수: ${gameState.floor} / 120
- 경기 국면: ${gameState.econPhase}
- 시장 점유율: ${((settlementResult.shareAfter || 0) * 100).toFixed(1)}%
- 매출: ${((settlementResult.revenue || 0) / 10000).toFixed(0)}만원
- 순이익: ${((settlementResult.netProfit || 0) / 10000).toFixed(0)}만원
- 판매가: ${(gameState.currentStrategy?.price || 0).toLocaleString()}원
- 발주량: ${(gameState.currentStrategy?.orderAmount || 0).toLocaleString()}개
- 품질: ${gameState.quality}
- 라이벌 자본: ${((gameState.rivalCapital || 0) / 10000).toFixed(0)}만원
${(settlementResult.markets || []).length > 1 ? `- 운영 중인 시장별 결과:\n${settlementResult.markets.map(market => `  · ${market.category}: 점유율 ${(market.share * 100).toFixed(0)}%, 이익 ${(market.profit / 10000).toFixed(0)}만원, 라이벌 ${market.rivals.length}명`).join('\n')}` : ''}

위 결과를 분석해줘.`

  return await callOpenAI(system, user)
}

let strategyDebounceTimer = null

export function requestStrategyAdvice(gameState, callback) {
  if (strategyDebounceTimer) clearTimeout(strategyDebounceTimer)

  strategyDebounceTimer = setTimeout(async () => {
    const system = ADVISOR_SYSTEM_PROMPTS[gameState.selectedAdvisor] || ADVISOR_SYSTEM_PROMPTS.analyst

    const price = gameState.currentStrategy?.price || 0
    const cost = gameState.cost || 3000
    const orderAmount = gameState.currentStrategy?.orderAmount || 0
    const qualityMode = gameState.currentStrategy?.qualityMode || 'maintain'

    const user = `
현재 선택한 전략:
- 경기 국면: ${gameState.econPhase}
- 설정 가격: ${price.toLocaleString()}원 (원가: ${cost.toLocaleString()}원)
- 발주량: ${orderAmount.toLocaleString()}개
- 품질 모드: ${qualityMode}
- 현재 자본: ${((gameState.capital || 0) / 10000).toFixed(0)}만원
- 라이벌 가격: ${(gameState.rivalPrice || 0).toLocaleString()}원

이 전략에 대해 한 줄로만 조언해줘.`

    const result = await callOpenAI(system, user, { useHistory: false })
    if (result) callback(result)
  }, 2500)
}

export async function generateEndingAnalysis(gameState, resultType) {
  const system = `당신은 경제 교육 전문가입니다.
고등학생의 경영 시뮬레이션 결과를 분석하고
교육적 피드백을 제공합니다.
친근하고 격려하는 톤으로 4~5문장으로 답합니다.
2022 개정 교육과정 고등학교 경제 교과서 용어와 개념을 활용해서
플레이어가 어떤 경제 개념을 잘 활용했는지 또는 놓쳤는지 설명합니다.`

  const user = `
플레이어 경영 결과 분석:
- 결과: ${resultType === 'CLEAR' ? '클리어' : '파산'}
- 도달 층수: ${gameState.floor} / 120
- 최종 자본: ${((gameState.capital || 0) / 10000).toFixed(0)}만원
- 총 흑자 턴: ${gameState.stats?.profitTurns || 0}턴
- 총 적자 턴: ${gameState.stats?.lossTurns || 0}턴
- 최고 점유율: ${((gameState.stats?.maxShare || 0) * 100).toFixed(1)}%
- 파산 위기: ${gameState.stats?.bankruptcyCount || 0}회
- 이벤트 성공률: ${gameState.stats?.eventTotalCount > 0
    ? Math.round((gameState.stats.eventSuccessCount / gameState.stats.eventTotalCount) * 100)
    : 0}%
- 선택한 어드바이저: ${gameState.selectedAdvisor}

이 플레이어의 경영 패턴을 분석하고 교육적 피드백을 줘.`

  return await callOpenAI(system, user)
}
