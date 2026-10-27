export function updateMomentum(history, isProfit, advisorId) {
  const newHistory = [...history, isProfit].slice(-5)
  const profitCount = newHistory.filter(Boolean).length
  const total = newHistory.length || 1

  let momentum = Math.round((profitCount / total) * 10) - 5

  // Raider: 상승 모멘텀 ×1.5 / Guardian: 상승 모멘텀 ×0.8 (안정형의 대가)
  if (advisorId === 'raider' && momentum > 0) momentum = Math.min(Math.round(momentum * 1.5), 5)
  if (advisorId === 'guardian' && momentum > 0) momentum = Math.floor(momentum * 0.8)

  return { newHistory, momentum }
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

export function getMomentumLabel(momentum) {
  if (momentum >= 3) return '호황세'
  if (momentum >= 1) return '상승세'
  if (momentum === 0) return '중립'
  if (momentum >= -2) return '둔화'
  return '침체'
}

export function getRewardGradeProbabilities(momentum, momentumHistory) {
  const isStreaking = momentumHistory.length >= 5 &&
    momentumHistory.slice(-5).every(Boolean)

  if (isStreaking) return { NORMAL: 0.15, RARE: 0.35, EPIC: 0.35, LEGEND: 0.15 }
  if (momentum >= 3) return { NORMAL: 0.30, RARE: 0.40, EPIC: 0.22, LEGEND: 0.08 }
  if (momentum >= 0) return { NORMAL: 0.50, RARE: 0.35, EPIC: 0.12, LEGEND: 0.03 }
  return { NORMAL: 0.70, RARE: 0.25, EPIC: 0.04, LEGEND: 0.01 }
}

export function calculateMomentum(momentum) {
  return momentum
}
