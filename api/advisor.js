// Vercel 서버 함수: 조언자 AI 조언 (OpenAI 키는 서버에만 둔다)
// 필요한 환경변수: OPENAI_API_KEY (없으면 VITE_OPENAI_API_KEY도 읽는다)

const PERSONAS = {
  raider: '너는 공격형 경영 조언자 Raider다. 짧고 강하게, 반말로 말한다. 경쟁사의 움직임과 점유율 싸움에 주목한다.',
  guardian: '너는 방어형 경영 조언자 Guardian이다. 정중한 존댓말로, 현금과 부채, 위험 관리에 주목한다.',
  analyst: '너는 분석형 경영 조언자 Analyst다. 존댓말로 숫자와 원인을 차분히 짚는다. 원가·마진·가격 차이에 주목한다.',
  gambler: '너는 승부형 경영 조언자 Gambler다. 들뜬 반말로 말한다. 경기 국면 변화와 기회의 타이밍에 주목한다.',
}

const RULES = `규칙:
- 이 게임은 "어떤 전략이 맞는지 알려주지 않는" 경영 교육 게임이다. 정답 전략(가격을 얼마로 하라, 대출을 받아라 등)을 직접 지시하지 마라.
- 데이터에서 눈에 띄는 변화나 원인 1~2가지를 숫자와 함께 짚어라.
- 2022 개정 교육과정 고등학교 경제 개념(수요·공급, 가격 탄력성, 기회비용, 고정비·변동비, 손익분기, 경기 순환, 이자·신용 등) 하나와 자연스럽게 연결하라.
- 마지막 문장은 플레이어가 스스로 생각해 볼 질문 하나로 끝내라.
- 3~4문장, 한국어. 금액 단위는 '만원'.`

function send(res, status, payload) {
  if (typeof res.status === 'function') return res.status(status).json(payload)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' })

  const key = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY
  if (!key) return send(res, 503, { error: 'NO_KEY' })

  let body = req.body
  if (typeof body === 'string') {
    try { body = JSON.parse(body || '{}') } catch { return send(res, 400, { error: 'bad json' }) }
  }
  const { kind, advisor, data } = body || {}
  if (!data || JSON.stringify(data).length > 12000) return send(res, 400, { error: 'bad data' })

  const persona = PERSONAS[advisor] || PERSONAS.analyst
  const task = kind === 'final'
    ? '아래는 플레이어의 12개월 전체 기록이다. 한 판 전체를 돌아보는 총평을 해라.'
    : '아래는 방금 끝난 달의 결산이다. 이번 달을 돌아보는 조언을 해라.'

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 350,
        temperature: 0.7,
        messages: [
          { role: 'system', content: `${persona}\n${RULES}` },
          { role: 'user', content: `${task}\n${JSON.stringify(data)}` },
        ],
      }),
    })
    if (!r.ok) return send(res, 502, { error: `OpenAI ${r.status}` })
    const out = await r.json()
    const text = out.choices?.[0]?.message?.content?.trim()
    if (!text) return send(res, 502, { error: 'empty' })
    return send(res, 200, { text })
  } catch (e) {
    return send(res, 500, { error: e?.message || 'failed' })
  }
}
