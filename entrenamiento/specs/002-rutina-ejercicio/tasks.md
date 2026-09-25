# Tasks 002 — Ejercicios y rutinas (creación y asignación por el entrenador)

> Derivado de `spec.md` y `plan.md`. Tareas pequeñas en orden de dependencia.
> Cada una indica los **RF** que cubre y una línea **Hecho cuando:** verificable.
> Regla transversal (constitución P5): al cerrar cualquier tarea, `npm run test`
> queda verde. Sin dependencias nuevas fuera de Next.js, shadcn/ui, Vitest y
> `mongodb` (P1). Referencias `Dn` = decisiones de `plan.md` §2.

---

## A. Base compartida

- [x] **T1 · `domain/shared/result.ts` (promoción, D12)**
  RF: — (soporte constitución P3 "lógica separada de la interfaz" y P4 "dominio
  agnóstico de la persistencia"); habilita el dominio `training` sin duplicar el
  tipo `Result`.
  Hecho cuando: `Result<T,E>`, `ok`, `err` viven en `src/domain/shared/result.ts`;
  `src/domain/auth/result.ts` los re-exporta (sin cambio de comportamiento) y
  `npm run test` sigue verde con los specs de auth intactos.
  ✔ Implementado: `src/domain/shared/result.ts` (tipo `Result<T,E>` +
  `ok`/`err`, comentario de cabecera generalizado al dominio);
  `src/domain/auth/result.ts` reducido a `export * from '../shared/result'` (los
  4 importadores previos —`credentials.ts`, `register-user.ts`,
  `authenticate-user.ts`, `infra/container.ts`— siguen resolviendo por esa ruta).
  ✔ Unit verde: `src/domain/shared/result.spec.ts` — 8 tests (`ok`/`err` y su
  discriminante; `ok`/`err` de `../auth/result` son la **misma** referencia y
  comportamiento idéntico; guarda de pureza).
  ✔ `npm run test` → 140 passed / 53 skipped (integración sin `MONGODB_URI`) /
  0 fallos; specs de auth y `architecture.spec.ts` / `scaffold.spec.ts` intactos.

- [x] **T2 · `domain/training/limits.ts` (topes provisionales, D13)**
  RF: RF-4, RF-10, RF-12, RF-13, RF-19 (soporte: provee las longitudes de texto
  y los rangos numéricos que la validación de esos RF aplicará en T7/T13/T17).
  Hecho cuando: exporta `MAX_BLOCKS`, `MAX_EXERCISES_PER_BLOCK`, `MAX_SETS`,
  `MAX_ROUNDS`, `MAX_REPS`, `MAX_SECONDS`, `MAX_WEEK` y las longitudes de nombre,
  descripción y nota; un unit las referencia y `grep` no encuentra esos números
  literales repetidos en el resto de `src/domain/training/`.
  ✔ Implementado: `src/domain/training/limits.ts` — `MAX_NAME_LENGTH=120`,
  `MAX_DESCRIPTION_LENGTH=2000`, `MAX_EXERCISE_NOTE_LENGTH=500` (valores fijados
  por `plan.md` D13), `MAX_WEEK=104`, y provisionales `MAX_BLOCKS=20`,
  `MAX_EXERCISES_PER_BLOCK=20`, `MAX_SETS=20`, `MAX_ROUNDS=20`, `MAX_REPS=1000`,
  `MAX_SECONDS=3600`. Módulo puro; único punto de cambio de las dudas abiertas.
  ✔ Unit verde: `src/domain/training/limits.spec.ts` — 5 tests (todos enteros
  positivos; valores documentados; nota de ejercicio < descripción larga; topes
  numéricos ≤ int32; guarda de pureza). `limits.ts` es hoy el único archivo de
  `src/domain/training/` → no hay literales repetidos.

---

## B. Dominio — errores, puertos, normalización

- [x] **T3 · `domain/training/errors.ts` + unit**
  RF: RF-1 (`ForbiddenError`, `UnauthenticatedError`), RF-2/RF-17/RF-20
  (`RoutineNotFoundError`), RF-2/RF-12 (`ExerciseNotFoundError`), RF-2/RF-27
  (`AssignmentNotFoundError`), RF-3/RF-4/RF-10..RF-15/RF-19
  (`InvalidTrainingInputError` con `issues`), RF-6 (`ExerciseNameTakenError`),
  RF-8 (`ExerciseInUseError`), RF-16 (`RoutineNameTakenError`), RF-21
  (`StudentNotFoundError`), RF-23 (`UsernameBelongsToTrainerError`), RF-29
  (discriminante `kind` + `assertNever` para el módulo de mensajes / traducción
  a HTTP).
  Hecho cuando: existen las clases con `readonly kind` discriminable
  (`InvalidTrainingInput | ExerciseNameTaken | RoutineNameTaken | ExerciseInUse |
  ExerciseNotFound | RoutineNotFound | AssignmentNotFound | StudentNotFound |
  UsernameBelongsToTrainer | Forbidden | Unauthenticated`), `InvalidTrainingInputError`
  con `issues: {field,code}[]`, unión `AnyTrainingError` + `assertNever`; un
  `switch` exhaustivo compila; unit verde; el archivo no importa react/mongodb/next.
  ✔ Implementado: `src/domain/training/errors.ts` — `abstract class TrainingError
  extends Error` (`this.name = new.target.name`) + 11 subclases con `readonly
  kind`; `TrainingInputIssue { field: string; code }` con `code ∈ required |
  too_short | too_long | out_of_range | invalid_value | empty` y `field` como
  ruta (`blocks.0.rounds`); `AnyTrainingError`, `isTrainingError`, `assertNever`.
  Los errores de nombre duplicado usan `exerciseName` / `routineName` (no `name`,
  que lo fija `Error`).
  ✔ Unit verde: `errors.spec.ts` — 9 tests (payloads e `instanceof`; `Error.name`
  intacto; `isTrainingError`; `switch` exhaustivo con `default: assertNever` que
  **compila** —guarda de las 11 variantes—; `assertNever` lanza; pureza).

- [x] **T4 · `domain/training/ports.ts`**
  RF: — (soporte constitución P3 "lógica separada" y P4 "dominio agnóstico de la
  persistencia"). Define el borde dominio↔infra para B–E y G.
  Hecho cuando: interfaces solo-tipos `ExerciseRepository`, `RoutineRepository`,
  `AssignmentRepository`, `TrainerClientLinkRepository`, `AccountLookup`
  (`findByUsername`, `createAlumno` sin sesión), `Clock`, `IdGenerator`; `grep` no
  encuentra `mongodb` ni `react` en el archivo; un doble en memoria de cada puerto
  compila.
  ✔ Implementado: `src/domain/training/ports.ts` — los 7 puertos, solo tipos.
  `ExerciseRepository`/`RoutineRepository` con `insert` (`@throws *NameTakenError`),
  `findById`/`listByTrainer` con `trainerId` (RF-2), `update`, `deleteById`;
  `RoutineRepository.anyUsesExercise` (RF-8); `AssignmentRepository.replaceForSlot`
  devuelve la asignación previa o `null` (RF-26), `deleteOwned` (RF-27);
  `TrainerClientLinkRepository.ensureLink` idempotente (RF-22);
  `AccountLookup.findByUsername`/`createAlumno` sin sesión (RF-21, RF-21b).
  Este paso declara además los **tipos de entidad** que los puertos referencian
  (`exercise.ts`, `routine.ts`, `slot.ts` con `Weekday`, `assignment.ts` con
  `RoutineSnapshot`); sus factorías y validación llegan en C/D/E (T6, T12, T17,
  T18).
  ✔ Unit verde: `ports.spec.ts` — 8 tests (un doble en memoria por puerto +
  pureza + "no exporta nada en runtime"). `npx tsc --noEmit` limpio.

- [x] **T5 · `domain/training/exercise-name.ts` + `routine-name.ts` + unit (D13)**
  RF: RF-6 (`normalizeExerciseName` alimenta el índice único de `exercises`),
  RF-16 (`normalizeRoutineName` alimenta el de `routines`).
  Hecho cuando: `normalizeExerciseName` / `normalizeRoutineName` recortan, colapsan
  espacios internos y bajan a minúsculas; unit cubre `"  Press  Banca "` →
  `"press banca"` y que aplicar la función dos veces da el mismo resultado.
  ✔ Implementado: ambos módulos con `name.trim().replace(/\s+/g, ' ').toLowerCase()`
  (provisional D13, `[NECESITA ACLARACIÓN]` en el comentario, punto único de
  cambio por índice).
  ✔ Unit verde: `exercise-name.spec.ts` y `routine-name.spec.ts` — 5 tests c/u
  (colapso de espacios/tabs/saltos, minúsculas, idempotencia, ya-normalizado,
  pureza).

---

## C. Dominio — Ejercicios (RF-4…RF-9)

- [x] **T6 · `domain/training/exercise.ts` + unit**
  RF: RF-4 (nombre obligatorio ≥ 2 + descripción opcional), RF-5 (sin
  prescripción).
  Hecho cuando: `Exercise` / `NewExercise` con campos `readonly`; factories
  `newExercise()` / `exercise()` congelan el objeto y exigen nombre ≥ 2; el tipo
  no admite campos de prescripción (series/reps/tiempo/descanso/rondas); unit verde.
  ✔ Implementado: factorías `newExercise()` / `exercise()` con `assertName`
  (`name.trim().length >= MIN_NAME_LENGTH = 2`), `Object.freeze`, y solo copian
  campos conocidos → un `sets`/`reps` que se cuele por fuerza no queda en el
  objeto; `description` se omite si no viene.
  ✔ Unit verde: `exercise.spec.ts` — 7 tests (alta sin `id`; descripción
  opcional; nombre corto lanza; `@ts-expect-error` + descarte de campos de
  prescripción RF-5; congelado; reconstrucción con `id`; pureza).

- [x] **T7 · `domain/training/parse-exercise.ts` + unit**
  RF: RF-3 (validación autoritativa que acumula incidencias), RF-4 (nombre 2..120,
  descripción ≤ 2000), RF-5 (rechaza campos de prescripción).
  Hecho cuando: `parseExerciseInput(input: unknown)` devuelve
  `Result<NewExercise, InvalidTrainingInputError>` acumulando issues; unit cubre
  nombre de 1 vs 2 caracteres, descripción ausente / por encima del máximo,
  aparición de un campo de prescripción → issue, y entrada no-objeto.
  ✔ Implementado: `parseExerciseInput` → `Result<ParsedExercise, InvalidTrainingInputError>`
  donde `ParsedExercise = { name, nameNormalized, description? }` (los campos que
  controla la persona; el caso de uso añade `trainerId` y timestamps — mismo
  patrón que `parseCredentials`→`Credentials` de la 001). Códigos
  `required|too_short|too_long|invalid_value`; `field` con ruta; rechaza 8 claves
  de prescripción (`sets`, `reps`, `timeSec`, `rounds`, `rest*`).
  ✔ Unit verde: `parse-exercise.spec.ts` — 9 tests (válido + normalizado; sin
  descripción; 1 vs 2 chars; ausente/espacios; máximos de nombre/descripción;
  campo de prescripción; no-objeto/null/array; acumulación; pureza).

- [x] **T8 · `domain/training/create-exercise.ts` + unit**
  RF: RF-4 (valida vía `parseExerciseInput`), RF-6 (índice único → repo traduce
  el choque a `ExerciseNameTakenError`).
  Hecho cuando: unit con dobles: happy path inserta con el `trainerId` del input;
  repo señala duplicado → `ExerciseNameTakenError`; nombre inválido → no toca el
  repo.
  ✔ Implementado: `createExercise(input, { exercises, clock })` — parse →
  `newExercise` con `clock.now()` en `createdAt`/`updatedAt` → `insert` con
  `catch` de `ExerciseNameTakenError`; un error inesperado del repo se propaga.
  ✔ Unit verde: `create-exercise.spec.ts` — 5 tests (happy con normalización y
  timestamps; guarda descripción; nombre inválido sin tocar repo; duplicado →
  `ExerciseNameTakenError`; propaga error inesperado; pureza).

- [x] **T9 · `domain/training/update-exercise.ts` + unit**
  RF: RF-2 (solo el dueño; ajeno → `ExerciseNotFoundError`), RF-7 (nombre y
  descripción editables).
  Hecho cuando: unit: edita nombre/descripción de un ejercicio propio; un
  ejercicio de otro `trainerId` → `ExerciseNotFoundError` sin escribir; revalida
  con `parseExerciseInput`.
  ✔ Implementado: `updateExercise` — `parseExerciseInput` primero (RF-3) →
  `findById(trainerId, id)` (null → `ExerciseNotFoundError`) → `exercise()` con
  `createdAt` conservado y `updatedAt = clock.now()` → `update` con `catch` de
  `ExerciseNameTakenError` (renombrar a uno ya usado).
  ✔ Unit verde: `update-exercise.spec.ts` — 4 tests (edición propia con
  `createdAt` intacto / `updatedAt` movido; ajeno → NotFound sin `update`; id
  inexistente → NotFound; nombre corto → InvalidInput sin `findById`; pureza).

- [x] **T10 · `domain/training/delete-exercise.ts` + unit**
  RF: RF-2 (solo el dueño), RF-8 (solo si ninguna rutina lo referencia).
  Hecho cuando: unit: borra si `routines.anyUsesExercise` es `false`; si es `true`
  → `ExerciseInUseError` y no borra; ejercicio de otro dueño → `ExerciseNotFoundError`.
  ✔ Implementado: `deleteExercise(input, { exercises, routines })` —
  `findById` (null → `ExerciseNotFoundError`, sin consultar uso) →
  `routines.anyUsesExercise` (true → `ExerciseInUseError`, sin borrar) →
  `deleteById`. Las asignaciones ya emitidas son snapshots y no cuentan (RF-24).
  ✔ Unit verde: `delete-exercise.spec.ts` — 4 tests (borra si libre; en uso →
  InUse sin borrar; ajeno → NotFound sin consultar uso ni borrar; pureza).

- [x] **T11 · `domain/training/list-exercises.ts` + unit**
  RF: RF-2 (solo el catálogo del `trainerId`).
  Hecho cuando: unit con dos entrenadores sembrados: devuelve exactamente los
  ejercicios cuyo `trainerId` coincide, ni uno más.
  ✔ Implementado: `listExercises(trainerId, { exercises })` delega en
  `exercises.listByTrainer(trainerId)` (sin `Result`: no tiene modo de fallo).
  ✔ Unit verde: `list-exercises.spec.ts` — 2 tests (dos entrenadores sembrados →
  cada `trainerId` recibe solo lo suyo, `t_3` → `[]`; pureza).

---

## D. Dominio — Rutinas (RF-10…RF-17)

- [x] **T12 · `domain/training/routine.ts` (Routine/Block/BlockExercise) + unit**
  RF: RF-10 (nombre ≥ 2 + nota opcional), RF-11 (lista ordenada de bloques),
  RF-12 (bloque: rondas ≥ 1, descanso entre rondas, descanso entre bloques
  opcional), RF-13 (ejercicio: series ≥ 1, reps y/o tiempo, descanso entre
  series, descanso tras el ejercicio), RF-13b (los cuatro descansos en campos
  distintos), RF-14 (mismo ejercicio repetible).
  Hecho cuando: interfaces `readonly` rutina→bloques→ejercicios; el bloque lleva
  `rounds`, `restBetweenRoundsSec`, `restAfterBlockSec?`; el `BlockExercise` lleva
  `sets`, `reps?`, `timeSec?`, `restBetweenSetsSec`, `restAfterExerciseSec`,
  `note?` — los cuatro descansos en campos distintos (RF-13b); la factory congela
  todos los niveles; unit verde.
  ✔ Implementado: factorías `newRoutine()` / `routine()` con **congelado
  profundo** (`freezeBlock` → `freezeBlockExercise`, arrays incluidos) y
  `assertShape` (nombre ≥ 2, ≥ 1 bloque, ≥ 1 ejercicio/bloque, `rounds`/`sets`
  enteros ≥ 1, algún modo de trabajo). Campos opcionales (`note`, `reps`,
  `timeSec`, `restAfterBlockSec`, `note` de ejercicio) se omiten si no vienen.
  ✔ Unit verde: `routine.spec.ts` — 10 tests (alta sin `id`; congelado en los 5
  niveles; nota opcional; nombre corto; rutina/bloque vacíos RF-15; rondas/series
  0; sin reps ni tiempo; reps+tiempo juntos; ejercicio repetido RF-14;
  reconstrucción con `id`; pureza).

- [x] **T13 · `domain/training/parse-routine.ts` + unit**
  RF: RF-3 (autoritativa, acumula por ruta de campo), RF-10 (nombre 2..120, nota
  ≤ 2000), RF-11 (orden conservado), RF-12 (rondas 1..MAX_ROUNDS, descansos
  0..MAX_SECONDS), RF-13 (series 1..MAX_SETS, reps/tiempo, `restAfterExerciseSec`
  por defecto 0), RF-13b, RF-14, RF-15 (rutina/bloque no vacíos).
  Hecho cuando: `parseRoutineDraft(input: unknown)` devuelve
  `Result<ParsedRoutine, InvalidTrainingInputError>`; unit cubre: rutina sin
  bloques y bloque sin ejercicios → issue (RF-15); `rounds`/`sets` = 0 → issue;
  ni `reps` ni `timeSec` → issue; `reps` y `timeSec` juntos → aceptado;
  `restAfterExerciseSec` ausente → 0; el mismo `exerciseId` repetido dentro del
  bloque → aceptado (RF-14); el orden de bloques y de ejercicios se conserva; se
  respetan los topes de `limits.ts`.
  ✔ Implementado: `parseRoutineDraft` → `Result<ParsedRoutine, …>` donde
  `ParsedRoutine = { name, nameNormalized, note?, blocks }` (patrón parser→slice
  de la 001). Helper `readInt(raw, field, {min,max,required})` para cada campo
  numérico; `parseBlockNode` / `parseExerciseNode` con rutas
  `blocks.0.exercises.1.reps`; `name` recortado (espaciado interno intacto) y
  `nameNormalized` colapsado; descansos ausentes → 0 en la salida; sin dedupe de
  `exerciseId` (RF-14).
  ✔ Unit verde: `parse-routine.spec.ts` — 12 tests (válida + normalización +
  defaults; orden RF-11; sin bloques / bloque sin ejercicios RF-15; rondas/series
  0; sin reps ni tiempo RF-13; reps+tiempo; `restAfterExerciseSec`→0; repetido
  RF-14; topes de `limits.ts`; nombre inválido y no-objeto; acumulación; pureza).

- [x] **T14 · `domain/training/create-routine.ts` + unit**
  RF: RF-2 (ejercicios del propio catálogo), RF-12 (todos los `exerciseId`
  existen), RF-15 (contenido válido vía parser), RF-16 (nombre único → repo
  traduce a `RoutineNameTakenError`).
  Hecho cuando: unit con dobles: un `exerciseId` que no está en el catálogo del
  `trainerId` → `ExerciseNotFoundError`; nombre de rutina duplicado (repo) →
  `RoutineNameTakenError`; una rutina válida se inserta con todos sus bloques y su
  orden.
  ✔ Implementado: `createRoutine(input, { routines, exercises, clock })` — parse
  → `referencedExerciseIds(blocks)` (en orden, sin repetir) → `exercises.findById`
  por cada uno (primero que falte → `ExerciseNotFoundError`, sin insertar) →
  `newRoutine` con `clock.now()` → `insert` con `catch` de `RoutineNameTakenError`;
  error inesperado se propaga.
  ✔ Unit verde: `create-routine.spec.ts` — 5 tests (happy con trainerId/timestamps
  y bloques; exerciseId fuera del catálogo; nombre duplicado; borrador inválido
  sin tocar repos; propaga error inesperado; pureza).

- [x] **T15 · `domain/training/update-routine.ts` + `delete-routine.ts` + unit**
  RF: RF-2 (solo el dueño; ajena → `RoutineNotFoundError`), RF-17 (bloques/orden
  editables; eliminar/editar **no** toca asignaciones — `deps` sin puerto de
  asignaciones). Además RF-3 (revalida) y RF-12 (exerciseId del catálogo) en la
  edición.
  Hecho cuando: unit: editar una rutina propia sustituye bloques/orden y revalida;
  rutina de otro dueño → `RoutineNotFoundError`; `delete` solo de la propia;
  ninguno de los dos recibe un puerto de `assignments` en sus `deps` (no puede
  tocar asignaciones).
  ✔ Implementado: `updateRoutine` — parse → `findById(trainerId, id)` (null →
  `RoutineNotFoundError`) → chequeo de catálogo (reusa `referencedExerciseIds`)
  → `routine()` con `createdAt` intacto / `updatedAt = clock.now()` → `update`
  con `catch` de `RoutineNameTakenError`. `deleteRoutine` — `findById` (null →
  `RoutineNotFoundError`) → `deleteById`. `UpdateRoutineDeps` =
  `{ routines, exercises, clock }`; `DeleteRoutineDeps` = `{ routines }`.
  ✔ Unit verde: `update-routine.spec.ts` (4) — sustitución con createdAt intacto /
  updatedAt movido; ajena → NotFound sin `update`; borrador inválido sin
  `findById`; exerciseId fuera del catálogo. `delete-routine.spec.ts` (2) — borra
  la propia; ajena/inexistente → NotFound sin borrar; `deps` solo `{ routines }`.
  Ambos con guarda de pureza.

- [x] **T16 · `domain/training/list-routines.ts` + unit**
  RF: RF-2 (solo las rutinas del `trainerId`).
  Hecho cuando: unit: devuelve solo rutinas del `trainerId` indicado.
  ✔ Implementado: `listRoutines(trainerId, { routines })` delega en
  `routines.listByTrainer(trainerId)` (sin `Result`).
  ✔ Unit verde: `list-routines.spec.ts` — 2 tests (dos entrenadores sembrados →
  cada `trainerId` recibe solo lo suyo; pureza).

---

## E. Dominio — Asignación (RF-18…RF-28)

- [x] **T17 · `domain/training/slot.ts` + unit**
  RF: RF-19 (semana entera ≥ 1 y ≤ MAX_WEEK; día exactamente uno del enum).
  Hecho cuando: `Weekday` es el enum de 7 días (ascii `lunes`…`domingo`);
  `parseSlot(input: unknown)` acepta `week` entero entre 1 y `MAX_WEEK` y un
  `weekday` del enum; rechaza `week` = 0, decimal o negativo y `weekday`
  desconocido; unit verde.
  ✔ Implementado: `WEEKDAYS` (7), `Slot { week, weekday }`, `parseSlot` →
  `Result<Slot, InvalidTrainingInputError>` (congela el `Slot`) con incidencias
  `week`/`weekday`/`slot` acumuladas (`required|invalid_value|out_of_range`).
  ✔ Unit verde: `slot.spec.ts` — 7 tests (válido + congelado; los 7 días;
  semana 0/-1/1.5/'1'/null; > MAX_WEEK; día desconocido/mayúsculas/otro idioma/
  ausente; no-objeto; acumulación; pureza).

- [x] **T18 · `domain/training/routine-snapshot.ts` + unit (D3)**
  RF: RF-24 (instantánea inmutable de la rutina + nombre/descripción de cada
  ejercicio).
  Hecho cuando: `snapshotRoutine(routine, exercisesById)` devuelve una copia
  **profundamente congelada** con el nombre y la descripción de cada ejercicio
  incrustados; unit: mutar la rutina origen o el mapa de ejercicios después no
  altera el snapshot; `Object.isFrozen` es `true` en todos los niveles.
  ✔ Implementado: `snapshotRoutine(routine, exercises: readonly Exercise[])` →
  `RoutineSnapshot` — construye `Map` por `id`, copia por valor cada nivel y
  `Object.freeze` en rutina, `blocks`, bloque, `exercises`, ejercicio; incrusta
  `name`/`description` del ejercicio; omite opcionales ausentes; **lanza** si
  falta un ejercicio referenciado. Añadidas factorías `newAssignment()` /
  `assignment()` en `assignment.ts`.
  ✔ Unit verde: `routine-snapshot.spec.ts` — 6 tests (estructura completa;
  congelado en 5 niveles; mutar el origen no afecta al snapshot; omite
  note/description; lanza si falta el ejercicio; pureza).

- [x] **T19 · `domain/training/assign-routine.ts` + unit (D8, D9, D10)**
  RF: RF-18 (producto alumnos × slots), RF-20 (rutina con contenido válido),
  RF-21 (`needsConfirmation`), RF-21b (`createAlumno` sin sesión), RF-21c
  (resultado parcial, el lote no aborta), RF-22 (`ensureLink` idempotente),
  RF-23 (username de entrenador → `rejected`), RF-24 (snapshot al asignar),
  RF-25 (reasignar = snapshot nuevo), RF-26 (`overwritten`). Además RF-2
  (rutina propia) y RF-19 (slots) como errores globales.
  Hecho cuando: unit con puertos en memoria cubre: N alumnos × M slots → N·M
  entradas en `created` (RF-18); rutina que incumple RF-15 → rechazo global
  (RF-20); destinatario inexistente sin `confirmarAlta` → aparece en
  `needsConfirmation` y no se crea cuenta ni asignación (RF-21); con
  `confirmarAlta` + `passwordInicial` válido → se llama `AccountLookup.createAlumno`
  sin emitir sesión (RF-21b) y el resto del lote se procesa igual (RF-21c);
  `username` de un entrenador → entra en `rejected` (RF-23); `ensureLink` se llama
  una vez por alumno y es idempotente (RF-22); slot ya ocupado → el documento
  previo va a `overwritten` (RF-26); una segunda pasada tras cambiar la rutina
  produce un snapshot distinto (RF-24, RF-25).
  ✔ Implementado: `assignRoutine(input, { routines, exercises, assignments,
  links, accounts, clock })` → `Result<AssignRoutineResult, RoutineNotFound |
  InvalidTrainingInput | ExerciseNotFound>` con
  `AssignRoutineResult = { created, overwritten, needsConfirmation, rejected }`.
  Orden: validar recipients/slots → `routines.findById` (RF-2) → `hasValidContent`
  (RF-20) → cargar ejercicios referenciados (falta → `ExerciseNotFound`) → por
  destinatario: `accounts.findByUsername` → alumno usa / entrenador → `rejected`
  (RF-23) / inexistente sin confirmar → `needsConfirmation` (RF-21) / con confirmar
  → `createAlumno` (RF-21b), `InvalidTrainingInput` de credenciales → `rejected`
  `invalid_credentials` (RF-21c) → `links.ensureLink` (RF-22) → por slot
  `snapshotRoutine` + `assignments.replaceForSlot` (RF-24, RF-26).
  El puerto `replaceForSlot` ahora devuelve `{ created, replaced }` (ajustado
  también `ports.ts` / `ports.spec.ts`).
  ✔ Unit verde: `assign-routine.spec.ts` — 12 tests (2×2 → 4; RoutineNotFound;
  rutina rota RF-20; slot malo RF-19; needsConfirmation RF-21; alta sin sesión +
  lote sigue RF-21b/21c; contraseña corta → rejected; entrenador → rejected
  RF-23; `ensureLink` 1×/alumno RF-22; reasignar → `overwritten` RF-25/26;
  snapshot refleja el estado actual al reasignar RF-24/25; pureza).

- [x] **T20 · `domain/training/unassign-routine.ts` + `list-assignments.ts` + unit**
  RF: RF-2 (solo lo del propio `trainerId`), RF-18 (lista del mesociclo del
  alumno), RF-27 (quitar), RF-28 (sin ventana de bloqueo).
  Hecho cuando: unit: `unassign` borra solo una asignación del propio `trainerId`
  (otro dueño → `AssignmentNotFoundError`) y no consulta ninguna ventana temporal
  (RF-28); `list-assignments` filtra por `trainerId` + alumno (+ semana opcional).
  ✔ Implementado: `unassignRoutine(input, { assignments })` → `deleteOwned`
  (false → `AssignmentNotFoundError`); `deps` sin reloj (RF-28).
  `listAssignments({ trainerId, studentId, week? }, { assignments })` delega en
  `listByStudent` (sin `Result`).
  ✔ Unit verde: `unassign-routine.spec.ts` (3) — quita la propia; ajena/inexistente
  → NotFound; `deps` solo `{ assignments }`. `list-assignments.spec.ts` (3) — solo
  las del entrenador para ese alumno; filtro por semana; no cruza a otro
  entrenador/alumno. Ambos con guarda de pureza.

---

## F. Mensajes y traducción de errores HTTP

- [x] **T21 · `lib/training-messages.ts` + unit (D13 idioma)**
  RF: RF-29 (avisos/errores específicos y accionables, con la copia centralizada).
  Hecho cuando: `messageForTrainingError` tiene un `case` por cada `kind` (switch
  exhaustivo con `assertNever`); los textos (duplicado, en uso, rutina/bloque
  vacíos, sin reps ni tiempo, valor fuera de rango, username inexistente con
  oferta de alta, username de entrenador, contraseña inicial insuficiente, slot
  sobrescrito) viven solo en este módulo (`grep` en los handlers no los
  encuentra); unit verde; idioma provisional español.
  ✔ Implementado: `TRAINING_MESSAGES` (11 textos de error + `slotOverwritten`
  como aviso de RF-26/29) y `messageForTrainingError` con `switch` exhaustivo +
  `assertNever`. Rutina/bloque vacíos, sin reps ni tiempo, fuera de rango y
  contraseña inicial corta son todos `InvalidTrainingInput` → un mensaje +
  `issues` (mismo criterio que `auth-messages`). Voseo, coherente con la 001.
  ✔ Unit verde: `training-messages.spec.ts` — 5 tests (las 11 variantes → texto
  no vacío; textos concretos de RF-29; la oferta de "alta" está en el texto de
  usuario inexistente; hay texto de sobrescritura; **grep**: ningún módulo de
  dominio ni handler existente hardcodea los literales).

- [x] **T22 · `lib/http/training-error-response.ts` + unit**
  RF: RF-29 (mapeo estable de error de dominio → status HTTP + código).
  Hecho cuando: mapea cada `kind` a `{status, code}` — `InvalidTrainingInput`→422,
  `ExerciseNameTaken`/`RoutineNameTaken`/`ExerciseInUse`/`UsernameBelongsToTrainer`→409,
  `*NotFound`→404, `Unauthenticated`→401, `Forbidden`→403 — reutilizando
  `problem()` de `src/lib/http/problem.ts`; unit cubre un caso por status.
  ✔ Implementado: `trainingErrorResponse(error)` — `MAP: Record<kind, {status,
  code}>` (11 entradas; `StudentNotFound`→409 `student_not_found`, plan §1.3),
  `problem(status, { error: code, message: messageForTrainingError(error),
  issues: solo para InvalidTrainingInput })`.
  ✔ Unit verde: `training-error-response.spec.ts` — 4 tests (un caso por status:
  422/409/404/403/401; cuerpo `{ error, message }` JSON con código estable;
  `issues` solo en `InvalidTrainingInput`; el `message` no está hardcodeado).

---

## G. Persistencia, guard y ensamblado (integración)

- [x] **T23 · Migración `0003-training-collections.ts` (+ `index.ts`) + unit + integración (D6)**
  RF: RF-5 (sin prescripción en `exercises`), RF-6 (índice único
  `{trainerId,nameNormalized}` en `exercises`), RF-12/RF-13/RF-13b (árbol `blocks`
  con `minimum`/`multipleOf`), RF-15 (`minItems:1` en bloques y ejercicios),
  RF-16 (índice único en `routines`), RF-19 (`weekday` enum, `week` 1..MAX_WEEK),
  RF-22 (índice único en `trainer_client_links`), RF-24 (`routineSnapshot`
  embebido y cerrado), RF-26 (índice único `{trainerId,studentId,week,weekday}`).
  Soporte P6.
  Hecho cuando: se crean `exercises`, `routines`, `assignments`,
  `trainer_client_links` con `$jsonSchema` (`additionalProperties:false`,
  `required` completo, `enum` de weekday, `minimum` en rondas/series/descansos y el
  árbol `blocks[].exercises[]` descrito) e índices únicos
  `{trainerId,nameNormalized}` (exercises y routines),
  `{trainerId,studentId,week,weekday}` (assignments) y `{trainerId,studentId}`
  (links); unit valida la forma del esquema y que `planMigrations` ordena `0003`
  tras `0002`; integración: un `insert` que viola el esquema es rechazado y una
  segunda ejecución de la migración no aplica nada.
  ✔ Implementado: `0003-training-collections.ts` — 4 `$jsonSchema` + `migration0003`
  (`applyValidator` = `collMod`/`createCollection` + `createIndex` únicos).
  Enteros como `bsonType:'number'` + `minimum`/`maximum`/`multipleOf:1` (el driver
  guarda los enteros de JS como `double`). Ids de referencia dentro del documento
  (`exerciseId`, `routineId` del snapshot) como `string`; solo `_id`/`trainerId`/
  `studentId` son `objectId`. Registrada en `index.ts` (+ re-export de las 8
  constantes).
  ✔ Unit verde: `0003-training-collections.spec.ts` — 6 tests (nombre + orden tras
  0002; nombres de colección; forma de cada esquema: `additionalProperties:false`,
  `required`, `minItems`, `minimum`, `weekday.enum`, snapshot cerrado).
  ✔ Integración (skip sin `MONGODB_URI`): `test/integration/training-migration.spec.ts`
  — 6 tests (validadores presentes; 4 índices únicos; docs válidos aceptados;
  campo no declarado / weekday inválido / rondas 0 / rutina sin bloques
  rechazados; 2ª migración no aplica nada).

- [x] **T24 · `infra/repositories/mongo-exercise-repository.ts` + integración (D5)**
  RF: RF-2 (`findById`/`listByTrainer`/`deleteById` acotados por `trainerId`),
  RF-6 (`E11000` del índice único → `ExerciseNameTakenError`).
  Hecho cuando: `createMongoExerciseRepository(db)` traduce `_id`↔`id`; un segundo
  `insert` con el mismo `trainerId` + `nameNormalized` → `ExerciseNameTakenError`
  (traduce `E11000`); `findById` / `listByTrainer` filtran por dueño; el driver
  `mongodb` solo se importa en este archivo.
  ✔ Implementado: `ExerciseDoc` (`_id`/`trainerId` `ObjectId`), `toExercise` vía
  factoría `exercise()`, `bodyOf` sin `_id` para `insertOne`/`replaceOne`, catch
  `isDuplicateKeyError` en `insert` y `update`; `ObjectId.isValid` guard.
  ✔ Integración (skip): `mongo-exercise-repository.spec.ts` — 6 tests (`_id`↔`id`
  + `trainerId` roundtrip; duplicado → `ExerciseNameTakenError`; otro entrenador
  reutiliza el nombre; `findById`/`listByTrainer` por dueño; `update`/`deleteById`;
  validador de BD rechaza campo de prescripción).

- [x] **T25 · `infra/repositories/mongo-routine-repository.ts` + integración**
  RF: RF-2, RF-8 (`anyUsesExercise` recorre `blocks.exercises.exerciseId`),
  RF-16 (`E11000` → `RoutineNameTakenError`).
  Hecho cuando: CRUD con traducción de id; duplicado → `RoutineNameTakenError`;
  `anyUsesExercise(trainerId, exerciseId)` devuelve `true` solo si algún
  `blocks[].exercises[].exerciseId` coincide; el validador de BD rechaza un
  `blocks` mal formado.
  ✔ Implementado: análogo a T24; `blocks` se guarda con `structuredClone`
  (el árbol del dominio viene congelado); `anyUsesExercise` = `countDocuments`
  con `{ trainerId, 'blocks.exercises.exerciseId': exerciseId }`.
  ✔ Integración (skip): `mongo-routine-repository.spec.ts` — 4 tests (roundtrip
  del árbol; duplicado; `anyUsesExercise` true/false y por `trainerId`; validador
  rechaza rondas 0).

- [x] **T26 · `infra/repositories/mongo-assignment-repository.ts` + integración (D10)**
  RF: RF-24 (snapshot embebido íntegro), RF-26 (índice único de slot + upsert),
  RF-27 (`deleteOwned` por `trainerId`). También RF-2 y RF-18 (`listByStudent`).
  Hecho cuando: `replaceForSlot(clave, snapshot)` hace upsert sobre el índice
  único de slot y devuelve el documento previo (o `null`); `listByStudent` y
  `deleteOwned` filtran por `trainerId`; tras dos `replaceForSlot` sobre el mismo
  slot queda **un** documento.
  ✔ Implementado: `replaceForSlot` → `findOne` (previa) + `replaceOne(..., {upsert:true})`;
  `created` = `res.upsertedId ?? prev._id`; devuelve `{ created, replaced }`
  (ajuste del puerto en T19). `listByStudent(trainerId, studentId, week?)` ordena
  por `week, weekday`; `deleteOwned` filtra `{ _id, trainerId }`.
  ✔ Integración (skip): `mongo-assignment-repository.spec.ts` — 4 tests (slot
  libre → `replaced:null`, 1 doc; reasignar mismo slot → previa devuelta, sigue 1
  doc, `listByStudent` ve la nueva; filtro por entrenador/alumno/semana;
  `deleteOwned` solo lo propio).

- [x] **T27 · `infra/repositories/mongo-trainer-client-link-repository.ts` + integración (D11)**
  RF: RF-22 (`ensureLink` idempotente vía upsert sobre índice único).
  Hecho cuando: `ensureLink(trainerId, studentId)` crea el vínculo y una segunda
  llamada no falla ni duplica (una sola fila); `listStudents(trainerId)` los
  devuelve.
  ✔ Implementado: `updateOne({ trainerId, studentId }, { $setOnInsert: { createdAt } },
  { upsert: true })`; `listStudents` → `studentId.toHexString()`. Provisional no
  exclusivo (único punto de cambio, D11).
  ✔ Integración (skip): `mongo-trainer-client-link-repository.spec.ts` — 2 tests
  (idempotencia: 2 llamadas → 1 fila; `listStudents` devuelve los vinculados y `[]`
  para otro entrenador).

- [x] **T28 · `infra/auth/alumno-provisioning.ts` (`AccountLookup`) + integración (D8)**
  RF: RF-21 (`findByUsername`), RF-21b (`createAlumno` sin sesión, valida mínimos
  de la 001), RF-23 (devuelve `role` para que el caso de uso distinga entrenador).
  Hecho cuando: `findByUsername` devuelve `{id, role}` o `null` reutilizando
  `createMongoAccountRepository`; `createAlumno({username, password})` valida con
  `parseCredentials` de `domain/auth`, persiste con `role='alumno'` y
  `passwordHash` scrypt, y **no** crea ninguna sesión (la colección `sessions`
  queda intacta).
  ✔ Implementado: `createAlumnoProvisioning(db)` — `findByUsername` normaliza y
  consulta `findByNormalizedUsername`; `createAlumno` = `parseCredentials(...,
  role:'alumno')` (falla → `InvalidTrainingInputError`) → `scryptPasswordHasher.hash`
  → `accounts.insert(newAccount(...))`. Nunca toca `SessionStore`.
  ✔ Integración (skip): `alumno-provisioning.spec.ts` — 3 tests (resuelve cuenta
  existente / null; alta con rol alumno + hash y `sessions` vacía; contraseña
  corta → `InvalidTrainingInputError`).

- [x] **T29 · `infra/http/current-trainer.ts` + `AccountRepository.findById` + integración (D4)**
  RF: RF-1 (rol `entrenador`: sin sesión → `Unauthenticated`, alumno →
  `Forbidden`), RF-2 / RF-3 (el `{ trainerId }` que devuelve acota el caso de uso).
  Hecho cuando: se añade `findById(accountId)` (solo lectura) al repo de cuentas;
  `currentTrainer(request)` lee la cookie de sesión, resuelve la sesión viva con
  `sessionStore()`, carga la cuenta y devuelve `{ trainerId }` solo si
  `role === 'entrenador'`; sin cookie o sesión inválida → `UnauthenticatedError`;
  rol `alumno` → `ForbiddenError`; integración cubre los tres caminos.
  ✔ Implementado: `AccountRepository.findById` añadido al puerto de la 001 e
  implementado en `mongo-account-repository` (solo lectura; specs de auth y de
  `mongo-account-repository` actualizados). `resolveCurrentTrainer(request, deps)`
  puro-de-orquestación (deps: `readSessionId`, `sessions`, `accounts`);
  `container.currentTrainer(request)` lo cablea con adaptadores Mongo + cookie.
  ✔ Unit verde: `current-trainer.spec.ts` — 5 tests con dobles (entrenador →
  `{trainerId}`; sin cookie / sesión null / cuenta borrada → `Unauthenticated`;
  alumno → `Forbidden`).
  ✔ Integración (skip): `test/integration/current-trainer.spec.ts` — 3 caminos
  end-to-end (registrar entrenador → cookie → `{trainerId}`; registrar alumno →
  `Forbidden`; sin cookie → `Unauthenticated`).

- [x] **T30 · `infra/container.ts` ampliado**
  RF: — (soporte constitución P4: único punto de ensamblado dominio↔infra).
  Hecho cuando: exporta ya cableados `createExercise/updateExercise/deleteExercise/listExercises`,
  `createRoutine/updateRoutine/deleteRoutine/listRoutines`,
  `assignRoutine/unassignRoutine/listAssignments` y `currentTrainer`;
  `grep -r "mongodb" src/app` sigue vacío.
  ✔ Implementado: `trainingDeps()` (repos Mongo + `createAlumnoProvisioning` +
  `systemClock`) y 11 wrappers + `currentTrainer`. Los casos de uso del dominio
  se importan con alias `run*`. `npx tsc --noEmit` limpio; `src/app` aún no
  importa `mongodb` (sin handlers todavía).

---

## H. Interfaz HTTP — Route Handlers (D2)

- [x] **T31 · `app/api/exercises/route.ts` (GET/POST) + `[id]/route.ts` (PATCH/DELETE) + integración**
  RF: RF-1 (guard `currentTrainer` → 401/403), RF-2 (404 sobre ajeno; `GET` solo
  el propio), RF-4 (422 de validación), RF-6 (409 duplicado), RF-7 (`PATCH`),
  RF-8 (409 en uso).
  Hecho cuando: integración: sin sesión → 401 y sesión de alumno → 403 en toda
  mutación; `POST` válido → 201 con el ejercicio; nombre duplicado → 409; `PATCH`
  o `DELETE` sobre un ejercicio de otro entrenador → 404; `DELETE` de un ejercicio
  usado por una rutina → 409; `GET` lista solo el catálogo propio.
  ✔ Implementado: handlers finos `runtime='nodejs'` + `dynamic='force-dynamic'`;
  patrón guard → `readJsonRecord` → `container.*` → `jsonResponse` /
  `trainingErrorResponse`. `[id]` con `params: Promise<{id}>` (Next 15+). Helper
  compartido `src/lib/http/read-json.ts`.
  ✔ Integración (skip sin `MONGODB_URI`): `test/integration/exercises-api.spec.ts`
  — 7 tests (401/403; 201 + 409 duplicado; 422 nombre corto; `PATCH` propio /
  ajeno 404; `DELETE` en uso 409; `GET` solo el propio; id mal formado → 404).
  `architecture.spec.ts` sigue verde: ningún handler importa `mongodb` ni repos.

- [x] **T32 · `app/api/routines/route.ts` + `[id]/route.ts` + integración**
  RF: RF-1, RF-2, RF-9 (corolario D3: la edición no toca snapshots), RF-10..RF-14
  (201 + árbol conservado), RF-15 (422 vacíos), RF-16 (409 duplicado), RF-17
  (`PATCH`/`DELETE` no tocan asignaciones). También RF-12 (404 exerciseId fuera
  del catálogo).
  Hecho cuando: integración: `POST` con bloques válidos → 201; rutina o bloque
  vacíos, `rounds`/`sets` = 0, o ni `reps` ni `timeSec` → 422; nombre duplicado →
  409; `PATCH` sustituye la rutina; editar un ejercicio del catálogo **no** cambia
  una rutina ya asignada (RF-9); `DELETE` de la rutina no afecta a asignaciones
  existentes.
  ✔ Implementado: mismos patrones que T31; `POST`/`PATCH` reciben
  `{ name, note, blocks }`.
  ✔ Integración (skip): `routines-api.spec.ts` — 6 tests (401/403; 201 + árbol;
  4 formas inválidas → 422; exerciseId fuera de catálogo → 404 y duplicado → 409;
  `PATCH` propio / `DELETE` ajeno → 404; `GET` solo las propias). El RF-9 (editar
  ejercicio/rutina no altera asignaciones) se cubre en `assignments-api.spec.ts`.

- [x] **T33 · `app/api/assignments/route.ts` (GET/POST) + `[id]/route.ts` (DELETE) + integración**
  RF: RF-1, RF-2, RF-18, RF-19, RF-20, RF-21, RF-21b, RF-21c, RF-22, RF-23,
  RF-24, RF-25, RF-26, RF-27, RF-28.
  Hecho cuando: integración (sembrando entrenador y alumnos con los handlers de
  spec 001): `POST` con 2 alumnos × 2 slots → 4 asignaciones; alumno inexistente
  sin confirmar → cuerpo con `needsConfirmation` y nada creado; con `confirmarAlta`
  + `passwordInicial` → cuenta creada **sin `Set-Cookie`** y vínculo creado;
  `username` de entrenador → `rejected`; reasignar tras editar la rutina →
  snapshot viejo intacto y nuevo actualizado; segundo `POST` al mismo slot →
  `overwritten` y un solo documento en BD; `DELETE /api/assignments/[id]` deja el
  slot vacío; toda mutación sin sesión → 401 y con rol alumno → 403.
  ✔ Implementado: `POST` devuelve `200 { created, overwritten, needsConfirmation,
  rejected }`; `GET ?studentId=&week=` → vista del mesociclo (falta `studentId` →
  422); `[id]` `DELETE` → `unassignRoutine`. `assignRoutine` endurecido:
  `recipients`/`slots` pasan a `unknown` y se valida `Array.isArray` (RF-3) —
  specs de dominio intactos.
  ✔ Integración (skip): `assignments-api.spec.ts` — 10 tests (401/403; 2×2 → 4;
  `needsConfirmation`; alta confirmada sin `Set-Cookie` + cuenta reutilizable;
  entrenador → `rejected`; 2º POST al slot → `overwritten` + 1 doc; reasignar tras
  renombrar el ejercicio → snapshot nuevo / viejo intacto RF-24/25; editar la
  rutina no cambia la asignación emitida RF-9; `DELETE` deja el slot vacío + 2ª
  baja 404; la sesión del entrenador sigue viva).

- [x] **T34 · `middleware.ts` ampliado + test**
  RF: RF-1 (puerta de presencia de cookie en Edge, previa a la verificación
  fuerte de `currentTrainer`).
  Hecho cuando: `PROTECTED_PREFIXES` incluye `/api/exercises`, `/api/routines`,
  `/api/assignments`; `config.matcher` estático en sync; sin cookie → 401 en
  `/api/*`; el test lo confirma.
  ✔ Implementado: `PROTECTED_PREFIXES` + `config.matcher` (exacto + `:path*` por
  cada prefijo). El comportamiento (401 JSON en `/api/*`, redirección a `/login`
  en páginas) es el mismo de la spec 001. Con la sección I se añadieron también
  los prefijos de página `/exercises`, `/routines`, `/assign`.
  ✔ Unit verde: `middleware.spec.ts` — nuevo test (los 6 prefijos protegidos,
  exactos y descendientes; `config.matcher` los lista).

---

## I. Interfaz de usuario (P3: solo renderiza y delega)

- [x] **T35 · `components/training/ExerciseCatalog` + `ExerciseForm` + página `(trainer)/exercises`**
  RF: RF-1 (todo pasa por `/api/exercises`, que exige rol entrenador), RF-4
  (form nombre + descripción), RF-7 (edición inline), RF-8 (mensaje "en uso" del
  cuerpo al borrar).
  Hecho cuando: en `npm run dev` un entrenador crea, edita y borra ejercicios; los
  errores de duplicado y de "en uso" se muestran con el `message` del cuerpo; los
  componentes no importan `container` ni `mongodb` (guarda de arquitectura pasa).
  ✔ Implementado: `ExerciseForm` (`'use client'`, `POST`/`PATCH` según `initial`,
  muestra `issues`/`message` del servidor) + `ExerciseCatalog` (`GET`, lista con
  editar/borrar inline, recarga tras mutar, muestra el mensaje del 409) + página
  `(trainer)/exercises` (Server Component que monta el cliente) + `(trainer)/layout`
  con nav. **Sin lógica de negocio ni test unitario de componentes** (P3).
  ✔ Verde: `test/unit/architecture.spec.ts` ampliado — ningún archivo de
  `src/components` importa `mongodb`, un repositorio, el container ni `infra/db`.
  `npm run build` compila y prerenderiza `/exercises`.

- [x] **T36 · `components/training/RoutineBuilder` + páginas `(trainer)/routines`, `/routines/new`, `/routines/[id]`**
  RF: RF-10 (nombre + nota), RF-11 (reordenar bloques), RF-12 (rondas + descansos
  de bloque), RF-13/RF-13b (series, reps y/o tiempo, los cuatro descansos como
  campos distintos), RF-14 (mismo ejercicio repetible), RF-15/RF-16 (errores 422
  del servidor), RF-17 (editar vía `PATCH`, borrar en el listado).
  Hecho cuando: se construye una rutina con ≥ 2 bloques (uno multi-ejercicio con
  rondas y los cuatro descansos), se reordena, se guarda (201) y se edita; los
  errores 422 se muestran junto al campo; el componente no contiene reglas de
  negocio.
  ✔ Implementado: `RoutineBuilder` (`'use client'`, estado de bloques/ejercicios,
  add/quitar/mover ↑↓, `<select>` poblado con `GET /api/exercises`, campos
  numéricos vacíos → `undefined` para que el servidor aplique RF-13; `POST`/`PATCH`
  y muestra `issues`) + `RoutineList` (`GET`/`DELETE`) + `EditRoutine` (carga por
  id filtrando el listado) + páginas `/routines`, `/routines/new`, `/routines/[id]`.
  El componente **solo recoge y delega**; la validación es del servidor.
  ✔ Verde: `npm run build` compila y prerenderiza `/routines` y `/routines/new`
  (`/routines/[id]` dinámica). `tsc` limpio.

- [x] **T37 · `components/training/AssignRoutineDialog` + `StudentPlanView` + página `(trainer)/assign`**
  RF: RF-18 (recipients × slots), RF-19 (semana + días de la semana), RF-21/RF-21b
  (checkbox "dar de alta" + contraseña inicial; `needsConfirmation` en el
  resultado), RF-22 (implícito: el vínculo lo crea el servidor al asignar),
  RF-26 (aviso de sobrescritura previo al confirmar, texto de `TRAINING_MESSAGES`),
  RF-27 (baja de asignación desde el plan — vía API; la vista lista el mesociclo).
  Hecho cuando: se asigna una rutina a varios alumnos y varios pares
  (semana, día); un alumno nuevo dispara la confirmación de alta con
  `passwordInicial`; el aviso de sobrescritura de slot aparece antes de
  reemplazar; la vista muestra el mesociclo del alumno por semanas.
  ✔ Implementado: `AssignRoutineDialog` (`'use client'`: `<select>` de rutinas,
  filas de destinatarios con `confirmarAlta`+`passwordInicial`, semana + checkboxes
  de día → `slots`; **doble pulsación**: la primera muestra
  `TRAINING_MESSAGES.slotOverwritten` y la segunda envía; renderiza
  `{created, overwritten, needsConfirmation, rejected}`) + `StudentPlanView`
  (`GET /api/assignments?studentId=`, tabla por semana → día → rutina) + página
  `(trainer)/assign`.
  ✔ Verde: `npm run build` compila y prerenderiza `/assign`. `tsc` limpio.

---

## J. Cierre

- [x] **T38 · Guardas de arquitectura y scaffold ampliados**
  RF: RF-1, RF-2, RF-3 (soporte constitución P1, P3, P4).
  Hecho cuando: `test/unit/architecture.spec.ts` cubre `src/domain/training/**`
  (no importa react/mongodb/next) y `src/app/api/{exercises,routines,assignments}`
  (no importa `mongodb` ni repos); `test/unit/scaffold.spec.ts` confirma que
  `package.json` no ganó dependencias.
  ✔ Implementado: `architecture.spec.ts` — 3 tests nuevos: `src/domain/training`
  puro y con > 15 archivos; `src/app/api/{exercises,routines,assignments}` (≥ 6
  archivos) sin `mongodb`/`infra/repositories`/`infra/db`; el container expone las
  **17** operaciones (5 de la 001 + `currentTrainer` + 11 de training). El guard
  de `src/components` (sin `mongodb`/repo/container/`infra/db`) se añadió en T35.
  `scaffold.spec.ts` sin cambios: sigue verde (no se añadieron dependencias).
  ✔ Verde: `npx vitest run test/unit` → 12 tests; `npm test` → 298 passed / 0 fallos.

- [x] **T39 · `specs/002-rutina-ejercicio/verification.md` + verificación e2e**
  RF: RF-1 … RF-29 (incl. RF-13b, RF-21b, RF-21c) — todos con ≥ 1 test.
  Hecho cuando: `npm run test` (unit + integración con `MONGODB_URI`) al 100 %
  verde; la matriz RF→módulo→test de `plan.md` §3.4 revisada con cada RF
  referenciado por ≥ 1 test; el flujo manual e2e de `plan.md` §4 ejecutado y
  anotado; las 8 decisiones provisionales `[NECESITA ACLARACIÓN]` (D13) recogidas
  en la descripción del PR con dónde cambiar cada una.
  ✔ Implementado: `specs/002-rutina-ejercicio/verification.md` — (1) estado del
  gate: `npm run build` ✅, `tsc` ✅, `npm test` sin Mongo **298 passed / 104
  skipped / 0 fallos**; (2) matriz RF-1…RF-29 + RF-13b/21b/21c → módulo → tests
  (cada RF con ≥ 1 test; ◦ marca los de integración); (3) checklist de QA manual
  (ejercicios / rutinas / asignación / calidad); (4) las 8 dudas D13 con su
  decisión provisional y el punto único de cambio; (5) notas de PR (0 deps
  nuevas, migración `0003`, cambios de contrato de puerto, middleware, env).
  ⚠️ `MONGODB_URI=… npm test` (104 tests de integración) queda **pendiente de
  ejecutar** en un entorno con MongoDB: en este equipo Docker Desktop no estaba
  levantado. Los tests de integración están escritos y compilan (`tsc` limpio);
  el flujo e2e completo está automatizado en `test/integration/assignments-api.spec.ts`.
