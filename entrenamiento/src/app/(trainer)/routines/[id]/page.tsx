import { EditRoutine } from '@/components/training/EditRoutine'

export const metadata = { title: 'Editar rutina · Entrenamiento' }

export default async function EditRoutinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <div className="panel">
      <h2 className="panel__title">Editar rutina</h2>
      <EditRoutine id={id} />
    </div>
  )
}
