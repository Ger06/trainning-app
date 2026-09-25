import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = fileURLToPath(new URL('../../src', import.meta.url))

function filesUnder(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(join(SRC, dir), { withFileTypes: true })) {
    const rel = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...filesUnder(rel))
    else if (/\.tsx?$/.test(entry.name) && !/\.spec\.tsx?$/.test(entry.name)) out.push(rel)
  }
  return out
}

const importsOf = (relPath: string): string =>
  readFileSync(join(SRC, relPath), 'utf8')

describe('arquitectura · aislamiento de la persistencia (P4)', () => {
  it('ningún archivo bajo src/app importa el driver mongodb', () => {
    const offenders = filesUnder('app').filter((f) =>
      /from ['"]mongodb['"]|require\(['"]mongodb['"]\)/.test(importsOf(f)),
    )
    expect(offenders).toEqual([])
  })

  it('ningún archivo bajo src/app importa un repositorio de infra directamente', () => {
    const offenders = filesUnder('app').filter((f) =>
      /from ['"][^'"]*infra\/repositories/.test(importsOf(f)),
    )
    expect(offenders).toEqual([])
  })
})

describe('arquitectura · pureza del dominio (P3)', () => {
  it('ningún archivo bajo src/domain importa mongodb, react ni next', () => {
    const offenders = filesUnder('domain').filter((f) =>
      /from ['"](mongodb|react|react-dom|next)(\/[^'"]*)?['"]/.test(importsOf(f)),
    )
    expect(offenders).toEqual([])
  })
})

describe('container · composition root', () => {
  it('expone las operaciones ya cableadas', async () => {
    const mod = await import('@/infra/container')
    for (const name of ['register', 'authenticate', 'logout', 'sessionStore', 'sessionCookie']) {
      expect(typeof mod[name as keyof typeof mod]).toBe('function')
    }
  })
})
