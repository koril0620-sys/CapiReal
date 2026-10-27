export const RIVAL_EVENTS = [
  {
    id: 'RE01',
    type: 'PRICE_CUT',
    title: '라이벌 가격 인하',
    description: '{rivalName}이 판매가를 크게 낮췄다.',
    minRivalTier: 'ENTRY',
    effect: {
      rivalPriceMultiplier: 0.75,
      duration: 2,
    },
  },
  {
    id: 'RE02',
    type: 'AGGRESSIVE_MARKETING',
    title: '라이벌 공격적 마케팅',
    description: '{rivalName}이 대규모 마케팅에 투자했다.',
    minRivalTier: 'ENTRY',
    effect: {
      rivalAwarenessBoost: 25,
      duration: 2,
    },
  },
  {
    id: 'RE03',
    type: 'QUALITY_UPGRADE',
    title: '라이벌 품질 업그레이드',
    description: '{rivalName}이 제품 품질을 높였다.',
    minRivalTier: 'MID',
    effect: {
      rivalQualityBoost: 5,
    },
  },
  {
    id: 'RE04',
    type: 'NEW_PRODUCT',
    title: '라이벌 신제품 출시',
    description: '{rivalName}이 신제품을 출시했다.',
    minRivalTier: 'MID',
    effect: {
      rivalAwarenessBoost: 15,
      rivalQualityBoost: 3,
      duration: 2,
    },
  },
  {
    id: 'RE05',
    type: 'COST_REDUCTION',
    title: '라이벌 원가 절감 성공',
    description: '{rivalName}이 생산 원가를 줄이는 데 성공했다.',
    minRivalTier: 'MID',
    effect: {
      rivalCostMultiplier: 0.85,
      duration: 3,
    },
  },
  {
    id: 'RE06',
    type: 'SCANDAL',
    title: '라이벌 품질 논란',
    description: '{rivalName} 제품에서 불량이 발견됐다는 소문이 퍼졌다.',
    minRivalTier: 'SENIOR',
    effect: {
      rivalBrandPenalty: -5,
      rivalAwarenessPenalty: -10,
      duration: 2,
    },
  },
  {
    id: 'RE07',
    type: 'MONOPOL_INTERVENTION',
    title: 'MONOPOL 시장 개입',
    description: 'MONOPOL이 시장에 직접 개입해 압박을 가하고 있다.',
    minRivalTier: 'CHAMPION',
    effect: {
      demandMultiplier: 0.90,
      costMultiplier: 1.05,
      duration: 2,
    },
  },
]
