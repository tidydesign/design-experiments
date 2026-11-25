import { gsap } from 'gsap'
import { LANDSCAPE_IDS, photoUrl } from '../../src/unsplash'
import { mountPanel } from '../../src/panel'
import { PARAM_GROUPS, params, store } from './params'
import { createRenderer, type DrawItem, type Sprite } from './renderer'

const COUNT = 10
const OVERVIEW_PITCHES = 6 // в обзоре на экран влезает 6 шагов: 5 целых кадров + 2 половинки
const TAP_SLOP = 6 // px — если палец сдвинулся больше, это уже не клик
const WHEEL_MIN = 4 // px — мельче считаем шумом
// Остальное настраивается с панели — см. params.ts

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
const dur = (s: number) => (reduceMotion ? 0.01 : s)

const stage = document.querySelector<HTMLElement>('.stage')!
const canvas = document.querySelector<HTMLCanvasElement>('canvas')!
const renderer = createRenderer(canvas)

// --- Загрузка фото ---
// innerWidth бывает 0 (вкладка ещё скрыта) — тогда берём ширину монитора; w=0 Unsplash отдаёт как 1×1.
const viewW = innerWidth || screen.width || 1440
const reqWidth = Math.round(gsap.utils.clamp(800, 2400, viewW * devicePixelRatio * 0.6))

const loadImage = (id: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous' // нужно, чтобы картинку можно было отдать в WebGL
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = photoUrl(id, reqWidth)
  })

// Только горизонтальные; берём с запасом — если какое-то не загрузится, в стеке всё равно будет 10
const ids = gsap.utils.shuffle([...LANDSCAPE_IDS]).slice(0, COUNT + 4)
let sprites: Sprite[] = []

// --- Раскладка: все кадры 16:9 одного размера ---
let frameW = 0
let frameH = 0
let baseGap = 0

const layout = () => {
  renderer.resize()
  const vw = renderer.width
  const vh = renderer.height
  frameW = Math.min(vw * params.maxW, ((vh * params.maxH) * 16) / 9)
  frameH = (frameW * 9) / 16
  // соседи выглядывают ровно на peek высоты экрана
  baseGap = Math.max(0, (vh - frameH) / 2 - vh * params.peek)
}

// --- Состояние ---
// p — дробный номер кадра в центре экрана (не заворачивается, круг каждые N)
const view = { p: 0, scale: 1, gapK: 1 }
let target = 0 // куда едем после кликов/скролла
let overview = false
let bend = 0 // 0..1 — насколько лента намотана на барабан
let prevP = 0

const pitch = () => frameH + baseGap * view.gapK

const goTo = (p: number, duration: number, ease = 'power3.inOut') => {
  target = p
  gsap.to(view, { p, duration: dur(duration), ease, overwrite: 'auto' })
}

const items: DrawItem[] = []

const tick = (_: number, deltaMs: number) => {
  if (!sprites.length) return
  const dt = Math.max(1, deltaMs) / 1000
  const frames = dt * 60
  const vw = renderer.width
  const vh = renderer.height
  const n = sprites.length
  const s = view.scale
  const step = pitch() * s // шаг на экране

  // Скорость ленты на экране → насколько выгнуть барабан
  const speed = (Math.abs(view.p - prevP) * step) / dt
  prevP = view.p
  const bendTarget = reduceMotion ? 0 : Math.min(1, speed * params.drumStrength)
  const k = bendTarget > bend ? params.drumAttack : params.drumRelease
  bend += (bendTarget - bend) * (1 - Math.pow(1 - k, frames))
  if (bend < 1e-4) bend = 0

  // Видимые кадры (с запасом — на барабане их видно больше)
  items.length = 0
  const w = frameW * s
  const h = frameH * s
  const reach = Math.ceil(vh / step) + 2
  const base = Math.round(view.p)
  for (let x = base - reach; x <= base + reach; x++) {
    const sprite = sprites[((x % n) + n) % n]
    const cy = vh / 2 + (x - view.p) * step
    items.push({ sprite, x: (vw - w) / 2, y: cy - h / 2, w, h })
  }
  renderer.draw(items, bend / params.drumRadius, params.perspective, params.shade)
}

// --- Клик: верхняя половина экрана — предыдущий кадр, нижняя — следующий ---
const stepByClick = (clientY: number) =>
  goTo(Math.round(target) + (clientY < innerHeight / 2 ? -1 : 1), params.stepDuration)

// --- Скролл колесом/тачпадом: пейджер, один жест = один кадр ---
let lastWheelAt = 0
let lockedUntil = 0 // пока идёт перелистывание, новые жесты не принимаем
let wheelAbs: number[] = [] // последние |delta| — чтобы отличить новый свайп от инерции тачпада

stage.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault()
    if (pressing || !sprites.length) return
    const now = performance.now()
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1
    const d = e.deltaY * unit
    const abs = Math.abs(d)
    const gapSinceLast = now - lastWheelAt
    lastWheelAt = now
    if (abs < WHEEL_MIN) return

    // Новый жест — если до этого была пауза, или если посреди затухающей инерции
    // пришёл заметно более сильный толчок (пользователь свайпнул ещё раз)
    const avg = wheelAbs.length ? wheelAbs.reduce((a, b) => a + b, 0) / wheelAbs.length : 0
    const isNewGesture = gapSinceLast > params.wheelIdle || (abs > avg * 2 && abs > 20)
    wheelAbs = [...wheelAbs.slice(-4), abs]
    if (!isNewGesture || now < lockedUntil) return

    lockedUntil = now + params.wheelLock
    goTo(Math.round(target) + Math.sign(d), params.stepDuration)
  },
  { passive: false },
)

// --- Долгое нажатие: обзор, драг, выбор ---
// Все кадры одной высоты, поэтому 6 шагов при обзорном зазоре ровно занимают экран:
// 5 целых кадров по центру и по половинке сверху и снизу.
const overviewScale = () => renderer.height / (OVERVIEW_PITCHES * (frameH + baseGap * params.overviewGap))

const enterOverview = () => {
  overview = true
  stage.classList.add('is-overview', 'is-dragging')
  gsap.killTweensOf(view)
  target = view.p
  gsap.to(view, {
    scale: overviewScale(),
    gapK: params.overviewGap,
    duration: dur(params.zoomDuration),
    ease: 'power3.out',
  })
}

const exitOverview = (throwVelocity: number) => {
  overview = false
  stage.classList.remove('is-overview', 'is-dragging')
  // бросок: продолжаем движение по инерции и встаём на ближайший кадр
  target = Math.round(view.p + (throwVelocity * 0.25) / pitch())
  gsap.to(view, {
    p: target,
    scale: 1,
    gapK: 1,
    duration: dur(params.zoomDuration + 0.15),
    ease: 'power3.inOut',
    overwrite: 'auto',
  })
}

let pressTimer = 0
let pressing = false
let moved = false
let startY = 0
let lastY = 0
let lastT = 0
let velocity = 0 // px/с на ленте (без масштаба)

stage.addEventListener('pointerdown', (e) => {
  if (!sprites.length || e.button > 0) return
  pressing = true
  moved = false
  startY = lastY = e.clientY
  lastT = performance.now()
  velocity = 0
  stage.setPointerCapture(e.pointerId)
  pressTimer = window.setTimeout(() => pressing && !moved && enterOverview(), params.longPress)
})

stage.addEventListener('pointermove', (e) => {
  if (!pressing) return
  if (!moved && Math.abs(e.clientY - startY) > TAP_SLOP) moved = true
  if (!overview) return
  const now = performance.now()
  // в обзоре стек уменьшен, поэтому 1px руки = 1/scale px ленты
  const ds = -(e.clientY - lastY) / view.scale
  view.p += ds / pitch()
  velocity = gsap.utils.interpolate(velocity, ds / (Math.max(1, now - lastT) / 1000), 0.4)
  lastY = e.clientY
  lastT = now
})

const release = (e: PointerEvent) => {
  if (!pressing) return
  pressing = false
  clearTimeout(pressTimer)
  if (overview) {
    exitOverview(performance.now() - lastT > 80 ? 0 : velocity)
  } else if (!moved) {
    stepByClick(e.clientY)
  }
}
stage.addEventListener('pointerup', release)
stage.addEventListener('pointercancel', release)

const relayout = () => {
  layout()
  if (overview) {
    gsap.killTweensOf(view, 'scale,gapK')
    view.scale = overviewScale()
    view.gapK = params.overviewGap
  }
}
addEventListener('resize', relayout)

// --- Кастомный курсор: серый круг 16×16 вместо системного ---
const cursor = document.createElement('div')
cursor.className = 'cursor'
document.body.append(cursor)
addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return // на тач-экранах курсора нет
  cursor.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`
  // над панелью — обычный курсор, круг прячем
  const overPanel = (e.target as Element).closest?.('.panel')
  cursor.classList.toggle('is-visible', !overPanel)
})
document.documentElement.addEventListener('pointerleave', () => cursor.classList.remove('is-visible'))

// Параметры раскладки и обзора требуют пересчёта; остальные читаются каждый кадр
mountPanel(store, PARAM_GROUPS, (key) => {
  if (['maxW', 'maxH', 'peek', 'overviewGap', '*'].includes(key as string)) relayout()
})

// --- Старт: ждём фото, раскладываем, запускаем ---
const results = await Promise.allSettled(ids.map(loadImage))
sprites = results
  .flatMap((r) => (r.status === 'fulfilled' ? [renderer.createSprite(r.value)] : []))
  .slice(0, COUNT)
layout()
gsap.ticker.add(tick)
