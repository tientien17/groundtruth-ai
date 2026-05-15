# SIDECAR KNOWLEDGE BASE

## OVERVIEW
FastAPI backend service powering construction takeoff intelligence and local AI workflows.

## STRUCTURE
```
apps/sidecar/
├── api/endpoints/       # FastAPI route modules
├── services/            # Business logic (computation, PDF, AI)
├── models.py            # SQLModel database schemas
├── database.py          # SQLite engine and session management
├── config.py            # Environment and app settings
├── main.py              # App factory and middleware setup
└── tests/               # Pytest suite (integration + unit)
```

## WHERE TO LOOK
| Component | Location |
|-----------|----------|
| API Routes | `api/endpoints/` |
| DB Models | `models.py` |
| DB Logic | `database.py` |
| Business Logic | `services/` |
| Integration Tests | `tests/` |

## CONVENTIONS
- FastAPI: Use `APIRouter` per feature domain.
- Database: SQLModel (SQLAlchemy + Pydantic) for all persistent entities.
- Dependency Injection: Use `Depends(get_session)` for database access in routes.
- Migrations: Managed via logic in `database.py` (auto-create tables).
- Errors: Raise `HTTPException` in endpoints; keep logic in services.
- Schemas: Shared models in `models.py` for DB and API responses.
- AI: Local inference via Ollama; keep prompt templates in `services/copilot.py`.

## ANTI-PATTERNS
- Raw SQL: Use SQLModel/SQLAlchemy queries only.
- Logic in Routes: Endpoints should be slim; delegate to services.
- Global State: Avoid global variables; use FastAPI dependency injection.
- Sync for I/O: Prefer `async def` for I/O bound endpoints.
- Direct DB Mutation in Service: Services should return models; let callers/routes handle commits if transactional.
- Manual JSON Parsing: Use Pydantic/SQLModel for request/response validation.
