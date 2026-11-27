import { describe, expect, test } from 'bun:test'
import { COLUMN_INFO, COLUMNS, STAGE_INFO, STAGES, stageOfRole } from '../work.ts'
import { parseTaskId } from './work.ts'

describe('parcours des tâches', () => {
  test('reconnaît les identifiants de tâche du guichet', () => {
    expect(parseTaskId('analyst-LEGIARTI000006308234')).toEqual({
      role: 'analyst',
      legiarti: 'LEGIARTI000006308234',
    })
    expect(parseTaskId('translate-LEGIARTI000038814974-v1')).toEqual({
      role: 'translate',
      legiarti: 'LEGIARTI000038814974',
    })
    for (const invalid of [
      '',
      'analyst-',
      'analyst-LEGIARTI12',
      'oracle-LEGIARTI000006308234',
      'analyst-LEGIARTI000006308234-v1',
    ]) {
      expect(parseTaskId(invalid)).toBeNull()
    }
  })

  test('chaque étape vise le niveau suivant et chaque rôle ouvert a son étape', () => {
    const order = ['N0', 'N1', 'N2', 'N3', 'N4', 'N5']
    for (const s of STAGES) {
      const info = STAGE_INFO[s]
      expect(order.indexOf(info.to)).toBe(order.indexOf(info.from) + 1)
    }
    expect(stageOfRole('analyst')).toBe('analyse')
    expect(stageOfRole('translate')).toBe('traduction')
    expect(stageOfRole('judge')).toBe('epreuve')
    expect(stageOfRole('doctrine')).toBeNull()
  })

  test('quatre colonnes, chacune définie en français courant', () => {
    expect(COLUMNS).toEqual(['todo', 'doing', 'review', 'done'])
    for (const c of COLUMNS) expect(COLUMN_INFO[c].meaning.length).toBeGreaterThan(30)
  })
})
