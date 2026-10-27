import { useState } from 'react'
import { useGameStore } from '../store/useGameStore'
import { playSFX } from '../logic/audioEngine'

const AVATARS = [
  {
    id: 'male_a',
    label: '남 A',
    src: '/assets/player_male_a_profile-_nb4zKZU.png',
    fullSrc: '/assets/player_male_a_full-DF6j0EBQ.png',
  },
  {
    id: 'male_b',
    label: '남 B',
    src: '/assets/player_male_b_profile-DqCZ6-iC.png',
    fullSrc: '/assets/player_male_b_full-BNlwZp8L.png',
  },
  {
    id: 'female_a',
    label: '여 A',
    src: '/assets/player_female_a_profile-VQBwtxfm.png',
    fullSrc: '/assets/player_female_a_full-CBD6AZpe.png',
  },
  {
    id: 'female_b',
    label: '여 B',
    src: '/assets/player_female_b_profile-Ca7EZ6ok.png',
    fullSrc: '/assets/player_female_b_full-D8QzBvRn.png',
  },
]

export default function CharacterCreateScreen() {
  const setCurrentScreen = useGameStore(s => s.setCurrentScreen)
  const setPlayerProfile = useGameStore(s => s.setPlayerProfile)

  const [avatar, setAvatar] = useState('male_a')
  const [ceoName, setCeoName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [error, setError] = useState('')

  const handleStart = () => {
    if (!ceoName.trim()) {
      setError('CEO 이름을 입력하세요.')
      return
    }
    if (!companyName.trim()) {
      setError('회사 이름을 입력하세요.')
      return
    }

    playSFX('click')

    const selectedAvatar = AVATARS.find(a => a.id === avatar)
    const profile = {
      avatar: selectedAvatar?.src,
      avatarFull: selectedAvatar?.fullSrc,
      name: ceoName.trim(),
      company: companyName.trim(),
    }

    setPlayerProfile(profile)
    setCurrentScreen('advisorSelect')
  }

  return (
    <div className="cr2-character-screen">
      <button
        className="cr2-btn cr2-back-btn"
        onClick={() => setCurrentScreen('title')}
      >
        이전으로
      </button>

      <div className="cr2-character-card">
        <div className="cr2-character-title">CEO를 설정하세요</div>

        <div className="cr2-avatar-section">
          <div className="cr2-avatar-label">프로필 사진 선택</div>
          <div className="cr2-avatar-grid">
            {AVATARS.map(av => (
              <div
                key={av.id}
                className={`cr2-avatar-item ${avatar === av.id ? 'cr2-selected' : ''}`}
                onClick={() => {
                  setAvatar(av.id)
                  playSFX('click')
                }}
              >
                <img src={av.src} alt={av.label} className="cr2-avatar-img" />
                <div className="cr2-avatar-name">{av.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="cr2-character-input-group">
          <div className="cr2-character-input-label">&gt; CEO 이름</div>
          <input
            className="cr2-character-input"
            type="text"
            value={ceoName}
            onChange={e => setCeoName(e.target.value)}
            placeholder="이름 입력"
            maxLength={12}
          />
        </div>

        <div className="cr2-character-input-group">
          <div className="cr2-character-input-label">&gt; 회사 이름</div>
          <input
            className="cr2-character-input"
            type="text"
            value={companyName}
            onChange={e => setCompanyName(e.target.value)}
            placeholder="회사명 입력"
            maxLength={16}
          />
        </div>

        {error && <div className="cr2-character-error">{error}</div>}

        <button
          className="cr2-btn cr2-character-start-btn"
          onClick={handleStart}
        >
          시작하기
        </button>
      </div>
    </div>
  )
}
