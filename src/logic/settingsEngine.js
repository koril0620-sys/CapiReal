const SETTINGS_KEY = 'cr2_settings'

export const DEFAULT_SETTINGS = {
  language: 'ko',
  tutorial: true,
  autoSaveAlert: true,
  economyHint: true,
  strategyWarning: true,
  masterVolume: 50,
  bgmVolume: 100,
  sfxVolume: 100,
  bgmOn: true,
  sfxOn: true,
  background: true,
  screenShake: true,
  marketingLimitMode: 'ratio',
}

export function loadSettings() {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY)
    if (!saved) return { ...DEFAULT_SETTINGS }
    return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    console.error('설정 저장 실패')
  }
}

export function updateSetting(key, value) {
  const current = loadSettings()
  const updated = { ...current, [key]: value }
  saveSettings(updated)
  return updated
}

export function resetSettings() {
  localStorage.removeItem(SETTINGS_KEY)
  return { ...DEFAULT_SETTINGS }
}
