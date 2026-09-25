import { randomUUID } from 'node:crypto'
import type { Db } from 'mongodb'
import { closeConnection, connectMongo, type MongoConnection } from '@/infra/db/mongo-client'
import { migrations } from '@/infra/db/migrations'
import { runMigrations } from '@/infra/db/migrations/migrate'

/**
 * Harness de integración (constitución P5): MongoDB **real**, sin
 * `mongodb-memory-server` (P1). Una BD única y efímera por archivo de test.
 *
 * Uso:
 *   const ctx = await setupIntegrationDb()   // en beforeAll
 *   ...
 *   await ctx.teardown()                     // en afterAll
 *
 * Asume un `setup` por archivo: Vitest aísla cada archivo en su propio proceso,
 * así que el `process.env` y la conexión compartida de `mongo-client` no se
 * pisan entre archivos.
 */

export const MONGODB_URI = process.env.MONGODB_URI
export const hasMongo = Boolean(MONGODB_URI)

export interface IntegrationContext {
  /** Conexión propia del harness a la BD efímera. */
  db: Db
  /** Nombre de la BD creada para esta ejecución. */
  dbName: string
  /** Borra la BD y cierra tanto esta conexión como la compartida de la app. */
  teardown: () => Promise<void>
}

/** Construye un `Request` POST con cuerpo JSON (y cabeceras extra, p. ej. cookie). */
export function postJson(url: string, body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

/** Del `Set-Cookie` de una respuesta al valor `nombre=valor` de la cabecera `Cookie`. */
export function requestCookie(setCookie: string | null): string {
  return (setCookie ?? '').split(';')[0]
}

export async function setupIntegrationDb(): Promise<IntegrationContext> {
  if (!MONGODB_URI) {
    throw new Error('setupIntegrationDb() requiere la variable de entorno MONGODB_URI')
  }

  const dbName = `ent_it_${randomUUID().replace(/-/g, '').slice(0, 12)}`
  const previousDbName = process.env.MONGODB_DB
  const previousSecret = process.env.SESSION_SECRET
  // El código de la app (`getDb()`) usará esta misma BD efímera.
  process.env.MONGODB_DB = dbName
  // Secreto de firma de cookies para los tests que ejercitan endpoints.
  if (!process.env.SESSION_SECRET) {
    process.env.SESSION_SECRET = 'session-secret-de-pruebas-integracion'
  }

  const conn: MongoConnection = await connectMongo(MONGODB_URI, dbName)
  await runMigrations(conn.db, migrations)

  return {
    db: conn.db,
    dbName,
    teardown: async () => {
      await conn.db.dropDatabase()
      await conn.close()
      // Resetea el memo de la conexión compartida abierta por la app durante el test.
      await closeConnection()
      if (previousDbName === undefined) {
        delete process.env.MONGODB_DB
      } else {
        process.env.MONGODB_DB = previousDbName
      }
      if (previousSecret === undefined) {
        delete process.env.SESSION_SECRET
      } else {
        process.env.SESSION_SECRET = previousSecret
      }
    },
  }
}
