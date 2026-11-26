import { randomUUID } from 'node:crypto'
import { chmod, lstat, mkdir, open, rename, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { isReviewer, LEGIARTI_RE } from '@bugdeloi/core'
import { readImageLock } from '@bugdeloi/runner'
import {
  defaultApi,
  digestPattern,
  families,
  git,
  isOneOf,
  nonEmpty,
  record,
  releaseReasons,
  roles,
  serviceOrigin,
  strings,
  taskIdPattern,
} from './protocol.ts'

export interface Task {
  id: string
  role: (typeof roles)[number]
  allowed_paths: string[]
  blind_to: string[]
  legal_units: { legiarti: string; text_sha256: string }[]
}

interface Lease {
  api: string
  family: (typeof families)[number]
  lease: string
  expires_at: string
  task: Task
}

const leasePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const configPath = () =>
  join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'bugdeloi', 'config.json')
export const leasePath = (cwd = process.cwd()) =>
  resolve(cwd, git(cwd, 'rev-parse', '--git-path', '.bdl-lease.json').trim())

async function privateJson(path: string, value: unknown) {
  const tmp = `${path}.${randomUUID()}`
  try {
    await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: 'wx' })
    await rename(tmp, path)
  } finally {
    await rm(tmp, { force: true })
  }
}

export async function setup({ api, handle }: { api?: string; handle?: string }) {
  for (const command of ['git', 'gh', 'podman']) {
    if (!Bun.which(command)) throw new Error(`Commande requise introuvable : ${command}.`)
  }
  if (handle !== undefined && !isReviewer(handle)) throw new Error('Pseudo GitHub invalide.')
  const image = await readImageLock()
  const path = configPath()
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  await privateJson(path, { api: serviceOrigin(api ?? defaultApi), handle, image })
  return { path, image }
}

export async function readConfig() {
  const file = Bun.file(configPath())
  if (!(await file.exists())) return { api: defaultApi, handle: undefined }
  const value: unknown = await file.json()
  if (!record(value) || !nonEmpty(value.api) || (value.handle !== undefined && !isReviewer(value.handle)))
    throw new Error('Configuration locale invalide.')
  return { api: serviceOrigin(value.api), handle: value.handle }
}

function isExpiry(value: unknown): value is string {
  return nonEmpty(value) && Number.isFinite(Date.parse(value))
}

function isTask(value: unknown): value is Task {
  return (
    record(value) &&
    typeof value.id === 'string' &&
    taskIdPattern.test(value.id) &&
    isOneOf(roles, value.role) &&
    strings(value.allowed_paths) &&
    strings(value.blind_to) &&
    Array.isArray(value.legal_units) &&
    value.legal_units.every(
      (unit: unknown) =>
        record(unit) &&
        typeof unit.legiarti === 'string' &&
        LEGIARTI_RE.test(unit.legiarti) &&
        typeof unit.text_sha256 === 'string' &&
        digestPattern.test(unit.text_sha256),
    )
  )
}

function isClaim(value: unknown): value is Pick<Lease, 'task' | 'lease' | 'expires_at'> {
  return (
    record(value) &&
    isTask(value.task) &&
    typeof value.lease === 'string' &&
    leasePattern.test(value.lease) &&
    isExpiry(value.expires_at)
  )
}

export async function readLease(path: string): Promise<Lease | null> {
  const info = await lstat(path).catch((error) => {
    if (error.code === 'ENOENT') return null
    throw error
  })
  if (!info) return null
  if (!info.isFile()) throw new Error('Le fichier de bail local doit être un fichier ordinaire.')
  if (info.mode & 0o077) await chmod(path, 0o600)
  const value: unknown = await Bun.file(path)
    .json()
    .catch(() => null)
  if (!record(value) || !nonEmpty(value.api) || !isOneOf(families, value.family)) {
    throw new Error('Fichier de bail local invalide.')
  }
  const { api, family } = value
  if (!isClaim(value)) {
    throw new Error('Fichier de bail local invalide.')
  }
  return {
    task: value.task,
    lease: value.lease,
    expires_at: value.expires_at,
    api: serviceOrigin(api),
    family,
  }
}

type Fetch = (input: URL, init: RequestInit) => Promise<Response>

export class DeskError extends Error {
  constructor(
    readonly status: number,
    readonly retryAfter?: string,
  ) {
    super(
      status === 410
        ? 'Bail clos (HTTP 410). Arrêtez le travail sur cette tâche.'
        : status === 429
          ? `Limite du guichet atteinte (HTTP 429). ${retryAfter ? `Retry-After : ${retryAfter}.` : 'Réessayez plus tard.'}`
          : `Guichet indisponible pour cette requête (HTTP ${status}).`,
    )
  }
}

export class Desk {
  constructor(
    private readonly path: string,
    private readonly request: Fetch = fetch,
  ) {}

  private async exclusive<T>(work: () => Promise<T>): Promise<T> {
    const lockPath = `${this.path}.lock`
    const lock = await open(lockPath, 'wx', 0o600).catch(() => {
      throw new Error(
        'Impossible de verrouiller le bail local. Une commande du guichet utilise peut-être ce fichier.',
      )
    })
    try {
      return await work()
    } finally {
      await lock.close()
      await rm(lockPath, { force: true })
    }
  }

  private async call(api: string, action: string, params: Record<string, string>, method: 'GET' | 'POST') {
    const url = new URL(`/desk/${action}`, api)
    url.search = new URLSearchParams(params).toString()
    const response = await this.request(url, {
      method,
      headers: method === 'POST' ? { Origin: url.origin } : undefined,
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
    }).catch(() => {
      throw new Error('Impossible de joindre le guichet.')
    })
    if (!response.ok) {
      const retry = response.headers.get('retry-after')?.trim()
      const retryAfter =
        retry && (/^\d+$/.test(retry) || Number.isFinite(Date.parse(retry))) ? retry : undefined
      throw new DeskError(response.status, retryAfter)
    }
    return response
  }

  async next(api: string, handle: string, role: string, family: string) {
    if (!isReviewer(handle) || !isOneOf(roles, role) || !isOneOf(families, family)) {
      throw new Error('Pseudo, rôle ou famille invalide.')
    }
    return this.exclusive(async () => {
      if (await readLease(this.path)) throw new Error('Un bail existe déjà. Lancez bdl beat ou bdl release.')
      const origin = serviceOrigin(api)
      const response = await this.call(origin, 'next', { handle, role, family }, 'GET')
      if (response.status === 204) return null
      const value: unknown = await response.json().catch(() => null)
      if (!isClaim(value) || value.task.role !== role) throw new Error('Réponse de réservation invalide.')
      await privateJson(this.path, {
        api: origin,
        task: value.task,
        lease: value.lease,
        expires_at: value.expires_at,
        family,
      })
      // Le brief expose les données de la tâche, jamais le champ de bail de l’enveloppe.
      return { task: value.task, expires_at: value.expires_at }
    })
  }

  private async withLease<T>(work: (lease: Lease) => Promise<T>) {
    return this.exclusive(async () => {
      const lease = await readLease(this.path)
      if (!lease) throw new Error('Aucun bail local. Lancez bdl next.')
      try {
        return await work(lease)
      } catch (error) {
        if (error instanceof DeskError && error.status === 410) await rm(this.path, { force: true })
        throw error
      }
    })
  }

  async beat() {
    return this.withLease(async (lease) => {
      const response = await this.call(lease.api, 'beat', { lease: lease.lease }, 'POST')
      const value: unknown = await response.json().catch(() => null)
      if (!record(value) || !isExpiry(value.expires_at)) throw new Error('Échéance du bail invalide.')
      await privateJson(this.path, { ...lease, expires_at: value.expires_at })
      return value.expires_at
    })
  }

  async release(reason: string) {
    if (!isOneOf(releaseReasons, reason)) throw new Error('Motif de libération invalide.')
    return this.withLease(async (lease) => {
      const response = await this.call(lease.api, 'release', { lease: lease.lease, reason }, 'POST')
      if (response.status !== 204) throw new Error('Réponse de libération inattendue.')
      await rm(this.path, { force: true })
    })
  }
}
