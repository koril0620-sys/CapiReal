import { useGameStore } from '../store/useGameStore'
import { getActiveMarkets, getPrimaryMarket, getTierById, TIER_ICONS, MAX_RIVALS_PER_MARKET } from '../constants/markets'
import { getCurrentStage } from '../constants/monopol'
import { ECO_PHASES } from '../constants/economy'
import { playSFX } from '../logic/audioEngine'

// 메인 화면 오른쪽 위: 운영 중인 모든 시장 한눈에 보기 (시장 1~6개 대응)
export default function MarketBoard({ onSelect }) {
  const markets = useGameStore(state => state.markets) || []
  const floor = useGameStore(state => state.floor)
  const econPhase = useGameStore(state => state.econPhase)
  const selectedMarketId = useGameStore(state => state.selectedMarketId)
  const setSelectedMarket = useGameStore(state => state.setSelectedMarket)

  const active = getActiveMarkets({ markets })
  const primary = getPrimaryMarket({ markets })
  const stage = getCurrentStage(floor)
  const sorted = [...active].sort((a, b) => getTierById(b.tierId).floorMin - getTierById(a.tierId).floorMin)
  const compact = sorted.length >= 4
  const phaseMultiplier = (ECO_PHASES[econPhase] || ECO_PHASES.stable).demandMultiplier

  // 시장이 하나뿐이면 거리 화면만으로 충분하니 숨긴다
  if (sorted.length <= 1) return null

  return (
    <div className={`cr2-market-board ${compact ? 'cr2-market-board-compact' : ''}`}>
      <div className="cr2-market-board-head">
        <span>시장 현황</span>
        <span className="cr2-gray">{sorted.length}개 운영 · 라이벌 {sorted.reduce((sum, market) => sum + market.rivals.length, 0)}</span>
      </div>

      {sorted.map(market => {
        const tier = getTierById(market.tierId)
        const share = market.shareHistory?.length ? market.shareHistory.at(-1) : null
        const profit = market.lastResult?.profit
        const isPrimary = primary?.tierId === market.tierId
        const isSelected = selectedMarketId === market.tierId
        const expectedDemand = Math.floor(tier.baseDemand * phaseMultiplier)

        return (
          <button
            key={market.tierId}
            type="button"
            className={`cr2-market-row ${isSelected ? 'cr2-market-row-selected' : ''}`}
            onClick={() => {
              setSelectedMarket(market.tierId)
              playSFX('click')
              onSelect?.(market.tierId)
            }}
          >
            <div className="cr2-market-row-top">
              <span className="cr2-market-row-name">
                {TIER_ICONS[market.tierId]} {tier.category}
                {isPrimary && <span className="cr2-market-badge">주력</span>}
              </span>
              <span className={`cr2-market-row-profit ${profit === undefined || profit === null ? 'cr2-gray' : profit >= 0 ? 'cr2-positive' : 'cr2-negative'}`}>
                {profit === undefined || profit === null ? '첫 달' : `${profit >= 0 ? '+' : ''}${Math.round(profit / 10000).toLocaleString()}만`}
              </span>
            </div>

            <div className="cr2-market-row-bottom">
              <div className="cr2-market-share-track" title="내 점유율">
                <div className="cr2-market-share-fill" style={{ width: `${Math.round((share ?? 0) * 100)}%` }} />
                <span className="cr2-market-share-text">{share === null ? '—' : `${Math.round(share * 100)}%`}</span>
              </div>

              <div className="cr2-market-rivals">
                {market.rivals.length === 0 && (
                  <span className="cr2-market-norival">라이벌 없음</span>
                )}
                {market.rivals.slice(0, MAX_RIVALS_PER_MARKET).map(rival => (
                  <img
                    key={rival.id}
                    src={rival.profileImage || '/assets/logo_image-f7z3e97D.png'}
                    alt={rival.name}
                    title={`${rival.name} (${rival.company})`}
                    className={`cr2-market-rival-avatar ${rival.id === stage?.rival ? 'cr2-market-rival-stage' : ''} ${rival.isGeneric ? 'cr2-market-rival-generic' : ''}`}
                  />
                ))}
              </div>
            </div>

            {!compact && (
              <div className="cr2-market-row-meta cr2-gray">
                예상 수요 {expectedDemand.toLocaleString()} · {market.lastResult ? `판매 ${market.lastResult.sales.toLocaleString()}개` : '판매 기록 없음'}
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
