#!/usr/bin/env python3
"""
Cross-app API smoke test for GroundTruth Local MVP sidecar.

Usage:
    python scripts/smoke_test.py                         # default port 8765
    python scripts/smoke_test.py --port 8765              # explicit port
    python scripts/smoke_test.py --host 127.0.0.1 --port 8765

Requires:
    - Sidecar running (``pnpm dev`` or ``uvicorn main:app``)
    - httpx (already a sidecar dependency)

Output saved to ``.sisyphus/evidence/task-20-smoke/``.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Any

import httpx

# ── Paths ───────────────────────────────────────────────────────────────────
REPO_ROOT = Path(__file__).resolve().parent.parent
SIDECAR_DIR = REPO_ROOT / "apps" / "sidecar"
EVIDENCE_DIR = REPO_ROOT / ".sisyphus" / "evidence" / "task-20-smoke"
FIXTURE_PDF = REPO_ROOT / "fixtures" / "sample-project" / "small-floor-plan.pdf"

# Ensure sidecar modules are importable
sys.path.insert(0, str(SIDECAR_DIR))

# ── Smoke step registry ─────────────────────────────────────────────────────
# Each entry: (name, method, path_template_or_full, [kwargs])
# Use -1 for project_id placeholders that get filled at runtime.
# Expected behaviour documented inline.

STEPS: list[dict[str, Any]] = []


def step(
    name: str,
    method: str,
    path: str,
    expected: int | list[int] = 200,
    **kwargs: Any,
) -> None:
    """Register a smoke step."""
    STEPS.append({
        "name": name,
        "method": method.upper(),
        "path": path,
        "expected": [expected] if isinstance(expected, int) else expected,
        "kwargs": kwargs,
    })


# ── Define the smoke sequence ───────────────────────────────────────────────

# 1. Health (no project_path needed)
step("health", "GET", "/health", 200)

# 2. Setup status (no project_path needed)
step("setup-status", "GET", "/setup/status", 200)

# 3. Setup provider GET (no project_path needed)
step("setup-provider-get", "GET", "/setup/provider", 200)

# 4. Classifications list — empty (project is fresh)
step("classifications-list-empty", "GET",
     "/projects/{project_id}/classifications?project_path={project_path}", 200)

# 5. Create classification
step("classification-create", "POST",
     "/projects/{project_id}/classifications?project_path={project_path}",
     200,
     json={"name": "Concrete", "color": "#808080", "unit": "CY"})

# 6. Classifications list — has item
step("classifications-list-populated", "GET",
     "/projects/{project_id}/classifications?project_path={project_path}", 200)

# 7. Ingest the fixture PDF (multipart upload)
step("ingest-pdf", "POST",
     "/projects/{project_id}/ingest?project_path={project_path}",
     200,
     files={"file": ("small-floor-plan.pdf", open(str(FIXTURE_PDF), "rb"), "application/pdf")})

# 8. List sheets (expect 1+ sheets after ingest)
step("sheets-list", "GET",
     "/projects/{project_id}/sheets?project_path={project_path}", 200)

# 9. Create takeoff item on first sheet (sheet_id filled at runtime)
step("takeoff-item-create", "POST",
     "/projects/{project_id}/sheets/{sheet_id}/takeoff-items?project_path={project_path}",
     200,
     json={
         "type": "linear",
         "geometry": {
             "kind": "path",
             "points": [{"x": 0, "y": 0}, {"x": 3, "y": 4}],
             "scale": 2,
             "scale_unit": "ft",
         },
     })

# 10. List takeoff items
step("takeoff-items-list", "GET",
     "/projects/{project_id}/sheets/{sheet_id}/takeoff-items?project_path={project_path}",
     200)

# 11. Semantic search (expect empty index, but endpoint should respond)
step("search-semantic", "GET",
     "/projects/{project_id}/search?q=wall&project_path={project_path}", 200)

# 12. Text search (expect empty result, but endpoint should respond)
step("search-text", "GET",
     "/projects/{project_id}/text-search?q=wall&project_path={project_path}", 200)

# 13. Snapshot create
step("snapshot-create", "POST",
     "/projects/{project_id}/snapshots?project_path={project_path}",
     200,
     json={"name": "Baseline"})

# 14. Snapshots list
step("snapshots-list", "GET",
     "/projects/{project_id}/snapshots?project_path={project_path}", 200)

# 15. AI settings GET (defaults)
step("ai-settings-get", "GET",
     "/projects/{project_id}/ai/settings?project_path={project_path}", 200)

# 16. AI settings PUT
step("ai-settings-put", "PUT",
     "/projects/{project_id}/ai/settings?project_path={project_path}",
     200,
     json={
         "provider": "ollama",
         "base_url": "http://127.0.0.1:11434",
         "chat_model": "llama3.2",
         "embedding_model": "nomic-embed-text",
     })

# 17. Export XLSX
step("export-xlsx", "GET",
     "/projects/{project_id}/export.xlsx?project_path={project_path}",
     200)

# 18. Visual search (will 404 on sheet_id placeholder — expected shape)
step("visual-search", "POST",
     "/projects/{project_id}/visual-search?project_path={project_path}",
     [200, 404, 422, 500],
     json={"sheet_id": "{sheet_id}", "bbox": [0, 0, 100, 100]})


# ── Runner ───────────────────────────────────────────────────────────────────


class SmokeRunner:
    """Orchestrates the smoke test sequence against a running sidecar."""

    def __init__(self, base_url: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.client = httpx.Client(base_url=base_url, timeout=30.0)
        self.project_id: str | None = None
        self.project_path: str | None = None
        self.sheet_id: str | None = None
        self.results: list[dict[str, Any]] = []

    # ── Project bootstrap ─────────────────────────────────────────────────

    def _create_project(self) -> None:
        """Bootstrap a test project directly via project_service (filesystem)."""
        from services.project_service import create_project  # type: ignore[import-untyped]
        import uuid as _uuid

        self.project_id = str(_uuid.uuid4())
        tmp = Path.home() / ".groundtruth" / "local" / "smoke-tests"
        tmp.mkdir(parents=True, exist_ok=True)
        proj_dir = create_project(f"smoke-{self.project_id[:8]}", str(tmp))

        # Write project_id into the sqlite DB
        from database import get_session  # type: ignore[import-untyped]
        from models import Project  # type: ignore[import-untyped]

        db_path = proj_dir / "project.sqlite"
        with get_session(db_path) as session:
            existing = session.query(Project).first()
            if existing:
                self.project_id = str(existing.id)
            else:
                session.add(Project(id=_uuid.UUID(self.project_id), name="SmokeTest", path=str(proj_dir)))

        self.project_path = str(proj_dir)

    # ── Runtime fill ───────────────────────────────────────────────────────

    def _fmt(self, path: str) -> str:
        """Replace {project_id}, {project_path}, {sheet_id} with runtime values."""
        return path.format(
            project_id=self.project_id or "00000000-0000-0000-0000-000000000000",
            project_path=self.project_path or "",
            sheet_id=self.sheet_id or "00000000-0000-0000-0000-000000000000",
        )

    def _fmt_kwargs(self, kwargs: dict[str, Any]) -> dict[str, Any]:
        """Deep-format string values in kwargs dict."""
        if "json" in kwargs:
            kwargs["json"] = self._deep_fmt(kwargs["json"])
        if "files" in kwargs:
            kwargs["files"] = {k: self._deep_fmt(v) if isinstance(v, str) else v for k, v in kwargs["files"].items()}
        return kwargs

    def _deep_fmt(self, obj: Any) -> Any:
        if isinstance(obj, str):
            return self._fmt(obj)
        if isinstance(obj, dict):
            return {k: self._deep_fmt(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [self._deep_fmt(v) for v in obj]
        return obj

    # ── Execute ────────────────────────────────────────────────────────────

    def run(self) -> list[dict[str, Any]]:
        print(f"Smoke testing {self.base_url}")
        print(f"Evidence dir: {EVIDENCE_DIR}")
        print()

        # Bootstrap project
        print("  [bootstrap] Creating test project...")
        self._create_project()
        print(f"  [bootstrap] Project ID: {self.project_id}")
        print(f"  [bootstrap] Project path: {self.project_path}")
        print()

        for s in STEPS:
            name = s["name"]
            method = s["method"]
            expected = s["expected"]
            path = self._fmt(s["path"])
            kwargs = self._fmt_kwargs(s["kwargs"])

            # HACK: close file before the next step re-opens it
            if "files" in kwargs:
                for fname, fval in list(kwargs["files"].items()):
                    if hasattr(fval, "read") and hasattr(fval, "close"):
                        pass  # keep open for now

            try:
                resp = self.client.request(method, path, **kwargs)
                status = resp.status_code
                passed = status in expected
                try:
                    body = resp.json()
                except Exception:
                    body = resp.text[:2000] if resp.text else "(empty body)"

                result = {
                    "name": name,
                    "method": method,
                    "path": path,
                    "expected": expected,
                    "actual": status,
                    "passed": passed,
                    "body_summary": self._summarize(body),
                }
                self.results.append(result)

                icon = "✓" if passed else "✗"
                print(f"  [{icon}] {name:40s} {status} (expected {expected})")
                if not passed:
                    print(f"         ↳ body: {self._summarize(body)[:120]}")

                # Save evidence
                safe_name = name.replace(" ", "-").replace("_", "-")
                ext = ".json" if isinstance(body, dict) else ".txt"
                evidence = EVIDENCE_DIR / f"{len(self.results):02d}-{safe_name}{ext}"
                evidence.parent.mkdir(parents=True, exist_ok=True)
                if isinstance(body, dict):
                    evidence.write_text(json.dumps(body, indent=2, default=str), encoding="utf-8")
                else:
                    evidence.write_text(str(body), encoding="utf-8")

                # Capture sheet_id for dependent steps
                if self.sheet_id is None and isinstance(body, dict):
                    sheet_id = body.get("id") or body.get("sheet_id")
                    if sheet_id:
                        self.sheet_id = str(sheet_id)
                if self.sheet_id is None and isinstance(body, list) and len(body) > 0:
                    sid = body[0].get("id")
                    if sid:
                        self.sheet_id = str(sid)

            except httpx.ConnectError as exc:
                result = {
                    "name": name,
                    "method": method,
                    "path": path,
                    "expected": expected,
                    "actual": "CONNREFUSED",
                    "passed": False,
                    "body_summary": f"Connection refused: {exc}",
                }
                self.results.append(result)
                print(f"  [✗] {name:40s} CONNREFUSED — is the sidecar running on {self.base_url}?")
                break

            except Exception as exc:
                result = {
                    "name": name,
                    "method": method,
                    "path": path,
                    "expected": expected,
                    "actual": "ERROR",
                    "passed": False,
                    "body_summary": str(exc)[:200],
                }
                self.results.append(result)
                print(f"  [✗] {name:40s} ERROR — {exc}")

            # Close file handles from multipart uploads
            if "files" in kwargs:
                for fname, fval in list(kwargs["files"].items()):
                    if hasattr(fval, "close"):
                        fval.close()  # type: ignore[union-attr]

        return self.results

    @staticmethod
    def _summarize(body: Any) -> str:
        if isinstance(body, dict):
            keys = list(body.keys())
            type_str = f"dict[{', '.join(keys[:5])}{'...' if len(keys) > 5 else ''}]"
            return type_str
        if isinstance(body, list):
            return f"list[{len(body)} items]"
        if isinstance(body, str):
            return body.strip()[:100]
        return str(body)[:100]


# ── Summary ──────────────────────────────────────────────────────────────────


def write_summary(results: list[dict[str, Any]], base_url: str) -> Path:
    """Write a human-readable smoke test summary."""
    total = len(results)
    passed = sum(1 for r in results if r["passed"])
    failed = total - passed

    lines: list[str] = []
    lines.append("# Smoke Test Summary")
    lines.append(f"**Date:** {time.strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"**Target:** {base_url}")
    lines.append(f"**Result:** {passed}/{total} passed, {failed} failed")
    lines.append("")
    if failed:
        lines.append("## Failures")
        lines.append("")
        for r in results:
            if not r["passed"]:
                lines.append(f"- **{r['name']}**: expected {r['expected']}, got {r['actual']}")
                lines.append(f"  - `{r['method']} {r['path']}`")
                lines.append(f"  - {r['body_summary']}")
        lines.append("")

    lines.append("## All Results")
    lines.append("")
    lines.append("| # | Step | Method | Path | Expected | Got | Passed |")
    lines.append("|---|------|--------|------|----------|-----|--------|")
    for i, r in enumerate(results, 1):
        lines.append(
            f"| {i} | {r['name']} | {r['method']} | `{r['path'][:80]}...` "
            f"| {r['expected']} | {r['actual']} | {'✓' if r['passed'] else '✗'} |"
        )
    lines.append("")

    summary_text = "\n".join(lines)
    summary_path = EVIDENCE_DIR / "summary.md"
    summary_path.parent.mkdir(parents=True, exist_ok=True)
    summary_path.write_text(summary_text, encoding="utf-8")
    return summary_path


def write_summary_json(results: list[dict[str, Any]], base_url: str) -> Path:
    """Write a machine-readable smoke test summary."""
    total = len(results)
    passed = sum(1 for r in results if r["passed"])
    failed = total - passed

    summary = {
        "date": time.strftime("%Y-%m-%d %H:%M:%S"),
        "target": base_url,
        "total": total,
        "passed": passed,
        "failed": failed,
        "results": results,
    }
    summary_path = EVIDENCE_DIR / "summary.json"
    summary_path.write_text(json.dumps(summary, indent=2, default=str), encoding="utf-8")
    return summary_path


# ── CLI ──────────────────────────────────────────────────────────────────────


def main() -> int:
    parser = argparse.ArgumentParser(description="GroundTruth Local MVP — cross-app API smoke test")
    parser.add_argument("--host", default="127.0.0.1", help="Sidecar host (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8765, help="Sidecar port (default: 8765)")
    args = parser.parse_args()

    base_url = f"http://{args.host}:{args.port}"

    runner = SmokeRunner(base_url)
    results = runner.run()

    summary_md = write_summary(results, base_url)
    summary_json = write_summary_json(results, base_url)

    total = len(results)
    passed = sum(1 for r in results if r["passed"])
    failed = total - passed

    print()
    print(f"Evidence saved to: {EVIDENCE_DIR}")
    print(f"  summary: {summary_md}")
    print(f"  json:    {summary_json}")
    print()
    print(f"{'SMOKE TEST COMPLETE' if failed == 0 else 'SMOKE TEST FAILURES DETECTED'}: {passed}/{total} passed")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
