import { useState } from 'react'
import { useGameStore } from '../store/useGameStore'
import {
  getActiveMarkets,
  getPrimaryMarket,
  getTierById,
  getMarketOperatingCost,
  getMarketUnitCost,
  TIER_ICONS,
  TIER_SHORT_NAMES,
  LEGACY_OPERATING_RATIO,
} from '../constants/markets'
import { closeMarket } from '../logic/floorEngine'
import { playSFX } from '../logic/audioEngine'

export const OVERVIEW_ID = '__overview__'

// 판매 탭 위쪽 시장 선택 칩. 시장이 많아지면 가로 스크롤 + '전체' 칩으로 개요 보기
export function MarketChips({ value, onChange }) {
  const markets = useGameStore(state => state.markets) || []
  const active = getActiveMarkets({ markets })
  const primary = getPrimaryMarket({ markets })
  const sorted = [...active].sort((a, b) => getTierById(b.tierId).floorMin - getTierById(a.tierId).floorMin)

  if (sorted.length <= 1) return null

  return (
    <div className="cr2-market-chips" role="tablist" aria-label="시장 선택">
      <button
        type="button"
        className={`cr2-market-chip cr2-market-chip-all ${value === OVERVIEW_ID ? 'cr2-market-chip-active' : ''}`}
        onClick={() => { onChange(OVERVIEW_ID); playSFX('click') }}
      >
        <span className="cr2-market-chip-name">전체</span>
        <span className="cr2-market-chip-sub">{sorted.length}개</span>
      </button>
      {sorted.map(market => {
        const share = market.shareHistory?.length ? market.shareHistory.at(-1) : null
        const strategySet = !!(market.strategy?.price && market.strategy?.orderAmount)
        return (
          <button
            key={market.tierId}
            type="button"
            role="tab"
            aria-selected={value === market.tierId}
            className={`cr2-market-chip ${value === market.tierId ? 'cr2-market-chip-active' : ''}`}
            onClick={() => { onChange(market.tierId); playSFX('click') }}
          >
            <span className="cr2-market-chip-name">
              {TIER_ICONS[market.tierId]} {TIER_SHORT_NAMES[market.tierId]}
              {primary?.tierId === market.tierId && <span className="cr2-market-chip-dot" title="주력 시장" />}
            </span>
            <span className={`cr2-market-chip-sub ${strategySet ? '' : 'cr2-negative'}`}>
              {strategySet ? (share === null ? '설정됨' : `${Math.round(share * 100)}%`) : '미설정'}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// '전체' 칩: 모든 시장의 전략·수익을 한 표로 보고, 기존 시장은 여기서 철수할 수 있다
export function MarketOverview({ onOpenMarket }) {
  const state = useGameStore(s => s)
  const [confirmId, setConfirmId] = useState(null)
  const active = getActiveMarkets(state)
  const primary = getPrimaryMarket(state)
  const sorted = [...active].sort((a, b) => getTierById(b.tierId).floorMin - getTierById(a.tierId).floorMin)
  const closed = (state.markets || []).filter(market => !market.active)

  const totals = sorted.reduce((acc, market) => {
    const unitCost = getMarketUnitCost(state, market)
    const order = market.strategy?.orderAmount || 0
    acc.production += order * unitCost
    acc.operating += getMarketOperatingCost(state, market)
    acc.lastProfit += market.lastResult?.profit || 0
    return acc
  }, { production: 0, operating: 0, lastProfit: 0 })

  const handleClose = (tierId) => {
    const updates = closeMarket(state, tierId)
    if (updates) {
      useGameStore.setState(updates)
      if (state.selectedMarketId === tierId) useGameStore.setState({ selectedMarketId: primary?.tierId })
      playSFX('click')
    }
    setConfirmId(null)
  }

  return (
    <div className="cr2-market-overview">
      <div className="cr2-market-overview-title">시장 포트폴리오</div>
      <div className="cr2-market-overview-desc cr2-gray">
        기존 시장은 운영비 {Math.round(LEGACY_OPERATING_RATIO * 100)}%로 유지됩니다. 적자 시장은 철수할 수 있지만 다시 열 수 없습니다.
      </div>

      <table className="cr2-market-table">
        <thead>
          <tr>
            <th>시장</th>
            <th>가격</th>
            <th>발주</th>
            <th>지난달</th>
            <th aria-label="관리" />
          </tr>
        </thead>
        <tbody>
          {sorted.map(market => {
            const tier = getTierById(market.tierId)
            const isPrimary = primary?.tierId === market.tierId
            const profit = market.lastResult?.profit
            return (
              <tr key={market.tierId}>
                <td>
                  <button type="button" className="cr2-link-btn" onClick={() => onOpenMarket(market.tierId)}>
                    {TIER_ICONS[market.tierId]} {tier.category}
                  </button>
                  <div className="cr2-gray cr2-market-table-sub">
                    라이벌 {market.rivals.length} · 운영비 {Math.round(getMarketOperatingCost(state, market) / 10000)}만
                  </div>
                </td>
                <td className={market.strategy?.price ? '' : 'cr2-negative'}>
                  {market.strategy?.price ? `${Math.round(market.strategy.price).toLocaleString()}` : '미설정'}
                </td>
                <td className={market.strategy?.orderAmount ? '' : 'cr2-negative'}>
                  {market.strategy?.orderAmount ? market.strategy.orderAmount.toLocaleString() : '0'}
                </td>
                <td className={profit === undefined ? 'cr2-gray' : profit >= 0 ? 'cr2-positive' : 'cr2-negative'}>
                  {profit === undefined ? '—' : `${profit >= 0 ? '+' : ''}${Math.round(profit / 10000)}만`}
                </td>
                <td>
                  {isPrimary ? (
                    <span className="cr2-market-badge">주력</span>
                  ) : confirmId === market.tierId ? (
                    <span className="cr2-market-confirm">
                      <button type="button" className="cr2-mini-btn cr2-mini-btn-danger" onClick={() => handleClose(market.tierId)}>확정</button>
                      <button type="button" className="cr2-mini-btn" onClick={() => setConfirmId(null)}>취소</button>
                    </span>
                  ) : (
                    <button type="button" className="cr2-mini-btn" onClick={() => setConfirmId(market.tierId)}>철수</button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="cr2-market-overview-sum">
        <div><span className="cr2-gray">예정 생산비</span><span>{Math.round(totals.production / 10000).toLocaleString()}만원</span></div>
        <div><span className="cr2-gray">운영비 합계</span><span className="cr2-negative">{Math.round(totals.operating / 10000).toLocaleString()}만원</span></div>
        <div><span className="cr2-gray">지난달 시장 이익 합</span><span className={totals.lastProfit >= 0 ? 'cr2-positive' : 'cr2-negative'}>{Math.round(totals.lastProfit / 10000).toLocaleString()}만원</span></div>
      </div>

      {closed.length > 0 && (
        <div className="cr2-market-overview-closed cr2-gray">
          철수한 시장: {closed.map(market => getTierById(market.tierId).category).join(', ')}
        </div>
      )}
    </div>
  )
}
