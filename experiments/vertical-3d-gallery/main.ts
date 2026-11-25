import { gsap } from 'gsap'
import { PHOTO_IDS, photoUrl } from '../../src/unsplash'

const COUNT = 10
const MAX_W = 0.6 // доля ширины экрана
const MAX_H = 0.6 // доля высоты экрана
const PEEK = 0.1 // сколько видно соседних фото сверху/снизу, доля высоты экрана
const OVERVIEW_PITCHES = 6 // в обзоре на экран влезает 6 шагов: 5 целых фото + 2 половинки
const LONG_PRESS_MS = 320
const TAP_SLOP = 6 // px — если палец сдвинулся больше, это уже не клик

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
const dur = (s: number) => (reduceMotion ? 0.01 : s)

const stage = document.querySelector<HTMLElement>('.stage')!
const stack = document.querySelector<HTMLElement>('.stack')!

// --- Загрузка фото ---
// innerWidth бывает 0 (вкладка ещё скрыта) — тогда берём ширину монитора; w=0 Unsplash отдаёт как 1×1.
const viewW = innerWidth || screen.width || 1440
const reqWidth = Math.round(gsap.utils.clamp(800, 2400, viewW * devicePixelRatio * MAX_W))

const loadImage = (id: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.className = 'photo'
    img.alt = ''
    img.draggable = false
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = photoUrl(id, reqWidth)
  })

// Берём с запасом: если какое-то фото не загрузится, в стеке всё равно будет 10
const ids = gsap.utils.shuffle([...PHOTO_IDS]).slice(0, COUNT + 4)

// --- Раскладка ---
// Фото стоят столбиком; c[i] — центр i-го фото на «ленте», L — длина всего круга.
type Item = { img: HTMLImageElement; w: number; h: number; c: number }
let items: Item[] = []
let L = 0
let pitch = 0 // средний шаг между центрами — для масштаба обзора

const layout = () => {
  const vw = innerWidth
  const vh = innerHeight
  // Зазор подобран так, чтобы у фото высотой 60% соседи выглядывали ровно на 10% высоты экрана
  const gap = vh * ((1 - MAX_H) / 2 - PEEK)
  let cursor = 0
  items.forEach((it, i) => {
    const fit = Math.min((vw * MAX_W) / it.img.naturalWidth, (vh * MAX_H) / it.img.naturalHeight)
    it.w = it.img.naturalWidth * fit
    it.h = it.img.naturalHeight * fit
    it.img.style.width = `${it.w}px`
    it.img.style.height = `${it.h}px`
    if (i > 0) cursor += items[i - 1].h / 2 + gap + it.h / 2
    it.c = cursor
  })
  const last = items[items.length - 1]
  L = cursor + last.h / 2 + gap + items[0].h / 2
  pitch = L / items.length
}

// Расстояние по кругу, приведённое к [-L/2, L/2)
const wrapDelta = (d: number) => gsap.utils.wrap(-L / 2, L / 2, d)

// --- Состояние ---
const view = { s: 0, scale: 1 } // s — позиция центра экрана на «ленте», px
let target = 0 // куда едем после кликов (копится при частых кликах)
let overview = false

const nearestIndex = (s: number) => {
  let best = 0
  let bestD = Infinity
  items.forEach((it, i) => {
    const d = Math.abs(wrapDelta(it.c - s))
    if (d < bestD) {
      bestD = d
      best = i
    }
  })
  return best
}

// Позиция центра i-го фото, ближайшая к s (s не заворачиваем — так твины идут без скачков)
const snapPosition = (s: number) => s + wrapDelta(items[nearestIndex(s)].c - s)

const render = () => {
  const vw = innerWidth
  const vh = innerHeight
  stack.style.transform = `scale(${view.scale})`
  for (const it of items) {
    const y = vh / 2 + wrapDelta(it.c - view.s) - it.h / 2
    it.img.style.transform = `translate3d(${(vw - it.w) / 2}px, ${y}px, 0)`
  }
}

// --- Клик: следующее фото ---
const next = () => {
  const i = nearestIndex(target)
  const j = (i + 1) % items.length
  target = snapPosition(target) + (wrapDelta(items[j].c - items[i].c) + L) % L
  gsap.to(view, { s: target, duration: dur(0.8), ease: 'power3.inOut', overwrite: 'auto' })
}

// --- Долгое нажатие: обзор, драг, выбор ---
// Масштаб считаем по реальным соседям текущего фото: центр 3-го сверху/снизу ложится на край экрана.
// Текущее фото держим по центру, поэтому берём более длинную сторону — 5 целых фото видно всегда,
// на одном краю ровно половинка, на другом (если соседи ниже) чуть больше.
const overviewScale = () => {
  const n = items.length
  const half = OVERVIEW_PITCHES / 2
  if (n < OVERVIEW_PITCHES + 1) return innerHeight / (OVERVIEW_PITCHES * pitch)
  const i = nearestIndex(view.s)
  const c = items[i].c
  const up = (c - items[(i - half + n) % n].c + L) % L
  const down = (items[(i + half) % n].c - c + L) % L
  return innerHeight / 2 / Math.max(up, down)
}

const enterOverview = () => {
  overview = true
  stage.classList.add('is-overview', 'is-dragging')
  gsap.killTweensOf(view)
  target = view.s
  gsap.to(view, { scale: overviewScale(), duration: dur(0.6), ease: 'power3.out' })
}

const exitOverview = (throwVelocity: number) => {
  overview = false
  stage.classList.remove('is-overview', 'is-dragging')
  // бросок: продолжаем движение по инерции и встаём на ближайшее фото
  target = snapPosition(view.s + throwVelocity * 0.25)
  gsap.to(view, { s: target, scale: 1, duration: dur(0.75), ease: 'power3.inOut', overwrite: 'auto' })
}

let pressTimer = 0
let pressing = false
let moved = false
let startY = 0
let lastY = 0
let lastT = 0
let velocity = 0 // px/с на «ленте»

stage.addEventListener('pointerdown', (e) => {
  if (!items.length || e.button > 0) return
  pressing = true
  moved = false
  startY = lastY = e.clientY
  lastT = performance.now()
  velocity = 0
  stage.setPointerCapture(e.pointerId)
  pressTimer = window.setTimeout(() => pressing && !moved && enterOverview(), LONG_PRESS_MS)
})

stage.addEventListener('pointermove', (e) => {
  if (!pressing) return
  if (!moved && Math.abs(e.clientY - startY) > TAP_SLOP) moved = true
  if (!overview) return
  const now = performance.now()
  // в обзоре стек уменьшен, поэтому 1px руки = 1/scale px ленты
  const ds = -(e.clientY - lastY) / view.scale
  view.s += ds
  velocity = gsap.utils.interpolate(velocity, ds / (Math.max(1, now - lastT) / 1000), 0.4)
  lastY = e.clientY
  lastT = now
})

const release = () => {
  if (!pressing) return
  pressing = false
  clearTimeout(pressTimer)
  if (overview) {
    exitOverview(performance.now() - lastT > 80 ? 0 : velocity)
  } else if (!moved) {
    next()
  }
}
stage.addEventListener('pointerup', release)
stage.addEventListener('pointercancel', release)

addEventListener('resize', () => {
  const i = nearestIndex(view.s)
  layout()
  view.s = target = items[i].c
  if (overview) view.scale = overviewScale()
})

// --- Старт ---
const results = await Promise.allSettled(ids.map(loadImage))
const imgs = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : [])).slice(0, COUNT)
items = imgs.map((img) => ({ img, w: 0, h: 0, c: 0 }))
stack.append(...imgs)
layout()
gsap.ticker.add(render)
