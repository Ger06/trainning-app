import { currentTrainer, unassignRoutine } from '@/infra/container'
import { jsonResponse } from '@/lib/http/problem'
import { trainingErrorResponse } from '@/lib/http/training-error-response'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface Ctx {
  params: Promise<{ id: string }>
}

/** DELETE → quita una asignación propia, dejando el slot vacío (RF-1, RF-2, RF-27, RF-28). */
export async function DELETE(request: Request, ctx: Ctx) {
  const guard = await currentTrainer(request)
  if (!guard.ok) return trainingErrorResponse(guard.error)

  const { id } = await ctx.params
  const result = await unassignRoutine({ trainerId: guard.value.trainerId, assignmentId: id })
  if (!result.ok) return trainingErrorResponse(result.error)
  return jsonResponse(200, { ok: true })
}
