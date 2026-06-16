const LASER_FADE_MS = 1000
const MIN_POINT_DIST = 2

const canvas = document.getElementById('laser-canvas')
const ctx = canvas.getContext('2d')
const badge = document.getElementById('badge')

const trail = []
let laserActive = false
let rafId = null
let badgeTimer = null
let bounds = { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight }

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1
  const w = window.innerWidth
  const h = window.innerHeight
  canvas.width = Math.floor(w * dpr)
  canvas.height = Math.floor(h * dpr)
  canvas.style.width = `${w}px`
  canvas.style.height = `${h}px`
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

function pointDist(a, b) {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.hypot(dx, dy)
}

function drawLaser() {
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
  if (!trail.length) return

  const now = Date.now()
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  for (let i = 1; i < trail.length; i++) {
    const a = trail[i - 1]
    const b = trail[i]
    const age = (now - b.t) / LASER_FADE_MS
    const alpha = Math.max(0, 1 - age)
    if (alpha <= 0) continue

    ctx.strokeStyle = `rgba(239, 68, 68, ${alpha * 0.92})`
    ctx.lineWidth = 3 + alpha * 5
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  }

  const last = trail[trail.length - 1]
  if (last) {
    const age = (now - last.t) / LASER_FADE_MS
    const alpha = Math.max(0, 1 - age)
    if (alpha > 0) {
      ctx.fillStyle = `rgba(239, 68, 68, ${alpha})`
      ctx.beginPath()
      ctx.arc(last.x, last.y, 6 + alpha * 4, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  ctx.restore()
}

function tick() {
  const now = Date.now()
  while (trail.length && now - trail[0].t > LASER_FADE_MS) {
    trail.shift()
  }

  drawLaser()

  if (trail.length || laserActive) {
    rafId = requestAnimationFrame(tick)
  } else {
    rafId = null
  }
}

function startAnimation() {
  if (rafId) return
  rafId = requestAnimationFrame(tick)
}

function pushPoint(point) {
  if (!laserActive) return
  if (point.x < -8 || point.y < -8 || point.x > bounds.width + 8 || point.y > bounds.height + 8) {
    return
  }

  const last = trail[trail.length - 1]
  if (last && pointDist(last, point) < MIN_POINT_DIST) return

  trail.push({ x: point.x, y: point.y, t: Date.now() })
  startAnimation()
}

function setBadge(active) {
  window.clearTimeout(badgeTimer)
  badge.classList.remove('badge--on', 'badge--off', 'badge--flash')

  if (active) {
    badge.textContent = 'LASER ON — move mouse'
    badge.classList.add('badge--on')
    return
  }

  badge.textContent = 'LASER OFF'
  badge.classList.add('badge--flash')
  badgeTimer = window.setTimeout(() => {
    badge.classList.remove('badge--flash')
    badge.classList.add('badge--off')
  }, 900)
}

function setLaserActive(active) {
  laserActive = active
  if (!active) {
    trail.length = 0
    drawLaser()
  }
  setBadge(active)
  startAnimation()
}

window.addEventListener('resize', resizeCanvas)
resizeCanvas()

window.lazy.onOverlayReady((nextBounds) => {
  bounds = nextBounds
  resizeCanvas()
})

window.lazy.onLaserToggle(setLaserActive)
window.lazy.onLaserClear(() => {
  trail.length = 0
  drawLaser()
})
window.lazy.onCursorMove((point) => pushPoint(point))
