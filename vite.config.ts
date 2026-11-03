import basicSsl from '@vitejs/plugin-basic-ssl'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type ProxyOptions } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  if (mode !== 'mobile') {
    return { plugins: [react()] }
  }

  // `npm run dev:mobile`: 같은 와이파이의 폰으로 방문자 송출(24)을 시험하는 모드.
  // 카메라는 HTTPS에서만 켜져서 개발용 인증서로 HTTPS를 켜고, 폰이 맥의 백엔드에 직접 붙지 않도록
  // API·소켓 요청을 Vite가 백엔드로 넘겨준다(.env.mobile에서 VITE_API_BASE_URL을 비워 같은 주소로 요청한다).
  const env = loadEnv(mode, process.cwd(), '')
  const backend = env.DEV_BACKEND_URL || 'http://localhost:8080'
  // 백엔드 CORS·소켓 Origin 검사는 기본으로 http://localhost:5173만 허용해서, 넘겨줄 때 그 주소로 바꿔 보낸다.
  const allowedOrigin = env.DEV_BACKEND_ORIGIN || 'http://localhost:5173'
  const forward: ProxyOptions = {
    target: backend,
    changeOrigin: true,
    configure: (proxy) => {
      proxy.on('proxyReq', (proxyReq) => proxyReq.setHeader('origin', allowedOrigin))
      proxy.on('proxyReqWs', (proxyReq) => proxyReq.setHeader('origin', allowedOrigin))
    },
  }

  return {
    plugins: [react(), basicSsl()],
    server: {
      host: true,
      proxy: {
        '/api': forward,
        '/ws': { ...forward, ws: true },
      },
    },
  }
})
