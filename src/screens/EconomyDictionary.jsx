import { useState } from 'react'
import { useGameStore } from '../store/useGameStore'
import { checkAchievements } from '../logic/achievementEngine'
import { playSFX } from '../logic/audioEngine'

const DICTIONARY_TERMS = [
  { id: 'demand', category: '수요/공급', term: '수요', definition: '소비자가 특정 가격에 상품을 구매하려는 의사와 능력. 가격이 오르면 수요량은 감소한다.' },
  { id: 'supply', category: '수요/공급', term: '공급', definition: '생산자가 특정 가격에 상품을 판매하려는 의사와 능력. 가격이 오르면 공급량은 증가한다.' },
  { id: 'demand_curve', category: '수요/공급', term: '수요곡선', definition: '가격과 수요량의 관계를 나타낸 곡선. 일반적으로 우하향한다.' },
  { id: 'supply_curve', category: '수요/공급', term: '공급곡선', definition: '가격과 공급량의 관계를 나타낸 곡선. 일반적으로 우상향한다.' },
  { id: 'equilibrium', category: '수요/공급', term: '균형가격', definition: '수요량과 공급량이 일치하는 가격. 시장에서 자연스럽게 형성된다.' },
  { id: 'excess_demand', category: '수요/공급', term: '초과수요', definition: '현재 가격에서 수요량이 공급량보다 많은 상태. 가격 상승 압력이 생긴다.' },
  { id: 'excess_supply', category: '수요/공급', term: '초과공급', definition: '현재 가격에서 공급량이 수요량보다 많은 상태. 가격 하락 압력이 생긴다.' },
  { id: 'elasticity', category: '수요/공급', term: '탄력성', definition: '가격 변화에 수요량이 얼마나 민감하게 반응하는지를 나타내는 지표.' },
  { id: 'inferior_good', category: '수요/공급', term: '열등재', definition: '소득이 증가하면 수요가 오히려 줄어드는 재화. 라면, 저가 의류 등.' },
  { id: 'normal_good', category: '수요/공급', term: '정상재', definition: '소득이 증가하면 수요도 함께 증가하는 재화. 대부분의 일반 소비재.' },
  { id: 'luxury_good', category: '수요/공급', term: '사치재', definition: '소득 증가 시 수요가 비례 이상으로 증가하는 재화. 명품, 고급 전자기기 등.' },
  { id: 'substitute', category: '수요/공급', term: '대체재', definition: '서로 대신할 수 있는 재화. 한 재화의 가격이 오르면 대체재 수요가 증가한다.' },
  { id: 'complement', category: '수요/공급', term: '보완재', definition: '함께 소비되는 재화. 한 재화의 가격이 오르면 보완재 수요도 감소한다.' },
  { id: 'market_share', category: '시장', term: '시장점유율', definition: '전체 시장에서 한 기업의 매출이 차지하는 비율. 경쟁 우위를 나타내는 핵심 지표.' },
  { id: 'monopoly', category: '시장', term: '독점', definition: '하나의 기업이 시장 전체를 지배하는 상태. 가격 결정력이 크지만 소비자 후생은 낮아진다.' },
  { id: 'oligopoly', category: '시장', term: '과점', definition: '소수의 기업이 시장을 지배하는 상태. 기업 간 전략적 상호작용이 중요하다.' },
  { id: 'perfect_competition', category: '시장', term: '완전경쟁', definition: '다수의 기업이 동일한 상품을 판매하며 가격 결정력이 없는 시장.' },
  { id: 'brand_power', category: '시장', term: '브랜드 파워', definition: '소비자가 특정 브랜드에 갖는 신뢰와 선호도. 가격 프리미엄을 가능하게 한다.' },
  { id: 'price_competition', category: '시장', term: '가격경쟁', definition: '기업들이 가격을 낮춰 점유율을 확보하려는 경쟁. 과도하면 수익성이 악화된다.' },
  { id: 'market_entry', category: '시장', term: '시장진입', definition: '새로운 기업이 특정 시장에 참여하는 것. 진입장벽이 높을수록 어렵다.' },
  { id: 'consumer_surplus', category: '시장', term: '소비자잉여', definition: '소비자가 지불할 용의가 있는 가격과 실제 지불 가격의 차이.' },
  { id: 'producer_surplus', category: '시장', term: '생산자잉여', definition: '생산자가 받은 가격과 생산 비용의 차이. 기업의 이익과 유사한 개념.' },
  { id: 'market_failure', category: '시장', term: '시장실패', definition: '시장 메커니즘이 효율적인 자원 배분에 실패하는 상황.' },
  { id: 'capital', category: '재무', term: '자본', definition: '기업이 보유한 총 자산에서 부채를 뺀 순자산. 사업 지속의 핵심 기반.' },
  { id: 'revenue', category: '재무', term: '매출', definition: '상품 판매로 얻은 총 수입. 판매량 × 판매가격.' },
  { id: 'profit', category: '재무', term: '순이익', definition: '매출에서 모든 비용(원가, 운영비, 이자 등)을 뺀 최종 이익.' },
  { id: 'margin', category: '재무', term: '마진', definition: '판매가격에서 원가를 뺀 단위당 이익. 마진이 높을수록 수익성이 좋다.' },
  { id: 'break_even', category: '재무', term: '손익분기점', definition: '총수입과 총비용이 같아지는 판매량. 이 이상 팔아야 이익이 난다.' },
  { id: 'fixed_cost', category: '재무', term: '고정비', definition: '생산량과 무관하게 일정하게 발생하는 비용. 임대료, 인건비 등.' },
  { id: 'variable_cost', category: '재무', term: '변동비', definition: '생산량에 따라 변하는 비용. 원재료비, 포장비 등.' },
  { id: 'operating_cost', category: '재무', term: '운영비', definition: '사업을 유지하기 위해 매달 지출되는 고정 비용.' },
  { id: 'interest_rate', category: '재무', term: '이자율', definition: '빌린 돈에 대해 지불하는 비용의 비율. 신용등급이 높을수록 낮은 이자율이 적용된다.' },
  { id: 'credit_score', category: '재무', term: '신용등급', definition: '채무 상환 능력을 나타내는 등급. A~D로 구분되며 대출 조건에 직접 영향을 준다.' },
  { id: 'debt', category: '재무', term: '부채', definition: '외부에서 빌린 돈. 원금과 이자를 만기에 상환해야 한다.' },
  { id: 'cash_flow', category: '재무', term: '현금흐름', definition: '일정 기간 동안 유입·유출되는 현금의 흐름. 흑자여도 현금흐름이 나쁘면 파산할 수 있다.' },
  { id: 'bankruptcy', category: '재무', term: '파산', definition: '부채를 갚을 수 없는 상태. 자본이 장기간 마이너스를 유지하면 발생한다.' },
  { id: 'roi', category: '재무', term: '투자수익률(ROI)', definition: '투자한 비용 대비 얻은 이익의 비율. (순이익 / 투자비용) × 100.' },
  { id: 'depreciation', category: '재무', term: '감가상각', definition: '설비·기계 등 자산의 가치가 시간이 지남에 따라 줄어드는 것.' },
  { id: 'business_cycle', category: '경기', term: '경기순환', definition: '경제활동이 호황과 불황을 반복하는 현상. 호황→성장→평시→위축→불황 순으로 순환한다.' },
  { id: 'boom', category: '경기', term: '호황', definition: '경제활동이 활발하고 소비가 폭발적으로 증가하는 시기. 고가 상품이 잘 팔린다.' },
  { id: 'recession', category: '경기', term: '불황', definition: '경제활동이 침체되고 소비가 급감하는 시기. 필수재 중심으로 수요가 이동한다.' },
  { id: 'inflation', category: '경기', term: '인플레이션', definition: '물가가 지속적으로 오르는 현상. 원가 상승으로 기업 수익성에 영향을 준다.' },
  { id: 'deflation', category: '경기', term: '디플레이션', definition: '물가가 지속적으로 내리는 현상. 소비 위축과 기업 매출 감소로 이어질 수 있다.' },
  { id: 'gdp', category: '경기', term: 'GDP', definition: '국내총생산. 한 나라 안에서 일정 기간 생산된 모든 재화·서비스의 시장 가치 합계.' },
  { id: 'monetary_policy', category: '경기', term: '통화정책', definition: '중앙은행이 이자율과 통화량을 조절해 경기를 안정시키는 정책.' },
  { id: 'fiscal_policy', category: '경기', term: '재정정책', definition: '정부가 세금과 지출을 조절해 경기를 조절하는 정책.' },
  { id: 'interest_rate_policy', category: '경기', term: '금리정책', definition: '중앙은행이 기준금리를 올리거나 내려 경기를 조절하는 정책. 금리 인상 시 소비·투자 감소.' },
  { id: 'stagflation', category: '경기', term: '스태그플레이션', definition: '경기침체와 인플레이션이 동시에 발생하는 최악의 경기 상황.' },
  { id: 'black_swan', category: '경기', term: '블랙스완', definition: '예측 불가능하지만 발생 시 엄청난 충격을 주는 사건. 금융위기, 팬데믹 등.' },
  { id: 'markov', category: '경기', term: '마르코프 연쇄', definition: '현재 상태만으로 다음 상태가 결정되는 확률 모델. 경기 국면 전환 예측에 활용된다.' },
]

const CATEGORIES = ['전체', '수요/공급', '시장', '재무', '경기']

export default function EconomyDictionary() {
  const setCurrentScreen = useGameStore(state => state.setCurrentScreen)
  const setIsPaused = useGameStore(state => state.setIsPaused)
  const setNewAchievements = useGameStore(state => state.setNewAchievements)
  const addAchievement = useGameStore(state => state.addAchievement)
  const storedViewedTerms = useGameStore(state => state.stats?.dictionaryViewedTerms || [])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('전체')
  const [viewedTerms, setViewedTerms] = useState(storedViewedTerms)
  const [openTerm, setOpenTerm] = useState(null)

  const filteredTerms = DICTIONARY_TERMS.filter(term => {
    const matchCategory = selectedCategory === '전체' || term.category === selectedCategory
    const matchSearch = searchQuery === ''
      || term.term.includes(searchQuery)
      || term.definition.includes(searchQuery)
    return matchCategory && matchSearch
  })

  const handleClose = () => {
    playSFX('click')
    setIsPaused(false)
    setCurrentScreen('main')
  }

  const handleTermClick = (termId) => {
    playSFX('click')

    if (!viewedTerms.includes(termId)) {
      const nextViewedTerms = [...viewedTerms, termId]
      const newCount = nextViewedTerms.length
      setViewedTerms(nextViewedTerms)
      useGameStore.getState().updateDictionaryCount(
        newCount,
        newCount >= DICTIONARY_TERMS.length,
        nextViewedTerms,
      )

      const currentState = useGameStore.getState()
      const newlyUnlocked = checkAchievements(currentState, null)
      if (newlyUnlocked.length > 0) {
        addAchievement(newlyUnlocked)
        setNewAchievements(newlyUnlocked)
      }
    }

    setOpenTerm(openTerm === termId ? null : termId)
  }

  return (
    <div style={{
      width: '1080px',
      height: '720px',
      background: 'var(--cr2-bg)',
      color: 'var(--cr2-white)',
      fontFamily: "'Press Start 2P', 'Noto Sans KR', monospace",
      display: 'flex',
      flexDirection: 'column',
      padding: '24px',
      boxSizing: 'border-box',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '2px solid var(--cr2-green)',
        paddingBottom: '12px',
      }}>
        <div style={{ fontSize: '20px', color: 'var(--cr2-lime)' }}>
          경제용어 사전
        </div>
        <button
          className="cr2-btn"
          style={{
            width: '36px',
            height: '36px',
            padding: 0,
            borderColor: 'var(--cr2-red)',
            color: 'var(--cr2-red)',
          }}
          onClick={handleClose}
          aria-label="닫기"
        >
          X
        </button>
      </div>

      <div style={{
        display: 'flex',
        gap: '8px',
        marginTop: '16px',
        marginBottom: '14px',
      }}>
        {CATEGORIES.map(category => (
          <button
            key={category}
            className="cr2-btn cr2-btn-small"
            onClick={() => {
              playSFX('click')
              setSelectedCategory(category)
            }}
            style={{
              borderColor: selectedCategory === category ? 'var(--cr2-lime)' : 'var(--cr2-green)',
              color: selectedCategory === category ? 'var(--cr2-lime)' : 'var(--cr2-gray)',
              background: selectedCategory === category ? 'rgba(0,255,65,0.08)' : 'transparent',
            }}
          >
            {category === '수요/공급' ? '수요·공급' : category}
          </button>
        ))}
      </div>

      <div style={{
        padding: '8px 16px',
        borderBottom: '1px solid rgba(0,255,65,0.15)',
      }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value)
            setOpenTerm(null)
          }}
          placeholder="용어 또는 설명 검색..."
          style={{
            width: '100%',
            background: '#0A0A0F',
            border: '1px solid var(--cr2-lime)',
            color: 'var(--cr2-white)',
            fontSize: '11px',
            padding: '6px 10px',
            outline: 'none',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{
        fontSize: '9px',
        color: 'var(--cr2-gray)',
        marginBottom: '8px',
      }}>
        열람 {viewedTerms.length} / {DICTIONARY_TERMS.length}
      </div>

      <div style={{
        flex: 1,
        overflowY: 'auto',
        border: '1px solid rgba(0,170,0,0.4)',
        background: 'rgba(0,0,0,0.35)',
        padding: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}>
        {filteredTerms.length === 0 && (
          <div style={{
            textAlign: 'center',
            color: 'var(--cr2-gray)',
            fontSize: '11px',
            marginTop: '20px',
          }}>
            검색 결과가 없습니다.
          </div>
        )}

        {filteredTerms.map(item => {
          const isOpen = openTerm === item.id
          const isViewed = viewedTerms.includes(item.id)

          return (
            <button
              key={item.id}
              onClick={() => handleTermClick(item.id)}
              style={{
                textAlign: 'left',
                border: `1px solid ${isOpen ? 'var(--cr2-lime)' : 'rgba(0,170,0,0.35)'}`,
                background: isOpen ? 'rgba(0,255,65,0.08)' : 'rgba(0,0,0,0.45)',
                color: 'var(--cr2-white)',
                padding: '12px',
                cursor: 'pointer',
                fontFamily: "'Noto Sans KR', sans-serif",
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}>
                <span style={{
                  color: isOpen ? 'var(--cr2-lime)' : 'var(--cr2-white)',
                  fontWeight: 'bold',
                  fontSize: '14px',
                }}>
                  {item.term}
                </span>
                <span style={{
                  color: isViewed ? 'var(--cr2-gold)' : 'var(--cr2-gray)',
                  fontSize: '10px',
                }}>
                  {isViewed ? '열람' : item.category}
                </span>
              </div>

              {isOpen && (
                <div style={{
                  marginTop: '8px',
                  color: 'var(--cr2-gray)',
                  fontSize: '13px',
                  lineHeight: '1.7',
                }}>
                  {item.definition}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
