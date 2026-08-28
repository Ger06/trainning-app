# Constitución — Entrenamiento

Principios innegociables. Toda spec, PR y revisión se valida contra ellos.

1. **Stack mínimo.** Solo Next.js, shadcn/ui, Vitest y MongoDB. Sumar una dependencia exige spec aprobada que justifique por qué es imposible sin ella.
2. **Spec antes que código.** Ningún cambio de comportamiento sin spec activa en `specs/`; si código y spec discrepan, gana la spec y el PR se rechaza.
3. **Lógica separada de la interfaz.** Las reglas de negocio viven en módulos puros sin React ni red; los componentes solo renderizan y delegan. Su test unitario no monta componentes.
4. **Dominio agnóstico de la persistencia.** El acceso a MongoDB se aísla en repositorios; ningún componente, hook o handler importa el driver ni arma queries.
5. **Tests obligatorios y verdes.** Toda lógica nueva lleva test unitario; todo endpoint o flujo, test de integración. `npm run test` pasa al 100 % antes de fusionar.
6. **Datos con forma explícita.** Todo documento persistido tiene esquema validado en escritura y migración versionada; no se cambia el formato de un JSON sin actualizar antes su spec.
