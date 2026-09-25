import { MongoClient, type Db } from 'mongodb'

/**
 * Único módulo que instancia el driver de MongoDB (constitución P4). El resto de
 * la infraestructura recibe un `Db` ya conectado; el dominio nunca ve nada de
 * esto.
 */

export interface MongoConnection {
  readonly client: MongoClient
  readonly db: Db
  readonly close: () => Promise<void>
}

/** Primitiva reutilizable: abre una conexión nueva y aislada (tests, scripts). */
export async function connectMongo(uri: string, dbName: string): Promise<MongoConnection> {
  const client = new MongoClient(uri)
  await client.connect()
  return {
    client,
    db: client.db(dbName),
    close: () => client.close(),
  }
}

let shared: Promise<MongoConnection> | undefined

function readEnvConfig(): { uri: string; dbName: string } {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error('MONGODB_URI no está definida')
  }
  return { uri, dbName: process.env.MONGODB_DB ?? 'entrenamiento' }
}

/** Conexión compartida de la aplicación, perezosa y memoizada. */
export function getConnection(): Promise<MongoConnection> {
  if (!shared) {
    const { uri, dbName } = readEnvConfig()
    shared = connectMongo(uri, dbName)
  }
  return shared
}

export async function getDb(): Promise<Db> {
  return (await getConnection()).db
}

/** Cierra la conexión compartida (apagado de la app, limpieza de tests). */
export async function closeConnection(): Promise<void> {
  if (shared) {
    const conn = await shared
    await conn.close()
    shared = undefined
  }
}
