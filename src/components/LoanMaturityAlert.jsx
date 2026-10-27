import { useGameStore } from '../store/useGameStore'
import { repayLoan, extendLoan } from '../logic/loanEngine'
import { getGrade } from '../logic/creditEngine'
import { LOAN_TYPES } from '../constants/creditScore'
import { playSFX } from '../logic/audioEngine'

export default function LoanMaturityAlert({ loan, onClose }) {
  const gameState = useGameStore(s => s)
  const loanType = LOAN_TYPES.find(l => l.id === loan.type)
  const grade = getGrade(gameState.creditScore)

  const handleRepay = () => {
    const result = repayLoan(loan.id, gameState)
    if (result.success) {
      useGameStore.setState(state => ({
        capital: result.newCapital,
        debt: result.newDebt,
        loans: result.newLoans,
        creditScore: Math.min(gameState.creditScore + 5, 100),
        stats: result.statsUpdate
          ? { ...(state.stats || {}), ...result.statsUpdate }
          : state.stats,
      }))
      playSFX('profit')
      onClose()
    }
  }

  const handleExtend = () => {
    const result = extendLoan(loan.id, gameState)
    if (result.success) {
      useGameStore.setState({ loans: result.newLoans })
      playSFX('click')
      onClose()
    }
  }

  const handleLater = () => {
    useGameStore.setState({
      creditScore: Math.max(gameState.creditScore - 4, 0),
    })
    playSFX('warning')
    onClose()
  }

  const gradeOrder = ['D', 'C', 'B', 'A']
  const canExtend = gradeOrder.indexOf(grade) >= gradeOrder.indexOf(loanType?.extensionGrade || 'A')

  return (
    <div className="cr2-popup-overlay">
      <div className="cr2-loan-alert">
        <div className="cr2-loan-alert-title cr2-negative">⚠️ 대출 만기 도래</div>

        <div className="cr2-loan-alert-info">
          <div>{loanType?.label || '대출'}</div>
          <div>원금 {(loan.principal / 10000).toFixed(0)}만원</div>
          <div className="cr2-gray">이자율 {(loan.interestRate * 100).toFixed(1)}%</div>
        </div>

        <div className="cr2-loan-alert-btns">
          <button
            className="cr2-btn cr2-loan-repay-btn"
            onClick={handleRepay}
            disabled={gameState.capital < loan.principal}
          >
            지금 상환
            {gameState.capital < loan.principal && (
              <span className="cr2-negative"> (자본 부족)</span>
            )}
          </button>

          <button
            className="cr2-btn"
            onClick={handleExtend}
            disabled={!canExtend}
          >
            연장하기
            {!canExtend && (
              <div className="cr2-negative" style={{ fontSize: 8 }}>
                {loanType?.extensionGrade}등급 이상 필요
              </div>
            )}
          </button>

          <button className="cr2-btn cr2-btn-ghost cr2-negative" onClick={handleLater}>
            나중에 처리
            <div style={{ fontSize: 8, color: 'var(--cr2-red)' }}>신용점수 -4</div>
          </button>
        </div>
      </div>
    </div>
  )
}
