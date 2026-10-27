export const MARKOV_MATRIX = {
  boom: { boom: 0.40, growth: 0.60, stable: 0.00, contraction: 0.00, recession: 0.00 },
  growth: { boom: 0.20, growth: 0.40, stable: 0.40, contraction: 0.00, recession: 0.00 },
  stable: { boom: 0.00, growth: 0.30, stable: 0.40, contraction: 0.30, recession: 0.00 },
  contraction: { boom: 0.00, growth: 0.00, stable: 0.40, contraction: 0.40, recession: 0.20 },
  recession: { boom: 0.00, growth: 0.00, stable: 0.00, contraction: 0.60, recession: 0.40 },
}

export const ECO_PHASES = {
  boom: {
    label: '호황',
    demandMultiplier: 1.4,
    consumerRatio: { quality: 0.35, brand: 0.30, price: 0.15, general: 0.20 },
  },
  growth: {
    label: '성장',
    demandMultiplier: 1.2,
    consumerRatio: { quality: 0.25, brand: 0.25, price: 0.25, general: 0.25 },
  },
  stable: {
    label: '안정',
    demandMultiplier: 1.0,
    consumerRatio: { quality: 0.20, brand: 0.20, price: 0.30, general: 0.30 },
  },
  contraction: {
    label: '위축',
    demandMultiplier: 0.8,
    consumerRatio: { quality: 0.15, brand: 0.15, price: 0.40, general: 0.30 },
  },
  recession: {
    label: '불황',
    demandMultiplier: 0.6,
    consumerRatio: { quality: 0.10, brand: 0.10, price: 0.50, general: 0.30 },
  },
}

export const FORCE_PHASE_EVENTS = {
  E11: 'recession',
  E04: 'contraction',
  E14: 'contraction',
  E13: 'contraction',
  E20: 'growth',
  E12: 'stable',
  E05: 'growth',
}

export const FIXED_EVENT_FLOORS = [20, 40, 70, 100, 115]

export const BASE_DEMAND = 1000

export const OPERATING_COSTS = {
  rent: 500000,
  labor: 800000,
  misc: 200000,
}

export { getCurrentTier, PRODUCT_TIERS } from './productTiers'
