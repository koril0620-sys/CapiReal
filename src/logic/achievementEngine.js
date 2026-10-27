import { ACHIEVEMENTS } from '../constants/achievements'
import { supabase } from '../lib/supabaseClient'
import { getGrade } from './creditEngine'

export function checkAchievements(gameState, settlementResult) {
  const newlyUnlocked = []

  ACHIEVEMENTS.forEach(achievement => {
    if ((gameState.unlockedAchievements || []).includes(achievement.id)) return
    if (checkCondition(achievement.condition, gameState, settlementResult)) {
      newlyUnlocked.push(achievement.id)
    }
  })

  return newlyUnlocked
}

function checkCondition(condition, rawState, result) {
  const gameState = { ...rawState, stats: rawState.stats || {} }
  switch (condition.type) {
    case 'GAME_START': return true
    case 'PROFIT_ONCE': return result?.isProfit
    case 'PROFIT_STREAK': return (gameState.stats.profitStreak || 0) >= condition.count
    case 'PROFIT_STREAK_RECESSION': return gameState.econPhase === 'recession' && (gameState.stats.profitStreak || 0) >= condition.count
    case 'PROFIT_IN_RECESSION_ONCE': return gameState.econPhase === 'recession' && result?.isProfit
    case 'AWARENESS_OVER': return gameState.awareness >= condition.value
    case 'AWARENESS_AND_BRAND': return gameState.awareness >= condition.awareness && gameState.brand >= condition.brand
    case 'CREDIT_GRADE': return getGrade(gameState.creditScore) === condition.grade
    case 'CREDIT_SCORE_MAX': return gameState.creditScore >= 100
    case 'SHARE_OVER': return (result?.shareAfter || 0) >= condition.value
    case 'SHARE_FIRST_IN_RECESSION': return gameState.econPhase === 'recession' && (result?.shareAfter || 0) > 0.5
    case 'QUALITY_OVER': return gameState.quality >= condition.value
    case 'QUALITY_AND_BRAND': return gameState.quality >= condition.quality && gameState.brand >= condition.brand
    case 'COST_REDUCTION_ONCE': return (gameState.costReductionCount || 0) >= 1
    case 'COST_REDUCTION_TOTAL': return (gameState.costReductionTotal || 0) >= condition.value
    case 'QUALITY_UPGRADE_ONCE': return (gameState.qualityUpgradeCount || 0) >= 1
    case 'MARKETING_ONCE': return (gameState.stats.marketingCount || 0) >= 1
    case 'INTEREST_PAID': return (gameState.stats.interestPaidCount || 0) >= condition.count
    case 'LOAN_REPAID_ONCE': return (gameState.stats.loanRepaidCount || 0) >= 1
    case 'NO_LOAN_FLOOR': return gameState.floor >= condition.floor && (!gameState.loans || gameState.loans.length === 0)
    case 'PHASE_COUNT': return (gameState.stats.phasesExperienced?.length || 0) >= condition.count
    case 'PHASE_ALL': return (gameState.stats.phasesExperienced?.length || 0) >= 5
    case 'EVENT_CHOICE_COUNT': return (gameState.stats.eventTotalCount || 0) >= condition.count
    case 'EVENT_SUCCESS_RATE_CLEAR': return !!gameState.isClear && (gameState.stats.eventSuccessCount / Math.max(gameState.stats.eventTotalCount, 1)) >= condition.rate
    case 'MET_RIVAL_COUNT': return (gameState.metRivals?.length || 0) >= condition.count
    case 'ALL_RIVALS_BANKRUPT': return (gameState.defeatedRivals?.length || 0) >= 9
    case 'RESULT_VIEW_COUNT': return (gameState.stats.resultViewCount || 0) >= condition.count
    case 'CLEAR_WITH_ADVISOR': return !!gameState.isClear && gameState.selectedAdvisor === condition.advisorId
    case 'CLEAR_GRADE': return gameState.clearGrade === condition.grade
    case 'GAME_OVER_ONCE': return gameState.isGameOver
    case 'REWARD_GRADE': return (gameState.stats.legendRewards || 0) >= 1
    case 'ABSURD_STREAK': return (gameState.stats.absurdStreak || 0) >= condition.count
    case 'CLEAR_UNDER_MINUTES': return !!gameState.isClear && (gameState.stats.playSeconds || Infinity) <= condition.minutes * 60
    case 'RETRY_CLEAR': return !!gameState.isClear && (gameState.stats.gameOverCount || 0) >= 1
    case 'PERFECT_CLEAR': return !!gameState.isClear && gameState.clearGrade === 'S' && gameState.creditScore >= 100 && gameState.health >= gameState.maxHealth
    case 'RIVAL_DEX_COMPLETE': return (gameState.metRivals?.length || 0) >= 9
    case 'DICTIONARY_VIEW_COUNT': return (gameState.stats.dictionaryViewCount || 0) >= condition.count
    case 'DICTIONARY_ALL': return !!gameState.stats.dictionaryAllViewed
    case 'ECONOMY_BRONZE_ALL': return ACHIEVEMENTS
      .filter(achievement => achievement.category === 'ECONOMY' && achievement.grade === 'BRONZE')
      .every(achievement => gameState.unlockedAchievements.includes(achievement.id))
    case 'HEALTH_RECOVER_FROM_LOW': return (gameState.stats.healthRecoverFromLow || 0) >= 1
    case 'BANKRUPTCY_RECOVER': return (gameState.stats.bankruptcyRecover || 0) >= 1
    case 'NO_HEALTH_LOSS_FLOOR': return gameState.floor >= condition.floor && (gameState.stats.healthLossCount || 0) === 0
    case 'PRICE_SHARE_UP_ONCE': return (gameState.stats.priceShareUp || 0) >= 1
    case 'PRICE_SHARE_UP_5PCT': return (gameState.stats.priceShareUp5pct || 0) >= condition.count
    case 'PRICE_FIRST_RECESSION': return gameState.econPhase === 'recession' && (result?.shareAfter || 0) > 0.5
    case 'SHARE_OVER_SUSTAINED': return (gameState.stats.shareOverSustained || 0) >= condition.count
    case 'CONSUMER_GROUP_COUNT': return (gameState.stats.consumerGroupCount || 0) >= condition.count
    case 'CONSUMER_GROUP_ALL': return (gameState.stats.consumerGroupCount || 0) >= 4
    case 'PHASE_STRATEGY_ADAPT': return (gameState.stats.phaseStrategyAdapt || 0) >= condition.count
    case 'PHASE_PREDICT': return gameState.selectedAdvisor === condition.advisorId && (gameState.stats.phasePredictCount || 0) >= condition.count
    case 'GAMBLE_FAIL_SAFE_RECOVER': return (gameState.stats.gambleFailSafeRecover || 0) >= condition.count
    case 'CLUTCH_CLEAR': return !!gameState.isClear && gameState.health <= 1 && gameState.bankruptcyTurns >= 3
    default: return false
  }
}

export async function saveAchievements(userId, achievementIds) {
  if (!userId || !achievementIds.length) return
  if (!supabase) return { success: false, error: '서버 연결 없음 (게스트 모드)' }

  try {
    const { data } = await supabase
      .from('player_accounts')
      .select('achievements')
      .eq('id', userId)
      .single()

    const current = data?.achievements || []
    const merged = [...new Set([...current, ...achievementIds])]

    await supabase
      .from('player_accounts')
      .update({ achievements: merged })
      .eq('id', userId)

    return { success: true }
  } catch (err) {
    console.error('업적 저장 실패:', err)
    return { success: false, error: err?.message || '업적 저장 실패' }
  }
}

export function getEducationProgress(unlockedAchievements) {
  const eduAchievements = ACHIEVEMENTS.filter(achievement => achievement.category === 'ECONOMY')
  const unlocked = eduAchievements.filter(achievement => unlockedAchievements.includes(achievement.id))
  const byCategory = {}

  eduAchievements.forEach(achievement => {
    if (!byCategory[achievement.educationLink]) {
      byCategory[achievement.educationLink] = {
        total: 0,
        unlocked: 0,
        code: achievement.educationCode,
      }
    }

    byCategory[achievement.educationLink].total += 1
    if (unlockedAchievements.includes(achievement.id)) {
      byCategory[achievement.educationLink].unlocked += 1
    }
  })

  return {
    total: eduAchievements.length,
    unlocked: unlocked.length,
    percentage: Math.floor((unlocked.length / eduAchievements.length) * 100),
    byCategory,
  }
}
