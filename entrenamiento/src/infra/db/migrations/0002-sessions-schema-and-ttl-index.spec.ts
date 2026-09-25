import { describe, expect, it } from 'vitest'
import {
  SESSIONS_COLLECTION,
  SESSIONS_TTL_INDEX,
  migration0002,
  sessionsJsonSchema,
} from './0002-sessions-schema-and-ttl-index'

describe('migración 0002 · esquema de sessions', () => {
  it('lleva el nombre versionado esperado', () => {
    expect(migration0002.name).toBe('0002-sessions-schema-and-ttl-index')
    expect(SESSIONS_COLLECTION).toBe('sessions')
    expect(SESSIONS_TTL_INDEX).toBe('ttl_expiresAt')
  })

  it('prohíbe propiedades no declaradas', () => {
    expect(sessionsJsonSchema.additionalProperties).toBe(false)
  })

  it('exige _id, accountId, createdAt y expiresAt', () => {
    expect(sessionsJsonSchema.required).toEqual([
      '_id',
      'accountId',
      'createdAt',
      'expiresAt',
    ])
  })

  it('tipa createdAt y expiresAt como date (RF-14)', () => {
    expect(sessionsJsonSchema.properties.createdAt.bsonType).toBe('date')
    expect(sessionsJsonSchema.properties.expiresAt.bsonType).toBe('date')
  })

  it('tipa _id como string y accountId como objectId', () => {
    expect(sessionsJsonSchema.properties._id.bsonType).toBe('string')
    expect(sessionsJsonSchema.properties.accountId.bsonType).toBe('objectId')
  })
})
