"""Tests for sheet metadata extraction (regex-based heuristics)."""
from __future__ import annotations

import pytest

from services.sheet_metadata import SheetMetadataResult, extract_sheet_metadata


class TestSheetNumberExtraction:
    """Test sheet number detection from construction drawing text."""

    def test_standard_architectural_number(self):
        text = "Some header text\nGeneral notes\nA-101"
        result = extract_sheet_metadata(text)
        assert result.sheet_number is not None
        assert result.sheet_number == "A-101"
        assert result.discipline == "A"

    def test_structural_with_dot_separator(self):
        text = "STRUCTURAL DETAILS\nS1.1"
        result = extract_sheet_metadata(text)
        assert result.sheet_number is not None
        # Normalizes separator
        assert "S" in result.sheet_number
        assert "1" in result.sheet_number
        assert result.discipline == "S"

    def test_mechanical_with_dash(self):
        text = "MECHANICAL PLAN\nM-001"
        result = extract_sheet_metadata(text)
        assert result.sheet_number == "M-001"
        assert result.discipline == "M"

    def test_electrical_two_letter_prefix(self):
        text = "ELECTRICAL LIGHTING\nEL-2.3"
        result = extract_sheet_metadata(text)
        assert result.sheet_number is not None
        assert result.sheet_number.startswith("EL")
        assert result.discipline == "EL"

    def test_general_sheet(self):
        text = "COVER SHEET\nG0.01"
        result = extract_sheet_metadata(text)
        assert result.sheet_number is not None
        assert result.sheet_number.startswith("G")

    def test_no_sheet_number(self):
        text = "Just some regular text without any sheet numbers"
        result = extract_sheet_metadata(text)
        assert result.sheet_number is None
        assert result.discipline is None

    def test_sheet_with_suffix_letter(self):
        text = "FLOOR PLAN\nA-101A"
        result = extract_sheet_metadata(text)
        assert result.sheet_number is not None
        assert result.sheet_number.endswith("A")

    def test_prefers_bottom_of_page(self):
        """Sheet numbers in title block (bottom) should be preferred."""
        lines = ["Some header text"] * 10
        lines.append("A-999")  # noise near top
        lines.extend(["More body text"] * 20)
        lines.append("S-201")  # title block area
        text = "\n".join(lines)
        result = extract_sheet_metadata(text)
        assert result.sheet_number is not None
        assert result.sheet_number == "S-201"

    def test_civil_prefix(self):
        text = "SITE GRADING PLAN\nC-101"
        result = extract_sheet_metadata(text)
        assert result.sheet_number == "C-101"
        assert result.discipline == "C"

    def test_no_space_separator(self):
        text = "PLAN VIEW\nA101"
        result = extract_sheet_metadata(text)
        assert result.sheet_number is not None
        assert "A" in result.sheet_number
        assert "101" in result.sheet_number

    def test_fire_protection(self):
        text = "FIRE SPRINKLER PLAN\nFP-1.1"
        result = extract_sheet_metadata(text)
        assert result.sheet_number is not None
        assert result.sheet_number.startswith("FP")


class TestSheetTitleExtraction:
    """Test sheet title detection from construction drawing text."""

    def test_standard_plan_title(self):
        text = "Some small text\nFIRST FLOOR PLAN\nScale: 1/4\" = 1'-0\""
        result = extract_sheet_metadata(text)
        assert result.sheet_title is not None
        assert "FIRST FLOOR PLAN" in result.sheet_title

    def test_foundation_plan(self):
        text = "Notes and stuff\nFOUNDATION PLAN\nA-101"
        result = extract_sheet_metadata(text)
        assert result.sheet_title == "FOUNDATION PLAN"

    def test_skips_noise_titles(self):
        text = "SCALE\nNOTES\nGENERAL NOTES\nREAL BUILDING TITLE HERE"
        result = extract_sheet_metadata(text)
        # Should not pick noise titles
        if result.sheet_title:
            assert result.sheet_title not in {"SCALE", "NOTES", "GENERAL NOTES"}

    def test_no_title_in_lowercase_text(self):
        text = "this is just some lowercase paragraph text without any titles"
        result = extract_sheet_metadata(text)
        assert result.sheet_title is None

    def test_prefers_longer_descriptive_title(self):
        text = "SITE PLAN\nLANDSCAPE PLANTING PLAN\nA-101"
        result = extract_sheet_metadata(text)
        assert result.sheet_title is not None
        # Should prefer longer more descriptive title
        assert "LANDSCAPE PLANTING PLAN" in result.sheet_title

    def test_multi_word_title(self):
        text = "SECOND FLOOR REFLECTED CEILING PLAN\nDrawn by: JD"
        result = extract_sheet_metadata(text)
        assert result.sheet_title is not None
        assert "CEILING PLAN" in result.sheet_title

    def test_single_word_not_title(self):
        text = "ELEVATION\nSome other text"
        result = extract_sheet_metadata(text)
        # Single word should not be picked as title
        assert result.sheet_title is None


class TestFullExtraction:
    """Integration test for combined number + title extraction."""

    def test_typical_construction_page(self):
        text = """
PROJECT: ACME OFFICE BUILDING
SHEET LIST

FIRST FLOOR PLAN

Notes:
- All dimensions in feet
- Verify in field

Scale: 1/4" = 1'-0"
Drawn: JD
Checked: RS
Date: 2024-01-15

A-101
"""
        result = extract_sheet_metadata(text)
        assert result.sheet_number == "A-101"
        assert result.sheet_title is not None
        assert "FIRST FLOOR PLAN" in result.sheet_title
        assert result.discipline == "A"

    def test_empty_text(self):
        result = extract_sheet_metadata("")
        assert result.sheet_number is None
        assert result.sheet_title is None
        assert result.discipline is None
        assert result.raw_matches == {}

    def test_raw_matches_populated(self):
        text = "FLOOR PLAN\nA-101\nA-102"
        result = extract_sheet_metadata(text)
        assert "number_matches" in result.raw_matches
        assert len(result.raw_matches["number_matches"]) >= 2

    def test_result_is_frozen(self):
        result = extract_sheet_metadata("A-101\nFLOOR PLAN")
        assert isinstance(result, SheetMetadataResult)
