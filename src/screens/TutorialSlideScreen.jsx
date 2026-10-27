import { useState } from 'react'
import { useGameStore } from '../store/useGameStore'
import { playSFX } from '../logic/audioEngine'

const SLIDES = [
  {
    id: 1,
    title: '세계 배경',
    icon: '🏴',
    content: 'MONOPOL이라는 거대 조직이 모든 시장을 장악했다.\n너는 그 틈새에서 살아남은 유일한 독립 사업자다.',
  },
  {
    id: 2,
    title: '목표',
    icon: '🎯',
    content: '120개월(10년) 동안 버텨라.\n자본을 지키고 MONOPOL의 라이벌들을 하나씩 무너뜨려라.',
  },
  {
    id: 3,
    title: '한 달의 흐름',
    icon: '🔄',
    content: '매달 순서:\n① 발주량·가격·품질 결정\n② 이벤트 발생\n③ 정산 (실판매·비용 계산)\n④ 다음 달로',
  },
  {
    id: 4,
    title: '핵심 지표 3가지',
    icon: '📊',
    content: '자본 — 0 이하 4연속이면 파산\n체력 — 0이 되면 게임 오버\n점유율 — 라이벌보다 높게 유지해라',
  },
  {
    id: 5,
    title: '경기 국면',
    icon: '📈',
    content: '경제는 5단계로 순환한다.\n호황엔 공격적으로, 불황엔 보수적으로.\n국면을 읽는 것이 승패를 가른다.',
  },
  {
    id: 6,
    title: '어드바이저',
    icon: '🧠',
    content: '선택한 어드바이저가 매달 조언을 준다.\n조언을 무시해도 되지만, 대가를 치를 수도 있다.\n자, 시작하자.',
  },
]

export default function TutorialSlideScreen() {
  const setCurrentScreen = useGameStore(state => state.setCurrentScreen)
  const [index, setIndex] = useState(0)
  const slide = SLIDES[index]
  const isLast = index === SLIDES.length - 1

  const goMain = () => {
    playSFX('click')
    setCurrentScreen('main')
  }

  const goPrev = () => {
    playSFX('click')
    setIndex(current => Math.max(current - 1, 0))
  }

  const goNext = () => {
    playSFX('click')
    if (isLast) {
      setCurrentScreen('main')
      return
    }
    setIndex(current => Math.min(current + 1, SLIDES.length - 1))
  }

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: '#050805',
      color: 'var(--cr2-white)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Press Start 2P', 'Noto Sans KR', monospace",
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute',
        top: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        color: 'var(--cr2-green)',
        fontSize: '10px',
      }}>
        {index + 1} / {SLIDES.length}
      </div>

      <div style={{
        width: 'min(760px, 80%)',
        height: '360px',
        border: '2px solid var(--cr2-green)',
        background: 'rgba(0,0,0,0.72)',
        boxShadow: '0 0 24px rgba(0,255,65,0.18)',
        padding: '48px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '24px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '46px', lineHeight: 1 }}>{slide.icon}</div>
        <div style={{ fontSize: '20px', color: 'var(--cr2-lime)' }}>
          {slide.title}
        </div>
        <div style={{
          fontFamily: "'Noto Sans KR', sans-serif",
          fontSize: '16px',
          lineHeight: 1.9,
          color: 'var(--cr2-white)',
          whiteSpace: 'pre-line',
        }}>
          {slide.content}
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          {SLIDES.map((item, dotIndex) => (
            <span
              key={item.id}
              style={{
                color: dotIndex === index ? 'var(--cr2-lime)' : 'rgba(255,255,255,0.25)',
                fontSize: '10px',
              }}
            >
              ●
            </span>
          ))}
        </div>
      </div>

      <button
        className="cr2-btn cr2-btn-ghost"
        onClick={goMain}
        style={{
          position: 'absolute',
          left: '32px',
          bottom: '32px',
        }}
      >
        건너뛰기
      </button>

      <div style={{
        position: 'absolute',
        right: '32px',
        bottom: '32px',
        display: 'flex',
        gap: '8px',
      }}>
        <button
          className="cr2-btn cr2-btn-ghost"
          onClick={goPrev}
          disabled={index === 0}
        >
          이전
        </button>
        <button className="cr2-btn" onClick={goNext}>
          {isLast ? '시작' : '다음'}
        </button>
      </div>
    </div>
  )
}
