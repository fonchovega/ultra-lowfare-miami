============================================================
ULTRA-LOWFARE PROJECT  —  versión v1.3.3 (actualizado)
============================================================

📍 DESCRIPCIÓN GENERAL:
Sistema modular para monitorear, auditar y limpiar tarifas aéreas
en rutas definidas (LIM ⇄ MIA/FLL/MCO). 
Incluye auditoría automática, normalización de bases de datos,
verificación de integridad, y detección de anomalías.

El objetivo actual es consolidar la base histórica
(`data/historico.json`) y preparar la arquitectura
para el front web (fase siguiente).

============================================================
📁 ESTRUCTURA DE CARPETAS (BASE ACTUAL)
============================================================

/scripts
  ├── farebot_v132.js                → Motor principal de scraping
  ├── audit_historico_shapes_v133.js → Auditor general de estructuras
  ├── historico.js                   → Generador inicial de históricos
  ├── writer_historico_v133_full.js  → Escritor completo con validaciones
  └── helpers/
       ├── helper.js
       ├── schema_v133.js
       ├── schema_detalle_v133.js
       ├── auditor_v133.js
       ├── healthcheck_v133.js
       ├── fix_unknowns_v133.js
       └── audit_historico_shapes_v133.js

/data
  ├── historico.json
  ├── historico_normalizado.json
  ├── historico_fixed.json (nuevo)
  ├── historico_unknown_samples.json
  └── logs/ (pendiente de integración)

/public
  ├── index.html        → Interfaz base (FrontDesk)
  ├── style.css         → Estilos base
  ├── app.js            → Lógica del dashboard
  └── assets/           → Íconos, logos y recursos estáticos

/.github/workflows
  ├── farebot.yml       → Automatización principal (cada 3 horas)
  └── pages.yml         → Despliegue GitHub Pages

/site
  ├── public/
  └── data/

/package.json
  - Comandos “verify:v133” y “fix:unknowns”
  - Motor Node.js 20+
  - Dependencias principales: node-fetch, glob, playwright

/vercel.json
  → Configura despliegue en Vercel (carpeta /site)

/README.txt (este archivo)

============================================================
⚙️  COMANDOS DISPONIBLES
============================================================

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

============================================================
🧭 ESTADO ACTUAL
============================================================

✅ Auditorías funcionando correctamente  
✅ Healthcheck detecta estructuras inconsistentes  
✅ Fix_unknowns genera versión corregida  
✅ Farebot.yml ejecuta tareas programadas cada 3 horas  
✅ Sincronización Codespace ↔ GitHub estable  
✅ Deploy automático funcional (GitHub Pages y Vercel)  
⚠️ Frontend en fase de implementación  

============================================================
⚙️  FUNCIONAMIENTO AUTOMÁTICO
============================================================

🕓 CRON (cada 3 horas)
- Ejecuta FareBot en modo live (no mock)
- Limpia y normaliza la base de datos
- Publica automáticamente en `/site`

🧠 Auditorías automáticas:
- `auditor_v133.js` → Valida estructuras y versiones
- `healthcheck_v133.js` → Verifica meta y resumen
- `audit_historico_shapes_v133.js` → Detecta anomalías

🔁 Auto-fix:
- Si se encuentran UNKNOWN → corre `fix_unknowns_v133.js`
- Genera `historico_fixed.json` y reemplaza el original

📤 Deploy dual:
- `pages.yml` publica `/site` en GitHub Pages
- `vercel.json` replica el mismo bundle en Vercel

============================================================
🧩 TO-DO / PENDIENTES DE DESARROLLO
============================================================

🔹 **FASE 1: Limpieza y consolidación de base**
  1. Integrar automatización de fix_unknowns_v133.js dentro del flujo verify:v133.
  2. Reemplazar automáticamente historico_fixed.json → historico.json tras validación.
  3. Validar consistencia de índices, meta y resumen en todas las entradas.

🔹 **FASE 2: Estructura mínima para FrontDesk**
  4. Confirmar visibilidad completa de carpeta /public en GitHub Pages.
  5. Incorporar viewer de data/historico_normalizado.json.
  6. Preparar endpoints básicos de lectura (API futura).

🔹 **FASE 3: Integración con WebApp**
  7. Crear dashboard inicial con tendencias, alertas y variaciones.
  8. Conectar Playwright/Telegram para notificaciones.
  9. Implementar autenticación multiusuario (etapa beta).

🔹 **FASE 4: Optimización y escalado**
  10. Migrar automatizaciones a módulos reutilizables.
  11. Añadir versionado histórico (v1.4+).
  12. Implementar backups incrementales automáticos.
  13. Crear carpeta /data/archive/ para versiones antiguas.

🔹 **FASE 5: Monitoreo y panel administrativo**
  14. Crear admin.html con botones para auditoría manual.
  15. Añadir log visual del estado de workflows.
  16. Integrar notificaciones de estado (Slack/Telegram).

============================================================
🧠 MODO DE OPERACIÓN RECOMENDADO
============================================================

1. Ejecutar `npm run verify:v133` al menos una vez al día.  
2. Si aparecen UNKNOWN, ejecutar `npm run fix:unknowns`.  
3. Validar cambios con `git diff` antes de hacer push.  
4. Confirmar en GitHub Actions (farebot.yml) que el cron se ejecutó sin errores.  
5. Mantener sincronía Codespace ↔ GitHub con `git pull` antes de editar.  
6. Evitar ejecución manual del bot salvo emergencias.  

============================================================
📌 NOTAS DE DESARROLLO
============================================================

- Evitar caracteres especiales (backticks, tildes irregulares) en logs.
- Las rutas de `helper.js` son relativas y estandarizadas.
- Mantener todo en formato UTF-8 sin BOM.
- Versionado progresivo: v1.3.4 = inicio de capa visual web.
- Respaldo local recomendado: `data/historico.json` antes de usar fix_unknowns.
- No modificar estructura ni nombres de workflows (.yml).

============================================================
📅 ÚLTIMA REVISIÓN TÉCNICA
============================================================
Fecha: 12-Nov-2025  
Versión estable: v1.3.3  
Desarrollador principal: Victor Alfonso Vega Huertas  
============================================================
