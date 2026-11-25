#!/usr/bin/env node
// Использование: npm run new <slug> [-- "Название"]
import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const [slug, ...titleParts] = process.argv.slice(2)
if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
  console.error('Pass a kebab-case slug: npm run new magnetic-button')
  process.exit(1)
}

const root = resolve(import.meta.dirname, '..')
const dest = resolve(root, 'experiments', slug)
if (existsSync(dest)) {
  console.error(`experiments/${slug} already exists`)
  process.exit(1)
}

const title = titleParts.join(' ') || slug.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase())
cpSync(resolve(import.meta.dirname, 'template'), dest, { recursive: true })

const html = resolve(dest, 'index.html')
writeFileSync(html, readFileSync(html, 'utf8').replace('__TITLE__', title))
writeFileSync(
  resolve(dest, 'meta.json'),
  JSON.stringify({ title, description: '', tags: [], date: new Date().toISOString().slice(0, 10) }, null, 2) + '\n',
)

console.log(`✓ experiments/${slug} created → http://localhost:5173/experiments/${slug}/`)
