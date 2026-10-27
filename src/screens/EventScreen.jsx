import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../store/useGameStore'
import { resolveChoice, resolveCashAmount, amplifyEffect } from '../logic/eventEngine'
import { commitSettlement, enterNextFloor } from '../logic/turnFlow'
import { hasActiveAbility } from '../logic/monopolEngine'
import { eventHealthRecovery } from '../logic/healthEngine'
import { playBGM, playSFX } from '../logic/audioEngine'
import { getCurrentStage } from '../constants/monopol'
import '../styles/event.css'

export default function EventScreen() {
  const gameState = useGameStore(state => state)
  const setCurrentScreen = useGameStore(state => state.setCurrentScreen)
  const [selectedChoice, setSelectedChoice] = useState(null)
  const [result, setResult] = useState(null)
  const choiceResolvingRef = useRef(false)
  const flowResolvingRef = useRef(false)

  const externalEvent = gameState.currentExternalEvent
  const internalEvent = gameState.currentInternalEvent
  const rivalEvent = gameState.currentRivalEvent
  const internalOptions = gameState.internalEventOptions

  useEffect(() => {
    playBGM('tension')
  }, [])

  const handleExternalConfirm = () => {
    if (!externalEvent) {
      void proceedAfterEvent()
      return
    }

    const amplifyFactor = getExternalAmplifyFactor(gameState)
    const effect = amplifyEffect(externalEvent.effect, amplifyFactor)
    const newEffects = [
      ...(gameState.activeEffects || []),
      {
        ...effect,
        title: externalEvent.title,
        remainingTurns: effect.duration || 1,
        source: 'EXTERNAL',
      },
    ]
    useGameStore.setState(state => ({
      activeEffects: newEffects,
      currentExternalEvent: null,
      stats: {
        ...(state.stats || {}),
        externalEventCount: (state.stats?.externalEventCount || 0) + 1,
      },
    }))
    playSFX('event')

    const currentState = useGameStore.getState()
    if (!currentState.currentRivalEvent) {
      void proceedAfterEvent()
    }
  }

  const handleRivalConfirm = () => {
    if (!rivalEvent) {
      void proceedAfterEvent()
      return
    }

    const newEffects = [
      ...(gameState.activeEffects || []),
      {
        ...rivalEvent.effect,
        title: rivalEvent.title,
        targetRivalId: rivalEvent.targetRivalId || null,
        remainingTurns: rivalEvent.effect.duration || 1,
        // RE07(MONOPOL 개입)은 플레이어 시장 전체에 적용
        source: rivalEvent.type === 'MONOPOL_INTERVENTION' ? 'MONOPOL' : 'RIVAL',
      },
    ]

    useGameStore.setState(state => ({
      activeEffects: newEffects,
      currentRivalEvent: null,
      stats: {
        ...(state.stats || {}),
        rivalEventCount: (state.stats?.rivalEventCount || 0) + 1,
      },
    }))
    playSFX('event')

    void proceedAfterEvent()
  }

  const handleChoiceSelect = (choice) => {
    if (choiceResolvingRef.current) return
    choiceResolvingRef.current = true
    playSFX('click')
    setSelectedChoice(choice.id)
    setTimeout(() => {
      handleChoiceConfirmWithChoice(choice)
    }, 200)
  }

  const handleChoiceConfirmWithChoice = (choice) => {
    if (!choice || !internalEvent) return
    const outcome = resolveChoice(choice, gameState, gameState.selectedAdvisor)
    setResult({ choice, outcome })
    applyOutcome(outcome)
    // capitalChange는 '+MD' 같은 문자열이거나 0(숫자)일 수 있다
    const isSuccess = (typeof outcome.capitalChange === 'string' && outcome.capitalChange.startsWith('+')) ||
      (!outcome.capitalChange && !outcome.healthChange)
    const recoveryTag = choice.type === 'ABSURD' && outcome.capitalChange === '+LG'
      ? 'jackpot'
      : isSuccess ? 'success' : 'fail'
    const recovered = eventHealthRecovery(choice.type, recoveryTag, gameState.selectedAdvisor)
    if (recovered > 0) {
      useGameStore.setState(state => ({
        health: Math.min(state.health + recovered, state.maxHealth),
      }))
    }

    useGameStore.setState(state => ({
      stats: {
        ...(state.stats || {}),
        eventTotalCount: (state.stats?.eventTotalCount || 0) + 1,
        eventSuccessCount: isSuccess
          ? (state.stats?.eventSuccessCount || 0) + 1
          : state.stats?.eventSuccessCount || 0,
        absurdStreak: choice.type === 'ABSURD' && isSuccess
          ? (state.stats?.absurdStreak || 0) + 1
          : 0,
        gambleFailSafeRecover: choice.type === 'GAMBLE' && !isSuccess
          ? (state.stats?.gambleFailSafeRecover || 0) + 1
          : state.stats?.gambleFailSafeRecover || 0,
      },
    }))

    playSFX(
      typeof outcome.capitalChange === 'string' && outcome.capitalChange.startsWith('+')
        ? 'profit'
        : 'loss',
    )
  }

  const applyOutcome = (outcome) => {
    const updates = {}

    if (outcome.capitalChange) {
      const delta = resolveCashAmount(outcome.capitalChange, gameState.capital)
      updates.capital = gameState.capital + delta
    }
    if (outcome.healthChange) {
      updates.health = Math.min(
        Math.max((gameState.health || 10) + outcome.healthChange, 0),
        gameState.maxHealth || 10,
      )
    }
    if (outcome.qualityChange) {
      updates.quality = Math.max((gameState.quality || 8) + outcome.qualityChange, 0)
    }
    if (outcome.brandChange) {
      updates.brand = Math.max((gameState.brand || 2) + outcome.brandChange, 0)
    }
    if (outcome.awarenessChange) {
      updates.awareness = Math.min(
        Math.max((gameState.awareness || 10) + outcome.awarenessChange, 0),
        Math.min(100, (gameState.brand || 2) * 2),
      )
    }
    if (outcome.creditChange) {
      updates.creditScore = Math.min(
        Math.max((gameState.creditScore || 70) + outcome.creditChange, 0),
        100,
      )
    }
    if (outcome.orderCapChange) {
      updates.orderCap = Math.max((gameState.orderCap || 1000) + outcome.orderCapChange, 100)
    }
    if (outcome.costReduction) {
      updates.costReductionTotal = Math.min(
        (gameState.costReductionTotal || 0) + outcome.costReduction,
        0.40,
      )
    }

    useGameStore.setState({ ...updates, currentInternalEvent: null })
  }

  const proceedAfterEvent = async () => {
    if (flowResolvingRef.current) return
    flowResolvingRef.current = true

    const pendingNextFloor = useGameStore.getState().pendingNextFloor
    if (!pendingNextFloor) {
      useGameStore.setState({
        currentExternalEvent: null,
        currentInternalEvent: null,
        internalEventOptions: null,
        currentRivalEvent: null,
        pendingNextFloor: null,
      })
      setCurrentScreen('main')
      return
    }

    const screen = await enterNextFloor(pendingNextFloor)
    setCurrentScreen(screen)
  }

  const completeEventFlow = async () => {
    choiceResolvingRef.current = false
    if (flowResolvingRef.current) return

    if (useGameStore.getState().pendingNextFloor) {
      void proceedAfterEvent()
      return
    }

    flowResolvingRef.current = true

    try {
      const settlementResult = await commitSettlement()
      if (settlementResult.isGameOver) {
        setCurrentScreen('gameOver')
        return
      }
      setTimeout(() => setCurrentScreen('result'), 0)
    } catch (error) {
      console.error('settlement failed:', error)
      setTimeout(() => setCurrentScreen('result'), 0)
    }
  }

  useEffect(() => {
    if (!externalEvent && !rivalEvent && !internalEvent && !internalOptions?.length && !result && !choiceResolvingRef.current) {
      void completeEventFlow()
    }
  })

  if (!internalEvent && internalOptions?.length > 1 && !result) {
    return (
      <div className="cr2-event-screen">
        <div className="cr2-event-card cr2-event-internal cr2-event-pick">
          <div className="cr2-event-badge cr2-badge-internal">GAMBLER · 카드 선택</div>
          <div className="cr2-event-title">어떤 사건을 맞이할까?</div>
          <div className="cr2-event-desc">Gambler 패시브: 이벤트 카드 2장 중 하나를 고른다.</div>
          <div className="cr2-event-pick-row">
            {internalOptions.map(option => (
              <button
                key={option.id}
                type="button"
                className="cr2-event-pick-card"
                onClick={() => {
                  playSFX('click')
                  useGameStore.setState({ currentInternalEvent: option, internalEventOptions: null })
                }}
              >
                <span className="cr2-event-badge cr2-badge-internal">{getCategoryLabel(option.category)}</span>
                <span className="cr2-event-pick-title">{option.title}</span>
                <span className="cr2-event-pick-desc">{option.description}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (externalEvent && !result) {
    return (
      <div className="cr2-event-screen">
        <div
          className="cr2-event-bg"
          style={{ backgroundImage: `url(${externalEvent.backgroundImage})` }}
        />
        <div className="cr2-event-card cr2-event-external">
          <div className="cr2-event-badge cr2-badge-external">외부 이벤트</div>
          <div className="cr2-event-title">{externalEvent.title}</div>
          <div className="cr2-event-desc">{externalEvent.description}</div>
          <div className="cr2-event-effect">
            {formatEffect(amplifyEffect(externalEvent.effect, getExternalAmplifyFactor(gameState)))}
            {getExternalAmplifyFactor(gameState) > 1 && (
              <div className="cr2-event-amplify">
                효과 ×{getExternalAmplifyFactor(gameState).toFixed(2).replace(/\.?0+$/, '')}
                {gameState.selectedAdvisor === 'gambler' ? ' (Gambler)' : ''}
                {hasActiveAbility(gameState.markets, 'EVENT_AMPLIFY') ? ' (MONOPOL 시장 교란)' : ''}
              </div>
            )}
          </div>
          <button className="cr2-btn cr2-event-confirm-btn" onClick={handleExternalConfirm}>
            확인
          </button>
        </div>
      </div>
    )
  }

  if (rivalEvent && !result) {
    return (
      <div className="cr2-event-screen">
        <div
          className="cr2-event-card cr2-event-external"
          style={{ borderColor: 'var(--cr2-red)' }}
        >
          <div className="cr2-event-badge" style={{ color: 'var(--cr2-red)' }}>
            MONOPOL 이벤트
          </div>
          <div className="cr2-event-title" style={{ color: 'var(--cr2-red)' }}>
            {rivalEvent.title}
          </div>
          <div className="cr2-event-desc">
            {rivalEvent.description.replace(
              '{rivalName}',
              rivalEvent.targetName || getCurrentStage(gameState.floor)?.rivalName || '라이벌',
            )}
          </div>
          <div className="cr2-event-effect">
            {formatRivalEffect(rivalEvent.effect)}
          </div>
          <button
            className="cr2-btn cr2-event-confirm-btn"
            style={{ borderColor: 'var(--cr2-red)', color: 'var(--cr2-red)' }}
            onClick={handleRivalConfirm}
          >
            확인
          </button>
        </div>
      </div>
    )
  }

  if (internalEvent && !result) {
    return (
      <div className="cr2-event-screen">
        <div className="cr2-event-card cr2-event-internal">
          <div className="cr2-event-badge cr2-badge-internal">
            {getCategoryLabel(internalEvent.category)}
          </div>
          <div className="cr2-event-title">{internalEvent.title}</div>
          <div className="cr2-event-desc">{internalEvent.description}</div>

          <div className="cr2-event-choices">
            {internalEvent.choices.map(choice => (
              <div
                key={choice.id}
                className={`cr2-event-choice cr2-choice-${choice.type.toLowerCase()} ${selectedChoice === choice.id ? 'cr2-selected' : ''}`}
                onClick={() => handleChoiceSelect(choice)}
              >
                <div className="cr2-choice-header">
                  <span className="cr2-choice-label">
                    {choice.id}. {getChoiceTypeLabel(choice.type)}
                  </span>
                  <span className="cr2-choice-prob">{getChoiceProb(choice)}</span>
                </div>
                <div className="cr2-choice-desc">{choice.label}</div>
              </div>
            ))}
          </div>

        </div>
      </div>
    )
  }

  if (result) {
    return (
      <div className="cr2-event-screen">
        <div className="cr2-event-card cr2-event-result">
          <div className="cr2-event-title">결과</div>
          <div className={`cr2-event-result-text ${getResultType(result.outcome)}`}>
            {formatOutcome(result.outcome, gameState.capital)}
          </div>
          <button className="cr2-btn cr2-event-confirm-btn" onClick={completeEventFlow}>
            계속
          </button>
        </div>
      </div>
    )
  }

  return null
}

function formatEffect(effect) {
  const lines = []
  if (effect.forcePhase) lines.push(`경기 국면 → ${phaseKorean(effect.forcePhase)}`)
  if (effect.demandMultiplier) lines.push(`수요 ${effect.demandMultiplier > 1 ? '+' : ''}${((effect.demandMultiplier - 1) * 100).toFixed(0)}%`)
  if (effect.costMultiplier) lines.push(`원가 ${effect.costMultiplier > 1 ? '+' : ''}${((effect.costMultiplier - 1) * 100).toFixed(0)}%`)
  if (effect.interestRateChange) lines.push(`이자율 ${effect.interestRateChange > 0 ? '+' : ''}${(effect.interestRateChange * 100).toFixed(1)}%p`)
  if (effect.duration) lines.push(`지속: ${effect.duration}턴`)
  return lines.join(' / ')
}

function formatRivalEffect(effect) {
  const lines = []
  if (effect.rivalPriceMultiplier) lines.push(`라이벌 가격 ${((effect.rivalPriceMultiplier - 1) * 100).toFixed(0)}%`)
  if (effect.rivalAwarenessBoost) lines.push(`라이벌 인지도 +${effect.rivalAwarenessBoost}%`)
  if (effect.rivalQualityBoost) lines.push(`라이벌 품질 +${effect.rivalQualityBoost}`)
  if (effect.demandMultiplier) lines.push(`수요 ${((effect.demandMultiplier - 1) * 100).toFixed(0)}%`)
  if (effect.costMultiplier) lines.push(`원가 +${((effect.costMultiplier - 1) * 100).toFixed(0)}%`)
  if (effect.duration) lines.push(`${effect.duration}턴 지속`)
  return lines.join(' / ')
}

function formatOutcome(outcome, capital) {
  const lines = []
  if (outcome.capitalChange) {
    const delta = resolveCashAmount(outcome.capitalChange, capital)
    lines.push(`자본 ${delta > 0 ? '+' : ''}${(delta / 10000).toFixed(0)}만원`)
  }
  if (outcome.healthChange) lines.push(`체력 ${outcome.healthChange > 0 ? '+' : ''}${outcome.healthChange}`)
  if (outcome.qualityChange) lines.push(`품질 ${outcome.qualityChange > 0 ? '+' : ''}${outcome.qualityChange}`)
  if (outcome.brandChange) lines.push(`브랜드 ${outcome.brandChange > 0 ? '+' : ''}${outcome.brandChange}`)
  if (outcome.creditChange) lines.push(`신용점수 ${outcome.creditChange > 0 ? '+' : ''}${outcome.creditChange}`)
  if (outcome.costReduction) lines.push(`원가 절감 +${(outcome.costReduction * 100).toFixed(1)}%`)
  return lines.length > 0 ? lines.join(' / ') : '변화 없음'
}

function getResultType(outcome) {
  if (!outcome.capitalChange) return 'cr2-neutral'
  return outcome.capitalChange.startsWith('+') ? 'cr2-positive' : 'cr2-negative'
}

function getCategoryLabel(category) {
  const map = { PRODUCTION: '생산/품질', HR: '인사/조직', MARKETING: '마케팅/브랜드', FINANCE: '재무/기회' }
  return map[category] || category
}

function getChoiceTypeLabel(type) {
  const map = { SAFE: '안전', NORMAL: '일반', GAMBLE: '도박', ABSURD: '말도안됨' }
  return map[type] || type
}

function getChoiceProb(choice) {
  if (choice.type === 'SAFE') return '성공 100%'
  if (choice.type === 'NORMAL') return '성공 70% / 실패 30%'
  if (choice.type === 'GAMBLE') return '성공 30% / 실패 70%'
  if (choice.type === 'ABSURD') return '대박 20% / 보통 40% / 손해 40%'
  return ''
}

function phaseKorean(phase) {
  const map = { boom: '호황', growth: '성장', stable: '안정', contraction: '위축', recession: '불황' }
  return map[phase] || phase
}

// Gambler ×1.3, 철민·도건(시장 교란)이 살아 있으면 ×1.5 — 둘 다면 곱한다
function getExternalAmplifyFactor(gameState) {
  let factor = 1
  if (gameState.selectedAdvisor === 'gambler') factor *= 1.3
  if (hasActiveAbility(gameState.markets, 'EVENT_AMPLIFY')) factor *= 1.5
  return factor
}
