import { calcMarketShares, calcMarketDemand, getConsumerRatio, CONSUMER_GROUPS } from './marketEngine'
import { updateAwareness, updateBrand, getMarketingLimit, getMaxAwareness } from './brandQualityEngine'
import { updateMomentum } from './momentumEngine'
import { updateCreditScore } from './creditEngine'
import { checkBankruptcy, checkGameOver, autoHealthRecovery, checkStreakBonus } from './healthEngine'
import { processInterest, tickLoanDurations, processMaturity, getDebtTotal } from './loanEngine'
import { transitionPhase, tickActiveEffects, getNextPhaseHint } from './econEngine'
import { attemptQualityUpgrade, attemptCostReduction } from './factoryEngine'
import { checkAchievements } from './achievementEngine'
import {
  calcRivalStrategy,
  settleRival,
  checkRivalBankrupt,
  checkMarketIntervention,
  checkBossClearCondition,
  isRepeatingStrategy,
  getStageFailPenalty,
  BOSS_MAX_TURNS,
} from './monopolEngine'
import { getCurrentStage, isBossStage } from '../constants/monopol'
import {
  ensureMarkets,
  getTierById,
  getTierIndex,
  getPrimaryMarket,
  getMarketOperatingCost,
  FRINGE_COMPETITOR,
} from '../constants/markets'

const QUALITY_COST_MULTIPLIER = { reduce: 0.8, maintain: 1.0, upgrade: 1.25 }
const QUALITY_VALUE_MULTIPLIER = { reduce: 0.8, maintain: 1.0, upgrade: 1.2 }
const SHARE_HISTORY_LIMIT = 24

export function getQualityMultipliers(strategy = {}) {
  const action = strategy.qualityAction || strategy.qualityMode || 'maintain'
  if (action === 'custom') {
    const multiplier = strategy.qualityMultiplier || 1
    return { action, costMultiplier: multiplier, qualityMultiplier: multiplier }
  }
  return {
    action,
    costMultiplier: QUALITY_COST_MULTIPLIER[action] ?? 1,
    qualityMultiplier: QUALITY_VALUE_MULTIPLIER[action] ?? 1,
  }
}

export function getCostEffectMultiplier(activeEffects = []) {
  return activeEffects
    .filter(effect => effect.costMultiplier && effect.source !== 'RIVAL')
    .reduce((multiplier, effect) => multiplier * effect.costMultiplier, 1)
}

// 시장 하나의 이번 달 플레이어 판매량·라이벌 경쟁을 계산 (상태는 바꾸지 않음)
function simulateMarket(state, market, ctx) {
  const tier = getTierById(market.tierId)
  const strategy = market.strategy || {}
  const { costMultiplier, qualityMultiplier, action } = getQualityMultipliers(strategy)
  const unitCost = Math.floor(tier.baseCost * (1 - (state.costReductionTotal || 0)))
  const finalCost = Math.max(Math.floor(unitCost * costMultiplier * ctx.costEffect), 1)
  const effectiveQuality = Math.max(1, Math.floor(state.quality * qualityMultiplier))
  const price = strategy.price || unitCost * 2
  const lastShare = market.shareHistory?.length ? market.shareHistory.at(-1) : 0.5

  const rivalPlans = market.rivals.map(rival => calcRivalStrategy(rival, {
    econPhase: state.econPhase,
    playerPrice: price,
    playerOrder: strategy.orderAmount || 0,
    playerQuality: effectiveQuality,
    playerShare: lastShare,
    lastDemand: market.lastDemand,
    entityCount: market.rivals.length + 1,
    activeEffects: state.activeEffects,
    bossCounter: ctx.bossCounter && market.isPrimary,
  }))

  // Raider: 매력도 +7%, 라이벌 최저가보다 싸면 +5~10% 추가
  let playerMultiplier = 1
  if (state.selectedAdvisor === 'raider') {
    playerMultiplier *= 1.07
    const minRivalPrice = rivalPlans.length > 0 ? Math.min(...rivalPlans.map(plan => plan.price)) : Infinity
    if (price < minRivalPrice) playerMultiplier *= 1.05 + ctx.random() * 0.05
  }

  const entities = [
    {
      id: 'player',
      quality: effectiveQuality,
      brand: state.brand,
      awareness: state.awareness,
      price,
      attractionMultiplier: playerMultiplier,
    },
    ...market.rivals.map((rival, index) => ({
      id: rival.id,
      quality: rivalPlans[index].quality,
      brand: rivalPlans[index].brand,
      awareness: rivalPlans[index].awareness,
      price: rivalPlans[index].price,
    })),
  ]

  if (market.rivals.length === 0) {
    entities.push({
      id: FRINGE_COMPETITOR.id,
      quality: Math.max(effectiveQuality * FRINGE_COMPETITOR.qualityRatio, 3),
      brand: FRINGE_COMPETITOR.brand,
      awareness: FRINGE_COMPETITOR.awareness,
      price: Math.floor(tier.baseCost * FRINGE_COMPETITOR.priceMultiplier),
    })
  }

  const consumerRatio = getConsumerRatio(tier, state.activeEffects)
  const { shares, groupShares, groupLeaders } = calcMarketShares(entities, state.econPhase, consumerRatio, tier.baseCost)
  const totalDemand = calcMarketDemand(tier, state.econPhase, state.momentum, state.activeEffects, ctx.random)

  return {
    tier,
    strategy,
    qualityAction: action,
    unitCost,
    finalCost,
    effectiveQuality,
    price,
    lastShare,
    rivalPlans,
    shares,
    groupShares,
    groupLeaders,
    consumerRatio,
    totalDemand,
  }
}

export function settle(gameState, options = {}) {
  const random = options.random || Math.random
  const now = options.now ?? Date.now()

  const state = {
    ...gameState,
    currentStrategy: gameState.currentStrategy || {},
    activeEffects: gameState.activeEffects || [],
    loans: gameState.loans || [],
    momentumHistory: gameState.momentumHistory || [],
    stats: { ...(gameState.stats || {}) },
    unlockedAchievements: gameState.unlockedAchievements || [],
    defeatedRivals: gameState.defeatedRivals || [],
    metRivals: gameState.metRivals || [],
    markets: ensureMarkets(gameState).map(market => ({ ...market, rivals: [...(market.rivals || [])] })),
  }
  const prev = {
    health: state.health,
    bankruptcyTurns: state.bankruptcyTurns || 0,
    econPhase: state.econPhase,
  }
  const result = {
    markets: [],
    rivalBankruptcies: [],
    abilityTriggers: [],
  }

  // ── 1. 공장 작업 ───────────────────────────────
  if (state.factoryActionThisTurn) {
    const { type } = state.factoryActionThisTurn
    const factoryResult = type === 'quality'
      ? attemptQualityUpgrade(state)
      : attemptCostReduction(state)

    state.capital -= factoryResult.cost

    if (factoryResult.success) {
      if (type === 'quality') {
        state.quality = factoryResult.newQuality
        state.qualityUpgradeCount = (state.qualityUpgradeCount || 0) + 1
        state.factoryFailStreak = 0
      } else {
        state.costReductionTotal = factoryResult.newCostReductionTotal
        state.costReductionCount = (state.costReductionCount || 0) + 1
        state.costReductionFailStreak = 0
      }
    } else if (type === 'quality') {
      state.factoryFailStreak = (state.factoryFailStreak || 0) + 1
    } else {
      state.costReductionFailStreak = (state.costReductionFailStreak || 0) + 1
    }

    result.factoryResult = factoryResult
  }

  // ── 2. 마케팅 (회사 전체) ───────────────────────
  const marketingLimit = getMarketingLimit(state.capital, state.settings?.marketingLimitMode || 'ratio')
  const validMarketing = Math.max(Math.min(state.currentStrategy.marketingBudget || 0, marketingLimit), 0)
  result.marketingCost = validMarketing

  // ── 3. 보스전: 같은 전략 반복 여부를 계산 전에 판정 ─────
  const primaryBefore = getPrimaryMarket(state)
  const bossFloor = isBossStage(state.floor)
  const bossCounter = bossFloor && primaryBefore
    ? isRepeatingStrategy(primaryBefore.strategy, state.bossLastPlayerStrategy)
    : false
  result.bossCounter = bossCounter
  state.bossCounterActive = bossCounter

  // ── 4. 시장별 정산 ─────────────────────────────
  const costEffect = getCostEffectMultiplier(state.activeEffects)
  let capitalPool = Math.max(state.capital - validMarketing, 0)
  const orderCapRatio = state.selectedAdvisor === 'guardian' ? 0.9 : 1

  const ordered = [...state.markets]
    .map((market, index) => ({ market, index }))
    .filter(({ market }) => market.active)
    .sort((a, b) => getTierIndex(b.market.tierId) - getTierIndex(a.market.tierId))

  let totalRevenue = 0
  let totalProduction = 0
  let totalOperating = 0
  let totalSales = 0
  let totalOrder = 0
  let totalMyDemand = 0
  let maxGroupsLed = 0

  ordered.forEach(({ market, index }) => {
    const isPrimary = market.tierId === primaryBefore?.tierId
    const sim = simulateMarket(state, { ...market, isPrimary }, { costEffect, bossCounter, random })
    const playerShare = sim.shares.player || 0

    const requested = sim.strategy.orderAmount || 0
    const cap = state.orderCap && state.orderCap > 0 ? state.orderCap : Infinity
    const affordable = Math.floor(capitalPool / sim.finalCost)
    const orderAmount = Math.max(Math.min(Math.floor(requested * orderCapRatio), affordable, cap), 0)
    capitalPool -= orderAmount * sim.finalCost

    const myDemand = Math.floor(sim.totalDemand * playerShare)
    const actualSales = Math.min(orderAmount, myDemand)
    const revenue = actualSales * sim.price
    const productionCost = orderAmount * sim.finalCost
    const operatingCost = getMarketOperatingCost(state, market)
    const profit = revenue - productionCost - operatingCost

    // 라이벌 정산
    const survivors = []
    const rivalSummaries = []
    market.rivals.forEach((rival, rivalIndex) => {
      const plan = sim.rivalPlans[rivalIndex]
      const next = settleRival(rival, plan, sim.shares[rival.id] || 0, sim.totalDemand, sim.tier.operatingCost)
      rivalSummaries.push({
        id: next.id,
        name: next.name,
        company: next.company,
        isGeneric: next.isGeneric,
        share: next.marketShare,
        price: next.price,
        quality: plan.quality,
        netProfit: next.netProfit,
        capital: next.capital,
      })
      if (next.lastAbility) {
        result.abilityTriggers.push({ tierId: market.tierId, rivalId: next.id, name: next.name, label: next.lastAbility.label })
      }
      if (checkRivalBankrupt(next)) {
        result.rivalBankruptcies.push({
          id: next.id,
          name: next.name,
          company: next.company,
          isGeneric: next.isGeneric,
          tierId: market.tierId,
        })
      } else {
        survivors.push(next)
      }
    })

    const groupsLed = CONSUMER_GROUPS.filter(group => sim.groupLeaders[group] === 'player').length
    maxGroupsLed = Math.max(maxGroupsLed, groupsLed)

    // 가격 인하 후 점유율 +5%p 이상 (가격 전략가 업적)
    const lastPrice = market.lastStrategy?.price || 0
    if (isPrimary && lastPrice > 0 && sim.price < lastPrice && playerShare - sim.lastShare >= 0.05) {
      result.priceCutShareUp = true
    }
    if (isPrimary && market.lastStrategy && (
      market.lastStrategy.price !== sim.price || market.lastStrategy.qualityMode !== sim.qualityAction
    )) {
      result.primaryStrategyChanged = true
    }

    const marketResult = {
      tierId: market.tierId,
      name: sim.tier.name,
      category: sim.tier.category,
      isPrimary,
      price: sim.price,
      unitCost: sim.finalCost,
      qualityAction: sim.qualityAction,
      effectiveQuality: sim.effectiveQuality,
      requestedOrder: requested,
      orderAmount,
      actualSales,
      unsold: orderAmount - actualSales,
      myDemand,
      totalDemand: sim.totalDemand,
      share: playerShare,
      prevShare: sim.lastShare,
      fringeShare: sim.shares[FRINGE_COMPETITOR.id] || 0,
      revenue,
      productionCost,
      operatingCost,
      profit,
      groupShares: Object.fromEntries(CONSUMER_GROUPS.map(group => [group, sim.groupShares[group].player || 0])),
      consumerRatio: sim.consumerRatio,
      groupsLed,
      rivals: rivalSummaries,
    }
    result.markets.push(marketResult)

    state.markets[index] = {
      ...market,
      rivals: survivors,
      shareHistory: [...(market.shareHistory || []), playerShare].slice(-SHARE_HISTORY_LIMIT),
      lastDemand: sim.totalDemand,
      lastStrategy: { price: sim.price, qualityMode: sim.qualityAction, orderAmount: requested },
      lastResult: {
        floor: state.floor,
        share: playerShare,
        profit,
        revenue,
        sales: actualSales,
        demand: sim.totalDemand,
        orderAmount,
      },
    }

    totalRevenue += revenue
    totalProduction += productionCost
    totalOperating += operatingCost
    totalSales += actualSales
    totalOrder += orderAmount
    totalMyDemand += myDemand
  })

  // 닫힌 시장은 그대로 보존
  const primaryResult = result.markets.find(market => market.isPrimary) || result.markets[0] || null

  // ── 5. 이자 ───────────────────────────────────
  const interestRateBonus = state.activeEffects
    .filter(effect => effect.interestRateChange)
    .reduce((sum, effect) => sum + effect.interestRateChange, 0)
  const capitalBeforeInterest = state.capital + totalRevenue - totalProduction - validMarketing - totalOperating
  const interestResult = processInterest({
    capital: capitalBeforeInterest,
    loans: state.loans.map(loan => ({
      ...loan,
      interestRate: Math.max((loan.interestRate || 0.065) + interestRateBonus, 0.01),
    })),
  })
  // 가산금리는 저장하지 않고 원금 변화(연체 가산)만 반영
  state.loans = state.loans.map((loan, index) => ({
    ...loan,
    principal: interestResult.loans[index]?.principal ?? loan.principal,
  }))
  result.interestAmount = interestResult.interestAmount
  result.unpaidInterest = interestResult.unpaidInterest
  result.interestLate = interestResult.isLate
  result.interestPaid = interestResult.interestPaid

  const netProfit = totalRevenue - totalProduction - validMarketing - totalOperating - interestResult.interestAmount
  state.capital += netProfit

  result.revenue = totalRevenue
  result.totalCost = totalProduction
  result.operatingCost = totalOperating
  result.netProfit = netProfit
  result.isProfit = netProfit > 0
  result.shareAfter = primaryResult?.share || 0
  result.prevShare = primaryResult?.prevShare || 0
  result.totalDemand = primaryResult?.totalDemand || 0
  result.myDemand = totalMyDemand
  result.actualSales = totalSales
  result.orderAmount = totalOrder
  result.effectiveQuality = primaryResult?.effectiveQuality
  result.activeMarketCount = result.markets.length

  // ── 6. 대출 만기 ───────────────────────────────
  state.loans = tickLoanDurations(state.loans)
  const maturity = processMaturity(state.loans)
  state.loans = maturity.loans
  if (maturity.forcedAmount > 0) {
    state.capital -= maturity.forcedAmount
    result.forcedRepayment = maturity.forced.map(loan => ({ id: loan.id, type: loan.type, principal: loan.principal }))
  }
  result.loanOverdue = maturity.overdue
  state.debt = getDebtTotal(state.loans)

  // ── 7. 라이벌 파산 보상 ─────────────────────────
  result.rivalBankruptcies.forEach(bankrupt => {
    const tier = getTierById(bankrupt.tierId)
    if (bankrupt.isGeneric) {
      state.brand = Math.round((state.brand + 0.2) * 100) / 100
      state.awareness = Math.min(state.awareness + 3, getMaxAwareness(state.brand))
      bankrupt.reward = '브랜드 +0.2 · 인지도 +3'
      return
    }
    // 이름 있는 MONOPOL 조직원: 고객·설비 일부를 흡수
    const assetBonus = Math.floor(tier.operatingCost * 0.5)
    state.capital += assetBonus
    state.brand = Math.round((state.brand + 0.5) * 100) / 100
    state.awareness = Math.min(state.awareness + 5, getMaxAwareness(state.brand))
    bankrupt.reward = `잔여 자산 인수 +${Math.floor(assetBonus / 10000)}만원 · 브랜드 +0.5 · 인지도 +5`
    if (!state.defeatedRivals.includes(bankrupt.id)) {
      state.defeatedRivals = [...state.defeatedRivals, bankrupt.id]
    }
    if (!state.metRivals.includes(bankrupt.id)) {
      state.metRivals = [...state.metRivals, bankrupt.id]
    }
  })

  // ── 8. 브랜드·인지도·모멘텀·신용 ─────────────────
  state.awareness = updateAwareness(state.awareness, validMarketing, state.brand)
  state.brand = updateBrand(state.brand, netProfit, null)

  const { newHistory, momentum } = updateMomentum(state.momentumHistory, result.isProfit, state.selectedAdvisor)
  state.momentumHistory = newHistory
  state.momentum = momentum

  const creditResult = updateCreditScore(state, result, state.selectedAdvisor)
  state.creditScore = creditResult.newScore
  result.creditResult = creditResult

  // ── 9. 체력 ───────────────────────────────────
  if (!result.isProfit) {
    // Guardian: 적자여도 20% 확률로 체력 유지
    const guarded = state.selectedAdvisor === 'guardian' && random() < 0.2
    if (guarded) result.healthGuarded = true
    else state.health = Math.max(state.health - 1, 0)
  }
  state.health = Math.min(state.health + autoHealthRecovery(state.floor, state.selectedAdvisor), state.maxHealth)
  state.health = Math.min(state.health + checkStreakBonus(newHistory, state.selectedAdvisor), state.maxHealth)

  // ── 10. 스테이지 종료 판정 (조직원을 못 쓰러뜨리고 구간이 끝나면 페널티) ──
  const stage = getCurrentStage(state.floor)
  if (stage && state.floor === stage.floorMax && stage.floorMax - stage.floorMin >= 4 && stage.tier !== 'BOSS') {
    const stillAlive = state.markets.some(market => market.rivals.some(rival => rival.id === stage.rival))
    if (stillAlive) {
      const penalty = getStageFailPenalty()
      const capitalPenalty = Math.max(Math.floor(state.capital * penalty.capitalPenaltyRate), 0)
      state.health = Math.max(state.health - penalty.healthPenalty, 0)
      state.capital -= capitalPenalty
      state.stageFailCount = (state.stageFailCount || 0) + 1
      result.stageResult = {
        stageId: stage.id,
        cleared: false,
        rivalName: stage.rivalName,
        message: `${stage.rivalName}을(를) 쓰러뜨리지 못했다. 체력 -${penalty.healthPenalty}, 자본 -${Math.floor(capitalPenalty / 10000)}만원. 다음 조직원 자본 +20%.`,
      }
    } else {
      result.stageResult = {
        stageId: stage.id,
        cleared: true,
        rivalName: stage.rivalName,
        message: `${stage.rivalName} 구간 돌파!`,
      }
    }
  }

  state.bankruptcyTurns = checkBankruptcy(state.capital, state.bankruptcyTurns)
  result.isGameOver = checkGameOver(state.health, state.bankruptcyTurns)
  state.isGameOver = result.isGameOver

  // ── 11. 경기 국면 ──────────────────────────────
  const predicted = state.selectedAdvisor === 'analyst'
    ? getNextPhaseHint(prev.econPhase, 'analyst')
    : null
  state.econPhase = transitionPhase(state.econPhase, state.activeEffects, state.floor, state.selectedAdvisor, random)
  result.phaseChanged = state.econPhase !== prev.econPhase
  result.phasePredicted = !!(predicted && result.phaseChanged && predicted.phase === state.econPhase)
  state.activeEffects = tickActiveEffects(state.activeEffects)

  // ── 12. MONOPOL 시장 개입 ───────────────────────
  const intervention = checkMarketIntervention(state.floor, state.stageTurn || 1)
  if (intervention) {
    state.activeEffects = [
      ...state.activeEffects,
      ...intervention.effects.map(effect => ({
        ...effect,
        source: 'MONOPOL',
        title: intervention.description,
        remainingTurns: effect.duration || 1,
      })),
    ]
    result.monopolIntervention = intervention
  }

  // ── 13. 보스전 ─────────────────────────────────
  if (bossFloor) {
    const bossMarket = result.markets.find(market => market.rivals.some(rival => rival.id === 'hyekyung'))
    const bossShare = bossMarket
      ? bossMarket.rivals.find(rival => rival.id === 'hyekyung').share
      : 1 - result.shareAfter
    const playerShare = bossMarket ? bossMarket.share : result.shareAfter
    const round = {
      bossShare,
      playerShare,
      won: bossShare < 0.5 && playerShare > bossShare,
      counter: bossCounter,
    }
    state.bossShareHistory = [...(state.bossShareHistory || []).slice(-5), round]
    state.bossTurn = (state.bossTurn || 0) + 1
    state.bossLastPlayerStrategy = primaryBefore ? { ...primaryBefore.strategy } : null
    result.bossShare = bossShare
    result.bossRound = round
    result.bossTurn = state.bossTurn
    result.bossClear = checkBossClearCondition(state.bossShareHistory)
    result.bossTimeout = !result.bossClear && state.bossTurn >= BOSS_MAX_TURNS
    if (result.bossClear) state.bossDefeated = true
  }

  // ── 14. 통계·업적·기록 ──────────────────────────
  const elapsed = state.lastTurnAt ? Math.min(Math.max(now - state.lastTurnAt, 0), 10 * 60 * 1000) : 0
  state.lastTurnAt = now
  state.stats = updateStats(state.stats, result, state, prev, { elapsed, maxGroupsLed })
  state.phaseChangedLastTurn = result.phaseChanged

  state.stageTurn = (state.stageTurn || 1) + 1
  state.lastCapital = state.capital
  state.factoryActionThisTurn = null

  syncLegacyFields(state, result)

  const newlyUnlocked = checkAchievements(state, result)
  result.newlyUnlocked = newlyUnlocked
  if (newlyUnlocked.length > 0) {
    state.unlockedAchievements = [...new Set([...(state.unlockedAchievements || []), ...newlyUnlocked])]
  }

  state.revenueHistory = [...(state.revenueHistory || []).slice(-9), result.revenue]
  state.profitHistory = [...(state.profitHistory || []).slice(-9), result.netProfit]
  state.capitalHistory = [...(state.capitalHistory || []).slice(-9), state.capital]

  return { updatedState: state, settlementResult: result }
}

// 단일 시장 시절 화면·리포트가 읽는 필드를 주력 시장 기준으로 맞춘다
export function syncLegacyFields(state, result = null) {
  const primary = getPrimaryMarket(state)
  const stage = getCurrentStage(state.floor)
  if (primary) {
    state.playerShareHistory = primary.shareHistory || []
    state.lastTotalDemand = primary.lastDemand
    state.rivals = primary.rivals
    state.cost = Math.floor(getTierById(primary.tierId).baseCost * (1 - (state.costReductionTotal || 0)))
  }

  const allRivals = (state.markets || []).flatMap(market => market.rivals)
  const stageRival = allRivals.find(rival => rival.id === stage?.rival) || primary?.rivals?.[0] || null
  state.rivalCapital = stageRival?.capital ?? 0
  state.rivalInitialCapital = stageRival?.initialCapital ?? 0
  state.rivalConsecutiveLoss = stageRival?.consecutiveLoss ?? 0
  state.rivalPrice = stageRival?.price ?? state.rivalPrice
  state.rivalQuality = stageRival?.quality ?? state.rivalQuality
  state.rivalOrderAmount = stageRival?.orderAmount ?? 0
  state.rivalActualSales = stageRival?.actualSales ?? 0
  state.rivalNetProfit = stageRival?.netProfit ?? 0

  if (result) {
    result.rivalNetProfit = allRivals.reduce((sum, rival) => sum + (rival.netProfit || 0), 0)
    result.rivalBankrupt = result.rivalBankruptcies.some(bankrupt => bankrupt.id === stage?.rival)
    state.rivalBankrupt = result.rivalBankrupt
  }
}

function updateStats(stats, result, state, prev, extra) {
  const phasesExperienced = [...(stats.phasesExperienced || [])]
  if (!phasesExperienced.includes(state.econPhase)) phasesExperienced.push(state.econPhase)

  const namedDefeated = (state.defeatedRivals || []).length

  return {
    ...stats,
    playtime: (stats.playtime || 0) + 1,
    playSeconds: (stats.playSeconds || 0) + extra.elapsed / 1000,
    profitTurns: result.isProfit ? (stats.profitTurns || 0) + 1 : stats.profitTurns || 0,
    lossTurns: !result.isProfit ? (stats.lossTurns || 0) + 1 : stats.lossTurns || 0,
    maxShare: Math.max(stats.maxShare || 0, result.shareAfter || 0),
    profitStreak: result.isProfit ? (stats.profitStreak || 0) + 1 : 0,
    shareFirstStreak: result.shareAfter > 0.5 ? (stats.shareFirstStreak || 0) + 1 : 0,
    bankruptcyCount: state.bankruptcyTurns === 1 ? (stats.bankruptcyCount || 0) + 1 : stats.bankruptcyCount || 0,
    phasesExperienced,
    interestPaidCount: result.interestPaid ? (stats.interestPaidCount || 0) + 1 : stats.interestPaidCount || 0,
    marketingCount: (result.marketingCost || 0) > 0 ? (stats.marketingCount || 0) + 1 : stats.marketingCount || 0,
    shareOverSustained: result.shareAfter >= 0.5 ? (stats.shareOverSustained || 0) + 1 : 0,
    healthLossCount: state.health < prev.health ? (stats.healthLossCount || 0) + 1 : stats.healthLossCount || 0,
    priceShareUp: (result.shareAfter || 0) > (result.prevShare || 0) ? (stats.priceShareUp || 0) + 1 : stats.priceShareUp || 0,
    priceShareUp5pct: result.priceCutShareUp ? (stats.priceShareUp5pct || 0) + 1 : stats.priceShareUp5pct || 0,
    rivalsDefeated: namedDefeated,
    rivalDominated: (stats.rivalDominated || 0) + result.rivalBankruptcies.length,
    externalEventCount: result.monopolIntervention ? (stats.externalEventCount || 0) + 1 : stats.externalEventCount || 0,
    healthRecoverFromLow: prev.health <= 3 && state.health > prev.health
      ? (stats.healthRecoverFromLow || 0) + 1
      : stats.healthRecoverFromLow || 0,
    bankruptcyRecover: prev.bankruptcyTurns >= 1 && state.bankruptcyTurns === 0
      ? (stats.bankruptcyRecover || 0) + 1
      : stats.bankruptcyRecover || 0,
    consumerGroupCount: Math.max(stats.consumerGroupCount || 0, extra.maxGroupsLed),
    phaseStrategyAdapt: state.phaseChangedLastTurn && result.primaryStrategyChanged
      ? (stats.phaseStrategyAdapt || 0) + 1
      : stats.phaseStrategyAdapt || 0,
    phasePredictCount: result.phasePredicted ? (stats.phasePredictCount || 0) + 1 : stats.phasePredictCount || 0,
    maxActiveMarkets: Math.max(stats.maxActiveMarkets || 0, result.activeMarketCount || 0),
  }
}

export function getMaxOrderAmount(capital, cost, orderCap, advisorId = null) {
  const safeCost = Math.max(cost || 3000, 1)
  let max = Math.floor(Math.max(capital, 0) / safeCost)
  if (orderCap && orderCap > 0) max = Math.min(max, orderCap)
  if (advisorId === 'guardian') max = Math.floor(max * 0.9)
  return max
}
