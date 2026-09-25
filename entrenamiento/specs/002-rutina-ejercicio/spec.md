# Spec 002 — Ejercicios y rutinas (creación y asignación por el entrenador)

## Contexto y objetivo

La spec 001 dejó a cada persona con una cuenta y un rol. Con eso resuelto, el
entrenador todavía no tiene forma de producir nada: falta el contenido de
entrenamiento.

Esta spec define, **solo desde el lado del entrenador**, tres capacidades
encadenadas:

1. **Catálogo de ejercicios.** Crear y mantener una biblioteca propia de
   ejercicios reutilizables (nombre y descripción, sin cargas ni repeticiones).
2. **Rutinas (sesiones).** Componer una sesión de entrenamiento como una
   secuencia de bloques; cada bloque agrupa ejercicios del catálogo, se repite un
   número de rondas y fija, por ejercicio, series, repeticiones y/o tiempo de
   ejecución y descansos.
3. **Asignación en un mesociclo.** Asignar una rutina a uno o varios alumnos y a
   uno o varios pares (semana, día de la semana). El plan de varias semanas de un
   alumno es el conjunto de rutinas que tiene asignadas en esos slots. El
   entrenador puede asignar a un alumno existente o darlo de alta en ese
   momento; en ambos casos queda un vínculo entrenador–alumno.

**Objetivo:** que un entrenador pueda pasar de cero a un plan semanal asignado
—biblioteca de ejercicios, rutinas construidas a partir de ella y colocadas en un
calendario de semanas/días para alumnos concretos— con reglas de validación
claras y con cada asignación aislada de ediciones futuras.

### Por qué

- **Separar ejercicio de prescripción** evita duplicar "Sentadilla" una vez por
  cada combinación de series y repeticiones: el mismo ejercicio sirve en muchas
  rutinas con distinta carga, y el catálogo se mantiene pequeño y estable.
- **Dos niveles (rondas de bloque + series por ejercicio)** son necesarios para
  representar tanto trabajo por series clásico como circuitos: un bloque de
  varios ejercicios que se repite N veces.
- **Semana + día de la semana** encaja con cómo se programan mesociclos (varias
  semanas con la misma estructura semanal y progresión) sin obligar al entrenador
  a fijar fechas de calendario que luego hay que recalcular.
- **Copia congelada al asignar** protege al alumno: un retoque del entrenador en
  una plantilla no altera en silencio lo que otro alumno ya está siguiendo; los
  cambios se aplican de forma deliberada al reasignar.
- **Alta de alumno + vínculo en el acto** reduce la fricción en la etapa actual
  (un entrenador y sus alumnos, público conocido) sin esperar a la spec de
  invitaciones/vínculo formal, que refinará este mecanismo.

## Requisitos funcionales (el QUÉ)

### Autorización

- **RF-1** Crear, editar y borrar ejercicios y rutinas, y asignar rutinas, son
  acciones exclusivas de cuentas con rol `entrenador`. Una cuenta `alumno` no
  puede ejecutarlas.
- **RF-2** Cada entrenador solo ve y modifica su propio catálogo de ejercicios y
  sus propias rutinas y asignaciones; no accede a los de otro entrenador.
- **RF-3** Todas las reglas de esta spec (obligatoriedad, mínimos, rangos,
  pertenencia, unicidad) se aplican de forma autoritativa por la lógica de
  negocio, con independencia de lo que valide el formulario. *(Constitución:
  separación lógica/interfaz.)*

### Catálogo de ejercicios

- **RF-4** Un ejercicio tiene un **nombre** obligatorio (mínimo 2 caracteres) y
  una **descripción** opcional (texto libre).
- **RF-5** El ejercicio **no** contiene series, repeticiones, tiempo, descanso,
  rondas ni carga: esos datos son de la rutina.
- **RF-6** El nombre del ejercicio es único dentro del catálogo del entrenador
  que lo crea. Un nombre repetido es error de validación y no crea el ejercicio.
- **RF-7** El entrenador puede editar el nombre y la descripción de un ejercicio
  de su catálogo.
- **RF-8** El entrenador puede eliminar un ejercicio **solo si ninguna rutina lo
  usa**. Si alguna rutina lo referencia, la eliminación se rechaza con un mensaje
  que lo indica. *(Las asignaciones ya emitidas no se ven afectadas por
  ediciones ni borrados: RF-24.)*
- **RF-9** Editar un ejercicio afecta a las rutinas (plantillas) que lo usan y
  aún no se han asignado; **no** afecta a asignaciones existentes.

### Rutinas (sesiones)

- **RF-10** Una rutina tiene un **nombre** obligatorio (mínimo 2 caracteres) y
  una nota/descripción opcional. Es una **sesión** de entrenamiento, no un plan
  de varias semanas.
- **RF-11** Una rutina es una lista **ordenada** de uno o más **bloques**. El
  orden lo fija el entrenador y es editable.
- **RF-12** Cada bloque tiene:
  - una lista **ordenada** de uno o más **ejercicios** tomados del catálogo del
    propio entrenador;
  - un número de **rondas** entero ≥ 1 (un bloque sin repetición es de 1 ronda);
  - un **descanso entre rondas** en segundos ≥ 0;
  - opcionalmente un **descanso entre bloques** (tras terminar el bloque) en
    segundos ≥ 0.
- **RF-13** Cada ejercicio dentro de un bloque lleva:
  - **series** entero ≥ 1;
  - **repeticiones** (entero ≥ 1) **y/o** **tiempo de ejecución** (segundos ≥ 1);
    al menos uno de los dos es obligatorio; se permiten ambos a la vez;
  - **descanso entre series** en segundos ≥ 0;
  - **descanso tras el ejercicio** (la pausa de transición hasta el siguiente
    ejercicio de la misma ronda) en segundos ≥ 0, opcional, por defecto 0. No
    aplica al **último** ejercicio del bloque: al cerrar la ronda rige el
    descanso entre rondas del bloque (RF-12).
  - opcionalmente una **nota** de texto libre (p. ej. tempo, lado, indicación
    técnica).
- **RF-13b** Hay cuatro descansos distintos y sin solapamiento: **entre series**
  y **tras el ejercicio** (ambos por ejercicio, RF-13); **entre rondas** y
  **entre bloques** (ambos por bloque, RF-12).
- **RF-14** Un mismo ejercicio del catálogo puede aparecer en varios bloques de
  la misma rutina y varias veces, cada aparición con su propia prescripción.
- **RF-15** Una rutina no puede guardarse sin al menos un bloque, y ningún bloque
  puede guardarse sin al menos un ejercicio.
- **RF-16** El nombre de la rutina es único dentro de las rutinas del entrenador
  que la crea.
- **RF-17** El entrenador puede editar una rutina (bloques, orden, ejercicios,
  prescripción) y eliminarla. Eliminar o editar una rutina **no** altera las
  asignaciones ya emitidas a partir de ella (RF-24).

### Asignación

- **RF-18** El entrenador asigna **una rutina** a **uno o varios alumnos** y a
  **uno o varios slots**, donde un slot es un par (**semana**, **día de la
  semana**). La operación genera una asignación por cada combinación
  alumno × slot.
- **RF-19** La **semana** es un entero ≥ 1 (semana 1, 2, 3… del mesociclo). El
  **día de la semana** es uno de los siete días (lunes … domingo).
- **RF-20** Solo se puede asignar una rutina que cumpla RF-15 (tiene contenido
  válido).
- **RF-21** Cada destinatario se indica por **nombre de usuario**. Si existe una
  cuenta con ese nombre y rol `alumno`, se usa esa cuenta. Si **no existe ninguna
  cuenta** con ese nombre, no se crea nada de inmediato: se muestra el aviso "no
  existe una cuenta 'x'" y se ofrece **darla de alta** como alumno nuevo con ese
  nombre de usuario. Nunca se crea una cuenta en silencio por un error de tecleo.
- **RF-21b** El alta solo se realiza si el entrenador la **confirma
  explícitamente**. En el alta, el entrenador fija el **nombre de usuario** y una
  **contraseña inicial** que cumplen los mínimos de la spec 001 (usuario ≥ 2
  caracteres, contraseña ≥ 8) y se la comunica al alumno por fuera del sistema.
  La cuenta se crea con rol `alumno`. **No** se obliga al alumno a cambiar esa
  contraseña; esta spec no añade flujo de cambio de contraseña ni de activación.
- **RF-21c** Si el entrenador **cancela** el alta, esa asignación concreta no se
  realiza (ni la cuenta ni el vínculo se crean). El resto del lote —otros
  alumnos y otros slots— continúa normalmente.
- **RF-22** Toda asignación —a alumno existente o recién dado de alta— **registra
  un vínculo entrenador–alumno** si aún no existía. El vínculo hace que ese
  alumno aparezca en la lista de alumnos del entrenador para futuras
  asignaciones.
- **RF-23** Un nombre de usuario que ya pertenece a una cuenta `alumno` nunca
  provoca un alta: se usa la cuenta existente (RF-21). Un nombre de usuario que
  pertenece a una cuenta `entrenador` hace que la asignación a ese destinatario
  se rechace con un mensaje específico, sin crear ni vincular nada.
- **RF-24** Al crear una asignación se toma una **instantánea** (copia congelada)
  de la rutina completa y de los datos de los ejercicios implicados, tal como
  están en ese momento. Ediciones o borrados posteriores del ejercicio o de la
  rutina **no** modifican esa asignación.
- **RF-25** Para trasladar cambios de una plantilla a un alumno que ya la tenía,
  el entrenador **reasigna**: se crea una nueva asignación con la instantánea
  actualizada.
- **RF-26** En un mismo (alumno, semana, día) hay **como máximo una** rutina
  asignada. Asignar otra rutina a un slot ya ocupado **reemplaza** la anterior,
  informando al entrenador de que ese slot se sobrescribe.
- **RF-27** El entrenador puede **quitar** una asignación (dejar el slot vacío).
- **RF-28** Una asignación puede quitarse o reemplazarse en cualquier momento; no
  hay ventana de bloqueo.

### Mensajes de error

- **RF-29** Los avisos y errores son específicos y accionables, en la línea de la
  spec 001: nombre de ejercicio/rutina duplicado, rutina o bloque sin contenido,
  ejercicio sin repeticiones ni tiempo, valores fuera de rango, ejercicio en uso
  al intentar borrarlo, nombre de usuario inexistente (con la oferta de alta),
  nombre de usuario que corresponde a un entrenador, contraseña inicial que no
  cumple el mínimo, y slot que se va a sobrescribir.

## Casos límite y comportamiento ante errores

- **Rutina o bloque vacíos:** guardar se rechaza (RF-15); no se persiste nada.
- **Ejercicio con repeticiones = 0 y sin tiempo:** error de validación; hay que
  indicar repeticiones ≥ 1 o tiempo ≥ 1.
- **Descanso negativo o rondas/series = 0:** error de validación.
- **Borrar un ejercicio usado por una rutina:** se rechaza indicando qué rutinas
  lo usan; el ejercicio no se borra.
- **Editar un ejercicio o una rutina ya asignados:** las asignaciones existentes
  quedan intactas (RF-24); el cambio solo vale para plantillas y futuras
  asignaciones.
- **Asignar a un slot (alumno, semana, día) ya ocupado:** la nueva rutina
  reemplaza a la anterior tras avisar (RF-26).
- **Asignar el mismo lote a varios alumnos y varios slots:** se generan todas las
  combinaciones; si alguna combinación concreta ya estaba ocupada, esa se
  sobrescribe y el resto se crea normalmente.
- **Usuario de alumno mal tecleado (no existe ninguna cuenta):** no se crea nada
  en silencio; se avisa "no existe una cuenta 'x'" y se pide confirmación para
  darlo de alta (RF-21). Si el entrenador cancela, esa asignación no se hace y el
  resto del lote continúa (RF-21c).
- **Alta confirmada con un usuario que ya es de un alumno:** no se duplica la
  cuenta; se usa la existente y se registra el vínculo (RF-23).
- **Nombre de usuario que es de un entrenador:** se rechaza la asignación a ese
  destinatario; nada se crea ni se vincula (RF-23).
- **Alta con usuario o contraseña inicial que no cumplen los mínimos de la spec
  001:** error de validación de esos mismos mínimos; no se crea la cuenta.
- **Asignar una rutina que quedó sin contenido tras una edición:** se rechaza
  (RF-20).
- **Dos ejercicios distintos del catálogo con el mismo nombre salvo
  mayúsculas/espacios:** `[NECESITA ACLARACIÓN]` — ver dudas abiertas sobre
  normalización de nombres.
- **Quitar una asignación y volver a asignar la misma rutina al mismo slot:**
  se crea una asignación nueva con instantánea nueva; no se "restaura" la
  anterior.

## Fuera de alcance

- Todo lo que ve o hace el **alumno**: consultar su plan, ver "la rutina de hoy",
  marcar series como hechas, registrar cargas, pesos levantados o progreso.
- Registro de **resultados/histórico de entrenamiento** y estadísticas.
- **Vínculo entrenador–alumno formal**: invitaciones, aceptación por el alumno,
  desvinculación, transferencia de alumnos entre entrenadores. Esta spec solo
  registra el vínculo mínimo necesario para listar alumnos y asignar.
- **Credenciales del alta hecha por el entrenador**: la contraseña inicial la
  fija el entrenador (RF-21b) y se comunica al alumno por fuera del sistema. El
  canal de esa comunicación, un cambio obligatorio al primer ingreso, enlaces o
  códigos de activación y el reseteo de contraseña quedan fuera de alcance (como
  en la spec 001).
- **Plantillas de mesociclo / planes reutilizables** como entidad propia
  (crear "Plan fuerza 8 semanas" y aplicarlo entero): aquí el plan es solo el
  resultado de asignaciones sueltas.
- **Progresión automática** entre semanas (subir carga o volumen semana a
  semana).
- **Biblioteca de ejercicios compartida** entre entrenadores o catálogo global
  precargado.
- **Multimedia** en ejercicios: vídeos, imágenes, animaciones.
- **Carga / peso (kg, %1RM), RIR, RPE, tempo estructurado** como campos
  tipados de la prescripción (ver dudas abiertas; por ahora solo cabe en la nota
  de texto libre).
- **Superseries entre bloques**, EMOM/AMRAP y otros formatos con semántica de
  tiempo especial más allá de rondas + tiempo de ejecución.
- **Duplicar / clonar** rutinas o ejercicios como atajo (se puede crear a mano).
- **Calendario con fechas reales**, festivos, semanas de descarga marcadas.
- Notificaciones o avisos al alumno cuando se le asigna o cambia una rutina.

## Dudas abiertas

- `[NECESITA ACLARACIÓN]` Normalización del nombre de ejercicio y de rutina:
  ¿la unicidad distingue mayúsculas/minúsculas y espacios sobrantes? ¿se recortan
  los extremos?
- `[NECESITA ACLARACIÓN]` Longitud máxima de nombre y descripción de ejercicio,
  nombre y nota de rutina, y nota por ejercicio.
- `[NECESITA ACLARACIÓN]` Topes numéricos: máximo de bloques por rutina,
  ejercicios por bloque, series, rondas, repeticiones, y valor máximo de los
  descansos y del tiempo de ejecución.
- `[NECESITA ACLARACIÓN]` Número de semanas del mesociclo: ¿hay un tope? ¿el
  entrenador declara "este plan dura N semanas" o asigna a cualquier número de
  semana sin límite declarado?
- `[NECESITA ACLARACIÓN]` ¿Se puede asignar a un alumno que ya tiene otro
  entrenador (varios entrenadores por alumno), o el vínculo es exclusivo?
- `[NECESITA ACLARACIÓN]` ¿Debe conservarse historial de asignaciones
  reemplazadas o quitadas (auditoría / "qué tenía antes"), o basta el estado
  actual?
- `[NECESITA ACLARACIÓN]` Carga/intensidad: ¿se añade en una spec próxima como
  campo tipado de la prescripción (kg, %1RM, RIR/RPE) o se deja
  permanentemente en la nota libre?
- `[NECESITA ACLARACIÓN]` Idioma de los textos y mensajes: el repositorio tiene
  soporte es/en; ¿esta funcionalidad debe estar traducida desde el inicio?
  (misma duda que la spec 001).

## Criterios de aceptación

- Dado un entrenador autenticado, cuando crea un ejercicio "Sentadilla" con
  descripción, entonces queda en su catálogo y puede reutilizarse en rutinas.
- Dado que "Sentadilla" ya existe en su catálogo, cuando intenta crear otro
  ejercicio con ese nombre, entonces se muestra error de duplicado y no se crea.
- Dado un ejercicio usado por al menos una rutina, cuando el entrenador intenta
  borrarlo, entonces la operación se rechaza indicando que está en uso.
- Dado un intento de guardar una rutina sin bloques, o un bloque sin ejercicios,
  entonces se muestra error y no se persiste.
- Dado un ejercicio de rutina sin repeticiones y sin tiempo de ejecución,
  entonces se muestra error de validación.
- Dado un bloque con 3 rondas y descanso entre rondas de 60 s, y dentro un
  ejercicio con 4 series de 10 repeticiones y 90 s de descanso entre series,
  cuando se guarda la rutina, entonces se conserva esa estructura de dos niveles.
- Dado un bloque con dos ejercicios, cuando el primero fija "descanso tras el
  ejercicio" de 30 s, entonces esa pausa se aplica antes del segundo ejercicio y
  no se confunde con el descanso entre series ni con el descanso entre rondas; el
  "descanso tras el ejercicio" del segundo (último) ejercicio se ignora.
- Dada una rutina válida, cuando el entrenador la asigna a los alumnos "ana" y
  "luis" en (semana 1, lunes) y (semana 1, jueves), entonces se crean cuatro
  asignaciones (2 alumnos × 2 slots).
- Dado que "ana" no tenía vínculo con el entrenador, cuando se le asigna una
  rutina, entonces queda vinculada y aparece en su lista de alumnos.
- Dado que el entrenador teclea "ana2" y no existe ninguna cuenta con ese
  nombre, cuando envía la asignación, entonces se le avisa de que no existe y se
  le ofrece darla de alta; si cancela, no se crea cuenta ni asignación y el
  resto del lote continúa.
- Dado que el entrenador confirma el alta de "ana2" con una contraseña inicial
  de 8+ caracteres, entonces se crea la cuenta con rol alumno, se registra el
  vínculo y se realiza la asignación, sin exigir al alumno cambiar la contraseña
  después.
- Dado que el nombre de usuario tecleado corresponde a una cuenta de entrenador,
  entonces la asignación a ese destinatario se rechaza y no se crea ni vincula
  nada.
- Dada una rutina ya asignada a "ana", cuando el entrenador edita la rutina o uno
  de sus ejercicios, entonces la asignación de "ana" no cambia.
- Dado que el entrenador quiere aplicar esos cambios a "ana", cuando reasigna la
  rutina, entonces "ana" recibe una asignación nueva con la instantánea
  actualizada.
- Dado un slot (ana, semana 2, miércoles) ya ocupado, cuando el entrenador asigna
  otra rutina a ese slot, entonces se le avisa de la sobrescritura y, al
  confirmar, la rutina anterior en ese slot queda reemplazada.
- Dado un alumno intentando crear un ejercicio o una rutina, entonces la acción
  se rechaza por falta de permiso.
