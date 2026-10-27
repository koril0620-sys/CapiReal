import { useState } from 'react'
import { useGameStore } from '../store/useGameStore'
import { ACHIEVEMENTS } from '../constants/achievements'
import { getEducationProgress } from '../logic/achievementEngine'

export default function AchievementScreen() {
  const gameState = useGameStore(state => state)
  const setCurrentScreen = useGameStore(state => state.setCurrentScreen)
  const [tab, setTab] = useState('all')

  const unlocked = gameState.unlockedAchievements || []
  const filtered = tab === 'all'
    ? ACHIEVEMENTS
    : ACHIEVEMENTS.filter(achievement => achievement.category === (tab === 'economy' ? 'ECONOMY' : 'GAME'))

  const progress = getEducationProgress(unlocked)
  const gradeColors = { BRONZE: '#CD7F32', SILVER: '#C0C0C0', GOLD: '#FFD700' }

  return (
    <div className="cr2-achievement-screen cr2-scrollable">
      <div className="cr2-achievement-header">
        <div className="cr2-achievement-title">업적</div>
        <button className="cr2-btn cr2-back-btn" onClick={() => setCurrentScreen('main')}>←</button>
      </div>

      <div className="cr2-achievement-progress">
        <div>경제 교육: {progress.unlocked} / {progress.total} ({progress.percentage}%)</div>
        <div className="cr2-progress-bar-track">
          <div
            className="cr2-progress-bar"
            style={{ width: `${progress.percentage}%` }}
          />
        </div>
        <div>게임: {unlocked.filter(id => ACHIEVEMENTS.find(achievement => achievement.id === id && achievement.category === 'GAME')).length} / 15</div>
      </div>

      <div className="cr2-achievement-tabs">
        {['all', 'economy', 'game'].map(item => (
          <button
            key={item}
            className={`cr2-tab ${tab === item ? 'cr2-tab-active' : ''}`}
            onClick={() => setTab(item)}
          >
            {item === 'all' ? '전체' : item === 'economy' ? '경제교육' : '게임'}
          </button>
        ))}
      </div>

      <div className="cr2-achievement-list">
        {filtered.map(achievement => {
          const isDone = unlocked.includes(achievement.id)

          return (
            <div
              key={achievement.id}
              className={`cr2-achievement-item ${isDone ? 'cr2-achievement-done' : 'cr2-achievement-locked'}`}
            >
              <img
                src={achievement.icon}
                alt={achievement.name}
                className="cr2-achievement-icon"
                style={{ filter: isDone ? 'none' : 'grayscale(100%) brightness(0.3)' }}
              />
              <div className="cr2-achievement-info">
                <div
                  className="cr2-achievement-name"
                  style={{ color: isDone ? (gradeColors[achievement.grade] || 'var(--cr2-lime)') : 'var(--cr2-gray)' }}
                >
                  {achievement.name}
                  {achievement.grade && (
                    <span style={{ color: gradeColors[achievement.grade], marginLeft: 4 }}>
                      {achievement.grade === 'BRONZE' ? '🥉' : achievement.grade === 'SILVER' ? '🥈' : '🥇'}
                    </span>
                  )}
                </div>
                {isDone ? (
                  <div className="cr2-achievement-desc">{achievement.description}</div>
                ) : (
                  <div className="cr2-achievement-desc cr2-gray">???</div>
                )}
                {achievement.educationLink && (
                  <div className="cr2-achievement-edu cr2-gold">{achievement.educationLink}</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
