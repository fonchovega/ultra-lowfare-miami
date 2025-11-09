============================================================
ULTRA-LOWFARE PROJECT  —  versión v1.3.3 (actualizado)
============================================================

📍 Descripción general:
Sistema modular para monitorear, auditar y limpiar tarifas
aéreas en rutas definidas (LIM ⇄ MIA/FLL/MCO). 
Incluye auditoría automática, normalización de bases de datos,
verificación de integridad, y detección de anomalías.

El objetivo actual es consolidar la base histórica
(data/historico.json) y preparar la arquitectura
para el front web (fase siguiente).

------------------------------------------------------------
📁 ESTRUCTURA DE CARPETAS (base actual)
------------------------------------------------------------
/scripts
  ├── farebot_v132.js               → motor principal de scraping
  ├── audit_historico_shapes_v133.js → auditor general de estructuras
  ├── historico.js                   → generador inicial de históricos
  ├── writer_historico_v133_full.js  → nuevo escritor completo
  └── helpers/
       ├── helper.js
       ├── schema_v133.js
       ├── schema_detalle_v133.js
       ├── auditor_v133.js
       ├── healthcheck_v133.js
       └── fix_unknowns_v133.js

/data
  ├── historico.json
  ├── historico_fixed.json (nuevo)
  ├── historico_unknown_samples.json
  └── logs/ (pendiente de integración)

/public
  (carpeta de despliegue frontend, aún sin assets)

/.github/workflows
  └── farebot.yml   → automatización de ejecuciones (cada 3 horas)

/package.json
  - Incluye comandos “verify:v133” y “fix:unknowns”
  - Motor Node 20+
  - Dependencias principales: node-fetch, glob, playwright

------------------------------------------------------------
⚙️  COMANDOS DISPONIBLES
------------------------------------------------------------

1️⃣ Verificar integridad de la base de datos:
    npm run verify:v133
   → Ejecuta:
      - auditor_v133.js
      - healthcheck_v133.js
      - audit_historico_shapes_v133.js

2️⃣ Corregir estructuras desconocidas automáticamente:
    npm run fix:unknowns
   → Ejecuta fix_unknowns_v133.js y crea data/historico_fixed.json

3️⃣ Ejecución manual del bot de tarifas:
    npm run farebot

4️⃣ Ejecución mock (modo simulación sin web scraping):
    npm run farebot:mock

------------------------------------------------------------
🧭 ESTADO ACTUAL
------------------------------------------------------------
✅ Auditorías funcionando correctamente.
✅ Healthcheck detecta estructuras inconsistentes.
✅ Fix_unknowns genera versión corregida.
✅ Farebot.yml ejecuta tareas programadas cada 3 horas.
✅ Sincronización Codespace ↔ GitHub estable.
⚠️ Frontend aún no implementado (fase siguiente).

------------------------------------------------------------
🧩 TO-DO (pendientes próximos)
------------------------------------------------------------

🔹 FASE 1: Limpieza y consolidación de base
  1. Integrar automatización del script fix_unknowns_v133.js
     dentro del flujo verify:v133 (ejecución autónoma).
  2. Asegurar que data/historico_fixed.json se reemplace
     automáticamente en data/historico.json cuando sea válido.
  3. Validar consistencia de índices y meta en todos los registros.

🔹 FASE 2: Estructura de diseño mínima para front
  4. Confirmar visibilidad de carpeta /public en GitHub Pages.
  5. Incorporar viewer de data/historico_normalized.json.
  6. Preparar endpoints básicos de lectura para API futura.

🔹 FASE 3: Integración con WebApp
  7. Crear dashboard inicial (tendencias de precios, alertas).
  8. Conectar con Playwright/Telegram para notificaciones.
  9. Implementar login multiusuario (en etapa beta).

🔹 FASE 4: Optimización y escalado
  10. Migrar automatizaciones a módulos reutilizables.
  11. Añadir versionado de base histórico (v1.4+).
  12. Implementar backups incrementales automáticos.

------------------------------------------------------------
🧠 MODO DE OPERACIÓN RECOMENDADO
------------------------------------------------------------
1. Ejecutar `npm run verify:v133` al menos una vez al día.
2. Si aparecen UNKNOWN, ejecutar `npm run fix:unknowns`.
3. Validar cambios con `git diff` antes de hacer push.
4. Confirmar en GitHub Actions (farebot.yml) que la ejecución
   automática se complete sin errores.
5. Mantener sincronización Codespace ↔ GitHub con `git pull`
   antes de cualquier edición manual.

------------------------------------------------------------
📌 NOTAS DE DESARROLLO
------------------------------------------------------------
- Evitar caracteres especiales (ej. backticks) en los logs.
- Las rutas de helper.js están unificadas con base relativa.
- Versionado progresivo: v1.3.4 = inicio de capa visual web.
- Todos los archivos deben mantenerse en formato UTF-8 sin BOM.
- Recomendación: mantener backups locales de data/historico.json
  antes de aplicar fix_unknowns o scripts experimentales.

------------------------------------------------------------
Fin del archivo README.txt
============================================================
