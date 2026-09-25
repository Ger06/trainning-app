import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const alias = {
  // Alias `@/*` -> `src/*`, en línea con tsconfig, sin plugin (constitución P1).
  '@': fileURLToPath(new URL('./src', import.meta.url)),
}

// Dos proyectos separados (constitución P5): "unit" para lógica pura y "integration"
// para flujos/endpoints. Ambos corren en entorno node: el dominio no monta
// componentes (P3). `passWithNoTests` (raíz) deja pasar un proyecto todavía vacío.
export default defineConfig({
  resolve: { alias },
  test: {
    passWithNoTests: true,
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.spec.ts', 'test/unit/**/*.spec.ts'],
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'integration',
          environment: 'node',
          include: ['test/integration/**/*.spec.ts'],
          hookTimeout: 30_000,
          testTimeout: 30_000,
        },
      },
    ],
  },
})
