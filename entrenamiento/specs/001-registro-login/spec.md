# Spec 001 — Registro y Login

## Contexto y objetivo

Entrenamiento es una plataforma donde **entrenadores** crean rutinas de ejercicios
y las asignan a **alumnos** en un cronograma. Antes de poder crear o consultar
nada, cada persona necesita una cuenta y una forma de volver a entrar.

Esta spec define el registro y el inicio de sesión mínimos: crear una cuenta con
un nombre de usuario y una contraseña, declarando en el registro si se entra como
entrenador o como alumno, y volver a entrar más tarde con esas credenciales.

**Objetivo:** que cualquier persona pueda crear una cuenta con rol y autenticarse
de forma fiable, dejando establecido el rol como base de toda la autorización
posterior del producto.

### Por qué

- El producto tiene dos audiencias con permisos opuestos (el entrenador crea y
  asigna; el alumno consulta). El rol elegido en el registro es el dato que
  gobierna qué ve y qué puede hacer cada persona; sin él, nada más del producto
  tiene sentido.
- Un alta mínima (solo usuario + contraseña) reduce la fricción de entrada en una
  etapa temprana y evita recolectar datos personales que todavía no se usan.
- El público inicial es reducido y conocido (un entrenador y sus alumnos), así que
  se priorizan mensajes de error claros sobre ocultar la existencia de cuentas;
  la protección contra abuso se abordará cuando el producto se exponga en abierto.
- La sesión persistente con cierre manual se ajusta al uso previsto: consultas
  frecuentes desde el dispositivo personal de cada persona.

## Requisitos funcionales (el QUÉ)

### Registro

- **RF-1** El registro pide tres datos obligatorios: nombre de usuario,
  contraseña y rol.
- **RF-2** El rol es exactamente uno de: `entrenador` o `alumno`. No hay valor por
  defecto; la persona debe elegirlo explícitamente. Un valor ausente o distinto de
  esos dos es un error de validación y no crea cuenta.
- **RF-3** El nombre de usuario tiene un mínimo de 2 caracteres.
- **RF-4** La contraseña tiene un mínimo de 8 caracteres.
- **RF-5** El nombre de usuario es único en todo el sistema (incluye a
  entrenadores y alumnos en el mismo espacio de nombres). Si ya está tomado, el
  registro falla con el mensaje "ese nombre de usuario ya está en uso" y no se
  crea ninguna cuenta.
- **RF-6** Un registro válido crea la cuenta con su rol y **deja a la persona con
  la sesión iniciada**, llevándola a su espacio según el rol, sin pedirle que
  inicie sesión de nuevo.
- **RF-7** El rol queda fijado en el registro y no puede cambiarse después.
- **RF-8** La contraseña nunca se guarda ni se muestra en claro; se conserva de
  forma que no pueda recuperarse su valor original. *(Por qué: principio de datos
  con forma explícita de la constitución y seguridad mínima.)*

### Inicio de sesión

- **RF-9** El inicio de sesión pide nombre de usuario y contraseña.
- **RF-10** Con credenciales correctas, la persona queda con la sesión iniciada y
  entra a su espacio según su rol.
- **RF-11** Si no existe ninguna cuenta con ese nombre de usuario, el mensaje es
  específico: "no existe una cuenta con ese usuario".
- **RF-12** Si la cuenta existe pero la contraseña no coincide, el mensaje es
  específico: "contraseña incorrecta".
- **RF-13** Si algún campo está vacío o no cumple los mínimos (RF-3, RF-4), se
  muestra un error de validación y no se intenta autenticar.

### Sesión

- **RF-14** La sesión persiste entre visitas y entre cierres del navegador; no
  caduca sola por el simple paso del tiempo entre usos normales.
- **RF-15** Existe una acción de "cerrar sesión" siempre disponible mientras haya
  sesión. Tras cerrarla, las zonas que requieren cuenta dejan de ser accesibles y
  hay que volver a iniciar sesión.
- **RF-16** No hay opción "recuérdame": el comportamiento persistente es siempre
  el mismo para todas las cuentas.

### Aplicación de las reglas

- **RF-17** Todas las reglas anteriores (obligatoriedad de campos, mínimos de
  longitud, rol válido, unicidad del usuario, verificación de contraseña) se
  aplican de forma autoritativa por la lógica de negocio, con independencia de lo
  que valide el formulario. *(Por qué: la validación de la interfaz no es
  confiable; principio de separación lógica/interfaz.)*

## Casos límite y comportamiento ante errores

- **Doble envío del registro con el mismo usuario:** se crea una sola cuenta; el
  segundo intento recibe "ese nombre de usuario ya está en uso".
- **Registro con rol no válido o ausente:** error de validación; no se crea
  cuenta.
- **Login con campos que no cumplen los mínimos:** error de validación local; no
  se consulta si la cuenta existe.
- **Varias credenciales inválidas seguidas:** se responde con el error que
  corresponda (RF-11 / RF-12) sin bloquear ni demorar. *(Ver Fuera de alcance.)*
- **Persona ya con sesión iniciada que abre la pantalla de registro o de
  login:** `[NECESITA ACLARACIÓN]` — ¿se la redirige a su espacio o se le permite
  registrar/iniciar otra cuenta?
- **Diferencias de mayúsculas o espacios sobrantes en el nombre de usuario entre
  el registro y el login:** `[NECESITA ACLARACIÓN]` — ver dudas abiertas sobre
  normalización.

## Fuera de alcance

- Recuperación, reseteo o cambio de contraseña.
- Cambio de nombre de usuario y cambio de rol.
- Verificación de identidad, confirmación por email/SMS o activación por un
  administrador.
- Protección contra fuerza bruta: límite de intentos, bloqueo temporal, captcha,
  retardos progresivos, segundo factor.
- Inicio de sesión con proveedores externos (Google, Apple, etc.).
- Gestión de perfil: datos personales, foto, preferencias.
- Roles distintos de entrenador y alumno (por ejemplo, administrador).
- Baja, borrado o desactivación de cuentas.
- Invitaciones o vínculo entrenador–alumno (se tratará en otra spec).
- Sesiones múltiples y su gestión (ver dispositivos activos, cerrar sesión
  remota).

## Dudas abiertas

- `[NECESITA ACLARACIÓN]` Longitud máxima del nombre de usuario y de la
  contraseña.
- `[NECESITA ACLARACIÓN]` Caracteres permitidos en el nombre de usuario
  (¿espacios internos, acentos, símbolos, emojis?) y si se recortan los espacios
  al principio y al final.
- `[NECESITA ACLARACIÓN]` ¿La unicidad y el login distinguen mayúsculas de
  minúsculas, o "Ana" y "ana" son la misma cuenta?
- `[NECESITA ACLARACIÓN]` ¿La contraseña admite espacios al inicio o final y se
  conservan tal cual? ¿Hay algún requisito de complejidad además del mínimo de 8?
- `[NECESITA ACLARACIÓN]` ¿La sesión persistente tiene un tope máximo absoluto
  (p. ej. caduca a los 30 días aunque se use) o dura indefinidamente hasta el
  logout?
- `[NECESITA ACLARACIÓN]` Idioma de los mensajes de error y de la interfaz: el
  repositorio tiene soporte multi-idioma (es/en); ¿esta funcionalidad debe estar
  traducida desde el inicio?
- `[NECESITA ACLARACIÓN]` ¿Se puede estar registrado como entrenador y alumno a
  la vez con dos usuarios distintos, o el sistema debe impedir de algún modo esa
  duplicación?

## Criterios de aceptación

- Dado un usuario nuevo "ana" y contraseña de 8+ caracteres eligiendo "alumno",
  cuando se envía el registro, entonces la cuenta se crea con rol alumno y "ana"
  queda con la sesión iniciada en el espacio de alumno.
- Dado que "ana" ya existe, cuando alguien intenta registrarse como "ana",
  entonces el registro falla con "ese nombre de usuario ya está en uso" y no se
  crea una segunda cuenta.
- Dado un nombre de usuario de 1 carácter o una contraseña de 7, cuando se envía
  el registro, entonces se muestra un error de validación y no se crea cuenta.
- Dado que se envía el registro sin elegir rol, entonces se muestra un error de
  validación y no se crea cuenta.
- Dado un login con un usuario inexistente, entonces el mensaje es "no existe una
  cuenta con ese usuario".
- Dado un login con usuario existente y contraseña equivocada, entonces el
  mensaje es "contraseña incorrecta".
- Dado un login correcto, cuando después se cierra y reabre el navegador,
  entonces la sesión sigue activa hasta pulsar "cerrar sesión".
- Dado que se pulsa "cerrar sesión", entonces las zonas con cuenta dejan de ser
  accesibles y se pide iniciar sesión otra vez.
