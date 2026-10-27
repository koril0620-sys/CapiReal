export function getMaxAwareness(brand) {
  return Math.min(100, brand * 2)
}

export function applyAwarenessDecay(awareness) {
  return Math.max(awareness - 2, 0)
}

export function calcAwarenessGain(investAmount, currentAwareness) {
  let awareness = currentAwareness
  if (awareness <= 0) awareness = 1
  const gain = investAmount / (awareness * 150000)
  return Math.max(gain, 0.5)
}

export function updateAwareness(current, investAmount, brand) {
  const maxAwareness = getMaxAwareness(brand)
  const decayed = applyAwarenessDecay(current)
  const gained = investAmount > 0 ? calcAwarenessGain(investAmount, decayed) : 0
  return Math.min(decayed + gained, maxAwareness)
}

export function updateBrand(brand, netProfit, qualityDirection) {
  let delta = 0
  if (netProfit > 0) delta += 0.1
  else if (netProfit < 0) delta -= 0.2
  if (qualityDirection === 'DOWN') delta -= 0.3
  return Math.max(parseFloat((brand + delta).toFixed(2)), 0)
}

export function getMarketingLimit(capital, mode) {
  if (mode === 'ratio') return Math.floor(capital * 0.3)
  return Math.min(Math.floor(capital * 0.2), 5000000)
}

export function calculateBrandQuality(state) {
  return state
}
