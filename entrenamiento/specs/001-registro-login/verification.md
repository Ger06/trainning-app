# Verificación 001 — Registro y Login (T31)

Cierre de la spec 001. Para pegar en la descripción del PR.

## 1. Estado de la verificación

| Comando | Resultado |
|---|---|
| `npm run build` | ✅ Next 16.3.0 compila + TypeScript OK. Rutas: `/`, `/login`, `/register`, `/api/auth/{register,login,logout,session}`, `/api/health`, middleware. |
| `MONGODB_URI=… npm test` | ✅ **30 archivos · 180 tests · 0 fallos** (127 unit + 53 integración). |
| `npm test` (sin Mongo) | ✅ 127 passed · 53 skipped (los de integración se saltan solos; exit 0). |

MongoDB de referencia: contenedor `mongo:7` (Docker) en `mongodb://127.0.0.1:27017`.
`SESSION_SECRET` requerido para los endpoints (el harness de integración pone uno de pruebas).

Flujo end‑to‑end comprobado contra el build de producción + Mongo real:
**registro → `201 {redirectTo:"/"}` (auto‑login) → `GET /api/auth/session` `authenticated` → `logout 200` → `session 401`.**

## 2. Cobertura RF → módulo / test

Cada RF está referenciado por al menos un test (unit y/o integración).

| RF | Qué exige | Implementación | Tests |
|----|-----------|----------------|-------|
| **RF‑1** | Registro: usuario + contraseña + rol, los 3 obligatorios | `credentials.parseCredentials`, `register/route.ts`, `RegisterForm` | `credentials.spec`, `register-user.spec`, `auth-register.spec` |
| **RF‑2** | Rol ∈ {entrenador, alumno}, sin default; inválido → error | `credentials.parseRole`, esquema `accounts` (`enum`), radios sin `checked` | `credentials.spec`, `register-user.spec`, `0001-…spec`, `accounts-migration.spec`, `auth-register.spec` |
| **RF‑3** | Usuario ≥ 2 caracteres (tras trim) | `credentials.parseUsername`, `minLength:2` en esquema | `credentials.spec`, `0001-…spec`, `accounts-migration.spec`, `auth-register.spec` |
| **RF‑4** | Contraseña ≥ 8 caracteres | `credentials.parsePassword` | `credentials.spec`, `auth-register.spec` (issue `password:too_short`) |
| **RF‑5** | Username único global; mensaje específico | `normalizeUsername` + índice único `usernameNormalized`; chequeo previo + `catch` de `UsernameTakenError` (carrera) | `register-user.spec`, `mongo-account-repository.spec`, `accounts-migration.spec`, `auth-register.spec` (incl. concurrencia) |
| **RF‑6** | Registro válido → auto‑login + destino según rol | `registerUser` emite `Session`; `route` pone `Set-Cookie` + `redirectTo`; `landingPathForRole` | `register-user.spec`, `landing-path.spec`, `auth-register.spec` |
| **RF‑7** | Rol inmutable; sin setter ni update | `Account` congelado, `role` readonly; repo sin update; esquema `enum` | `account.spec`, `register-user.spec`, `mongo-account-repository.spec`, `0001-…spec` |
| **RF‑8** | Contraseña nunca en claro; sólo hash irreversible | `scryptPasswordHasher` (`scrypt$…`); `assertHashed`; esquema sin `password` + `pattern` | `scrypt-password-hasher.spec`, `account.spec`, `register-user.spec`, `accounts-migration.spec`, `auth-register.spec` |
| **RF‑9** | Login: usuario + contraseña | `login/route.ts`, `LoginForm` | `auth-login.spec` |
| **RF‑10** | Login correcto → sesión + destino según rol | `authenticateUser` emite `Session`; `route` `Set-Cookie` + `redirectTo` | `authenticate-user.spec`, `mongo-session-repository.spec`, `auth-login.spec` |
| **RF‑11** | Usuario inexistente → "no existe una cuenta con ese usuario" | `UserNotFoundError` sin llamar `verify`; `authErrorResponse` 401 | `authenticate-user.spec`, `auth-login.spec` |
| **RF‑12** | Contraseña incorrecta → "contraseña incorrecta" | `hasher.verify` → `WrongPasswordError`; 401 | `authenticate-user.spec`, `auth-login.spec` |
| **RF‑13** | Campos vacíos / bajo mínimo → validación, no autentica | `parseLoginInput` antes de tocar el repo | `credentials.spec`, `authenticate-user.spec`, `auth-login.spec` |
| **RF‑14** | Sesión persiste entre cierres; no caduca por inactividad | `MAX_AGE_SECONDS` (cookie + `expiresAt`); índice TTL; `get` filtra vencidas (`isExpired`) | `session.spec`, `cookie-session.spec`, `0002-…spec`, `sessions-migration.spec`, `mongo-session-repository.spec`, `auth-session-middleware.spec` |
| **RF‑15** | "Cerrar sesión" siempre disponible; corta el acceso | `logoutUser` → `revoke` (idempotente); `logout/route.ts` limpia cookie; sonda `401` tras logout | `logout-user.spec`, `mongo-session-repository.spec`, `auth-logout.spec`, `auth-session-middleware.spec` |
| **RF‑16** | Sin "recuérdame"; comportamiento uniforme | única constante `MAX_AGE_SECONDS`; `route` sin parámetro de duración | `session.spec`, `cookie-session.spec`, `auth-logout.spec` (dos logins, mismo `Max-Age`) |
| **RF‑17** | Reglas aplicadas por la lógica, no por el formulario | validación en los casos de uso; `route` con `asRecord` (ignora extras, tipos "tal cual") | `authenticate-user.spec`, `auth-register.spec` (payload que el form nunca enviaría → 422) |

Soporte de la constitución: **P3** (dominio puro — guardas de pureza en cada `*.spec` del dominio), **P4** (`test/unit/architecture.spec.ts`: `src/app` sin `mongodb`), **P5** (unit + integración, este gate), **P6** (`$jsonSchema` + migraciones versionadas — `migrate.spec`, `accounts-migration.spec`, `sessions-migration.spec`).

## 3. Checklist de QA manual

Preparación: `docker run -d -p 27017:27017 --name ent-mongo mongo:7`, luego
`MONGODB_URI=mongodb://127.0.0.1:27017 SESSION_SECRET=un-secreto-largo npm run dev`.

**Registro (RF‑1, RF‑2, RF‑5, RF‑6, RF‑8)**
- [ ] `/register` muestra usuario, contraseña y los dos roles; **ningún rol preseleccionado**.
- [ ] Alta `ana` / `clave-larga-1` / Alumno → queda dentro sin pedir login; URL `/`.
- [ ] En `/` con sesión aparece **"Cerrar sesión"**.
- [ ] Reintentar alta con `ana` → banda roja "ese nombre de usuario ya está en uso"; no se crea otra cuenta.
- [ ] Alta sin elegir rol → error de validación; no se crea cuenta.
- [ ] Alta con usuario de 1 carácter o contraseña de 7 → error de validación.
- [ ] Al elegir un rol, la celda se marca (relleno verde + barra izquierda + `✓`).

**Login (RF‑9…RF‑13)**
- [ ] `/login` con `ana` + contraseña equivocada → "contraseña incorrecta".
- [ ] `/login` con usuario inexistente → "no existe una cuenta con ese usuario".
- [ ] `/login` con `ANA` (mayúsculas) + `clave-larga-1` → entra (unicidad case‑insensitive, provisional).
- [ ] `/login` con campos vacíos → error de validación (no dice si la cuenta existe).
- [ ] Login correcto → `/`.

**Sesión y logout (RF‑14, RF‑15, RF‑16)**
- [ ] Con sesión abierta, cerrar y reabrir el navegador → sigue con sesión.
- [ ] "Cerrar sesión" → va a `/login`; volver a `/` ya no muestra el botón.
- [ ] Tras logout, pegar de nuevo la URL anterior no reabre la sesión.

**Calidad**
- [ ] Teclado: Tab recorre campos y celdas de rol; foco siempre visible.
- [ ] Móvil (~375 px): la planilla entra sin scroll horizontal.
- [ ] `prefers-reduced-motion`: sin animación de relleno.

## 4. Dudas abiertas `[NECESITA ACLARACIÓN]` y decisión provisional vigente

Ninguna bloquea el flujo; todas están aisladas en un punto único de cambio.

| # | Duda (spec.md) | Decisión provisional en el código | Dónde cambiarla |
|---|---|---|---|
| 1 | Longitud **máxima** de usuario y contraseña | Sin máximo (ni en validación ni en el esquema) | `credentials.ts`, `0001-…ts` |
| 2 | Charset del usuario; ¿trim de extremos? | `trim` de extremos; sin restricción de caracteres | `credentials.ts::normalizeUsername` / `parseUsername` |
| 3 | ¿Unicidad y login sensibles a mayúsculas? | **No** — `toLowerCase` en la normalización → "Ana" y "ana" son la misma cuenta | `credentials.ts::normalizeUsername` (cambiar la regla implica **migración de re‑cálculo** del campo + índice) |
| 4 | ¿Contraseña conserva espacios extremos? ¿Complejidad? | Se conserva tal cual; sólo‑espacios → `required`; sin reglas de complejidad | `credentials.ts::parsePassword` |
| 5 | ¿Tope **absoluto** de la sesión? | 400 días (máximo práctico de cookie), en `Max-Age` y en `expiresAt` | `session-cookie-constants.ts` (`MAX_AGE_SECONDS`) |
| 6 | Idioma de los mensajes (es/en) | Español, centralizado | `src/lib/auth-messages.ts` |
| 7 | Usuario ya logueado que abre `/login` o `/register` | Sin trato especial: ve el formulario igual (`middleware` no intercepta esas rutas) | `src/middleware.ts` (`PROTECTED_PREFIXES` / `config.matcher`) |
| 8 | ¿Impedir la misma persona como entrenador y alumno? | No se impide; necesitaría dos usernames distintos (unicidad global, sin verificación de identidad) | — (requiere decisión de producto) |

Fuera de alcance de la spec y **no implementado** (recordatorio para el PR): recuperación/cambio de contraseña, cambio de username/rol, verificación de identidad, **protección contra fuerza bruta / registro masivo** (sin rate‑limit ni captcha), login con terceros, gestión de perfil, sesiones múltiples, áreas por rol (el middleware sólo protege `/api/auth/session` hasta que existan).

## 5. Notas para el PR

- **Dependencias añadidas** (todas dentro de "shadcn/ui" de la constitución P1):
  `tailwindcss`, `@tailwindcss/postcss`, `postcss`, `class-variance-authority`,
  `clsx`, `tailwind-merge`. Fuentes vía `next/font/google` (Archivo, Space Mono) —
  sin paquete. **Sin** `react-hook-form` ni `zod` (validación a mano, D7 del plan).
- **Variables de entorno**: `MONGODB_URI`, `MONGODB_DB` (opcional, default
  `entrenamiento`), `SESSION_SECRET` (≥ 16 caracteres, obligatoria para los
  endpoints).
- **Migraciones**: `runMigrations` / `migrate()` deben ejecutarse contra la BD
  antes de servir tráfico (crea `accounts`, `sessions`, índices). En CI se corren
  desde el harness de integración.
- **Middleware**: Next 16 lo llama "Proxy"; `config.matcher` es estático y debe
  mantenerse en sync con `PROTECTED_PREFIXES`.
