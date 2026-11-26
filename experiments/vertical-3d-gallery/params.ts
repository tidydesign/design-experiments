import { createParams, type ParamGroup } from '../../src/panel'

// Настраиваемые параметры. Панель (src/panel.ts) меняет их на лету, main.ts читает каждый кадр.
const defaults = {
  // Layout
  maxW: 0.8, // макс. ширина кадра 16:9, доля ширины экрана
  maxH: 0.64, // макс. высота кадра, доля высоты экрана
  peek: 0.04, // сколько видно соседних кадров сверху/снизу, доля высоты экрана
  // Mobile (портретный экран): кадр почти во всю ширину, зазор от ширины экрана
  mobileMaxW: 0.92, // ширина кадра, доля ширины экрана
  mobileGap: 0.3, // зазор между кадрами, доля ширины экрана
  // Paging
  swipeDistance: 0.2, // доля шага — сколько протянуть пальцем, чтобы перелистнуть
  stepDuration: 0.8, // с — перелистывание по клику и скроллу
  wheelIdle: 200, // мс — пауза, после которой жест прокрутки считается законченным
  wheelLock: 200, // мс — после шага колесо игнорируется (гасит разгон свайпа тачпада)
  // Overview (long press)
  longPress: 240, // мс — сколько держать, чтобы уменьшить стек
  overviewGap: 4.8, // во сколько раз больше зазор в обзоре
  zoomDuration: 0.4, // с — уменьшение/увеличение стека
  // Drum
  drumStrength: 0.0012, // доля полного изгиба на каждый px/с скорости ленты
  drumRadius: 960, // px — радиус барабана при полном изгибе (меньше — круче)
  perspective: 3200, // px — расстояние до камеры
  shade: 0.6, // затемнение кадров, уходящих вглубь барабана
  drumAttack: 0.6, // как быстро лента выгибается (доля за кадр)
  drumRelease: 0.1, // как быстро распрямляется (доля за кадр)
}

export type Params = typeof defaults

export const PARAM_GROUPS: ParamGroup<keyof Params>[] = [
  {
    title: 'Layout',
    params: [
      { key: 'maxW', label: 'Max width', min: 0.2, max: 1, step: 0.01, hint: 'share of screen width' },
      { key: 'maxH', label: 'Max height', min: 0.2, max: 1, step: 0.01, hint: 'share of screen height' },
      { key: 'peek', label: 'Neighbour peek', min: 0, max: 0.2, step: 0.005, hint: 'share of screen height' },
    ],
  },
  {
    title: 'Mobile',
    params: [
      { key: 'mobileMaxW', label: 'Width', min: 0.5, max: 1, step: 0.01, hint: 'share of screen width, portrait screens' },
      { key: 'mobileGap', label: 'Gap', min: 0, max: 0.5, step: 0.005, hint: 'share of screen width' },
    ],
  },
  {
    title: 'Paging',
    params: [
      { key: 'swipeDistance', label: 'Swipe distance', min: 0.05, max: 0.6, step: 0.01, hint: 'share of a step to drag before it pages' },
      { key: 'stepDuration', label: 'Step duration', min: 0.2, max: 2, step: 0.05, hint: 'seconds' },
      { key: 'wheelIdle', label: 'Wheel gesture gap', min: 50, max: 500, step: 10, hint: 'ms between wheel events that ends a gesture' },
      { key: 'wheelLock', label: 'Wheel lock', min: 0, max: 1000, step: 10, hint: 'ms the wheel is ignored after a step' },
    ],
  },
  {
    title: 'Overview',
    params: [
      { key: 'longPress', label: 'Long press', min: 100, max: 1000, step: 10, hint: 'ms' },
      { key: 'overviewGap', label: 'Gap multiplier', min: 1, max: 8, step: 0.1, hint: '× normal gap' },
      { key: 'zoomDuration', label: 'Zoom duration', min: 0.1, max: 2, step: 0.05, hint: 'seconds' },
    ],
  },
  {
    title: 'Drum',
    params: [
      { key: 'drumStrength', label: 'Strength', min: 0, max: 0.002, step: 0.00005, hint: 'bend per px/s of speed' },
      { key: 'drumRadius', label: 'Radius', min: 200, max: 3000, step: 10, hint: 'px at full bend' },
      { key: 'perspective', label: 'Perspective', min: 300, max: 4000, step: 10, hint: 'px camera distance' },
      { key: 'shade', label: 'Shade', min: 0, max: 1, step: 0.01, hint: 'darken frames turning away' },
      { key: 'drumAttack', label: 'Attack', min: 0.01, max: 1, step: 0.01, hint: 'share per frame' },
      { key: 'drumRelease', label: 'Release', min: 0.01, max: 1, step: 0.01, hint: 'share per frame' },
    ],
  },
]

export const store = createParams('vertical-3d-gallery:params', defaults)
export const params = store.params
