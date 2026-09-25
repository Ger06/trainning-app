import {
  authenticateUser,
  type AuthenticateError,
  type AuthenticateInput,
  type AuthenticateSuccess,
} from '@/domain/auth/authenticate-user'
import { logoutUser } from '@/domain/auth/logout-user'
import type { SessionStore } from '@/domain/auth/ports'
import {
  registerUser,
  type RegisterError,
  type RegisterInput,
  type RegisterSuccess,
} from '@/domain/auth/register-user'
import type { Result } from '@/domain/auth/result'
import {
  assignRoutine as runAssignRoutine,
  type AssignRoutineInput,
} from '@/domain/training/assign-routine'
import {
  createExercise as runCreateExercise,
  type CreateExerciseInput,
} from '@/domain/training/create-exercise'
import {
  createRoutine as runCreateRoutine,
  type CreateRoutineInput,
} from '@/domain/training/create-routine'
import {
  deleteExercise as runDeleteExercise,
  type DeleteExerciseInput,
} from '@/domain/training/delete-exercise'
import {
  deleteRoutine as runDeleteRoutine,
  type DeleteRoutineInput,
} from '@/domain/training/delete-routine'
import { listAssignments as runListAssignments } from '@/domain/training/list-assignments'
import { listExercises as runListExercises } from '@/domain/training/list-exercises'
import { listRoutines as runListRoutines } from '@/domain/training/list-routines'
import {
  unassignRoutine as runUnassignRoutine,
  type UnassignRoutineInput,
} from '@/domain/training/unassign-routine'
import {
  updateExercise as runUpdateExercise,
  type UpdateExerciseInput,
} from '@/domain/training/update-exercise'
import {
  updateRoutine as runUpdateRoutine,
  type UpdateRoutineInput,
} from '@/domain/training/update-routine'
import { getDb } from '@/infra/db/mongo-client'
import { createAlumnoProvisioning } from '@/infra/auth/alumno-provisioning'
import {
  resolveCurrentTrainer,
  type CurrentTrainerError,
} from '@/infra/http/current-trainer'
import { createMongoAccountRepository } from '@/infra/repositories/mongo-account-repository'
import { createMongoAssignmentRepository } from '@/infra/repositories/mongo-assignment-repository'
import { createMongoExerciseRepository } from '@/infra/repositories/mongo-exercise-repository'
import { createMongoRoutineRepository } from '@/infra/repositories/mongo-routine-repository'
import { createMongoSessionRepository } from '@/infra/repositories/mongo-session-repository'
import { createMongoTrainerClientLinkRepository } from '@/infra/repositories/mongo-trainer-client-link-repository'
import { createCookieSigner } from '@/infra/security/cookie-signer'
import { scryptPasswordHasher } from '@/infra/security/scrypt-password-hasher'
import { createSessionCookie, type SessionCookie } from '@/infra/session/cookie-session'
import { systemClock, uuidIdGenerator } from '@/infra/system'

/**
 * Composition root (constitución P4): el ÚNICO sitio que ensambla los casos de
 * uso del dominio con adaptadores concretos. Los route handlers (T23–T26) sólo
 * importan de aquí; nunca `mongodb` ni un repositorio directamente.
 */

async function authDeps() {
  const db = await getDb()
  return {
    accounts: createMongoAccountRepository(db),
    hasher: scryptPasswordHasher,
    sessions: createMongoSessionRepository(db, { ids: uuidIdGenerator, clock: systemClock }),
    clock: systemClock,
  }
}

export async function register(
  input: RegisterInput,
): Promise<Result<RegisterSuccess, RegisterError>> {
  return registerUser(input, await authDeps())
}

export async function authenticate(
  input: AuthenticateInput,
): Promise<Result<AuthenticateSuccess, AuthenticateError>> {
  const { accounts, hasher, sessions } = await authDeps()
  return authenticateUser(input, { accounts, hasher, sessions })
}

export async function logout(sessionId: string): Promise<void> {
  const { sessions } = await authDeps()
  return logoutUser(sessionId, { sessions })
}

export async function sessionStore(): Promise<SessionStore> {
  return (await authDeps()).sessions
}

let cookie: SessionCookie | undefined

export function sessionCookie(): SessionCookie {
  if (!cookie) {
    const secret = process.env.SESSION_SECRET
    if (!secret) {
      throw new Error('SESSION_SECRET no está definida')
    }
    cookie = createSessionCookie(createCookieSigner(secret))
  }
  return cookie
}

// --- Contexto de entrenamiento (spec 002) -----------------------------------

async function trainingDeps() {
  const db = await getDb()
  return {
    exercises: createMongoExerciseRepository(db),
    routines: createMongoRoutineRepository(db),
    assignments: createMongoAssignmentRepository(db),
    links: createMongoTrainerClientLinkRepository(db),
    accounts: createAlumnoProvisioning(db),
    clock: systemClock,
  }
}

/** Guard de rol `entrenador` para los handlers de entrenamiento (plan D4). */
export async function currentTrainer(
  request: Request,
): Promise<Result<{ trainerId: string }, CurrentTrainerError>> {
  const db = await getDb()
  return resolveCurrentTrainer(request, {
    readSessionId: (header) => sessionCookie().read(header),
    sessions: createMongoSessionRepository(db, { ids: uuidIdGenerator, clock: systemClock }),
    accounts: createMongoAccountRepository(db),
  })
}

export async function createExercise(input: CreateExerciseInput) {
  const { exercises, clock } = await trainingDeps()
  return runCreateExercise(input, { exercises, clock })
}

export async function updateExercise(input: UpdateExerciseInput) {
  const { exercises, clock } = await trainingDeps()
  return runUpdateExercise(input, { exercises, clock })
}

export async function deleteExercise(input: DeleteExerciseInput) {
  const { exercises, routines } = await trainingDeps()
  return runDeleteExercise(input, { exercises, routines })
}

export async function listExercises(trainerId: string) {
  const { exercises } = await trainingDeps()
  return runListExercises(trainerId, { exercises })
}

export async function createRoutine(input: CreateRoutineInput) {
  const { routines, exercises, clock } = await trainingDeps()
  return runCreateRoutine(input, { routines, exercises, clock })
}

export async function updateRoutine(input: UpdateRoutineInput) {
  const { routines, exercises, clock } = await trainingDeps()
  return runUpdateRoutine(input, { routines, exercises, clock })
}

export async function deleteRoutine(input: DeleteRoutineInput) {
  const { routines } = await trainingDeps()
  return runDeleteRoutine(input, { routines })
}

export async function listRoutines(trainerId: string) {
  const { routines } = await trainingDeps()
  return runListRoutines(trainerId, { routines })
}

export async function assignRoutine(input: AssignRoutineInput) {
  return runAssignRoutine(input, await trainingDeps())
}

export async function unassignRoutine(input: UnassignRoutineInput) {
  const { assignments } = await trainingDeps()
  return runUnassignRoutine(input, { assignments })
}

export async function listAssignments(input: {
  trainerId: string
  studentId: string
  week?: number
}) {
  const { assignments } = await trainingDeps()
  return runListAssignments(input, { assignments })
}
