import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import adapter from '@sveltejs/adapter-node'
import { sveltekit } from '@sveltejs/kit/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

/**
 * L'annonceur de navigation de SvelteKit (`#svelte-announcer`, pour les lecteurs d'écran) porte un
 * attribut `style` en ligne, bloqué par `style-src 'self'`. On autorise **ce seul attribut** par
 * son empreinte (`'unsafe-hashes'` + sha256), calculée depuis la source de Kit pour suivre ses
 * mises à jour. Échoue bruyamment si la structure change.
 */
function announcerStyleHash(): `sha256-${string}` {
  const kitDir = dirname(createRequire(import.meta.url).resolve('@sveltejs/kit/package.json'))
  const root = readFileSync(join(kitDir, 'src/runtime/components/root.svelte'), 'utf8')
  const style = /id="svelte-announcer"[\s\S]*?style="([^"]+)"/.exec(root)?.[1]
  if (!style)
    throw new Error('vite.config.ts : style de #svelte-announcer introuvable (SvelteKit a changé ?)')
  return `sha256-${createHash('sha256').update(style).digest('base64')}`
}

/**
 * Les contrôles de formulaire de `@ui-sdk/svelte` (`Switch`, `SegmentedControl`…) posent un `<input>`
 * masqué visuellement via `hiddenInputStyle` dans `@ui-sdk/core`. On autorise cette seule chaîne par
 * empreinte SHA-256, sans jamais ouvrir `'unsafe-inline'`.
 */
function uiSdkHiddenInputStyleHash(): `sha256-${string}` {
  const coreDir = dirname(createRequire(import.meta.url).resolve('@ui-sdk/core/package.json'))
  const formJs = readFileSync(join(coreDir, 'dist/foundation/forms/form.js'), 'utf8')
  const style = /hiddenInputStyle\s*=\s*"([^"]+)"/.exec(formJs)?.[1]
  if (!style) throw new Error('vite.config.ts : hiddenInputStyle introuvable (@ui-sdk/core a changé ?)')
  return `sha256-${createHash('sha256').update(style).digest('base64')}`
}

/**
 * SvelteKit 3 : plus de svelte.config.js, toute la configuration passe par le plugin `sveltekit()`.
 * Le serveur de dev n'écoute que sur 127.0.0.1:19070 (19069 est réservé à la production).
 */
export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit({
      compilerOptions: { runes: true },
      adapter: adapter({ precompress: true }),
      csp: {
        // Hachages plutôt que nonces : les pages sont mises en cache à l'edge (Cloudflare),
        // un nonce servi depuis le cache serait le même pour tous les visiteurs.
        mode: 'hash',
        directives: {
          'default-src': ['none'],
          'script-src': ['self'],
          'style-src': ['self', 'unsafe-hashes', announcerStyleHash(), uiSdkHiddenInputStyleHash()],
          'img-src': ['self', 'data:'],
          'font-src': ['self'],
          'connect-src': ['self'],
          'manifest-src': ['self'],
          'base-uri': ['none'],
          'form-action': ['self'],
          'frame-ancestors': ['none'],
          'object-src': ['none'],
        },
      },
    }),
  ],
  server: { host: '127.0.0.1', port: 19070, strictPort: true },
  preview: { host: '127.0.0.1', port: 19070, strictPort: true },
})
