type Meta = { title: string; description?: string; tags?: string[]; date?: string }

// Подхватывает experiments/*/meta.json автоматически — новые эксперименты появятся сами.
const metas = import.meta.glob<Meta>('../experiments/*/meta.json', { eager: true, import: 'default' })

const items = Object.entries(metas)
  .map(([path, meta]) => ({ slug: path.split('/').at(-2)!, ...meta }))
  .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))

const root = document.querySelector<HTMLElement>('#gallery')!

root.innerHTML = items.length
  ? items
      .map(
        (e) => `
    <a class="card" href="/experiments/${e.slug}/">
      <h2>${e.title}</h2>
      <p>${e.description ?? ''}</p>
      <div class="meta">
        ${e.date ? `<span>${e.date}</span>` : ''}
        ${(e.tags ?? []).map((t) => `<span class="tag">${t}</span>`).join('')}
      </div>
    </a>`,
      )
      .join('')
  : `<p class="empty">Nothing here yet. Create the first one: <code>npm run new my-idea</code></p>`
