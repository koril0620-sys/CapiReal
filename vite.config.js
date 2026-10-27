import { defineConfig, loadEnv } from 'vite'

// 로컬 개발(npm run dev)에서도 /api/advisor가 동작하도록 Vercel 함수를 그대로 연결
function devApi(env) {
  return {
    name: 'dev-api-advisor',
    configureServer(server) {
      server.middlewares.use('/api/advisor', async (req, res) => {
        for (const k of ['OPENAI_API_KEY', 'VITE_OPENAI_API_KEY']) {
          if (env[k] && !process.env[k]) process.env[k] = env[k]
        }
        let body = ''
        for await (const chunk of req) body += chunk
        req.body = body
        const { default: handler } = await import('./api/advisor.js')
        await handler(req, res)
      })
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [devApi(loadEnv(mode, process.cwd(), ''))],
  server: {
    port: 3000,
    strictPort: true,
    open: true,
  },
}))
