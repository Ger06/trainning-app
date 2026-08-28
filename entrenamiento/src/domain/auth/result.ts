/**
 * Resultado de una operación del dominio que puede fallar con un error tipado
 * (constitución P3). Lo devuelven las validaciones (T7) y los casos de uso
 * (T12–T14) en lugar de lanzar.
 */
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E }

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value })
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error })
