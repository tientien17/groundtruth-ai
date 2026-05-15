# FRONTEND KNOWLEDGE BASE

## OVERVIEW
React + TypeScript + Vite UI for GroundTruth Local preconstruction cockpit.

## STRUCTURE
```
src/
├── components/          # Feature-based UI (Workspace, Copilot, Takeoff, Library)
├── hooks/               # Core logic: useDrawing, useScale, useHistory, useViewer
├── test/                # Vitest setup and shared mocks
└── App.tsx              # Application entry and layout
tests/                   # Playwright E2E suites
```

## WHERE TO LOOK
| Feature | Location | Notes |
|---------|----------|-------|
| PDF Viewer | `src/hooks/useViewer.ts` | OpenSeadragon or PDF.js wrapper |
| Drawing Logic | `src/hooks/useDrawing.ts` | State machine for polygons/lines |
| Takeoff UI | `src/components/Takeoff/` | Measurement toolbars and lists |
| AI Chat | `src/components/Copilot/` | Retrieval citation UI |
| Scaling | `src/hooks/useScale.ts` | Pixel-to-real-world math |
| E2E Tests | `tests/` | Playwright browser automation |

## CONVENTIONS
- Feature Components: Keep local state inside feature folders; avoid global prop drilling.
- Hook-First Logic: Complex UI state (drawing, scaling) lives in hooks, not components.
- Strict Types: No `any`; use contracts from `@groundtruth/shared-contracts`.
- Vitest: Use for hook unit tests and component logic; JSDOM environment.
- Playwright: Use for multi-app integration (Frontend + Sidecar) flows.

## ANTI-PATTERNS
- No DOM manipulation outside React refs or specialized hooks.
- No heavy math in render cycle; memoize geometry calculations.
- Avoid large component files; split into feature sub-components.
- Do not bypass Sidecar API for local storage; use database via backend.
