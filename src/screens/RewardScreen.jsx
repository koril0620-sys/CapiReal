import { useEffect, useState } from 'react'
import { useGameStore } from '../store/useGameStore'
import { getRewardGrade, getRewardOptions, applyReward } from '../logic/rewardEngine'
import { playBGM, playSFX } from '../logic/audioEngine'
import { bumpStat, recheckAchievements } from '../logic/turnFlow'

export default function RewardScreen() {
  const gameState = useGameStore(state => state)
  const setCurrentScreen = useGameStore(state => state.setCurrentScreen)
  const [grade] = useState(() => getRewardGrade(gameState.momentum, gameState.momentumHistory))
  const [selected, setSelected] = useState(null)
  const options = getRewardOptions(grade, gameState)

  useEffect(() => {
    playBGM('strategy')
  }, [])

  const gradeColors = {
    NORMAL: 'var(--cr2-green)',
    RARE: 'var(--cr2-lime)',
    EPIC: '#8B5CF6',
    LEGEND: 'var(--cr2-gold)',
  }

  const gradeLabels = {
    NORMAL: 'NORMAL',
    RARE: 'RARE',
    EPIC: 'EPIC',
    LEGEND: 'LEGEND ✨',
  }

  const handleSelect = (option) => {
    playSFX('click')
    setSelected(option.id)
  }

  const handleConfirm = () => {
    if (!selected) return

    const option = options.find(item => item.id === selected)
    if (!option) return

    const newState = applyReward(option.effect, gameState)
    useGameStore.setState(newState)
    if (grade === 'LEGEND') {
      bumpStat('legendRewards')
      void recheckAchievements()
    }
    playSFX('profit')
    setCurrentScreen('main')
  }

  return (
    <div className="cr2-reward-screen">
      <div className="cr2-reward-grade" style={{ color: gradeColors[grade] }}>
        {gradeLabels[grade]}
      </div>
      <div className="cr2-reward-title">이번 달 보상을 선택하세요</div>

      <div className="cr2-reward-options">
        {options.map(option => (
          <div
            key={option.id}
            className={`cr2-reward-option ${selected === option.id ? 'cr2-selected' : ''}`}
            style={{
              borderColor: selected === option.id ? gradeColors[grade] : 'var(--cr2-green)',
            }}
            onClick={() => handleSelect(option)}
          >
            <div className="cr2-reward-option-label">{option.label}</div>
            <div className="cr2-reward-option-desc">{option.description}</div>
          </div>
        ))}
      </div>

      <button
        className="cr2-btn cr2-reward-confirm-btn"
        onClick={handleConfirm}
        disabled={!selected}
      >
        선택 확정
      </button>
    </div>
  )
}
