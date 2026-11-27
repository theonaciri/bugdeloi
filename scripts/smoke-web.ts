#!/usr/bin/env bun
/**
 * Smoke test HTTP 200 sur toutes les routes publiques clés du site BugDeLoi.
 *
 * Usage :
 * - Contre une instance déjà en ligne : `SMOKE_BASE_URL=http://127.0.0.1:19069 bun scripts/smoke-web.ts`
 * - En CI / local après `bun run --filter @bugdeloi/web build` : démarre `apps/web/build/index.js`
 *   sur un port éphémère, vérifie chaque route, puis arrête le serveur proprement.
 */
import { existsSync } from 'node:fs'

const ROUTES = [
  '/',
  '/carte',
  '/taches',
  '/taches?role=translate',
  '/taches?role=oracle',
  '/live',
  '/methode',
  '/anomalies',
  '/journal',
  '/references',
  '/status',
  '/experiences',
  '/experiences/impot-revenu',
  '/join',
  '/join.txt',
  '/api/status.json',
]

async function waitForServer(baseUrl: string, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/api/status.json`)
      if (res.ok) return
    } catch {
      // pas encore prêt
    }
    await Bun.sleep(200)
  }
  throw new Error(`Le serveur ${baseUrl} n'a pas répondu dans les ${timeoutMs} ms.`)
}

async function main() {
  let baseUrl = process.env.SMOKE_BASE_URL?.replace(/\/$/, '') ?? ''
  let proc: ReturnType<typeof Bun.spawn> | null = null

  if (!baseUrl) {
    const entry = 'apps/web/build/index.js'
    if (!existsSync(entry)) {
      console.error(
        `[SMOKE ECHEC] ${entry} introuvable. Lancez d'abord \`bun run --filter @bugdeloi/web build\`.`,
      )
      process.exit(1)
    }
    const port = process.env.SMOKE_PORT ?? '19088'
    baseUrl = `http://127.0.0.1:${port}`
    proc = Bun.spawn(['bun', entry], {
      env: {
        ...process.env,
        HOST: '127.0.0.1',
        PORT: port,
        ORIGIN: baseUrl,
      },
      stdout: 'pipe',
      stderr: 'pipe',
    })
  }

  try {
    await waitForServer(baseUrl)
    const failures: string[] = []
    for (const route of ROUTES) {
      const res = await fetch(`${baseUrl}${route}`)
      if (res.status !== 200) {
        failures.push(`${route} -> HTTP ${res.status}`)
      }
    }
    if (failures.length > 0) {
      console.error(`[SMOKE ECHEC] ${failures.length}/${ROUTES.length} routes en échec :`)
      for (const f of failures) console.error(`  - ${f}`)
      process.exit(1)
    }
    console.log(
      `[SMOKE OK] ${ROUTES.length}/${ROUTES.length} routes publiques ont répondu HTTP 200 (${baseUrl}).`,
    )
  } finally {
    if (proc) {
      proc.kill()
      await proc.exited
    }
  }
}

await main()
