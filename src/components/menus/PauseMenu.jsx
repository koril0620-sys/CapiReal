import { useGameStore } from '../../store/useGameStore'
import { saveOnFloorEnter } from '../../logic/saveEngine'
import { signOut } from '../../logic/authEngine'
import { playSFX } from '../../logic/audioEngine'

export default function PauseMenu() {
  const gameState = useGameStore(s => s)
  const setCurrentScreen = useGameStore(s => s.setCurrentScreen)
  const setIsPaused = useGameStore(s => s.setIsPaused)

  const handleResume = () => {
    playSFX('click')
    setIsPaused(false)
  }

  const handleNavigate = (screen) => {
    playSFX('click')
    setIsPaused(false)
    setCurrentScreen(screen)
  }

  const handleSaveAndQuit = async () => {
    playSFX('click')
    await saveOnFloorEnter(gameState)
    setIsPaused(false)
    setCurrentScreen('title')
  }

  const handleLogout = async () => {
    playSFX('click')
    await saveOnFloorEnter(gameState)
    await signOut()
    setIsPaused(false)
    setCurrentScreen('login')
  }

  const menuItems = [
    { label: '▶ 게임 설정', screen: 'settings' },
    { label: '플레이 기록', screen: 'playRecord' },
    { label: '업적', screen: 'achievement' },
    { label: '경제용어 사전', screen: 'dictionary' },
    { label: '어드바이저 정보', screen: 'advisorInfo' },
    { label: '라이벌 도감', screen: 'rivalDex' },
  ]

  return (
    <div className="cr2-pause-overlay">
      <div className="cr2-pause-menu">
        <div className="cr2-pause-title">CapiRogue</div>
        <div className="cr2-pause-floor">Floor {gameState.floor} / 120</div>

        <div className="cr2-pause-divider" />

        {menuItems.map(item => (
          <button
            key={item.label}
            className="cr2-pause-item"
            onClick={() => {
              if (item.screen === 'settings') {
                useGameStore.getState().setPreviousScreen('main')
              }
              handleNavigate(item.screen)
            }}
          >
            {item.label}
          </button>
        ))}

        <div className="cr2-pause-divider" />

        <button className="cr2-pause-item cr2-pause-danger" onClick={handleSaveAndQuit}>
          저장하고 나가기
        </button>
        <button className="cr2-pause-item cr2-pause-ghost" onClick={handleLogout}>
          로그아웃
        </button>

        <button className="cr2-btn cr2-pause-resume-btn" onClick={handleResume}>
          계속하기
        </button>
      </div>
    </div>
  )
}
