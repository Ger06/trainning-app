# Tasks 001 — Registro y Login

> Derivado de `spec.md` y `plan.md`. Tareas pequeñas en orden de dependencia.
> Cada una indica los **RF** que cubre y una línea **Hecho cuando:** verificable.
> Regla transversal (constitución P5): al cerrar cualquier tarea, `npm run test`
> queda verde. Sin dependencias nuevas fuera de Next.js, shadcn/ui, Vitest y
> `mongodb` (P1).

---

## A. Andamiaje

- [x] **T1 · Scaffold del proyecto**
  RF: — (soporte P1 stack mínimo, P5 tests). No cubre ningún RF funcional;
  habilita el resto de tareas.
  Hecho cuando: `npm run dev` levanta Next 16.3; `npm run test:unit` y
  `npm run test:integration` ejecutan (0 tests) sin error; `package.json` no
  contiene más deps que Next, shadcn/ui, Vitest y `mongodb`.
  ✔ Verificado: `next build` compila con Next 16.3.0 y typecheck OK;
  `test:unit` → 5 passed (guard de scaffold en `test/unit/scaffold.spec.ts`);
  `test:integration` → "No test files found, exiting with code 0";
  `package.json` sólo declara `next`, `react`, `react-dom`, `mongodb` (prod) y
  `vitest` + tooling TypeScript (dev). Archivos: `package.json`, `tsconfig.json`,
  `next.config.ts`, `vitest.config.ts`, `.gitignore`, `src/app/{layout,page}.tsx`.

- [x] **T2 · Cliente Mongo + runner de migraciones**
  RF: — (soporte P6 datos con forma explícita). No cubre ningún RF funcional;
  da la base de esquema/migraciones para T3 y T4.
  Hecho cuando: `infra/db/migrations/migrate.ts` aplica las pendientes, las
  registra en `_migrations` y una segunda ejecución no aplica nada; test de
  integración prueba la idempotencia.
  ✔ Implementado: `src/infra/db/mongo-client.ts` (`connectMongo`, `getConnection`,
  `getDb`, `closeConnection` — único importador del driver, P4);
  `src/infra/db/migrations/{types,migrate,index}.ts` (`Migration`, `planMigrations`
  puro, `runMigrations` con libro mayor `_migrations` e índice único, registro
  `migrations = []` a poblar en T3/T4).
  ✔ Unit verde: `migrate.spec.ts` — 6 tests de `planMigrations` (orden, partición
  hecho/pendiente, vacío) e `isDuplicateKeyError`.
  ✔ Integración `test/integration/migrate.spec.ts` (aplica → registra →
  idempotente → aplica sólo la nueva): **verde contra MongoDB 7 (Docker)** vía
  T5. `describe.skipIf(!MONGODB_URI)` cuando no hay Mongo.

- [x] **T3 · Migración `0001-accounts-schema-and-unique-index`**
  RF: RF‑5 (unicidad global de username), RF‑7 (role acotado al enum, inmutable a
  nivel de esquema), RF‑8 (sin campo `password`; `passwordHash` con prefijo
  `scrypt$`). Soporte P6.
  Hecho cuando: `accounts` tiene validador `$jsonSchema` (`role` como `enum`,
  `additionalProperties:false`, sin campo `password`) e índice **único** sobre
  `usernameNormalized`; un `insert` que viola el esquema es rechazado (test).
  ✔ Implementado: `src/infra/db/migrations/0001-accounts-schema-and-unique-index.ts`
  (`accountsJsonSchema`, `migration0001`, constantes `ACCOUNTS_COLLECTION` /
  `ACCOUNTS_USERNAME_INDEX`); registrada en `migrations` de `index.ts`. `up`
  idempotente (`createCollection` o `collMod` según exista) + `createIndex`
  único.
  ✔ Unit verde: `0001-accounts-schema-and-unique-index.spec.ts` — 6 tests sobre
  la forma del esquema (enum de role, `additionalProperties:false`, ausencia de
  `password`, `minLength:2`, `pattern` de `passwordHash`, `required` completo).
  ✔ Integración `test/integration/accounts-migration.spec.ts` (8 tests: validador
  presente, índice único, acepta doc válido, rechaza role fuera de enum / campo
  `password` / username corto / `passwordHash` en claro / `usernameNormalized`
  duplicado): **verde contra MongoDB 7 (Docker)** vía T5.

- [x] **T4 · Migración `0002-sessions-schema-and-ttl-index`**
  RF: RF‑14 (la sesión caduca en el instante `expiresAt`). Soporte P6.
  Hecho cuando: `sessions` tiene `$jsonSchema` e índice **TTL** sobre
  `expiresAt`; test lo confirma vía `listIndexes` / `listCollections`. Valor del
  TTL marcado `[NECESITA ACLARACIÓN]` (tope de sesión).
  ✔ Implementado: `src/infra/db/migrations/0002-sessions-schema-and-ttl-index.ts`
  (`sessionsJsonSchema` con `_id:string`, `accountId:objectId`,
  `createdAt`/`expiresAt:date`, `additionalProperties:false`; `migration0002` con
  `createIndex({expiresAt:1}, {expireAfterSeconds:0})`). Registrada como segunda
  en `migrations`. Qué valor escribe la app en `expiresAt` sigue
  `[NECESITA ACLARACIÓN]` (tope de sesión) → lo resolverá T17/T19.
  ✔ Unit verde: `0002-sessions-schema-and-ttl-index.spec.ts` — 5 tests de la
  forma del esquema.
  ✔ Integración `test/integration/sessions-migration.spec.ts` (6 tests: validador
  presente, índice TTL `expireAfterSeconds:0` sobre `expiresAt`, acepta doc
  válido, rechaza campo no declarado y `expiresAt` no-date, libro mayor con
  `0001`+`0002` en orden): **verde contra MongoDB 7 (Docker)** vía T5.

- [x] **T5 · Harness de integración**
  RF: — (soporte P5). No cubre ningún RF funcional; da la base de verificación de
  integración para T18, T19 y T23–T26.
  Hecho cuando: un test de ejemplo obtiene una BD única por ejecución, corre las
  migraciones, hace `fetch` a una ruta de la app y elimina la BD al final; pasa
  en CI contra un MongoDB real (sin `mongodb-memory-server`).
  ✔ Implementado: `test/integration/_harness.ts` (`setupIntegrationDb()` → BD
  `ent_it_<hex12>` única, `runMigrations`, `IntegrationContext { db, dbName,
  teardown }`; apunta `MONGODB_DB` a esa BD para que `getDb()` de la app la use;
  `teardown` = `dropDatabase` + cierre de ambas conexiones + restaura env).
  `hasMongo` deja `skipIf` sin `MONGODB_URI`.
  ✔ Ruta de ejemplo: `src/app/api/health/route.ts` (`GET` → ping a Mongo →
  `{status:'ok',db:'up'}` / 503).
  ✔ Verificado contra **MongoDB 7 (Docker)**: `test/integration/harness.spec.ts`
  (4 tests: BD única, migraciones aplicadas, ejercita `GET /api/health` contra
  esa BD, `teardown` borra la BD). Suite completa `npm test` con `MONGODB_URI` →
  **43/43**; sin `MONGODB_URI` → 22 passed / 21 skipped. Sin dependencias nuevas.
  Nota: el ejemplo invoca el handler de ruta directamente (`Request → Response`,
  patrón App Router), como harán T23–T26; no se levanta un servidor Next
  in-process (más pesado y frágil en CI, exigiría `next build` previo).

---

## B. Dominio puro (sin React, sin red, sin `mongodb`)

- [x] **T6 · `domain/auth/errors.ts`**
  RF: RF‑5 (`UsernameTakenError`), RF‑11 (`UserNotFoundError`), RF‑12
  (`WrongPasswordError`), RF‑13 (`InvalidInputError` con incidencias por campo).
  Hecho cuando: existen los errores discriminables
  `InvalidInput | UsernameTaken | UserNotFound | WrongPassword`; un `switch`
  exhaustivo sobre ellos compila.
  ✔ Implementado: `src/domain/auth/errors.ts` — `abstract class AuthError extends
  Error` + 4 subclases con etiqueta `readonly kind`; `InvalidInputError` lleva
  `issues: {field, code}[]` (`field`: username|password|role; `code`:
  required|too_short|invalid_value); `UsernameTakenError`/`UserNotFoundError`
  llevan `username`; `WrongPasswordError` sin payload. Helpers `isAuthError`,
  `assertNever`, union `AnyAuthError`. `Error.message` en inglés (interno); la
  copia de UX es de T21. Módulo puro: sin imports (P3).
  ✔ Unit verde: `errors.spec.ts` — 6 tests (payloads, `instanceof`, `isAuthError`,
  y un `switch` exhaustivo con `default: assertNever` que **compila** en
  `npm run build`). Suite: 28 unit / 49 con Mongo.

- [x] **T7 · `domain/auth/credentials.ts` + unit**
  RF: RF‑2 (`parseRole`: enum, sin default), RF‑3 (`parseUsername`: ≥2 tras trim),
  RF‑4 (`parsePassword`: ≥8), RF‑13 (`parseCredentials`/`parseLoginInput`
  acumulan TODAS las incidencias en un `InvalidInputError`).
  Hecho cuando: unit verde cubriendo username 1 vs 2 caracteres, password 7 vs 8,
  entrada de sólo espacios, `role` ausente / inválido / válido y
  `normalizeUsername` idempotente; el archivo no importa React ni `mongodb`.
  `normalizeUsername` = `trim`+`toLowerCase` provisional, marcado
  `[NECESITA ACLARACIÓN]`.
  ✔ Implementado: `src/domain/auth/result.ts` (`Result<T,E>` + `ok`/`err`, usado
  por todo el dominio) y `src/domain/auth/credentials.ts` — `Role`/`ROLES`,
  `parseUsername`/`parsePassword`/`parseRole` (→ `Result<_, InvalidInputIssue>`),
  `parseCredentials` (registro) y `parseLoginInput` (login, sin rol),
  `normalizeUsername` (provisional `trim`+`toLowerCase`, punto único de cambio
  para RF‑5). Sólo espacios → `required` en ambos campos; contraseña con espacios
  internos se conserva sin recortar.
  ✔ Unit verde: `credentials.spec.ts` — 19 tests (límites 1/2 y 7/8, sólo
  espacios, no-string, enum de role, idempotencia de `normalizeUsername`,
  acumulación de incidencias, y guarda de pureza: el archivo no importa
  react/mongodb/next). Suite: 47 unit / 68 con Mongo.

- [x] **T8 · `domain/auth/account.ts`**
  RF: RF‑7 (`role` readonly en tipos + objeto congelado; sin setter ni
  `withRole`), RF‑8 (sólo `passwordHash`, nunca `password`; se rechaza un hash
  sin prefijo `scrypt$`).
  Hecho cuando: la entidad expone `role` de sólo lectura (no hay setter ni
  `withRole`) y almacena `passwordHash`, nunca `password`; comprobado por tipos /
  test.
  ✔ Implementado: `src/domain/auth/account.ts` — `NewAccount` (sin `id`, para
  insertar) y `Account extends NewAccount` (con `id`), todos los campos
  `readonly`; factorías `newAccount()` / `account()` que devuelven el objeto
  `Object.freeze`-ado y llaman a `assertHashed` (guard de `PASSWORD_HASH_PREFIX =
  'scrypt$'`, reexportable por T15). `id` es `string` (el repo traduce
  `_id`↔`id`), así el módulo no toca `mongodb`.
  ✔ Unit verde: `account.spec.ts` — 8 tests (sin `id`/`password` en `newAccount`;
  reconstrucción con `id`; claves exactas; `role` readonly con `@ts-expect-error`
  **que compila** + `TypeError` en runtime sobre objeto congelado; `Object.isFrozen`;
  rechazo de hash sin prefijo y vacío; guarda de pureza). Suite: 55 unit / 76 con
  Mongo.

- [x] **T9 · `domain/auth/session.ts`**
  RF: RF‑14 (`expiresAt` absoluto + `isExpired`/`isActive` con criterio
  `now >= expiresAt`, igual que el TTL de Mongo), RF‑16 (el value object no tiene
  noción de "recuérdame"; la duración uniforme se fija en T17).
  Hecho cuando: value object `Session { id, accountId, expiresAt }` inmutable con
  test de construcción.
  ✔ Implementado: `src/domain/auth/session.ts` — interfaz `Session` con 3 campos
  `readonly` (`accountId` es string; `createdAt` es dato de persistencia, no del
  VO); factoría `session()` que valida (id/accountId no vacíos, fecha válida) y
  devuelve el objeto `Object.freeze`-ado; helpers puros `isExpired(s, now)` /
  `isActive(s, now)`.
  ✔ Unit verde: `session.spec.ts` — 8 tests (3 campos exactos, congelado +
  `@ts-expect-error` que compila + `TypeError` runtime, rechazo de vacíos y fecha
  inválida, frontera de caducidad antes/en/después de `expiresAt`, guarda de
  pureza). Suite: 63 unit / 84 con Mongo.

- [x] **T10 · `domain/auth/landing-path.ts` + unit**
  RF: RF‑6 (destino tras registro con auto‑login), RF‑10 (destino tras login).
  Hecho cuando: `landingPathForRole('entrenador')` y `('alumno')` devuelven la
  ruta esperada; unit verde.
  ✔ Implementado: `src/domain/auth/landing-path.ts` — `landingPathForRole(role)`
  sobre un `Record<Role, string>` (obliga a una ruta por rol en tiempo de
  compilación; si `Role` crece, no compila). Hoy ambos roles → `/` (los espacios
  por rol no existen aún, spec 001); punto único de cambio para la interfaz (P3).
  ✔ Unit verde: `landing-path.spec.ts` — 4 tests (ruta de entrenador y de alumno,
  invariante "ruta absoluta no vacía" recorriendo `ROLES`, guarda de pureza).
  Suite: 67 unit / 88 con Mongo.

- [x] **T11 · `domain/auth/ports.ts`**
  RF: — (soporte P3, P4). No cubre RF funcional; define el borde
  dominio↔infraestructura para T12–T14 y T18–T20.
  Hecho cuando: interfaces `AccountRepository`, `PasswordHasher`, `SessionStore`,
  `Clock`, `IdGenerator` definidas sólo con tipos; `grep` no encuentra `mongodb`
  ni `react` en el archivo.
  ✔ Implementado: `src/domain/auth/ports.ts` — `AccountRepository`
  (`findByNormalizedUsername`→`Account|null`; `insert(NewAccount)`→`Account`,
  `@throws UsernameTakenError` por carrera del índice único),
  `PasswordHasher` (`hash`/`verify`), `SessionStore` (`issue`/`get`→`Session|null`
  si no existe o venció/`revoke` idempotente), `Clock` (`now`), `IdGenerator`
  (`newId`). Solo `import type` de `./account` y `./session`; nada de `mongodb`
  ni `react`.
  ✔ Unit verde: `ports.spec.ts` — 6 tests (cada puerto implementado con un doble
  en memoria coherente con los value objects → compila; `revoke` idempotente;
  guarda de pureza; y `import('./ports')` sin exports en runtime → "sólo tipos").
  Suite: 73 unit / 94 con Mongo.

  **Bloque B (dominio puro, T6–T11) COMPLETO.**

---

## C. Casos de uso (dependen de B)

- [x] **T12 · `register-user.ts` + unit**
  RF: RF‑1/RF‑2 (valida vía `parseCredentials`), RF‑5 (chequeo previo +
  `catch` de `UsernameTakenError` del insert), RF‑6 (`sessions.issue` tras crear),
  RF‑7 (rol al `NewAccount` sin transformar), RF‑8 (`hasher.hash`; sólo el hash
  llega al repo).
  Hecho cuando: unit con dobles cubre happy path (emite `Session`), repo devuelve
  existente → `UsernameTaken`, `insert` que lanza `E11000` simulado →
  `UsernameTaken`, se invoca `hasher.hash` y nunca se pasa texto claro al repo;
  verde.
  ✔ Implementado: `src/domain/auth/register-user.ts` — `registerUser(input, deps)`
  → `Result<{account, session}, InvalidInputError | UsernameTakenError>`. Orden:
  validar → `findByNormalizedUsername` (RF‑5 mensaje específico) → `hasher.hash`
  → `newAccount` con `clock.now()` → `insert` (con `catch` de la carrera) →
  `sessions.issue`. Un error no-`UsernameTakenError` del repo se propaga.
  ✔ Unit verde: `register-user.spec.ts` — 8 tests (happy path + `issue('acc_new')`;
  hash + `Object.values(insert)` sin texto claro; rol preservado; entrada
  inválida sin tocar repo/hasher; username existente sin `insert`; carrera del
  `insert` sin emitir sesión; propagación de error inesperado; pureza).

- [x] **T13 · `authenticate-user.ts` + unit**
  RF: RF‑10 (`sessions.issue` al validar), RF‑11 (`UserNotFoundError` si no hay
  cuenta), RF‑12 (`WrongPasswordError` si `verify` es falso), RF‑13 (mínimos
  antes de consultar), RF‑17 (validación en el caso de uso, no en el form).
  Hecho cuando: unit cubre usuario inexistente → `UserNotFound` **sin** llamar
  `verify`, hash distinto → `WrongPassword`, credenciales correctas → `Session`,
  input corto → `InvalidInput` sin tocar el repo; verde.
  ✔ Implementado: `src/domain/auth/authenticate-user.ts` — `authenticateUser(input,
  deps)` → `Result<{account, session}, InvalidInputError | UserNotFoundError |
  WrongPasswordError>`. Orden: `parseLoginInput` → `findByNormalizedUsername`
  (null → `UserNotFound`, sin `verify`) → `hasher.verify(plain, storedHash)`
  (falso → `WrongPassword`, sin `issue`) → `sessions.issue`.
  ✔ Unit verde: `authenticate-user.spec.ts` — 6 tests (happy path + `verify` con
  args correctos; búsqueda por normalizado `'  ANA '`→`'ana'`; inexistente sin
  `verify` ni `issue`; contraseña mala sin `issue`; input corto sin tocar repo;
  pureza).

- [x] **T14 · `logout-user.ts` + unit**
  RF: RF‑15 (invalida la sesión del lado servidor).
  Hecho cuando: unit confirma que se llama `store.revoke(id)` y que es idempotente
  si la sesión ya no existe; verde.
  ✔ Implementado: `src/domain/auth/logout-user.ts` — `logoutUser(sessionId, deps)`
  → `Promise<void>`, delega en `sessions.revoke` (idempotencia garantizada por el
  puerto).
  ✔ Unit verde: `logout-user.spec.ts` — 5 tests (`revoke` con el id; sesión
  eliminada; revocar dos veces resuelve sin lanzar; id inexistente sin lanzar;
  pureza).

  **Bloque C (casos de uso, T12–T14) COMPLETO.** Suite: 92 unit / 113 con Mongo.

---

## D. Adaptadores de infraestructura (implementan los puertos de T11)

- [x] **T15 · `infra/security/scrypt-password-hasher.ts` + unit**
  RF: RF‑8 (hash irreversible con sal).
  Hecho cuando: `verify(hash(p), p) === true`, con otra contraseña `=== false`,
  formato `scrypt$N$r$p$salt$hash`, sal distinta por llamada; unit verde; sin
  nuevas deps en `package.json`.
  ✔ Implementado: `scryptPasswordHasher` con `node:crypto.scrypt` (N=16384, r=8,
  p=1, keylen 64, sal 16B). Formato `scrypt$16384$8$1$<salt_b64url>$<hash_b64url>`
  (empieza por `PASSWORD_HASH_PREFIX` de T8, casa con el `pattern` del esquema de
  T3). `verify` parsea, re‑deriva y compara con `timingSafeEqual`; ante hash
  malformado devuelve `false` sin lanzar.
  ✔ Unit verde: 6 tests (acepta correcta, rechaza distinta, formato regex, sal
  distinta por llamada, hash malformado→false, aislamiento por sal).

- [x] **T16 · `infra/security/cookie-signer.ts` + unit**
  RF: RF‑14 (integridad de la cookie de sesión; soporte RF‑15).
  Hecho cuando: HMAC (`node:crypto`) firma y verifica; valor manipulado → se
  rechaza; unit verde.
  ✔ Implementado: `createCookieSigner(secret)` → `sign(v)` = `v.<hmac_b64url>`,
  `unsign(signed)` valida con `timingSafeEqual` y devuelve el valor o `null`.
  Exige secreto ≥ 16 caracteres.
  ✔ Unit verde: 6 tests (round‑trip, valor manipulado→null, firma
  manipulada→null, sin firma→null, secreto distinto→null, secreto corto→throw).

- [x] **T17 · `infra/session/cookie-session.ts` + unit**
  RF: RF‑14 (`Max-Age` largo → sobrevive al cierre del navegador), RF‑16
  (constante única `MAX_AGE_SECONDS`, sin parámetro de duración ni "recuérdame").
  Hecho cuando: la cookie serializada incluye
  `HttpOnly; SameSite=Lax; Secure; Path=/; Max-Age=<MAX_AGE>`; `MAX_AGE` es una
  única constante referenciada desde un solo sitio; unit verde.
  ✔ Implementado: `createSessionCookie(signer)` → `serialize`/`clear`/`read`/
  `expiryFrom`. `SESSION_COOKIE_NAME='ent_session'`, `MAX_AGE_SECONDS = 400 días`
  (`[NECESITA ACLARACIÓN]` tope de sesión; provisional = máximo que retienen los
  navegadores). `serialize` y `expiryFrom` son los únicos usos de la constante.
  ✔ Unit verde: 9 tests (atributos de seguridad + `Max-Age` de la constante;
  `Max-Age` uniforme entre llamadas; `MAX_AGE ≥ 30 días`; round‑trip
  serialize→read; lee entre varias cookies; valor manipulado→null; ausente/vacía
  →null; `clear` con `Max-Age=0`; `expiryFrom` = now + `MAX_AGE`).

- [x] **T18 · `infra/repositories/mongo-account-repository.ts` + integración**
  RF: RF‑5 (traduce `E11000` del índice único a `UsernameTakenError`), RF‑7
  (el objeto repo sólo tiene `findByNormalizedUsername` e `insert`), RF‑8 (guarda
  `passwordHash`, sin `password`).
  Hecho cuando: integración verde: `insert` persiste `usernameNormalized`; un
  segundo `insert` con el mismo normalizado → `UsernameTaken` (traduce `E11000`);
  `findByNormalizedUsername` devuelve el documento; no se expone actualización de
  `role`.
  ✔ Implementado: `createMongoAccountRepository(db)` — el driver `mongodb` sólo
  aquí (P4); traduce `_id: ObjectId` ↔ `id: string`; `insert` reusa
  `isDuplicateKeyError` de T2.
  ✔ Integración verde (Mongo 7 / Docker vía T5): 5 tests (persiste normalizado y
  sin `password`; mapea la `Account`; `null` si no existe; duplicado →
  `UsernameTakenError` con `.username` correcto; `Object.keys(repo)` = solo
  `findByNormalizedUsername`+`insert`).

- [x] **T19 · `infra/repositories/mongo-session-repository.ts` + integración**
  RF: RF‑10 (`issue` al autenticar), RF‑14 (`expiresAt` = now + `MAX_AGE`; `get`
  filtra las vencidas aunque el TTL no las haya barrido), RF‑15 (`revoke` borra
  de verdad, idempotente).
  Hecho cuando: `issue` crea el documento con `expiresAt`; `get` lo devuelve;
  `revoke` lo borra y un `get` posterior devuelve `null`; integración verde.
  ✔ Implementado: `createMongoSessionRepository(db, { ids, clock })` — `_id`
  string (UUID), `accountId` como `ObjectId`; `expiresAt` con `MAX_AGE_SECONDS`
  de T17; `get` aplica `isExpired` (T9). Adaptadores triviales en
  `src/infra/system.ts` (`systemClock`, `uuidIdGenerator`).
  ✔ Integración verde (Mongo 7): 6 tests (issue crea doc + Session con
  `expiresAt` correcto; `expiresAt` ≥ 30 días; `get` vigente; `get` inexistente
  →null; `get` de vencida →null con el doc aún presente; `revoke` borra +
  idempotente x2).

- [x] **T20 · `infra/container.ts`**
  RF: — (soporte P4). No cubre RF funcional; es el único punto de ensamblado.
  Hecho cuando: exporta los casos de uso ya cableados con adaptadores concretos;
  `grep -r "mongodb" src/app` no devuelve nada (el driver sólo aparece bajo
  `src/infra`).
  ✔ Implementado: `src/infra/container.ts` — `register` / `authenticate` /
  `logout` (casos de uso + adaptadores Mongo/scrypt/UUID/clock), `sessionStore()`
  para el middleware (T26) y `sessionCookie()` (lazy, exige `SESSION_SECRET`).
  ✔ Unit verde: `test/unit/architecture.spec.ts` — recorre `src/**` y verifica:
  ningún archivo de `src/app` importa `mongodb` ni `infra/repositories`; ningún
  archivo de `src/domain` importa `mongodb`/`react`/`next`; el container expone
  las 5 operaciones como funciones.

  **Bloque D (adaptadores de infraestructura, T15–T20) COMPLETO.**
  Suite: 117 unit / 149 con Mongo (32 tests de integración).

---

## E. Interfaz HTTP (depende de C y D)

- [x] **T21 · Módulo de mensajes**
  RF: RF‑5, RF‑11, RF‑12 (los tres mensajes específicos).
  Hecho cuando: los textos exactos ("ese nombre de usuario ya está en uso", "no
  existe una cuenta con ese usuario", "contraseña incorrecta") viven en un único
  módulo y no aparecen hardcodeados en los route handlers (`grep`). Idioma
  marcado `[NECESITA ACLARACIÓN]`.
  ✔ Implementado: `src/lib/auth-messages.ts` — `AUTH_MESSAGES` (los 3 exactos +
  `invalidInput` + `noSession`) y `messageForAuthError(error)` (switch exhaustivo
  sobre `AnyAuthError`). Idioma `[NECESITA ACLARACIÓN]` (provisional: español).
  ✔ Unit verde: 3 tests — textos exactos, mapeo por tipo de error, y una guarda
  que lee `register/login/logout/session/route.ts` + `middleware.ts` y verifica
  que **ninguno** contiene los literales.

- [x] **T22 · `lib/http/problem.ts` + unit**
  RF: RF‑17 (forma de error estable en el borde HTTP). Soporte P6.
  Hecho cuando: el helper produce un cuerpo JSON de error de forma fija
  (`{ error, message }`) con su status; unit verde.
  ✔ Implementado: `src/lib/http/problem.ts` — `problem(status, {error, message,
  issues?})` (omite `issues` si falta/vacío), `jsonResponse(status, body,
  headers?)` para cuerpos de éxito con `Set-Cookie`. Puente
  `src/lib/http/auth-error-response.ts`: `authErrorResponse(AnyAuthError)` mapea
  `InvalidInput→422/invalid_input`, `UsernameTaken→409`, `UserNotFound→401`,
  `WrongPassword→401`, con el mensaje de T21.
  ✔ Unit verde: 4 tests — forma `{error,message}` + content-type + status;
  `issues` incluido/omitido; `jsonResponse` con cabeceras extra.

- [x] **T23 · `app/api/auth/register/route.ts` + integración**
  RF: RF‑1, RF‑2, RF‑3, RF‑4, RF‑5, RF‑6, RF‑8, RF‑17
  Hecho cuando: integración verde para: OK (`201` + `Set-Cookie` + documento sin
  texto claro), duplicado exacto (`409` + mensaje), **concurrente** (2 requests →
  una `201` y una `409`, un solo documento), rol inválido/ausente (`422`),
  longitudes por debajo del mínimo (`422`), campos extra o tipos equivocados
  (`422`, nada persistido).
  ✔ Implementado: `POST` → `asRecord(body)` (ignora extras; tipos "tal cual" al
  dominio) → `container.register` → `authErrorResponse` o `201` con
  `{role, redirectTo: landingPathForRole(role)}` + `Set-Cookie`
  (`sessionCookie().serialize`). JSON malformado → `422`.
  ✔ Integración verde (Mongo 7): 6 tests con los escenarios del "Hecho cuando",
  incluida la carrera vía `Promise.all` (una `201`, una `409`, un solo doc).

- [x] **T24 · `app/api/auth/login/route.ts` + integración**
  RF: RF‑9, RF‑10, RF‑11, RF‑12, RF‑13
  Hecho cuando: integración verde: OK (`200` + `Set-Cookie`), usuario inexistente
  (`401` + texto), contraseña incorrecta (`401` + texto), payload por debajo del
  mínimo (`422`, sin consultar credenciales — verificado con spy o marcador).
  ✔ Implementado: `POST` → `container.authenticate` → `200` con `{role,
  redirectTo}` + `Set-Cookie`, o `authErrorResponse`
  (`user_not_found`/`wrong_password` → `401`, `invalid_input` → `422`).
  ✔ Integración verde (Mongo 7): 5 tests — correcto `200`; inexistente `401` +
  "no existe una cuenta con ese usuario"; contraseña mala `401` + "contraseña
  incorrecta"; input corto `422`; login con `'  ANA  '` funciona (normalizado).

- [x] **T25 · `app/api/auth/logout/route.ts` + integración**
  RF: RF‑15, RF‑16
  Hecho cuando: `POST /api/auth/logout` con cookie → `200`, documento de
  `sessions` borrado, `Set-Cookie` con `Max-Age=0`; dos logins consecutivos
  producen cookies con el mismo `Max-Age`.
  ✔ Implementado: `POST` → `sessionCookie().read(cookie)` → si hay id,
  `container.logout(id)`; siempre `200 {ok:true}` + `Set-Cookie` de `clear()`
  (`Max-Age=0`). Idempotente sin cookie.
  ✔ Integración verde (Mongo 7): 3 tests — con cookie borra la sesión y la sonda
  con la cookie vieja da `401`; sin cookie `200` igualmente; dos logins → mismo
  `Max-Age` (RF‑16).

- [x] **T26 · `middleware.ts` + integración**
  RF: RF‑14 (la cookie válida sigue valiendo "tras reinicio"), RF‑15 (tras logout
  la cookie vieja deja de valer).
  Hecho cuando: con una ruta protegida de prueba: sin cookie o con cookie
  revocada → redirige a `/login`; con cookie válida → pasa; la misma cookie usada
  por un cliente nuevo ("tras reinicio") → sigue pasando. `PROTECTED = []`
  documentado con `[NECESITA ACLARACIÓN]`.
  ✔ Implementado: `src/middleware.ts` — puerta por **presencia** de cookie (Edge,
  sin `node:crypto` ni driver): `isProtected` sobre `PROTECTED_PREFIXES`; sin
  cookie → `401` en `/api/*` o redirección a `/login` en páginas. `matcher`
  estático (a mantener en sync). Ruta protegida real:
  `GET /api/auth/session` con la **verificación fuerte** (firma + sesión viva en
  Mongo; revocada/vencida/manipulada → `401`). Áreas por rol pendientes
  `[NECESITA ACLARACIÓN]`.
  ✔ Unit verde: `middleware.spec.ts` — 3 tests de `isProtected` (exacto,
  descendiente, prefijo parcial, defaults).
  ✔ Integración verde (Mongo 7): 7 tests — middleware sin cookie→`401`, con
  cookie→pasa, ruta libre→pasa; sonda sin cookie→`401`, válida→`200` +
  "reinicio", manipulada→`401`, tras logout→`401`.

  **Bloque E (endpoints HTTP, T21–T26) COMPLETO.**
  Suite: 127 unit / 180 con Mongo (53 de integración).

---

## F. Interfaz de usuario (depende de E)

- [x] **T27 · `components/auth/RegisterForm.tsx`**
  RF: RF‑1 (3 campos), RF‑2 (radios de rol sin `checked` inicial → se manda
  `undefined`), RF‑6 (redirige al `redirectTo` del `201`).
  Hecho cuando: utiliza la skill de frontend-design para el formulario shadcn con los 3 campos (rol **sin** preselección);
  llama a `/api/auth/register`; en `201` redirige a `landingPathForRole`; en
  `409`/`422` muestra el `message` del cuerpo; `package.json` sigue sin
  `react-hook-form` ni `zod`.
  ✔ Diseño (skill `frontend-design`): dirección "hoja de programación sobre papel
  cuadriculado". Tokens en `globals.css` (`@theme`): papel `#eef1ee`, tinta
  `#16211c`, verde "registrado" `#1f6f5c`, rojo "corregido" `#b23b2e`; tipos
  `Archivo` + `Space Mono` vía `next/font/google` (sin dep). Firma: el rol como
  **celdas de planilla** que al marcarse se rellenan + barra de acento + `✓`.
  Error = corrección en rojo. Grid de fondo tenue; `prefers-reduced-motion` y
  focus visibles.
  ✔ Comportamiento: `'use client'`, estado controlado, `fetch` a
  `/api/auth/register`, `router.push(body.redirectTo)` en `201`,
  `<p role="alert">` con `body.message` en 409/422. Sin `react-hook-form`/`zod`
  (guarda `scaffold.spec.ts` ampliada con el stack de shadcn: `tailwindcss`,
  `@tailwindcss/postcss`, `postcss`, `class-variance-authority`, `clsx`,
  `tailwind-merge`).
  ✔ Verificado: `next build` OK; el bundle CSS contiene `.sheet/.cell--on/…` y
  los tokens; snapshot de `/register` muestra los 3 campos + 2 celdas de rol
  sin preselección + botón "Crear cuenta"; endpoint responde
  `201 {redirectTo:"/"}`.

- [x] **T28 · `components/auth/LoginForm.tsx`**
  RF: RF‑9 (usuario + contraseña), RF‑10 (redirige en `200`), RF‑11/RF‑12
  (muestra el `message` del `401`).
  Hecho cuando: formulario con usuario y contraseña; en `200` redirige; en `401`
  muestra el texto recibido; checklist manual anotado en el PR.
  ✔ Implementado: misma planilla que T27 (eyebrow "Acceso · 001", `.sheet`), 2
  campos, `fetch` a `/api/auth/login`, `router.push(body.redirectTo)` en `200`,
  `<p role="alert">` con `body.message` en `401`.
  ✔ Verificado: `/login` responde `200` y renderiza `name="username|password"` +
  "Entrar"; smoke con contraseña corta → `422 invalid_input` (RF‑13 en el
  servidor).

- [x] **T29 · `components/auth/LogoutButton.tsx`**
  RF: RF‑15.
  Hecho cuando: visible siempre que hay sesión; hace `POST /api/auth/logout` y
  redirige a `/login`.
  ✔ Implementado: `'use client'`, `POST /api/auth/logout` y luego
  `router.push('/login')` + `refresh()`. Estilo `.ghost`. La página home lo monta
  sólo si la cookie `ent_session` está presente (`cookies()` en el server
  component).
  ✔ Verificado (smoke): `POST /api/auth/logout` con cookie → `200`; la sonda con
  esa cookie pasa a `401`.

- [x] **T30 · Páginas `(auth)/register` y `(auth)/login`**
  RF: RF‑1, RF‑9.
  Hecho cuando: ambas rutas renderizan su formulario; en `npm run dev` se puede
  completar manualmente registro → auto‑login → logout → login (checklist en PR).
  ✔ Implementado: `src/app/(auth)/register/page.tsx` y `.../login/page.tsx`
  (server components, `.auth-main` centrado con `.sheet-grid`, enlace cruzado al
  otro flujo). Home (`src/app/page.tsx`) muestra login/registro o `LogoutButton`
  según haya sesión.
  ✔ Verificado contra el build de producción + Mongo real: `/register` y `/login`
  → `200`; flujo completo por HTTP **registro → 201 auto‑login → GET
  /api/auth/session authenticated → logout 200 → session 401**. `next build`
  prerenderiza `/login` y `/register`.

  **Bloque F (interfaz de usuario, T27–T30) COMPLETO.**
  Suite intacta: 127 unit / 180 con Mongo (los componentes sólo renderizan y
  delegan → sin unit de lógica, plan §5.3). Falta el **checklist manual de QA en
  el PR** (T31).

---

## G. Cierre

- [x] **T31 · Verificación end‑to‑end y cobertura**
  RF: RF‑1 … RF‑17.
  Hecho cuando: `npm run test` (unit + integración) al 100 % verde; la tabla
  "Cobertura RF → módulo" de `plan.md` revisada con cada RF referenciado por al
  menos un test; checklist de QA manual adjunto al PR; lista de
  `[NECESITA ACLARACIÓN]` pendientes recogida en la descripción del PR.
  ✔ `npm run build` OK (typecheck incluido); `MONGODB_URI=… npm test` →
  **30 archivos / 180 tests / 0 fallos** (127 unit + 53 integración); sin Mongo →
  127 passed / 53 skipped.
  ✔ Entregable: `specs/001-registro-login/verification.md` — (1) estado del gate,
  (2) matriz RF‑1…RF‑17 → módulo → tests (cada RF con ≥ 1 test), (3) checklist de
  QA manual, (4) las 8 dudas `[NECESITA ACLARACIÓN]` con su decisión provisional
  vigente y dónde cambiarla, (5) notas de PR (deps de shadcn, env, migraciones).
  ✔ Flujo e2e contra el build de producción + Mongo real: registro → `201`
  auto‑login → `session authenticated` → `logout 200` → `session 401`.

  **Bloque G (cierre) COMPLETO. Spec 001 — Registro y Login: TODAS las tareas
  cerradas (T1–T31).**
