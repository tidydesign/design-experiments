import { PARAM_GROUPS, params, resetParams, saveParams } from './params'

const decimals = (step: number) => (String(step).split('.')[1] ?? '').length

export function mountPanel() {
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

  for (const group of PARAM_GROUPS) {
    const title = document.createElement('div')
    title.className = 'panel-group'
    title.textContent = group.title
    body.append(title)

    for (const def of group.params) {
      const row = document.createElement('label')
      row.className = 'panel-row'
      row.title = def.hint
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
        params[def.key] = Number(input.value)
        out.textContent = fmt()
        saveParams()
      })
      body.append(row)
    }
  }
  sync.forEach((f) => f())

  panel.querySelector('.panel-reset')!.addEventListener('click', () => {
    resetParams()
    sync.forEach((f) => f())
  })

  toggle.addEventListener('click', () => {
    const open = panel.classList.toggle('is-collapsed') === false
    toggle.setAttribute('aria-expanded', String(open))
  })

  document.body.append(panel)
}
