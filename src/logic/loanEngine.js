import { LOAN_TYPES } from '../constants/creditScore'
import { getGrade, getLoanLimit, getInterestRate } from './creditEngine'

export const MIN_LOAN_AMOUNT = 100000
export const OVERDUE_PENALTY_RATE = 0.02
export const FORCED_REPAYMENT_TURNS = 3

export function getDebtTotal(loans = []) {
  return loans.reduce((sum, loan) => sum + (loan.principal || 0), 0)
}

export function getAvailableLoanAmount(gameState) {
  const loans = gameState.loans || []
  const totalLimit = getLoanLimit(gameState.creditScore, gameState.capital)
  return Math.max(totalLimit - getDebtTotal(loans), 0)
}

export function takeLoan(loanTypeId, gameState, requestedAmount = null) {
  const loans = gameState.loans || []
  const fail = reason => ({ success: false, reason, error: reason })

  const alreadyHas = loans.some(loan => (loan.typeId || loan.type) === loanTypeId)
  if (alreadyHas) {
    return fail('같은 종류의 대출이 이미 있습니다.')
  }

  if (loans.length >= 3) {
    return fail('대출은 최대 3건까지 가능합니다.')
  }

  const grade = getGrade(gameState.creditScore)
  if (grade === 'D') return fail('신용등급 D — 대출 불가합니다.')

  const loanType = LOAN_TYPES.find(loan => loan.id === loanTypeId)
  if (!loanType) return fail('대출 종류 오류')

  const available = getAvailableLoanAmount(gameState)
  if (available <= 0) return fail('대출 한도가 없습니다.')

  const loanAmount = requestedAmount
    ? Math.min(Math.floor(requestedAmount), available)
    : available
  if (loanAmount < MIN_LOAN_AMOUNT) return fail('최소 대출 금액은 10만원입니다.')

  const interestRate = getInterestRate(
    gameState.creditScore,
    gameState.activeEffects,
    gameState.selectedAdvisor,
  )

  return {
    success: true,
    capitalIncrease: loanAmount,
    newCapital: gameState.capital + loanAmount,
    newLoan: {
      id: `loan_${loanTypeId}_${Date.now()}`,
      type: loanTypeId,
      typeId: loanTypeId,
      principal: loanAmount,
      interestRate,
      remainingTurns: loanType.duration,
    },
    newDebt: getDebtTotal(loans) + loanAmount,
  }
}

// 이자를 낼 돈이 없으면 연체: 그 달 이자는 원금에 가산된다 (복리처럼 불어남)
// 만기가 지난 대출은 연체 가산금리가 붙는다
export function processInterest(gameState) {
  const loans = gameState.loans || []
  if (loans.length === 0) {
    return { interestAmount: 0, unpaidInterest: 0, isLate: false, interestPaid: false, loans }
  }

  const perLoan = loans.map(loan => {
    const rate = (loan.interestRate || 0.065) + (loan.remainingTurns < 0 ? OVERDUE_PENALTY_RATE : 0)
    return Math.floor((loan.principal * rate) / 12)
  })
  const monthlyInterest = perLoan.reduce((sum, value) => sum + value, 0)
  const isLate = (gameState.capital || 0) < monthlyInterest

  if (isLate) {
    return {
      interestAmount: 0,
      unpaidInterest: monthlyInterest,
      isLate: true,
      interestPaid: false,
      loans: loans.map((loan, index) => ({ ...loan, principal: loan.principal + perLoan[index] })),
    }
  }

  return {
    interestAmount: monthlyInterest,
    unpaidInterest: 0,
    isLate: false,
    interestPaid: monthlyInterest > 0,
    loans,
  }
}

// 만기 후 FORCED_REPAYMENT_TURNS 턴이 지나면 은행이 원금을 강제로 회수한다
export function processMaturity(loans = []) {
  const forced = loans.filter(loan => loan.remainingTurns <= -FORCED_REPAYMENT_TURNS)
  const remaining = loans.filter(loan => loan.remainingTurns > -FORCED_REPAYMENT_TURNS)
  return {
    loans: remaining,
    forced,
    forcedAmount: getDebtTotal(forced),
    overdue: remaining.some(loan => loan.remainingTurns < 0),
  }
}

export function tickLoanDurations(loans) {
  return loans.map(loan => ({
    ...loan,
    remainingTurns: loan.remainingTurns - 1,
  }))
}

export function getMaturedLoans(loans) {
  return loans.filter(loan => loan.remainingTurns <= 0)
}

export function getUpcomingMaturityLoans(loans) {
  return loans.filter(loan => loan.remainingTurns > 0 && loan.remainingTurns <= 3)
}

export function repayLoan(loanId, gameState) {
  const loan = gameState.loans.find(item => item.id === loanId)
  if (!loan) return { success: false, error: '대출을 찾을 수 없습니다.' }

  if (gameState.capital < loan.principal) {
    return { success: false, error: '자본이 부족합니다.' }
  }

  return {
    success: true,
    capitalDecrease: loan.principal,
    newCapital: gameState.capital - loan.principal,
    newLoans: gameState.loans.filter(item => item.id !== loanId),
    newDebt: Math.max(getDebtTotal(gameState.loans) - loan.principal, 0),
    loanRepaid: true,
    statsUpdate: {
      loanRepaidCount: (gameState.stats?.loanRepaidCount || 0) + 1,
    },
  }
}

export function extendLoan(loanId, gameState) {
  const loan = gameState.loans.find(item => item.id === loanId)
  if (!loan) return { success: false, error: '대출을 찾을 수 없습니다.' }

  const loanType = LOAN_TYPES.find(item => item.id === loan.type)
  if (!loanType) return { success: false, error: '대출 종류 오류' }

  const grade = getGrade(gameState.creditScore)
  const gradeOrder = ['D', 'C', 'B', 'A']
  const requiredIndex = gradeOrder.indexOf(loanType.extensionGrade)
  const currentIndex = gradeOrder.indexOf(grade)

  if (currentIndex < requiredIndex) {
    return {
      success: false,
      error: `연장 조건 미충족 — ${loanType.extensionGrade}등급 이상 필요`,
    }
  }

  return {
    success: true,
    newLoans: gameState.loans.map(item =>
      item.id === loanId ? { ...item, remainingTurns: loanType.duration } : item,
    ),
  }
}

export function calculateLoanState(state) {
  return state
}
