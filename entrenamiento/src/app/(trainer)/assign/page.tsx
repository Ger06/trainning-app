import { AssignRoutineDialog } from '@/components/training/AssignRoutineDialog'
import { StudentPlanView } from '@/components/training/StudentPlanView'

export const metadata = { title: 'Asignar · Entrenamiento' }

export default function AssignPage() {
  return (
    <div className="stack">
      <div className="panel">
        <h2 className="panel__title">Asignar rutina</h2>
        <AssignRoutineDialog />
      </div>
      <div className="panel">
        <h2 className="panel__title">Plan de un alumno</h2>
        <StudentPlanView />
      </div>
    </div>
  )
}
