import { useEffect } from 'react'
import { useGameStore } from '../store/useGameStore'
import { isBossRoundWon, BOSS_MAX_TURNS } from '../logic/monopolEngine'
import { playBGM, playSFX } from '../logic/audioEngine'
import '../styles/boss.css'

export default function BossScreen() {
  const gameState = useGameStore(s => s)
  const setCurrentScreen = useGameStore(s => s.setCurrentScreen)
  const bossCounterActive = useGameStore(s => s.bossCounterActive)
  const bossShareHistory = useGameStore(s => s.bossShareHistory)

  useEffect(() => {
    playBGM('boss')
    playSFX('boss')
  }, [])

  const bossTurn = gameState.bossTurn || 0
  const recent = (bossShareHistory || []).slice(-3)
  // 연속 압도 횟수 (마지막부터 끊기지 않은 것만)
  let streak = 0
  for (let i = recent.length - 1; i >= 0; i -= 1) {
    if (!isBossRoundWon(recent[i])) break
    streak += 1
  }
  const clearProgress = [0, 1, 2].map(index => index < streak)
  const lastRound = (bossShareHistory || []).at(-1)

  return (
    <div className="cr2-boss-screen">
      <div className="cr2-boss-intro">
        <div className="cr2-boss-title">FINAL BATTLE</div>

        <div className="cr2-boss-profile">
          <img
            src="/assets/rival_champion_hyegyeong-Cuy8B_O2.png"
            alt="혜경"
            className="cr2-boss-img"
          />
          <div className="cr2-boss-name">혜경</div>
          <div className="cr2-boss-company">HK International</div>
          <div className="cr2-boss-dialogue">
            &quot;시장은 내가 만든다.<br />
            네가 아무리 피해도 내가 흔들면 끝이다.&quot;
          </div>
        </div>

        <div className="cr2-boss-condition">
          <div className="cr2-boss-condition-title">클리어 조건 · 라운드 {Math.min(bossTurn + 1, BOSS_MAX_TURNS)}/{BOSS_MAX_TURNS}</div>
          <div>3턴 연속: 혜경 점유율 50% 미만 + 내 점유율이 혜경보다 높게</div>
          <div className="cr2-gray" style={{ fontSize: '9px', marginTop: '4px' }}>
            {BOSS_MAX_TURNS}라운드 안에 못 꺾으면 MONOPOL은 남은 채로 10년이 끝난다.
          </div>
          {lastRound && typeof lastRound === 'object' && (
            <div className={lastRound.won ? 'cr2-positive' : 'cr2-negative'} style={{ fontSize: '9px', marginTop: '4px' }}>
              지난 라운드: 혜경 {Math.round(lastRound.bossShare * 100)}% vs 나 {Math.round(lastRound.playerShare * 100)}%
            </div>
          )}
        </div>

        <div className="cr2-boss-progress">
          {clearProgress.map((done, index) => (
            <div
              key={`boss-progress-${index}`}
              className={`cr2-boss-progress-dot ${done ? 'cr2-boss-dot-done' : ''}`}
            >
              {done ? '✓' : '·'}
            </div>
          ))}
        </div>

        <div className="cr2-boss-hint">
          현재 Floor {gameState.floor}. 같은 전략을 2턴 연속 쓰면 혜경이 카운터한다.
        </div>

        <button
          className="cr2-btn cr2-boss-start-btn"
          onClick={() => setCurrentScreen('main')}
        >
          전략 선택으로 이동
        </button>
      </div>

      {bossCounterActive && (
        <div className="cr2-boss-counter-warning cr2-negative cr2-blink">
          혜경이 반복 전략을 읽었다. 패턴을 바꿔야 한다.
        </div>
      )}
    </div>
  )
}
