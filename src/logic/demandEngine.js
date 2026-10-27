import { ECO_PHASES } from '../constants/economy'

export function calcAttraction(entity, group, econPhase, rivalRate = 0) {
  const { quality, brand, awareness, price } = entity
  const phase = ECO_PHASES[econPhase] || ECO_PHASES.stable
  const aw = awareness / 100

  switch (group) {
    case 'quality':
      return Math.max((quality * 1.5) / Math.max(price, 1), 0.001)
    case 'brand':
      return Math.max(brand * aw * 1.3, 0.001)
    case 'price':
      return Math.max((1 / Math.max(price, 1)) * phase.demandMultiplier * 2.0, 0.001)
    case 'general':
      return Math.max(
        ((quality + brand) * (1 + aw)) /
        (Math.max(price, 1) * (1 - Math.min(rivalRate, 0.9))),
        0.001,
      )
    default:
      return 0.001
  }
}

export function calcShare(playerAttraction, allAttractions) {
  const playerSq = playerAttraction ** 2
  const totalSq = allAttractions.reduce((sum, attraction) => sum + attraction ** 2, 0)
  if (totalSq === 0) return 0
  return playerSq / totalSq
}

export function getMomentumMultiplier(momentum) {
  if (momentum >= 5) return 1.15
  if (momentum >= 3) return 1.08
  if (momentum >= 1) return 1.03
  if (momentum === 0) return 1.00
  if (momentum >= -2) return 0.95
  if (momentum >= -4) return 0.90
  return 0.85
}
