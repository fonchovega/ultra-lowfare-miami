===========================================================
ULTRA-LOWFARE · Proyecto FareBot + FrontWeb Dashboard
Versión: v1.3.3  ·  Última actualización: 2025-11-09
===========================================================

== DESCRIPCIÓN GENERAL ==
Ultra-LowFare es un sistema automatizado para rastrear, normalizar y visualizar tarifas aéreas ultra-bajas
en rutas definidas (por ejemplo: LIM ⇄ MIA/FLL/MCO).  Integra:
- Bot de scraping programado (FareBot)
- Motor de auditoría y normalización (v1.3.3)
- FrontWeb Dashboard para visualización en GitHub Pages
- Sincronización automática entre Codespaces y GitHub Admin
- Mecanismo de espejo de data/ → docs/data/ para publicación en web


== ESTRUCTURA DEL PROYECTO ==
/scripts/
  ├─ farebot_v132.js                → motor principal de búsqueda y scraping
  ├─ helpers/
  │    ├─ helper.js                 → funciones comunes y logger
  │    ├─ schema_v133.js            → definición de estructuras normalizadas
  │    ├─ auditor_v133.js           → auditoría de estructuras en histórico
  │    ├─ healthcheck_v133.js       → chequeo de consistencia interna
  │    └─ fix_unknowns_v133.js      → normalizador automático de registros “unknown”
  ├─ writer_historico_v133_full.js  → escritura y migración de histórico
  ├─ audit_historico_shapes_v133.js → análisis de estructuras detectadas
  ├─ git_setup.sh                   → configuración de git local
  ├─ git_sync.sh                    → sincronización bidireccional GitHub ↔ Codespace
  └─ git_sync_docs.sh               → espeja data/ hacia docs/data/ (para Pages)

 /data/
  ├─ data.json                      → último resultado ejecutado por FareBot
  ├─ historico.json                 → base consolidada
  ├─ historico_unknown_samples.json → muestras no reconocidas
  └─ historico_normalizado.json     → versión consolidada limpia (generada por v133)

 /docs/
  ├─ index.html                     → FrontWeb Dashboard
  ├─ app_frontweb_v133.js           → renderizador de dashboard
  ├─ styles.css                     → estilo visual
  └─ data/                          → espejo automático de /data/

 /.github/workflows/
  ├─ farebot.yml                    → ejecuta FareBot cada 3 horas
  └─ sync_pages.yml                 → publica JSON en docs/data/ al hacer push


== SINCRONIZACIÓN GITHUB ↔ CODESPACE ==
1. Configurar entorno la primera vez:
   chmod +x scripts/git_setup.sh scripts/git_sync.sh scripts/git_sync_docs.sh
   ./scripts/git_setup.sh

2. Para traer cambios del administrador:
   ./scripts/git_sync.sh pull
   (o ./scripts/git_sync.sh force-pull para descartar cambios locales)

3. Para subir cambios desde Codespace:
   ./scripts/git_sync.sh push "mensaje de commit"

4. Para reflejar los JSON en GitHub Pages:
   ./scripts/git_sync_docs.sh

5. Workflow automático:
   .github/workflows/sync_pages.yml ejecuta el espejo automáticamente
   cada vez que haya cambios en /data/**.


== FRONTWEB DASHBOARD ==
Ubicado en /docs/
- Muestra rutas monitoreadas, precios detectados y cumplimiento de topes.
- Incluye histórico resumido (cantidad de registros, “cumple”, “cerca”).
- Se actualiza cada vez que FareBot hace commit a /data/.

Acceso web:  
https://<tu_usuario>.github.io/ultra-lowfare-miami/


== PROCESOS AUTOMÁTICOS ==
- FareBot (farebot_v132.js) corre cada 3 horas por GitHub Actions.
- Guarda resultados en /data/.
- Auditoría (auditor_v133.js + healthcheck_v133.js) puede ejecutarse manualmente:
     npm run verify:v133
- Normalizador automático (fix_unknowns_v133.js) limpia y reestructura:
     npm run fix:unknowns


== TO-DO LIST (PENDIENTES A DESARROLLAR) ==
1. **Integrar normalizador automático al pipeline del workflow.**
   → Que “fix_unknowns_v133.js” se ejecute al detectar registros “unknown”.

2. **Agregar payload con detalle expandido al farebot_v133.**
   → Incluir aerolínea, link de compra, clase tarifaria, política de equipaje y moneda.

3. **Refactorizar base histórica (v1.4.0):**
   - Unificar “historico.json” y “historico_normalizado.json” en una única estructura robusta.
   - Mantener compatibilidad retroactiva con V1-4 a V8.

4. **Usuarios y proyectos multi-instancia.**
   - Añadir soporte de multiusuario (correo, teléfonos, Telegram).
   - Asociar proyectos personalizados (ejemplo: “Lima-Miami MCO”).

5. **Integrar notificaciones Telegram automáticas.**
   - Enviar alertas al crear/actualizar usuario o detectar cambio de precio.

6. **Incorporar API REST (fase futura, no inmediata).**
   - Endpoint /api/latest → último vuelo más económico
   - Endpoint /api/history → tendencias por ruta o rango de fechas

7. **Optimizar frontweb:**
   - Integrar gráfico de tendencia por ruta (canvas.js o recharts).
   - Unificar fecha/hora en una sola columna.
   - Filtrar por día, hora o ruta directamente desde interfaz.

8. **Automatizar limpieza periódica:**
   - Script de mantenimiento que archive históricos antiguos >60 días.

9. **Control de versiones automáticas (vNext).**
   - Asignación incremental “vX.Y.Z” en commits automáticos.
   - Registro en data/meta.json para trazabilidad.

10. **Estabilizar sincronización bidireccional.**
    - Asegurar que GitHub Admin y Codespaces queden siempre alineados tras commits automáticos.


== COMANDOS ÚTILES ==
npm run verify:v133      → Ejecuta auditoría y healthcheck.
npm run fix:unknowns     → Limpia estructuras desconocidas.
npm run farebot:mock     → Ejecuta búsqueda en modo mock local.
npm run farebot          → Ejecuta búsqueda real (usando Playwright).
npx playwright install --with-deps  → instala navegadores.

Para iniciar servidor local del dashboard:
   npx http-server docs -p 8080 -c-1


== CRON LOG (WORKFLOW SCHEDULE) ==
- farebot.yml ejecuta cada 3 horas → “0 */3 * * *”
- sync_pages.yml se activa automáticamente tras cualquier push en /data/


== AUTORES Y MANTENEDORES ==
Proyecto dirigido por:  
   Víctor Alfonso Vega Huertas (fonchovega)
Asistente técnico de integración:  
   GPT-5 (OpenAI)  
Infraestructura: GitHub Actions + Codespaces + GitHub Pages

===========================================================
FIN DEL DOCUMENTO · v1.3.3 · Actualizado 2025-11-09
===========================================================
