"""Native-first PDF text extraction with OCR fallback."""
# pyright: reportMissingImports=false
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, cast
from uuid import UUID, uuid4

import fitz
import pytesseract
from sqlalchemy.orm import Session

from config import Settings
from models import Sheet, SheetText, SheetTextBlock


def _configure_tesseract() -> None:
    settings = Settings()
    if settings.tesseract_path is None:
        return

    tesseract_path = settings.tesseract_path.expanduser()
    if tesseract_path.is_dir():
        tesseract_path = tesseract_path / "tesseract.exe"

    if tesseract_path.exists():
        pytesseract.pytesseract.tesseract_cmd = str(tesseract_path)


_configure_tesseract()


@dataclass(frozen=True)
class ExtractedTextEntry:
    text: str
    bbox_x0: float
    bbox_y0: float
    bbox_x1: float
    bbox_y1: float
    source: str


@dataclass(frozen=True)
class ExtractedTextBlock:
    text: str
    bbox_x: float
    bbox_y: float
    bbox_w: float
    bbox_h: float


@dataclass(frozen=True)
class PageExtractionResult:
    page_index: int
    source: str
    entries: list[ExtractedTextEntry]
    blocks: list[ExtractedTextBlock]


def extract_document_text_with_session(
    session: Session,
    pdf_path: Path,
    document_id: UUID,
    *,
    zoom: float = 2.0,
) -> list[PageExtractionResult]:
    """Extract and persist text for all pages in PDF using existing session."""
    pdf_path = pdf_path.expanduser().resolve()
    sheets = session.query(Sheet).filter(Sheet.document_id == document_id).all()
    sheets_by_page = {sheet.page_index: sheet for sheet in sheets}

    for sheet in sheets:
        session.query(SheetText).filter(SheetText.sheet_id == sheet.id).delete()
        session.query(SheetTextBlock).filter(SheetTextBlock.sheet_id == sheet.id).delete()

    results: list[PageExtractionResult] = []
    with fitz.open(pdf_path) as pdf:
        for page_index in range(pdf.page_count):
            sheet = sheets_by_page.get(page_index)
            if sheet is None:
                continue

            page = pdf.load_page(page_index)
            result = _extract_page_text(page, page_index, zoom=zoom)
            _persist_page_result(session, sheet.id, page_index, result)
            results.append(result)

    return results


def _persist_page_result(
    session: Session,
    sheet_id: UUID,
    page_index: int,
    result: PageExtractionResult,
) -> None:
    for entry in result.entries:
        session.add(
            SheetText(
                id=uuid4(),
                sheet_id=sheet_id,
                page_index=page_index,
                text=entry.text,
                bbox_x0=entry.bbox_x0,
                bbox_y0=entry.bbox_y0,
                bbox_x1=entry.bbox_x1,
                bbox_y1=entry.bbox_y1,
                source=entry.source,
            )
        )

    for block in result.blocks:
        session.add(
            SheetTextBlock(
                id=uuid4(),
                sheet_id=sheet_id,
                text=block.text,
                bbox_x=block.bbox_x,
                bbox_y=block.bbox_y,
                bbox_w=block.bbox_w,
                bbox_h=block.bbox_h,
            )
        )


def _extract_page_text(page: fitz.Page, page_index: int, *, zoom: float) -> PageExtractionResult:
    native_entries, native_blocks = _extract_native_text(page)
    if native_entries:
        return PageExtractionResult(
            page_index=page_index,
            source="native",
            entries=native_entries,
            blocks=native_blocks,
        )

    ocr_entries, ocr_blocks = _extract_ocr_text(page, zoom=zoom)
    return PageExtractionResult(
        page_index=page_index,
        source="ocr",
        entries=ocr_entries,
        blocks=ocr_blocks,
    )


def _extract_native_text(page: fitz.Page) -> tuple[list[ExtractedTextEntry], list[ExtractedTextBlock]]:
    entries: list[ExtractedTextEntry] = []
    blocks: list[ExtractedTextBlock] = []
    text_dict = cast(dict[str, Any], page.get_text("dict"))

    for block in text_dict.get("blocks", []):
        if not isinstance(block, dict):
            continue
        if block.get("type") != 0:
            continue

        block_lines: list[str] = []
        for line in block.get("lines", []):
            if not isinstance(line, dict):
                continue
            line_text = "".join(span.get("text", "") for span in line.get("spans", []))
            if line_text.strip():
                block_lines.append(line_text.strip())

            for span in line.get("spans", []):
                if not isinstance(span, dict):
                    continue
                text = span.get("text", "").strip()
                if not text:
                    continue
                x0, y0, x1, y1 = (float(value) for value in span.get("bbox", (0, 0, 0, 0)))
                entries.append(
                    ExtractedTextEntry(
                        text=text,
                        bbox_x0=x0,
                        bbox_y0=y0,
                        bbox_x1=x1,
                        bbox_y1=y1,
                        source="native",
                    )
                )

        block_text = "\n".join(block_lines).strip()
        if block_text:
            x0, y0, x1, y1 = (float(value) for value in block.get("bbox", (0, 0, 0, 0)))
            blocks.append(
                ExtractedTextBlock(
                    text=block_text,
                    bbox_x=x0,
                    bbox_y=y0,
                    bbox_w=max(0.0, x1 - x0),
                    bbox_h=max(0.0, y1 - y0),
                )
            )

    return entries, blocks


def _extract_ocr_text(page: fitz.Page, *, zoom: float) -> tuple[list[ExtractedTextEntry], list[ExtractedTextBlock]]:
    from PIL import Image

    pixmap = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
    image = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
    data = cast(dict[str, list[Any]], pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT))

    entries: list[ExtractedTextEntry] = []
    blocks_by_key: dict[tuple[int, int, int], list[ExtractedTextEntry]] = {}
    scale = 1.0 / zoom

    for index, raw_text in enumerate(data.get("text", [])):
        text = raw_text.strip()
        conf = str(data.get("conf", [""])[index]).strip()
        if not text or conf in {"", "-1"}:
            continue

        left = float(data["left"][index]) * scale
        top = float(data["top"][index]) * scale
        width = float(data["width"][index]) * scale
        height = float(data["height"][index]) * scale
        entry = ExtractedTextEntry(
            text=text,
            bbox_x0=left,
            bbox_y0=top,
            bbox_x1=left + width,
            bbox_y1=top + height,
            source="ocr",
        )
        entries.append(entry)

        block_key = (
            int(data["block_num"][index]),
            int(data["par_num"][index]),
            int(data["line_num"][index]),
        )
        blocks_by_key.setdefault(block_key, []).append(entry)

    blocks = [_merge_block_entries(group) for group in blocks_by_key.values() if group]
    return entries, blocks


def _merge_block_entries(entries: list[ExtractedTextEntry]) -> ExtractedTextBlock:
    x0 = min(entry.bbox_x0 for entry in entries)
    y0 = min(entry.bbox_y0 for entry in entries)
    x1 = max(entry.bbox_x1 for entry in entries)
    y1 = max(entry.bbox_y1 for entry in entries)
    text = " ".join(entry.text for entry in entries).strip()
    return ExtractedTextBlock(
        text=text,
        bbox_x=x0,
        bbox_y=y0,
        bbox_w=max(0.0, x1 - x0),
        bbox_h=max(0.0, y1 - y0),
    )
