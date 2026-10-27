import { useState, useEffect } from 'react'
import { useGameStore } from '../store/useGameStore'
import { loadSaveSlot, loadSaveSlots } from '../logic/saveEngine'
import { playSFX } from '../logic/audioEngine'

export default function SlotSelectScreen() {
  const setCurrentScreen = useGameStore(state => state.setCurrentScreen)
  const setCurrentSlot = useGameStore(state => state.setCurrentSlot)
  const resetGame = useGameStore(state => state.resetGame)
  const playerId = useGameStore(state => state.playerId)
  const playerProfile = useGameStore(state => state.playerProfile)
  const selectedAdvisor = useGameStore(state => state.selectedAdvisor)
  const [slots, setSlots] = useState([])
  const [confirmSlot, setConfirmSlot] = useState(null)
  const [loading, setLoading] = useState(Boolean(playerId))

  useEffect(() => {
    const previousScreen = useGameStore.getState().previousScreen
    if (previousScreen === 'title') return
    if (!selectedAdvisor) {
      setCurrentScreen('advisorSelect')
      return
    }
    if (!playerProfile) setCurrentScreen('characterCreate')
  }, [playerId, playerProfile, selectedAdvisor, setCurrentScreen])

  useEffect(() => {
    if (!playerId) return undefined

    let ignore = false

    loadSaveSlots(playerId).then(data => {
      if (!ignore) {
        setSlots(data)
        setLoading(false)
      }
    })

    return () => {
      ignore = true
    }
  }, [playerId])

  const getSlotData = slotNumber =>
    slots.find(slot => slot.slot_number === slotNumber)

  const startNewGame = (slotNumber) => {
    const state = useGameStore.getState()
    if (!state.selectedAdvisor) {
      setCurrentScreen('advisorSelect')
      return
    }
    if (!state.playerProfile) {
      setCurrentScreen('characterCreate')
      return
    }
    setCurrentSlot(slotNumber)
    resetGame(state.selectedAdvisor, state.playerProfile, slotNumber)
    setCurrentScreen(state.settings?.tutorial !== false ? 'tutorialSlide' : 'main')
  }

  const handleSlotClick = (slotNumber) => {
    playSFX('click')
    const slotData = getSlotData(slotNumber)
    if (slotData) {
      setConfirmSlot(slotNumber)
    } else {
      startNewGame(slotNumber)
    }
  }

  const handleContinue = async (slotNumber) => {
    if (!playerId) return

    const savedState = await loadSaveSlot(playerId, slotNumber)
    if (!savedState) return

    const pureState = { ...savedState }
    delete pureState.setCurrentScreen
    delete pureState.setIsPaused
    delete pureState.resetGame

    useGameStore.setState({
      ...pureState,
      currentSlot: slotNumber,
      isPaused: false,
    })
    setConfirmSlot(null)
    setCurrentScreen('main')
  }

  const handleConfirmOverwrite = () => {
    if (!confirmSlot) return
    startNewGame(confirmSlot)
    setConfirmSlot(null)
  }

  if (loading) {
    return (
      <div className="cr2-slot-screen">
        <div className="cr2-loading">불러오는 중...</div>
      </div>
    )
  }

  return (
    <div className="cr2-slot-screen">
      <div className="cr2-slot-title">저장 슬롯을 선택하세요</div>

      <div className="cr2-slot-list">
        {[1, 2, 3, 4, 5].map(slotNumber => {
          const slotData = getSlotData(slotNumber)
          const gameState = slotData?.game_state || slotData?.game_state_json
          const savedAt = slotData?.saved_at || slotData?.updated_at

          return (
            <div
              key={slotNumber}
              className={`cr2-slot-item ${slotData ? 'cr2-slot-saved' : 'cr2-slot-empty'}`}
              onClick={() => handleSlotClick(slotNumber)}
            >
              <div className="cr2-slot-number">슬롯 {slotNumber}</div>
              {slotData ? (
                <div className="cr2-slot-info">
                  <div className="cr2-slot-company">{gameState?.playerProfile?.company || '???'}</div>
                  <div className="cr2-slot-floor">Floor {gameState?.floor || '?'} / 120</div>
                  <div className="cr2-slot-capital">
                    {gameState?.capital ? `${Math.floor(gameState.capital / 10000)}만원` : '???'}
                  </div>
                  <div className="cr2-slot-date">
                    {savedAt ? new Date(savedAt).toLocaleDateString('ko-KR') : '-'}
                  </div>
                </div>
              ) : (
                <div className="cr2-slot-empty-label">비어있음</div>
              )}
            </div>
          )
        })}
      </div>

      {confirmSlot && (
        <div className="cr2-slot-confirm-overlay">
          <div className="cr2-slot-confirm-box">
            <div className="cr2-slot-confirm-title">저장된 슬롯</div>
            <div className="cr2-slot-confirm-text">
              슬롯 {confirmSlot}에 저장된 데이터가 있습니다.<br />
              이어서 하거나 새 게임으로 덮어쓸 수 있습니다.
            </div>
            <div className="cr2-slot-confirm-btns">
              <button className="cr2-btn" onClick={() => handleContinue(confirmSlot)}>
                이어하기
              </button>
              <button className="cr2-btn cr2-btn-danger" onClick={handleConfirmOverwrite}>
                새 게임
              </button>
              <button className="cr2-btn" onClick={() => setConfirmSlot(null)}>
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        className="cr2-btn cr2-back-btn"
        onClick={() => {
          const prev = useGameStore.getState().previousScreen
          if (prev === 'title') {
            setCurrentScreen('title')
          } else {
            setCurrentScreen('advisorSelect')
          }
        }}
      >
        뒤로가기
      </button>
    </div>
  )
}
