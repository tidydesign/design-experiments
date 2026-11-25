// Общая панель параметров для прототипов: слайдеры по группам, сохранение в localStorage, сброс.
import './panel.css'

export type ParamDef<K extends string> = {
  key: K
  label: string
  min: number
  max: number
  step: number
  hint?: string
}

export type ParamGroup<K extends string> = { title: string; params: ParamDef<K>[] }

/** Живой объект параметров: значения из localStorage поверх значений по умолчанию */
export function createParams<T extends Record<string, number>>(storageKey: string, defaults: T) {
  let saved: Partial<T> = {}
  try {
    saved = JSON.parse(localStorage.getItem(storageKey) ?? '{}')
  } catch {}
  const params = { ...defaults, ...saved } as T
  return {
    params,
    save: () => localStorage.setItem(storageKey, JSON.stringify(params)),
    reset: () => {
      Object.assign(params, defaults)
      localStorage.removeItem(storageKey)
    },
  }
}

type Store<T extends Record<string, number>> = ReturnType<typeof createParams<T>>

const decimals = (step: number) => (String(step).split('.')[1] ?? '').length

export function mountPanel<T extends Record<string, number>>(
  store: Store<T>,
  groups: ParamGroup<Extract<keyof T, string>>[],
  onChange?: (key: keyof T) => void,
) {
  const { params } = store
  const panel = document.createElement('aside')
  panel.className = 'panel is-collapsed' // по умолчанию свёрнута
  panel.innerHTML = `
    <header class="panel-head">
      <button class="panel-toggle" type="button" aria-expanded="false">Parameters</button>
      <button class="panel-reset" type="button">Reset</button>
    </header>
    <div class="panel-body"></div>
  `
  const body = panel.querySelector<HTMLElement>('.panel-body')!
  const toggle = panel.querySelector<HTMLButtonElement>('.panel-toggle')!
  const sync: (() => void)[] = []

  for (const group of groups) {
    const title = document.createElement('div')
    title.className = 'panel-group'
    title.textContent = group.title
    body.append(title)

    for (const def of group.params) {
      const row = document.createElement('label')
      row.className = 'panel-row'
      if (def.hint) row.title = def.hint
      row.innerHTML = `
        <span class="panel-label">${def.label}</span>
        <output class="panel-value"></output>
        <input type="range" min="${def.min}" max="${def.max}" step="${def.step}" />
      `
      const input = row.querySelector('input')!
      const out = row.querySelector('output')!
      const fmt = () => params[def.key].toFixed(decimals(def.step))
      sync.push(() => {
        input.value = String(params[def.key])
        out.textContent = fmt()
      })
      input.addEventListener('input', () => {
        ;(params as Record<string, number>)[def.key] = Number(input.value)
        out.textContent = fmt()
        store.save()
        onChange?.(def.key)
      })
      body.append(row)
    }
  }
  sync.forEach((f) => f())

  panel.querySelector('.panel-reset')!.addEventListener('click', () => {
    store.reset()
    sync.forEach((f) => f())
    onChange?.('*' as keyof T)
  })

  toggle.addEventListener('click', () => {
    const open = panel.classList.toggle('is-collapsed') === false
    toggle.setAttribute('aria-expanded', String(open))
  })

  // клики по панели не должны листать/тянуть то, что под ней
  panel.addEventListener('pointerdown', (e) => e.stopPropagation())
  panel.addEventListener('wheel', (e) => e.stopPropagation())

  document.body.append(panel)
}
