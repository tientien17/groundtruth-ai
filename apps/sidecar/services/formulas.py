"""Safe formula evaluation for takeoff quantities."""
from __future__ import annotations

import ast
import operator
from collections.abc import Mapping
from dataclasses import dataclass


MAX_EXPRESSION_LENGTH = 200
MAX_POWER = 6


@dataclass(frozen=True)
class FormulaResult:
    """Result of applying a formula to a takeoff quantity."""

    value: float
    expression: str


class FormulaError(ValueError):
    """Raised when a formula is invalid or unsafe."""


_BINARY_OPERATORS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Pow: operator.pow,
}

_UNARY_OPERATORS = {
    ast.UAdd: operator.pos,
    ast.USub: operator.neg,
}


def apply_formula(
    expression: str,
    quantity: float,
    variables: Mapping[str, float] | None = None,
) -> FormulaResult:
    """Evaluate a simple arithmetic formula with ``QTY`` bound to quantity.

    Supported syntax is intentionally small: numeric constants, variables, ``+``,
    ``-``, ``*``, ``/``, ``**`` and parentheses. Function calls, attributes,
    comprehensions, and all other Python syntax are rejected before evaluation.
    """
    normalized_variables = _normalize_variables(quantity, variables)
    value = evaluate_formula(expression, normalized_variables)
    return FormulaResult(value=value, expression=expression)


def evaluate_formula(expression: str, variables: Mapping[str, float]) -> float:
    """Safely evaluate a formula expression against numeric variables."""
    expression = expression.strip()
    if not expression:
        raise FormulaError("Formula expression is required")
    if len(expression) > MAX_EXPRESSION_LENGTH:
        raise FormulaError("Formula expression is too long")

    try:
        parsed = ast.parse(expression, mode="eval")
    except SyntaxError as exc:
        raise FormulaError("Formula expression is invalid") from exc

    result = _evaluate_node(parsed.body, dict(variables))
    _assert_finite(result, "Formula result")
    return result


def _normalize_variables(
    quantity: float,
    variables: Mapping[str, float] | None,
) -> dict[str, float]:
    _assert_finite(quantity, "Quantity")
    normalized = {"QTY": float(quantity), "qty": float(quantity), "quantity": float(quantity)}

    for name, value in (variables or {}).items():
        if not name.isidentifier():
            raise FormulaError(f"Invalid variable name: {name}")
        _assert_finite(float(value), f"Variable {name}")
        normalized[name] = float(value)
    return normalized


def _evaluate_node(node: ast.AST, variables: dict[str, float]) -> float:
    if isinstance(node, ast.Constant):
        if isinstance(node.value, bool) or not isinstance(node.value, int | float):
            raise FormulaError("Formula constants must be numeric")
        return float(node.value)

    if isinstance(node, ast.Name):
        try:
            return variables[node.id]
        except KeyError as exc:
            raise FormulaError(f"Unknown formula variable: {node.id}") from exc

    if isinstance(node, ast.BinOp):
        operator_func = _BINARY_OPERATORS.get(type(node.op))
        if operator_func is None:
            raise FormulaError("Formula operator is not supported")

        left = _evaluate_node(node.left, variables)
        right = _evaluate_node(node.right, variables)
        if isinstance(node.op, ast.Div) and right == 0:
            raise FormulaError("Formula cannot divide by zero")
        if isinstance(node.op, ast.Pow) and abs(right) > MAX_POWER:
            raise FormulaError("Formula exponent is too large")
        return float(operator_func(left, right))

    if isinstance(node, ast.UnaryOp):
        operator_func = _UNARY_OPERATORS.get(type(node.op))
        if operator_func is None:
            raise FormulaError("Formula unary operator is not supported")
        return float(operator_func(_evaluate_node(node.operand, variables)))

    raise FormulaError("Formula syntax is not supported")


def _assert_finite(value: float, label: str) -> None:
    if value != value or value in (float("inf"), float("-inf")):
        raise FormulaError(f"{label} must be finite")
