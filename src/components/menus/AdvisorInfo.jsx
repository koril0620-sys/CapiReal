import { useGameStore } from '../../store/useGameStore'
import { ADVISORS } from '../../constants/advisors'
import { getNextPhaseHint } from '../../logic/econEngine'

export default function AdvisorInfo() {
  const gameState = useGameStore(s => s)
  const setCurrentScreen = useGameStore(s => s.setCurrentScreen)

  const advisor = ADVISORS.find(a => a.id === gameState.selectedAdvisor)
  if (!advisor) return null

  const phaseHint = getNextPhaseHint(gameState.econPhase, gameState.selectedAdvisor)
  const color = getAdvisorColor(advisor.id)

  return (
    <div className="cr2-advisor-info-screen cr2-scrollable">
      <div className="cr2-advisor-info-header">
        <button className="cr2-btn" onClick={() => setCurrentScreen('main')}>← 뒤로</button>
        <div className="cr2-advisor-info-title">어드바이저 정보</div>
      </div>

      <div className="cr2-advisor-info-profile">
        <img
          src={advisor.profileImage}
          alt={advisor.name}
          className="cr2-advisor-info-img"
        />
        <div className="cr2-advisor-info-name" style={{ color }}>
          {advisor.name}
        </div>
        <div className="cr2-advisor-info-style">{advisor.style}</div>
        <div className="cr2-advisor-info-desc">{advisor.description}</div>
      </div>

      <div className="cr2-advisor-info-section">
        <div className="cr2-advisor-info-section-title cr2-positive">버프</div>
        {advisor.buffs.map((b, i) => (
          <div key={i} className="cr2-advisor-info-item cr2-positive">✅ {b}</div>
        ))}
      </div>

      <div className="cr2-advisor-info-section">
        <div className="cr2-advisor-info-section-title cr2-negative">너프</div>
        {advisor.nerfs.map((n, i) => (
          <div key={i} className="cr2-advisor-info-item cr2-negative">❌ {n}</div>
        ))}
      </div>

      <div className="cr2-advisor-info-section">
        <div className="cr2-advisor-info-section-title cr2-gold">현재 적용 중인 보정</div>
        <div className="cr2-advisor-info-item">리포트 스타일: {advisor.reportStyle}</div>
        {phaseHint && (
          <div className="cr2-advisor-info-item cr2-gold">
            🔮 {phaseHint.message}
          </div>
        )}
        <div className="cr2-advisor-info-item">
          연속 흑자 체력 회복 기준: {advisor.streakBonus > 0 ? `${advisor.streakBonus}턴` : '없음'}
        </div>
      </div>
    </div>
  )
}

function getAdvisorColor(id) {
  const colors = { raider: '#DC143C', guardian: '#00AA00', analyst: '#00FF41', gambler: '#FFD700' }
  return colors[id] || '#00FF41'
}
