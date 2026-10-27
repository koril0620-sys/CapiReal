const META_KEY = 'capirogue_meta'

// 판을 넘어 유지되는 기록 (예: 게임오버 횟수 → '오기' 업적)
export function loadMeta() {
  try {
    const raw = localStorage.getItem(META_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function saveMeta(meta) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta))
  } catch {
    // 저장소를 쓸 수 없는 환경이면 무시
  }
}

export function bumpGameOverCount() {
  const meta = loadMeta()
  const next = { ...meta, gameOverCount: (meta.gameOverCount || 0) + 1 }
  saveMeta(next)
  return next.gameOverCount
}
