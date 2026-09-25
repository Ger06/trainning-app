# Plan 001 — Registro y Login

> Plan de implementación de `spec.md`. Define **cómo**: estructura de módulos,
> decisiones técnicas (con la alternativa descartada) y estrategia de tests.
> Cada bloque marca los **RF** que cubre. Todo se valida contra
> `docs/constitution.md` (P1 stack mínimo, P2 spec↔código, P3 lógica/interfaz,
> P4 persistencia aislada, P5 tests, P6 datos con forma explícita).

---

## 0. Resumen de enfoque

Arquitectura de **puertos y adaptadores**:

- **Dominio puro** (`src/domain/auth/`): value objects, entidad, casos de uso y
  *puertos* (interfaces). Sin React, sin red, sin `mongodb`. → P3.
- **Infraestructura** (`src/infra/`): adaptadores concretos de los puertos
  (repositorio Mongo, hasher, store de sesión), cliente de BD y migraciones. → P4, P6.
- **Interfaz** (`src/app/`, `src/components/`): route handlers HTTP finos y
  componentes shadcn que sólo renderizan y delegan. → P3.
- **Composition root** (`src/infra/container.ts`): único lugar que ensambla casos
  de uso con adaptadores concretos. Los handlers importan de aquí, nunca el driver. → P4.

Sin dependencias nuevas: sólo Next.js, shadcn/ui, Vitest y MongoDB (driver
oficial). → P1.

---

## 1. Estructura de módulos

```
src/
  domain/
    auth/
      ports.ts                # interfaces: AccountRepository, PasswordHasher,
                              #   SessionStore, Clock, IdGenerator
      errors.ts               # errores tipados: InvalidInput, UsernameTaken,
                              #   UserNotFound, WrongPassword
      credentials.ts          # parseUsername, parsePassword, parseRole,
                              #   normalizeUsername  (validación pura)
      account.ts              # entidad Account (username, usernameNormalized,
                              #   role, passwordHash, createdAt) — sin setters de role
      session.ts              # value object Session (id, accountId, expiresAt)
      landing-path.ts         # landingPathForRole(role) -> string
      register-user.ts        # caso de uso: (input, deps) -> Result<Session, …>
      authenticate-user.ts    # caso de uso: login
      logout-user.ts          # caso de uso
  infra/
    db/
      mongo-client.ts         # conexión única perezosa al cluster
      migrations/
        0001-accounts-schema-and-unique-index.ts
        0002-sessions-schema-and-ttl-index.ts
        migrate.ts            # runner idempotente, registra en _migrations
    repositories/
      mongo-account-repository.ts   # implements AccountRepository
      mongo-session-repository.ts   # implements SessionStore (persistencia)
    security/
      scrypt-password-hasher.ts     # implements PasswordHasher (node:crypto)
      cookie-signer.ts              # HMAC firma/verifica el valor de cookie
    session/
      cookie-session.ts             # (de)serializa la cookie de sesión + flags
    container.ts                    # ensambla casos de uso con adaptadores
  app/
    api/auth/register/route.ts      # POST: parse JSON -> registerUser -> 201/4xx + Set-Cookie
    api/auth/login/route.ts         # POST: -> authenticateUser -> 200/4xx + Set-Cookie
    api/auth/logout/route.ts        # POST: -> logoutUser -> 200 + Set-Cookie borrado
    (auth)/register/page.tsx        # server component: monta RegisterForm
    (auth)/login/page.tsx
  components/
    auth/RegisterForm.tsx           # client: campos shadcn, llama al endpoint, redirige
    auth/LoginForm.tsx
    auth/LogoutButton.tsx
  middleware.ts                     # protege zonas con cuenta; redirige a /login
  lib/http/problem.ts               # forma única de respuesta de error (JSON)
```

**Contratos de puertos (dominio, sin implementación):**

| Puerto | Métodos | Implementado por |
|---|---|---|
| `AccountRepository` | `findByNormalizedUsername`, `insert` (lanza `UsernameTaken` ante índice único) | `mongo-account-repository.ts` |
| `PasswordHasher` | `hash(plain)`, `verify(plain, stored)` | `scrypt-password-hasher.ts` |
| `SessionStore` | `issue(accountId)`, `get(id)`, `revoke(id)` | `mongo-session-repository.ts` + `cookie-session.ts` |
| `Clock` | `now()` | adaptador trivial (`() => new Date()`) |
| `IdGenerator` | `newId()` | `node:crypto.randomUUID` |

---

## 2. Decisiones técnicas

### D1 · Puertos y adaptadores con casos de uso puros
**Elegido.** Los casos de uso son funciones que reciben `deps` (los puertos) por
parámetro y devuelven un `Result` tipado; no importan nada de Next ni de Mongo.
**Por qué:** P3 (lógica sin React ni red) y P4 (Mongo sólo en repositorios); hace
los casos de uso testeables con dobles, sin levantar Next ni BD.
**Alternativa descartada:** lógica dentro de los route handlers / Server Actions
con acceso directo a Mongo. Viola P4 (el handler importaría el driver) y P3
(lógica acoplada al framework), e impide el unit test aislado.
**Cubre:** base de RF‑1…RF‑17.

### D2 · Transporte: Route Handlers REST `/api/auth/*` (no Server Actions)
**Elegido.** Tres endpoints `POST`: `register`, `login`, `logout`. Cada handler
parsea JSON, llama al caso de uso y traduce el `Result` a status + cuerpo JSON
con forma fija (`lib/http/problem.ts`).
**Por qué:** la spec exige tests "de integración por endpoint/flujo"; un handler
`Request → Response` se prueba con `fetch` sin render. El contrato JSON queda
explícito y versionable → P6 ("no se cambia el formato del JSON sin actualizar la
spec").
**Alternativa descartada:** Server Actions. Más idiomáticas en Next 16, pero su
contrato entrada/salida es implícito y ligado a React, más difícil de versionar
como "formato JSON", y su test de integración necesita más andamiaje del runtime.
**Cubre:** RF‑1, RF‑6, RF‑9, RF‑10, RF‑11, RF‑12, RF‑13, RF‑15, RF‑17.

### D3 · Hashing de contraseña: `scrypt` de `node:crypto` (no bcrypt/argon2)
**Elegido.** `passwordHash` se guarda como cadena `scrypt$N$r$p$salt$hash`, sal
de 16 bytes por alta, parámetros de coste fijados en constante.
**Por qué:** RF‑8 exige almacenamiento irreversible; `scrypt` es un KDF con sal
resistente a fuerza bruta y viene en la runtime → cero dependencias nuevas (P1).
**Alternativa descartada:** `bcrypt` / `argon2`. Mejor ergonomía de tuning, pero
son dependencias nativas nuevas; P1 sólo las permite si es "imposible sin ellas",
y `scrypt` cubre RF‑8.
**Cubre:** RF‑8. Parcialmente RF‑12 (comparación por `verify`).

### D4 · Sesión: cookie opaca firmada + estado en Mongo (no JWT sin estado)
**Elegido.** `SessionStore.issue` crea un documento en `sessions`
(`{_id, accountId, createdAt, expiresAt}`) y devuelve su id; la cookie
`ent_session` lleva ese id **firmado con HMAC** (`cookie-signer.ts`), con
`HttpOnly`, `SameSite=Lax`, `Secure`, `Path=/` y `Max-Age` **único y fijo** para
todos. Cada request valida: firma OK → id existe en Mongo y no expiró.
**Por qué:** RF‑14 (persiste entre cierres de navegador) se logra con `Max-Age`
largo y sin expiración por inactividad. RF‑15 (logout real) exige poder revocar:
se borra el documento de `sessions`; un JWT no se revoca sin lista negra. RF‑16
(sin "recuérdame") → una sola constante de duración, el endpoint de login no
acepta parámetro de duración. HMAC con `node:crypto`, sin dependencia.
**Alternativa descartada 1:** JWT en cookie sin estado. Ahorra una lectura por
request pero no permite logout real (choca con RF‑15) y complica el tope de
expiración.
**Alternativa descartada 2:** `next-auth` / `iron-session`. Dependencias nuevas
(P1) y no imprescindibles para este alcance.
**Cubre:** RF‑6, RF‑10, RF‑14, RF‑15, RF‑16.

### D5 · Persistencia: driver oficial + `$jsonSchema` en la colección + migraciones versionadas (no Mongoose)
**Elegido.** Colecciones `accounts` y `sessions` creadas por migración con
validador `$jsonSchema` (`additionalProperties:false`, `required` completo, `role`
como `enum`, `passwordHash` con `pattern`). Runner `migrate.ts` idempotente que
registra cada migración aplicada en `_migrations`; se ejecuta en el arranque de
`npm run dev` y en CI antes de los tests de integración.
**Por qué:** P6 literal — "esquema validado en escritura y migración versionada".
El validador nativo rechaza documentos mal formados aunque el repo tuviera un
bug.
**Alternativa descartada 1:** Mongoose. Aporta esquema, pero es dependencia nueva
(P1) y su capa de modelos tiende a filtrarse fuera del repositorio (P4).
**Alternativa descartada 2:** validar sólo en la aplicación. No cumple "validado
en escritura" a nivel documento; se hace validación de dominio **y** de BD
(defensa en profundidad).
**Cubre:** RF‑5, RF‑7, RF‑8, RF‑14. Soporte de P6.

### D6 · Unicidad de username: campo derivado `usernameNormalized` + índice único + traducción de `E11000`
**Elegido.** `credentials.ts::normalizeUsername` produce `usernameNormalized`;
migración `0001` crea índice único sobre ese campo. `register-user.ts` primero
consulta (para poder devolver el mensaje exacto) y además `insert` traduce el
error `E11000` del índice a `UsernameTaken`, cerrando la ventana de carrera entre
dos altas simultáneas del mismo nombre.
**Por qué:** el índice único es la única fuente de verdad fiable ante
concurrencia; el `findOne` previo por sí solo deja una ventana de carrera.
**Alternativa descartada:** sólo `findOne` previo, sin índice único. Permite dos
cuentas con el mismo nombre bajo concurrencia.
**Dependencia de spec:** la regla exacta de normalización (mayúsculas, acentos,
trim) es `[NECESITA ACLARACIÓN]` en `spec.md`. Se aísla en `normalizeUsername`
como **único punto de cambio**; hasta que se aclare se implementa `trim` +
`toLowerCase` como provisional y se marca en el código con `[NECESITA ACLARACIÓN]`.
Por P2 no se cierra RF‑5 hasta la aclaración.
**Cubre:** RF‑5.

### D7 · Validación de entrada: funciones puras en el dominio (sin librería de validación)
**Elegido.** `credentials.ts` implementa a mano: requerido, longitud mínima
(RF‑3, RF‑4), `role ∈ {entrenador, alumno}` sin default (RF‑2). Los route
handlers sólo comprueban que el body es JSON con las claves esperadas y delegan;
la decisión de validez es del dominio. Los formularios shadcn replican las reglas
para feedback inmediato con estado controlado de React, **sin** `react-hook-form`
ni `zod`.
**Por qué:** P1 (esas librerías son dependencias nuevas y las reglas aquí son
triviales) y P3 (reglas unit-testables sin framework). RF‑17: el servidor es
siempre la autoridad, el cliente es sólo conveniencia.
**Alternativa descartada:** `zod` / `valibot` + `react-hook-form`. Ergonómicas y
habituales con shadcn, pero dependencias nuevas no justificables para 3 campos.
**Cubre:** RF‑1, RF‑2, RF‑3, RF‑4, RF‑13, RF‑17.

### D8 · Mensajes de error específicos mapeados 1:1 desde errores de dominio
**Elegido.** `authenticate-user.ts` devuelve `UserNotFound` o `WrongPassword`
como casos distintos; el handler los mapea a `401` con los textos exactos de la
spec ("no existe una cuenta con ese usuario" / "contraseña incorrecta") y el
registro devuelve `409` con "ese nombre de usuario ya está en uso". Diferencia
deliberada de rutas (no se ejecuta `verify` si el usuario no existe), coherente
con la sección "Por qué" de la spec.
**Por qué:** RF‑11, RF‑12, RF‑5 piden mensajes específicos; la spec acepta
explícitamente la enumeración de usuarios en esta etapa.
**Alternativa descartada:** mensaje único genérico + tiempo constante. Mejor
privacidad, pero contradice RF‑11/RF‑12 tal como están escritos.
**Dependencia de spec:** idioma de los textos es `[NECESITA ACLARACIÓN]`; se
centralizan en un único módulo de mensajes para poder traducir sin tocar la
lógica.
**Cubre:** RF‑5, RF‑11, RF‑12.

### D9 · Protección de zonas con cuenta: `middleware.ts` + revalidación en cada carga de datos
**Elegido.** `middleware.ts` comprueba firma + presencia de la cookie y redirige
a `/login` las rutas de una lista `PROTECTED`. La verificación fuerte (sesión
viva en Mongo) se repite en cada handler/loader que sirva datos privados.
**Por qué:** RF‑15 — tras el logout las zonas con cuenta dejan de ser accesibles;
el middleware es el punto único en Next para no depender de que cada página se
acuerde de comprobar.
**Alternativa descartada:** comprobar sólo página por página. Repetitivo y
propenso a fugas por omisión.
**Dependencia de spec:** qué rutas son "zona protegida" no está definido en la
spec 001 (aún no hay áreas de entrenador/alumno). Se entrega el gancho con
`PROTECTED = []` y se completa en specs siguientes.
**Cubre:** RF‑15.

### D10 · Destino post-autenticación: `landingPathForRole(role)` en el dominio
**Elegido.** Función pura que hoy devuelve `/` para ambos roles; los handlers y
formularios la usan para redirigir tras RF‑6 y RF‑10.
**Por qué:** los espacios por rol todavía no existen; un único punto de cambio
evita esparcir rutas por la interfaz (P3).
**Cubre:** RF‑6, RF‑10.

---

## 3. Cobertura RF → módulo

| RF | Módulos principales | Verificación |
|----|--------------------|--------------|
| RF‑1 | `credentials.ts`, `api/auth/register/route.ts`, `RegisterForm.tsx` | unit + integración |
| RF‑2 | `credentials.ts::parseRole`, `register-user.ts` | unit + integración |
| RF‑3 | `credentials.ts::parseUsername` | unit (límites 1/2) |
| RF‑4 | `credentials.ts::parsePassword` | unit (límites 7/8) |
| RF‑5 | `credentials.ts::normalizeUsername`, `mongo-account-repository.ts`, migración `0001`, `register-user.ts` | unit + integración (duplicado exacto + carrera) |
| RF‑6 | `register-user.ts`, `SessionStore`, `cookie-session.ts`, `landing-path.ts`, `register/route.ts` | integración (doc creado + `Set-Cookie`) |
| RF‑7 | `account.ts` (sin setter de `role`), `mongo-account-repository.ts` (sin update de rol) | unit + revisión estática |
| RF‑8 | `scrypt-password-hasher.ts`, `account.ts`, `$jsonSchema` de `accounts` (sin campo `password`) | unit (`verify`) + integración (doc sin texto claro) |
| RF‑9 | `LoginForm.tsx`, `login/route.ts`, `authenticate-user.ts` | integración |
| RF‑10 | `authenticate-user.ts`, `SessionStore`, `landing-path.ts` | integración |
| RF‑11 | `authenticate-user.ts` (`UserNotFound`), `login/route.ts`, mensajes | unit + integración |
| RF‑12 | `authenticate-user.ts` (`WrongPassword`), `hasher.verify` | unit + integración |
| RF‑13 | `credentials.ts` reutilizado por `authenticate-user.ts` (corta antes del repo) | unit (repo no invocado) + integración |
| RF‑14 | `cookie-session.ts` (`Max-Age` largo), `mongo-session-repository.ts`, migración `0002` (TTL) | integración (cookie reutilizada "tras reinicio") |
| RF‑15 | `logout-user.ts`, `logout/route.ts`, `LogoutButton.tsx`, `middleware.ts` | integración (cookie vieja → 401/redirect) |
| RF‑16 | `cookie-session.ts` (constante `MAX_AGE` única), `login/route.ts` (sin parámetro de duración) | unit + integración (dos logins, mismo `Max-Age`) |
| RF‑17 | todos los casos de uso validan vía `credentials.ts`; handlers no confían en el cliente | integración (payloads que el form nunca enviaría) |

---

## 4. Modelo de datos (P6)

**`accounts`** — validador `$jsonSchema`, `additionalProperties:false`:

| Campo | Tipo | Regla |
|---|---|---|
| `_id` | ObjectId | — |
| `username` | string | tal como lo tecleó la persona, `minLength: 2` |
| `usernameNormalized` | string | derivado; **índice único** |
| `role` | string | `enum: ["entrenador","alumno"]` |
| `passwordHash` | string | `pattern: ^scrypt\$...` ; nunca la contraseña en claro |
| `createdAt` | date | — |

**`sessions`** — validador `$jsonSchema`:

| Campo | Tipo | Regla |
|---|---|---|
| `_id` | string | id de sesión (UUID), va firmado en la cookie |
| `accountId` | ObjectId | ref a `accounts._id` |
| `createdAt` | date | — |
| `expiresAt` | date | **índice TTL**; valor exacto pendiente de `[NECESITA ACLARACIÓN]` (tope de sesión) |

**`_migrations`** — `{ name, appliedAt }`, una fila por migración aplicada.

Migraciones: `0001-accounts-schema-and-unique-index`,
`0002-sessions-schema-and-ttl-index`. Idempotentes; `migrate.ts` las aplica en
orden y salta las ya registradas.

---

## 5. Estrategia de tests (P5)

`npm run test` = `test:unit` + `test:integration`, ambos verdes para fusionar.

### 5.1 Unit (Vitest, sin DOM, sin Mongo; puertos como dobles en memoria)

| Archivo | Casos | RF |
|---|---|---|
| `credentials.spec.ts` | username 1 vs 2 chars; sólo espacios; password 7 vs 8; `role` ausente / inválido / válido; `normalizeUsername` idempotente | RF‑2, RF‑3, RF‑4, RF‑13 |
| `register-user.spec.ts` | happy path → emite sesión; repo devuelve existente → `UsernameTaken`; `insert` lanza `E11000` simulado → `UsernameTaken` (carrera); llama `hasher.hash` y nunca persiste texto claro; `role` se guarda sin transformar | RF‑5, RF‑6, RF‑7, RF‑8 |
| `authenticate-user.spec.ts` | usuario inexistente → `UserNotFound` (no llama `verify`); hash no coincide → `WrongPassword`; ok → sesión; input corto → `InvalidInput` sin tocar el repo | RF‑10, RF‑11, RF‑12, RF‑13, RF‑17 |
| `logout-user.spec.ts` | revoca la sesión del store; idempotente si ya no existe | RF‑15 |
| `scrypt-password-hasher.spec.ts` | `verify(hash(p), p) === true`; `verify` con otra pass `=== false`; formato de la cadena; sal distinta por llamada | RF‑8 |
| `cookie-session.spec.ts` / `cookie-signer.spec.ts` | firma válida / manipulada; flags `HttpOnly`+`SameSite`+`Secure`+`Path`; `MAX_AGE` es la constante única | RF‑14, RF‑16 |
| `landing-path.spec.ts` | `entrenador` y `alumno` → ruta esperada | RF‑6, RF‑10 |

### 5.2 Integración (Vitest, MongoDB real de CI/Docker, BD por-run que se elimina)

Se invocan los route handlers con `fetch` sobre la app; migraciones aplicadas antes.

| Escenario | Aserciones | RF |
|---|---|---|
| Registro OK | `201`, `Set-Cookie` presente, doc en `accounts` con `passwordHash` y sin `password`, `usernameNormalized` seteado | RF‑1, RF‑6, RF‑8 |
| Registro username duplicado exacto | `409` + "ese nombre de usuario ya está en uso"; sigue habiendo **un** doc | RF‑5 |
| Registro concurrente (2 requests simultáneas, mismo username) | exactamente una `201` y una `409`; un solo doc | RF‑5 (carrera) |
| Registro rol inválido / ausente | `422`; sin doc | RF‑2 |
| Registro username 1 char / password 7 | `422`; sin doc | RF‑3, RF‑4 |
| Login OK | `200` + `Set-Cookie`; la cookie da acceso a una ruta `PROTECTED` de prueba | RF‑9, RF‑10 |
| Login usuario inexistente | `401` + "no existe una cuenta con ese usuario" | RF‑11 |
| Login contraseña incorrecta | `401` + "contraseña incorrecta" | RF‑12 |
| Login payload corto | `422`; ninguna cuenta consultada (spy sobre el repo o marcador de control) | RF‑13, RF‑17 |
| Sesión persistente | reusar la cookie con un cliente nuevo ("tras reinicio") → sigue autorizada; sin refresco de expiración por uso | RF‑14 |
| Logout | `POST /api/auth/logout` con cookie → `200`, doc de `sessions` borrado, `Set-Cookie` con `Max-Age=0`; reusar cookie vieja en ruta `PROTECTED` → redirect/`401` | RF‑15 |
| Uniformidad de duración | dos logins (uno con flags extra que un cliente pudiera enviar) → cookies con el mismo `Max-Age` | RF‑16 |
| Autoridad del servidor | `POST /register` con campos extra / tipos equivocados / `Content-Type` raro → `422`, nada persistido | RF‑17 |
| Validador de BD | intento de `insert` de un doc que viola `$jsonSchema` (test del repo) → rechazado | P6 (soporte RF‑5, RF‑8) |

### 5.3 Componentes

Los componentes sólo renderizan y delegan (P3), así que no llevan test unitario
de lógica. Cobertura de UI de RF‑6/RF‑10 (redirección) y RF‑15 (botón siempre
visible con sesión) mediante los tests de integración vía HTTP + un **checklist
de QA manual** en el PR. No se añaden `@testing-library/*` (dependencia nueva, P1)
salvo que el equipo lo apruebe por spec.

---

## 6. Cumplimiento de la constitución

| Principio | Cómo lo cumple este plan |
|---|---|
| **P1 Stack mínimo** | Sólo Next.js, shadcn/ui, Vitest, driver `mongodb`. Hashing y firma con `node:crypto`; validación a mano. Alternativas con dependencias (bcrypt, zod, next-auth, mongoose, testing-library, mongodb-memory-server) quedan **descartadas y documentadas**. |
| **P2 Spec↔código** | Cada bloque referencia RF. Los puntos que dependen de `[NECESITA ACLARACIÓN]` (normalización RF‑5, tope de sesión RF‑14, idioma RF‑11/12, redirección de usuario ya logueado) se aíslan en un punto único y **no se dan por cerrados** hasta la aclaración. |
| **P3 Lógica/interfaz** | `src/domain/**` sin React ni red; casos de uso reciben puertos por parámetro; sus tests no montan componentes. Componentes y handlers sólo delegan. |
| **P4 Persistencia aislada** | `mongodb` sólo bajo `src/infra/`; handlers y componentes importan de `container.ts`, nunca el driver ni arman queries. |
| **P5 Tests** | Unit para todo el dominio y adaptadores; integración para los tres endpoints y los flujos de la spec; `npm run test` verde como gate. |
| **P6 Datos con forma explícita** | `accounts` y `sessions` con `$jsonSchema` + índices (único, TTL) creados por **migraciones versionadas** con runner idempotente y tabla `_migrations`. |

---

## 7. Riesgos y dependencias de aclaración

- **RF‑5 normalización**: implementación provisional `trim`+`toLowerCase` aislada
  en `normalizeUsername`; el índice único se crea sobre el campo derivado, así
  que un cambio de regla implica **una migración de re-cálculo**. Marcar en PR.
- **RF‑14 tope de sesión**: el índice TTL necesita un valor. Provisional: sin TTL
  efectivo (fecha muy lejana) hasta aclarar; el campo ya existe para no migrar el
  esquema luego.
- **RF‑11/RF‑12 idioma**: textos centralizados en un módulo de mensajes; si se
  decide i18n desde el inicio, se enchufa el catálogo sin tocar casos de uso.
- **Usuario ya autenticado abre `/login` o `/register`**: `middleware.ts` deja el
  gancho; comportamiento (redirigir vs permitir) pendiente de la spec.
- **Registro automatizado masivo**: fuera del alcance de la spec; el plan no
  añade captcha ni rate‑limit. Anotado como deuda para una spec futura.
