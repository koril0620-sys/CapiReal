import { useState } from 'react'
import { useGameStore } from '../store/useGameStore'
import { getMaxOrderAmount, getQualityMultipliers, getCostEffectMultiplier } from '../logic/settlementEngine'
import { getMarketingLimit, updateAwareness } from '../logic/brandQualityEngine'
import { getSuccessRate, QUALITY_UPGRADE, COST_REDUCTION } from '../logic/factoryEngine'
import { getGrade, getLoanLimit, getInterestRate } from '../logic/creditEngine'
import { takeLoan, repayLoan, extendLoan, getAvailableLoanAmount, FORCED_REPAYMENT_TURNS } from '../logic/loanEngine'
import { getCurrentStage, MONOPOL_STAGES } from '../constants/monopol'
import { calcTurnsToRivalBankrupt } from '../logic/monopolEngine'
import { RIVALS } from '../constants/rivals'
import {
  getActiveMarkets,
  getPrimaryMarket,
  getTierById,
  getMarketUnitCost,
  getMarketOperatingCost,
  TIER_ICONS,
  TIER_SHORT_NAMES,
} from '../constants/markets'
import { getConsumerRatio, CONSUMER_GROUP_LABELS } from '../logic/marketEngine'
import { MarketChips, MarketOverview, OVERVIEW_ID } from './MarketTabs'
import { LOAN_TYPES } from '../constants/creditScore'
import { playSFX } from '../logic/audioEngine'

export default function RightPanel({ activeTab, onSettle }) {
  const gameState = useGameStore(state => state)
  const setCurrentStrategy = useGameStore(state => state.setCurrentStrategy)
  const setMarketStrategy = useGameStore(state => state.setMarketStrategy)
  const setSelectedMarket = useGameStore(state => state.setSelectedMarket)
  const setFactoryAction = useGameStore(state => state.setFactoryAction)
  const [showOverview, setShowOverview] = useState(false)

  const activeMarkets = getActiveMarkets(gameState)
  const market = activeMarkets.find(item => item.tierId === gameState.selectedMarketId)
    || getPrimaryMarket(gameState)
    || activeMarkets[0]

  const handleChip = (id) => {
    if (id === OVERVIEW_ID) {
      setShowOverview(true)
      return
    }
    setShowOverview(false)
    setSelectedMarket(id)
  }

  return (
    <div className="cr2-right-panel">
      {activeTab === 'rival' && (
        <RivalTab gameState={gameState} />
      )}
      {activeTab === 'sale' && market && (
        <div className="cr2-sale-wrap">
          <MarketChips value={showOverview ? OVERVIEW_ID : market.tierId} onChange={handleChip} />
          {showOverview && activeMarkets.length > 1 ? (
            <MarketOverview onOpenMarket={id => handleChip(id)} />
          ) : (
            <SaleTab
              key={market.tierId}
              gameState={gameState}
              market={market}
              setCurrentStrategy={strategy => setMarketStrategy(market.tierId, strategy)}
            />
          )}
        </div>
      )}
      {activeTab === 'operation' && (
        <OperationTab
          gameState={gameState}
          setCurrentStrategy={setCurrentStrategy}
          setFactoryAction={setFactoryAction}
        />
      )}
      {activeTab === 'next' && (
        <NextTab
          gameState={gameState}
          onSettle={onSettle}
        />
      )}
    </div>
  )
}

function SaleTab({ gameState, market, setCurrentStrategy }) {
  const currentStrategy = market.strategy || {}
  const marketTier = getTierById(market.tierId)
  const marketUnitCost = getMarketUnitCost(gameState, market)
  const isPrimaryMarket = getPrimaryMarket(gameState)?.tierId === market.tierId
  const initialPriceKey = currentStrategy.priceKey || currentStrategy.priceMultiplier || null
  const initialQuality = currentStrategy.qualityMode || currentStrategy.qualityAction || 'maintain'
  const currentQuality = gameState.quality || 8
  const [selectedPrice, setSelectedPrice] = useState(initialPriceKey)
  const [selectedOrder, setSelectedOrder] = useState(currentStrategy.orderAmount || 0)
  const [selectedOrderKey, setSelectedOrderKey] = useState(currentStrategy.orderKey || null)
  const [selectedQuality, setSelectedQuality] = useState(initialQuality)
  const [customPrice, setCustomPrice] = useState(
    (!initialPriceKey || initialPriceKey === 'custom') && currentStrategy.price
      ? String(currentStrategy.price)
      : '',
  )
  const [customOrder, setCustomOrder] = useState(
    currentStrategy.orderKey === 'custom' && currentStrategy.orderAmount
      ? String(currentStrategy.orderAmount)
      : '',
  )
  const [qualCustomVal, setQualCustomVal] = useState(
    initialQuality === 'custom' && currentStrategy.qualityMultiplier
      ? String(Math.floor(currentQuality * currentStrategy.qualityMultiplier))
      : '',
  )

  const [priceError, setPriceError] = useState('')
  const [orderError, setOrderError] = useState('')
  const [qualError, setQualError] = useState('')

  const cost = marketUnitCost
  const getEffectiveCost = () => {
    const base = marketUnitCost
    if (selectedQuality === 'reduce') return Math.floor(base * 0.8)
    if (selectedQuality === 'upgrade') return Math.floor(base * 1.25)
    if (selectedQuality === 'custom' && qualCustomVal) {
      const inputQual = parseInt(qualCustomVal, 10)
      if (!Number.isNaN(inputQual) && currentQuality > 0) {
        const multiplier = inputQual / currentQuality
        return Math.floor(base * multiplier)
      }
    }
    return base
  }
  const getEffectiveQuality = () => {
    const quality = gameState.quality || 8
    if (selectedQuality === 'reduce') return Math.floor(quality * 0.8)
    if (selectedQuality === 'upgrade') return Math.floor(quality * 1.2)
    if (selectedQuality === 'custom' && qualCustomVal) {
      const inputQual = parseInt(qualCustomVal, 10)
      if (!Number.isNaN(inputQual)) return inputQual
    }
    return quality
  }
  const effectiveCost = getEffectiveCost()
  // 자본은 모든 시장이 같이 쓴다: 다른 시장 발주비와 마케팅비를 뺀 만큼만 발주 가능
  const otherCommitted = getActiveMarkets(gameState)
    .filter(item => item.tierId !== market.tierId)
    .reduce((sum, item) => sum + (item.strategy?.orderAmount || 0) * getMarketUnitCost(gameState, item), 0)
  const availableCapital = Math.max(gameState.capital - otherCommitted - (gameState.currentStrategy?.marketingBudget || 0), 0)
  const maxOrder = getMaxOrderAmount(availableCapital, effectiveCost, gameState.orderCap)
  const marketRivals = market.rivals || []
  const rivalPrice = marketRivals.length > 0 ? Math.min(...marketRivals.map(rival => rival.price || Infinity)) : null
  const rivalInfos = (() => {
    if (marketRivals.length > 0) {
      return marketRivals.map((rival, index) => {
        const rivalRecord = typeof rival === 'string' ? { id: rival } : rival || {}
        const rivalId = rivalRecord.id || rivalRecord.rival || rivalRecord.rivalId
        const rivalData = RIVALS.find(entry => entry.id === rivalId)
        return {
          key: rivalId || `rival-${index}`,
          name: rivalRecord.rivalName || rivalRecord.name || rivalData?.name || `라이벌 ${index + 1}`,
          company: rivalRecord.company || rivalData?.company || '',
          price: rivalRecord.price || rivalRecord.rivalPrice || rivalPrice || 10000,
          quality: rivalRecord.quality ?? rivalRecord.stats?.quality ?? rivalData?.stats?.quality ?? '?',
          tier: rivalRecord.tier || rivalData?.tier || '',
        }
      })
    }
    return []
  })()

  // 손익분기: 이 시장의 운영비 (+ 주력 시장이면 월 이자)
  const fixedCost = getMarketOperatingCost(gameState, market) + (isPrimaryMarket ? 1 : 0) * (gameState.loans || []).reduce(
    (sum, loan) => sum + Math.floor(loan.principal * (loan.interestRate || 0.065) / 12),
    0,
  )

  const getBreakeven = (price) => {
    const margin = price - effectiveCost
    return margin > 0 ? Math.ceil(fixedCost / margin) : null
  }

  const getRivalDiff = (price) => {
    if (!rivalPrice) return null
    return (((price - rivalPrice) / rivalPrice) * 100).toFixed(1)
  }

  const validatePrice = (raw) => {
    if (raw === '') return ''
    const val = parseInt(raw, 10)
    if (isNaN(val)) return '숫자만 입력하세요.'
    if (val <= 0) return '0원보다 커야 합니다.'
    if (val < effectiveCost) return `원가(${effectiveCost.toLocaleString()}원)보다 낮으면 적자입니다.`
    if (val > effectiveCost * 10) return `원가의 10배(${(effectiveCost * 10).toLocaleString()}원) 이하로 입력하세요.`
    return ''
  }

  const validateOrder = (raw) => {
    if (raw === '') return ''
    const val = parseInt(raw, 10)
    if (isNaN(val)) return '숫자만 입력하세요.'
    if (val <= 0) return '1개 이상 입력하세요.'
    if (val > maxOrder) return `최대 발주 가능 수량은 ${maxOrder.toLocaleString()}개입니다.`
    return ''
  }

  const validateQual = (raw, baseQuality) => {
    if (raw === '') return ''
    const val = parseInt(raw, 10)
    if (isNaN(val)) return '숫자만 입력하세요.'
    const minQual = Math.max(1, Math.floor(baseQuality * 0.5))
    const maxQual = baseQuality
    if (val < minQual) return `최소 ${minQual} 이상 입력하세요.`
    if (val > maxQual) return `최대 ${maxQual} 이하 입력하세요.`
    return ''
  }

  const priceOpts = [
    { key: 'x13', label: '×1.3', price: Math.floor(effectiveCost * 1.3) },
    { key: 'x2',  label: '×2',   price: Math.floor(effectiveCost * 2)   },
    { key: 'x3',  label: '×3',   price: Math.floor(effectiveCost * 3)   },
    { key: 'x4',  label: '×4',   price: Math.floor(effectiveCost * 4)   },
  ]

  const lastShare = (market.shareHistory || []).slice(-1)[0] ?? 0.5
  const myDemand = Math.floor((market.lastDemand || marketTier.baseDemand) * lastShare)

  const orderOpts = [
    { key: 'con', label: '보수적', amount: Math.floor(myDemand * 0.7) },
    { key: 'std', label: '표준',   amount: myDemand                    },
    { key: 'agg', label: '공격적', amount: Math.floor(myDemand * 1.3) },
    { key: 'max', label: '자본MAX', amount: maxOrder                   },
  ]
  const isOrderOptionDisabled = amount => amount <= 0 || amount > maxOrder

  const qualOpts = [
    {
      key: 'reduce',
      label: '절감',
      cost: Math.floor(cost * 0.8),
      color: 'var(--cr2-lime)',
      qualityDisplay: `품질: ${Math.floor(currentQuality * 0.8)}`,
    },
    {
      key: 'maintain',
      label: '유지',
      cost,
      color: 'var(--cr2-white)',
      qualityDisplay: `품질: ${currentQuality}`,
    },
    {
      key: 'upgrade',
      label: '고급',
      cost: Math.floor(cost * 1.25),
      color: 'var(--cr2-red)',
      qualityDisplay: `품질: ${Math.floor(currentQuality * 1.2)}`,
    },
  ]

  const handlePrice = (price, key) => {
    setSelectedPrice(key)
    setCustomPrice('')
    setPriceError('')
    setCurrentStrategy({ price, priceKey: key, priceMultiplier: key })
    playSFX('click')
  }

  const handleOrder = (amount, key) => {
    if (isOrderOptionDisabled(amount)) return
    setSelectedOrder(amount)
    setSelectedOrderKey(key)
    setCustomOrder('')
    setOrderError('')
    setCurrentStrategy({ orderAmount: amount, orderKey: key })
    playSFX('click')
  }

  const handleQuality = (key) => {
    setSelectedQuality(key)
    setQualCustomVal('')
    setQualError('')
    setCurrentStrategy({ qualityMode: key, qualityAction: key })
    playSFX('click')
  }

  const currentPrice = selectedPrice
    ? priceOpts.find(option => option.key === selectedPrice)?.price
      || parseInt(customPrice, 10)
    : null

  return (
    <div style={{
      padding: '10px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      height: '100%',
      overflowY: 'auto',
    }}>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        fontSize: '9px',
        padding: '6px 8px',
        background: 'rgba(0,0,0,0.5)',
        border: '1px solid rgba(0,170,0,0.3)',
        marginBottom: '6px',
      }}>
        <div className="cr2-sale-market-head">
          <span className="cr2-sale-market-name">
            {TIER_ICONS[market.tierId]} {marketTier.category}
            {isPrimaryMarket && <span className="cr2-market-badge">주력</span>}
          </span>
          <span className="cr2-gray">
            운영비 {Math.round(getMarketOperatingCost(gameState, market) / 10000).toLocaleString()}만원{!isPrimaryMarket && ' (기존 시장 70%)'}
          </span>
        </div>
        <div className="cr2-sale-ratio">
          {Object.entries(getConsumerRatio(marketTier, gameState.activeEffects)).map(([group, ratio]) => (
            <span key={group} className={`cr2-sale-ratio-item cr2-ratio-${group}`} style={{ flex: Math.max(ratio, 0.06) }}>
              {CONSUMER_GROUP_LABELS[group].replace(' 중시', '')} {Math.round(ratio * 100)}%
            </span>
          ))}
        </div>
        {gameState.selectedAdvisor === 'guardian' && (
          <div className="cr2-gray" style={{ fontSize: '8px' }}>Guardian 패시브: 실제 발주량 -10%</div>
        )}
        <div style={{ display: 'flex', gap: '8px' }}>
          <span style={{ color: 'var(--cr2-gray)' }}>원가</span>
          <span style={{ color: 'var(--cr2-white)' }}>
            {effectiveCost.toLocaleString()}원
          </span>
          <span style={{ color: 'var(--cr2-gray)', fontSize: '8px' }}>
            (품질 {getEffectiveQuality()} 기준)
          </span>
        </div>

        {rivalInfos.length > 0 && (
          <div style={{
            borderTop: '1px solid rgba(220,20,60,0.3)',
            paddingTop: '4px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}>
            {rivalInfos.map(rival => (
              <div key={rival.key} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ color: 'var(--cr2-red)', fontSize: '9px' }}>
                  {rival.name} {rival.company && `(${rival.company})`}
                </div>
                <div style={{ display: 'flex', gap: '10px', fontSize: '8px', flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--cr2-gray)' }}>
                    가격 <span style={{ color: 'var(--cr2-red)' }}>
                      {rival.price.toLocaleString()}원
                    </span>
                  </span>
                  <span style={{ color: 'var(--cr2-gray)' }}>
                    품질 <span style={{ color: 'var(--cr2-red)' }}>
                      {rival.quality}
                    </span>
                  </span>
                  {rival.tier && (
                    <span style={{ color: 'var(--cr2-gray)' }}>
                      [{rival.tier}]
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ order: 2 }}>
        <div style={{ fontSize: '9px', color: 'var(--cr2-lime)', marginBottom: '5px' }}>
          가격 선택
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '4px',
          marginBottom: '4px',
        }}>
          {priceOpts.map(opt => (
            <button
              key={opt.key}
              onClick={() => handlePrice(opt.price, opt.key)}
              style={{
                background: selectedPrice === opt.key
                  ? 'rgba(0,255,65,0.15)' : 'var(--cr2-bg2)',
                border: `1px solid ${selectedPrice === opt.key
                  ? 'var(--cr2-lime)' : 'var(--cr2-green)'}`,
                color: 'var(--cr2-white)',
                fontFamily: "'Press Start 2P', 'Noto Sans KR', monospace",
                padding: '8px 4px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '3px',
                boxShadow: selectedPrice === opt.key
                  ? '0 0 6px rgba(0,255,65,0.25)' : 'none',
              }}
            >
              <span style={{ fontSize: '11px', color: 'var(--cr2-lime)' }}>
                {opt.label}
              </span>
              <span style={{ fontSize: '8px', color: 'var(--cr2-gray)' }}>
                {opt.price.toLocaleString()}원
              </span>
            </button>
          ))}
        </div>

        <div style={{ marginTop: '4px' }}>
          <input
            type="number"
            value={customPrice}
            placeholder="판매가 직접 입력 (원)"
            onChange={event => {
              const raw = event.target.value
              setCustomPrice(raw)
              const err = validatePrice(raw)
              setPriceError(err)
              if (!err && raw !== '') {
                setSelectedPrice('custom')
                setCurrentStrategy({
                  price: parseInt(raw, 10),
                  priceKey: 'custom',
                  priceMultiplier: 'custom',
                })
                playSFX('click')
              }
            }}
            style={{
              width: '100%',
              background: selectedPrice === 'custom'
                ? 'rgba(0,255,65,0.08)'
                : priceError ? 'rgba(220,20,60,0.08)'
                  : 'rgba(0,0,0,0.5)',
              border: `1px solid ${
                priceError ? 'var(--cr2-red)'
                  : selectedPrice === 'custom' ? 'var(--cr2-lime)'
                    : 'rgba(0,170,0,0.4)'
              }`,
              color: 'var(--cr2-white)',
              padding: '6px 10px',
              fontFamily: "'Press Start 2P', 'Noto Sans KR', monospace",
              fontSize: '9px',
              boxSizing: 'border-box',
            }}
          />
          {priceError && (
            <div style={{
              fontSize: '8px',
              color: 'var(--cr2-red)',
              marginTop: '3px',
              fontFamily: "'Noto Sans KR', sans-serif",
            }}>
              ⚠️ {priceError}
            </div>
          )}
          {!priceError && selectedPrice === 'custom' && customPrice && (
            <div style={{
              fontSize: '8px',
              color: 'var(--cr2-gold)',
              marginTop: '3px',
            }}>
              손익분기: {getBreakeven(parseInt(customPrice, 10))?.toLocaleString()}개
              {rivalPrice && ` · 라이벌 대비 ${getRivalDiff(parseInt(customPrice, 10))}%`}
            </div>
          )}
        </div>

        {selectedPrice !== 'custom' && currentPrice && currentPrice > effectiveCost && (
          <div style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            fontSize: '9px',
            padding: '4px 6px',
            background: 'rgba(0,0,0,0.4)',
            borderLeft: '2px solid var(--cr2-lime)',
            marginTop: '4px',
          }}>
            {rivalPrice && (
              <span style={{
                color: parseFloat(getRivalDiff(currentPrice)) < 0
                  ? 'var(--cr2-lime)' : 'var(--cr2-red)',
              }}>
                라이벌 대비 {getRivalDiff(currentPrice)}%
              </span>
            )}
            <span style={{ color: 'var(--cr2-gold)' }}>
              손익분기 {getBreakeven(currentPrice)?.toLocaleString()}개
            </span>
          </div>
        )}
      </div>

      <div style={{ order: 3 }}>
        <div style={{
          fontSize: '9px',
          color: 'var(--cr2-lime)',
          marginBottom: '5px',
          display: 'flex',
          gap: '6px',
          flexWrap: 'wrap',
        }}>
          <span>발주량</span>
          <span style={{ color: 'var(--cr2-gray)' }}>
            최대 {maxOrder.toLocaleString()}개 (자본 기준)
          </span>
          {myDemand > 0 && (
            <span style={{ color: 'var(--cr2-gold)' }}>
              예상 수요 {myDemand.toLocaleString()}개
            </span>
          )}
        </div>

        {selectedOrder > 0 && (
          <div style={{
            fontSize: '10px',
            color: 'var(--cr2-lime)',
            marginBottom: '6px',
            letterSpacing: '0.5px',
          }}>
            생산비용: {selectedOrder.toLocaleString()}개 × {effectiveCost.toLocaleString()}원
            {' = '}
            <span style={{ color: 'var(--cr2-white)', fontWeight: 'bold' }}>
              {(selectedOrder * effectiveCost).toLocaleString()}원
            </span>
          </div>
        )}

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '4px',
          marginBottom: '4px',
        }}>
          {orderOpts.map(opt => {
            const disabled = isOrderOptionDisabled(opt.amount)
            return (
            <button
              key={opt.key}
              disabled={disabled}
              onClick={() => handleOrder(opt.amount, opt.key)}
              style={{
                background: selectedOrderKey === opt.key
                  ? 'rgba(0,255,65,0.15)' : 'var(--cr2-bg2)',
                border: `1px solid ${selectedOrderKey === opt.key
                  ? 'var(--cr2-lime)' : 'var(--cr2-green)'}`,
                color: 'var(--cr2-white)',
                fontFamily: "'Press Start 2P', 'Noto Sans KR', monospace",
                padding: '8px 4px',
                opacity: disabled ? 0.3 : 1,
                cursor: disabled ? 'not-allowed' : 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '3px',
                boxShadow: selectedOrderKey === opt.key
                  ? '0 0 6px rgba(0,255,65,0.25)' : 'none',
              }}
            >
              <span style={{ fontSize: '10px', color: 'var(--cr2-lime)' }}>
                {opt.label}
              </span>
              <span style={{ fontSize: '8px', color: 'var(--cr2-gray)' }}>
                {opt.amount.toLocaleString()}개
              </span>
            </button>
            )
          })}
        </div>

        <div style={{ marginTop: '4px' }}>
          <input
            type="number"
            value={customOrder}
            placeholder={`직접 입력 (최대 ${maxOrder.toLocaleString()})`}
            onChange={event => {
              const raw = event.target.value
              setCustomOrder(raw)
              const err = validateOrder(raw)
              setOrderError(err)
              if (!err && raw !== '') {
                const num = parseInt(raw, 10)
                if (!isNaN(num) && num > 0) {
                  if (num > maxOrder) {
                    setCustomOrder(String(maxOrder))
                    setSelectedOrder(maxOrder)
                    setSelectedOrderKey('custom')
                    setCurrentStrategy({ orderAmount: maxOrder, orderKey: 'custom' })
                    return
                  }
                  setSelectedOrder(num)
                  setSelectedOrderKey('custom')
                  setCurrentStrategy({ orderAmount: num, orderKey: 'custom' })
                }
                playSFX('click')
              }
            }}
            style={{
              width: '100%',
              background: selectedOrderKey === 'custom'
                ? 'rgba(0,255,65,0.08)'
                : orderError ? 'rgba(220,20,60,0.08)'
                  : 'rgba(0,0,0,0.5)',
              border: `1px solid ${
                orderError ? 'var(--cr2-red)'
                  : selectedOrderKey === 'custom' ? 'var(--cr2-lime)'
                    : 'rgba(0,170,0,0.4)'
              }`,
              color: 'var(--cr2-white)',
              padding: '6px 10px',
              fontFamily: "'Press Start 2P', 'Noto Sans KR', monospace",
              fontSize: '9px',
              boxSizing: 'border-box',
            }}
          />
          {orderError && (
            <div style={{
              fontSize: '8px',
              color: 'var(--cr2-red)',
              marginTop: '3px',
              fontFamily: "'Noto Sans KR', sans-serif",
            }}>
              ⚠️ {orderError}
            </div>
          )}
          {!orderError && selectedOrderKey === 'custom' && customOrder && (
            <div style={{
              fontSize: '8px',
              color: 'var(--cr2-gold)',
              marginTop: '3px',
            }}>
              생산비: {(parseInt(customOrder, 10) * effectiveCost / 10000).toFixed(0)}만원
            </div>
          )}
        </div>
      </div>

      <div style={{ order: 1 }}>
        <div style={{
          fontSize: '9px',
          color: 'var(--cr2-lime)',
          marginBottom: '5px',
          display: 'flex',
          gap: '6px',
        }}>
          <span>품질 수준</span>
          <span style={{ color: 'var(--cr2-gray)' }}>현재 {gameState.quality}</span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '4px',
        }}>
          {qualOpts.map(opt => (
            <button
              key={opt.key}
              onClick={() => handleQuality(opt.key)}
              style={{
                background: selectedQuality === opt.key
                  ? 'rgba(0,255,65,0.15)' : '#0A0A0F',
                border: `2px solid ${selectedQuality === opt.key
                  ? opt.color : 'var(--cr2-green)'}`,
                color: 'var(--cr2-white)',
                fontFamily: "'Press Start 2P', 'Noto Sans KR', monospace",
                padding: '8px 4px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              <span style={{ fontSize: '10px', color: opt.color }}>
                {opt.label}
              </span>
              <span style={{ fontSize: '7px', color: 'var(--cr2-gray)' }}>
                {opt.cost.toLocaleString()}원
              </span>
              <span style={{
                fontSize: '7px',
                color: opt.key === 'reduce' ? 'var(--cr2-lime)'
                  : opt.key === 'upgrade' ? 'var(--cr2-red)'
                    : 'var(--cr2-gray)',
                marginTop: '1px',
              }}>
                ({opt.qualityDisplay})
              </span>
            </button>
          ))}
        </div>

        <div style={{ marginTop: '4px' }}>
          <input
            type="number"
            value={qualCustomVal}
            placeholder={`품질 입력 (${Math.max(1, Math.floor(currentQuality * 0.5))} ~ ${currentQuality})`}
            step="1"
            min={Math.max(1, Math.floor(currentQuality * 0.5))}
            max={currentQuality}
            onChange={event => {
              const raw = event.target.value
              setQualCustomVal(raw)
              const err = validateQual(raw, currentQuality)
              setQualError(err)
              if (!err && raw !== '') {
                const inputQual = parseInt(raw, 10)
                const multiplier = inputQual / currentQuality
                setSelectedQuality('custom')
                setCurrentStrategy({
                  qualityMode: 'custom',
                  qualityAction: 'custom',
                  qualityMultiplier: multiplier,
                })
                playSFX('click')
              }
            }}
            style={{
              width: '100%',
              background: selectedQuality === 'custom'
                ? 'rgba(0,255,65,0.08)'
                : qualError
                  ? 'rgba(220,20,60,0.08)'
                  : 'rgba(0,0,0,0.5)',
              border: `1px solid ${
                qualError
                  ? 'var(--cr2-red)'
                  : selectedQuality === 'custom'
                    ? 'var(--cr2-lime)'
                    : 'rgba(0,170,0,0.4)'
              }`,
              color: 'var(--cr2-white)',
              padding: '6px 10px',
              fontFamily: "'Press Start 2P', 'Noto Sans KR', monospace",
              fontSize: '9px',
              boxSizing: 'border-box',
            }}
          />

          {qualError && (
            <div style={{
              fontSize: '8px',
              color: 'var(--cr2-red)',
              marginTop: '3px',
              fontFamily: "'Noto Sans KR', sans-serif",
            }}>
              ⚠️ {qualError}
            </div>
          )}

          {!qualError && selectedQuality === 'custom' && qualCustomVal && (
            <div style={{
              fontSize: '9px',
              color: 'var(--cr2-gray)',
              marginTop: '3px',
            }}>
              설정 품질: {parseInt(qualCustomVal, 10)}
              &nbsp;·&nbsp;
              예상 원가: {Math.floor(cost * (parseInt(qualCustomVal, 10) / currentQuality)).toLocaleString()}원
            </div>
          )}
        </div>
      </div>

    </div>
  )
}

function OperationTab({ gameState, setCurrentStrategy, setFactoryAction }) {
  const [subTab, setSubTab] = useState('factory')

  return (
    <div className="cr2-panel-content">
      <div className="cr2-panel-title">운영</div>
      <div className="cr2-panel-desc">이번 달의 설비 투자, 은행 거래, 마케팅을 정합니다.</div>

      <div className="cr2-operation-info">
        <div>예상 품질 {gameState.quality} &nbsp; 예상 원가 {gameState.cost?.toLocaleString()}원</div>
        <div>예상 부채 {(gameState.debt || 0).toLocaleString()}원</div>
      </div>

      <div className="cr2-subtab-bar">
        {['factory', 'bank', 'marketing'].map(tab => (
          <button
            key={tab}
            className={`cr2-subtab ${subTab === tab ? 'cr2-subtab-active' : ''}`}
            onClick={() => {
              setSubTab(tab)
              playSFX('click')
            }}
          >
            {tab === 'factory' ? '공장 관리' : tab === 'bank' ? '은행 업무' : '마케팅'}
          </button>
        ))}
      </div>

      {subTab === 'factory' && (
        <FactorySection
          gameState={gameState}
          setFactoryAction={setFactoryAction}
        />
      )}
      {subTab === 'bank' && (
        <BankSection gameState={gameState} />
      )}
      {subTab === 'marketing' && (
        <MarketingSection gameState={gameState} setCurrentStrategy={setCurrentStrategy} />
      )}
    </div>
  )
}

function FactorySection({ gameState, setFactoryAction }) {
  const factoryAction = gameState.factoryActionThisTurn

  const qualityRate = getSuccessRate(
    QUALITY_UPGRADE.baseSuccessRate,
    gameState.qualityUpgradeCount || 0,
    gameState.factoryFailStreak || 0,
  )
  const costRate = getSuccessRate(
    COST_REDUCTION.baseSuccessRate,
    gameState.costReductionCount || 0,
    gameState.costReductionFailStreak || 0,
  )

  const getRateColor = (rate) => {
    if (rate >= 0.7) return 'var(--cr2-lime)'
    if (rate >= 0.4) return 'var(--cr2-gold)'
    return 'var(--cr2-red)'
  }

  if (factoryAction) {
    return (
      <div className="cr2-factory-reserved">
        <div className="cr2-factory-reserved-label">
          ✅ 이번 달 공장 작업 예약됨
        </div>
        <div className="cr2-factory-reserved-type">
          {factoryAction.type === 'quality' ? '품질 강화' : '원가 절감'} · 50만원
        </div>
        <button
          className="cr2-btn cr2-btn-ghost"
          onClick={() => {
            useGameStore.getState().setFactoryAction(null)
            playSFX('click')
          }}
        >
          취소
        </button>
      </div>
    )
  }

  return (
    <div className="cr2-factory-section">
      <div className="cr2-factory-current">
        현재 품질: {gameState.quality} &nbsp; 현재 원가: {gameState.cost?.toLocaleString()}원/개
        <br />
        누적 원가 절감: {((gameState.costReductionTotal || 0) * 100).toFixed(1)}% / 40%
      </div>

      <div
        className="cr2-factory-option"
        onClick={() => {
          if (gameState.capital < 500000) return
          setFactoryAction({ type: 'quality' })
          playSFX('click')
        }}
        style={{ opacity: gameState.capital < 500000 ? 0.4 : 1 }}
      >
        <div className="cr2-factory-option-title">품질 강화</div>
        <div>비용: 500,000원</div>
        <div>예상: +{QUALITY_UPGRADE.minGain} ~ +{QUALITY_UPGRADE.maxGain}</div>
        <div style={{ color: getRateColor(qualityRate) }}>
          성공 확률: {Math.round(qualityRate * 100)}%
          {gameState.factoryFailStreak > 0 && (
            <span className="cr2-negative">
              &nbsp;(연속 실패 {gameState.factoryFailStreak}회 +{gameState.factoryFailStreak * 10}%)
            </span>
          )}
        </div>
        {gameState.capital < 500000 && <div className="cr2-negative">자본 부족</div>}
      </div>

      <div
        className="cr2-factory-option"
        onClick={() => {
          if (gameState.capital < 500000) return
          if ((gameState.costReductionTotal || 0) >= 0.40) return
          setFactoryAction({ type: 'cost' })
          playSFX('click')
        }}
        style={{
          opacity: gameState.capital < 500000 || (gameState.costReductionTotal || 0) >= 0.40 ? 0.4 : 1,
        }}
      >
        <div className="cr2-factory-option-title">원가 절감</div>
        <div>비용: 500,000원</div>
        <div>예상: -{(COST_REDUCTION.minGain * 100).toFixed(0)}% ~ -{(COST_REDUCTION.maxGain * 100).toFixed(0)}%</div>
        <div style={{ color: getRateColor(costRate) }}>
          성공 확률: {Math.round(costRate * 100)}%
          {gameState.costReductionFailStreak > 0 && (
            <span className="cr2-negative">
              &nbsp;(연속 실패 {gameState.costReductionFailStreak}회)
            </span>
          )}
        </div>
        {(gameState.costReductionTotal || 0) >= 0.40 && (
          <div className="cr2-lime">최대 원가 절감 달성</div>
        )}
        {gameState.capital < 500000 && <div className="cr2-negative">자본 부족</div>}
      </div>

      <button
        className="cr2-btn cr2-btn-ghost"
        onClick={() => playSFX('click')}
      >
        건너뛰기
      </button>
    </div>
  )
}

function BankSection({ gameState }) {
  const [toastMessage, setToastMessage] = useState(null)
  const [loanRatio, setLoanRatio] = useState(0.5)
  const grade = getGrade(gameState.creditScore)
  const loanLimit = getLoanLimit(gameState.creditScore, gameState.capital)
  const availableLoan = getAvailableLoanAmount(gameState)
  const requestAmount = Math.floor((availableLoan * loanRatio) / 10000) * 10000
  const previewRate = getInterestRate(gameState.creditScore, gameState.activeEffects, gameState.selectedAdvisor)
  const loans = gameState.loans || []
  const hasLoan = typeId => loans.some(loan => (loan.typeId || loan.type) === typeId)
  const isMaxLoans = loans.length >= 3

  const handleTakeLoan = (loanTypeId) => {
    const result = takeLoan(loanTypeId, useGameStore.getState(), requestAmount)
    if (!result.success) {
      setToastMessage(result.reason || result.error || '대출 신청에 실패했습니다.')
      return
    }

    setToastMessage(null)
    useGameStore.setState(state => ({
      capital: state.capital + result.newLoan.principal,
      debt: (state.debt || 0) + result.newLoan.principal,
      loans: [...(state.loans || []), result.newLoan],
    }))
    playSFX('click')
  }

  const handleRepayLoan = (loanId) => {
    const result = repayLoan(loanId, gameState)
    if (result.success) {
      useGameStore.setState(state => ({
        capital: result.newCapital,
        debt: result.newDebt,
        loans: result.newLoans,
        stats: result.statsUpdate
          ? { ...(state.stats || {}), ...result.statsUpdate }
          : state.stats,
      }))
      playSFX('click')
    }
  }

  const handleExtendLoan = (loanId) => {
    const result = extendLoan(loanId, gameState)
    if (result.success) {
      useGameStore.setState({ loans: result.newLoans })
      playSFX('click')
    }
  }

  return (
    <div className="cr2-bank-section">
      {toastMessage && (
        <div
          style={{
            fontSize: '10px',
            color: 'var(--cr2-red)',
            marginBottom: '6px',
            padding: '4px 8px',
            border: '1px solid var(--cr2-red)',
            background: 'rgba(220,20,60,0.1)',
          }}
          onClick={() => setToastMessage(null)}
        >
          {toastMessage}
        </div>
      )}

      <div className="cr2-bank-grade">
        신용등급 <span style={{ color: getGradeColor(grade) }}>{grade}</span>
        ({gameState.creditScore}점)
      </div>

      {loans.length > 0 && (
        <div className="cr2-loan-list">
          <div className="cr2-loan-list-title">현재 대출</div>
          {loans.map(loan => (
            <div key={loan.id} className="cr2-loan-item">
              <div className="cr2-loan-type">{LOAN_TYPES.find(type => type.id === (loan.typeId || loan.type))?.label}</div>
              <div>원금 {(loan.principal / 10000).toFixed(0)}만원</div>
              <div className={loan.remainingTurns <= 1 ? 'cr2-negative cr2-blink' : loan.remainingTurns <= 3 ? 'cr2-gold' : ''}>
                {loan.remainingTurns < 0
                  ? `⚠️ 연체 ${-loan.remainingTurns}턴 (${FORCED_REPAYMENT_TURNS}턴이면 강제 회수)`
                  : `⏳ 만기 ${loan.remainingTurns}턴 후`}
              </div>
              <div className="cr2-loan-btns">
                <button
                  className="cr2-btn cr2-btn-small"
                  onClick={() => handleRepayLoan(loan.id)}
                >
                  상환
                </button>
                <button
                  className="cr2-btn cr2-btn-small"
                  onClick={() => handleExtendLoan(loan.id)}
                >
                  연장
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {grade !== 'D' && (
        <div className="cr2-loan-new">
          <div className="cr2-loan-limit">
            대출 한도: {(loanLimit / 10000).toFixed(0)}만원 · 남은 한도 {(availableLoan / 10000).toFixed(0)}만원
            {previewRate && ` · 연 ${(previewRate * 100).toFixed(1)}%`}
          </div>
          <div className="cr2-loan-amount">
            {[0.25, 0.5, 0.75, 1].map(ratio => (
              <button
                key={ratio}
                type="button"
                className={`cr2-mini-btn ${loanRatio === ratio ? 'cr2-mini-btn-active' : ''}`}
                onClick={() => setLoanRatio(ratio)}
              >
                {Math.round(ratio * 100)}%
              </button>
            ))}
            <span className="cr2-loan-amount-value">
              {(requestAmount / 10000).toLocaleString()}만원
            </span>
          </div>
          <div className="cr2-loan-new-btns">
            {LOAN_TYPES.map(loanType => (
              <div
                key={loanType.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <button
                  className="cr2-btn cr2-btn-small"
                  disabled={hasLoan(loanType.id) || isMaxLoans}
                  onClick={() => handleTakeLoan(loanType.id)}
                >
                  {loanType.label.replace(' 대출', '')}
                </button>
                {hasLoan(loanType.id) && (
                  <div style={{ fontSize: '9px', color: 'var(--cr2-gray)', marginTop: '2px' }}>
                    보유 중
                  </div>
                )}
                {!hasLoan(loanType.id) && isMaxLoans && (
                  <div style={{ fontSize: '9px', color: 'var(--cr2-gray)', marginTop: '2px' }}>
                    한도 초과
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {grade === 'D' && (
        <div className="cr2-negative">신용등급 D — 대출 불가</div>
      )}
    </div>
  )
}

function RivalTab({ gameState }) {
  const stage = getCurrentStage(gameState.floor)
  const activeMarkets = [...getActiveMarkets(gameState)]
    .sort((a, b) => getTierById(b.tierId).floorMin - getTierById(a.tierId).floorMin)
  const allRivals = activeMarkets.flatMap(market => market.rivals.map(rival => ({ ...rival, marketTierId: market.tierId })))
  const defaultKey = allRivals.find(rival => rival.id === stage?.rival)
  const [selectedKey, setSelectedKey] = useState(
    defaultKey ? `${defaultKey.marketTierId}:${defaultKey.id}` : allRivals[0] ? `${allRivals[0].marketTierId}:${allRivals[0].id}` : null,
  )
  const selected = allRivals.find(rival => `${rival.marketTierId}:${rival.id}` === selectedKey) || allRivals[0] || null
  const isAnalyst = gameState.selectedAdvisor === 'analyst'

  if (allRivals.length === 0) {
    return (
      <div className="cr2-panel-content">
        <div className="cr2-panel-title">라이벌</div>
        <div className="cr2-rival-tab-empty cr2-gray">
          모든 시장에 라이벌이 없습니다. 군소 업체들과만 경쟁 중입니다.
        </div>
      </div>
    )
  }

  const rivalStage = selected && !selected.isGeneric ? MONOPOL_STAGES.find(item => item.rival === selected.id) : null
  const capital = selected?.capital || 0
  const initialCapital = selected?.initialCapital || 0
  const capitalRatio = selected?.unbreakable ? 1 : initialCapital > 0
    ? Math.max(0, Math.min(1, capital / initialCapital))
    : 0
  const capitalColor = capital < 0 ? 'var(--cr2-red)' : capitalRatio > 0.5 ? 'var(--cr2-lime)' : capitalRatio > 0.25 ? 'orange' : 'var(--cr2-red)'
  const turnsLeft = selected && !selected.unbreakable ? calcTurnsToRivalBankrupt(capital, selected.netProfit) : null

  return (
    <div className="cr2-panel-content cr2-rival-tab">
      <div className="cr2-panel-title">
        라이벌 정보 <span className="cr2-gray" style={{ fontSize: '8px' }}>{allRivals.length}명 · 시장 {activeMarkets.length}개</span>
      </div>

      <div className="cr2-rival-groups">
        {activeMarkets.map(market => (
          <div key={market.tierId} className="cr2-rival-group">
            <div className="cr2-rival-group-title">
              {TIER_ICONS[market.tierId]} {getTierById(market.tierId).category}
              <span className="cr2-gray"> · 내 점유율 {market.shareHistory?.length ? `${Math.round(market.shareHistory.at(-1) * 100)}%` : '—'}</span>
            </div>
            {market.rivals.length === 0 ? (
              <div className="cr2-rival-group-empty cr2-gray">라이벌 없음 (군소 업체만 남음)</div>
            ) : (
              <div className="cr2-rival-chip-row">
                {market.rivals.map(rival => {
                  const key = `${market.tierId}:${rival.id}`
                  const danger = !rival.unbreakable && (rival.consecutiveLoss >= 2 || rival.capital < 0)
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`cr2-rival-chip ${selectedKey === key ? 'cr2-rival-chip-active' : ''} ${danger ? 'cr2-rival-chip-danger' : ''}`}
                      onClick={() => setSelectedKey(key)}
                    >
                      <img src={rival.profileImage || getRivalProfileImage(rival.id)} alt="" />
                      <span className="cr2-rival-chip-name">{rival.name}</span>
                      <span className="cr2-rival-chip-share">{Math.round((rival.marketShare || 0) * 100)}%</span>
                      {rival.id === stage?.rival && <span className="cr2-rival-chip-flag">타깃</span>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {selected && (
        <>
          <div className="cr2-rival-tab-profile">
            <img
              src={selected.profileImage || getRivalProfileImage(selected.id)}
              alt={selected.name}
              className="cr2-rival-tab-img"
            />
            <div className="cr2-rival-tab-info">
              <div className="cr2-rival-tab-name cr2-negative">{selected.name}</div>
              <div className="cr2-rival-tab-company cr2-gray">{selected.company}</div>
              <div className="cr2-rival-tab-tier" style={{ color: getTierColor(selected.tier) }}>
                [{selected.tier}] {selected.isGeneric ? 'MONOPOL 지원팀' : 'MONOPOL'}
              </div>
            </div>
          </div>

          <div className="cr2-rival-tab-section">
            <div className="cr2-rival-tab-section-title">자본 현황</div>
            {selected.unbreakable ? (
              <div className="cr2-negative" style={{ fontSize: '9px' }}>무한 자본 — 파산시킬 수 없다. 점유율로 꺾어라.</div>
            ) : (
              <>
                <div className="cr2-rival-stat-row">
                  <span>자본</span>
                  <span style={{ color: capitalColor }}>{Math.round(capital / 10000).toLocaleString()}만원</span>
                </div>
                <div className="cr2-rival-cap-track">
                  <div className="cr2-rival-cap-fill" style={{ width: `${capitalRatio * 100}%`, background: capitalColor }} />
                </div>
              </>
            )}
            {(selected.netProfit || 0) !== 0 && (
              <div className="cr2-rival-tab-cap-info">
                <span className={(selected.netProfit || 0) < 0 ? 'cr2-positive' : 'cr2-negative'}>
                  지난달 {(selected.netProfit || 0) < 0 ? '▼' : '▲'}
                  {Math.abs((selected.netProfit || 0) / 10000).toFixed(0)}만원
                </span>
              </div>
            )}
            {!selected.unbreakable && selected.consecutiveLoss >= 2 && (
              <div style={{ fontSize: '9px', color: 'var(--cr2-red)' }}>
                ⚠️ 연속 적자 {selected.consecutiveLoss}턴 (4턴 + 자본 마이너스면 파산)
              </div>
            )}
          </div>

          <div className="cr2-rival-tab-section">
            <div className="cr2-rival-tab-section-title">지난달 전략</div>
            <div className="cr2-rival-stat-grid">
              <span>가격 <b>{(selected.price || 0).toLocaleString()}</b></span>
              <span>품질 <b>{Math.round((selected.quality || 0) * 10) / 10}</b></span>
              <span>브랜드 <b>{Math.round((selected.brand || 0) * 10) / 10}</b></span>
              <span>인지도 <b>{Math.round(selected.awareness || 0)}</b></span>
            </div>
          </div>

          <div className="cr2-rival-tab-section">
            <div className="cr2-rival-tab-section-title">특수 능력</div>
            {rivalStage?.specialAbility ? (
              <div className="cr2-rival-tab-ability cr2-negative">
                {rivalStage.specialAbility.description || getAbilityDesc(rivalStage.specialAbility.type)}
              </div>
            ) : (
              <div className="cr2-gray" style={{ fontSize: 9 }}>없음</div>
            )}
          </div>

          {rivalStage && rivalStage.id === stage?.id && (
            <>
              <div className="cr2-rival-tab-section">
                <div className="cr2-rival-tab-section-title">시장 개입</div>
                {stage.marketIntervention ? (
                  <div className="cr2-rival-tab-intervention cr2-negative">
                    {stage.marketIntervention.description || getInterventionDesc(stage.marketIntervention.type)}
                  </div>
                ) : (
                  <div className="cr2-gray" style={{ fontSize: 9 }}>없음</div>
                )}
              </div>
              <div className="cr2-rival-tab-section">
                <div className="cr2-rival-tab-section-title cr2-gold">이번 구간 힌트</div>
                <div className="cr2-rival-tab-hint">{stage.hint}</div>
                {stage.floorMax - stage.floorMin >= 4 && stage.tier !== 'BOSS' && (
                  <div className="cr2-gray" style={{ fontSize: '8px', marginTop: '4px' }}>
                    {stage.floorMax}층까지 못 쓰러뜨리면 체력 -1, 자본 -10%
                  </div>
                )}
              </div>
            </>
          )}

          {isAnalyst && !selected.unbreakable && (
            <div className="cr2-rival-tab-section cr2-analyst-box">
              <div className="cr2-rival-tab-section-title">Analyst 분석</div>
              <div className="cr2-rival-stat-grid">
                <span>원가 <b>{(selected.cost || 0).toLocaleString()}</b></span>
                <span>원가 절감 <b>{Math.round((selected.costRate || 0) * 1000) / 10}%</b></span>
                <span>판매 <b>{(selected.actualSales || 0).toLocaleString()}</b></span>
                <span>재고 폐기 <b>{(selected.unsoldAmount || 0).toLocaleString()}</b></span>
              </div>
              <div className="cr2-positive" style={{ fontSize: 9, marginTop: 4 }}>
                {turnsLeft !== null ? `이 추세면 약 ${turnsLeft}턴 후 자본 바닥` : '흑자 중 — 가격·품질로 압박이 필요'}
              </div>
            </div>
          )}

          {!isAnalyst && turnsLeft !== null && (
            <div className="cr2-rival-tab-section">
              <div className="cr2-rival-tab-section-title">예상 파산</div>
              <div className="cr2-positive" style={{ fontSize: 10 }}>약 {turnsLeft}턴 후</div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function MarketingSection({ gameState, setCurrentStrategy }) {
  const [budget, setBudget] = useState(0)
  const [marketingError, setMarketingError] = useState('')
  const limit = getMarketingLimit(gameState.capital, gameState.settings?.marketingLimitMode || 'ratio')

  const validateMarketing = (raw) => {
    const val = parseInt(raw, 10)
    if (isNaN(val)) return '숫자만 입력하세요.'
    if (val < 0) return '0원 이상 입력하세요.'
    if (val > limit) return `한도(${(limit / 10000).toFixed(0)}만원) 초과입니다.`
    if (val > gameState.capital) return '보유 자본보다 많습니다.'
    return ''
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ fontSize: '9px', color: 'var(--cr2-gray)' }}>
        한도: <span style={{ color: 'var(--cr2-lime)' }}>{(limit / 10000).toFixed(0)}만원</span>
        <span style={{ color: 'var(--cr2-gray)' }}> (자본 × 0.3)</span>
      </div>

      <input
        type="number"
        value={budget || ''}
        placeholder="마케팅 투자금 입력"
        onChange={event => {
          const raw = event.target.value
          const err = validateMarketing(raw)
          setMarketingError(err)
          if (!err) {
            const val = Math.min(parseInt(raw, 10) || 0, limit)
            setBudget(val)
            setCurrentStrategy({ marketingBudget: val })
          }
        }}
        style={{
          width: '100%',
          background: marketingError ? 'rgba(220,20,60,0.08)' : 'rgba(0,0,0,0.5)',
          border: `1px solid ${marketingError ? 'var(--cr2-red)' : 'rgba(0,170,0,0.4)'}`,
          color: 'var(--cr2-white)',
          padding: '6px 10px',
          fontFamily: "'Press Start 2P', 'Noto Sans KR', monospace",
          fontSize: '9px',
          boxSizing: 'border-box',
        }}
      />

      {marketingError && (
        <div style={{
          fontSize: '8px',
          color: 'var(--cr2-red)',
          fontFamily: "'Noto Sans KR', sans-serif",
        }}>
          ⚠️ {marketingError}
        </div>
      )}

      {!marketingError && budget > 0 && (
        <div style={{ fontSize: '8px', color: 'var(--cr2-gold)' }}>
          예상 인지도: {updateAwareness(gameState.awareness, budget, gameState.brand).toFixed(1)}%
          <span style={{ color: 'var(--cr2-gray)' }}>
            &nbsp;(현재 {gameState.awareness?.toFixed(1)}%)
          </span>
        </div>
      )}
    </div>
  )
}

function ShareDonutChart({ share, rivalName }) {
  const size = 80
  const cx = size / 2
  const cy = size / 2
  const r = 28
  const strokeWidth = 12
  const circumference = 2 * Math.PI * r

  const playerShare = Math.min(Math.max(share || 0, 0), 1)
  const rivalShare = 1 - playerShare
  const playerDash = playerShare * circumference
  const rivalDash = rivalShare * circumference

  return (
    <div className="cr2-donut-wrap">
      <svg width={size} height={size}>
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="var(--cr2-lime)"
          strokeWidth={strokeWidth}
          strokeDasharray={`${playerDash} ${circumference - playerDash}`}
          strokeDashoffset={circumference * 0.25}
          strokeLinecap="round"
          style={{ transform: 'rotate(-90deg)', transformOrigin: `${cx}px ${cy}px` }}
        />
        {rivalShare > 0 && (
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="var(--cr2-red)"
            strokeWidth={strokeWidth}
            strokeDasharray={`${rivalDash} ${circumference - rivalDash}`}
            strokeDashoffset={circumference * 0.25 - playerDash}
            strokeLinecap="round"
            style={{ transform: 'rotate(-90deg)', transformOrigin: `${cx}px ${cy}px` }}
          />
        )}
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          fill="var(--cr2-lime)"
          fontSize="12"
          fontFamily="'Press Start 2P', monospace"
        >
          {Math.round(playerShare * 100)}%
        </text>
        <text
          x={cx}
          y={cy + 10}
          textAnchor="middle"
          fill="var(--cr2-gray)"
          fontSize="6"
          fontFamily="'Press Start 2P', monospace"
        >
          점유율
        </text>
      </svg>

      <div className="cr2-donut-legend">
        <div className="cr2-donut-legend-item">
          <span className="cr2-donut-dot cr2-lime-bg" />
          <span>내 회사 {Math.round(playerShare * 100)}%</span>
        </div>
        <div className="cr2-donut-legend-item">
          <span className="cr2-donut-dot cr2-red-bg" />
          <span>{rivalName || '라이벌'} {Math.round(rivalShare * 100)}%</span>
        </div>
      </div>
    </div>
  )
}

function RevenueBarChart({ revenueHistory, profitHistory }) {
  const data = revenueHistory?.slice(-8) || []
  const profits = profitHistory?.slice(-8) || []

  if (data.length === 0) {
    return (
      <div className="cr2-bar-chart-empty cr2-gray">
        데이터 쌓이는 중...
      </div>
    )
  }

  const maxVal = Math.max(...data.map(Math.abs), ...profits.map(Math.abs), 1)
  const chartH = 60

  return (
    <div className="cr2-bar-chart-wrap">
      <div className="cr2-bar-chart-label">매출 / 순이익 추이</div>
      <svg
        width="100%"
        height={chartH + 20}
        viewBox={`0 0 280 ${chartH + 20}`}
        preserveAspectRatio="none"
      >
        <line
          x1="0"
          y1={chartH / 2}
          x2="280"
          y2={chartH / 2}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="1"
        />

        {data.map((rev, index) => {
          const profit = profits[index] || 0
          const slotW = 280 / data.length
          const cx = index * slotW + slotW / 2
          const revH = Math.abs(rev / maxVal) * (chartH / 2)
          const revY = chartH / 2 - revH
          const profH = Math.abs(profit / maxVal) * (chartH / 2)
          const profY = profit >= 0
            ? chartH / 2 - profH
            : chartH / 2
          const bw = slotW * 0.35

          return (
            <g key={index}>
              <rect
                x={cx - bw}
                y={revY}
                width={bw * 0.9}
                height={revH}
                fill="rgba(0,255,65,0.4)"
              />
              <rect
                x={cx + 1}
                y={profY}
                width={bw * 0.9}
                height={profH}
                fill={profit >= 0 ? 'var(--cr2-lime)' : 'var(--cr2-red)'}
              />
              <text
                x={cx}
                y={chartH + 14}
                textAnchor="middle"
                fill="rgba(255,255,255,0.4)"
                fontSize="5"
                fontFamily="monospace"
              >
                {index + 1}
              </text>
            </g>
          )
        })}
      </svg>

      <div className="cr2-bar-chart-legend">
        <span className="cr2-bar-legend-item cr2-gray-fill">매출</span>
        <span className="cr2-bar-legend-item cr2-lime">순이익</span>
        <span className="cr2-bar-legend-item cr2-red">적자</span>
      </div>
    </div>
  )
}

function CapitalLineChart({ capitalHistory }) {
  const data = capitalHistory?.slice(-10) || []

  if (data.length < 2) {
    return (
      <div className="cr2-line-chart-empty cr2-gray">
        데이터 쌓이는 중...
      </div>
    )
  }

  const width = 280
  const height = 50
  const minVal = Math.min(...data)
  const maxVal = Math.max(...data)
  const range = maxVal - minVal || 1

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width
    const y = height - ((value - minVal) / range) * height
    return `${x},${y}`
  }).join(' ')

  const isUp = data[data.length - 1] >= data[0]
  const lineColor = isUp ? 'var(--cr2-lime)' : 'var(--cr2-red)'
  const areaPath = [
    `M 0,${height}`,
    ...data.map((value, index) => {
      const x = (index / (data.length - 1)) * width
      const y = height - ((value - minVal) / range) * height
      return `L ${x},${y}`
    }),
    `L ${width},${height}`,
    'Z',
  ].join(' ')

  const formatK = (value) => {
    if (Math.abs(value) >= 100000000) return `${(value / 100000000).toFixed(1)}억`
    if (Math.abs(value) >= 10000) return `${Math.floor(value / 10000)}만`
    return value.toLocaleString()
  }

  const lastY = height - ((data[data.length - 1] - minVal) / range) * height

  return (
    <div className="cr2-line-chart-wrap">
      <div className="cr2-line-chart-label">자본 변화</div>
      <svg
        width="100%"
        height={height + 16}
        viewBox={`0 0 ${width} ${height + 16}`}
        preserveAspectRatio="none"
      >
        <path
          d={areaPath}
          fill={isUp ? 'rgba(0,255,65,0.08)' : 'rgba(220,20,60,0.08)'}
        />
        <polyline
          points={points}
          fill="none"
          stroke={lineColor}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <circle
          cx={width}
          cy={lastY}
          r="3"
          fill={lineColor}
        />
        <text x="2" y="8" fill="var(--cr2-gray)" fontSize="5" fontFamily="monospace">
          {formatK(maxVal)}
        </text>
        <text x="2" y={height - 2} fill="var(--cr2-gray)" fontSize="5" fontFamily="monospace">
          {formatK(minVal)}
        </text>
      </svg>
    </div>
  )
}

function NextTab({ gameState, onSettle }) {
  const stage = getCurrentStage(gameState.floor)
  const strategy = gameState.currentStrategy || {}
  const marketingBudget = strategy.marketingBudget || 0
  const loans = gameState.loans || []
  const costEffect = getCostEffectMultiplier(gameState.activeEffects)
  const markets = [...getActiveMarkets(gameState)]
    .sort((a, b) => getTierById(b.tierId).floorMin - getTierById(a.tierId).floorMin)

  const rows = markets.map(market => {
    const tier = getTierById(market.tierId)
    const marketStrategy = market.strategy || {}
    const { costMultiplier } = getQualityMultipliers(marketStrategy)
    const unitCost = Math.floor(getMarketUnitCost(gameState, market) * costMultiplier * costEffect)
    const price = marketStrategy.price || 0
    const orderAmount = marketStrategy.orderAmount || 0
    const operatingCost = getMarketOperatingCost(gameState, market)
    const lastShare = market.shareHistory?.length ? market.shareHistory.at(-1) : 0.5
    const expectedSales = Math.min(orderAmount, Math.floor((market.lastDemand || tier.baseDemand) * lastShare))
    const revenue = expectedSales * price
    const production = orderAmount * unitCost
    const margin = price - unitCost
    return {
      tierId: market.tierId,
      category: tier.category,
      price,
      orderAmount,
      unitCost,
      operatingCost,
      expectedSales,
      revenue,
      production,
      profit: revenue - production - operatingCost,
      breakeven: margin > 0 ? Math.ceil(operatingCost / margin) : null,
      unset: !price || !orderAmount,
    }
  })

  const interest = loans.reduce((sum, loan) => sum + Math.floor((loan.principal * loan.interestRate) / 12), 0)
  const totalRevenue = rows.reduce((sum, row) => sum + row.revenue, 0)
  const totalExpense = rows.reduce((sum, row) => sum + row.production + row.operatingCost, 0) + marketingBudget + interest
  const expectedProfit = totalRevenue - totalExpense
  const unsetRows = rows.filter(row => row.unset)
  const primary = getPrimaryMarket(gameState)
  const currentShare = primary?.shareHistory?.length ? primary.shareHistory.at(-1) : 0

  return (
    <div className="cr2-panel-content cr2-next-tab">
      <div className="cr2-next-charts">
        <ShareDonutChart
          share={currentShare}
          rivalName={stage?.rivalName}
        />

        <RevenueBarChart
          revenueHistory={gameState.revenueHistory}
          profitHistory={gameState.profitHistory}
        />

        <CapitalLineChart
          capitalHistory={gameState.capitalHistory}
        />
      </div>

      <div className="cr2-next-divider" />

      <div className="cr2-next-summary">
        <div className="cr2-next-summary-title">이번 달 예상 {rows.length > 1 && <span className="cr2-gray">· 시장 {rows.length}개</span>}</div>

        {rows.length > 1 && (
          <table className="cr2-market-table cr2-next-market-table">
            <thead>
              <tr><th>시장</th><th>가격</th><th>발주</th><th>예상 이익</th></tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.tierId}>
                  <td>{TIER_ICONS[row.tierId]} {TIER_SHORT_NAMES[row.tierId]}</td>
                  <td className={row.price ? '' : 'cr2-negative'}>{row.price ? row.price.toLocaleString() : '미설정'}</td>
                  <td className={row.orderAmount ? '' : 'cr2-negative'}>{row.orderAmount.toLocaleString()}</td>
                  <td className={row.profit >= 0 ? 'cr2-positive' : 'cr2-negative'}>{row.profit >= 0 ? '+' : ''}{Math.round(row.profit / 10000)}만</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {rows.length === 1 && (
          <>
            <div className="cr2-next-row">
              <span>가격</span>
              <span>{rows[0].price ? `${rows[0].price.toLocaleString()}원` : '미설정'}</span>
            </div>
            <div className="cr2-next-row">
              <span>발주</span>
              <span>{rows[0].orderAmount.toLocaleString()}개</span>
            </div>
            {rows[0].breakeven && (
              <div className="cr2-next-row cr2-gold">
                <span>손익분기점</span>
                <span>{rows[0].breakeven.toLocaleString()}개</span>
              </div>
            )}
          </>
        )}

        <div className="cr2-next-row cr2-negative">
          <span>예정 지출</span>
          <span>{(totalExpense / 10000).toFixed(0)}만원</span>
        </div>
        <div className={`cr2-next-row cr2-next-profit ${expectedProfit >= 0 ? 'cr2-positive' : 'cr2-negative'}`}>
          <span>예상 순이익</span>
          <span>{expectedProfit >= 0 ? '+' : ''}{(expectedProfit / 10000).toFixed(0)}만원</span>
        </div>
      </div>

      {unsetRows.length > 0 && (
        <div className="cr2-next-warning cr2-negative">
          ⚠️ {unsetRows.map(row => row.category).join(', ')} 시장의 가격/발주가 비어 있습니다. 판매 없이 운영비만 나갑니다.
        </div>
      )}

      <div className="cr2-next-desc cr2-gray">
        예상치는 지난달 점유율 기준입니다. 점유율과 손익은 정산에서 확정됩니다.
      </div>

      <button className="cr2-btn cr2-settle-btn" onClick={onSettle}>
        정산하기
      </button>
    </div>
  )
}

function getRivalProfileImage(rivalId) {
  return RIVALS.find(rival => rival.id === rivalId)?.profileImage || '/assets/logo_image-f7z3e97D.png'
}

function getTierColor(tier) {
  const map = {
    ENTRY: 'var(--cr2-gray)',
    MID: '#88FF88',
    SENIOR: 'var(--cr2-gold)',
    CHAMPION: 'var(--cr2-red)',
    BOSS: '#FF00FF',
  }
  return map[tier] || 'var(--cr2-gray)'
}

function getAbilityDesc(type) {
  const map = {
    MARKETING_BLITZ: '매 3턴 마케팅 집중 (인지도 +20%)',
    PRICE_DUMP: '매 5턴 가격 덤핑 (판매가 -30%)',
    COST_REDUCTION_STACK: '매 턴 원가 -0.5% 누적',
    QUALITY_RUSH: '매 3턴 품질 +5',
    BRAND_INVEST: '매 턴 브랜드 +0.2',
    PHASE_OPTIMIZER: '경기 국면 최적 전략 자동 적용',
    EVENT_AMPLIFY: '매 턴 외부 이벤트 강도 x1.5',
    AI_COUNTER: '플레이어 전략 패턴 분석 후 카운터',
  }
  return map[type] || type
}

function getInterventionDesc(type) {
  const map = {
    DEMAND_SUPPRESS: '매 5턴 전체 수요 -10%',
    SUPPLY_GLUT: '매 5턴 공급 과잉 압박',
    RAW_MATERIAL_MONOPOLY: '매 5턴 원자재 매점, 원가 +10%',
    ECONOMY_SUPPRESS: '매 3턴 경기 국면 강제 하향',
    CONSUMER_MANIPULATION: '매 3턴 브랜드 중시 소비자 +20%',
    PHASE_CHAOS: '매 3턴 경기 국면 무작위 변동',
    FORCE_EXTERNAL_EVENT: '매 턴 외부 이벤트 강제 발동',
    FULL_CONTROL: '매 턴 최악 경기 조건 강제',
  }
  return map[type] || type
}

function getGradeColor(grade) {
  const colors = { A: '#00FF41', B: '#FFD700', C: '#FF8800', D: '#DC143C' }
  return colors[grade] || '#888'
}
