import { gsap } from 'gsap'

const COLS = 16
const ROWS = 10
const RADIUS = 180 // зона влияния курсора, px
const STRENGTH = 0.35 // насколько сильно тянет

const grid = document.querySelector<HTMLElement>('.grid')!
const dots = Array.from({ length: COLS * ROWS }, () => {
  const el = document.createElement('div')
  el.className = 'dot'
  grid.append(el)
  return el
})

const movers = dots.map((el) => ({
  el,
  x: gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.4)' }),
  y: gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.4)' }),
  scale: gsap.quickTo(el, 'scale', { duration: 0.4, ease: 'power3.out' }),
}))

let centers: { cx: number; cy: number }[] = []
const measure = () => {
  centers = dots.map((el) => {
    const r = el.getBoundingClientRect()
    const tx = Number(gsap.getProperty(el, 'x'))
    const ty = Number(gsap.getProperty(el, 'y'))
    return { cx: r.left + r.width / 2 - tx, cy: r.top + r.height / 2 - ty }
  })
}
measure()
addEventListener('resize', measure)

addEventListener('pointermove', (e) => {
  movers.forEach((m, i) => {
    const dx = e.clientX - centers[i].cx
    const dy = e.clientY - centers[i].cy
    const dist = Math.hypot(dx, dy)
    const f = Math.max(0, 1 - dist / RADIUS)
    m.x(dx * f * STRENGTH)
    m.y(dy * f * STRENGTH)
    m.scale(1 + f * 1.8)
    m.el.style.background = f > 0 ? `color-mix(in srgb, var(--accent) ${f * 100}%, var(--muted))` : ''
  })
})

addEventListener('pointerleave', () => movers.forEach((m) => (m.x(0), m.y(0), m.scale(1))))
