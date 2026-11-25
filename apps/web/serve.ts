/**
 * Lanceur de production. adapter-node écoute par défaut sur 0.0.0.0:3000 : ici on impose
 * 127.0.0.1 (l'exposition publique passe uniquement par Cloudflare Tunnel) et le port 19069,
 * sauf surcharge explicite par HOST / PORT. Refuse 0.0.0.0 et :: (AGENTS.md §9.2).
 *
 *   bun serve.ts                         # 127.0.0.1:19069 (production)
 *   PORT=19070 DATABASE_URL=… bun serve.ts   # développement
 */
process.env.HOST ??= '127.0.0.1'
process.env.PORT ??= '19069'
if (['0.0.0.0', '::', '[::]', ''].includes(process.env.HOST)) {
  console.error(`HOST=${process.env.HOST} refusé : le site ne doit écouter que sur une interface locale.`)
  process.exit(2)
}
// Spécificateur calculé : le typecheck ne doit pas descendre dans le build généré.
const entry = new URL('./build/index.js', import.meta.url).href
await import(entry)
