== Sincronización GitHub <-> Codespaces ==

1) Inicializa configuración (una sola vez)
   chmod +x scripts/git_setup.sh scripts/git_sync.sh scripts/git_sync_docs.sh
   ./scripts/git_setup.sh

2) Traer cambios del Admin (GitHub → Codespaces)
   ./scripts/git_sync.sh pull
   (usa auto-stash; si quieres descartar local:)
   ./scripts/git_sync.sh force-pull

3) Subir cambios del Codespace al Admin
   ./scripts/git_sync.sh push "mensaje de commit"

4) Reflejar JSON para GitHub Pages
   ./scripts/git_sync_docs.sh

El workflow .github/workflows/sync_pages.yml copia automáticamente los JSON
de data/ hacia docs/data/ para publicarse en GitHub Pages.
