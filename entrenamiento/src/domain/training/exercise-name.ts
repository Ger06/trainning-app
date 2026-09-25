/**
 * Normalización del nombre de ejercicio para la unicidad por catálogo (RF-6).
 *
 * `[NECESITA ACLARACIÓN]` (spec.md): regla definitiva (acentos, símbolos…).
 * Provisional (plan 002, D13): recorta los extremos, colapsa los espacios
 * internos y pasa a minúsculas. Punto único de cambio — el índice único
 * `{trainerId, nameNormalized}` de `exercises` se apoya en su salida (plan D5),
 * así que cambiar la regla implica una migración de re-cálculo.
 *
 * Módulo puro (constitución P3).
 */
export function normalizeExerciseName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}
