# Learnings

## Wave 1 (Completed)
- POST /projects at `apps/sidecar/api/endpoints/projects.py` works (tested via curl)
- GET /projects returns list of projects (tested)
- Sheet image endpoint at `apps/sidecar/api/endpoints/sheets.py` added
- thumbnail_url returns relative URL path, frontend prepends `http://127.0.0.1:{port}` in Workspace.tsx
- SheetViewer.tsx uses `projectId` prop (not `document_id`) for image URLs
- Wave 1 committed: `94f62b8 fix(sidecar): add project CRUD and sheet image serving endpoints`
