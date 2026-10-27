import { useEffect } from 'react'
import { useGameStore } from './store/useGameStore'
import { loadSettings } from './logic/settingsEngine'
import { tryAutoLogin } from './logic/authEngine'
import { applyAudioSettings } from './logic/audioEngine'

import LoginScreen from './screens/LoginScreen'
import TitleScreen from './screens/TitleScreen'
import CharacterCreateScreen from './screens/CharacterCreateScreen'
import AdvisorSelectScreen from './screens/AdvisorSelectScreen'
import SlotSelectScreen from './screens/SlotSelectScreen'
import MainScreen from './screens/MainScreen'
import TutorialSlideScreen from './screens/TutorialSlideScreen'
import EventScreen from './screens/EventScreen'
import ResultScreen from './screens/ResultScreen'
import RewardScreen from './screens/RewardScreen'
import GameOverScreen from './screens/GameOverScreen'
import EndingScreen from './screens/EndingScreen'
import BossScreen from './screens/BossScreen'
import AchievementScreen from './screens/AchievementScreen'
import EconomyDictionary from './screens/EconomyDictionary'
import PauseMenu from './components/menus/PauseMenu'
import GameSettings from './components/menus/GameSettings'
import PlayRecord from './components/menus/PlayRecord'
import AdvisorInfo from './components/menus/AdvisorInfo'
import RivalDex from './components/menus/RivalDex'

import './styles/global.css'
import './styles/login.css'
import './styles/title.css'
import './styles/character.css'
import './styles/advisor.css'
import './styles/main.css'
import './styles/panel.css'
import './styles/result.css'
import './styles/event.css'
import './styles/gameOver.css'
import './styles/ending.css'
import './styles/boss.css'
import './styles/achievement.css'
import './styles/achievementToast.css'
import './styles/reward.css'
import './styles/pause.css'
import './styles/settings.css'
import './styles/playRecord.css'
import './styles/rivalDex.css'
import './styles/advisorInfo.css'
import './styles/factory.css'
import './styles/loan.css'
import './styles/markets.css'

export default function App() {
  const currentScreen = useGameStore(s => s.currentScreen)
  const isPaused = useGameStore(s => s.isPaused)
  const setCurrentScreen = useGameStore(s => s.setCurrentScreen)
  const setSettings = useGameStore(s => s.setSettings)

  useEffect(() => {
    const settings = loadSettings()
    setSettings(settings)
    applyAudioSettings(settings)

    tryAutoLogin().then(success => {
      setCurrentScreen(success ? 'title' : 'login')
    })
  }, [setCurrentScreen, setSettings])

  const screens = {
    login: <LoginScreen />,
    title: <TitleScreen />,
    characterCreate: <CharacterCreateScreen />,
    advisorSelect: <AdvisorSelectScreen />,
    slotSelect: <SlotSelectScreen />,
    tutorialSlide: <TutorialSlideScreen />,
    main: <MainScreen />,
    event: <EventScreen />,
    result: <ResultScreen />,
    reward: <RewardScreen />,
    gameOver: <GameOverScreen />,
    ending: <EndingScreen />,
    boss: <BossScreen />,
    achievement: <AchievementScreen />,
    dictionary: <EconomyDictionary />,
    settings: <GameSettings />,
    playRecord: <PlayRecord />,
    advisorInfo: <AdvisorInfo />,
    rivalDex: <RivalDex />,
  }

  return (
    <>
      {screens[currentScreen] || <TitleScreen />}
      {isPaused && <PauseMenu />}
    </>
  )
}
