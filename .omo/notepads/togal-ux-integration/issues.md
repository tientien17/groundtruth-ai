# F4 Scope Fidelity Check

Tasks compliant: 4/8
Contamination: 8 issues
Unaccounted: 7 files
Verdict: REJECT

Issues:
- Task 2 — apps/frontend/src/components/Workspace/Workspace.tsx:221: Upload posts to `/projects/${projectId}/ingest`, but plan acceptance says call `POST /projects/{id}/documents`.
- Task 4 — apps/frontend/src/components/Workspace/WorkflowStepper.tsx:3-18 and Workspace.tsx:288-291: Stepper omits `selectedSheetId` condition from acceptance; Measure step activates with any sheet, not selected sheet.
- Task 5 — apps/frontend/src/components/Workspace/Workspace.tsx:255-264, 121-147: AI detections are coerced into `TextSearchCandidate`; accepted items use `source: 'text_search'` and always `type: 'count'`, losing auto-detect type/source fidelity.
- Task 7 — fixtures/sample-project/: Missing required `project.sqlite` and render assets from plan file scope; only PDF and expected JSON fixtures exist.
- Task 7 — apps/sidecar/api/endpoints/demo.py:55-57: Seeds Document original_path pointing to `documents/originals/Sample Floor Plan.pdf`, but endpoint never creates/copies that PDF into demo project.
- Task 8 — apps/frontend/src/components/Workspace/CompareView.tsx:170-230: Shows lists/counts only; no quantity difference overlay as required by acceptance.
- Task 8 — apps/sidecar/api/endpoints/compare.py:104-128: Diff key ignores quantity values, so endpoint does not produce quantity difference summary; same classification/type with different quantities lands in `in_both`.
- Scope — apps/frontend/src/components/Workspace/types.ts modified by Task 2 but not listed in plan Task 2 file scope.
- Scope — apps/frontend/src/App.test.tsx, apps/frontend/src/components/Workspace/WorkflowStepper.test.tsx, apps/frontend/src/components/Copilot/ChatPanel.test.tsx were added/modified by commits but some tests are not listed for corresponding tasks except Task 1 and Task 6; Task 4 test file outside listed file scope.
- Unaccounted working tree — apps/tauri/src-tauri/Cargo.toml modified, outside frontend/sidecar Togal plan scope.
- Unaccounted working tree — .omo/run-continuation/ses_1b1ebf253ffeuX6h4g0OrSnZsA.json modified, outside plan scope.
- Unaccounted untracked — .playwright-mcp/, civils-ai-landing.png, civils-ai-pricing.png, docs/UX_IMPROVEMENTS.md, togal-ai-landing.png outside listed plan scope.
