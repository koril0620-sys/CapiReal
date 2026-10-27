import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../store/useGameStore'
import { generateReport } from '../logic/reportEngine'
import { getCurrentStage, isBossStage } from '../constants/monopol'
import { TIER_ICONS } from '../constants/markets'
import { playBGM, playSFX } from '../logic/audioEngine'
import { getMaturedLoans } from '../logic/loanEngine'
import { generateResultAnalysis } from '../logic/aiAdvisorEngine'
import { BOSS_MAX_TURNS } from '../logic/monopolEngine'
import { advanceAfterResult, bumpStat, recheckAchievements } from '../logic/turnFlow'
import AchievementToast from '../components/AchievementToast'
import LoanMaturityAlert from '../components/LoanMaturityAlert'
import '../styles/result.css'

export default function ResultScreen() {
  const gameState = useGameStore(state => state)
  const setCurrentScreen = useGameStore(state => state.setCurrentScreen)
  const settlementResult = gameState.lastSettlementResult
  const [saving, setSaving] = useState(false)
  const maturedLoans = getMaturedLoans(gameState.loans || [])
  const [showAlert, setShowAlert] = useState(maturedLoans.length > 0)
  const [alertLoan, setAlertLoan] = useState(maturedLoans[0] || null)
  const [aiAnalysis, setAiAnalysis] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)

  const viewCountedRef = useRef(false)

  useEffect(() => {
    if (!settlementResult) {
      setCurrentScreen('main')
    }
  }, [settlementResult, setCurrentScreen])

  useEffect(() => {
    if (!settlementResult || viewCountedRef.current) return
    viewCountedRef.current = true
    bumpStat('resultViewCount')
    void recheckAchievements(settlementResult)
  }, [settlementResult])

  useEffect(() => {
    if (!settlementResult) return
    playBGM(settlementResult.isProfit ? 'growth' : 'contraction')
  }, [settlementResult])

  if (!settlementResult) {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        background: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Press Start 2P', monospace",
        color: 'var(--cr2-lime)',
        fontSize: '12px',
      }}>
        불러오는 중...
      </div>
    )
  }

  const netProfit = settlementResult.netProfit || 0
  const shareAfter = settlementResult.shareAfter || 0
  const revenue = settlementResult.revenue || 0
  const totalCost = settlementResult.totalCost || 0
  const operatingCost = settlementResult.operatingCost || 0
  const marketingCost = settlementResult.marketingCost || 0
  const interestAmount = settlementResult.interestAmount || 0
  const totalDemand = settlementResult.totalDemand || 0
  const actualSales = settlementResult.actualSales || 0
  const orderAmount = settlementResult.orderAmount || 0
  const isProfit = settlementResult.isProfit || false
  const factoryResult = settlementResult.factoryResult || null
  const report = generateReport(gameState, settlementResult, gameState.selectedAdvisor)

  const marketResults = settlementResult.markets || []
  const bossFloor = isBossStage(gameState.floor)
  const bossFinished = bossFloor && (settlementResult.bossClear || settlementResult.bossTimeout)
  const nextLabel = bossFloor
    ? (bossFinished ? '엔딩으로' : `최종전 다음 라운드 (${(settlementResult.bossTurn || 0) + 1}/${BOSS_MAX_TURNS})`)
    : '다음 층으로'

  const handleNextFloor = async () => {
    setSaving(true)
    playSFX('nextfloor')
    const screen = await advanceAfterResult()
    setSaving(false)
    setCurrentScreen(screen)
  }

  const handleAiAnalysis = async () => {
    setAiLoading(true)
    const result = await generateResultAnalysis(
      gameState,
      settlementResult,
      gameState.selectedAdvisor,
    )
    setAiAnalysis(result)
    setAiLoading(false)
  }

  return (
    <div className="cr2-result-screen">
      <div className="cr2-result-header">
        <div className="cr2-result-floor">
          FLOOR {gameState.floor} REPORT
          {marketResults.length > 1 && <span className="cr2-gray"> · 시장 {marketResults.length}개</span>}
        </div>
        <div className="cr2-result-title">MONTHLY SETTLEMENT &nbsp; 월말 정산</div>
        <div className={`cr2-result-profit ${isProfit ? 'cr2-positive' : 'cr2-negative'}`}>
          이번 달 최종 순이익: {(netProfit / 10000).toFixed(0)}만원
        </div>
      </div>

      <div className="cr2-result-body">
        <div className="cr2-result-left">
          {marketResults.length > 1 ? (
            <MarketResultTable markets={marketResults} />
          ) : (
            <>
              <div className="cr2-result-section">
                <div className="cr2-result-section-title">점유율</div>
                <div className="cr2-result-share">
                  {Math.round(shareAfter * 100)}%
                </div>
              </div>

              <div className="cr2-result-grid">
                <div className="cr2-result-stat">
                  <div className="cr2-stat-label">시장 점유율</div>
                  <div className="cr2-stat-value">{Math.round(shareAfter * 100)}%</div>
                </div>
                <div className="cr2-result-stat">
                  <div className="cr2-stat-label">총수요</div>
                  <div className="cr2-stat-value">{totalDemand.toLocaleString()}</div>
                </div>
                <div className="cr2-result-stat">
                  <div className="cr2-stat-label">생산량</div>
                  <div className="cr2-stat-value">{orderAmount.toLocaleString()}</div>
                </div>
                <div className="cr2-result-stat">
                  <div className="cr2-stat-label">실제 판매</div>
                  <div className="cr2-stat-value">{actualSales.toLocaleString()}</div>
                </div>
              </div>
              {orderAmount > actualSales && (
                <div className="cr2-result-unsold cr2-gold">
                  팔지 못한 {(orderAmount - actualSales).toLocaleString()}개는 폐기됐습니다 (초과공급)
                </div>
              )}
            </>
          )}

          <div className="cr2-result-income-stmt">
            <div className="cr2-income-row cr2-income-revenue">
              <span style={{ fontFamily: "'Noto Sans KR','Malgun Gothic',sans-serif" }}>매출액</span>
              <span className="cr2-positive">+{(revenue / 10000).toFixed(0)}만원</span>
            </div>
            <div className="cr2-income-row">
              <span style={{ fontFamily: "'Noto Sans KR','Malgun Gothic',sans-serif" }}>(-) 생산비</span>
              <span className="cr2-negative">-{(totalCost / 10000).toFixed(0)}만원</span>
            </div>
            <div className="cr2-income-row cr2-income-gross">
              <span style={{ fontFamily: "'Noto Sans KR','Malgun Gothic',sans-serif" }}>= 매출총이익</span>
              <span className={(revenue - totalCost) >= 0 ? 'cr2-positive' : 'cr2-negative'}>
                {((revenue - totalCost) / 10000).toFixed(0)}만원
              </span>
            </div>
            <div className="cr2-income-row">
              <span style={{ fontFamily: "'Noto Sans KR','Malgun Gothic',sans-serif" }}>(-) 운영비</span>
              <span className="cr2-negative">-{(operatingCost / 10000).toFixed(0)}만원</span>
            </div>
            <div className="cr2-income-sub">
              {marketResults.map(market => (
                <div key={market.tierId}>
                  {TIER_ICONS[market.tierId]} {market.category}: -{(market.operatingCost / 10000).toFixed(0)}만원{!market.isPrimary && ' (유지비 70%)'}
                </div>
              ))}
            </div>
            <div className="cr2-income-row">
              <span style={{ fontFamily: "'Noto Sans KR','Malgun Gothic',sans-serif" }}>(-) 마케팅비</span>
              <span className="cr2-negative">-{(marketingCost / 10000).toFixed(0)}만원</span>
            </div>
            {interestAmount > 0 && (
              <div className="cr2-income-row">
                <span style={{ fontFamily: "'Noto Sans KR','Malgun Gothic',sans-serif" }}>(-) 이자비용</span>
                <span className="cr2-negative">-{(interestAmount / 10000).toFixed(0)}만원</span>
              </div>
            )}
            {settlementResult.interestLate && (
              <div className="cr2-income-sub cr2-negative">
                이자 연체: {Math.round((settlementResult.unpaidInterest || 0) / 10000)}만원이 대출 원금에 더해졌습니다
              </div>
            )}
            {settlementResult.forcedRepayment?.length > 0 && (
              <div className="cr2-income-sub cr2-negative">
                만기 연체 대출 강제 회수: -{Math.round(settlementResult.forcedRepayment.reduce((sum, loan) => sum + loan.principal, 0) / 10000)}만원 (신용 -10)
              </div>
            )}
            <div className="cr2-income-row cr2-income-net">
              <span style={{ fontFamily: "'Noto Sans KR','Malgun Gothic',sans-serif" }}>= 순이익</span>
              <span className={isProfit ? 'cr2-positive' : 'cr2-negative'}>
                {isProfit ? '+' : ''}{(netProfit / 10000).toFixed(0)}만원
              </span>
            </div>
            <div className="cr2-income-row cr2-income-capital">
              <span style={{ fontFamily: "'Noto Sans KR','Malgun Gothic',sans-serif" }}>자본 변화</span>
              <span className={gameState.capital >= 0 ? 'cr2-positive' : 'cr2-negative'}>
                {(gameState.capital / 10000).toFixed(0)}만원
              </span>
            </div>
          </div>

          {/* 매출/순이익 그래프 - 손익계산서 아래 */}
          {(gameState.revenueHistory?.length || 0) > 0 && (
            <div style={{
              marginTop: '8px',
              padding: '8px',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(0,170,0,0.3)',
            }}>
              <div style={{
                fontSize: '8px',
                color: 'var(--cr2-green)',
                marginBottom: '4px',
              }}>
                최근 매출 / 순이익 추이
              </div>
              <RevenueChart gameState={gameState} />
            </div>
          )}

          {factoryResult && (
            <FactoryResultSection result={factoryResult} />
          )}

          <MonopolSection gameState={gameState} settlementResult={settlementResult} />
        </div>

        <div className="cr2-result-right">
          <div className="cr2-result-report-title">
            FLOOR {gameState.floor} REPORT &nbsp; 결과 리포트
          </div>

          <div className="cr2-result-stats-mini">
            <div>경영 체력 {gameState.health}</div>
            <div>모멘텀 {gameState.momentum}</div>
            <div>다음 보상 {getRewardLabel(gameState.floor + 1)}</div>
          </div>

          <div className="cr2-result-advisor-panel">
            <div className="cr2-result-advisor-name">
              {getAdvisorName(gameState.selectedAdvisor)} &nbsp; 이번 달 결정 분석
            </div>

            <div className="cr2-result-advisor-sections">
              {report.advisor?.sections?.map(section => (
                <div key={`${section.label}-${section.text}`} className={`cr2-advisor-section cr2-advisor-${section.type}`}>
                  <span className="cr2-advisor-section-badge">{section.type === 'positive' ? '상승' : section.type === 'negative' ? '하락' : '선택'}</span>
                  <div>
                    <div className="cr2-advisor-section-label">{section.label}</div>
                    <div className="cr2-advisor-section-text">{section.text}</div>
                  </div>
                </div>
              ))}
            </div>

            {report.advisor?.suggestion && (
              <div className="cr2-advisor-suggestion">
                제안: {report.advisor.suggestion}
              </div>
            )}

            {report.advisor?.warning && (
              <div className="cr2-advisor-warning cr2-negative">
                {report.advisor.warning}
              </div>
            )}

            {!aiAnalysis && (
              <button
                onClick={handleAiAnalysis}
                disabled={aiLoading}
                style={{
                  width: '100%',
                  padding: '8px',
                  background: aiLoading ? 'rgba(0,255,65,0.1)' : 'transparent',
                  border: '1px solid var(--cr2-lime)',
                  color: 'var(--cr2-lime)',
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: '9px',
                  cursor: aiLoading ? 'not-allowed' : 'pointer',
                  marginTop: '8px',
                }}
              >
                {aiLoading ? 'AI 분석 중...' : '✨ AI 분석 요청'}
              </button>
            )}

            {aiAnalysis && (
              <div style={{
                marginTop: '8px',
                padding: '10px',
                background: 'rgba(0,255,65,0.05)',
                border: '1px solid rgba(0,255,65,0.3)',
                fontSize: '10px',
                color: 'var(--cr2-white)',
                lineHeight: '1.8',
                fontFamily: "'Noto Sans KR', sans-serif",
              }}>
                <div style={{ color: 'var(--cr2-lime)', fontSize: '9px', marginBottom: '6px' }}>
                  ✨ AI 분석
                </div>
                {aiAnalysis}
              </div>
            )}
          </div>

          {report.learningHint && (
            <div className="cr2-result-learning-hint">
              {report.learningHint}
            </div>
          )}

          <div className="cr2-result-footer-hint cr2-gray">
            가격과 품질이 맞아떨어질 때 매출보다 마진이 먼저 살아납니다.
          </div>

          <button
            className="cr2-btn cr2-next-floor-btn"
            onClick={handleNextFloor}
            disabled={saving}
          >
            {saving ? '저장 중...' : nextLabel}
          </button>
        </div>
      </div>

      {showAlert && alertLoan && (
        <LoanMaturityAlert
          loan={alertLoan}
          onClose={() => {
            setShowAlert(false)
            setAlertLoan(null)
          }}
        />
      )}

      <AchievementToast />
    </div>
  )
}

function RevenueChart({ gameState }) {
  const revenues = gameState.revenueHistory || []
  const profits = gameState.profitHistory || []

  const SLOTS = 8
  const data = revenues.slice(-SLOTS)
  const profData = profits.slice(-SLOTS)

  const paddedRevenues = [
    ...Array(Math.max(0, SLOTS - data.length)).fill(null),
    ...data,
  ]
  const paddedProfits = [
    ...Array(Math.max(0, SLOTS - profData.length)).fill(null),
    ...profData,
  ]

  const allVals = [...data, ...profData.map(Math.abs)].filter(value => value !== null)
  const maxVal = Math.max(...allVals, 1)
  const chartH = 60

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-end',
      gap: '3px',
      height: `${chartH + 16}px`,
      padding: '4px 0',
    }}>
      {paddedRevenues.map((rev, i) => {
        const profit = paddedProfits[i]
        const isEmpty = rev === null

        if (isEmpty) {
          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '2px',
              }}
            >
              <div style={{
                width: '1px',
                height: '40px',
                background: 'rgba(255,255,255,0.1)',
                borderLeft: '1px dashed rgba(255,255,255,0.15)',
              }} />
              <div style={{
                fontSize: '6px',
                color: 'rgba(255,255,255,0.2)',
                fontFamily: 'monospace',
              }}>
                -
              </div>
            </div>
          )
        }

        const revH = Math.max((rev / maxVal) * (chartH - 10), 2)
        const profH = Math.max((Math.abs(profit || 0) / maxVal) * (chartH - 10), 2)
        const isNeg = (profit || 0) < 0
        const turnNum = data.length - (SLOTS - 1 - i)

        return (
          <div
            key={i}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '2px',
              height: '100%',
              justifyContent: 'flex-end',
            }}
          >
            <div style={{
              width: '100%',
              height: `${revH}px`,
              background: 'rgba(0,255,65,0.3)',
              position: 'relative',
              minHeight: '2px',
            }}>
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: '20%',
                width: '60%',
                height: `${profH}px`,
                background: isNeg ? '#DC143C' : '#00FF41',
                minHeight: '2px',
              }} />
            </div>
            <div style={{
              fontSize: '6px',
              color: 'rgba(255,255,255,0.4)',
              fontFamily: 'monospace',
            }}>
              {turnNum}
            </div>
          </div>
        )
      })}

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '3px',
        marginLeft: '4px',
        fontSize: '7px',
        justifyContent: 'flex-end',
        paddingBottom: '14px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
          <div style={{ width: '8px', height: '8px', background: 'rgba(0,255,65,0.3)' }} />
          <span style={{ color: 'rgba(255,255,255,0.5)' }}>매출</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
          <div style={{ width: '8px', height: '8px', background: '#00FF41' }} />
          <span style={{ color: 'rgba(255,255,255,0.5)' }}>순익</span>
        </div>
      </div>
    </div>
  )
}

function FactoryResultSection({ result }) {
  return (
    <div className={`cr2-factory-result ${result.success ? 'cr2-factory-success' : 'cr2-factory-fail'}`}>
      <div className="cr2-factory-result-title">🏭 공장 작업 결과</div>
      {result.type === 'quality' ? (
        result.success ? (
          <>
            <div>품질 강화 성공</div>
            {result.isJackpot && (
              <div style={{ color: 'var(--cr2-gold)', fontSize: '11px' }}>
                ✨ 대박! +{result.qualityGain}
              </div>
            )}
            <div className="cr2-positive">+{result.qualityGain} (→ {result.newQuality})</div>
          </>
        ) : (
          <>
            <div className="cr2-negative">품질 강화 실패</div>
            <div>다음 시도 성공 확률 +10%</div>
          </>
        )
      ) : (
        result.success ? (
          <>
            <div>원가 절감 성공</div>
            <div className="cr2-positive">-{(result.reductionGain * 100).toFixed(1)}%</div>
            <div>누적 절감: {(result.newCostReductionTotal * 100).toFixed(1)}% / 40%</div>
          </>
        ) : (
          <div className="cr2-negative">원가 절감 실패</div>
        )
      )}
      <div className="cr2-negative">비용: 500,000원 차감</div>
    </div>
  )
}

function MarketResultTable({ markets }) {
  return (
    <div className="cr2-result-section">
      <div className="cr2-result-section-title">시장별 성적</div>
      <table className="cr2-market-table cr2-result-market-table">
        <thead>
          <tr>
            <th>시장</th>
            <th>점유율</th>
            <th>판매/발주</th>
            <th>이익</th>
          </tr>
        </thead>
        <tbody>
          {markets.map(market => {
            const delta = market.share - (market.prevShare || 0)
            return (
              <tr key={market.tierId}>
                <td>
                  {TIER_ICONS[market.tierId]} {market.category}
                  {market.isPrimary && <span className="cr2-market-badge">주력</span>}
                  <div className="cr2-gray cr2-market-table-sub">
                    라이벌 {market.rivals.length}{market.rivals.length === 0 && market.fringeShare > 0 ? ` · 군소 ${Math.round(market.fringeShare * 100)}%` : ''}
                  </div>
                </td>
                <td>
                  {Math.round(market.share * 100)}%
                  <div className={`cr2-market-table-sub ${delta >= 0 ? 'cr2-positive' : 'cr2-negative'}`}>
                    {delta >= 0 ? '▲' : '▼'}{Math.abs(Math.round(delta * 100))}%p
                  </div>
                </td>
                <td>
                  {market.actualSales.toLocaleString()}/{market.orderAmount.toLocaleString()}
                  {market.unsold > 0 && <div className="cr2-market-table-sub cr2-gold">폐기 {market.unsold.toLocaleString()}</div>}
                </td>
                <td className={market.profit >= 0 ? 'cr2-positive' : 'cr2-negative'}>
                  {market.profit >= 0 ? '+' : ''}{Math.round(market.profit / 10000).toLocaleString()}만
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function MonopolSection({ gameState, settlementResult }) {
  const stage = getCurrentStage(gameState.floor)
  const markets = settlementResult.markets || []
  const stageRival = markets.flatMap(market => market.rivals).find(rival => rival.id === stage?.rival)
  const bankruptcies = settlementResult.rivalBankruptcies || []
  const abilities = settlementResult.abilityTriggers || []
  const intervention = settlementResult.monopolIntervention

  if (!stage && bankruptcies.length === 0) return null

  const ratio = gameState.rivalInitialCapital > 0
    ? Math.max(gameState.rivalCapital / gameState.rivalInitialCapital, 0)
    : 0

  return (
    <div className="cr2-monopol-section">
      <div className="cr2-monopol-title">🏢 MONOPOL 현황</div>
      {stage && stageRival && !stageRival.isGeneric && stage.tier !== 'BOSS' && (
        <>
          <div className="cr2-monopol-rival">{stage.rivalName} ({stage.company}) · 점유율 {Math.round((stageRival.share || 0) * 100)}%</div>
          <div className="cr2-monopol-bar-track">
            <div
              className="cr2-monopol-bar"
              style={{
                width: `${Math.min(ratio * 100, 100)}%`,
                background: ratio <= 0.3 ? 'var(--cr2-red)' : ratio <= 0.7 ? 'var(--cr2-gold)' : 'var(--cr2-green)',
              }}
            />
          </div>
          <div>자본: {(gameState.rivalCapital / 10000).toFixed(0)}만원</div>
          <div className={stageRival.netProfit < 0 ? 'cr2-positive' : 'cr2-negative'}>
            이번 달 손익: {stageRival.netProfit < 0 ? '▼' : '▲'}
            {Math.abs(stageRival.netProfit / 10000).toFixed(0)}만원
          </div>
        </>
      )}

      {settlementResult.bossRound && (
        <div className={settlementResult.bossRound.won ? 'cr2-positive' : 'cr2-negative'}>
          최종전 {settlementResult.bossTurn}/{BOSS_MAX_TURNS}: 혜경 {Math.round(settlementResult.bossRound.bossShare * 100)}% vs 나 {Math.round(settlementResult.bossRound.playerShare * 100)}%
          {settlementResult.bossRound.won ? ' — 압도!' : ' — 밀렸다'}
          {settlementResult.bossCounter && <div className="cr2-negative">혜경의 카운터 발동: 같은 전략을 읽혔다</div>}
        </div>
      )}

      {bankruptcies.map(item => (
        <div key={`${item.tierId}-${item.id}`} className="cr2-positive cr2-blink">
          ⚡ {item.name} ({item.company}) 파산! {item.reward}
        </div>
      ))}

      {abilities.map(item => (
        <div key={`${item.tierId}-${item.rivalId}`} className="cr2-negative" style={{ fontSize: '9px' }}>
          ▸ {item.name}: {item.label}
        </div>
      ))}

      {intervention && (
        <div className="cr2-negative">
          ⚠️ MONOPOL 시장 개입: {intervention.description}
        </div>
      )}

      {settlementResult.stageResult && (
        <div className={settlementResult.stageResult.cleared ? 'cr2-positive' : 'cr2-negative'}>
          {settlementResult.stageResult.cleared ? '✓ ' : '✗ '}{settlementResult.stageResult.message}
        </div>
      )}
    </div>
  )
}

function getAdvisorName(id) {
  const names = { raider: 'The Raider', guardian: 'The Guardian', analyst: 'The Analyst', gambler: 'The Gambler' }
  return names[id] || 'The Analyst'
}

function getRewardLabel(floor) {
  if (floor % 5 === 0) return '이번 달'
  const next = Math.ceil(floor / 5) * 5
  return `${next - floor}개월 후`
}
