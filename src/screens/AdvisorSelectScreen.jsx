import { useState } from 'react'
import { useGameStore } from '../store/useGameStore'
import { ADVISORS } from '../constants/advisors'
import { playSFX } from '../logic/audioEngine'

export default function AdvisorSelectScreen() {
  const setCurrentScreen = useGameStore(state => state.setCurrentScreen)
  const setSelectedAdvisor = useGameStore(state => state.setSelectedAdvisor)
  const [selected, setSelected] = useState(ADVISORS[0]?.id || null)

  const handleSelect = (advisorId) => {
    playSFX('click')
    setSelected(advisorId)
  }

  const handleStart = () => {
    if (!selected) return
    setSelectedAdvisor(selected)
    const state = useGameStore.getState()
    if (state.playerId) {
      setCurrentScreen('slotSelect')
    } else {
      state.setCurrentSlot(1)
      state.resetGame(selected, state.playerProfile, 1)
      const tutorialEnabled = state.settings?.tutorial !== false
      setCurrentScreen(tutorialEnabled ? 'tutorialSlide' : 'main')
    }
  }

  const selectedAdvisor = ADVISORS.find(advisor => advisor.id === selected) || ADVISORS[0]

  return (
    <div className="cr2-advisor-screen">
      <div style={{
        position: 'absolute',
        top: '12px',
        left: '12px',
        zIndex: 10,
      }}>
        <button
          className="cr2-btn"
          onClick={() => setCurrentScreen('characterCreate')}
          style={{
            fontSize: '9px',
            padding: '6px 12px',
            border: '1px solid var(--cr2-green)',
            color: 'var(--cr2-green)',
            background: 'transparent',
          }}
        >
          ← 이전으로
        </button>
      </div>

      <div className="cr2-advisor-header">
        <div className="cr2-advisor-kicker">ADVISOR SELECT</div>
        <div className="cr2-advisor-title">당신의 어드바이저를 선택하세요</div>
      </div>

      <div className="cr2-advisor-layout">
        <div className="cr2-advisor-grid">
          {ADVISORS.map(advisor => {
            const isSelected = selected === advisor.id

            return (
              <button
                key={advisor.id}
                className={`cr2-advisor-card ${isSelected ? 'cr2-selected' : ''}`}
                style={{ '--advisor-color': getAdvisorColor(advisor.id) }}
                onClick={() => handleSelect(advisor.id)}
              >
                <div className="cr2-advisor-card-image-wrap">
                  <img
                    src={advisor.profileImage}
                    alt={advisor.name}
                    className="cr2-advisor-img"
                  />
                </div>
                <div className="cr2-advisor-card-body">
                  <div className="cr2-advisor-card-topline">
                    <span className="cr2-advisor-name">{advisor.name}</span>
                    {isSelected && <span className="cr2-advisor-selected-mark">선택</span>}
                  </div>
                  <div className="cr2-advisor-style">{advisor.style}</div>
                  <div className="cr2-advisor-passive">{advisor.passive}</div>
                </div>
              </button>
            )
          })}
        </div>

        <div className="cr2-advisor-detail" style={{ '--advisor-color': getAdvisorColor(selectedAdvisor.id) }}>
          <div className="cr2-advisor-detail-portrait">
            <img
              src={selectedAdvisor.profileImageV2 || selectedAdvisor.profileImage}
              alt={selectedAdvisor.name}
            />
          </div>

          <div className="cr2-advisor-detail-main">
            <div
              className="cr2-advisor-detail-name"
              style={{ color: getAdvisorColor(selectedAdvisor.id) }}
            >
              {selectedAdvisor.name} {selectedAdvisor.style}
            </div>
            <div className="cr2-advisor-detail-style">{selectedAdvisor.style}</div>
            <div className="cr2-advisor-detail-desc">{selectedAdvisor.description}</div>
          </div>

          <div className="cr2-advisor-detail-columns">
            <div className="cr2-advisor-detail-block">
              <div className="cr2-advisor-detail-section cr2-buff">패시브</div>
              {selectedAdvisor.buffs.map(buff => (
                <div key={buff} className="cr2-advisor-detail-buff">+ {buff}</div>
              ))}
            </div>

            <div className="cr2-advisor-detail-block">
              <div className="cr2-advisor-detail-section cr2-nerf">너프</div>
              {selectedAdvisor.nerfs.map(nerf => (
                <div key={nerf} className="cr2-advisor-detail-nerf">- {nerf}</div>
              ))}
            </div>
          </div>

          <div className="cr2-advisor-difficulty">
            <span>난이도</span>
            <span>{'★'.repeat(selectedAdvisor.difficulty)}{'☆'.repeat(5 - selectedAdvisor.difficulty)}</span>
          </div>

          <button
            className="cr2-btn cr2-advisor-confirm-btn"
            onClick={handleStart}
          >
            이 어드바이저로 시작
          </button>
        </div>
      </div>
    </div>
  )
}

function getAdvisorColor(id) {
  const colors = {
    raider: '#DC143C',
    guardian: '#00AA00',
    analyst: '#4488FF',
    gambler: '#FFD700',
  }
  return colors[id] || '#00FF41'
}
