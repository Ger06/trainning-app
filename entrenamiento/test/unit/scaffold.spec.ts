import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

// Stack mínimo permitido por la constitución (P1): Next.js, shadcn/ui, Vitest y
// MongoDB. React / react-dom / TypeScript / @types son parte inseparable de
// "Next.js con TypeScript". Tailwind CSS + `class-variance-authority` + `clsx` +
// `tailwind-merge` son la base de "shadcn/ui" (T27–T30).
const ALLOWED = new Set([
  'next',
  'react',
  'react-dom',
  'mongodb',
  'vitest',
  'typescript',
  '@types/node',
  '@types/react',
  '@types/react-dom',
  // shadcn/ui + Tailwind
  'tailwindcss',
  '@tailwindcss/postcss',
  'postcss',
  'class-variance-authority',
  'clsx',
  'tailwind-merge',
])

// Alternativas descartadas explícitamente en plan.md (decisiones D3, D4, D5, D7
// y estrategia de tests). Su aparición rompe la constitución P1.
const FORBIDDEN = [
  'react-hook-form',
  'zod',
  'valibot',
  'next-auth',
  '@auth/core',
  'iron-session',
  'jsonwebtoken',
  'jose',
  'mongoose',
  'bcrypt',
  'bcryptjs',
  'argon2',
  'mongodb-memory-server',
  '@testing-library/react',
  '@testing-library/dom',
  '@testing-library/jest-dom',
]

const declared = () => [
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.devDependencies ?? {}),
]

describe('T1 · scaffold del proyecto', () => {
  it('define los scripts dev, test:unit y test:integration', () => {
    expect(pkg.scripts?.dev).toBeTruthy()
    expect(pkg.scripts?.['test:unit']).toBeTruthy()
    expect(pkg.scripts?.['test:integration']).toBeTruthy()
  })

  it('fija Next 16.x y el driver mongodb como dependencias', () => {
    expect(pkg.dependencies?.next).toMatch(/^\D*16\./)
    expect(pkg.dependencies?.react).toBeTruthy()
    expect(pkg.dependencies?.['react-dom']).toBeTruthy()
    expect(pkg.dependencies?.mongodb).toBeTruthy()
  })

  it('usa Vitest como runner de tests', () => {
    expect(pkg.devDependencies?.vitest).toBeTruthy()
  })

  it('no declara dependencias fuera del stack mínimo de la constitución', () => {
    for (const name of declared()) {
      expect(ALLOWED.has(name), `dependencia no permitida por la constitución: ${name}`).toBe(true)
    }
  })

  it('no declara ninguna de las alternativas descartadas en plan.md', () => {
    const present = new Set(declared())
    for (const name of FORBIDDEN) {
      expect(present.has(name), `dependencia descartada presente: ${name}`).toBe(false)
    }
  })
})
