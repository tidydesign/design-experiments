# design-experiments

Песочница для небольших прототипов анимаций. Vite + TypeScript, GSAP и Motion.

```bash
npm run dev                         # галерея на http://localhost:5173
npm run new magnetic-button         # новый эксперимент из шаблона
npm run new card-flip -- "Card Flip" # с собственным названием
npm run build                       # статическая сборка в dist/
```

## Структура

```
index.html, src/          галерея (собирает experiments/*/meta.json автоматически)
src/base.css              общие токены и кнопка «назад»
experiments/<slug>/       один прототип = одна папка
  index.html  main.ts  style.css  meta.json
scripts/template/         шаблон для npm run new
```
