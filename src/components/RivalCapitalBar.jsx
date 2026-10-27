import { useGameStore } from '../store/useGameStore'
import { getCurrentStage } from '../constants/monopol'
import { calcTurnsToRivalBankrupt } from '../logic/monopolEngine'

export default function RivalCapitalBar() {
  const gameState = useGameStore(state => state)
  const stage = getCurrentStage(gameState.floor)

  if (!stage || gameState.rivalCapital === 0 || stage.tier === 'BOSS') return null
  const stageRivalAlive = (gameState.markets || []).some(market => market.rivals.some(rival => rival.id === stage.rival))
  if (!stageRivalAlive) return null

  const ratio = gameState.rivalInitialCapital > 0
    ? Math.max(gameState.rivalCapital / gameState.rivalInitialCapital, 0)
    : 0

  const turnsLeft = calcTurnsToRivalBankrupt(
    gameState.rivalCapital,
    gameState.rivalNetProfit,
  )

  const getBarColor = () => {
    if (ratio <= 0.1) return 'var(--cr2-red)'
    if (ratio <= 0.3) return 'var(--cr2-red)'
    if (ratio <= 0.7) return 'var(--cr2-gold)'
    return 'var(--cr2-green)'
  }

  const getBarClass = () => {
    if (ratio <= 0.1) return 'cr2-rival-bar cr2-blink'
    if (ratio <= 0.3) return 'cr2-rival-bar cr2-rival-danger'
    return 'cr2-rival-bar'
  }

  return (
    <div className="cr2-rival-capital-bar">
      <div className="cr2-rival-bar-header">
        <span className="cr2-rival-bar-label">MONOPOL</span>
        <span className="cr2-rival-bar-name">{stage.rivalName} ({stage.company})</span>
      </div>

      <div className="cr2-rival-bar-track">
        <div
          className={getBarClass()}
          style={{
            width: `${Math.min(ratio * 100, 100)}%`,
            background: getBarColor(),
          }}
        />
      </div>

      <div className="cr2-rival-bar-info">
        <span style={{ color: gameState.rivalCapital < 0 ? 'var(--cr2-red)' : 'var(--cr2-white)' }}>
          {(gameState.rivalCapital / 10000).toFixed(0)}만원
        </span>
        {gameState.rivalNetProfit !== 0 && (
          <span className={gameState.rivalNetProfit < 0 ? 'cr2-positive' : 'cr2-negative'}>
            &nbsp;이번 달 {gameState.rivalNetProfit < 0 ? '▼' : '▲'}
            {Math.abs(gameState.rivalNetProfit / 10000).toFixed(0)}만원
          </span>
        )}
        {turnsLeft !== null && turnsLeft <= 10 && (
          <span className="cr2-positive">
            &nbsp;파산까지 약 {turnsLeft}턴
          </span>
        )}
        {ratio <= 0.1 && (
          <span className="cr2-positive cr2-blink">&nbsp;⚠️ 파산 임박</span>
        )}
      </div>
    </div>
  )
}
