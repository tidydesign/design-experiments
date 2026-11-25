# design-experiments

Коллекция изолированных прототипов анимаций (Vite multi-page, TypeScript, GSAP, Motion).

- Новый прототип: `npm run new <slug> -- "Title"`, затем правь `experiments/<slug>/`. Заполни `meta.json` (title, description, tags) — галерея читает его.
- Прототипы не импортируют друг из друга; общее только `src/base.css` (CSS-переменные `--bg`, `--surface`, `--accent` и т.д.).
- Анимации: GSAP (`gsap`) для таймлайнов и физики курсора, Motion (`motion`) для простых декларативных анимаций. Других библиотек без нужды не тянуть.
- Уважай `prefers-reduced-motion`, где это имеет смысл.
- Проверка: `npm run build` (tsc + vite build) должен проходить.
