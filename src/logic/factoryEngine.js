export const QUALITY_UPGRADE = {
  cost: 500000,
  minGain: 1,
  maxGain: 3,
  jackpotGain: 10,
  jackpotChance: 0.05,
  baseSuccessRate: 0.90,
}

export const COST_REDUCTION = {
  cost: 500000,
  minGain: 0.05,
  maxGain: 0.08,
  baseSuccessRate: 0.90,
}

export const MAX_COST_REDUCTION = 0.40

export function getSuccessRate(baseRate, totalUpgradeCount, failStreak) {
  const decayed = baseRate - totalUpgradeCount * 0.05
  const boosted = decayed + failStreak * 0.10
  return Math.min(Math.max(boosted, 0.10), 0.95)
}

export function attemptQualityUpgrade(gameState) {
  const successRate = getSuccessRate(
    QUALITY_UPGRADE.baseSuccessRate,
    gameState.qualityUpgradeCount || 0,
    gameState.factoryFailStreak || 0,
  )
  const roll = Math.random()

  if (roll < successRate) {
    const isJackpot = Math.random() < QUALITY_UPGRADE.jackpotChance
    const gain = isJackpot
      ? QUALITY_UPGRADE.jackpotGain
      : Math.floor(
        Math.random() * (QUALITY_UPGRADE.maxGain - QUALITY_UPGRADE.minGain + 1)
        + QUALITY_UPGRADE.minGain,
      )

    return {
      success: true,
      isJackpot,
      type: 'quality',
      qualityGain: gain,
      newQuality: gameState.quality + gain,
      cost: QUALITY_UPGRADE.cost,
      successRate,
      newFailStreak: 0,
      newUpgradeCount: (gameState.qualityUpgradeCount || 0) + 1,
    }
  }

  return {
    success: false,
    type: 'quality',
    qualityGain: 0,
    newQuality: gameState.quality,
    cost: QUALITY_UPGRADE.cost,
    successRate,
    newFailStreak: (gameState.factoryFailStreak || 0) + 1,
    newUpgradeCount: gameState.qualityUpgradeCount || 0,
  }
}

export function attemptCostReduction(gameState) {
  const successRate = getSuccessRate(
    COST_REDUCTION.baseSuccessRate,
    gameState.costReductionCount || 0,
    gameState.costReductionFailStreak || 0,
  )
  const roll = Math.random()

  if (roll < successRate) {
    const gain = parseFloat(
      (Math.random() * (COST_REDUCTION.maxGain - COST_REDUCTION.minGain)
      + COST_REDUCTION.minGain).toFixed(3),
    )
    const newReduction = Math.min(
      (gameState.costReductionTotal || 0) + gain,
      MAX_COST_REDUCTION,
    )

    return {
      success: true,
      type: 'cost',
      reductionGain: gain,
      newCostReductionTotal: newReduction,
      cost: COST_REDUCTION.cost,
      successRate,
      newFailStreak: 0,
      newUpgradeCount: (gameState.costReductionCount || 0) + 1,
    }
  }

  return {
    success: false,
    type: 'cost',
    reductionGain: 0,
    newCostReductionTotal: gameState.costReductionTotal || 0,
    cost: COST_REDUCTION.cost,
    successRate,
    newFailStreak: (gameState.costReductionFailStreak || 0) + 1,
    newUpgradeCount: gameState.costReductionCount || 0,
  }
}

export function applyFactoryAction(state) {
  return state
}
