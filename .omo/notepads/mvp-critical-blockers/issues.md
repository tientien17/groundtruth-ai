# Issues

## Pre-existing test failures (unrelated)
- `test_ai_generate_writes_audit_log` — asyncio event loop issue in MainThread
- `test_ai_generate_error_logged` — same root cause
- Both in `tests/test_ai_router.py` — not caused by MVP changes
