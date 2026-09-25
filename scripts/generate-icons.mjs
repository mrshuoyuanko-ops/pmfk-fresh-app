import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = path.join(root, 'public', 'logo.svg')
const outDir = path.join(root, 'public', 'icons')
await mkdir(outDir, { recursive: true })

// Standard icons
await sharp(src).resize(192, 192).png().toFile(path.join(outDir, 'icon-192.png'))
await sharp(src).resize(512, 512).png().toFile(path.join(outDir, 'icon-512.png'))

// Maskable icon: logo centered at ~80% of the canvas on a solid brand background
const maskable = await sharp(src).resize(410, 410).png().toBuffer()
await sharp({
  create: { width: 512, height: 512, channels: 4, background: '#1e5249' },
})
  .composite([{ input: maskable, gravity: 'center' }])
  .png()
  .toFile(path.join(outDir, 'icon-maskable-512.png'))

// Apple touch icon
await sharp(src).resize(180, 180).png().toFile(path.join(outDir, 'apple-touch-icon.png'))

console.log('Icons generated in public/icons')
