import { RoutineBuilder } from '@/components/training/RoutineBuilder'

export const metadata = { title: 'Nueva rutina · Entrenamiento' }

export default function NewRoutinePage() {
  return (
    <div className="panel">
      <h2 className="panel__title">Nueva rutina</h2>
      <RoutineBuilder />
    </div>
  )
}
