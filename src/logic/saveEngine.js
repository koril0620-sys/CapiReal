import { supabase } from '../lib/supabaseClient'
import { useGameStore } from '../store/useGameStore'
import { ensureMarkets, getPrimaryMarket } from '../constants/markets'

const EXCLUDE_FIELDS = [
  'currentScreen',
  'isPaused',
  'stagePopup',
  'learningPopup',
  'newAchievements',
  'lastSettlementResult',
]

export function serializeGameState(gameState) {
  const serialized = {}

  for (const [key, value] of Object.entries(gameState)) {
    if (typeof value === 'function') continue
    if (EXCLUDE_FIELDS.includes(key)) continue
    serialized[key] = value
  }

  return serialized
}

export function hydrateGameState(savedJson) {
  const saved = { ...(savedJson || {}) }
  // 시장 구조 이전 저장본도 단일 시장으로 변환해서 불러온다
  const markets = ensureMarkets(saved)
  return {
    ...saved,
    markets,
    selectedMarketId: saved.selectedMarketId || getPrimaryMarket({ markets })?.tierId || 'tier_1',
    defeatedRivals: saved.defeatedRivals || [],
    floorEnteredFor: typeof saved.floorEnteredFor === 'number' ? saved.floorEnteredFor : saved.floor,
    lastTurnAt: Date.now(),
  }
}

export async function saveOnFloorEnter(gameState = useGameStore.getState()) {
  const { playerId, currentSlot } = gameState
  if (!playerId || !currentSlot) return false
  if (!supabase) return false

  const serialized = serializeGameState(gameState)

  try {
    const { error } = await supabase
      .from('save_slots')
      .upsert({
        player_id: playerId,
        slot_number: currentSlot,
        game_state: serialized,
        saved_at: new Date().toISOString(),
      }, {
        onConflict: 'player_id,slot_number',
      })

    if (error) {
      console.error('[saveEngine] saveOnFloorEnter 오류:', error.message, error.details, error.hint)
      return false
    }

    return true
  } catch (e) {
    console.error('[saveEngine] saveOnFloorEnter 예외:', e)
    return false
  }
}

export async function loadSaveSlots(userId) {
  if (!supabase) return []

  try {
    const { data, error } = await supabase
      .from('save_slots')
      .select('slot_number, game_state, saved_at')
      .eq('player_id', userId)
      .order('slot_number')

    if (error) {
      console.error('[saveEngine] loadSaveSlots 오류:', error.message)
      return []
    }
    return data || []
  } catch {
    return []
  }
}

export async function loadSaveSlot(userId, slotNumber) {
  if (!supabase) return null

  try {
    const { data, error } = await supabase
      .from('save_slots')
      .select('game_state')
      .eq('player_id', userId)
      .eq('slot_number', slotNumber)
      .single()

    if (error || !data) return null
    return hydrateGameState(data.game_state)
  } catch {
    return null
  }
}

export async function deleteSaveSlot(userId, slotNumber) {
  if (!supabase) return false

  try {
    const { error } = await supabase
      .from('save_slots')
      .delete()
      .eq('player_id', userId)
      .eq('slot_number', slotNumber)

    return !error
  } catch {
    return false
  }
}

export async function saveRecord(userId, recordData) {
  if (!supabase) return false

  try {
    const { error } = await supabase
      .from('records')
      .insert({
        user_id: userId,
        result_type: recordData.result_type,
        clear_grade: recordData.clear_grade || null,
        advisor_id: recordData.advisor_id,
        final_capital: recordData.final_capital,
        clear_floor: recordData.clear_floor,
        playtime: recordData.playtime,
        profit_turns: recordData.profit_turns,
        loss_turns: recordData.loss_turns,
        max_share: recordData.max_share,
        bankruptcy_count: recordData.bankruptcy_count,
        external_events: recordData.external_events,
        event_success_rate: recordData.event_success_rate,
        rival_dominated: recordData.rival_dominated,
        monopol_clears: recordData.monopol_clears || [],
        created_at: new Date().toISOString(),
      })

    return !error
  } catch {
    return false
  }
}

export async function loadAllRecords(userId) {
  if (!supabase) return []

  try {
    const { data, error } = await supabase
      .from('records')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) return []
    return data || []
  } catch {
    return []
  }
}

export function saveGame() {}

export function loadGame() {
  return null
}
