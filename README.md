# Training App 🏋️‍♂️

Aplicación de gestión de entrenamientos para entrenadores y alumnos, construida con **Next.js** (frontend y API en un mismo proyecto) y **MongoDB**.

## 🧭 Metodología: SDD + TDD

El proyecto se desarrolla con **Spec-Driven Development (SDD)** y **Test-Driven Development (TDD)**:

- **SDD:** ningún cambio de comportamiento se implementa sin una spec activa en `entrenamiento/specs/`. Cada feature tiene su carpeta con:
  - `spec.md`: qué se construye (requisitos funcionales RF-n).
  - `plan.md`: cómo se construye.
  - `tasks.md`: tareas de implementación.
  - `verification.md`: trazabilidad de requisitos a tests y puntos abiertos.

  Si el código y la spec discrepan, gana la spec.
- **TDD:** cada tarea arranca con un test que falla y después se escribe el código que lo hace pasar. Toda lógica nueva lleva test unitario, todo endpoint o flujo lleva test de integración, y `npm run test` tiene que pasar al 100 % antes de fusionar.

Las reglas no negociables del proyecto están en [`entrenamiento/docs/constitution.md`](./entrenamiento/docs/constitution.md).

## 📂 Estructura del Proyecto

```
.
├── .agents/skills/          # Skills para agentes de IA (p. ej. frontend-design)
├── skills-lock.json
└── entrenamiento/           # App Next.js (UI + API)
    ├── docs/
    │   └── constitution.md  # Principios del proyecto
    ├── specs/               # Specs SDD, una carpeta por feature
    │   ├── 001-registro-login/
    │   └── 002-rutina-ejercicio/
    ├── src/
    │   ├── app/             # App Router: páginas y rutas /api
    │   ├── components/      # Componentes UI (solo renderizan y delegan)
    │   ├── domain/          # Lógica de negocio pura (sin React, red ni MongoDB)
    │   ├── infra/           # Adaptadores: repositorios Mongo, migraciones, crypto, container
    │   ├── lib/             # Utilidades compartidas (HTTP, mensajes)
    │   └── middleware.ts    # Chequeo de sesión
    └── test/
        ├── unit/            # Tests de arquitectura y scaffold
        └── integration/     # Tests contra MongoDB real
```

Los tests unitarios de dominio viven junto al código (`*.spec.ts`).

## 🗺️ Features

| Spec | Estado |
| :--- | :--- |
| [001 — Registro y login](./entrenamiento/specs/001-registro-login/) | ✅ Implementada |
| [002 — Rutina y ejercicio](./entrenamiento/specs/002-rutina-ejercicio/) | 🚧 En progreso |

## 🚀 Inicio Rápido

Requisitos: Node.js y una instancia de MongoDB.

```bash
cd entrenamiento
npm install
```

Creá `entrenamiento/.env.local` con:

```env
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=entrenamiento
SESSION_SECRET=<un-secreto-largo-y-aleatorio>
```

```bash
npm run dev    # http://localhost:3000
```

### Tests

```bash
npm run test               # todos
npm run test:unit          # unitarios
npm run test:integration   # integración (requiere MONGODB_URI)
```

## 🛠️ Tecnologías

| Componente | Tecnologías |
| :--- | :--- |
| **App** | Next.js 16 (App Router), React 19, TypeScript |
| **UI** | shadcn/ui, Tailwind CSS v4 |
| **Persistencia** | MongoDB (driver oficial, con migraciones versionadas y `$jsonSchema`) |
| **Auth** | Sesiones en MongoDB, hashing scrypt y cookies firmadas con HMAC (`node:crypto`) |
| **Tests** | Vitest |

---
Desarrollado con ❤️ por Gerardo.
