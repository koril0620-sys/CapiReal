import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/global.css'

const BASE_WIDTH = 1080
const BASE_HEIGHT = 720

function updateScale() {
  const root = document.getElementById('root')
  if (!root) return

  const scaleX = window.innerWidth / BASE_WIDTH
  const scaleY = window.innerHeight / BASE_HEIGHT
  const scale = Math.min(scaleX, scaleY)
  const offsetX = (window.innerWidth - BASE_WIDTH * scale) / 2
  const offsetY = (window.innerHeight - BASE_HEIGHT * scale) / 2

  root.style.width = BASE_WIDTH + 'px'
  root.style.height = BASE_HEIGHT + 'px'
  root.style.transform = `scale(${scale})`
  root.style.transformOrigin = 'top left'
  root.style.position = 'absolute'
  root.style.left = offsetX + 'px'
  root.style.top = offsetY + 'px'
}

window.addEventListener('resize', updateScale)
window.addEventListener('orientationchange', () => setTimeout(updateScale, 100))
updateScale()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
