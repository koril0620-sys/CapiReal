import { getBossCounterStrategy, checkBossClearCondition } from './monopolEngine'

export function initBossState(playerCapital) {
  return {
    id: 'hyekyung',
    capital: Infinity,
    price: playerCapital * 0.003,
    quality: 15,
    brand: 10,
    awareness: 90,
    marketingBudget: playerCapital * 0.15,
    lastPlayerStrategy: null,
    counterActive: false,
    turnsInFight: 0,
  }
}

export function processBossTurn(bossState, playerStrategy, econPhase) {
  const counter = getBossCounterStrategy(playerStrategy, bossState.lastPlayerStrategy)

  let newBossState = {
    ...bossState,
    lastPlayerStrategy: playerStrategy,
    counterActive: counter.isCounter,
    turnsInFight: bossState.turnsInFight + 1,
  }

  if (counter.isCounter) {
    newBossState = {
      ...newBossState,
      price: playerStrategy.price * 0.65,
      quality: bossState.quality + 15,
      marketingBudget: (playerStrategy.marketingBudget || 0) * 2.5,
    }
  } else {
    newBossState = applyPhaseOptimization(newBossState, econPhase)
  }

  return { bossState: newBossState, counter }
}

function applyPhaseOptimization(bossState, econPhase) {
  switch (econPhase) {
    case 'boom':
    case 'growth':
      return {
        ...bossState,
        price: bossState.price * 1.2,
        quality: bossState.quality + 3,
        marketingBudget: bossState.marketingBudget * 1.3,
      }
    case 'recession':
    case 'contraction':
      return {
        ...bossState,
        price: bossState.price * 0.8,
        quality: bossState.quality + 5,
        marketingBudget: bossState.marketingBudget * 0.8,
      }
    default:
      return bossState
  }
}

export function judgeBossBattle(bossShareHistory, playerCapital) {
  const isClear = checkBossClearCondition(bossShareHistory)
  const isGameOver = playerCapital < 0

  return {
    isClear,
    isGameOver,
    progress: bossShareHistory.slice(-3).filter(share => share < 0.5).length,
    message: isClear
      ? '혜경을 꺾었다. MONOPOL이 무너진다.'
      : '아직 3턴 연속 압도가 필요하다.',
  }
}

export function checkBossClear() {
  return false
}
