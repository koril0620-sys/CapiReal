import { CREDIT_GRADES } from '../constants/creditScore'

export function getGrade(score) {
  if (score >= 80) return 'A'
  if (score >= 60) return 'B'
  if (score >= 40) return 'C'
  return 'D'
}

export function getLoanLimit(score, capital) {
  const grade = getGrade(score)
  const gradeData = CREDIT_GRADES.find(g => g.grade === grade)
  if (!gradeData || gradeData.loanCapMultiplier === 0) return 0
  return Math.floor(capital * gradeData.loanCapMultiplier)
}

export function getInterestRate(score, activeEffects = [], advisorId = null) {
  const grade = getGrade(score)
  const gradeData = CREDIT_GRADES.find(g => g.grade === grade)
  if (!gradeData || !gradeData.interestRate) return null

  let rate = gradeData.interestRate

  activeEffects.forEach(effect => {
    if (effect.interestRateChange) rate += effect.interestRateChange
  })

  if (advisorId === 'guardian') rate *= 0.9

  return Math.max(rate, 0.01)
}

export function updateCreditScore(gameState, settlementResult, advisorId) {
  let delta = 0
  const stats = gameState.stats || {}

  if (settlementResult.isProfit) delta += 1
  else delta -= 2

  if (settlementResult.interestPaid) delta += 2
  if (settlementResult.loanRepaid) delta += 5
  if ((stats.profitStreak || 0) >= 3) delta += 1
  if (settlementResult.shareAfter >= 0.5) delta += 1

  if (gameState.capital < 0) delta -= 5
  if (settlementResult.interestLate) delta -= 4
  if (settlementResult.loanOverdue) delta -= 3
  if (gameState.bankruptcyTurns >= 3) delta -= 10
  if (settlementResult.forcedRepayment) delta -= 10

  ;(gameState.activeEffects || []).forEach(effect => {
    if (effect.creditScoreChange) delta += effect.creditScoreChange
  })

  if (advisorId === 'guardian') delta = delta > 0 ? delta : delta + 1
  if (advisorId === 'raider') delta = delta > 0 ? delta + 1 : delta
  if (advisorId === 'gambler') delta = Math.round(delta * 1.5)

  const newScore = Math.min(Math.max(gameState.creditScore + delta, 0), 100)

  return {
    newScore,
    delta,
    newGrade: getGrade(newScore),
    gradeChanged: getGrade(newScore) !== getGrade(gameState.creditScore),
  }
}

export function checkGradeChange(prevScore, newScore) {
  const prevGrade = getGrade(prevScore)
  const newGrade = getGrade(newScore)
  if (prevGrade === newGrade) return null

  const order = ['D', 'C', 'B', 'A']
  return order.indexOf(newGrade) > order.indexOf(prevGrade) ? 'UP' : 'DOWN'
}

export function calculateCreditScore(score) {
  return score
}
