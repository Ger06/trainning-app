/**
 * Re-export del módulo compartido `@/domain/shared/result` (spec 002, D12).
 * Se conserva esta ruta para no tocar el código de la spec 001 que ya importa
 * de `@/domain/auth/result`.
 */
export * from '../shared/result'
