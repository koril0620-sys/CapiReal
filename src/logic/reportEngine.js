import {
  RAIDER_MESSAGES,
  GUARDIAN_MESSAGES,
  ANALYST_MESSAGES,
  GAMBLER_MESSAGES,
} from '../constants/reportMessages'
import { getLearningGoal } from '../constants/learningGoals'
import { getCurrentStage } from '../constants/monopol'

export function generateReport(gameState, settlementResult, advisorId) {
  const base = generateBaseReport(gameState, settlementResult)
  const advisor = generateAdvisorReport(gameState, settlementResult, advisorId)
  const learningHint = generateLearningHint(gameState, settlementResult)

  return { ...base, advisor, learningHint }
}

function generateBaseReport(gameState, result) {
  return {
    floor: gameState.floor,
    netProfit: result.netProfit,
    isProfit: result.isProfit,
    revenue: result.revenue,
    totalCost: result.totalCost,
    operatingCost: result.operatingCost,
    marketingCost: result.marketingCost,
    interestAmount: result.interestAmount,
    shareAfter: result.shareAfter,
    rivalNetProfit: result.rivalNetProfit,
    rivalBankrupt: result.rivalBankrupt,
    monopolIntervention: result.monopolIntervention || null,
    factoryResult: result.factoryResult || null,
    creditResult: result.creditResult,
  }
}

function generateAdvisorReport(gameState, result, advisorId) {
  switch (advisorId) {
    case 'raider':
      return generateRaiderReport(gameState, result)
    case 'guardian':
      return generateGuardianReport(gameState, result)
    case 'analyst':
      return generateAnalystReport(gameState, result)
    case 'gambler':
      return generateGamblerReport(result)
    default:
      return generateAnalystReport(gameState, result)
  }
}

function generateRaiderReport(gameState, result) {
  const sections = []
  const prevShare = gameState.playerShareHistory?.slice(-2)?.[0] || 0
  const shareChange = (result.shareAfter || 0) - prevShare

  sections.push({
    icon: shareChange >= 0 ? '📈' : '📉',
    label: '점유율 변화',
    text: shareChange >= 0
      ? pick(RAIDER_MESSAGES.shareUp)
      : pick(RAIDER_MESSAGES.shareDown),
    type: shareChange >= 0 ? 'positive' : 'negative',
    value: `${shareChange >= 0 ? '+' : ''}${(shareChange * 100).toFixed(1)}%`,
  })

  sections.push({
    icon: '💰',
    label: '가격 경쟁력',
    text: pick(RAIDER_MESSAGES.suggestion),
    type: 'info',
  })

  sections.push({
    icon: gameState.momentum > 0 ? '🔥' : '❄️',
    label: '모멘텀',
    text: `현재 모멘텀 ${gameState.momentum > 0 ? '+' : ''}${gameState.momentum}`,
    type: gameState.momentum > 0 ? 'positive' : 'negative',
  })

  return {
    sections,
    suggestion: pick(RAIDER_MESSAGES.suggestion),
    warning: null,
  }
}

function generateGuardianReport(gameState, result) {
  const sections = []
  const debtRatio = gameState.debt / Math.max(gameState.capital, 1)

  let debtStatus = '안전'
  let debtMsg = pick(GUARDIAN_MESSAGES.debtSafe)
  if (debtRatio >= 0.7) {
    debtStatus = '위험'
    debtMsg = pick(GUARDIAN_MESSAGES.debtDanger)
  } else if (debtRatio >= 0.3) {
    debtStatus = '주의'
    debtMsg = pick(GUARDIAN_MESSAGES.debtCaution)
  }

  sections.push({
    icon: debtStatus === '안전' ? '🛡️' : '⚠️',
    label: `부채 ${debtStatus}`,
    text: debtMsg,
    type: debtStatus === '안전' ? 'positive' : debtStatus === '주의' ? 'warning' : 'negative',
  })

  const risks = collectRisks(gameState, result)
  risks.slice(0, 2).forEach(risk => {
    sections.push({ icon: '⚠️', label: '리스크', text: risk, type: 'warning' })
  })

  return {
    sections,
    suggestion: pick(GUARDIAN_MESSAGES.suggestion),
    warning: risks.length > 0 ? `지금 가장 위험한 것: ${risks[0]}` : null,
  }
}

function generateAnalystReport(gameState, result) {
  const sections = []
  const prevShare = gameState.playerShareHistory?.slice(-2)?.[0] || 0
  const shareChange = (result.shareAfter || 0) - prevShare

  if (shareChange > 0) {
    sections.push({
      icon: '📈',
      label: '점유율 상승 원인',
      text: ANALYST_MESSAGES.shareUpReasons[0].replace('{n}', (shareChange * 100).toFixed(1)),
      type: 'positive',
    })
  } else if (shareChange < 0) {
    sections.push({
      icon: '📉',
      label: '점유율 하락 원인',
      text: ANALYST_MESSAGES.shareDownReasons[0].replace('{n}', Math.abs(shareChange * 100).toFixed(1)),
      type: 'negative',
    })
  }

  if (gameState.nextPhaseHint) {
    sections.push({
      icon: '🔮',
      label: '국면 예고',
      text: gameState.nextPhaseHint.message,
      type: 'info',
    })
  }

  const rivalHint = ANALYST_MESSAGES.rivalHint[
    Math.floor(Math.random() * ANALYST_MESSAGES.rivalHint.length)
  ]
  const stage = getCurrentStage(gameState.floor)
  if (stage) {
    sections.push({
      icon: '👁️',
      label: '라이벌 분석',
      text: rivalHint.replace('{name}', stage.rivalName),
      type: 'info',
    })
  }

  return {
    sections,
    suggestion: pick(ANALYST_MESSAGES.suggestion).replace('{n}', '2.0'),
    warning: null,
  }
}

function generateGamblerReport(result) {
  const sections = []

  sections.push({
    icon: '🎲',
    label: '이번 달',
    text: result.isProfit
      ? pick(GAMBLER_MESSAGES.success).replace('{prob}', '70')
      : pick(GAMBLER_MESSAGES.failure).replace('{prob}', '30'),
    type: result.isProfit ? 'positive' : 'negative',
  })

  sections.push({
    icon: '🃏',
    label: '다음 달 힌트',
    text: GAMBLER_MESSAGES.nextEventHint.PRODUCTION,
    type: 'info',
  })

  return {
    sections,
    suggestion: pick(GAMBLER_MESSAGES.urge),
    warning: null,
  }
}

function generateLearningHint(gameState, result) {
  const goal = getLearningGoal(gameState.floor)
  if (!goal) return null

  if (result.isProfit && gameState.floor <= 10) {
    return goal.resultHint?.profit || null
  }
  if (!result.isProfit && gameState.floor <= 10) {
    return goal.resultHint?.loss || null
  }
  return null
}

function collectRisks(gameState, result) {
  const risks = []
  if (result.interestAmount > gameState.capital * 0.2) risks.push('이자 부담이 큽니다.')
  if (gameState.loans?.some(loan => loan.remainingTurns <= 3)) risks.push('대출 만기가 임박했습니다.')
  if (gameState.activeEffects?.some(effect => effect.costMultiplier > 1)) risks.push('원가 상승 이벤트가 진행 중입니다.')
  if (gameState.momentum < -2) risks.push('연속 적자로 모멘텀이 낮습니다.')
  if (gameState.rivalCapital < gameState.rivalInitialCapital * 0.2) risks.push('라이벌이 파산 직전입니다. 밀어붙이세요.')
  return risks
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function buildReport() {
  return {}
}
