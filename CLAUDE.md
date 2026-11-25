# design-experiments

Коллекция изолированных прототипов анимаций (Vite multi-page, TypeScript, GSAP, Motion).

- Новый прототип: `npm run new <slug> -- "Title"`, затем правь `experiments/<slug>/`. Заполни `meta.json` (title, description, tags) — галерея читает его.
- Прототипы не импортируют друг из друга; общее лежит в `src/`: `base.css` (CSS-переменные `--bg`, `--surface`, `--accent` и т.д.) `unsplash.ts` (пул фото, `LANDSCAPE_IDS`, `photoUrl`) и `panel.ts` (панель параметров со слайдерами: `createParams` + `mountPanel`, по умолчанию свёрнута, значения в localStorage).
- Анимации: GSAP (`gsap`) для таймлайнов и физики курсора, Motion (`motion`) для простых декларативных анимаций. Других библиотек без нужды не тянуть.
- Весь текст интерфейса (галерея, панели, кнопки, подписи, `meta.json`, сообщения скриптов) — на английском. Комментарии в коде можно по-русски.
- Уважай `prefers-reduced-motion`, где это имеет смысл.
- Проверка: `npm run build` (tsc + vite build) должен проходить.
