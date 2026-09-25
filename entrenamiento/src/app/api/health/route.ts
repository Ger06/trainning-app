import { NextResponse } from 'next/server'
import { getDb } from '@/infra/db/mongo-client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Sonda de salud: confirma que la app responde y que MongoDB está accesible. */
export async function GET(_request: Request) {
  try {
    const db = await getDb()
    await db.command({ ping: 1 })
    return NextResponse.json({ status: 'ok', db: 'up' })
  } catch {
    return NextResponse.json({ status: 'degraded', db: 'down' }, { status: 503 })
  }
}
