# Decisions

## Project path strategy
- Use `Settings.storage_path` (from config.py) as base for all project directories
- POST /projects calls `project_service.create_project()` which handles .gtl folder creation

## Thumbnail URL approach
- Backend returns relative URL `/projects/{id}/sheets/{sid}/image?project_path=...`
- Frontend prepends `http://127.0.0.1:{sidecarPort}` in Workspace.tsx loadSheets()
- SheetsSidebar/SheetCard receive full URLs directly
