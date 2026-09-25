/**
 * Lee el cuerpo JSON de una petición como objeto. Devuelve `null` **solo** si el
 * cuerpo no es JSON válido (el handler responde 422); un JSON que no es objeto
 * se normaliza a `{}` y lo rechaza la validación del dominio (RF-3).
 */
export async function readJsonRecord(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const raw: unknown = await request.json()
    return typeof raw === 'object' && raw !== null && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {}
  } catch {
    return null
  }
}
