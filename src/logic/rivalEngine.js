export function selectRivalStrategy() {
  return {}
}

export function evaluateMonopolRival(state) {
  const rival = state.currentRival || state.rivals?.[0] || null
  if (!rival) return null

  const marketShare = rival.marketShare ?? (1 - ((state.playerShareHistory || []).slice(-1)[0] || 0))
  const capital = rival.capital ?? state.rivalCapital ?? 0
  const initialCapital = rival.initialCapital ?? state.rivalInitialCapital ?? 1

  const isBust =
    marketShare < 0.20 ||
    capital < initialCapital * 0.5

  return {
    isBust,
    message: isBust
      ? '실망이군. 퇴출한다. 더 강한 자를 보내겠다.'
      : '거슬리는군. 지원을 더 붙이겠다.',
    action: isBust ? 'replace' : 'reinforce',
  }
}
