import { gsap } from 'gsap'
import { PHOTO_IDS, photoUrl } from '../../src/unsplash'
import { PARAM_GROUPS, params, store } from './params'
import { mountPanel } from '../../src/panel'
import { createRenderer, type DrawItem, type Sprite } from './renderer'

const COUNT = 10
const GAP = 128 // px между фото
const MAX_W = 0.5 // доля ширины экрана
const MAX_H = 0.8 // доля высоты экрана
// Скорость, инерция, RGB и изгиб живут в params.ts и меняются с панели

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches

const viewport = document.querySelector<HTMLElement>('.viewport')!
const canvas = document.querySelector<HTMLCanvasElement>('canvas')!
const renderer = createRenderer(canvas)

// --- Загрузка фото ---
// Ширина запроса к Unsplash: половина экрана в физических пикселях.
// innerWidth бывает 0 (вкладка ещё скрыта) — тогда берём ширину монитора; w=0 Unsplash отдаёт как 1×1.
const viewW = innerWidth || screen.width || 1440
const reqWidth = Math.round(gsap.utils.clamp(800, 2400, viewW * devicePixelRatio * MAX_W))

const loadImage = (id: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous' // нужно, чтобы картинку можно было отдать в WebGL
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = photoUrl(id, reqWidth)
  })

// Берём с запасом: если какое-то фото не загрузится, лента всё равно будет из 10
const ids = gsap.utils.shuffle([...PHOTO_IDS]).slice(0, COUNT + 4)
let sprites: Sprite[] = []

// --- Раскладка ---
type Slot = { sprite: Sprite; x: number; w: number; h: number }
let slots: Slot[] = []
let setWidth = 0

const layout = () => {
  renderer.resize()
  const vw = renderer.width
  const vh = renderer.height
  let cursor = 0
  slots = sprites.map((sprite) => {
    // Фит по ориентации: упираемся либо в 50% ширины, либо в 80% высоты
    const fit = Math.min((vw * MAX_W) / sprite.w, (vh * MAX_H) / sprite.h)
    const slot = { sprite, x: cursor, w: sprite.w * fit, h: sprite.h * fit }
    cursor += slot.w + GAP
    return slot
  })
  setWidth = cursor // ширина одного набора вместе с отступом до следующего
}

// --- Состояние движения ---
let x = 0 // текущая позиция ленты
let velocity = 0 // скорость руки / инерции броска, px/с
let split = 0 // смещение каналов, px
let bend = 0 // прогиб центра фото, px
let bendVel = 0 // скорость прогиба (пружина)
let dragging = false
let lastPointerX = 0
let lastMoveTime = 0

const items: DrawItem[] = []

const tick = (_: number, deltaMs: number) => {
  if (!setWidth) return
  const dt = Math.min(deltaMs, 50) / 1000
  const frames = dt * 60

  if (dragging) {
    // рука замерла, но кнопка зажата — скорость гаснет, эффекты сходятся
    if (performance.now() - lastMoveTime > 50) velocity *= Math.pow(0.7, frames)
  } else {
    x += (velocity - (reduceMotion ? 0 : params.speed)) * dt
    velocity *= Math.pow(params.friction, frames)
    if (Math.abs(velocity) < 1) velocity = 0
  }
  x = gsap.utils.wrap(-setWidth, 0, x)

  // RGB: быстро нарастает, мягко гаснет
  const splitTarget = reduceMotion
    ? 0
    : gsap.utils.clamp(-params.splitMax, params.splitMax, velocity * params.splitPerSpeed)
  const k = Math.abs(splitTarget) > Math.abs(split) ? params.splitAttack : params.splitRelease
  split += (splitTarget - split) * (1 - Math.pow(1 - k, frames))

  // Изгиб: пружина тянет прогиб к цели — при резкой остановке фото покачивается, как пластик
  const bendTarget = reduceMotion
    ? 0
    : gsap.utils.clamp(-params.bendMax, params.bendMax, velocity * params.bendPerSpeed)
  const steps = Math.max(1, Math.ceil(dt * 240)) // мелкие шаги, чтобы жёсткая пружина не разлеталась
  const h = dt / steps
  for (let i = 0; i < steps; i++) {
    bendVel += (params.bendStiffness * (bendTarget - bend) - params.bendDamping * bendVel) * h
    bend += bendVel * h
  }

  // Собираем видимые фото: набор повторяется каждые setWidth px
  const vw = renderer.width
  const vh = renderer.height
  const margin = Math.abs(bend) + Math.abs(split)
  items.length = 0
  for (let copy = 0; copy * setWidth + x < vw + margin; copy++) {
    for (const s of slots) {
      const sx = s.x + x + copy * setWidth
      if (sx > vw + margin || sx + s.w < -margin) continue
      items.push({ sprite: s.sprite, x: sx, y: (vh - s.h) / 2, w: s.w, h: s.h, bend, split })
    }
  }
  renderer.draw(items)
}

// --- Перетаскивание ---
viewport.addEventListener('pointerdown', (e) => {
  dragging = true
  velocity = 0
  lastPointerX = e.clientX
  lastMoveTime = performance.now()
  viewport.setPointerCapture(e.pointerId)
  viewport.classList.add('is-dragging')
})

viewport.addEventListener('pointermove', (e) => {
  if (!dragging) return
  const now = performance.now()
  const dx = e.clientX - lastPointerX
  const dt = Math.max(1, now - lastMoveTime) / 1000
  x += dx
  // сглаженная скорость руки — для инерции, RGB и изгиба
  velocity = gsap.utils.interpolate(velocity, dx / dt, 0.4)
  lastPointerX = e.clientX
  lastMoveTime = now
})

const endDrag = () => {
  if (!dragging) return
  dragging = false
  viewport.classList.remove('is-dragging')
  // если рука остановилась перед отпусканием — без броска
  if (performance.now() - lastMoveTime > 80) velocity = 0
}
viewport.addEventListener('pointerup', endDrag)
viewport.addEventListener('pointercancel', endDrag)

addEventListener('resize', layout)

mountPanel(store, PARAM_GROUPS)

// --- Старт: ждём фото, раскладываем, запускаем ---
const results = await Promise.allSettled(ids.map(loadImage))
sprites = results
  .flatMap((r) => (r.status === 'fulfilled' ? [renderer.createSprite(r.value)] : []))
  .slice(0, COUNT)
layout()
gsap.ticker.add(tick)
