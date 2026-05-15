"""Geometry quantity computation for takeoff items."""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any, Iterable, Literal


LinearUnit = Literal["ft", "in", "m", "cm", "mm"]
QuantityType = Literal["count", "linear", "area"]
GeometryType = Literal["point", "path", "polygon"]

METERS_PER_UNIT: dict[LinearUnit, float] = {
    "ft": 0.3048,
    "in": 0.0254,
    "m": 1.0,
    "cm": 0.01,
    "mm": 0.001,
}

UNIT_ALIASES: dict[str, LinearUnit] = {
    "ft": "ft",
    "foot": "ft",
    "feet": "ft",
    "'": "ft",
    "in": "in",
    "inch": "in",
    "inches": "in",
    '"': "in",
    "m": "m",
    "meter": "m",
    "meters": "m",
    "metre": "m",
    "metres": "m",
    "cm": "cm",
    "centimeter": "cm",
    "centimeters": "cm",
    "centimetre": "cm",
    "centimetres": "cm",
    "mm": "mm",
    "millimeter": "mm",
    "millimeters": "mm",
    "millimetre": "mm",
    "millimetres": "mm",
}


@dataclass(frozen=True)
class Point2D:
    x: float
    y: float


@dataclass(frozen=True)
class QuantityResult:
    value: float
    unit: str


def normalize_unit(unit: str) -> LinearUnit:
    """Normalize a supported linear unit alias."""
    normalized = UNIT_ALIASES.get(unit.strip().lower())
    if normalized is None:
        raise ValueError(f"Unsupported unit: {unit}")
    return normalized


def convert_distance(value: float, from_unit: LinearUnit, to_unit: LinearUnit) -> float:
    """Convert a linear distance through meters, matching shared geometry logic."""
    _assert_finite(value, "Distance")
    return (value * METERS_PER_UNIT[from_unit]) / METERS_PER_UNIT[to_unit]


def compute_quantity(
    quantity_type: str,
    points: Iterable[Point2D | dict[str, Any]],
    *,
    scale: float = 1.0,
    scale_unit: str = "ft",
    holes: Iterable[Iterable[Point2D | dict[str, Any]]] | None = None,
) -> QuantityResult:
    """Compute a canonical quantity for count, linear, or area takeoffs.

    ``scale`` is the number of ``scale_unit`` units represented by one drawing
    coordinate unit. Linear quantities are returned in feet; area quantities are
    returned in square feet.
    """
    normalized_type = _normalize_quantity_type(quantity_type)
    normalized_points = [_coerce_point(point) for point in points]

    if normalized_type == "count":
        if not normalized_points:
            raise ValueError("Count takeoffs require at least one point")
        return QuantityResult(value=1.0, unit="count")

    _assert_positive(scale, "Scale")
    unit = normalize_unit(scale_unit)

    if normalized_type == "linear":
        drawing_length = path_length(normalized_points)
        scaled_length = drawing_length * scale
        return QuantityResult(value=convert_distance(scaled_length, unit, "ft"), unit="ft")

    drawing_area = polygon_area(normalized_points)
    for hole in holes or []:
        drawing_area -= polygon_area([_coerce_point(point) for point in hole])
    drawing_area = max(drawing_area, 0.0)
    scaled_area = drawing_area * scale * scale
    unit_to_feet = convert_distance(1.0, unit, "ft")
    return QuantityResult(value=scaled_area * unit_to_feet * unit_to_feet, unit="sq ft")


def path_length(points: list[Point2D]) -> float:
    """Return the sum of straight-line segment distances through all points."""
    if len(points) < 2:
        raise ValueError("Linear takeoffs require at least two points")

    return sum(distance_between(start, end) for start, end in zip(points, points[1:]))


def polygon_area(points: list[Point2D]) -> float:
    """Return polygon area using the surveyor/shoelace formula."""
    if len(points) < 3:
        raise ValueError("Area takeoffs require at least three points")

    shoelace = 0.0
    for index, point in enumerate(points):
        next_point = points[(index + 1) % len(points)]
        shoelace += (point.x * next_point.y) - (next_point.x * point.y)
    return abs(shoelace) / 2.0


def distance_between(start: Point2D, end: Point2D) -> float:
    """Return Euclidean distance between two 2D points."""
    return math.hypot(end.x - start.x, end.y - start.y)


def geometry_type_for_quantity(quantity_type: str) -> GeometryType:
    """Map a quantity type to its persisted geometry type."""
    normalized_type = _normalize_quantity_type(quantity_type)
    if normalized_type == "count":
        return "point"
    if normalized_type == "linear":
        return "path"
    return "polygon"


def quantity_type_for_geometry(geometry_type: str) -> QuantityType:
    """Map a geometry type to its quantity type."""
    normalized_type = geometry_type.strip().lower()
    if normalized_type == "point":
        return "count"
    if normalized_type == "path":
        return "linear"
    if normalized_type == "polygon":
        return "area"
    raise ValueError(f"Unsupported geometry type: {geometry_type}")


def _normalize_quantity_type(quantity_type: str) -> QuantityType:
    normalized_type = quantity_type.strip().lower()
    if normalized_type in {"count", "linear", "area"}:
        return normalized_type  # type: ignore[return-value]
    if normalized_type in {"point", "path", "polygon"}:
        return quantity_type_for_geometry(normalized_type)
    raise ValueError(f"Unsupported quantity type: {quantity_type}")


def _coerce_point(point: Point2D | dict[str, Any]) -> Point2D:
    if isinstance(point, Point2D):
        x = point.x
        y = point.y
    else:
        try:
            x = float(point["x"])
            y = float(point["y"])
        except (KeyError, TypeError, ValueError) as exc:
            raise ValueError("Points must include finite x and y values") from exc

    _assert_finite(x, "point.x")
    _assert_finite(y, "point.y")
    return Point2D(x=x, y=y)


def _assert_positive(value: float, name: str) -> None:
    _assert_finite(value, name)
    if value <= 0:
        raise ValueError(f"{name} must be greater than zero")


def _assert_finite(value: float, name: str) -> None:
    if not math.isfinite(value):
        raise ValueError(f"{name} must be finite")
