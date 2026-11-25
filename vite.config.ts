import { defineConfig } from 'vite'
import { readdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

// Каждая папка в experiments/ с index.html — отдельная страница сборки.
const root = import.meta.dirname
const experiments = readdirSync(resolve(root, 'experiments'), { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(resolve(root, 'experiments', d.name, 'index.html')))
  .map((d) => d.name)

export default defineConfig({
  server: { port: 5173, open: false },
  build: {
    rollupOptions: {
      input: {
        main: resolve(root, 'index.html'),
        ...Object.fromEntries(
          experiments.map((name) => [name, resolve(root, 'experiments', name, 'index.html')]),
        ),
      },
    },
  },
})
