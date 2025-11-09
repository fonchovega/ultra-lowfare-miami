#!/bin/bash
# ============================================================
# 🔄 git_auto_sync.sh — Sincronización total Ultra-LowFare
# Versión 1.3.3 — Última actualización: 2025-11-09
# ============================================================

set -e  # Detiene el script si ocurre un error

echo "🚀 Iniciando sincronización total Ultra-LowFare..."

# 1️⃣ Verificar permisos
chmod +x scripts/git_setup.sh scripts/git_sync.sh scripts/git_sync_docs.sh || true

# 2️⃣ Configurar Git si es necesario
if [ ! -f ".git/config" ]; then
  echo "⚙️ Ejecutando configuración inicial de Git..."
  ./scripts/git_setup.sh
else
  echo "✅ Configuración Git ya detectada."
fi

# 3️⃣ Traer cambios del repositorio remoto
echo "⬇️  Actualizando desde GitHub (pull)..."
./scripts/git_sync.sh pull || ./scripts/git_sync.sh force-pull

# 4️⃣ Subir tus cambios locales
COMMIT_MSG="auto-sync $(date '+%Y-%m-%d %H:%M:%S')"
echo "⬆️  Subiendo cambios locales con mensaje: '$COMMIT_MSG'"
./scripts/git_sync.sh push "$COMMIT_MSG"

# 5️⃣ Espejar JSON hacia GitHub Pages
echo "📤 Actualizando docs/data/..."
./scripts/git_sync_docs.sh

# 6️⃣ Mostrar estado final
echo "📊 Estado final del repositorio:"
./scripts/git_sync.sh status

echo "✅ Sincronización completa. Proyecto Ultra-LowFare alineado con GitHub."
