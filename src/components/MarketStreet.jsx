import { useEffect, useMemo, useRef } from 'react'
import { useGameStore } from '../store/useGameStore'
import { getActiveMarkets, getPrimaryMarket, getTierById, FRINGE_COMPETITOR } from '../constants/markets'
import { ECO_PHASES } from '../constants/economy'
import { CONSUMER_GROUPS, CONSUMER_GROUP_LABELS } from '../logic/marketEngine'
import { previewMarket } from '../logic/settlementEngine'

// 실시간 시장 거리: 손님들이 지금 전략 기준 예상 점유율대로 가게를 골라 들어간다.
// 가격·품질을 바꾸면 손님 흐름이 바로 바뀌고, 호황이면 거리가 붐비고 불황이면 한산하다.

export const GROUP_COLORS = {
  quality: '#7fd3ff',
  brand: '#ffb3ff',
  price: '#ffd700',
  general: '#c8c8d4',
}

const SKIN = ['#f1c27d', '#e0ac69', '#c68642', '#ffdbac']
const HAIR = ['#2b1d0e', '#4a3123', '#111111', '#7a4b2a', '#b5651d']
const MAX_PEOPLE = 46
const PASSERBY_RATE = 0.18
const STORE_TOP = 26
const STORE_HEIGHT = 62

function pick(list, random) {
  return list[Math.floor(random() * list.length)]
}

function pickWeighted(weights, random) {
  const entries = Object.entries(weights).filter(([, value]) => value > 0)
  const total = entries.reduce((sum, [, value]) => sum + value, 0)
  if (total <= 0) return null
  let roll = random() * total
  for (const [key, value] of entries) {
    roll -= value
    if (roll <= 0) return key
  }
  return entries.at(-1)?.[0] ?? null
}

function truncate(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text
  let result = text
  while (result.length > 1 && ctx.measureText(`${result}…`).width > maxWidth) result = result.slice(0, -1)
  return `${result}…`
}

export default function MarketStreet() {
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const sceneRef = useRef({ people: [], pops: [], visits: {}, lastSpawn: 0, floor: null, tierId: null })

  const markets = useGameStore(state => state.markets)
  const selectedMarketId = useGameStore(state => state.selectedMarketId)
  const econPhase = useGameStore(state => state.econPhase)
  const activeEffects = useGameStore(state => state.activeEffects)
  const quality = useGameStore(state => state.quality)
  const brand = useGameStore(state => state.brand)
  const awareness = useGameStore(state => state.awareness)
  const costReductionTotal = useGameStore(state => state.costReductionTotal)
  const selectedAdvisor = useGameStore(state => state.selectedAdvisor)
  const momentum = useGameStore(state => state.momentum)
  const floor = useGameStore(state => state.floor)
  const company = useGameStore(state => state.playerProfile?.company)
  const lastResult = useGameStore(state => state.lastSettlementResult)
  const isPaused = useGameStore(state => state.isPaused)

  const market = useMemo(() => {
    const active = getActiveMarkets({ markets })
    return active.find(item => item.tierId === selectedMarketId) || getPrimaryMarket({ markets }) || active[0] || null
  }, [markets, selectedMarketId])

  // 지금 전략 기준 미리보기 (가격·품질을 바꾸는 순간 다시 계산)
  const preview = useMemo(() => {
    if (!market) return null
    try {
      return previewMarket({
        markets,
        econPhase,
        activeEffects: activeEffects || [],
        quality,
        brand,
        awareness,
        costReductionTotal,
        selectedAdvisor,
        momentum,
      }, market)
    } catch {
      return null
    }
  }, [markets, market, econPhase, activeEffects, quality, brand, awareness, costReductionTotal, selectedAdvisor, momentum])

  // 가게 목록: 나 + 라이벌들 (+ 라이벌이 없으면 군소 업체) + 이번 달 폐업한 라이벌
  const stores = useMemo(() => {
    if (!market) return []
    const list = [{
      id: 'player',
      name: company || '내 회사',
      kind: 'player',
      share: preview?.shares?.player ?? 0,
      price: preview?.price,
    }]
    market.rivals.forEach(rival => {
      list.push({
        id: rival.id,
        name: rival.isGeneric ? rival.company.replace('MONOPOL ', '') : rival.company,
        kind: rival.isGeneric ? 'generic' : 'rival',
        share: preview?.shares?.[rival.id] ?? 0,
        price: preview?.rivalPrices?.[rival.id],
      })
    })
    if (market.rivals.length === 0) {
      list.push({ id: FRINGE_COMPETITOR.id, name: FRINGE_COMPETITOR.name, kind: 'fringe', share: preview?.shares?.fringe ?? 0 })
    }
    ;(lastResult?.rivalBankruptcies || [])
      .filter(item => item.tierId === market.tierId)
      .forEach(item => list.push({ id: `closed_${item.id}`, name: item.company, kind: 'closed', share: 0 }))
    return list.slice(0, 6)
  }, [market, preview, company, lastResult])

  const crowd = (ECO_PHASES[econPhase] || ECO_PHASES.stable).demandMultiplier
    * (activeEffects || []).filter(effect => effect.demandMultiplier).reduce((m, effect) => m * effect.demandMultiplier, 1)

  // 애니메이션 루프에서 최신 값을 읽도록 ref에 보관
  const liveRef = useRef({})
  useEffect(() => {
    liveRef.current = { stores, preview, crowd, isPaused, floor, tierId: market?.tierId }
  })

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return undefined
    const ctx = canvas.getContext('2d')
    const dpr = 2
    let width = 0
    let height = 0
    let frame = 0
    let last = performance.now()
    const random = Math.random

    const resize = () => {
      width = wrap.offsetWidth
      height = wrap.offsetHeight
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
    }
    resize()

    const storeLayout = (count) => {
      const gap = 6
      const storeWidth = Math.min(118, (width - 12 - gap * (count - 1)) / Math.max(count, 1))
      const total = storeWidth * count + gap * (count - 1)
      const start = (width - total) / 2
      return Array.from({ length: count }, (_, index) => {
        const x = start + index * (storeWidth + gap)
        return { x, w: storeWidth, door: x + storeWidth / 2 }
      })
    }

    const spawn = (live, layout) => {
      const scene = sceneRef.current
      const fromLeft = random() < 0.5
      const laneTop = STORE_TOP + STORE_HEIGHT + 10
      const laneBottom = height - 14
      const group = pickWeighted(live.preview?.consumerRatio || { general: 1 }, random) || 'general'
      const passerby = random() < PASSERBY_RATE
      let target = null

      if (!passerby) {
        // 그 소비자 군의 점유율대로 가게 선택 (폐업 가게 제외)
        const groupShare = live.preview?.groupShares?.[group] || {}
        const weights = {}
        live.stores.forEach((store, index) => {
          if (store.kind === 'closed') return
          weights[index] = groupShare[store.id] ?? store.share ?? 0
        })
        const chosen = pickWeighted(weights, random)
        target = chosen === null ? null : Number(chosen)
      }

      scene.people.push({
        x: fromLeft ? -8 : width + 8,
        y: laneTop + random() * Math.max(laneBottom - laneTop, 4),
        dir: fromLeft ? 1 : -1,
        speed: 26 + random() * 24,
        group,
        target,
        doorX: target === null ? null : layout[target]?.door + (random() - 0.5) * 10,
        phase: 'walk',
        skin: pick(SKIN, random),
        hair: pick(HAIR, random),
        step: random() * 10,
      })
    }

    const drawPerson = (person) => {
      const s = 2
      const x = Math.round(person.x)
      const y = Math.round(person.y)
      const legOffset = Math.floor(person.step) % 2 === 0 ? 1 : -1
      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      ctx.fillRect(x - 3 * s, y + 1, 6 * s, 2)
      // 다리
      ctx.fillStyle = '#2a2a3a'
      ctx.fillRect(x - 2 * s, y - 4 * s, s, 4 * s + (person.phase === 'walk' ? legOffset : 0))
      ctx.fillRect(x + s, y - 4 * s, s, 4 * s - (person.phase === 'walk' ? legOffset : 0))
      // 몸통 (소비자 군 색)
      ctx.fillStyle = GROUP_COLORS[person.group] || '#ccc'
      ctx.fillRect(x - 2 * s, y - 9 * s, 4 * s, 5 * s)
      // 머리
      ctx.fillStyle = person.skin
      ctx.fillRect(x - 1.5 * s, y - 12 * s, 3 * s, 3 * s)
      ctx.fillStyle = person.hair
      ctx.fillRect(x - 1.5 * s, y - 12.5 * s, 3 * s, 1 * s)
    }

    const drawStore = (store, slot, visits) => {
      const { x, w } = slot
      const top = STORE_TOP
      const h = STORE_HEIGHT
      const colors = {
        player: { border: '#00ff41', awningA: '#00aa00', awningB: '#063d10', text: '#00ff41' },
        rival: { border: '#dc143c', awningA: '#a3102c', awningB: '#3a0610', text: '#ff6b81' },
        generic: { border: '#a3102c', awningA: '#5a0a1a', awningB: '#22050b', text: '#ff9aa9' },
        fringe: { border: '#8a8a99', awningA: '#555566', awningB: '#2a2a33', text: '#c8c8d4' },
        closed: { border: '#444', awningA: '#333', awningB: '#222', text: '#777' },
      }[store.kind]

      // 건물
      ctx.fillStyle = 'rgba(8,8,12,0.88)'
      ctx.fillRect(x, top, w, h)
      ctx.strokeStyle = colors.border
      ctx.lineWidth = store.kind === 'player' ? 2 : 1
      ctx.strokeRect(x + 0.5, top + 0.5, w - 1, h - 1)

      // 차양
      const stripe = 8
      for (let i = 0; i < w; i += stripe) {
        ctx.fillStyle = (i / stripe) % 2 === 0 ? colors.awningA : colors.awningB
        ctx.fillRect(x + i, top + 18, Math.min(stripe, w - i), 6)
      }

      // 간판
      ctx.font = '9px "Noto Sans KR", "Malgun Gothic", sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = colors.text
      ctx.fillText(truncate(ctx, store.name, w - 8), x + w / 2, top + 9)

      // 문
      const doorW = Math.min(18, w * 0.25)
      ctx.fillStyle = store.kind === 'closed' ? '#1a1a1a' : 'rgba(255,220,120,0.25)'
      ctx.fillRect(x + w / 2 - doorW / 2, top + h - 22, doorW, 22)

      if (store.kind === 'closed') {
        ctx.strokeStyle = '#dc143c'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(x + 6, top + 28)
        ctx.lineTo(x + w - 6, top + h - 4)
        ctx.moveTo(x + w - 6, top + 28)
        ctx.lineTo(x + 6, top + h - 4)
        ctx.stroke()
        ctx.fillStyle = '#ff6b81'
        ctx.fillText('폐업', x + w / 2, top + 36)
        return
      }

      // 예상 점유율 막대 + 수치
      const barY = top + 28
      ctx.fillStyle = 'rgba(255,255,255,0.08)'
      ctx.fillRect(x + 6, barY, w - 12, 5)
      ctx.fillStyle = colors.border
      ctx.fillRect(x + 6, barY, (w - 12) * Math.min(store.share, 1), 5)
      ctx.fillStyle = '#f0f0f0'
      ctx.fillText(`${Math.round(store.share * 100)}%`, x + w / 4, top + 42)
      ctx.fillStyle = '#a0a0b0'
      ctx.fillText(`👤${visits}`, x + (w * 3) / 4, top + 42)
    }

    const tick = (now) => {
      frame = requestAnimationFrame(tick)
      const live = liveRef.current
      if (!live.stores) return
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      if (live.isPaused || document.hidden) return

      const scene = sceneRef.current
      if (scene.floor !== live.floor || scene.tierId !== live.tierId) {
        scene.floor = live.floor
        scene.tierId = live.tierId
        scene.visits = {}
        scene.people = []
      }
      if (wrap.offsetWidth !== width || wrap.offsetHeight !== height) resize()

      const layout = storeLayout(live.stores.length)

      // 손님 생성: 경기가 좋을수록 자주
      const interval = 520 / Math.max(live.crowd || 1, 0.3)
      if (now - scene.lastSpawn > interval && scene.people.length < MAX_PEOPLE) {
        scene.lastSpawn = now
        spawn(live, layout)
      }

      // 이동
      const doorY = STORE_TOP + STORE_HEIGHT - 2
      scene.people = scene.people.filter(person => {
        person.step += dt * 8
        if (person.phase === 'walk') {
          person.x += person.dir * person.speed * dt
          if (person.doorX !== null && Math.abs(person.x - person.doorX) < 2) {
            person.phase = 'enter'
          } else if (person.doorX !== null && Math.sign(person.doorX - person.x) !== person.dir) {
            person.dir *= -1
          }
          return person.x > -20 && person.x < width + 20
        }
        person.y -= person.speed * 0.9 * dt
        if (person.y <= doorY) {
          const store = live.stores[person.target]
          if (store) {
            scene.visits[store.id] = (scene.visits[store.id] || 0) + 1
            scene.pops.push({ x: person.x, y: doorY - 26, life: 1, color: store.kind === 'player' ? '#00ff41' : '#ff6b81' })
          }
          return false
        }
        return true
      })
      scene.pops = scene.pops
        .map(pop => ({ ...pop, y: pop.y - 18 * dt, life: pop.life - dt }))
        .filter(pop => pop.life > 0)

      // 그리기
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.imageSmoothingEnabled = false
      ctx.clearRect(0, 0, width, height)

      // 보도
      ctx.fillStyle = 'rgba(0,0,0,0.5)'
      ctx.fillRect(0, STORE_TOP + STORE_HEIGHT, width, height - STORE_TOP - STORE_HEIGHT)
      ctx.fillStyle = 'rgba(255,255,255,0.06)'
      for (let i = 0; i < width; i += 24) ctx.fillRect(i, STORE_TOP + STORE_HEIGHT + 3, 12, 1)

      live.stores.forEach((store, index) => drawStore(store, layout[index], scene.visits[store.id] || 0))

      const sorted = [...scene.people].sort((a, b) => a.y - b.y)
      sorted.forEach(drawPerson)

      ctx.font = '10px "Press Start 2P", monospace'
      ctx.textAlign = 'center'
      scene.pops.forEach(pop => {
        ctx.globalAlpha = Math.max(pop.life, 0)
        ctx.fillStyle = pop.color
        ctx.fillText('+1', pop.x, pop.y)
      })
      ctx.globalAlpha = 1
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  if (!market) return null
  const tier = getTierById(market.tierId)

  return (
    <div className="cr2-street" ref={wrapRef}>
      <canvas ref={canvasRef} className="cr2-street-canvas" />
      <div className="cr2-street-head">
        <span className="cr2-street-title">LIVE · {tier.category}</span>
        <span className="cr2-street-legend">
          {CONSUMER_GROUPS.map(group => (
            <span key={group}>
              <i style={{ background: GROUP_COLORS[group] }} />
              {CONSUMER_GROUP_LABELS[group].replace(' 중시', '')}
            </span>
          ))}
        </span>
      </div>
    </div>
  )
}
