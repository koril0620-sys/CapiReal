export function getMaxHealth(advisorId) {
  return advisorId === 'raider' ? 8 : 10
}

export function autoHealthRecovery(floor, advisorId) {
  if (advisorId === 'gambler') return 0
  if (floor % 10 === 0) return 1
  return 0
}

export function checkStreakBonus(history, advisorId) {
  const streakMap = { raider: 3, guardian: 5, analyst: 4, gambler: 0 }
  const required = streakMap[advisorId] || 0
  if (required === 0 || history.length < required) return 0
  return history.slice(-required).every(Boolean) ? 1 : 0
}

export function checkBankruptcy(capital, bankruptcyTurns) {
  return capital < 0 ? bankruptcyTurns + 1 : 0
}

export function checkGameOver(health, bankruptcyTurns) {
  return health <= 0 || bankruptcyTurns >= 4
}

export function rewardHealthRecovery(grade, maxHealth, currentHealth) {
  switch (grade) {
    case 'NORMAL':
      return Math.min(currentHealth + 1, maxHealth)
    case 'RARE':
      return Math.min(currentHealth + 2, maxHealth)
    case 'EPIC':
      return Math.min(currentHealth + 3, maxHealth)
    case 'LEGEND':
      return maxHealth
    default:
      return currentHealth
  }
}

export function eventHealthRecovery(choiceType, result, advisorId) {
  if (advisorId === 'raider' && choiceType === 'GAMBLE' && result === 'success') return 1
  if (advisorId === 'guardian' && choiceType === 'SAFE') {
    return Math.random() < 0.3 ? 1 : 0
  }
  if (advisorId === 'analyst' && result === 'rivalPredictionCorrect') return 1
  if (advisorId === 'gambler' && choiceType === 'ABSURD' && result === 'jackpot') return 2
  return 0
}

export function calculateHealth(health) {
  return health
}
