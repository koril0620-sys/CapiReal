import { useGameStore } from '../store/useGameStore'

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY

// options.useHistory=false: 자주 호출되는 짧은 조언은 대화 기록을 쓰지도, 남기지도 않는다
export async function callOpenAI(systemPrompt, userPrompt, options = {}) {
  const useHistory = options.useHistory !== false
  if (!OPENAI_API_KEY) {
    console.warn('OpenAI API 키 없음')
    return null
  }

  const store = useGameStore.getState()
  const history = store.aiMessages || []
  const recentHistory = useHistory ? history.slice(-10) : []
  const newUserMsg = { role: 'user', content: userPrompt }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 300,
      temperature: 0.7,
      messages: [
        { role: 'system', content: systemPrompt },
        ...recentHistory,
        newUserMsg,
      ],
    }),
  })

  if (!response.ok) {
    console.error('OpenAI API 오류:', response.status)
    return null
  }

  const data = await response.json()
  const responseText = data.choices?.[0]?.message?.content || null
  if (responseText && useHistory) {
    const latestStore = useGameStore.getState()
    latestStore.appendAiMessage(newUserMsg)
    latestStore.appendAiMessage({
      role: 'assistant',
      content: responseText,
    })
  }
  return responseText
}
