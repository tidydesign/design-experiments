// Настраиваемые параметры прототипа. Панель (panel.ts) меняет их на лету,
// main.ts читает каждый кадр.

const defaults = {
  // Marquee
  speed: 64, // px/с — скорость бегущей строки (справа налево)
  friction: 0.9, // затухание инерции после броска, за кадр при 60fps
  // RGB split
  splitPerSpeed: 0.012, // px смещения канала на каждый px/с скорости
  splitMax: 40, // потолок смещения, px
  splitAttack: 0.32, // как быстро каналы разъезжаются (доля за кадр)
  splitRelease: 0.12, // как быстро сходятся обратно (доля за кадр)
  // Bend
  bendPerSpeed: 0.016, // px прогиба центра на каждый px/с скорости
  bendMax: 56, // потолок прогиба, px
  bendStiffness: 256, // жёсткость пружины: выше — быстрее догоняет
  bendDamping: 48, // демпфирование: ниже — сильнее покачивается после отпускания
}

export type Params = typeof defaults

export type ParamDef = {
  key: keyof Params
  label: string
  min: number
  max: number
  step: number
  hint: string
}

export const PARAM_GROUPS: { title: string; params: ParamDef[] }[] = [
  {
    title: 'Marquee',
    params: [
      { key: 'speed', label: 'Speed', min: 0, max: 300, step: 1, hint: 'px/s' },
      { key: 'friction', label: 'Throw inertia', min: 0.8, max: 0.99, step: 0.005, hint: 'decay per frame' },
    ],
  },
  {
    title: 'RGB split',
    params: [
      { key: 'splitPerSpeed', label: 'Strength', min: 0, max: 0.1, step: 0.001, hint: 'px per px/s' },
      { key: 'splitMax', label: 'Max offset', min: 0, max: 300, step: 1, hint: 'px' },
      { key: 'splitAttack', label: 'Attack', min: 0.01, max: 1, step: 0.01, hint: 'share per frame' },
      { key: 'splitRelease', label: 'Release', min: 0.01, max: 1, step: 0.01, hint: 'share per frame' },
    ],
  },
  {
    title: 'Bend',
    params: [
      { key: 'bendPerSpeed', label: 'Strength', min: 0, max: 0.15, step: 0.001, hint: 'px per px/s' },
      { key: 'bendMax', label: 'Max bend', min: 0, max: 400, step: 1, hint: 'px' },
      { key: 'bendStiffness', label: 'Stiffness', min: 10, max: 600, step: 1, hint: 'spring stiffness' },
      { key: 'bendDamping', label: 'Damping', min: 1, max: 60, step: 0.5, hint: 'lower = more wobble' },
    ],
  },
]

const STORAGE_KEY = 'rgb-channel-slider:params'

const load = (): Params => {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') }
  } catch {
    return { ...defaults }
  }
}

export const params: Params = load()

export const saveParams = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(params))

export const resetParams = () => {
  Object.assign(params, defaults)
  localStorage.removeItem(STORAGE_KEY)
}
