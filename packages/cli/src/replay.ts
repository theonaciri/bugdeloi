import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FINDING_ID_RE } from '@bugdeloi/core'
import { defaultApi, nonEmpty, record, serviceOrigin } from './protocol.ts'

function certificate(value: unknown, id: string): Record<string, unknown> | null {
  if (!record(value) || (value.id !== undefined && value.id !== id)) return null
  const data = value.certificate ?? value
  return record(data) && (record(data.pinned) || record(data.evidence) || nonEmpty(data.replay)) ? data : null
}

async function localCertificate(cwd: string, id: string) {
  const folder = join(cwd, 'replications')
  const entries = await readdir(folder, { withFileTypes: true }).catch((error) => {
    if (error.code === 'ENOENT') return []
    throw error
  })
  const dirs = [
    folder,
    ...entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(folder, entry.name))
      .sort(),
  ]
  for (const dir of dirs) {
    for (const ext of ['json', 'yaml', 'yml']) {
      const path = join(dir, `${id}.${ext}`)
      const file = Bun.file(path)
      if (!(await file.exists())) continue
      const data: unknown = ext === 'json' ? await file.json() : Bun.YAML.parse(await file.text())
      const value = certificate(data, id)
      if (!value) throw new Error(`Certificat local invalide : ${path}.`)
      return { value, source: path }
    }
  }
  return null
}

async function remoteCertificate(api: string, id: string, request: typeof fetch) {
  const origin = serviceOrigin(api)
  for (const endpoint of [`/anomalies/${id}`, `/api/findings/${id}`, `/api/findings?id=${id}`]) {
    const url = new URL(endpoint, origin)
    const response = await request(url, { redirect: 'error', signal: AbortSignal.timeout(15_000) })
    if (response.status === 404 || response.status === 400) continue
    if (!response.ok) throw new Error(`Service de certificats indisponible (HTTP ${response.status}).`)
    let value: Record<string, unknown> | null = null
    if (response.headers.get('content-type')?.includes('application/json')) {
      const data: unknown = await response.json()
      const candidates =
        record(data) && Array.isArray(data.items)
          ? data.items.filter((item: unknown) => record(item) && item.id === id)
          : [data]
      for (const item of candidates) {
        value = certificate(item, id)
        if (value) break
      }
    } else if (endpoint.startsWith('/anomalies/')) {
      // La fiche publique expose le certificat intégral et la liste API expose des résumés.
      let raw = ''
      await new HTMLRewriter()
        .on('details pre > code', {
          element(element) {
            raw = ''
            element.onEndTag(() => {
              if (value) return
              try {
                value = certificate(JSON.parse(raw), id)
              } catch {
                // Un autre bloc de code peut précéder le certificat.
              }
            })
          },
          text(chunk) {
            raw += chunk.text
          },
        })
        .transform(response)
        .text()
      if (value) {
        // HTMLRewriter conserve les entités du texte HTML. La lecture JSON ci-dessous
        // reste également nécessaire pour les réponses de serveurs qui les décodent.
        return { value, source: url.href }
      }
    }
    if (value) return { value, source: url.href }
  }
  return null
}

export async function loadCertificate(
  id: string,
  options: { cwd?: string; api?: string; request?: typeof fetch } = {},
) {
  if (!FINDING_ID_RE.test(id)) throw new Error('Identifiant de constat invalide (F-AAAA-NNNN attendu).')
  const data =
    (await localCertificate(options.cwd ?? process.cwd(), id)) ??
    (await remoteCertificate(options.api ?? defaultApi, id, options.request ?? fetch))
  if (!data) throw new Error(`Certificat introuvable pour ${id}.`)
  return data
}

const sweepCli = fileURLToPath(new URL('../../sweep/src/cli.ts', import.meta.url))

export async function replay(id: string, api?: string) {
  const { value, source } = await loadCertificate(id, { api })
  console.log(
    JSON.stringify(
      {
        id,
        source,
        type: value.type,
        status: value.status,
        claim: value.claim,
        detector: value.detector,
        legal_units: value.legal_units,
        pinned: value.pinned,
        evidence: value.evidence ?? value.proof,
        replay: value.replay,
      },
      null,
      2,
    ),
  )
  if (value.replay === `bun packages/sweep/src/cli.ts replay ${id}` && (await Bun.file(sweepCli).exists())) {
    // La commande est reconstruite à partir du programme installé et d’un identifiant validé.
    return Bun.spawn([process.execPath, sweepCli, 'replay', id], {
      stdin: 'ignore',
      stdout: 'inherit',
      stderr: 'inherit',
    }).exited
  }
  if (nonEmpty(value.replay)) console.log('La commande épinglée figure dans le certificat ci-dessus.')
  return 0
}
