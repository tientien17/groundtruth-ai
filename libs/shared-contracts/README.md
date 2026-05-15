# Shared contracts

Canonical API and project contracts for GroundTruth Local MVP.

- `schema.json`: source of truth for DTOs, API envelopes, errors, and local project folder format.
- `typescript/contracts.ts`: TypeScript types generated-aligned with `schema.json`.
- `python/shared_contracts/models.py`: dependency-free Python DTO models aligned with `schema.json`.

No ad-hoc API shapes. Frontend and backend must use these contracts or generated clients from `schema.json`.
