import { supabase } from '../lib/supabaseClient'
import { useGameStore } from '../store/useGameStore'

const AUTH_KEY = 'cr2_auth'

function hashPassword(password) {
  // TODO: 실제 서비스에서는 bcrypt로 교체
  let hash = 0
  for (let i = 0; i < password.length; i += 1) {
    hash = ((hash << 5) - hash) + password.charCodeAt(i)
    hash |= 0
  }
  return String(hash)
}

export function saveAuthToken(username, userId) {
  try {
    const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 7
    localStorage.setItem(AUTH_KEY, JSON.stringify({ username, userId, expiresAt }))
  } catch {
    console.error('자동 로그인 토큰 저장 실패')
  }
}

export function loadAuthToken() {
  try {
    const saved = localStorage.getItem(AUTH_KEY)
    if (!saved) return null

    const parsed = JSON.parse(saved)
    if (Date.now() > parsed.expiresAt) {
      clearAuthToken()
      return null
    }

    return parsed
  } catch {
    return null
  }
}

export function clearAuthToken() {
  localStorage.removeItem(AUTH_KEY)
}

export async function tryAutoLogin() {
  const token = loadAuthToken()
  if (!token) return false
  if (!supabase) return false

  try {
    const { data, error } = await supabase
      .from('player_accounts')
      .select('id, username, user_type')
      .eq('id', token.userId)
      .single()

    if (error || !data) {
      clearAuthToken()
      return false
    }

    useGameStore.getState().setPlayerId(data.id)
    useGameStore.getState().setUserType(data.user_type)
    return true
  } catch {
    clearAuthToken()
    return false
  }
}

export async function signIn(username, password, rememberMe = true) {
  if (!supabase) return { success: false, error: '서버 연결 없음 (게스트 모드)' }

  try {
    const { data, error } = await supabase
      .from('player_accounts')
      .select('*')
      .eq('username', username)
      .single()

    if (error || !data) return { success: false, error: '아이디를 찾을 수 없습니다.' }

    if (data.password_hash !== hashPassword(password)) {
      return { success: false, error: '비밀번호가 틀렸습니다.' }
    }

    if (rememberMe) saveAuthToken(username, data.id)
    useGameStore.getState().setPlayerId(data.id)
    useGameStore.getState().setUserType(data.user_type)
    return { success: true, userId: data.id }
  } catch {
    return { success: false, error: '로그인 중 오류가 발생했습니다.' }
  }
}

export async function signUp(username, password, userType = 'general') {
  if (!supabase) return { success: false, error: '서버 연결 없음 (게스트 모드)' }

  try {
    const { data: existing } = await supabase
      .from('player_accounts')
      .select('id')
      .eq('username', username)
      .single()

    if (existing) return { success: false, error: '이미 사용 중인 아이디입니다.' }

    const { data, error } = await supabase
      .from('player_accounts')
      .insert({
        username,
        password_hash: hashPassword(password),
        user_type: userType,
        achievements: [],
        education_progress: {},
      })
      .select()
      .single()

    if (error) return { success: false, error: '회원가입 중 오류가 발생했습니다.' }
    return { success: true, userId: data.id }
  } catch {
    return { success: false, error: '회원가입 중 오류가 발생했습니다.' }
  }
}

export async function signOut() {
  clearAuthToken()
  useGameStore.getState().setPlayerId(null)
  useGameStore.getState().setUserType('general')
}
