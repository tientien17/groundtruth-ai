# Togal.ai UX Integration Plan

**Goal:** Integrate the key UX patterns from Togal.ai's tour and features into GroundTruth Local to create a guided, intuitive first-run experience with AI-assisted takeoff.

**Based on research of:** Togal.ai website, features page, interactive tour  
**Current app state:** MVP with working backend but no onboarding, no empty state guidance, no workflow indicators

---

## Feature Mapping: Togal.ai → GroundTruth Local

| Togal.ai Feature | GroundTruth Equivalent | Status |
|---|---|---|
| Upload plans + auto-naming | PDF upload endpoint (T8) exists | ✅ Backend, ❌ No upload UI |
| Manual takeoff tools | Length/Area/Count tools | ✅ Working |
| **Togal Button** (AI auto-detect) | No equivalent | ❌ Missing |
| AI-driven Search (bbox search) | Text search (T21) + Visual search (T23) | ✅ Backend, ❌ No unified UI |
| **Togal Chat** "Talk to your plans" | Copilot (T20) | ✅ Working but hidden |
| Data Export to Excel | Excel export (T16) | ✅ Working |
| **Onboarding/Tour** (first-run) | No equivalent | ❌ Missing |
| **Workflow guidance** (step indicator) | No equivalent | ❌ Missing |
| **Empty state + CTA** | No guidance when no sheets | ❌ Missing |
| **Drawing comparison** | No equivalent | ❌ Missing |
| **Sample project** | No demo data | ❌ Missing |

---

## TODOs

### Phase 1: UX Foundation (P0)

1. ✅ **Create Onboarding Welcome Screen** — Build a welcome component that appears on first launch showing a 3-step workflow (Upload → Measure → Export), with "Create Project" and "Load Sample Demo" CTAs.
   - Files: `apps/frontend/src/components/Onboarding/WelcomeScreen.tsx` (NEW), `apps/frontend/src/components/Onboarding/WelcomeScreen.test.tsx` (NEW), `apps/frontend/src/App.tsx` (modify)
   - Acceptance: Shows on first launch (localStorage flag), 3-step workflow, Create + Demo + Skip CTAs, all tests pass

2. ✅ **Add Enhanced Empty State + Upload UI** — Replace the bare "No sheets found" with a guided empty state showing Upload PDF button, drag-drop zone, and sample project link.
   - Files: `apps/frontend/src/components/Workspace/SheetsSidebar.tsx` (modify), `apps/frontend/src/components/Workspace/DragDropZone.tsx` (NEW), `apps/frontend/src/components/Workspace/Workspace.tsx` (modify)
   - Acceptance: Upload button triggers file picker, drag-drop zone, calls `POST /projects/{id}/documents`, loading state, error state, all tests pass

3. ✅ **Add Tool Tooltips** — Add descriptive tooltips to each tool in ToolsSidebar explaining when/how to use each tool.
   - Files: `apps/frontend/src/components/Workspace/ToolsSidebar.tsx` (modify)
   - Acceptance: Each tool shows descriptive tooltip on hover (native `title` attribute), all tests pass

### Phase 2: Workflow Guidance (P1)

4. ✅ **Add Workflow Progress Indicator** — Add an always-visible 3-step progress stepper at the top of Workspace showing: Upload PDF → Measure → Export, with current step highlighted.
   - Files: `apps/frontend/src/components/Workspace/WorkflowStepper.tsx` (NEW), `apps/frontend/src/components/Workspace/Workspace.tsx` (modify)
   - Acceptance: 3 steps, conditional completion (sheets.length, selectedSheetId, takeoffItems.length), visual states (✅/⏸️/⬜), all tests pass

### Phase 3: AI Features (P1)

5. ✅ **Add Togal Button (AI Auto-Detect)** — Add a prominent green "AI Auto-Detect" button that sends the current sheet to local Ollama and returns detected objects with accept/reject workflow.
   - Files: `apps/frontend/src/components/Workspace/AiAutoDetectButton.tsx` (NEW), `apps/frontend/src/components/Workspace/Workspace.tsx` (modify), `apps/sidecar/api/endpoints/auto_detect.py` (NEW), `apps/sidecar/main.py` (modify)
   - Acceptance: Green button visible, triggers POST /auto-detect, loading spinner, review panel, accept/reject creates takeoff items, backend tests pass

6. ✅ **Enhance Copilot / Chat Panel** — Elevate existing Copilot to match Togal Chat: persistent conversation, "talk to your plans" branding, always-visible chat button.
   - Files: `apps/frontend/src/components/Copilot/ChatPanel.tsx` (modify), `apps/frontend/src/components/Copilot/ChatPanel.test.tsx` (modify), `apps/frontend/src/components/Workspace/Workspace.tsx` (modify)
   - Acceptance: Chat input with "Ask about your plans..." placeholder, persistent history, cited sources, clear chat button, all tests pass

### Phase 4: Advanced UX (P2)

7. ✅ **Create Sample/Demo Project** — Create a pre-packaged demo project with sample drawings and pre-made measurements loadable with one click.
   - Files: `fixtures/sample-project/` (NEW — project.sqlite + sample PDF + renders), `apps/sidecar/api/endpoints/demo.py` (NEW), `apps/sidecar/main.py` (modify)
   - Acceptance: "Load Sample Demo" button, loads within 2 seconds, shows sheets + thumbnails + pre-made takeoff items + classifications, all tests pass

8. ✅ **Add Drawing Comparison View** — Add ability to compare two sheets side-by-side and see quantity differences.
   - Files: `apps/frontend/src/components/Workspace/CompareView.tsx` (NEW), `apps/frontend/src/components/Workspace/Workspace.tsx` (modify), `apps/sidecar/api/endpoints/compare.py` (NEW)
   - Acceptance: "Compare" button when 2+ sheets, side-by-side viewer, quantity difference overlay, backend comparison endpoint tested, all tests pass

---

## Final Verification Wave

F1. **Plan Compliance Audit** — Verify all 8 tasks implemented per spec, no scope creep, all evidence files exist

F2. **Code Quality Review** — Run typecheck, lint, tests. Review all changed files for anti-patterns.

F3. **Manual QA** — Welcome screen appears on first launch, upload PDF works end-to-end, AI Auto-Detect triggers, tooltips show, workflow stepper updates, chat responds, demo loads, compare view works

F4. **Scope Fidelity Check** — Each task's git diff matches spec exactly. No feature creep, no missing features.

---

## Notepad Paths
- READ: `.omo/notepads/togal-ux-integration/*.md` (write to on append)
- WRITE: Append to appropriate category

## Dependencies
- Previous MVP plan completed (project CRUD, sheet image serving, takeoff persistence)
- Sidecar running on port 8765
- Ollama running for AI features (Task 5)
