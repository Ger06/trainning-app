/**
 * Normalización del nombre de rutina para la unicidad por entrenador (RF-16).
 *
 * `[NECESITA ACLARACIÓN]` (spec.md): regla definitiva (acentos, símbolos…).
 * Provisional (plan 002, D13): recorta los extremos, colapsa los espacios
 * internos y pasa a minúsculas. Punto único de cambio — el índice único
 * `{trainerId, nameNormalized}` de `routines` se apoya en su salida (plan D5).
 *
 * Módulo puro (constitución P3).
 */
export function normalizeRoutineName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}
