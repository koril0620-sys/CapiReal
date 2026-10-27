import { useEffect, useState } from 'react'
import { useGameStore } from '../store/useGameStore'
import { ACHIEVEMENTS } from '../constants/achievements'
import { playSFX } from '../logic/audioEngine'
import '../styles/achievementToast.css'

export default function AchievementToast() {
  const newAchievements = useGameStore(state => state.newAchievements)
  const setNewAchievements = useGameStore(state => state.setNewAchievements)
  const [queue, setQueue] = useState([])
  const [current, setCurrent] = useState(null)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (newAchievements.length === 0) return

    const items = newAchievements
      .map(id => ACHIEVEMENTS.find(achievement => achievement.id === id))
      .filter(Boolean)
    const timer = setTimeout(() => {
      setQueue(prev => [...prev, ...items])
    }, 0)
    setNewAchievements([])

    return () => clearTimeout(timer)
  }, [newAchievements, setNewAchievements])

  useEffect(() => {
    if (current || queue.length === 0) return undefined

    const startTimer = setTimeout(() => {
      setCurrent(queue[0])
      setQueue(prev => prev.slice(1))
      setLeaving(false)
      playSFX('profit')
    }, 0)

    const leaveTimer = setTimeout(() => setLeaving(true), 2700)
    const clearTimer = setTimeout(() => setCurrent(null), 3000)

    return () => {
      clearTimeout(startTimer)
      clearTimeout(leaveTimer)
      clearTimeout(clearTimer)
    }
  }, [queue, current])

  if (!current) return null

  const gradeColors = { BRONZE: '#CD7F32', SILVER: '#C0C0C0', GOLD: '#FFD700' }
  const gradeColor = gradeColors[current.grade] || 'var(--cr2-lime)'

  return (
    <div className={`cr2-toast ${leaving ? 'cr2-toast-leaving' : ''}`}>
      <div className="cr2-toast-header">🏆 업적 달성!</div>
      <div className="cr2-toast-body">
        <img
          src={current.icon}
          alt={current.name}
          className="cr2-toast-icon"
        />
        <div className="cr2-toast-info">
          <div className="cr2-toast-name" style={{ color: gradeColor }}>
            {current.name}
            {current.grade && (
              <span className="cr2-toast-grade"> {current.grade}</span>
            )}
          </div>
          <div className="cr2-toast-desc">{current.description}</div>
        </div>
      </div>
    </div>
  )
}
