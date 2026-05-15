"""Tests for safe takeoff formula evaluation."""
from __future__ import annotations

import pytest

from services.formulas import FormulaError, apply_formula, evaluate_formula


def test_apply_formula_uses_qty_variable_for_waste_multiplier():
    result = apply_formula("QTY * 1.05", 100)

    assert result.value == pytest.approx(105.0)
    assert result.expression == "QTY * 1.05"


def test_evaluate_formula_supports_parentheses_and_custom_variables():
    result = evaluate_formula("(QTY + waste) / 2", {"QTY": 10, "waste": 2})

    assert result == pytest.approx(6.0)


def test_apply_formula_supports_lowercase_quantity_aliases():
    assert apply_formula("qty + quantity", 7).value == pytest.approx(14.0)


def test_formula_rejects_function_calls():
    with pytest.raises(FormulaError):
        apply_formula("round(QTY)", 10)


def test_formula_rejects_attribute_access_and_imports():
    with pytest.raises(FormulaError):
        apply_formula("__import__('os').system('echo unsafe')", 10)


def test_formula_rejects_unknown_variables():
    with pytest.raises(FormulaError):
        apply_formula("QTY + LABOR", 10)


def test_formula_rejects_division_by_zero():
    with pytest.raises(FormulaError):
        apply_formula("QTY / 0", 10)
