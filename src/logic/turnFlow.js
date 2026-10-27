import { useGameStore } from '../store/useGameStore'
import { settle } from './settlementEngine'
import { checkAchievements, saveAchievements } from './achievementEngine'
import { getClearGrade } from './rewardEngine'
import { applyMonopolEvaluation, enterFloor } from './floorEngine'
import { rollExternalEvent, rollRivalEvent } from './eventEngine'
import { saveOnFloorEnter } from './saveEngine'
import { getCurrentStage, isBossStage } from '../constants/monopol'

export { loadMeta, saveMeta, bumpGameOverCount } from './metaStorage'

// 정산 1회: 스토어 상태로 settle → 반영 → 업적 저장
export async function commitSettlement() {
  const currentState = useGameStore.getState()
  const { updatedState, settlementResult } = settle(currentState)

  useGameStore.setState({
    ...updatedState,
    lastSettlementResult: settlementResult,
    currentExternalEvent: null,
    currentInternalEvent: null,
    internalEventOptions: null,
    currentRivalEvent: null,
    pendingNextFloor: null,
  })

  if (settlementResult.newlyUnlocked?.length > 0) {
    useGameStore.setState({ newAchievements: settlementResult.newlyUnlocked })
    if (currentState.playerId) {
      try {
        await saveAchievements(currentState.playerId, settlementResult.newlyUnlocked)
      } catch (error) {
        console.error('achievement save failed:', error)
      }
    }
  }

  return settlementResult
}

// 정산 밖에서 생긴 변화(클리어, 게임오버, 결과 화면 조회 등) 뒤 업적 재확인
export async function recheckAchievements(result = null) {
  const state = useGameStore.getState()
  const newlyUnlocked = checkAchievements(state, result)
  if (newlyUnlocked.length === 0) return []

  useGameStore.setState({
    unlockedAchievements: [...new Set([...(state.unlockedAchievements || []), ...newlyUnlocked])],
    newAchievements: newlyUnlocked,
  })
  if (state.playerId) {
    try {
      await saveAchievements(state.playerId, newlyUnlocked)
    } catch (error) {
      console.error('achievement save failed:', error)
    }
  }
  return newlyUnlocked
}

export function markGameClear() {
  const state = useGameStore.getState()
  const grade = getClearGrade(state)
  useGameStore.setState({ clearGrade: grade, isClear: true })
  return grade
}

export function bumpStat(key, amount = 1) {
  useGameStore.setState(state => ({
    stats: { ...(state.stats || {}), [key]: ((state.stats || {})[key] || 0) + amount },
  }))
}

// ── 층 이동 ──────────────────────────────────────

function pickRivalEventTarget(state, stage) {
  const markets = (state.markets || []).filter(market => market.active)
  const all = markets.flatMap(market => market.rivals)
  return all.find(rival => rival.id === stage?.rival)
    || all.find(rival => !rival.isGeneric && !rival.unbreakable)
    || all.find(rival => !rival.unbreakable)
    || null
}

// 결과 화면의 '다음' 버튼: MONOPOL 평가 → 이벤트 → 다음 층(또는 최종전 다음 라운드)
export async function advanceAfterResult() {
  const state = useGameStore.getState()
  const result = state.lastSettlementResult || {}
  const bossFloor = isBossStage(state.floor)

  if (bossFloor && (result.bossClear || result.bossTimeout)) {
    markGameClear()
    return 'ending'
  }

  if (!bossFloor) {
    const evaluation = applyMonopolEvaluation(state)
    if (evaluation) useGameStore.setState(evaluation.updates)
  }

  const nextFloor = bossFloor ? state.floor : state.floor + 1
  if (nextFloor > 120) {
    markGameClear()
    return 'ending'
  }

  const current = useGameStore.getState()
  const stage = getCurrentStage(current.floor)
  const externalEvent = rollExternalEvent(current.floor, current.activeEffects)
  let rivalEvent = stage ? rollRivalEvent(stage.tier) : null

  if (rivalEvent && rivalEvent.type !== 'MONOPOL_INTERVENTION') {
    const target = pickRivalEventTarget(current, stage)
    rivalEvent = target
      ? { ...rivalEvent, targetRivalId: target.id, targetName: target.name }
      : null
  }

  if (externalEvent || rivalEvent) {
    useGameStore.setState({
      currentExternalEvent: externalEvent || null,
      currentInternalEvent: null,
      internalEventOptions: null,
      currentRivalEvent: rivalEvent || null,
      pendingNextFloor: nextFloor,
    })
    return 'event'
  }

  return enterNextFloor(nextFloor)
}

export async function enterNextFloor(nextFloor) {
  useGameStore.setState({
    floor: nextFloor,
    pendingNextFloor: null,
    currentExternalEvent: null,
    currentInternalEvent: null,
    internalEventOptions: null,
    currentRivalEvent: null,
  })
  await saveOnFloorEnter(useGameStore.getState())

  if (isBossStage(nextFloor)) return 'boss'
  if (nextFloor % 5 === 0) return 'reward'
  return 'main'
}

// 메인 화면 진입 시 이번 층 처리(새 시장·새 조직원)가 안 됐으면 한 번만 실행
export function ensureFloorEntered() {
  const state = useGameStore.getState()
  if (state.floorEnteredFor === state.floor) return null

  const prevFloor = typeof state.floorEnteredFor === 'number' ? state.floorEnteredFor : state.floor - 1
  const { updates, events } = enterFloor(state, prevFloor)
  useGameStore.setState({ ...updates, floorEnteredFor: state.floor })
  return events
}
