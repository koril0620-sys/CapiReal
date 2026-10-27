const BGM_FILES = {
  main: '/assets/bg_music_main-OJkt3Ww0.wav',
  boom: '/assets/boom_bgm-DTk4t7vb.wav',
  growth: '/assets/growth_bgm-C0KEhCfV.wav',
  stable: '/assets/stable_bgm-DcFM65x4.wav',
  contraction: '/assets/contraction_bgm-D-3xaovd.wav',
  recession: '/assets/recession_bgm-CIfbH_6Y.wav',
  strategy: '/assets/business_decision_bgm-DwDZoRM1.wav',
  tension: '/assets/bg_music_tension-ckK7n9RU.wav',
  boss: '/assets/bg_music_tension-ckK7n9RU.wav',
}

const SFX_FILES = {
  click: '/assets/sfx_click-qu1BfHPW.wav',
  nextfloor: '/assets/sfx_nextfloor-DkbsiXpx.wav',
  event: '/assets/sfx_click-qu1BfHPW.wav',
  warning: '/assets/sfx_click-qu1BfHPW.wav',
  profit: '/assets/sfx_nextfloor-DkbsiXpx.wav',
  loss: '/assets/sfx_click-qu1BfHPW.wav',
  rival: '/assets/sfx_click-qu1BfHPW.wav',
  boss: '/assets/sfx_nextfloor-DkbsiXpx.wav',
  clear: '/assets/sfx_nextfloor-DkbsiXpx.wav',
}

let currentBGM = null
let currentBGMKey = null
let bgmVolume = 1.0
let sfxVolume = 1.0
let bgmEnabled = true
let sfxEnabled = true

export function applyAudioSettings(settings) {
  bgmVolume = ((settings.masterVolume ?? 100) / 100) * ((settings.bgmVolume ?? 100) / 100)
  sfxVolume = ((settings.masterVolume ?? 100) / 100) * ((settings.sfxVolume ?? 100) / 100)

  const prevBgmEnabled = bgmEnabled
  bgmEnabled = settings.bgmOn !== false
  sfxEnabled = settings.sfxOn !== false

  if (currentBGM) {
    if (!bgmEnabled) {
      currentBGM.pause()
      currentBGM.currentTime = 0
    } else if (!prevBgmEnabled && bgmEnabled) {
      currentBGM.volume = bgmVolume
      currentBGM.play().catch(() => {})
    } else {
      currentBGM.volume = bgmVolume
    }
  }
}

export function playBGM(key, volume = null) {
  if (!bgmEnabled) return

  if (currentBGMKey === key && currentBGM && !currentBGM.paused) return

  const src = BGM_FILES[key]
  if (!src) return

  if (currentBGM) {
    currentBGM.pause()
    currentBGM.currentTime = 0
    currentBGM = null
    currentBGMKey = null
  }

  startBGM(src, key, volume)
}

function startBGM(src, key, volume, fade = false) {
  const audio = new Audio(src)
  audio.loop = true
  const targetVolume = volume !== null ? volume : bgmVolume
  audio.volume = fade ? 0 : targetVolume
  audio.play().catch(error => console.warn('BGM 재생 실패:', error))
  if (fade) fadeIn(audio, targetVolume)
  currentBGM = audio
  currentBGMKey = key
}

export function stopBGM(fade = false) {
  if (!currentBGM) return

  if (fade) {
    const audio = currentBGM
    fadeOut(audio, () => {
      currentBGM = null
      currentBGMKey = null
    })
  } else {
    currentBGM.pause()
    currentBGM.currentTime = 0
    currentBGM = null
    currentBGMKey = null
  }
}

export function setBGMVolume(volume) {
  bgmVolume = volume
  if (currentBGM) currentBGM.volume = volume
}

export function playSFX(key) {
  if (!sfxEnabled) return

  const src = SFX_FILES[key]
  if (!src) return

  const audio = new Audio(src)
  audio.volume = sfxVolume
  audio.play().catch(() => {})
}

export function onPhaseChange(newPhase) {
  if (currentBGMKey === newPhase) return
  playBGM(newPhase)
}

function fadeIn(audio, targetVolume, duration = 1000) {
  audio.volume = 0
  const step = targetVolume / (duration / 50)
  const interval = setInterval(() => {
    if (audio.volume + step >= targetVolume) {
      audio.volume = targetVolume
      clearInterval(interval)
    } else {
      audio.volume += step
    }
  }, 50)
}

function fadeOut(audio, callback, duration = 800) {
  const step = audio.volume / (duration / 50)
  const interval = setInterval(() => {
    if (audio.volume - step <= 0) {
      audio.volume = 0
      audio.pause()
      clearInterval(interval)
      if (callback) callback()
    } else {
      audio.volume -= step
    }
  }, 50)
}

export function playSound(key) {
  playSFX(key)
}

export function stopSound() {
  stopBGM()
}
