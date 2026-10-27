import { getCurrentStage, MONOPOL_STAGES } from '../constants/monopol'
import { RIVALS } from '../constants/rivals'
import { ECO_PHASES } from '../constants/economy'
import { getCurrentTier } from '../constants/productTiers'
import { getTierById, MAX_RIVALS_PER_MARKET } from '../constants/markets'

// 혜경은 파산하지 않는다. Infinity는 JSON 저장 시 null이 되므로 큰 수 + 플래그로 표현
export const BOSS_CAPITAL = 1e15
export const MAX_RIVAL_COST_REDUCTION = 0.4

const PHASE_PRICE_MODIFIER = {
  boom: 1.20,
  growth: 1.10,
  stable: 1.00,
  contraction: 0.90,
  recession: 0.75,
}

const PHASE_QUALITY_MODIFIER = {
  boom: 3,
  growth: 1,
  stable: 0,
  contraction: -1,
  recession: -2,
}

const MARKETING_BUDGET_MAP = {
  LOW: 0.02,
  MID: 0.05,
  HIGH: 0.10,
  MAX: 0.15,
}

const GENERIC_COMPANY_NAMES = ['MONOPOL 유통', 'MONOPOL 물산', 'MONOPOL 상사', 'MONOPOL 테크', 'MONOPOL 리테일', 'MONOPOL 산업']

export function getRivalDef(rivalId) {
  return RIVALS.find(rival => rival.id === rivalId) || null
}

export function getStageForRival(rivalId) {
  return MONOPOL_STAGES.find(stage => stage.rival === rivalId) || null
}

export function getRivalInitialCapital(floor, playerCapital, stageFailCount = 0) {
  const stage = getCurrentStage(floor)
  if (!stage) return 0
  if (stage.capitalMultiplier === Infinity) return BOSS_CAPITAL
  const tier = getCurrentTier(floor)
  // 플레이어 자본에만 묶이지 않도록 단계 운영비 기준 하한을 둔다
  const base = Math.max(playerCapital || 0, tier.operatingCost * 4)
  return Math.floor(base * stage.capitalMultiplier * (1 + 0.2 * stageFailCount))
}

export function createRivalState(rivalId, tierId, options = {}) {
  const def = getRivalDef(rivalId)
  if (!def) return null
  const tier = getTierById(tierId)
  const isBoss = def.tier === 'BOSS'
  const capital = isBoss ? BOSS_CAPITAL : Math.max(options.capital || tier.operatingCost * 2, 1)

  return {
    id: def.id,
    name: def.name,
    company: def.company,
    tier: def.tier,
    profileImage: def.profileImage,
    isGeneric: false,
    unbreakable: isBoss,
    tierId,
    joinedFloor: options.floor || 1,
    turnsActive: 0,
    capital,
    initialCapital: capital,
    consecutiveLoss: 0,
    marketShare: 0,
    price: Math.floor(tier.baseCost * def.baseStrategy.priceMultiplier),
    costRate: 0,
    cost: tier.baseCost,
    quality: def.stats.quality,
    brand: def.stats.brand,
    awareness: def.stats.awareness,
    baseStrategy: { ...def.baseStrategy },
    orderAmount: 0,
    actualSales: 0,
    netProfit: 0,
    debt: 0,
    tempEffects: [],
    lastAbility: null,
  }
}

// MONOPOL이 붙이는 지원 라이벌 (이름 있는 10인 외의 추가 경쟁자)
export function createGenericRival(tierId, floor, strength = 1, index = 0) {
  const stage = getCurrentStage(floor)
  const stageDef = getRivalDef(stage?.rival) || RIVALS[0]
  const tier = getTierById(tierId)
  const company = GENERIC_COMPANY_NAMES[index % GENERIC_COMPANY_NAMES.length]
  const capital = Math.floor(tier.operatingCost * 3 * strength)

  return {
    id: `generic_${tierId}_${floor}_${index}`,
    name: '지원팀',
    company,
    tier: stageDef.tier === 'BOSS' ? 'CHAMPION' : stageDef.tier,
    profileImage: '/assets/logo_image-f7z3e97D.png',
    isGeneric: true,
    unbreakable: false,
    tierId,
    joinedFloor: floor,
    turnsActive: 0,
    capital,
    initialCapital: capital,
    consecutiveLoss: 0,
    marketShare: 0,
    price: Math.floor(tier.baseCost * 1.6),
    costRate: 0,
    cost: tier.baseCost,
    quality: Math.round(stageDef.stats.quality * 0.8 * strength * 10) / 10,
    brand: Math.round(stageDef.stats.brand * 0.8 * 10) / 10,
    awareness: Math.floor(stageDef.stats.awareness * 0.8),
    baseStrategy: { priceMultiplier: 1.5, orderMultiplier: 0.9, marketingBudget: 'MID' },
    orderAmount: 0,
    actualSales: 0,
    netProfit: 0,
    debt: 0,
    tempEffects: [],
    lastAbility: null,
  }
}

// 매 10층: 주력 시장 라이벌이 밀리고 있으면 MONOPOL이 지원팀을 투입한다
export function evaluateRivalPerformance(state, primaryMarket) {
  const floor = state.floor
  if (floor % 10 !== 0 || floor >= 119 || !primaryMarket) return null

  const stage = getCurrentStage(floor)
  const stageRival = primaryMarket.rivals.find(rival => rival.id === stage?.rival)
  const named = primaryMarket.rivals.filter(rival => !rival.isGeneric)
  const lead = stageRival || named[0] || primaryMarket.rivals[0] || null
  const leadName = lead?.name || stage?.rivalName || '라이벌'

  const isPoor = !lead
    || (lead.marketShare ?? 0) < 0.20
    || (lead.capital / Math.max(lead.initialCapital, 1)) < 0.50

  if (isPoor && primaryMarket.rivals.length < MAX_RIVALS_PER_MARKET) {
    return {
      type: 'REINFORCE',
      message: `"${leadName}... 실망이군. 지원팀을 붙이겠다."`,
      action: 'add_generic',
      tierId: primaryMarket.tierId,
    }
  }

  return {
    type: 'HOLD',
    message: '"아직은 지켜보지."',
    action: null,
    tierId: primaryMarket.tierId,
  }
}

function sumRivalEffect(activeEffects, rivalId, key, mode = 'mul') {
  return (activeEffects || [])
    .filter(effect => effect.source === 'RIVAL' && (!effect.targetRivalId || effect.targetRivalId === rivalId) && effect[key] !== undefined)
    .reduce((acc, effect) => mode === 'mul' ? acc * effect[key] : acc + effect[key], mode === 'mul' ? 1 : 0)
}

// ctx: { econPhase, playerPrice, playerOrder, playerQuality, playerShare, lastDemand, entityCount, activeEffects, bossCounter }
export function calcRivalStrategy(rival, ctx) {
  const phase = ECO_PHASES[ctx.econPhase] ? ctx.econPhase : 'stable'
  const tier = getTierById(rival.tierId)
  const strategyDef = rival.baseStrategy || { priceMultiplier: 1.5, orderMultiplier: 1, marketingBudget: 'MID' }

  const costMultiplier = sumRivalEffect(ctx.activeEffects, rival.id, 'rivalCostMultiplier')
  const cost = Math.max(Math.floor(tier.baseCost * (1 - (rival.costRate || 0)) * costMultiplier), 1)

  const baseStrategyPrice = Math.floor(cost * strategyDef.priceMultiplier)
  let price = Math.floor(baseStrategyPrice * (PHASE_PRICE_MODIFIER[phase] || 1))

  const playerShare = ctx.playerShare ?? 0
  if (playerShare > 0.8) price = Math.floor(price * 0.70)
  else if (playerShare > 0.6) price = Math.floor(price * 0.85)

  const playerPrice = ctx.playerPrice || 0
  if (playerPrice > 0 && playerPrice < price * 0.80) price = Math.floor(price * 0.90)

  let quality = (rival.quality || 5) + (PHASE_QUALITY_MODIFIER[phase] || 0)
  if ((ctx.playerQuality || 0) > quality + 10) quality += 3

  let awareness = rival.awareness || 20
  let orderMultiplier = strategyDef.orderMultiplier

  // 태준: 국면 최적화
  if (rival.id === 'taejun') {
    if (phase === 'boom' || phase === 'growth') {
      price = Math.floor(price * 1.15)
      orderMultiplier *= 1.2
    } else if (phase === 'contraction' || phase === 'recession') {
      price = Math.floor(price * 0.85)
      quality += 2
    }
  }

  // 일시 효과 (성진 덤핑 등)
  ;(rival.tempEffects || []).forEach(effect => {
    if (effect.priceMultiplier) price = Math.floor(price * effect.priceMultiplier)
  })

  // 라이벌 이벤트 (RE01~RE06)
  price = Math.floor(price * sumRivalEffect(ctx.activeEffects, rival.id, 'rivalPriceMultiplier'))
  awareness += sumRivalEffect(ctx.activeEffects, rival.id, 'rivalAwarenessBoost', 'add')
  awareness += sumRivalEffect(ctx.activeEffects, rival.id, 'rivalAwarenessPenalty', 'add')
  quality += sumRivalEffect(ctx.activeEffects, rival.id, 'rivalQualityBoost', 'add')
  const brandPenalty = sumRivalEffect(ctx.activeEffects, rival.id, 'rivalBrandPenalty', 'add')

  const minPrice = Math.floor(cost * 1.1)
  const isInCrisis = !rival.unbreakable && (
    (rival.consecutiveLoss || 0) >= 3 || rival.capital < (rival.initialCapital || 1) * 0.3
  )
  if (isInCrisis) price = Math.max(baseStrategyPrice, minPrice)

  // 혜경: 평소엔 고가·고품질 프리미엄 전략. 같은 전략을 반복하면 읽고 카운터(초저가 + 품질 + 인지도 몰빵)
  if (rival.id === 'hyekyung') {
    if (ctx.bossCounter) {
      price = Math.floor((playerPrice || baseStrategyPrice) * 0.65)
      quality += 15
      awareness = 100
    }
  } else {
    price = Math.max(price, minPrice)
  }

  const expectedShare = rival.marketShare > 0
    ? rival.marketShare
    : 1 / Math.max(ctx.entityCount || 2, 2)
  let orderAmount = Math.floor((ctx.lastDemand || tier.baseDemand) * expectedShare * orderMultiplier)
  if (phase === 'boom' || phase === 'growth') orderAmount = Math.floor(orderAmount * 1.2)
  else if (phase === 'recession') orderAmount = Math.floor(orderAmount * 0.7)
  if (rival.id === 'hyekyung' && ctx.playerOrder) orderAmount = Math.floor(ctx.playerOrder * 1.2)

  const marketingRate = MARKETING_BUDGET_MAP[strategyDef.marketingBudget] || 0.05
  const marketingBudget = rival.unbreakable
    ? 0
    : Math.floor(Math.max(Math.min(rival.capital, tier.operatingCost * 5), 0) * marketingRate)

  return {
    price: Math.max(price, 1),
    cost,
    quality: Math.max(quality, 1),
    brand: Math.max((rival.brand || 1) + brandPenalty, 0.1),
    awareness: Math.min(Math.max(awareness, 1), 100),
    orderAmount: Math.max(orderAmount, 0),
    marketingBudget,
  }
}

// 라이벌 한 명의 월말 정산
export function settleRival(rival, strategy, rivalShare, totalDemand, operatingCost) {
  const maxSales = Math.floor(totalDemand * rivalShare)
  const actualSales = Math.min(strategy.orderAmount, maxSales)
  const unsoldAmount = Math.max(strategy.orderAmount - actualSales, 0)
  // 팔지 못한 재고는 폐기 (플레이어와 같은 규칙)
  const inventoryLoss = Math.floor(unsoldAmount * strategy.cost * INVENTORY_LOSS_RATE)

  const revenue = actualSales * strategy.price
  const productionCost = actualSales * strategy.cost
  const interest = rival.debt ? Math.floor((rival.debt * 0.065) / 12) : 0
  const netProfit = revenue - productionCost - inventoryLoss - operatingCost - interest - strategy.marketingBudget

  const next = {
    ...rival,
    price: strategy.price,
    cost: strategy.cost,
    marketShare: rivalShare,
    orderAmount: strategy.orderAmount,
    actualSales,
    unsoldAmount,
    netProfit: rival.unbreakable ? Math.max(netProfit, 0) : netProfit,
    capital: rival.unbreakable ? BOSS_CAPITAL : rival.capital + netProfit,
    consecutiveLoss: netProfit < 0 ? (rival.consecutiveLoss || 0) + 1 : 0,
    turnsActive: (rival.turnsActive || 0) + 1,
    tempEffects: (rival.tempEffects || [])
      .map(effect => ({ ...effect, remainingTurns: effect.remainingTurns - 1 }))
      .filter(effect => effect.remainingTurns > 0),
    lastAbility: null,
  }

  return applyRivalAbility(next)
}

// 미판매 재고 손실률 (원가 대비) — 플레이어/라이벌 공통 규칙: 전량 폐기
export const INVENTORY_LOSS_RATE = 1

const ABILITY_LABELS = {
  MARKETING_BLITZ: '마케팅 폭격 — 인지도 +20',
  PRICE_DUMP: '가격 덤핑 — 다음 달 판매가 -30%',
  COST_REDUCTION_STACK: '원가 절감 누적 -0.5%',
  QUALITY_RUSH: '품질 러시 — 품질 +5',
  BRAND_INVEST: '브랜드 투자 — 브랜드 +0.2',
  PHASE_OPTIMIZER: '경기 국면 최적화',
  EVENT_AMPLIFY: '시장 교란 — 외부 이벤트 강도 ×1.5',
  AI_COUNTER: '패턴 분석 카운터',
}

export function getAbilityLabel(type) {
  return ABILITY_LABELS[type] || type
}

// 라이벌마다 자신의 MONOPOL 스테이지 능력을 가지고 다닌다 (다른 시장에 남아 있어도 발동)
export function applyRivalAbility(rival) {
  if (rival.isGeneric) return rival
  const stage = getStageForRival(rival.id)
  const ability = stage?.specialAbility
  if (!ability) return rival

  const types = ability.type === 'COMBINED' ? ['QUALITY_RUSH', 'EVENT_AMPLIFY'] : [ability.type]
  const interval = ability.type === 'COMBINED' ? 3 : (ability.interval || 1)
  if ((rival.turnsActive || 0) % interval !== 0) return rival

  let next = { ...rival }
  const triggered = []

  types.forEach(type => {
    switch (type) {
      case 'MARKETING_BLITZ':
        next.awareness = Math.min((next.awareness || 0) + (ability.effect?.awarenessBoost || 20), 100)
        triggered.push(type)
        break
      case 'PRICE_DUMP':
        next.tempEffects = [...(next.tempEffects || []), {
          type,
          priceMultiplier: ability.effect?.priceMultiplier || 0.7,
          remainingTurns: (ability.duration || 1) + 1,
        }]
        triggered.push(type)
        break
      case 'COST_REDUCTION_STACK':
        next.costRate = Math.min((next.costRate || 0) + (ability.effect?.costReductionPerTurn || 0.005), MAX_RIVAL_COST_REDUCTION)
        triggered.push(type)
        break
      case 'QUALITY_RUSH':
        next.quality = (next.quality || 0) + (ability.effect?.qualityBoost || 5)
        triggered.push(type)
        break
      case 'BRAND_INVEST':
        next.brand = Math.round(((next.brand || 0) + (ability.effect?.brandBoost || 0.2)) * 100) / 100
        triggered.push(type)
        break
      default:
        break
    }
  })

  if (triggered.length > 0) {
    next.lastAbility = { types: triggered, label: triggered.map(getAbilityLabel).join(' · ') }
  }
  return next
}

export function hasActiveAbility(markets, type) {
  return (markets || []).some(market => market.active && market.rivals.some(rival => {
    const ability = getStageForRival(rival.id)?.specialAbility
    if (!ability) return false
    if (ability.type === type) return true
    return ability.type === 'COMBINED' && type === 'EVENT_AMPLIFY'
  }))
}

export function checkRivalBankrupt(rival) {
  if (rival.unbreakable) return false
  return rival.capital < 0 && (rival.consecutiveLoss || 0) >= 4
}

// 기존 호출 호환용 (스테이지 능력 존재 여부)
export function checkSpecialAbility(floor, stageTurn) {
  const stage = getCurrentStage(floor)
  if (!stage?.specialAbility) return null
  const { type, interval, effect } = stage.specialAbility
  if (!interval || stageTurn % interval !== 0) return null
  return { type, effect }
}

const INTERVENTION_LABELS = {
  DEMAND_SUPPRESS: '수요 억제 — 전체 수요 -10%',
  SUPPLY_GLUT: '공급 과잉 — 전체 수요 -15%',
  RAW_MATERIAL_MONOPOLY: '원자재 매점 — 원가 +10%',
  ECONOMY_SUPPRESS: '경기 하향 압박',
  CONSUMER_MANIPULATION: '소비자 조작 — 브랜드 중시 소비자 +20%p',
  PHASE_CHAOS: '경기 국면 교란',
  FORCE_EXTERNAL_EVENT: '외부 충격 강제 발동',
  FULL_CONTROL: '경기 완전 장악',
}

export function getInterventionLabel(type) {
  return INTERVENTION_LABELS[type] || type
}

// 시장 개입 (복합 개입은 여러 효과로 풀어서 반환)
export function checkMarketIntervention(floor, stageTurn) {
  const stage = getCurrentStage(floor)
  if (!stage?.marketIntervention) return null

  const intervention = stage.marketIntervention
  if (intervention.type === 'COMBINED') {
    if (stageTurn % 1 !== 0) return null
    return {
      type: 'COMBINED',
      description: '경기 하향 + 외부 충격 강제',
      source: 'MONOPOL',
      effects: [
        { type: 'ECONOMY_SUPPRESS', forcePhaseDown: 1, duration: 1 },
        { type: 'FORCE_EXTERNAL_EVENT', forceExternalEvent: true, duration: 1 },
      ],
    }
  }
  if (intervention.type === 'FULL_CONTROL') {
    return {
      type: 'FULL_CONTROL',
      description: getInterventionLabel('FULL_CONTROL'),
      source: 'MONOPOL',
      effects: [{ type: 'FULL_CONTROL', duration: 1 }],
    }
  }

  const { type, interval, effect, duration } = intervention
  if (!interval || stageTurn % interval !== 0) return null
  return {
    type,
    description: getInterventionLabel(type),
    source: 'MONOPOL',
    effects: [{ ...effect, type, duration: duration || 1 }],
  }
}

export function getBossCounterStrategy(playerStrategy, bossLastStrategy) {
  if (!bossLastStrategy) return { isCounter: false }

  const isRepeating = isRepeatingStrategy(playerStrategy, bossLastStrategy)
  if (isRepeating) {
    return {
      priceMultiplier: 0.65,
      qualityBoost: 15,
      marketingMultiplier: 2.5,
      isCounter: true,
      counterMessage: '혜경이 당신의 전략을 읽었다. 패턴을 바꿔라.',
    }
  }

  return {
    priceMultiplier: 1.0,
    qualityBoost: 5,
    marketingMultiplier: 1.5,
    isCounter: false,
  }
}

export function isRepeatingStrategy(currentStrategy = {}, lastStrategy = null) {
  if (!lastStrategy) return false
  const price = currentStrategy.price || 0
  const lastPrice = lastStrategy.price || 0
  const order = currentStrategy.orderAmount || 0
  const lastOrder = lastStrategy.orderAmount || 0
  // 단계별 가격 규모가 크게 달라서 절대값 대신 비율로 비교
  const priceClose = Math.abs(price - lastPrice) <= Math.max(lastPrice * 0.03, 100)
  const orderClose = Math.abs(order - lastOrder) <= Math.max(lastOrder * 0.1, 5)
  return priceClose && orderClose
}

// 최종전은 120층에서 최대 BOSS_MAX_TURNS 턴 동안 이어진다
export const BOSS_MAX_TURNS = 6

export function isBossRoundWon(entry) {
  if (entry && typeof entry === 'object') return !!entry.won
  return typeof entry === 'number' && entry < 0.5
}

// 3턴 연속: 혜경 점유율 50% 미만 + 내 점유율이 혜경보다 높을 것
export function checkBossClearCondition(bossShareHistory) {
  if (!bossShareHistory || bossShareHistory.length < 3) return false
  return bossShareHistory.slice(-3).every(isBossRoundWon)
}

export function getStageFailPenalty() {
  return {
    healthPenalty: 1,
    capitalPenaltyRate: 0.1,
    rivalCapitalMultiplierBonus: 0.2,
  }
}

export function calcTurnsToRivalBankrupt(rivalCapital, rivalNetProfit) {
  if (!rivalNetProfit || rivalNetProfit >= 0) return null
  if (rivalCapital <= 0) return 0
  return Math.ceil(rivalCapital / Math.abs(rivalNetProfit))
}
