export const INTERNAL_EVENTS = [
  {
    id: 'I01',
    title: '생산라인 사고',
    category: 'PRODUCTION',
    description: '공장 생산라인에서 사고가 발생했다.',
    choices: [
      {
        id: 'A',
        label: '즉시 수리',
        type: 'SAFE',
        outcome: { capitalChange: '-SM', qualityChange: 0 },
      },
      {
        id: 'B',
        label: '부분 수리 + 인력 재배치',
        type: 'NORMAL',
        outcome: [
          { prob: 0.70, result: { capitalChange: '-MD', qualityChange: 2 } },
          { prob: 0.30, result: { capitalChange: '-MD', qualityChange: -1 } },
        ],
      },
      {
        id: 'C',
        label: '그냥 무시',
        type: 'GAMBLE',
        outcome: [
          { prob: 0.30, result: { capitalChange: 0, brandChange: -2 } },
          { prob: 0.70, result: { capitalChange: '-LG', brandChange: -4, creditChange: -3 } },
        ],
      },
    ],
  },
  {
    id: 'I02',
    title: '핵심 직원 이직 요구',
    category: 'HR',
    description: '핵심 개발 인력이 연봉 인상을 요구하며 이직을 암시했다.',
    choices: [
      {
        id: 'A',
        label: '연봉 인상 수용',
        type: 'SAFE',
        outcome: { capitalChange: '-MD', qualityChange: 3, brandChange: 1 },
      },
      {
        id: 'B',
        label: '협상',
        type: 'NORMAL',
        outcome: [
          { prob: 0.70, result: { capitalChange: '-SM', qualityChange: 1 } },
          { prob: 0.30, result: { capitalChange: 0, qualityChange: -2, brandChange: -1 } },
        ],
      },
      {
        id: 'C',
        label: '거절',
        type: 'GAMBLE',
        outcome: [
          { prob: 0.30, result: { capitalChange: 0, qualityChange: 0 } },
          { prob: 0.70, result: { qualityChange: -3, brandChange: -2, creditChange: -2 } },
        ],
      },
    ],
  },
  {
    id: 'I03',
    title: '대규모 마케팅 제안',
    category: 'MARKETING',
    description: '유명 인플루언서가 콜라보 마케팅을 제안했다.',
    choices: [
      {
        id: 'A',
        label: '거절',
        type: 'SAFE',
        outcome: { capitalChange: 0 },
      },
      {
        id: 'B',
        label: '중간 규모로 진행',
        type: 'NORMAL',
        outcome: [
          { prob: 0.70, result: { capitalChange: '-MD', awarenessChange: 15, brandChange: 1 } },
          { prob: 0.30, result: { capitalChange: '-MD', awarenessChange: 3 } },
        ],
      },
      {
        id: 'C',
        label: '전면 투자',
        type: 'GAMBLE',
        outcome: [
          { prob: 0.40, result: { capitalChange: '-LG', awarenessChange: 30, brandChange: 3 } },
          { prob: 0.60, result: { capitalChange: '-LG', awarenessChange: 5, brandChange: -1 } },
        ],
      },
    ],
  },
  {
    id: 'I04',
    title: '정부 보조금 신청',
    category: 'FINANCE',
    description: '중소기업 지원 보조금 신청 기간이 열렸다.',
    choices: [
      {
        id: 'A',
        label: '신청 안 함',
        type: 'SAFE',
        outcome: { capitalChange: 0 },
      },
      {
        id: 'B',
        label: '신청',
        type: 'NORMAL',
        outcome: [
          { prob: 0.70, result: { capitalChange: '+MD', creditChange: 3 } },
          { prob: 0.30, result: { capitalChange: 0, creditChange: -1 } },
        ],
      },
      {
        id: 'C',
        label: '허위 서류로 신청',
        type: 'ABSURD',
        outcome: [
          { prob: 0.20, result: { capitalChange: '+LG', creditChange: 5 } },
          { prob: 0.40, result: { capitalChange: 0 } },
          { prob: 0.40, result: { capitalChange: '-LG', creditChange: -15, healthChange: -2 } },
        ],
      },
    ],
  },
  {
    id: 'I05',
    title: '경쟁사 특허 침해 경고',
    category: 'LEGAL',
    description: '경쟁사로부터 특허 침해 경고장을 받았다.',
    choices: [
      {
        id: 'A',
        label: '합의금 지불',
        type: 'SAFE',
        outcome: { capitalChange: '-MD', creditChange: 2 },
      },
      {
        id: 'B',
        label: '법적 대응',
        type: 'NORMAL',
        outcome: [
          { prob: 0.60, result: { capitalChange: '-SM', creditChange: 5 } },
          { prob: 0.40, result: { capitalChange: '-LG', creditChange: -5, healthChange: -1 } },
        ],
      },
      {
        id: 'C',
        label: '무시',
        type: 'GAMBLE',
        outcome: [
          { prob: 0.30, result: { capitalChange: 0 } },
          { prob: 0.70, result: { capitalChange: '-LG', creditChange: -8, brandChange: -3, healthChange: -1 } },
        ],
      },
    ],
  },
  {
    id: 'I06',
    title: '신규 유통 채널 제안',
    category: 'MARKETING',
    description: '대형 유통업체가 입점 제안을 해왔다.',
    choices: [
      {
        id: 'A',
        label: '거절',
        type: 'SAFE',
        outcome: { capitalChange: 0 },
      },
      {
        id: 'B',
        label: '입점 계약',
        type: 'NORMAL',
        outcome: [
          { prob: 0.70, result: { capitalChange: '-SM', awarenessChange: 20, orderCapChange: 200 } },
          { prob: 0.30, result: { capitalChange: '-SM', awarenessChange: 5 } },
        ],
      },
    ],
  },
  {
    id: 'I07',
    title: '공장 자동화 투자 기회',
    category: 'PRODUCTION',
    description: '자동화 설비 업체가 할인 패키지를 제안했다.',
    choices: [
      {
        id: 'A',
        label: '패스',
        type: 'SAFE',
        outcome: { capitalChange: 0 },
      },
      {
        id: 'B',
        label: '투자',
        type: 'NORMAL',
        outcome: [
          { prob: 0.70, result: { capitalChange: '-LG', costReduction: 0.05, orderCapChange: 300 } },
          { prob: 0.30, result: { capitalChange: '-LG', costReduction: 0.01 } },
        ],
      },
    ],
  },
  {
    id: 'I08',
    title: '품질 불량 리콜 위기',
    category: 'PRODUCTION',
    description: '일부 제품에서 품질 불량이 발견됐다는 소비자 민원이 접수됐다.',
    choices: [
      {
        id: 'A',
        label: '자발적 리콜',
        type: 'SAFE',
        outcome: { capitalChange: '-MD', brandChange: 2, qualityChange: 1 },
      },
      {
        id: 'B',
        label: '조용히 처리',
        type: 'NORMAL',
        outcome: [
          { prob: 0.60, result: { capitalChange: '-SM', brandChange: 0 } },
          { prob: 0.40, result: { capitalChange: '-LG', brandChange: -5, creditChange: -5, healthChange: -1 } },
        ],
      },
      {
        id: 'C',
        label: '무시',
        type: 'GAMBLE',
        outcome: [
          { prob: 0.20, result: { capitalChange: 0 } },
          { prob: 0.80, result: { capitalChange: '-LG', brandChange: -8, creditChange: -8, healthChange: -2 } },
        ],
      },
    ],
  },
]

export const CASH_CONSTANTS = {
  '+SM': (capital) => Math.floor(capital * 0.05),
  '+MD': (capital) => Math.floor(capital * 0.10),
  '+LG': (capital) => Math.floor(capital * 0.20),
  '-SM': (capital) => -Math.floor(capital * 0.05),
  '-MD': (capital) => -Math.floor(capital * 0.10),
  '-LG': (capital) => -Math.floor(capital * 0.20),
}
