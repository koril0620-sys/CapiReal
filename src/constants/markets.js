import { PRODUCT_TIERS, getCurrentTier } from './productTiers'

// 한 시장에 동시에 들어올 수 있는 라이벌 수
export const MAX_RIVALS_PER_MARKET = 4

// 신규 시장이 열린 뒤에도 유지하는 기존 시장은 설비가 이미 있으므로 운영비의 70%만 든다
export const LEGACY_OPERATING_RATIO = 0.7

// 라이벌이 하나도 없는 시장에도 군소 업체들이 남아 있어 독점 점유율 100%는 나오지 않는다
export const FRINGE_COMPETITOR = {
  id: 'fringe',
  name: '군소 업체들',
  company: '기타 중소기업',
  qualityRatio: 0.6,
  brand: 1,
  awareness: 15,
  priceMultiplier: 1.8,
}

export const TIER_SHORT_NAMES = {
  tier_1: '식품',
  tier_2: '생활',
  tier_3: '부품',
  tier_4: '가전',
  tier_5: 'IT',
  tier_6: '첨단',
}

export const TIER_ICONS = {
  tier_1: '🍞',
  tier_2: '🧴',
  tier_3: '🔌',
  tier_4: '🔧',
  tier_5: '📱',
  tier_6: '🚀',
}

export function getTierById(tierId) {
  return PRODUCT_TIERS.find(tier => tier.id === tierId) || PRODUCT_TIERS[0]
}

export function getTierIndex(tierId) {
  return Math.max(PRODUCT_TIERS.findIndex(tier => tier.id === tierId), 0)
}

export function createDefaultStrategy() {
  return {
    price: null,
    priceKey: null,
    orderAmount: null,
    orderKey: null,
    qualityMode: 'maintain',
    qualityAction: 'maintain',
    qualityMultiplier: 1,
  }
}

export function createMarket(tierId, floor = 1) {
  return {
    tierId,
    openedFloor: floor,
    active: true,
    closedFloor: null,
    strategy: createDefaultStrategy(),
    rivals: [],
    shareHistory: [],
    lastDemand: getTierById(tierId).baseDemand,
    lastResult: null,
  }
}

export function getActiveMarkets(state) {
  return (state.markets || []).filter(market => market.active)
}

// 가장 최근에 열린(가장 높은 단계) 시장 = 이번 구간의 주력 시장
export function getPrimaryMarket(state) {
  const active = getActiveMarkets(state)
  if (active.length === 0) return null
  return active.reduce((best, market) =>
    getTierIndex(market.tierId) > getTierIndex(best.tierId) ? market : best,
  active[0])
}

export function isPrimaryMarket(state, tierId) {
  return getPrimaryMarket(state)?.tierId === tierId
}

export function getMarketOperatingCost(state, market) {
  const tier = getTierById(market.tierId)
  return isPrimaryMarket(state, market.tierId)
    ? tier.operatingCost
    : Math.floor(tier.operatingCost * LEGACY_OPERATING_RATIO)
}

export function getMarketUnitCost(state, market) {
  const tier = getTierById(market.tierId)
  return Math.floor(tier.baseCost * (1 - (state.costReductionTotal || 0)))
}

export function getMarketByTier(state, tierId) {
  return (state.markets || []).find(market => market.tierId === tierId) || null
}

// 예전 저장 데이터(시장 개념 이전)를 시장 구조로 맞춰준다
export function ensureMarkets(state) {
  if (Array.isArray(state.markets) && state.markets.length > 0) return state.markets
  const tier = getCurrentTier(state.floor || 1)
  const market = createMarket(tier.id, state.floor || 1)
  market.strategy = { ...market.strategy, ...(state.currentStrategy || {}) }
  market.rivals = Array.isArray(state.rivals) ? state.rivals : []
  market.shareHistory = state.playerShareHistory || []
  market.lastDemand = state.lastTotalDemand || tier.baseDemand
  return [market]
}
