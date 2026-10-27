import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../store/useGameStore'
import { saveRecord } from '../logic/saveEngine'
import { getCurrentStage } from '../constants/monopol'
import { RIVALS } from '../constants/rivals'
import { getGrade } from '../logic/creditEngine'
import { playBGM, playSFX } from '../logic/audioEngine'
import { generateEndingAnalysis } from '../logic/aiAdvisorEngine'
import { bumpGameOverCount, recheckAchievements } from '../logic/turnFlow'
import '../styles/gameOver.css'

export default function GameOverScreen() {
  const gameState = useGameStore(state => state)
  const setCurrentScreen = useGameStore(state => state.setCurrentScreen)
  const resetGame = useGameStore(state => state.resetGame)
  const [page, setPage] = useState(1)
  const [saved, setSaved] = useState(false)
  const [endingAnalysis, setEndingAnalysis] = useState(null)
  const [analysisLoading, setAnalysisLoading] = useState(true)
  const analysisRequestedRef = useRef(false)

  useEffect(() => {
    playBGM('recession')
  }, [])

  const metaCountedRef = useRef(false)
  useEffect(() => {
    if (metaCountedRef.current) return
    metaCountedRef.current = true
    // 판을 넘어 남는 게임오버 횟수 ('오기' 업적용)
    const count = bumpGameOverCount()
    useGameStore.setState(state => ({
      isGameOver: true,
      stats: { ...(state.stats || {}), gameOverCount: count },
    }))
    void recheckAchievements()
  }, [])

  useEffect(() => {
    if (analysisRequestedRef.current) return
    analysisRequestedRef.current = true
    const currentState = useGameStore.getState()
    currentState.clearAiMessages()
    generateEndingAnalysis(currentState, 'GAMEOVER').then(result => {
      setEndingAnalysis(result)
      setAnalysisLoading(false)
    })
  }, [])

  const stage = getCurrentStage(gameState.floor)
  const currentRival = stage ? RIVALS.find(rival => rival.id === stage.rival) : null

  const getGameOverReason = () => {
    if (gameState.health <= 0) return '경영 체력이 소진됐다.'
    if (gameState.bankruptcyTurns >= 4) return '자본이 4턴 연속 음수였다.'
    return 'MONOPOL의 압박을 버티지 못했다.'
  }

  const handleSaveRecord = async () => {
    if (saved || !gameState.playerId) return

    await saveRecord(gameState.playerId, {
      result_type: 'BANKRUPT',
      clear_grade: null,
      advisor_id: gameState.selectedAdvisor,
      final_capital: gameState.capital,
      clear_floor: gameState.floor,
      playtime: Math.round(gameState.stats.playSeconds || 0),
      profit_turns: gameState.stats.profitTurns,
      loss_turns: gameState.stats.lossTurns,
      max_share: gameState.stats.maxShare,
      bankruptcy_count: gameState.stats.bankruptcyCount,
      external_events: gameState.stats.externalEventCount,
      event_success_rate: gameState.stats.eventTotalCount > 0
        ? gameState.stats.eventSuccessCount / gameState.stats.eventTotalCount
        : 0,
      rival_dominated: gameState.stats.rivalDominated,
    })
    setSaved(true)
  }

  const handleRetry = () => {
    playSFX('click')
    resetGame()
    setCurrentScreen('characterCreate')
  }

  const handleTitle = () => {
    playSFX('click')
    setCurrentScreen('title')
  }

  return (
    <div className="cr2-gameover-screen">
      <div className="cr2-page-indicator">
        {[1, 2, 3].map(item => (
          <span key={item} className={item === page ? 'cr2-dot-active' : 'cr2-dot'}>●</span>
        ))}
      </div>

      {page === 1 && (
        <div className="cr2-gameover-page">
          <div className="cr2-gameover-title cr2-negative">💀 MONOPOL에 무너졌다</div>

          {stage && (
            <div className="cr2-gameover-rival">
              <img
                src={currentRival?.profileImage || '/assets/logo_image-f7z3e97D.png'}
                alt={stage.rivalName}
                className="cr2-gameover-rival-img"
              />
              <div className="cr2-gameover-rival-dialogue cr2-negative">
                &quot;시장은 우리 것이야.&quot;
              </div>
            </div>
          )}

          <div className="cr2-gameover-floor">Floor {gameState.floor}에서 파산</div>
          <div className="cr2-gameover-reason">{getGameOverReason()}</div>

          <div className="cr2-gameover-stats">
            <div>마지막 자본: <span className="cr2-negative">{(gameState.capital / 10000).toFixed(0)}만원</span></div>
            <div>최종 체력: {gameState.health} / {gameState.maxHealth}</div>
            <div>최종 신용등급: {getGrade(gameState.creditScore)} ({gameState.creditScore}점)</div>
          </div>
        </div>
      )}

      {page === 2 && (
        <div className="cr2-gameover-page cr2-scrollable">
          <div className="cr2-gameover-page-title">📋 결정 복기</div>

          <div className="cr2-gameover-review">
            <div className="cr2-review-title">최근 5턴 요약</div>
            {(gameState.playerShareHistory || []).slice(-5).map((share, index) => (
              <div key={`review-${index}`} className="cr2-review-row">
                <span>Floor {gameState.floor - 4 + index}</span>
                <span>점유율 {(share * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>

          <div className="cr2-gameover-advice">
            <div>💡 다음 플레이 팁</div>
            <div className="cr2-gray">부채가 자본의 70%를 넘으면 이자 부담이 급격히 커집니다.</div>
            <div className="cr2-gray">MONOPOL 라이벌의 특수 능력에 대응하는 전략을 미리 준비하세요.</div>
          </div>

          {analysisLoading ? (
            <div style={{ color: 'var(--cr2-gray)', fontSize: '9px' }}>
              AI 분석 중...
            </div>
          ) : endingAnalysis ? (
            <div style={{
              padding: '12px',
              background: 'rgba(0,255,65,0.05)',
              border: '1px solid rgba(0,255,65,0.3)',
              fontSize: '10px',
              color: 'var(--cr2-white)',
              lineHeight: '1.8',
              fontFamily: "'Noto Sans KR', sans-serif",
            }}>
              <div style={{ color: 'var(--cr2-lime)', fontSize: '9px', marginBottom: '6px' }}>
                ✨ AI 경영 분석
              </div>
              {endingAnalysis}
            </div>
          ) : null}
        </div>
      )}

      {page === 3 && (
        <div className="cr2-gameover-page cr2-scrollable">
          <div className="cr2-gameover-page-title">📊 최종 통계</div>

          <div className="cr2-gameover-full-stats">
            <div className="cr2-stat-row"><span>플레이타임</span><span>{formatTime(Math.round(gameState.stats.playSeconds || 0))}</span></div>
            <div className="cr2-stat-row"><span>도달 층수</span><span>{gameState.floor}층</span></div>
            <div className="cr2-stat-row"><span>어드바이저</span><span>{getAdvisorName(gameState.selectedAdvisor)}</span></div>
            <div className="cr2-stat-row"><span>최종 자본</span><span className="cr2-negative">{(gameState.capital / 10000).toFixed(0)}만원</span></div>
            <div className="cr2-stat-row"><span>총 흑자 턴</span><span className="cr2-positive">{gameState.stats.profitTurns}턴</span></div>
            <div className="cr2-stat-row"><span>총 적자 턴</span><span className="cr2-negative">{gameState.stats.lossTurns}턴</span></div>
            <div className="cr2-stat-row"><span>최고 점유율</span><span>{(gameState.stats.maxShare * 100).toFixed(1)}%</span></div>
            <div className="cr2-stat-row"><span>파산 위기</span><span>{gameState.stats.bankruptcyCount}회</span></div>
            <div className="cr2-stat-row"><span>외부 이벤트</span><span>{gameState.stats.externalEventCount}개</span></div>
            <div className="cr2-stat-row">
              <span>이벤트 성공률</span>
              <span>
                {gameState.stats.eventTotalCount > 0
                  ? Math.round((gameState.stats.eventSuccessCount / gameState.stats.eventTotalCount) * 100)
                  : 0}%
              </span>
            </div>
          </div>

          <div className="cr2-gameover-btns">
            {!saved && gameState.playerId && (
              <button className="cr2-btn" onClick={handleSaveRecord}>기록 저장</button>
            )}
            {saved && <div className="cr2-positive">저장 완료</div>}
            <button className="cr2-btn" onClick={handleRetry}>재도전</button>
            <button className="cr2-btn cr2-btn-ghost" onClick={handleTitle}>타이틀로</button>
          </div>
        </div>
      )}

      <div className="cr2-page-nav">
        <button
          className="cr2-btn cr2-btn-ghost"
          onClick={() => setPage(current => Math.max(current - 1, 1))}
          disabled={page === 1}
        >
          ◀ 이전
        </button>
        <button
          className="cr2-btn cr2-btn-ghost"
          onClick={() => setPage(current => Math.min(current + 1, 3))}
          disabled={page === 3}
        >
          다음 ▶
        </button>
      </div>
    </div>
  )
}

function formatTime(seconds) {
  if (!seconds) return '00:00'
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

function getAdvisorName(id) {
  const map = { raider: 'The Raider', guardian: 'The Guardian', analyst: 'The Analyst', gambler: 'The Gambler' }
  return map[id] || id
}
