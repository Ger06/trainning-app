import { describe, expect, it } from 'vitest'
import {
  ACCOUNTS_COLLECTION,
  accountsJsonSchema,
  migration0001,
} from './0001-accounts-schema-and-unique-index'

describe('migración 0001 · esquema de accounts', () => {
  it('lleva el nombre versionado esperado', () => {
    expect(migration0001.name).toBe('0001-accounts-schema-and-unique-index')
    expect(ACCOUNTS_COLLECTION).toBe('accounts')
  })

  it('prohíbe propiedades no declaradas (RF-8: no cabe un campo password)', () => {
    expect(accountsJsonSchema.additionalProperties).toBe(false)
    expect(Object.keys(accountsJsonSchema.properties)).not.toContain('password')
    expect(accountsJsonSchema.required).not.toContain('password')
  })

  it('acota role al enum entrenador|alumno (RF-2, RF-7)', () => {
    expect(accountsJsonSchema.properties.role.enum).toEqual(['entrenador', 'alumno'])
  })

  it('exige minLength 2 en username y usernameNormalized (RF-3)', () => {
    expect(accountsJsonSchema.properties.username.minLength).toBe(2)
    expect(accountsJsonSchema.properties.usernameNormalized.minLength).toBe(2)
  })

  it('exige que passwordHash empiece por "scrypt$" (RF-8)', () => {
    expect(accountsJsonSchema.properties.passwordHash.pattern).toBe('^scrypt\\$')
  })

  it('exige todos los campos del documento', () => {
    expect(accountsJsonSchema.required).toEqual(
      expect.arrayContaining([
        '_id',
        'username',
        'usernameNormalized',
        'role',
        'passwordHash',
        'createdAt',
      ]),
    )
  })
})
