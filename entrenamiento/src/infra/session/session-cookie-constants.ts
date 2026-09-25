/**
 * Constantes hoja de la cookie de sesión, sin imports: el middleware (Edge) las
 * usa sin arrastrar `node:crypto`.
 *
 * `[NECESITA ACLARACIÓN]` (spec.md): tope absoluto de la sesión. Provisional:
 * 400 días (máximo que los navegadores conservan una cookie).
 */
export const SESSION_COOKIE_NAME = 'ent_session'
export const MAX_AGE_SECONDS = 400 * 24 * 60 * 60
