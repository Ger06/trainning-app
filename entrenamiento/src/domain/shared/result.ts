/**
 * Resultado de una operación de dominio que puede fallar con un error tipado
 * (constitución P3). Lo devuelven las validaciones y los casos de uso en lugar
 * de lanzar. Compartido por todos los contextos de dominio (auth, training, …).
 */
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E }

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value })
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error })
