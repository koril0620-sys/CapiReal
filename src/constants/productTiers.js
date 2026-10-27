export const PRODUCT_TIERS = [
  {
    id: 'tier_1',
    floorMin: 1,
    floorMax: 20,
    name: '1차 가공품',
    category: '식품/잡화',
    baseCost: 3000,
    operatingCost: 1500000,
    baseDemand: 1000,
    consumerRatio: {
      quality: 0.15,
      brand: 0.15,
      price: 0.40,
      general: 0.30,
    },
    entryMessage: '새로운 시장에 진입했습니다. 식품과 잡화를 판매합니다.',
  },
  {
    id: 'tier_2',
    floorMin: 21,
    floorMax: 40,
    name: '2차 가공품',
    category: '생활용품',
    baseCost: 8000,
    operatingCost: 2500000,
    baseDemand: 800,
    consumerRatio: {
      quality: 0.20,
      brand: 0.20,
      price: 0.35,
      general: 0.25,
    },
    entryMessage: '시장이 바뀌었습니다. 이제 생활용품을 다룹니다.',
  },
  {
    id: 'tier_3',
    floorMin: 41,
    floorMax: 60,
    name: '공산품',
    category: '전자부품',
    baseCost: 20000,
    operatingCost: 4000000,
    baseDemand: 600,
    consumerRatio: {
      quality: 0.25,
      brand: 0.25,
      price: 0.25,
      general: 0.25,
    },
    entryMessage: '전자부품 시장에 진입했습니다. 품질 경쟁이 심화됩니다.',
  },
  {
    id: 'tier_4',
    floorMin: 61,
    floorMax: 80,
    name: '내구재',
    category: '가전/기계',
    baseCost: 50000,
    operatingCost: 7000000,
    baseDemand: 400,
    consumerRatio: {
      quality: 0.30,
      brand: 0.30,
      price: 0.20,
      general: 0.20,
    },
    entryMessage: '가전/기계 시장입니다. 브랜드와 품질이 핵심입니다.',
  },
  {
    id: 'tier_5',
    floorMin: 81,
    floorMax: 100,
    name: '고급재',
    category: 'IT기기',
    baseCost: 150000,
    operatingCost: 12000000,
    baseDemand: 200,
    consumerRatio: {
      quality: 0.35,
      brand: 0.35,
      price: 0.15,
      general: 0.15,
    },
    entryMessage: 'IT기기 시장입니다. 브랜드 파워가 점유율을 결정합니다.',
  },
  {
    id: 'tier_6',
    floorMin: 101,
    floorMax: 120,
    name: '프리미엄',
    category: '첨단장비',
    baseCost: 500000,
    operatingCost: 20000000,
    baseDemand: 100,
    consumerRatio: {
      quality: 0.40,
      brand: 0.40,
      price: 0.10,
      general: 0.10,
    },
    entryMessage: '첨단장비 시장입니다. 최고의 품질과 브랜드만이 살아남습니다.',
  },
]

export function getCurrentTier(floor) {
  return PRODUCT_TIERS.find(tier => floor >= tier.floorMin && floor <= tier.floorMax)
    || PRODUCT_TIERS[0]
}

export function isNewTier(prevFloor, currentFloor) {
  const prev = getCurrentTier(prevFloor)
  const current = getCurrentTier(currentFloor)
  return prev.id !== current.id
}
