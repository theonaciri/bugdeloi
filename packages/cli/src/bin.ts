#!/usr/bin/env bun
import { parseArgs } from 'node:util'
import pkg from '../package.json'
import { checkContribution, parseManifest } from './checker.ts'
import { Desk, leasePath, readConfig, readLease, setup } from './desk.ts'
import { errorMessage, git, releaseReasons } from './protocol.ts'
import { replay } from './replay.ts'
import { submit, taskCheckOptions, workingChanges } from './submit.ts'

const help = `BugDeLoi — bdl

  setup [--api <origine>] [--handle <pseudo>]
  next [--api <origine>] [--handle <pseudo>] --role <rôle> --family <famille>
  beat
  release <motif>
  check [<chemin>] [--manifest <JSON>] [--commit <réf>] [--no-sandbox | --sandbox] [--pr-diff]
  replay <identifiant> [--api <origine>]
  submit --task <id> --role <rôle> --family <famille> --model <modèle> [--dry-run] [--no-sandbox]
  --help
  --version

Motifs de libération : ${releaseReasons.join(', ')}.`

const commandOptions: Record<string, readonly string[]> = {
  setup: ['api', 'handle'],
  next: ['api', 'handle', 'role', 'family'],
  beat: [],
  release: [],
  check: ['manifest', 'commit', 'sandbox', 'no-sandbox', 'pr-diff'],
  replay: ['api'],
  submit: ['task', 'role', 'family', 'model', 'dry-run', 'sandbox', 'no-sandbox'],
}

const booleanOptions = new Set(['dry-run', 'sandbox', 'no-sandbox', 'pr-diff'])

async function main([command, ...args]: string[]) {
  if (!command || command === '--help' || command === '-h') {
    console.log(help)
    return 0
  }
  if (command === '--version') {
    console.log(pkg.version)
    return 0
  }
  if (!Object.hasOwn(commandOptions, command)) throw new Error('Commande inconnue. Consultez bdl --help.')
  const options = Object.fromEntries(
    (commandOptions[command] ?? []).map((name) => [
      name,
      { type: booleanOptions.has(name) ? 'boolean' : 'string' },
    ]),
  ) as Record<string, { type: 'boolean' | 'string' }>
  const { positionals, values } = parseArgs({ args, options, allowPositionals: true })
  const maxPositionals = ['release', 'check', 'replay'].includes(command) ? 1 : 0
  if (positionals.length > maxPositionals) throw new Error('Argument positionnel inattendu.')
  const value = (name: string) => {
    const item = values[name]
    return typeof item === 'string' ? item : undefined
  }
  const required = (name: string) => {
    const item = value(name)
    if (!item?.trim()) throw new Error(`Option --${name} obligatoire.`)
    return item
  }
  const positional = (label: string) => {
    const item = positionals[0]
    if (!item) throw new Error(`${label} obligatoire.`)
    return item
  }
  if (values.sandbox && values['no-sandbox']) throw new Error('Choisissez --sandbox ou --no-sandbox.')
  const sandbox = values['no-sandbox'] ? false : undefined

  switch (command) {
    case 'setup': {
      const { path, image } = await setup({ api: value('api'), handle: value('handle') })
      console.log(`Configuration : ${path}\nCatala ${image.catala} (${image.arch}, ${image.digest}).`)
      return 0
    }
    case 'next': {
      const config = await readConfig()
      const handle = value('handle') ?? config.handle
      if (!handle) throw new Error('Option --handle obligatoire ou pseudo à enregistrer avec bdl setup.')
      const desk = new Desk(leasePath())
      const brief = await desk.next(value('api') ?? config.api, handle, required('role'), required('family'))
      console.log(brief ? JSON.stringify(brief, null, 2) : 'Aucune tâche disponible (HTTP 204).')
      return 0
    }
    case 'beat':
      console.log(`Bail prolongé jusqu’au ${await new Desk(leasePath()).beat()}.`)
      return 0
    case 'release':
      await new Desk(leasePath()).release(positional('Motif'))
      console.log('Bail libéré (HTTP 204).')
      return 0
    case 'check': {
      const prDiff = values['pr-diff'] === true
      const path = positionals[0]
      const manifestPath = value('manifest')
      const commit = value('commit')
      try {
        if (prDiff && (commit || manifestPath))
          throw new Error('En mode PR, la révision et les empreintes viennent du dépôt.')
        const manifest = manifestPath ? parseManifest(await Bun.file(manifestPath).json()) : undefined
        const cwd = process.cwd()
        const storedLeasePath = (() => {
          try {
            return leasePath(cwd)
          } catch {
            return null
          }
        })()
        const lease = !prDiff && storedLeasePath ? await readLease(storedLeasePath) : null
        const root = lease ? git(cwd, 'rev-parse', '--show-toplevel').trim() : cwd
        const scope = lease ? taskCheckOptions(lease.task, root) : undefined
        const result = await checkContribution({
          ...scope,
          cwd: root,
          path,
          manifest: manifest ?? scope?.manifest,
          commit,
          sandbox,
          prDiff,
          changedPaths: lease && !path ? workingChanges(root) : undefined,
        })
        console.log(JSON.stringify(result, null, 2))
        return result.verdict === 'ACCEPTED' ? 0 : result.verdict === 'REJECTED' ? 1 : 2
      } catch (error) {
        console.log(
          JSON.stringify({
            verdict: 'FAULT',
            diagnostics: [errorMessage(error)],
            warnings: [],
            sandbox: 'NOT_RUN',
          }),
        )
        return 2
      }
    }
    case 'replay':
      return replay(positional('Identifiant'), value('api') ?? (await readConfig()).api)
    case 'submit':
      return submit({
        task: required('task'),
        role: required('role'),
        family: required('family'),
        model: required('model'),
        dryRun: values['dry-run'] === true,
        sandbox,
      })
  }
  return 2
}

if (import.meta.main) {
  try {
    process.exitCode = await main(process.argv.slice(2))
  } catch (error) {
    console.error(errorMessage(error))
    process.exitCode = 2
  }
}
