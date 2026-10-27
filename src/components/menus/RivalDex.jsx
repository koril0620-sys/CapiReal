import { useGameStore } from '../../store/useGameStore'
import { RIVALS } from '../../constants/rivals'

export default function RivalDex() {
  const gameState = useGameStore(s => s)
  const setCurrentScreen = useGameStore(s => s.setCurrentScreen)

  const metRivals = gameState.metRivals || []
  const defeatedRivals = gameState.defeatedRivals || []
  const total = RIVALS.length

  const tierOrder = ['ENTRY', 'MID', 'SENIOR', 'CHAMPION', 'BOSS']
  const tierLabels = {
    ENTRY: '말단',
    MID: '하부',
    SENIOR: '중간',
    CHAMPION: '상위',
    BOSS: '보스',
  }
  const tierColors = {
    ENTRY: 'var(--cr2-gray)',
    MID: '#88FF88',
    SENIOR: 'var(--cr2-gold)',
    CHAMPION: 'var(--cr2-red)',
    BOSS: '#FF00FF',
  }

  const sortedRivals = [...RIVALS].sort((a, b) => {
    const ai = tierOrder.indexOf(a.tier)
    const bi = tierOrder.indexOf(b.tier)
    if (ai !== bi) return ai - bi
    const aMet = metRivals.includes(a.id) ? 0 : 1
    const bMet = metRivals.includes(b.id) ? 0 : 1
    return aMet - bMet
  })

  return (
    <div className="cr2-rivaldex-screen cr2-scrollable">
      <div className="cr2-rivaldex-header">
        <button className="cr2-btn" onClick={() => setCurrentScreen('main')}>← 뒤로</button>
        <div className="cr2-rivaldex-title">MONOPOL 도감</div>
      </div>

      <div className="cr2-rivaldex-progress">
        만남 {metRivals.length} / {total} · 격파 {defeatedRivals.length}
      </div>

      <div className="cr2-rivaldex-list">
        {sortedRivals.map(rival => {
          const isMet = metRivals.includes(rival.id)
          return (
            <div
              key={rival.id}
              className={`cr2-rivaldex-item ${isMet ? 'cr2-rivaldex-met' : 'cr2-rivaldex-unknown'}`}
            >
              <img
                src={rival.profileImage}
                alt={isMet ? rival.name : '???'}
                className="cr2-rivaldex-img"
                style={{ filter: isMet ? 'none' : 'grayscale(100%) brightness(0.2)' }}
              />
              <div className="cr2-rivaldex-info">
                <div
                  className="cr2-rivaldex-tier"
                  style={{ color: tierColors[rival.tier] }}
                >
                  [{tierLabels[rival.tier]}]
                </div>
                <div className="cr2-rivaldex-name">
                  {isMet ? rival.name : '???'}
                </div>
                <div className="cr2-rivaldex-company cr2-gray">
                  {isMet ? rival.company : '???'}
                </div>
                {defeatedRivals.includes(rival.id) && (
                  <div className="cr2-positive" style={{ fontSize: '8px' }}>✓ 파산시킴</div>
                )}
                {isMet && !defeatedRivals.includes(rival.id) && rival.dialogue?.appear && (
                  <div className="cr2-rivaldex-quote cr2-gray">
                    &quot;{rival.dialogue.appear}&quot;
                  </div>
                )}
                {defeatedRivals.includes(rival.id) && rival.dialogue?.bankrupt && (
                  <div className="cr2-rivaldex-quote cr2-gray">
                    &quot;{rival.dialogue.bankrupt}&quot;
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
