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
  ├─ farebot.yml# Dashboard Ultra-Low Fare · Víctor Vega (ES)
Repositorio: ultra-lowfare-miami

Publicar en Vercel (método GitHub)
1) Crea este repo y sube: index.html, style.css, data.json, README.txt (raíz).
2) Entra a https://vercel.com → Add New Project → Import Git Repository → selecciona el repo.
3) Framework Preset: Other · Root Directory: / · (sin build).
4) Deploy. Obtendrás: https://ultra-lowfare-miami.vercel.app

Actualizaciones: reemplaza solo data.json en GitHub y Vercel redeploya.
El panel fuerza refresco del JSON con ?cache= para evitar caché.
