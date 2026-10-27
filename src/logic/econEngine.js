import { MARKOV_MATRIX, ECO_PHASES } from '../constants/economy'

let onPhaseChangeCb = null

export function setOnPhaseChange(cb) {
  onPhaseChangeCb = cb
}

function onPhaseChange(phase) {
  if (onPhaseChangeCb) onPhaseChangeCb(phase)
}

function emitPhaseChange(currentPhase, newPhase) {
  if (newPhase !== currentPhase) {
    onPhaseChange(newPhase)
  }
  return newPhase
}

export function transitionPhase(currentPhase, activeEffects = [], floor, _advisorId = null, random = Math.random) {
  const monopolSuppress = activeEffects.find(
    effect => effect.source === 'MONOPOL' && effect.type === 'ECONOMY_SUPPRESS',
  )
  if (monopolSuppress) {
    const order = ['boom', 'growth', 'stable', 'contraction', 'recession']
    const idx = order.indexOf(currentPhase)
    const newPhase = order[Math.min(Math.max(idx, 0) + 1, order.length - 1)]
    return emitPhaseChange(currentPhase, newPhase)
  }

  const monopolChaos = activeEffects.find(
    effect => effect.source === 'MONOPOL' && effect.type === 'PHASE_CHAOS',
  )
  if (monopolChaos) {
    const phases = Object.keys(ECO_PHASES)
    const newPhase = phases[Math.floor(random() * phases.length)]
    return emitPhaseChange(currentPhase, newPhase)
  }

  if (floor === 120) {
    const worst = random() > 0.5 ? 'recession' : 'contraction'
    return emitPhaseChange(currentPhase, worst)
  }

  const forceEffect = activeEffects.find(effect => effect.forcePhase)
  if (forceEffect) {
    const newPhase = forceEffect.forcePhase
    return emitPhaseChange(currentPhase, newPhase)
  }

  const transitions = MARKOV_MATRIX[currentPhase] || MARKOV_MATRIX.stable
  const roll = random()
  let cumulative = 0

  for (const [phase, prob] of Object.entries(transitions)) {
    cumulative += prob
    if (roll < cumulative) {
      return emitPhaseChange(currentPhase, phase)
    }
  }

  return currentPhase
}

export function tickActiveEffects(activeEffects) {
  return activeEffects
    .map(effect => ({ ...effect, remainingTurns: effect.remainingTurns - 1 }))
    .filter(effect => effect.remainingTurns > 0)
}

export function getNextPhaseHint(currentPhase, advisorId) {
  if (advisorId !== 'analyst') return null

  const transitions = MARKOV_MATRIX[currentPhase] || MARKOV_MATRIX.stable
  const sorted = Object.entries(transitions)
    .filter(([, prob]) => prob > 0)
    .sort(([, a], [, b]) => b - a)

  const [likelyPhase, likelyProb] = sorted[0]

  if (likelyPhase === currentPhase && sorted[1]) {
    return {
      phase: sorted[1][0],
      probability: sorted[1][1],
      message: `다음 달 ${phaseKorean(sorted[1][0])} 가능성 ${Math.round(sorted[1][1] * 100)}%`,
    }
  }

  return {
    phase: likelyPhase,
    probability: likelyProb,
    message: `다음 달 ${phaseKorean(likelyPhase)} 가능성 ${Math.round(likelyProb * 100)}%`,
  }
}

function phaseKorean(phase) {
  const map = { boom: '호황', growth: '성장', stable: '안정', contraction: '위축', recession: '불황' }
  return map[phase] || phase
}
