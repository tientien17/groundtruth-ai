"""Tests for backend takeoff quantity computation."""
from __future__ import annotations

import pytest

from services.computation import Point2D, compute_quantity, polygon_area


def test_count_takeoff_returns_one_per_item():
    result = compute_quantity("count", [{"x": 12, "y": 24}])

    assert result.value == 1.0
    assert result.unit == "count"


def test_linear_takeoff_sums_segments_and_scales_to_feet():
    result = compute_quantity(
        "linear",
        [{"x": 0, "y": 0}, {"x": 3, "y": 4}, {"x": 6, "y": 4}],
        scale=2,
        scale_unit="ft",
    )

    assert result.value == pytest.approx(16.0)
    assert result.unit == "ft"


def test_linear_takeoff_normalizes_inches_to_feet():
    result = compute_quantity(
        "linear",
        [{"x": 0, "y": 0}, {"x": 6, "y": 0}],
        scale=12,
        scale_unit="in",
    )

    assert result.value == pytest.approx(6.0)
    assert result.unit == "ft"


def test_area_takeoff_uses_shoelace_formula_and_square_scale():
    result = compute_quantity(
        "area",
        [{"x": 0, "y": 0}, {"x": 10, "y": 0}, {"x": 10, "y": 5}, {"x": 0, "y": 5}],
        scale=2,
        scale_unit="ft",
    )

    assert result.value == pytest.approx(200.0)
    assert result.unit == "sq ft"


def test_area_takeoff_subtracts_simple_holes():
    result = compute_quantity(
        "area",
        [{"x": 0, "y": 0}, {"x": 10, "y": 0}, {"x": 10, "y": 10}, {"x": 0, "y": 10}],
        holes=[[{"x": 0, "y": 0}, {"x": 2, "y": 0}, {"x": 2, "y": 2}, {"x": 0, "y": 2}]],
    )

    assert result.value == pytest.approx(96.0)
    assert result.unit == "sq ft"


def test_polygon_area_accepts_clockwise_or_counterclockwise_points():
    clockwise = [Point2D(0, 0), Point2D(0, 4), Point2D(4, 4), Point2D(4, 0)]
    counterclockwise = list(reversed(clockwise))

    assert polygon_area(clockwise) == pytest.approx(16.0)
    assert polygon_area(counterclockwise) == pytest.approx(16.0)
