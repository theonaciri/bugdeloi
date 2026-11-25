#!/usr/bin/env bun
/**
 * bun packages/sweep/src/cli.ts run [--codes CGI,CSS,CCH] [--detectors a,b] [--dry-run] [--json]
 * bun packages/sweep/src/cli.ts replay <id> [--json]
 * bun packages/sweep/src/cli.ts list [--type REF_MORTE] [--subtype abrogé] [--status candidate] [--limit 50] [--json]
 * bun packages/sweep/src/cli.ts detectors
 */
import { parseArgs } from 'node:util'
import { createDb } from '@bugdeloi/db'
import { DETECTORS } from './detectors/index.ts'
import { listFindings } from './list.ts'
import { replayFinding } from './replay.ts'
import { runSweep } from './run.ts'

const USAGE = `Usage :
  sweep run [--codes CGI,CSS,CCH] [--detectors nom,nom] [--dry-run] [--json]
  sweep replay <id> [--json]
  sweep list [--type T] [--subtype S] [--status candidate] [--limit N] [--json]
  sweep detectors`

const { positionals, values } = parseArgs({
  args: Bun.argv.slice(2),
  allowPositionals: true,
  options: {
    codes: { type: 'string' },
    detectors: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
    json: { type: 'boolean', default: false },
    type: { type: 'string' },
    subtype: { type: 'string' },
    status: { type: 'string' },
    limit: { type: 'string' },
    help: { type: 'boolean', short: 'h', default: false },
  },
})

const [command, arg] = positionals
const csv = (s?: string) =>
  s
    ?.split(',')
    .map((x) => x.trim())
    .filter(Boolean)

if (values.help || !command) {
  console.log(USAGE)
  process.exit(command ? 0 : 1)
}

const { db, sql } = createDb()
try {
  switch (command) {
    case 'detectors': {
      for (const d of DETECTORS)
        console.log(`${d.name}@${d.version}  [${d.types.join(', ')}]\n  ${d.describe}`)
      break
    }
    case 'run': {
      const summary = await runSweep(db, {
        codes: csv(values.codes),
        detectors: csv(values.detectors),
        dryRun: values['dry-run'],
      })
      if (values.json) console.log(JSON.stringify(summary, null, 2))
      else {
        console.log(
          `Balayage ${summary.runId ?? '(à blanc)'} : ${Object.entries(summary.articlesChecked)
            .map(([c, n]) => `${c} ${n}`)
            .join(', ')} articles en vigueur, ${summary.durationMs} ms`,
        )
        for (const o of summary.outcomes) {
          console.log(
            `- ${o.detector} : ${o.candidates} candidats (${o.new} nouveaux, ${o.alreadyKnown} déjà connus), ${o.durationMs} ms`,
          )
          for (const [k, v] of Object.entries(o.bySubtype)) console.log(`    ${k} : ${v}`)
        }
      }
      break
    }
    case 'replay': {
      if (!arg) throw new Error(USAGE)
      const r = await replayFinding(db, arg)
      if (values.json) console.log(JSON.stringify(r, null, 2))
      else {
        console.log(`${r.id} : preuve ${r.verdict}`)
        console.log(
          `  détecteur : certificat ${r.detector.stored}, dépôt ${r.detector.current ?? '(absent)'}`,
        )
        console.log(
          `  base : ${r.legiState.same ? 'même date de projection et même lot DILA' : 'différente du certificat'}`,
        )
        if (r.differences.length) console.log(`  différences : ${r.differences.join(', ')}`)
        console.log(`  ${r.note}`)
      }
      process.exitCode = r.verdict === 'identique' ? 0 : 1
      break
    }
    case 'list': {
      const rows = await listFindings(db, {
        type: values.type,
        subtype: values.subtype,
        status: values.status,
        limit: values.limit ? Number(values.limit) : undefined,
      })
      if (values.json) console.log(JSON.stringify(rows, null, 2))
      else for (const r of rows) console.log(`${r.id}  ${r.type}/${r.subtype}  ${r.status}  ${r.claim}`)
      break
    }
    default:
      console.error(USAGE)
      process.exitCode = 1
  }
} finally {
  await sql.end({ timeout: 5 })
}
