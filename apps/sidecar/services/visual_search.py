"""Fast local visual region search using grayscale template matching."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageChops, ImageStat


@dataclass(frozen=True)
class BBox:
    x0: float
    y0: float
    x1: float
    y1: float


@dataclass(frozen=True)
class VisualMatch:
    bbox: BBox
    score: float


def _clamp_bbox(bbox: BBox, width: int, height: int) -> tuple[int, int, int, int]:
    x0 = max(0, min(width - 1, round(bbox.x0)))
    y0 = max(0, min(height - 1, round(bbox.y0)))
    x1 = max(x0 + 1, min(width, round(bbox.x1)))
    y1 = max(y0 + 1, min(height, round(bbox.y1)))
    return x0, y0, x1, y1


def _mean_abs_diff_score(template: Image.Image, candidate: Image.Image) -> float:
    diff = ImageChops.difference(template, candidate)
    mean = ImageStat.Stat(diff).mean[0]
    return max(0.0, 1.0 - (mean / 255.0))


def _overlaps(candidate: BBox, accepted: list[VisualMatch], max_overlap: float = 0.35) -> bool:
    candidate_area = max(1.0, (candidate.x1 - candidate.x0) * (candidate.y1 - candidate.y0))
    for match in accepted:
        other = match.bbox
        ix0 = max(candidate.x0, other.x0)
        iy0 = max(candidate.y0, other.y0)
        ix1 = min(candidate.x1, other.x1)
        iy1 = min(candidate.y1, other.y1)
        if ix1 <= ix0 or iy1 <= iy0:
            continue
        if ((ix1 - ix0) * (iy1 - iy0)) / candidate_area > max_overlap:
            return True
    return False


class VisualSearchService:
    """Search one rendered sheet for visual matches of a user-selected region."""

    def __init__(self, render_path: Path):
        self.render_path = render_path

    def search(
        self,
        region: BBox,
        *,
        limit: int = 20,
        threshold: float = 0.88,
    ) -> list[VisualMatch]:
        if not self.render_path.exists():
            raise FileNotFoundError(self.render_path)

        with Image.open(self.render_path) as image:
            sheet = image.convert("L")

        width, height = sheet.size
        x0, y0, x1, y1 = _clamp_bbox(region, width, height)
        template = sheet.crop((x0, y0, x1, y1))
        template_width, template_height = template.size
        if template_width < 2 or template_height < 2:
            return []

        step = 1 if min(template_width, template_height) <= 32 else max(1, min(template_width, template_height) // 4)
        scored: list[VisualMatch] = []
        max_x = width - template_width
        max_y = height - template_height
        for y in range(0, max_y + 1, step):
            for x in range(0, max_x + 1, step):
                candidate_image = sheet.crop((x, y, x + template_width, y + template_height))
                score = _mean_abs_diff_score(template, candidate_image)
                if score >= threshold:
                    scored.append(
                        VisualMatch(
                            bbox=BBox(
                                x0=float(x),
                                y0=float(y),
                                x1=float(x + template_width),
                                y1=float(y + template_height),
                            ),
                            score=score,
                        )
                    )

        scored.sort(key=lambda match: match.score, reverse=True)
        matches: list[VisualMatch] = []
        for match in scored:
            if _overlaps(match.bbox, matches):
                continue
            matches.append(match)
            if len(matches) >= limit:
                break
        return matches
