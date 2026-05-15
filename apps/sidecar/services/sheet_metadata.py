"""Construction sheet metadata extraction from OCR/native text.

Detects sheet numbers (e.g. A-101, S1.1, M-001) and titles
(e.g. "FIRST FLOOR PLAN") using regex heuristics — no NLP deps.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

# ── Discipline prefixes commonly found on construction drawings ────────────
_DISCIPLINE_PREFIXES = (
    "A", "S", "M", "E", "P", "C", "L", "G",  # single-letter
    "AD", "AR", "AS", "AE",                    # architectural variants
    "EL", "EP", "ES",                          # electrical
    "FP",                                       # fire protection
    "ME", "MP",                                 # mechanical / plumbing
    "ST", "SE",                                 # structural
    "CI", "CV",                                 # civil
    "LA", "LS",                                 # landscape
    "ID",                                       # interior design
    "SP", "SK",                                 # site plan / sketch
    "T",                                        # title
)

# Build alternation sorted longest-first so "AD" matches before "A"
_PREFIX_ALT = "|".join(sorted(_DISCIPLINE_PREFIXES, key=len, reverse=True))

# Sheet number pattern:
#   <prefix> <optional separator> <digits> <optional dot/dash + sub-number>
# Examples: A-101, S1.1, M001, EL-2.3, G0.01, C-101A
_SHEET_NUMBER_RE = re.compile(
    rf"""
    \b
    (?P<prefix>{_PREFIX_ALT})       # discipline prefix
    (?P<sep>[.\-\s])?               # optional separator
    (?P<number>\d{{1,4}})           # primary number
    (?:                             # optional sub-number
        [.\-]
        (?P<sub>\d{{1,4}}[A-Za-z]?)
    )?
    (?P<suffix>[A-Za-z])?           # optional trailing letter
    \b
    """,
    re.VERBOSE | re.IGNORECASE,
)

# Title-like patterns: lines that are mostly uppercase, 3+ words
_TITLE_RE = re.compile(
    r"^[A-Z][A-Z0-9 /\-&,.()]{4,}$",
    re.MULTILINE,
)

# Common noise titles to skip
_NOISE_TITLES = frozenset({
    "SCALE", "DATE", "DRAWN", "CHECKED", "APPROVED",
    "REVISION", "REVISIONS", "NO.", "SHEET", "PROJECT",
    "DRAWING", "DESCRIPTION", "NOT FOR CONSTRUCTION",
    "PRELIMINARY", "ISSUED FOR", "ISSUED FOR REVIEW",
    "NOTES", "GENERAL NOTES", "ABBREVIATIONS",
})


@dataclass(frozen=True)
class SheetMetadataResult:
    """Extracted sheet metadata from page text."""
    sheet_number: str | None
    sheet_title: str | None
    discipline: str | None
    raw_matches: dict[str, list[str]]


def extract_sheet_metadata(text: str) -> SheetMetadataResult:
    """Extract sheet number and title from page text content.

    Args:
        text: Full text content from a single PDF page.

    Returns:
        SheetMetadataResult with best-guess sheet number and title.
    """
    sheet_number, discipline = _extract_sheet_number(text)
    sheet_title = _extract_sheet_title(text)

    raw: dict[str, list[str]] = {}
    number_matches = _SHEET_NUMBER_RE.findall(text)
    if number_matches:
        raw["number_matches"] = [
            "".join(m) for m in number_matches
        ]
    title_matches = _TITLE_RE.findall(text)
    if title_matches:
        raw["title_candidates"] = title_matches[:5]

    return SheetMetadataResult(
        sheet_number=sheet_number,
        sheet_title=sheet_title,
        discipline=discipline,
        raw_matches=raw,
    )


def _extract_sheet_number(text: str) -> tuple[str | None, str | None]:
    """Find best sheet number candidate from text.

    Prioritizes matches found in the bottom portion of text
    (title block area on construction drawings).
    """
    matches = list(_SHEET_NUMBER_RE.finditer(text))
    if not matches:
        return None, None

    lines = text.splitlines()
    total_lines = len(lines)
    bottom_third_start = max(0, total_lines * 2 // 3)

    # Try bottom-third matches first (title block area)
    best: re.Match[str] | None = None
    for match in reversed(matches):
        line_no = text[:match.start()].count("\n")
        if line_no >= bottom_third_start:
            best = match
            break

    if best is None:
        best = matches[0]

    number = _normalize_sheet_number(best)
    discipline = best.group("prefix").upper()
    return number, discipline


def _normalize_sheet_number(match: re.Match[str]) -> str:
    """Build canonical sheet number from regex match groups."""
    prefix = match.group("prefix").upper()
    sep = match.group("sep") or "-"
    if sep == " ":
        sep = "-"
    number = match.group("number")
    result = f"{prefix}{sep}{number}"

    sub = match.group("sub")
    if sub:
        result += f".{sub}"

    suffix = match.group("suffix")
    if suffix:
        result += suffix.upper()

    return result


def _extract_sheet_title(text: str) -> str | None:
    """Find most likely sheet title from text.

    Looks for uppercase lines that resemble construction drawing titles
    like "FIRST FLOOR PLAN", "FOUNDATION PLAN", etc.
    """
    candidates: list[str] = []

    for match in _TITLE_RE.finditer(text):
        title = match.group(0).strip()
        # Skip short noise
        if len(title) < 5:
            continue
        if title in _NOISE_TITLES:
            continue
        # Must have at least 2 words
        words = title.split()
        if len(words) < 2:
            continue
        # Skip lines that are mostly numbers
        alpha_ratio = sum(1 for c in title if c.isalpha()) / max(len(title), 1)
        if alpha_ratio < 0.5:
            continue
        candidates.append(title)

    if not candidates:
        return None

    # Prefer longer titles (more descriptive) but cap at reasonable length
    candidates.sort(key=len, reverse=True)
    best = candidates[0]

    # Trim if absurdly long
    if len(best) > 100:
        best = best[:100].rsplit(" ", 1)[0]

    return best
