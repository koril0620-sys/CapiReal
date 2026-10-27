import { getCurrentStage } from '../constants/monopol'
import { getCurrentTier } from '../constants/productTiers'
import {
  createMarket,
  ensureMarkets,
  getPrimaryMarket,
  getTierById,
  MAX_RIVALS_PER_MARKET,
} from '../constants/markets'
import {
  createRivalState,
  createGenericRival,
  getRivalInitialCapital,
  evaluateRivalPerformance,
} from './monopolEngine'
import { syncLegacyFields } from './settlementEngine'

function cloneMarkets(state) {
  return ensureMarkets(state).map(market => ({ ...market, rivals: [...(market.rivals || [])] }))
}

function addRivalToMarket(market, rival) {
  if (market.rivals.length >= MAX_RIVALS_PER_MARKET) {
    // 이름 있는 조직원이 들어올 자리가 없으면 지원팀 하나를 빼준다
    const genericIndex = market.rivals.findIndex(item => item.isGeneric)
    if (genericIndex >= 0) market.rivals.splice(genericIndex, 1)
  }
  market.rivals.push(rival)
}

// 새 층에 들어설 때: 새 시장 개방, 새 MONOPOL 조직원 투입
export function enterFloor(state, prevFloor) {
  const floor = state.floor
  const markets = cloneMarkets(state)
  const events = { newMarket: null, newStage: null, rivalMoves: [] }
  const updates = {}

  const tier = getCurrentTier(floor)
  const stage = getCurrentStage(floor)
  const prevStage = prevFloor > 0 ? getCurrentStage(prevFloor) : null
  const stageChanged = !!stage && (!prevStage || prevStage.id !== stage.id)

  if (!markets.some(market => market.tierId === tier.id)) {
    const newMarket = createMarket(tier.id, floor)
    const legacy = markets.filter(market => market.active).map(market => market.tierId)

    // 구간이 이어지는 조직원은 주력 시장을 따라 이동한다
    if (stage && !stageChanged) {
      markets.forEach(market => {
        const index = market.rivals.findIndex(rival => rival.id === stage.rival)
        if (index >= 0) {
          const [rival] = market.rivals.splice(index, 1)
          newMarket.rivals.push({ ...rival, tierId: tier.id, marketShare: 0, costRate: rival.costRate || 0 })
          events.rivalMoves.push({ id: rival.id, name: rival.name, from: market.tierId, to: tier.id })
        }
      })
    }

    markets.push(newMarket)
    events.newMarket = { tierId: tier.id, legacy }
    // 주력 시장이 바뀌었으니 이전 시장의 가격·발주를 기본 전략으로 쓰지 않는다
    updates.currentStrategy = {
      ...(state.currentStrategy || {}),
      price: null,
      priceKey: null,
      priceMultiplier: null,
      orderAmount: null,
      orderKey: null,
    }
    updates.selectedMarketId = tier.id
  }

  const primary = getPrimaryMarket({ markets })

  if (stageChanged) {
    const alreadyIn = markets.some(market => market.rivals.some(rival => rival.id === stage.rival))
    const defeated = (state.defeatedRivals || []).includes(stage.rival)
    if (!alreadyIn && !defeated && primary) {
      const capital = getRivalInitialCapital(floor, state.capital, state.stageFailCount || 0)
      const rival = createRivalState(stage.rival, primary.tierId, { capital, floor })
      if (rival) addRivalToMarket(primary, rival)
    }

    updates.stageTurn = 1
    updates.currentStageId = stage.id
    updates.rivalBankrupt = false
    updates.metRivals = [...new Set([...(state.metRivals || []), stage.rival])]
    events.newStage = stage
  }

  updates.markets = markets
  updates.rivalCost = tier.baseCost

  const merged = { ...state, ...updates }
  syncLegacyFields(merged)
  return {
    updates: {
      ...updates,
      playerShareHistory: merged.playerShareHistory,
      lastTotalDemand: merged.lastTotalDemand,
      rivals: merged.rivals,
      cost: merged.cost,
      rivalCapital: merged.rivalCapital,
      rivalInitialCapital: merged.rivalInitialCapital,
      rivalConsecutiveLoss: merged.rivalConsecutiveLoss,
      rivalPrice: merged.rivalPrice,
      rivalQuality: merged.rivalQuality,
      rivalNetProfit: merged.rivalNetProfit,
    },
    events,
  }
}

// 매 10층 MONOPOL 평가: 주력 시장에 지원팀 투입 여부
export function applyMonopolEvaluation(state) {
  const markets = cloneMarkets(state)
  const primary = getPrimaryMarket({ markets })
  const evaluation = evaluateRivalPerformance(state, primary)
  if (!evaluation) return null

  if (evaluation.action === 'add_generic' && primary) {
    const index = (state.stats?.genericRivalCount || 0)
    const rival = createGenericRival(primary.tierId, state.floor, 1 + (state.stageFailCount || 0) * 0.2, index)
    primary.rivals.push(rival)
    evaluation.addedRival = { name: rival.name, company: rival.company, tierId: primary.tierId }
    return {
      evaluation,
      updates: {
        markets,
        monopolEvaluation: evaluation,
        stats: { ...(state.stats || {}), genericRivalCount: index + 1 },
      },
    }
  }

  // 추가 투입이 없으면 굳이 팝업을 띄우지 않는다
  return { evaluation, updates: {} }
}

export function closeMarket(state, tierId) {
  const primary = getPrimaryMarket(state)
  if (!primary || primary.tierId === tierId) return null
  const markets = cloneMarkets(state).map(market => (
    market.tierId === tierId ? { ...market, active: false, closedFloor: state.floor } : market
  ))
  return { markets }
}

export function getMarketLabel(tierId) {
  const tier = getTierById(tierId)
  return `${tier.category}`
}
