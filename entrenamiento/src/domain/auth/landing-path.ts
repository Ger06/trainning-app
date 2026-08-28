import type { Role } from './credentials'

/**
 * Ruta a la que se lleva a la persona tras autenticarse: RF‑6 (registro con
 * auto‑login) y RF‑10 (login). Módulo puro (constitución P3).
 *
 * Punto único de cambio: los espacios por rol todavía no existen (spec 001), así
 * que hoy ambos roles aterrizan en la raíz. El `Record<Role, string>` obliga a
 * declarar una ruta por cada rol: si `Role` crece, esto deja de compilar.
 */
const LANDING_BY_ROLE: Record<Role, string> = {
  entrenador: '/',
  alumno: '/',
}

export function landingPathForRole(role: Role): string {
  return LANDING_BY_ROLE[role] ?? '/'
}
