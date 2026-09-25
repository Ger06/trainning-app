# Verificación 002 — Ejercicios y rutinas (T39)

Cierre de la spec 002. Para pegar en la descripción del PR.

## 1. Estado de la verificación

| Comando | Resultado |
|---|---|
| `npm run build` | ✅ Next 16.3.0 compila + TypeScript OK. Rutas nuevas: `/exercises`, `/routines`, `/routines/new`, `/routines/[id]`, `/assign`, `/api/exercises(/[id])`, `/api/routines(/[id])`, `/api/assignments(/[id])`, middleware. |
| `npx tsc --noEmit` | ✅ limpio. |
| `npm test` (sin Mongo) | ✅ **298 passed · 104 skipped · 0 fallos** (los de integración se saltan solos con `describe.skipIf(!hasMongo)`; exit 0). |
| `MONGODB_URI=… npm test` | ⏳ **pendiente de ejecutar** en un entorno con MongoDB. En este equipo Docker Desktop no está levantado; los 104 tests de integración (53 de la spec 001 + 51 de la spec 002) están escritos y compilan, listos para correr contra `mongo:7`. |

MongoDB de referencia: contenedor `mongo:7` (Docker) en `mongodb://127.0.0.1:27017`.
`SESSION_SECRET` requerido para los endpoints (el harness de integración pone uno de pruebas).

**Flujo end-to-end automatizado** (`test/integration/assignments-api.spec.ts`, se salta sin Mongo):
registrar entrenador → crear ejercicios → crear rutina → asignar a 2 alumnos × 2 slots (4 asignaciones)
→ alumno inexistente sin confirmar (`needsConfirmation`) → alta confirmada sin `Set-Cookie`
→ username de entrenador (`rejected`) → reasignar tras renombrar el ejercicio (snapshot nuevo / viejo intacto)
→ editar la rutina no cambia la asignación emitida → 2º POST al mismo slot (`overwritten`, 1 doc)
→ `DELETE` deja el slot vacío → 2ª baja 404 → la sesión del entrenador sigue viva.

## 2. Cobertura RF → módulo / test

Cada RF (RF-1…RF-29, incluidos RF-13b, RF-21b, RF-21c) está referenciado por al menos un test.
`◦` = test de integración (se ejecuta con `MONGODB_URI`).

| RF | Qué exige | Implementación | Tests |
|----|-----------|----------------|-------|
| **RF-1** | Crear/editar/borrar/asignar solo con rol `entrenador` | `infra/http/current-trainer.ts`, `middleware.ts`, todos los handlers | `current-trainer.spec`, `middleware.spec`, ◦`exercises-api` / `routines-api` / `assignments-api` (401 sin sesión, 403 alumno), ◦`current-trainer` (e2e) |
| **RF-2** | Cada entrenador solo ve/toca lo suyo; ajeno → *NotFound* | `trainerId` en todos los casos de uso; repos filtran; `update`/`delete` verifican propiedad | `update-exercise.spec`, `delete-exercise.spec`, `list-exercises.spec`, `update-routine.spec`, `delete-routine.spec`, `list-routines.spec`, `unassign-routine.spec`, `list-assignments.spec`, ◦`mongo-*-repository`, ◦`*-api` |
| **RF-3** | Validación autoritativa en la lógica, acumula incidencias | `parse-exercise.ts`, `parse-routine.ts`, `slot.ts`; handlers pasan `unknown` | `parse-exercise.spec`, `parse-routine.spec`, `slot.spec`, `assign-routine.spec`, `architecture.spec` (dominio puro) |
| **RF-4** | Ejercicio: nombre obligatorio ≥ 2, descripción opcional | `exercise.ts`, `parse-exercise.ts`, `$jsonSchema` `exercises` | `exercise.spec`, `parse-exercise.spec`, `create-exercise.spec`, `0003-training-collections.spec`, ◦`mongo-exercise-repository`, ◦`exercises-api` |
| **RF-5** | El ejercicio no lleva prescripción | tipo `Exercise`; `parse-exercise` rechaza 8 claves; `$jsonSchema additionalProperties:false` | `exercise.spec`, `parse-exercise.spec`, `0003-training-collections.spec`, ◦`mongo-exercise-repository` (validador BD), ◦`training-migration` |
| **RF-6** | Nombre de ejercicio único por catálogo | `exercise-name.ts`; índice único `{trainerId,nameNormalized}`; repo traduce `E11000` | `exercise-name.spec`, `create-exercise.spec`, `0003-training-collections.spec`, ◦`mongo-exercise-repository`, ◦`exercises-api` (409) |
| **RF-7** | Editar nombre y descripción del ejercicio | `update-exercise.ts`, `PATCH /api/exercises/[id]` | `update-exercise.spec`, ◦`exercises-api` |
| **RF-8** | Borrar solo si ninguna rutina lo usa | `delete-exercise.ts` + `RoutineRepository.anyUsesExercise` | `delete-exercise.spec`, ◦`mongo-routine-repository` (`anyUsesExercise`), ◦`exercises-api` (409 `exercise_in_use`) |
| **RF-9** | Editar/borrar ejercicio o rutina no afecta asignaciones | corolario D3: la rutina referencia por id, la asignación guarda snapshot | `routine-snapshot.spec` (aislamiento), ◦`assignments-api` (editar ejercicio/rutina → snapshot intacto) |
| **RF-10** | Rutina: nombre obligatorio ≥ 2, nota opcional | `routine.ts`, `parse-routine.ts`, `$jsonSchema` `routines` | `routine.spec`, `parse-routine.spec`, `0003-training-collections.spec`, ◦`routines-api` |
| **RF-11** | Lista **ordenada** de bloques, orden editable | `routine.ts` (`blocks[]`), `parse-routine.ts` (orden conservado), `RoutineBuilder` (mover ↑↓) | `routine.spec`, `parse-routine.spec` |
| **RF-12** | Bloque: ejercicios del catálogo, rondas ≥ 1, descanso entre rondas, descanso tras bloque opcional | `routine.ts`, `parse-routine.ts`, `create-routine.ts` (`findById` catálogo), `$jsonSchema` | `routine.spec`, `parse-routine.spec`, `create-routine.spec`, `0003-training-collections.spec`, ◦`mongo-routine-repository`, ◦`routines-api` (404 exerciseId fuera de catálogo) |
| **RF-13** | Ejercicio de bloque: series ≥ 1, reps y/o tiempo, descanso entre series, descanso tras el ejercicio (def. 0), nota | `routine.ts` (`BlockExercise`), `parse-routine.ts`, `$jsonSchema` | `routine.spec`, `parse-routine.spec`, `0003-training-collections.spec`, ◦`routines-api` (422) |
| **RF-13b** | Los **cuatro** descansos en campos distintos | `routine.ts`, `parse-routine.ts`, `$jsonSchema` | `routine.spec`, `parse-routine.spec`, `0003-training-collections.spec` |
| **RF-14** | Mismo ejercicio repetible en un bloque | `parse-routine.ts` (sin dedupe), `routine.ts` | `routine.spec`, `parse-routine.spec` |
| **RF-15** | Rutina ≥ 1 bloque, bloque ≥ 1 ejercicio | `routine.ts::assertShape`, `parse-routine.ts`, `$jsonSchema` `minItems:1` | `routine.spec`, `parse-routine.spec`, `create-routine.spec`, `0003-training-collections.spec`, ◦`training-migration`, ◦`routines-api` (422) |
| **RF-16** | Nombre de rutina único por entrenador | `routine-name.ts`; índice único; repo traduce `E11000` | `routine-name.spec`, `create-routine.spec`, `0003-training-collections.spec`, ◦`mongo-routine-repository`, ◦`routines-api` (409) |
| **RF-17** | Editar/eliminar rutina; **no** altera asignaciones | `update-routine.ts`, `delete-routine.ts` (`deps` sin puerto de asignaciones) | `update-routine.spec`, `delete-routine.spec`, ◦`routines-api`, ◦`assignments-api` |
| **RF-18** | 1 rutina → N alumnos × M slots → N·M asignaciones | `assign-routine.ts`; `list-assignments.ts` | `assign-routine.spec`, `list-assignments.spec`, ◦`mongo-assignment-repository`, ◦`assignments-api` (2×2 → 4) |
| **RF-19** | Semana entero ≥ 1 (≤ MAX_WEEK); día del enum | `slot.ts::parseSlot`, `$jsonSchema` (`weekday` enum, `week` `multipleOf:1`) | `slot.spec`, `0003-training-collections.spec`, `assign-routine.spec` (slot malo), ◦`training-migration`, ◦`assignments-api` |
| **RF-20** | Solo se asigna una rutina con contenido válido | `assign-routine.ts::hasValidContent` | `assign-routine.spec` |
| **RF-21** | Username inexistente → aviso + oferta de alta, sin crear | `assign-routine.ts` + `AccountLookup.findByUsername` | `assign-routine.spec`, ◦`alumno-provisioning` (`findByUsername`), ◦`assignments-api` (`needsConfirmation`) |
| **RF-21b** | Alta con confirmación; usuario+contraseña con mínimos de la 001; rol `alumno`; **sin sesión** | `infra/auth/alumno-provisioning.ts::createAlumno` | `assign-routine.spec`, `ports.spec`, ◦`alumno-provisioning` (rol + hash + `sessions` vacía + contraseña corta → `InvalidTrainingInputError`), ◦`assignments-api` (sin `Set-Cookie`) |
| **RF-21c** | Un problema por destinatario no aborta el lote | `assign-routine.ts` → resultado parcial `{created,overwritten,needsConfirmation,rejected}` | `assign-routine.spec`, ◦`assignments-api` |
| **RF-22** | Registra vínculo entrenador–alumno idempotente | `trainer_client_links` + `TrainerClientLinkRepository.ensureLink` (`updateOne` `$setOnInsert` `upsert`) | `assign-routine.spec`, `0003-training-collections.spec`, ◦`mongo-trainer-client-link-repository` (2 llamadas → 1 fila) |
| **RF-23** | Username de alumno nunca dispara alta; username de entrenador → rechazo | `assign-routine.ts` (rama por rol) | `assign-routine.spec`, ◦`alumno-provisioning` (devuelve `role`), ◦`assignments-api` (`rejected`) |
| **RF-24** | Snapshot congelado de rutina + datos de cada ejercicio al asignar | `routine-snapshot.ts`; `assignments.routineSnapshot` embebido y cerrado | `routine-snapshot.spec` (congelado en 5 niveles, aislamiento), `assign-routine.spec`, `0003-training-collections.spec`, ◦`mongo-assignment-repository`, ◦`assignments-api` |
| **RF-25** | Reasignar = nueva asignación con snapshot actualizado | `assign-routine.ts` (mismo camino, snapshot recalculado) | `assign-routine.spec`, ◦`assignments-api` (tras renombrar el ejercicio) |
| **RF-26** | Máx 1 rutina por (alumno, semana, día); reemplaza avisando | índice único `{trainerId,studentId,week,weekday}` + `replaceForSlot` (`{created,replaced}`); `overwritten[]`; UI doble pulsación con `TRAINING_MESSAGES.slotOverwritten` | `mongo-assignment-repository.spec` (◦), `assign-routine.spec`, `0003-training-collections.spec`, ◦`assignments-api` (2º POST → `overwritten`, 1 doc) |
| **RF-27** | Quitar una asignación (slot vacío) | `unassign-routine.ts`, `DELETE /api/assignments/[id]` | `unassign-routine.spec`, ◦`mongo-assignment-repository`, ◦`assignments-api` |
| **RF-28** | Quitar/reemplazar en cualquier momento, sin bloqueo | sin estado de ventana temporal (`deps` de `unassign` sin reloj) | `unassign-routine.spec`, ◦`assignments-api` |
| **RF-29** | Avisos y errores específicos y accionables | `errors.ts` (`kind`), `lib/training-messages.ts`, `lib/http/training-error-response.ts` | `errors.spec`, `training-messages.spec`, `training-error-response.spec`, ◦`*-api` (status + `error` code) |

Soporte de la constitución: **P1** (`test/unit/scaffold.spec.ts` — sin dependencias nuevas; validación a mano, sin Zod), **P3** (guardas de pureza en cada `*.spec` del dominio + `architecture.spec.ts` amplía a `src/domain/training/**` y a `src/components`), **P4** (`architecture.spec.ts` — `src/app/api/{exercises,routines,assignments}` sin `mongodb` ni repos; container expone las 17 operaciones), **P5** (unit + integración, este gate), **P6** (`$jsonSchema` de la migración `0003` + `planMigrations` ordena tras `0002` — `0003-training-collections.spec`, ◦`training-migration`).

## 3. Checklist de QA manual

Preparación: `docker run -d -p 27017:27017 --name ent-mongo mongo:7`, luego
`MONGODB_URI=mongodb://127.0.0.1:27017 SESSION_SECRET=un-secreto-largo npm run dev`.
Registrar un entrenador en `/register` (rol Entrenador) e ir a `/exercises`.

**Ejercicios (RF-1, RF-4, RF-6, RF-7, RF-8)**
- [ ] Crear "Sentadilla" y "Press Banca" → aparecen en el catálogo.
- [ ] Crear otro "sentadilla" (o "  Sentadilla ") → banda roja "ya tenés un ejercicio con ese nombre".
- [ ] Crear con nombre de 1 carácter → error de validación (`name: too_short`), no se crea.
- [ ] Editar "Press Banca" → "Press Banca Inclinado"; se guarda.
- [ ] Abrir sesión como **alumno** e ir a `/exercises` → redirección a `/login` (middleware) / las mutaciones responden 403.

**Rutinas (RF-10…RF-17)**
- [ ] `/routines/new`: nombre + **2 bloques**; el bloque 1 con 2 ejercicios (rondas 3, descanso entre rondas 60 s, descanso tras el bloque 120 s), cada ejercicio con series/repeticiones/tiempo y los cuatro descansos.
- [ ] Reordenar bloques y ejercicios con ↑ ↓.
- [ ] Guardar sin ejercicios en un bloque → 422 con `issues` (`blocks.0.exercises: empty`).
- [ ] Guardar con rondas 0 → 422 (`blocks.0.rounds: out_of_range`).
- [ ] Guardar un ejercicio sin repeticiones ni tiempo → 422 (`…reps: required`).
- [ ] Guardar OK → vuelve a `/routines`; editar la rutina y volver a guardar.
- [ ] Duplicar el nombre de una rutina → 409 "ya tenés una rutina con ese nombre".

**Asignación (RF-18…RF-28)**
- [ ] `/assign`: elegir la rutina, agregar 2 alumnos existentes, semana 1, marcar lunes y jueves → **primer** "Asignar" muestra el aviso de sobrescritura; **segundo** clic → "Asignaciones creadas: 4".
- [ ] Agregar un alumno con nombre inexistente sin marcar "dar de alta" → resultado con "Sin cuenta: …".
- [ ] Marcar "dar de alta si no existe" + contraseña inicial (≥ 8) → se crea la cuenta y se asigna; el alumno puede iniciar sesión con esa contraseña.
- [ ] Poner el username de **otro entrenador** → "Rechazados: coach (username_belongs_to_trainer)".
- [ ] Volver a asignar al mismo (alumno, semana, día) con otra rutina → "Slots reemplazados: 1".
- [ ] "Plan de un alumno": pegar el `studentId` (del resultado) → tabla por semana → día → rutina.
- [ ] Renombrar un ejercicio del catálogo y volver a asignar → el plan nuevo muestra el nombre nuevo; el snapshot anterior no cambió.

**Calidad**
- [ ] Teclado: Tab recorre campos, selects y botones; foco visible.
- [ ] Móvil (~375 px): los paneles y `.cluster` hacen wrap sin scroll horizontal.
- [ ] `prefers-reduced-motion`: sin transiciones.

## 4. Dudas abiertas `[NECESITA ACLARACIÓN]` y decisión provisional vigente (D13)

Ninguna bloquea el flujo; cada una está aislada en un punto único de cambio.

| # | Duda (spec.md) | Decisión provisional en el código | Dónde cambiarla |
|---|---|---|---|
| 1 | Normalización de nombres (mayúsculas, acentos, espacios) | `trim` + colapsar espacios internos + `toLowerCase` | `domain/training/exercise-name.ts`, `routine-name.ts` (un cambio de regla exige **migración de re-cálculo** de `nameNormalized` + índices) |
| 2 | Longitudes máximas | nombre ≤ 120, descripción/nota ≤ 2000, nota de ejercicio ≤ 500 | `domain/training/limits.ts` (+ `maxLength` en `0003-training-collections.ts`) |
| 3 | Topes numéricos (bloques, ejercicios, series, rondas, reps, segundos) | `MAX_BLOCKS=20`, `MAX_EXERCISES_PER_BLOCK=20`, `MAX_SETS=20`, `MAX_ROUNDS=20`, `MAX_REPS=1000`, `MAX_SECONDS=3600` | `domain/training/limits.ts` (+ `$jsonSchema` de `0003`) |
| 4 | Nº de semanas del mesociclo / tope | sin tope declarado; `week` entero ≥ 1, guarda `MAX_WEEK=104` | `domain/training/limits.ts`, `slot.ts` |
| 5 | ¿Vínculo entrenador–alumno exclusivo? | **No** exclusivo: un alumno puede tener varios entrenadores | `infra/repositories/mongo-trainer-client-link-repository.ts::ensureLink` |
| 6 | ¿Historial de asignaciones reemplazadas/quitadas? | **No** se guarda historial; `replaceForSlot` pisa, `deleteOwned` borra | `infra/repositories/mongo-assignment-repository.ts` |
| 7 | Carga/intensidad (kg, %1RM, RIR/RPE) | Solo `note` de texto libre por ejercicio; sin campo tipado | `domain/training/routine.ts` / `parse-routine.ts` |
| 8 | Idioma de los mensajes (es/en) | Español, centralizado (voseo, coherente con la 001) | `src/lib/training-messages.ts` |

Además, resuelto en esta spec pero condicionado a la 001: **credenciales del alta hecha por el
entrenador** — la contraseña inicial la fija el entrenador (`passwordInicial`), **sin** cambio
obligatorio ni enlace de activación; esos mecanismos siguen fuera de alcance.

Fuera de alcance de la spec y **no implementado** (recordatorio para el PR): vista/uso del alumno,
registro de progreso y estadísticas, vínculo entrenador–alumno formal (invitaciones/aceptación),
plantillas de mesociclo reutilizables, progresión automática, catálogo compartido, multimedia,
superseries/EMOM/AMRAP, duplicar/clonar, calendario con fechas reales, notificaciones al alumno.

## 5. Notas para el PR

- **Dependencias añadidas**: **ninguna**. `test/unit/scaffold.spec.ts` sigue verde (lista
  `FORBIDDEN` intacta: sin `zod`, `react-hook-form`, `mongodb-memory-server`, etc.). Validación a
  mano (D7); congelado con `Object.freeze`; `structuredClone` (global de Node) para clonar el árbol
  de bloques antes de persistir.
- **Migración nueva**: `0003-training-collections` — crea `exercises`, `routines`, `assignments`,
  `trainer_client_links` con `$jsonSchema` e índices únicos. `runMigrations` / `migrate()` deben
  ejecutarse contra la BD antes de servir tráfico. Enteros validados como `bsonType:'number'` +
  `multipleOf:1` (el driver guarda los enteros de JS como `double`).
- **Contrato de puerto cambiado**: `AssignmentRepository.replaceForSlot` devuelve
  `{ created, replaced }` (antes `Assignment | null`). `AccountRepository` (spec 001) gana
  `findById` (solo lectura) para el guard de rol.
- **Variables de entorno**: sin novedades respecto a la 001 (`MONGODB_URI`, `MONGODB_DB` opcional,
  `SESSION_SECRET`).
- **Middleware**: `PROTECTED_PREFIXES` + `config.matcher` (estático, mantener en sync) ahora cubren
  `/api/{exercises,routines,assignments}` y las páginas `/exercises`, `/routines`, `/assign`.
- **Autorización**: la puerta de Edge solo comprueba **presencia** de cookie; la verificación
  fuerte (sesión viva + `role === 'entrenador'`) la hace `currentTrainer` en cada handler.
- **Pendiente antes de fusionar**: correr `MONGODB_URI=… npm test` con `mongo:7` y confirmar los
  104 tests de integración en verde (en este equipo no había Docker levantado).
