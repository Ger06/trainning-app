# Plan 002 — Ejercicios y rutinas (creación y asignación por el entrenador)

> El QUÉ está en `spec.md`. Este documento es el CÓMO: estructura de módulos,
> decisiones técnicas (con su alternativa descartada) y estrategia de tests.
> Todo se valida contra `docs/constitution.md` (P1–P6) y reutiliza los patrones
> de `specs/001-registro-login/plan.md`.

## 0. Principios aplicados

| Principio | Cómo lo cumple este plan |
|---|---|
| P1 Stack mínimo | Cero dependencias nuevas. Validación a mano, sin Zod. Primitivas shadcn/ui ya presentes (+ `select`/`dialog`/`textarea` de la misma shadcn/ui si hacen falta). |
| P2 Spec antes que código | Este plan deriva 1:1 de `spec.md`; la tabla RF→parte (§3.4) no deja RF sin módulo ni test. |
| P3 Lógica separada de la interfaz | Reglas en `src/domain/training/**` (sin React/red). Componentes solo renderizan y hacen `fetch`. Guard de arquitectura ampliado. |
| P4 Dominio agnóstico de persistencia | Todo acceso a Mongo en `src/infra/repositories/mongo-*-repository.ts`; el driver solo se importa bajo `src/infra/`. |
| P5 Tests obligatorios | Unit para toda lógica nueva; integración para cada endpoint/flujo. `npm run test` en verde. |
| P6 Datos con forma explícita | Migración `0003` con `$jsonSchema` (`additionalProperties:false`, `required` completo, `enum`, `minimum`) + índices únicos. Snapshot inmutable. |

## 1. Estructura de módulos

### 1.1 Dominio — `src/domain/training/` (un solo bounded context, D1) + `src/domain/shared/`

| Archivo | Responsabilidad | RF |
|---|---|---|
| `src/domain/shared/result.ts` | `Result<T,E>`, `ok`, `err` promovidos desde `auth` (D12). `auth/result.ts` pasa a re-exportar. | — |
| `src/domain/training/limits.ts` | Constantes de topes y longitudes (punto único de cambio de las dudas abiertas). | RF-4, RF-10, RF-12, RF-13, RF-19 |
| `src/domain/training/ports.ts` | Interfaces de puertos: `ExerciseRepository`, `RoutineRepository`, `AssignmentRepository`, `TrainerClientLinkRepository`, `AccountLookup` (username→{id,role} y alta de alumno), `Clock`, `IdGenerator`. Solo tipos. | RF-2, RF-6, RF-8, RF-16, RF-21, RF-22, RF-24, RF-26 |
| `src/domain/training/errors.ts` | `TrainingError` abstracta + `readonly kind`; `InvalidTrainingInputError` (issues[]), `ExerciseNameTakenError`, `RoutineNameTakenError`, `ExerciseInUseError`, `ExerciseNotFoundError`, `RoutineNotFoundError`, `AssignmentNotFoundError`, `StudentNotFoundError` (needs-alta), `UsernameBelongsToTrainerError`, `ForbiddenError`, `UnauthenticatedError`. Unión `AnyTrainingError` + `assertNever`. | RF-1, RF-2, RF-3, RF-6, RF-8, RF-16, RF-20, RF-21, RF-23, RF-29 |
| `src/domain/training/exercise.ts` | `Exercise` / `NewExercise` (interfaces `readonly`), factories `newExercise()` / `exercise()` (invariantes: nombre ≥ 2, sin campos de prescripción). | RF-4, RF-5 |
| `src/domain/training/exercise-name.ts` | `normalizeExerciseName` (provisional `trim`→colapsar espacios→`toLowerCase`). Punto único de cambio. | RF-6 |
| `src/domain/training/parse-exercise.ts` | `parseExerciseInput(input: unknown): Result<NewExercise, InvalidTrainingInputError>` (acumula issues). | RF-3, RF-4, RF-5 |
| `src/domain/training/create-exercise.ts` | Caso de uso: valida, comprueba duplicado por catálogo, inserta. | RF-4, RF-6 |
| `src/domain/training/update-exercise.ts` | Caso de uso: verifica propiedad (`trainerId`) → si no, `ExerciseNotFoundError`; revalida; actualiza nombre/descripción. | RF-2, RF-7 |
| `src/domain/training/delete-exercise.ts` | Caso de uso: verifica propiedad; `routines.anyUsesExercise` → `ExerciseInUseError`; borra. | RF-2, RF-8 |
| `src/domain/training/list-exercises.ts` | Caso de uso: lista el catálogo del `trainerId`. | RF-2 |
| `src/domain/training/routine.ts` | `Routine` / `NewRoutine`, `Block`, `BlockExercise` (interfaces). Factories `newRoutine()` / `routine()` que congelan y validan la estructura. La rutina referencia ejercicios **por id** (vínculo vivo hasta asignar). | RF-10, RF-11, RF-12, RF-13, RF-13b, RF-14 |
| `src/domain/training/routine-name.ts` | `normalizeRoutineName`. Punto único de cambio. | RF-16 |
| `src/domain/training/parse-routine.ts` | `parseRoutineDraft(input: unknown): Result<NewRoutine, InvalidTrainingInputError>`: nombre ≥ 2 (RF-10); ≥ 1 bloque, orden explícito (RF-11); por bloque: ≥ 1 ejercicio, rondas entero ≥ 1, descanso entre rondas ≥ 0, descanso entre bloques opcional ≥ 0 (RF-12); por ejercicio: series ≥ 1, reps ≥ 1 y/o tiempo ≥ 1 (al menos uno), descanso entre series ≥ 0, descanso tras el ejercicio ≥ 0 por defecto 0 (RF-13); cuatro descansos en campos distintos (RF-13b); no dedupe de ejercicios (RF-14); rechaza rutina/bloque vacíos (RF-15); topes de `limits.ts`. | RF-3, RF-10..RF-15, RF-13b |
| `src/domain/training/create-routine.ts` | Caso de uso: `parseRoutineDraft`; comprueba que todos los `exerciseId` pertenecen al catálogo del `trainerId` (`ExerciseNotFoundError`); duplicado de nombre; inserta. | RF-2, RF-12, RF-15, RF-16 |
| `src/domain/training/update-routine.ts` | Caso de uso: verifica propiedad; revalida; sustituye la rutina. **No** toca `assignments` (colección aparte). | RF-2, RF-17 |
| `src/domain/training/delete-routine.ts` | Caso de uso: verifica propiedad; borra. No toca asignaciones. | RF-2, RF-17 |
| `src/domain/training/list-routines.ts` | Lista rutinas del `trainerId`. | RF-2 |
| `src/domain/training/slot.ts` | `Weekday` (`'lunes'…'domingo'`, ascii), `Slot { week, weekday }`, `parseSlot(input): Result<Slot, InvalidTrainingInputError>` (semana entero ≥ 1 y ≤ `MAX_WEEK`; weekday en enum). | RF-19 |
| `src/domain/training/routine-snapshot.ts` | `snapshotRoutine(routine, exercisesById): RoutineSnapshot` — copia profunda **congelada** de la rutina + nombre/descripción de cada ejercicio incrustados. | RF-24 |
| `src/domain/training/assign-routine.ts` | Caso de uso central. Input: `routineId`, `destinatarios[]` (`{ username, confirmarAlta?, passwordInicial? }`), `slots[]`. Revalida rutina (RF-20). Por destinatario resuelve vía `AccountLookup`: alumno → usa; entrenador → `rejected` (RF-23); inexistente sin `confirmarAlta` → `needsConfirmation` sin crear nada (RF-21); con `confirmarAlta` → valida credenciales con los mínimos de spec 001, crea cuenta rol `alumno` **sin sesión** (RF-21b). Registra vínculo idempotente (RF-22). Por (alumno × slot) hace `snapshotRoutine` y upsert reemplazando el slot ocupado (RF-26), acumulando `overwritten`. Resultado parcial `{ created, overwritten, needsConfirmation, rejected }`; el lote nunca aborta entero (RF-21c). | RF-18, RF-20, RF-21, RF-21b, RF-21c, RF-22, RF-23, RF-24, RF-25, RF-26 |
| `src/domain/training/unassign-routine.ts` | Caso de uso: verifica propiedad; borra la asignación (deja el slot vacío). Sin bloqueo temporal. | RF-2, RF-27, RF-28 |
| `src/domain/training/list-assignments.ts` | Lista las asignaciones del `trainerId` para un alumno / semana (vista del entrenador del mesociclo). | RF-2, RF-18 |
| `src/lib/training-messages.ts` | `messageForTrainingError(kind)` — copia de usuario, provisional español, centralizada (enchufable a i18n). | RF-29 |

Nota RF-9: la rutina guarda **referencias** a ejercicios; la asignación guarda un
**snapshot**. Por construcción, editar/borrar un ejercicio se refleja en rutinas
no asignadas y jamás en asignaciones. No requiere código dedicado; se verifica en
integración.

### 1.2 Infra — `src/infra/`

| Archivo | Responsabilidad | RF |
|---|---|---|
| `src/infra/db/migrations/0003-training-collections.ts` | `migration0003: Migration` + `$jsonSchema` y constantes de: `exercises` (`{_id,trainerId,name,nameNormalized,description?,createdAt,updatedAt}`, índice único `{trainerId:1,nameNormalized:1}`), `routines` (idem + `note?`, `blocks[]` **totalmente descrito**: `rounds` int `minimum:1`, descansos int `minimum:0`, `exercises[]` con `sets`,`reps`?,`timeSec`?,`restBetweenSetsSec`,`restAfterExerciseSec`,`note?`; índice único `{trainerId:1,nameNormalized:1}`), `assignments` (`{_id,trainerId,studentId,week:int,weekday:enum,routineSnapshot,createdAt}`, índice único `{trainerId:1,studentId:1,week:1,weekday:1}`), `trainer_client_links` (`{_id,trainerId,studentId,createdAt}`, índice único `{trainerId:1,studentId:1}`). `additionalProperties:false` en todos. | RF-5, RF-6, RF-12, RF-13, RF-16, RF-19, RF-22, RF-24, RF-26 (P6) |
| `src/infra/db/migrations/index.ts` | Añadir `migration0003` al array `migrations` y re-exportar las constantes nuevas. | — |
| `src/infra/repositories/mongo-exercise-repository.ts` | `createMongoExerciseRepository(db)`; `ExerciseDoc` local; `toExercise` (`_id`↔`id`); `E11000` → `ExerciseNameTakenError`. | RF-2, RF-6 |
| `src/infra/repositories/mongo-routine-repository.ts` | `createMongoRoutineRepository(db)`; `E11000` → `RoutineNameTakenError`; `anyUsesExercise(trainerId, exerciseId)` (consulta `blocks.exercises.exerciseId`). | RF-2, RF-8, RF-16 |
| `src/infra/repositories/mongo-assignment-repository.ts` | `createMongoAssignmentRepository(db)`; `replaceForSlot({trainerId,studentId,week,weekday}, snapshot)` con upsert que devuelve el doc previo (RF-26); `deleteOwned`, `listByStudent`. | RF-24, RF-26, RF-27 |
| `src/infra/repositories/mongo-trainer-client-link-repository.ts` | `createMongoTrainerClientLinkRepository(db)`; `ensureLink(trainerId, studentId)` idempotente (ignora duplicado). Provisional no exclusivo (D11). | RF-22 |
| `src/infra/auth/alumno-provisioning.ts` | Implementa el puerto `AccountLookup`: `findByUsername` (reutiliza `createMongoAccountRepository`) y `createAlumno({username,password})` componiendo `parseCredentials` + `newAccount` + `scryptPasswordHasher` de `src/domain/auth` / `src/infra/security`, **sin emitir sesión** (D8). | RF-21, RF-21b, RF-23 |
| `src/infra/http/current-trainer.ts` | Guard servidor: lee cookie de sesión → `sessionStore().get(id)` → carga la cuenta → `role === 'entrenador'`. Devuelve `{ trainerId }` o `UnauthenticatedError`/`ForbiddenError`. Requiere `AccountRepository.findById` (añadir si no está; solo lectura). (D4) | RF-1, RF-2, RF-3 |
| `src/infra/container.ts` | Añadir `trainingDeps()` y wrappers: `createExercise/updateExercise/deleteExercise/listExercises`, `createRoutine/updateRoutine/deleteRoutine/listRoutines`, `assignRoutine/unassignRoutine/listAssignments`, y `currentTrainer(request)`. Reutiliza `getDb`, `scryptPasswordHasher`, `systemClock`, `uuidIdGenerator`. | todos |

### 1.3 HTTP — `src/app/api/` (Route Handlers REST, D2)

| Ruta | Métodos | Delega en | RF |
|---|---|---|---|
| `src/app/api/exercises/route.ts` | `GET` lista · `POST` crea | `listExercises` · `createExercise` | RF-1, RF-2, RF-4, RF-6 |
| `src/app/api/exercises/[id]/route.ts` | `PATCH` edita · `DELETE` borra | `updateExercise` · `deleteExercise` | RF-1, RF-2, RF-7, RF-8 |
| `src/app/api/routines/route.ts` | `GET` · `POST` | `listRoutines` · `createRoutine` | RF-1, RF-2, RF-10..RF-16 |
| `src/app/api/routines/[id]/route.ts` | `PATCH` · `DELETE` | `updateRoutine` · `deleteRoutine` | RF-1, RF-2, RF-17 |
| `src/app/api/assignments/route.ts` | `GET` (por alumno/semana) · `POST` (asignación en lote) | `listAssignments` · `assignRoutine` | RF-1, RF-2, RF-18..RF-26 |
| `src/app/api/assignments/[id]/route.ts` | `DELETE` | `unassignRoutine` | RF-1, RF-2, RF-27, RF-28 |

- Cada handler: `export const runtime = 'nodejs'` + `dynamic = 'force-dynamic'`;
  primero `currentTrainer(request)`; parsea body a `unknown`; delega; traduce.
- `src/lib/http/training-error-response.ts`: `kind` → `{status, code}` —
  `InvalidTrainingInput`→422, `ExerciseNameTaken`/`RoutineNameTaken`→409,
  `ExerciseInUse`→409, `*NotFound`→404, `UsernameBelongsToTrainer`→409,
  `Unauthenticated`→401, `Forbidden`→403. Reutiliza la forma
  `{ error, message, issues? }` de `src/lib/http/problem.ts`. (RF-29)
- `POST /api/assignments` responde `200` con
  `{ created, overwritten, needsConfirmation, rejected }` (resultado parcial,
  RF-21c); `needsConfirmation` lleva el/los username a dar de alta (RF-21).

### 1.4 UI — `src/app/(trainer)/` + `src/components/training/` (P3)

- Páginas (Server Components, solo montan el cliente + navegación):
  `/exercises`, `/routines`, `/routines/new`, `/routines/[id]`, `/assign`.
- Componentes cliente (`'use client'`, `useState` + `fetch` a la API, patrón
  spec 001, **sin** Server Actions): `ExerciseCatalog`, `ExerciseForm`,
  `RoutineBuilder` (editor de bloques/ejercicios/prescripción con reordenado),
  `AssignRoutineDialog` (selección de alumnos + rejilla semana×día + confirmación
  de alta con `passwordInicial`), `StudentPlanView`.
- Usan primitivas de `src/components/ui/` (shadcn/ui); si faltan `select`,
  `dialog`, `textarea` se añaden con `npx shadcn add` (misma shadcn/ui, P1).
- Los componentes replican mínimos como *pista* de UX; la autoridad es el
  servidor (RF-3). **Sin test unitario de componentes** (P3).

### 1.5 Middleware — `src/middleware.ts`

- Añadir a `PROTECTED_PREFIXES`: `/api/exercises`, `/api/routines`,
  `/api/assignments` y las páginas de `(trainer)`. Actualizar `config.matcher`
  estático en sync. El middleware solo comprueba **presencia** de cookie (Edge);
  la verificación fuerte de rol vive en `currentTrainer` por handler (patrón de
  dos niveles, spec 001 D9). (RF-1)

### 1.6 Árbol resumen

```
src/domain/
  shared/result.ts                         (D12)
  training/
    limits.ts  ports.ts  errors.ts
    exercise.ts  exercise-name.ts  parse-exercise.ts
    create-exercise.ts  update-exercise.ts  delete-exercise.ts  list-exercises.ts
    routine.ts  routine-name.ts  parse-routine.ts
    create-routine.ts  update-routine.ts  delete-routine.ts  list-routines.ts
    slot.ts  routine-snapshot.ts
    assign-routine.ts  unassign-routine.ts  list-assignments.ts
    *.spec.ts                               (unit, co-locados)
src/infra/
  db/migrations/0003-training-collections.ts  (+ index.ts)
  repositories/mongo-{exercise,routine,assignment,trainer-client-link}-repository.ts
  auth/alumno-provisioning.ts
  http/current-trainer.ts
  container.ts                              (ampliado)
src/app/api/{exercises,routines,assignments}/**/route.ts
src/app/(trainer)/**/page.tsx
src/components/training/*.tsx
src/lib/training-messages.ts
src/lib/http/training-error-response.ts
src/middleware.ts                           (ampliado)
test/integration/{exercise,routine,assignment}-*.spec.ts  (+ _harness.ts si hace falta un helper)
```

## 2. Decisiones técnicas

### D1 — Un solo bounded context `src/domain/training/`
**Decisión:** ejercicio, rutina y asignación viven en una carpeta con un archivo
por concepto. **Por qué:** comparten tipos (la asignación referencia rutina y
ejercicio; el snapshot los mezcla); un contexto único evita imports cruzados
entre contextos. **Alternativa descartada:** tres contextos
(`exercises`/`routines`/`assignments`) — rechazada por la ceremonia de imports
cruzados sin ganancia de aislamiento real. **RF:** transversal.

### D2 — Route Handlers REST por recurso (no Server Actions)
**Decisión:** `/api/exercises`, `/api/routines`, `/api/assignments` con verbos
HTTP. **Por qué:** coherencia con spec 001 D2; contrato JSON versionable (P6);
test por invocación directa del handler sin render. **Alternativa descartada:**
Server Actions de Next o un único endpoint RPC `/api/training` — rompería el
patrón adoptado y su testeo. **RF:** RF-1, RF-18, RF-29.

### D3 — Snapshot embebido en el documento de asignación
**Decisión:** `assignments.routineSnapshot` guarda la rutina completa + nombre y
descripción de cada ejercicio, congelada. **Por qué:** RF-24 exige aislamiento
total y el público es pequeño; el snapshot es inmutable por construcción y se
sirve sin joins. **Alternativa descartada:** versionar rutinas y ejercicios
(tabla de versiones + puntero) — rechazada por complejidad (GC de versiones
huérfanas, migraciones de versión). **RF:** RF-9, RF-24, RF-25.

### D4 — Guard `currentTrainer(request)` en infra
**Decisión:** un helper resuelve sesión → cuenta → rol y devuelve `trainerId`;
lo llama cada handler de training. **Por qué:** no existe guard de rol; RF-1/RF-2
lo exigen; la verificación fuerte debe consultar el documento de sesión vivo.
**Alternativa descartada:** meter el `role` en la cookie firmada o el token de
sesión para ahorrarse el hit a Mongo — rechazada porque spec 001 D9 fijó que la
cookie solo prueba presencia; sería un dato de autorización no confiable. **RF:**
RF-1, RF-2, RF-3.

### D5 — Unicidad de nombre por entrenador con índice compuesto único
**Decisión:** índice `{ trainerId:1, nameNormalized:1 }` único en `exercises` y
`routines`; validación de dominio a mano; `E11000` → `*NameTakenError` en el
repo. **Por qué:** doble barrera (dominio + BD) contra carreras, patrón spec 001.
**Alternativa descartada:** unicidad global de nombres — contradice la spec (cada
entrenador tiene su catálogo); y verificar solo en dominio sin índice deja
carrera. **RF:** RF-6, RF-16.

### D6 — `$jsonSchema` nativo con `blocks` totalmente descrito
**Decisión:** el validador de `routines` describe el árbol anidado
(`blocks[].exercises[]`) con `additionalProperties:false`, `required`, `minimum`.
**Por qué:** P6 exige forma explícita validada en escritura; es la segunda
barrera tras `parse-routine`. **Alternativa descartada:** guardar `blocks` como
JSON opaco validado solo en el dominio — incumple P6. **RF:** RF-5, RF-12, RF-13,
RF-13b, RF-19 (P6).

### D7 — Validación a mano, sin Zod
**Decisión:** `parseExerciseInput`, `parseRoutineDraft`, `parseSlot` devuelven
`Result<T, InvalidTrainingInputError>` acumulando `issues[]` (`field` + `code`).
**Por qué:** P1 (stack mínimo) y precedente spec 001 D7. **Alternativa
descartada:** añadir Zod/valibot para el árbol anidado de la rutina — rechazada
por P1; el coste a mano es acotado. **RF:** RF-3, RF-4, RF-10..RF-15, RF-19.

### D8 — Alta de alumno vía puerto `AccountLookup`, sin emitir sesión
**Decisión:** `assign-routine` depende de un puerto que en infra compone el
repo de cuentas + el hasher scrypt + `parseCredentials`/`newAccount` de `auth`,
y crea la cuenta rol `alumno` **sin** sesión. **Por qué:** RF-21b: el alta no
inicia sesión de nadie. **Alternativa descartada:** reutilizar `registerUser` —
hace auto-login (spec 001 RF-6). **RF:** RF-21, RF-21b, RF-23.

### D9 — Confirmación de alta como dato de entrada, no como estado
**Decisión:** `POST /api/assignments` recibe por destinatario desconocido
`confirmarAlta` + `passwordInicial`; sin flag → `needsConfirmation[]` sin crear
nada; con flag → crea. El lote sigue con el resto (`{ created, overwritten,
needsConfirmation, rejected }`). **Por qué:** RF-21/RF-21c; el entrenador vive la
operación como una sola. **Alternativa descartada:** endpoint de dos fases
(`POST /api/students` y luego asignar) — parte la operación y complica "el resto
del lote continúa". **RF:** RF-21, RF-21c.

### D10 — Reemplazo de slot con `replaceOne` upsert sobre índice único
**Decisión:** índice único `{ trainerId, studentId, week, weekday }`;
`replaceForSlot` hace upsert y devuelve el doc previo para reportarlo en
`overwritten[]`. **Por qué:** RF-26 pide sobrescribir tras avisar, no bloquear.
**Alternativa descartada:** rechazar si el slot está ocupado y exigir `unassign`
previo — contradice RF-26. **RF:** RF-26.

### D11 — `trainer_client_links` como colección propia idempotente
**Decisión:** colección con índice único `{ trainerId, studentId }`; `ensureLink`
ignora el duplicado. Provisional **no exclusivo**. **Por qué:** RF-22; una
colección de vínculos es extensible (fecha, estado) para la futura spec de
vínculo formal. **Alternativa descartada:** un array `trainerIds` en el documento
`accounts` — toca el esquema de spec 001 y mezcla responsabilidades. **RF:**
RF-22.

### D12 — `result.ts` promovido a `src/domain/shared/`
**Decisión:** mover `Result`/`ok`/`err` a `src/domain/shared/result.ts`;
`auth/result.ts` re-exporta (cambio de una línea, sin cambio de comportamiento).
**Por qué:** lo comparten dos contextos. **Alternativa descartada:** duplicar el
tipo en `training` — divergencia; o moverlo del todo rompiendo imports de spec
001 sin necesidad. **RF:** —.

### D13 — Decisiones provisionales para las dudas abiertas de `spec.md`
Cada una aislada en un punto único de cambio (patrón `normalizeUsername`):

| Duda abierta | Decisión provisional | Punto único de cambio |
|---|---|---|
| Normalización de nombres | `trim` → colapsar espacios → `toLowerCase` | `exercise-name.ts`, `routine-name.ts` |
| Longitudes máximas | nombre ≤ 120, descripción/nota ≤ 2000, nota de ejercicio ≤ 500 | `limits.ts` |
| Topes numéricos | `MAX_BLOCKS`, `MAX_EXERCISES_PER_BLOCK`, `MAX_SETS`, `MAX_ROUNDS`, `MAX_REPS`, `MAX_SECONDS` | `limits.ts` |
| Nº de semanas del mesociclo | sin tope declarado; `week` entero ≥ 1, guarda `MAX_WEEK = 104` | `limits.ts`, `slot.ts` |
| Vínculo exclusivo | no exclusivo | `mongo-trainer-client-link-repository.ts::ensureLink` |
| Historial de asignaciones | no se guarda; `replaceOne` pisa | `mongo-assignment-repository.ts` |
| Carga/intensidad | solo `note` de texto libre; sin campo tipado | `routine.ts` / `parse-routine.ts` |
| Idioma | español, `training-messages.ts` centralizado, enchufable a i18n | `training-messages.ts` |

**Alternativa descartada (todas):** dejar el comportamiento indefinido hasta
resolver la duda — bloquea la implementación; se elige un valor por defecto
reversible.

## 3. Estrategia de tests

Espeja spec 001: unit `*.spec.ts` co-locado (entorno `node`, no monta React);
integración en `test/integration/*.spec.ts` con `setupIntegrationDb()` del
`_harness.ts` (Mongo real, BD efímera por archivo, se invoca el route handler con
`Request`). **Sin dependencias nuevas.** `npm run test` en verde (unit siempre;
integración se auto-salta sin `MONGODB_URI`).

### 3.1 Unit (dominio puro)

| Archivo `.spec.ts` | Casos | RF |
|---|---|---|
| `parse-exercise.spec.ts` | nombre < 2, descripción opcional, rechazo de campos de prescripción, issues acumulados | RF-3, RF-4, RF-5 |
| `create-exercise.spec.ts` | happy; duplicado por catálogo; aislamiento entre entrenadores | RF-4, RF-6 |
| `update-exercise.spec.ts` | edita nombre/descripción; no propietario → `ExerciseNotFoundError` | RF-2, RF-7 |
| `delete-exercise.spec.ts` | borra si libre; `ExerciseInUseError` si alguna rutina lo usa; no propietario | RF-2, RF-8 |
| `parse-routine.spec.ts` | rutina vacía, bloque vacío (RF-15); rondas 0, series 0; sin reps ni tiempo; reps+tiempo juntos OK; `restAfterExerciseSec` por defecto 0 y "no aplica al último"; cuatro descansos en campos distintos (RF-13b); orden preservado; ejercicio repetido (RF-14); topes de `limits.ts` | RF-3, RF-10..RF-15, RF-13b |
| `create-routine.spec.ts` / `update-routine.spec.ts` | `exerciseId` fuera del catálogo → `ExerciseNotFoundError`; nombre duplicado; update no propietario | RF-2, RF-12, RF-16, RF-17 |
| `slot.spec.ts` | semana entero ≥ 1, weekday en enum, rechazos | RF-19 |
| `routine-snapshot.spec.ts` | copia profunda congelada; incrusta nombre/descripción; mutar la rutina origen después no altera el snapshot | RF-24 |
| `assign-routine.spec.ts` | producto alumno×slot (RF-18); rutina inválida → rechazo (RF-20); desconocido sin confirmar → `needsConfirmation`, no crea (RF-21); con confirmar → crea cuenta **sin sesión** y el lote sigue (RF-21b, RF-21c); username de entrenador → `rejected` (RF-23); vínculo idempotente (RF-22); slot ocupado → `overwritten` (RF-26); reasignar → snapshot nuevo (RF-25) | RF-18, RF-20..RF-26 |
| `errors.spec.ts` | discriminante `kind` exhaustivo + `assertNever`; `messageForTrainingError` cubre todos los kinds | RF-29 |
| `0003-training-collections.spec.ts` | forma del `$jsonSchema` (required, `additionalProperties:false`, enums, `minimum`); `planMigrations` la ordena tras `0002` | RF-5, RF-12, RF-13, RF-19 (P6) |
| `pureza del módulo` (en cada `.spec` de dominio) + ampliar `test/unit/architecture.spec.ts` | `src/domain/training/**` no importa `react`/`mongodb`/`next`; `src/app/api/{exercises,routines,assignments}` no importa `mongodb` ni repos | P3, P4 |

### 3.2 Integración (Mongo real)

| Archivo `.spec.ts` | Cubre | RF |
|---|---|---|
| `mongo-exercise-repository.spec.ts` | CRUD; `_id`↔`id`; índice único por entrenador (E11000 → `ExerciseNameTakenError`); validador de BD rechaza doc mal formado | RF-2, RF-6 (P6) |
| `mongo-routine-repository.spec.ts` | CRUD; duplicado; `anyUsesExercise`; validador de BD del árbol `blocks` | RF-2, RF-8, RF-16 (P6) |
| `mongo-assignment-repository.spec.ts` | `replaceForSlot` devuelve doc previo; índice único de slot; `listByStudent`; `deleteOwned` | RF-24, RF-26, RF-27 |
| `mongo-trainer-client-link-repository.spec.ts` | `ensureLink` idempotente | RF-22 |
| `exercises-api.spec.ts` | `POST/GET/PATCH/DELETE` vía handler; sin sesión → 401; sesión de alumno → 403 (RF-1); entrenador A no ve/borra de B → 404 (RF-2); duplicado → 409 (RF-6); en uso → 409 (RF-8) | RF-1, RF-2, RF-4, RF-6, RF-7, RF-8 |
| `routines-api.spec.ts` | crear con bloques; 422 de validación (RF-11..15); 409 duplicado (RF-16); editar (RF-17); editar un ejercicio no cambia rutina ya asignada (RF-9) | RF-9, RF-10..RF-17 |
| `assignments-api.spec.ts` | siembra entrenador + alumnos con los handlers de spec 001; 2 alumnos × 2 slots → 4 asignaciones (RF-18); alumno inexistente sin confirmar → `needsConfirmation` (RF-21); con `confirmarAlta` + password → cuenta creada, **sin `Set-Cookie`** de sesión para el alumno (RF-21b), vínculo creado (RF-22); username de entrenador → `rejected` (RF-23); reasignar tras editar la rutina → snapshot viejo intacto, nuevo actualizado (RF-24, RF-25); segundo `POST` al mismo slot → `overwritten` y una sola asignación en BD (RF-26); `DELETE /api/assignments/[id]` deja el slot vacío (RF-27, RF-28) | RF-18..RF-28 |
| `training-authz.spec.ts` | matriz rol×acción: toda mutación de training → 401 sin sesión y 403 con rol alumno; scoping por `trainerId` | RF-1, RF-2, RF-3 |

Helpers: reutilizar el patrón de sembrar por handlers. Añadir a `_harness.ts`
solo `createTrainerSession()` / `seedExercise()` si aparece duplicación real; sin
carpeta de fixtures nueva; sin `mongodb-memory-server` (prohibido, P1).

### 3.3 Guards de arquitectura y scaffold

- Ampliar `test/unit/architecture.spec.ts` con las rutas nuevas (§3.1 última fila).
- `test/unit/scaffold.spec.ts`: confirmar que `package.json` **no** ganó
  dependencias (la lista prohibida sigue intacta).

### 3.4 Matriz RF → parte que lo cubre → test

| RF | Parte(s) | Test(s) |
|---|---|---|
| RF-1 | `current-trainer.ts`, middleware, todos los handlers | `training-authz.spec.ts`, `*-api.spec.ts` |
| RF-2 | `trainerId` en todos los casos de uso; repos filtran; update/delete verifican propiedad → NotFound | `update/delete-*.spec.ts`, `*-api.spec.ts`, `training-authz.spec.ts` |
| RF-3 | handlers pasan `unknown`; `parse*` primero | `architecture.spec.ts`, `parse-*.spec.ts` |
| RF-4 | `exercise.ts`, `parse-exercise.ts`, `$jsonSchema` exercises | `parse-exercise.spec.ts`, `exercises-api.spec.ts` |
| RF-5 | `$jsonSchema` `additionalProperties:false`; `exercise.ts` | `0003-*.spec.ts`, `mongo-exercise-repository.spec.ts` |
| RF-6 | `exercise-name.ts`, índice único `{trainerId,nameNormalized}`, repo E11000 | `create-exercise.spec.ts`, `mongo-exercise-repository.spec.ts`, `exercises-api.spec.ts` |
| RF-7 | `update-exercise.ts` | `update-exercise.spec.ts`, `exercises-api.spec.ts` |
| RF-8 | `delete-exercise.ts`, `routineRepo.anyUsesExercise` | `delete-exercise.spec.ts`, `mongo-routine-repository.spec.ts`, `exercises-api.spec.ts` |
| RF-9 | corolario D3 (rutina referencia; asignación snapshot) | `routines-api.spec.ts`, `assignments-api.spec.ts` |
| RF-10 | `routine.ts`, `parse-routine.ts` | `parse-routine.spec.ts`, `routines-api.spec.ts` |
| RF-11 | `routine.ts` (`blocks[]` ordenado), `parse-routine.ts` | `parse-routine.spec.ts` |
| RF-12 | `routine.ts`/`block`, `parse-routine.ts`, `$jsonSchema` routines | `parse-routine.spec.ts`, `mongo-routine-repository.spec.ts` |
| RF-13 | `routine.ts` (`BlockExercise`), `parse-routine.ts`, `$jsonSchema` | `parse-routine.spec.ts` |
| RF-13b | modelado de 4 descansos en `routine.ts`, `parse-routine.ts` | `parse-routine.spec.ts` |
| RF-14 | `parse-routine.ts` (sin dedupe) | `parse-routine.spec.ts` |
| RF-15 | `parse-routine.ts` (rechaza vacíos) | `parse-routine.spec.ts`, `routines-api.spec.ts` |
| RF-16 | `routine-name.ts`, índice único, repo E11000 | `create-routine.spec.ts`, `mongo-routine-repository.spec.ts`, `routines-api.spec.ts` |
| RF-17 | `update-routine.ts`, `delete-routine.ts` (no tocan asignaciones) | `routines-api.spec.ts`, `assignments-api.spec.ts` |
| RF-18 | `assign-routine.ts` (producto alumno×slot) | `assign-routine.spec.ts`, `assignments-api.spec.ts` |
| RF-19 | `slot.ts` `parseSlot`, `$jsonSchema` enum weekday + `week` int | `slot.spec.ts`, `0003-*.spec.ts` |
| RF-20 | `assign-routine.ts` revalida la rutina | `assign-routine.spec.ts` |
| RF-21 | `assign-routine.ts` + `AccountLookup`; `needsConfirmation` en la respuesta | `assign-routine.spec.ts`, `assignments-api.spec.ts` |
| RF-21b | `alumno-provisioning.ts` (crea sin sesión), `parseCredentials` de auth | `assign-routine.spec.ts`, `assignments-api.spec.ts` (sin `Set-Cookie`) |
| RF-21c | resultado parcial `{created,overwritten,needsConfirmation,rejected}` | `assign-routine.spec.ts` |
| RF-22 | `trainer_client_links` + `ensureLink` | `assign-routine.spec.ts`, `mongo-trainer-client-link-repository.spec.ts`, `assignments-api.spec.ts` |
| RF-23 | branch por rol en `assign-routine.ts` | `assign-routine.spec.ts`, `assignments-api.spec.ts` |
| RF-24 | `routine-snapshot.ts`, `assignments.routineSnapshot` congelado | `routine-snapshot.spec.ts`, `assignments-api.spec.ts` |
| RF-25 | `assign-routine.ts` (mismo camino, snapshot nuevo) | `assign-routine.spec.ts`, `assignments-api.spec.ts` |
| RF-26 | índice único de slot + `replaceForSlot`; `overwritten[]` | `mongo-assignment-repository.spec.ts`, `assignments-api.spec.ts` |
| RF-27 | `unassign-routine.ts`, `DELETE /api/assignments/[id]` | `assignments-api.spec.ts` |
| RF-28 | sin estado de bloqueo | `assignments-api.spec.ts` |
| RF-29 | `errors.ts` (`kind`), `training-messages.ts`, `training-error-response.ts` | `errors.spec.ts`, `*-api.spec.ts` (status/code) |

## 4. Verificación / cierre (para el PR)

1. `npm run test:unit` verde; `npm run test:integration` verde con
   `MONGODB_URI` apuntando a un `mongo:7` local; `npm run test` verde.
2. La matriz §3.4 no deja ningún RF sin al menos un test unit y/o integración.
3. `test/unit/scaffold.spec.ts` confirma que no se añadieron dependencias.
4. `test/unit/architecture.spec.ts` confirma que `src/domain/training/**` es puro
   y que los handlers no importan el driver ni repos.
5. Prueba manual end-to-end (con la app y Mongo levantados): registrar un
   entrenador, crear 2–3 ejercicios, construir una rutina con 2 bloques
   (uno multi-ejercicio con rondas), asignarla a 2 alumnos (uno existente, uno
   nuevo con alta confirmada) en (semana 1, lunes) y (semana 2, jueves), editar
   un ejercicio y comprobar que las asignaciones no cambian, reasignar y ver el
   snapshot nuevo, sobrescribir un slot y ver el aviso, quitar una asignación.
6. Las decisiones provisionales de D13 quedan listadas en el PR para que la
   resolución de cada duda abierta toque un único punto.
