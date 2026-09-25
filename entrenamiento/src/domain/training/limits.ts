/**
 * Topes y longitudes máximas del contexto de entrenamiento.
 *
 * Punto único de cambio para varias dudas abiertas de `spec.md` (plan 002, D13):
 * longitudes de texto, tamaño de rutinas/bloques, rangos numéricos de la
 * prescripción y número de semanas del mesociclo. Los valores son provisionales
 * y reversibles; cuando cada duda se resuelva, se ajusta aquí sin tocar la
 * validación que los consume.
 *
 * Módulo puro (constitución P3): solo constantes, sin dependencias.
 */

// Longitudes de texto.
export const MAX_NAME_LENGTH = 120 // nombre de ejercicio y de rutina
export const MAX_DESCRIPTION_LENGTH = 2000 // descripción de ejercicio y nota de rutina
export const MAX_EXERCISE_NOTE_LENGTH = 500 // nota por ejercicio dentro de un bloque

// Tamaño de una rutina (sesión).
export const MAX_BLOCKS = 20 // bloques por rutina
export const MAX_EXERCISES_PER_BLOCK = 20 // ejercicios por bloque

// Rangos numéricos de la prescripción.
export const MAX_SETS = 20 // series por ejercicio
export const MAX_ROUNDS = 20 // rondas por bloque
export const MAX_REPS = 1000 // repeticiones por serie
export const MAX_SECONDS = 3600 // tiempo de ejecución y cualquier descanso, en segundos

// Mesociclo.
export const MAX_WEEK = 104 // guarda de semana; sin tope de plan declarado en la spec
