/**
 * T22 · Forma única de respuesta de error JSON: `{ error, message }` con
 * `issues` opcional. `error` es un código estable; `message` es para la persona
 * (viene de `@/lib/auth-messages`).
 */

export interface ProblemBody {
  error: string
  message: string
  issues?: readonly { readonly field: string; readonly code: string }[]
}

function json(status: number, body: unknown, headers?: HeadersInit): Response {
  const merged = new Headers(headers)
  merged.set('content-type', 'application/json; charset=utf-8')
  return new Response(JSON.stringify(body), { status, headers: merged })
}

/** Respuesta JSON genérica (cuerpos de éxito, con cabeceras extra si hace falta). */
export function jsonResponse(status: number, body: unknown, headers?: HeadersInit): Response {
  return json(status, body, headers)
}

/** Respuesta de error con la forma fija. `issues` se omite si no viene. */
export function problem(status: number, body: ProblemBody): Response {
  const payload: ProblemBody =
    body.issues && body.issues.length > 0
      ? { error: body.error, message: body.message, issues: body.issues }
      : { error: body.error, message: body.message }
  return json(status, payload)
}
