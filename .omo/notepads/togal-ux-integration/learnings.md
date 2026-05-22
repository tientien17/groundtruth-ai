# UX Integration Learnings

## Welcome Screen Component
- Created `WelcomeScreen` component for first-time launch.
- Uses `localStorage` flag `groundtruth_onboarding_done` to track state.
- Three-step workflow (Upload PDFs, Measure & Detect, Export Quantities) visually structured using Tailwind grids and custom theme colors (`bg-primary-light`, `text-primary`, etc.).
- "Create Project" automatically hits the backend and establishes workspace state.
- Integrated `WelcomeScreen` into `App.tsx` directly replacing the old standalone card.

## Tests
- Extracted existing `App.tsx` mock behaviors for `Workspace` and `SetupWizard`.
- Validated `WelcomeScreen` rendering the three key phases.
- Verified backend calls are correctly formed during "Create Project" flow.
- Added tests to cover the "Skip" action and proper `localStorage` update behavior.

## Workflow Stepper Integration
- Created `WorkflowStepper` component displaying "Upload PDFs", "Measure", and "Export".
- States depend on application data (`sheetsLength`, `selectedSheetId`, `takeoffItemsLength`).
- Added horizontally above the main `Workspace` grid structure for constant visibility.
- Validated via Vitest with isolated 4-stage UI component tests.

## AI Auto-Detect Integration Learnings

- Added Togal-style AI auto-detect button to workspace toolbar
- Implemented mock auto-detect endpoint to simulate AI processing
- Reused TextSearchCandidate model and CandidateReview overlay for accept/reject UI
- Connected accept action to map detections into takeoff items endpoint as 'ai_detect' or 'text_search' depending on source.
- [ChatPanel UI] Modified to match Togal Chat prominence
- Added persistent chat history with user (blue) and assistant (gray) bubbles
- Implemented fixed bottom input with a clear send icon and loading state logic
- Modified Workspace.tsx to ensure ChatPanel fills the top vertical space properly and flexes with the table below
- Updated tests to pass with the new layout


## Compare Sheets Integration
- Created `CompareView` component rendering two side-by-side sheets for quantity comparison.
- Added `POST /projects/{project_id}/sheets/compare` API to return items `only_in_a`, `only_in_b`, and `in_both` matching classification.
- Exposed a "Compare Sheets" button in `Workspace.tsx` left sidebar, visible when >= 2 sheets exist.
- Implemented visual indicators (orange/blue/green) matching Tailwind aesthetics.
- Ensured integration avoids circular dependencies and preserves existing app structure.

