import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    // 3000번이 이미 쓰이면 다른 포트로 몰래 바뀌지 않고 바로 알려준다
    strictPort: true,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
