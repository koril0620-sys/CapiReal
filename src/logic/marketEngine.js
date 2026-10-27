import { calcAttraction, getMomentumMultiplier } from './demandEngine'
import { ECO_PHASES } from '../constants/economy'

export const CONSUMER_GROUPS = ['quality', 'brand', 'price', 'general']

export const CONSUMER_GROUP_LABELS = {
  quality: '품질 중시',
  brand: '브랜드 중시',
  price: '가격 중시',
  general: '일반',
}

// 단계별 소비자 비율 + MONOPOL 소비자 조작(브랜드 중시 비율 증가) 반영
export function getConsumerRatio(tier, activeEffects = []) {
  const ratio = { ...tier.consumerRatio }
  const brandBoost = activeEffects
    .filter(effect => effect.brandConsumerRatio)
    .reduce((sum, effect) => sum + effect.brandConsumerRatio, 0)

  if (brandBoost > 0) {
    const newBrand = Math.min(ratio.brand + brandBoost, 0.9)
    const others = CONSUMER_GROUPS.filter(group => group !== 'brand')
    const otherTotal = others.reduce((sum, group) => sum + ratio[group], 0) || 1
    others.forEach(group => {
      ratio[group] = (ratio[group] / otherTotal) * (1 - newBrand)
    })
    ratio.brand = newBrand
  }

  return ratio
}

// entities: [{ id, quality, brand, awareness, price, attractionMultiplier }]
// 소비자 군별로 따로 점유율을 계산한 뒤 군 비율로 가중합한다.
// (가격 중시 소비자는 싼 곳, 브랜드 중시 소비자는 브랜드 높은 곳으로 간다)
// priceScale: 가격을 그 시장의 기본 원가로 나눠서 쓴다.
// (원가 50만원짜리 시장에서 1/가격 같은 값이 0.001 하한에 걸려 가격·품질 경쟁이 사라지는 문제 방지)
export function calcMarketShares(entities, econPhase, consumerRatio, priceScale = 1) {
  const shares = {}
  const groupShares = {}
  const groupLeaders = {}

  entities.forEach(entity => {
    shares[entity.id] = 0
  })

  CONSUMER_GROUPS.forEach(group => {
    const values = entities.map(entity => ({
      id: entity.id,
      value: calcAttraction(
        { ...entity, price: Math.max(entity.price / Math.max(priceScale, 1), 0.01) },
        group,
        econPhase,
      ) * (entity.attractionMultiplier || 1),
    }))
    const totalSq = values.reduce((sum, item) => sum + item.value ** 2, 0) || 1
    groupShares[group] = {}
    let leader = null

    values.forEach(item => {
      const share = (item.value ** 2) / totalSq
      groupShares[group][item.id] = share
      shares[item.id] += share * (consumerRatio[group] || 0)
      if (!leader || share > groupShares[group][leader]) leader = item.id
    })

    groupLeaders[group] = leader
  })

  return { shares, groupShares, groupLeaders }
}

export function calcMarketDemand(tier, econPhase, momentum, activeEffects = [], random = Math.random) {
  const phase = ECO_PHASES[econPhase] || ECO_PHASES.stable
  const momentumMultiplier = getMomentumMultiplier(momentum || 0)
  const noise = 0.9 + random() * 0.2

  const effectMultiplier = activeEffects
    .filter(effect => effect.demandMultiplier)
    .reduce((multiplier, effect) => multiplier * effect.demandMultiplier, 1)

  return Math.floor(tier.baseDemand * phase.demandMultiplier * momentumMultiplier * noise * effectMultiplier)
}
