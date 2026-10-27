import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../store/useGameStore'
import { saveRecord } from '../logic/saveEngine'
import { getClearGrade } from '../logic/rewardEngine'
import { getGrade } from '../logic/creditEngine'
import { playBGM, playSFX } from '../logic/audioEngine'
import { generateEndingAnalysis } from '../logic/aiAdvisorEngine'
import { markGameClear, recheckAchievements } from '../logic/turnFlow'
import { ADVISORS } from '../constants/advisors'
import { RIVALS } from '../constants/rivals'
import '../styles/ending.css'

const ENDING_DATA = {
  full_conquest: {
    image: '/assets/ending_full_conquest.png',
    title: '완전 정복',
    subtitle: 'MONOPOL은 무너졌다. 시장은 이제 네 것이다.',
    color: 'var(--cr2-lime)',
  },
  market_victory: {
    image: '/assets/ending_market_victory.png',
    title: '시장 탈환',
    subtitle: '10년의 싸움 끝에 독립 사업자로 살아남았다.',
    color: '#FFD700',
  },
  barely_made_it: {
    image: '/assets/ending_barely_made_it.png',
    title: '간신히 버팀',
    subtitle: '무너질 뻔했지만, 끝까지 포기하지 않았다.',
    color: 'orange',
  },
  survival: {
    image: '/assets/ending_survival.png',
    title: '사투 끝 생존',
    subtitle: '모든 것을 잃을 뻔했다. 그래도 살아남았다.',
    color: 'var(--cr2-red)',
  },
}

export default function EndingScreen() {
  const gameState = useGameStore(state => state)
  const setCurrentScreen = useGameStore(state => state.setCurrentScreen)
  const resetGame = useGameStore(state => state.resetGame)
  const [page, setPage] = useState(1)
  const [saved, setSaved] = useState(false)
  const [endingAnalysis, setEndingAnalysis] = useState(null)
  const [analysisLoading, setAnalysisLoading] = useState(true)
  const analysisRequestedRef = useRef(false)

  useEffect(() => {
    playBGM('boom')
  }, [])

  const clearCheckedRef = useRef(false)
  useEffect(() => {
    if (clearCheckedRef.current) return
    clearCheckedRef.current = true
    if (!useGameStore.getState().isClear) markGameClear()
    void recheckAchievements()
  }, [])

  useEffect(() => {
    if (analysisRequestedRef.current) return
    analysisRequestedRef.current = true
    const currentState = useGameStore.getState()
    currentState.clearAiMessages()
    generateEndingAnalysis(currentState, 'CLEAR').then(result => {
      setEndingAnalysis(result)
      setAnalysisLoading(false)
    })
  }, [])

  const grade = gameState.clearGrade || getClearGrade(gameState)
  const gradeColors = { S: '#FFD700', A: '#00FF41', B: '#00AA00', C: '#DC143C' }
  const gradeColor = gradeColors[grade] || '#00FF41'
  const advisor = ADVISORS.find(item => item.id === gameState.selectedAdvisor)
  const endingType = getEndingType(gameState)
  const ending = ENDING_DATA[endingType]

  const endingMessages = gameState.bossDefeated
    ? {
      S: 'MONOPOL을 완전히 무너뜨렸다. 시장은 이제 자유롭다.',
      A: 'MONOPOL의 수장을 꺾었다. 독점의 시대가 끝났다.',
      B: '혜경을 물리쳤다. 하지만 MONOPOL의 잔당은 아직 남아있다.',
      C: '혜경을 꺾었지만 회사는 만신창이다.',
    }
    : {
      S: '10년을 버텼다. 혜경은 아직 건재하지만, 다음 판에선 무너뜨릴 수 있다.',
      A: '10년을 버텼다. MONOPOL은 남았지만 네 회사도 남았다.',
      B: '살아남았다. MONOPOL의 그늘은 여전하다.',
      C: '겨우 살아남았다. MONOPOL은 언제든 다시 흔들 것이다.',
    }

  const handleSaveRecord = async () => {
    if (saved || !gameState.playerId) return

    await saveRecord(gameState.playerId, {
      result_type: 'CLEAR',
      clear_grade: grade,
      advisor_id: gameState.selectedAdvisor,
      final_capital: gameState.capital,
      clear_floor: 120,
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
      monopol_clears: gameState.metRivals || [],
    })
    setSaved(true)
  }

  return (
    <div className="cr2-ending-screen">
      <div className="cr2-page-indicator">
        {[1, 2, 3].map(item => (
          <span key={item} className={item === page ? 'cr2-dot-active' : 'cr2-dot'}>●</span>
        ))}
      </div>

      {page === 1 && (
        <div
          className="cr2-ending-page cr2-ending-intro"
          style={{ position: 'relative', overflow: 'hidden' }}
        >
          <img
            src={ending.image}
            alt={ending.title}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              position: 'absolute',
              top: 0,
              left: 0,
              zIndex: 0,
              opacity: 0.85,
            }}
            onError={event => { event.target.src = '/assets/logo_image-f7z3e97D.png' }}
          />

          <div style={{
            position: 'relative',
            zIndex: 1,
            textAlign: 'center',
            padding: '20px',
          }}>
            <div style={{
              fontSize: '28px',
              fontWeight: 'bold',
              color: ending.color,
              textShadow: `0 0 20px ${ending.color}`,
              marginBottom: '12px',
              letterSpacing: '4px',
            }}>
              {ending.title}
            </div>
            <div style={{
              fontSize: '13px',
              color: 'var(--cr2-white)',
              opacity: 0.9,
              letterSpacing: '1px',
            }}>
              {ending.subtitle}
            </div>
          </div>

          <div className="cr2-ending-grade" style={{ color: gradeColor, position: 'relative', zIndex: 1 }}>
            {grade} 등급 클리어!
          </div>

          <div className="cr2-ending-message" style={{ position: 'relative', zIndex: 1 }}>
            {endingMessages[grade]}
          </div>

          <div className="cr2-ending-advisor" style={{ position: 'relative', zIndex: 1 }}>
            <img
              src={advisor?.profileImage || '/assets/logo_image-f7z3e97D.png'}
              alt="어드바이저"
              className="cr2-ending-advisor-img"
              onError={event => { event.target.src = '/assets/logo_image-f7z3e97D.png' }}
            />
            <div>{getAdvisorName(gameState.selectedAdvisor)}와 함께</div>
          </div>

          <div className="cr2-ending-final-stats" style={{ position: 'relative', zIndex: 1 }}>
            <div>최종 자본: <span style={{ color: gradeColor }}>{(gameState.capital / 10000).toFixed(0)}만원</span></div>
            <div>신용등급: {getGrade(gameState.creditScore)}</div>
          </div>
        </div>
      )}

      {page === 2 && (
        <div className="cr2-ending-page cr2-scrollable">
          <div className="cr2-ending-page-title">📊 클리어 통계</div>

          <div className="cr2-ending-stats">
            <div className="cr2-stat-row"><span>플레이타임</span><span>{formatTime(Math.round(gameState.stats.playSeconds || 0))}</span></div>
            <div className="cr2-stat-row"><span>어드바이저</span><span>{getAdvisorName(gameState.selectedAdvisor)}</span></div>
            <div className="cr2-stat-row"><span>최종 자본</span><span style={{ color: gradeColor }}>{(gameState.capital / 10000).toFixed(0)}만원</span></div>
            <div className="cr2-stat-row"><span>최종 신용등급</span><span>{getGrade(gameState.creditScore)} ({gameState.creditScore}점)</span></div>
            <div className="cr2-stat-row"><span>최종 체력</span><span>{gameState.health} / {gameState.maxHealth}</span></div>
            <div className="cr2-stat-row"><span>총 흑자 턴</span><span className="cr2-positive">{gameState.stats.profitTurns}턴</span></div>
            <div className="cr2-stat-row"><span>총 적자 턴</span><span className="cr2-negative">{gameState.stats.lossTurns}턴</span></div>
            <div className="cr2-stat-row"><span>최고 점유율</span><span>{(gameState.stats.maxShare * 100).toFixed(1)}%</span></div>
            <div className="cr2-stat-row"><span>파산 위기</span><span>{gameState.stats.bankruptcyCount}회</span></div>
            <div className="cr2-stat-row"><span>MONOPOL 격파</span><span>{gameState.metRivals?.length || 0}명</span></div>
          </div>

          <div className="cr2-ending-rivals">
            <div className="cr2-ending-rivals-title">격파한 MONOPOL</div>
            <div className="cr2-ending-rivals-list">
              {(gameState.metRivals || []).map(rivalId => (
                <img
                  key={rivalId}
                  src={RIVALS.find(rival => rival.id === rivalId)?.profileImage || '/assets/logo_image-f7z3e97D.png'}
                  alt={rivalId}
                  className="cr2-ending-rival-sprite"
                  onError={event => { event.target.src = '/assets/logo_image-f7z3e97D.png' }}
                />
              ))}
            </div>
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
        <div className="cr2-ending-page">
          <div className="cr2-ending-page-title">💾 기록 저장</div>

          {!saved ? (
            <>
              <div className="cr2-ending-save-desc">이 클리어 기록을 저장하시겠습니까?</div>
              <button className="cr2-btn cr2-ending-save-btn" onClick={handleSaveRecord}>
                저장하기
              </button>
            </>
          ) : (
            <div className="cr2-positive">플레이 기록에 저장됐습니다.</div>
          )}

          <div className="cr2-ending-final-btns">
            <button
              className="cr2-btn"
              onClick={() => {
                playSFX('click')
                resetGame()
                setCurrentScreen('characterCreate')
              }}
            >
              새 게임
            </button>
            <button
              className="cr2-btn cr2-btn-ghost"
              onClick={() => {
                playSFX('click')
                setCurrentScreen('title')
              }}
            >
              타이틀로
            </button>
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

function getEndingType(gameState) {
  const capital = gameState.capital || 0
  const health = gameState.health || 0

  // 혜경을 꺾었는지가 엔딩을 가른다
  if (gameState.bossDefeated) {
    return capital >= 100000000 ? 'full_conquest' : 'market_victory'
  }
  if (health <= 3 || capital < 0) return 'survival'
  return 'barely_made_it'
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
