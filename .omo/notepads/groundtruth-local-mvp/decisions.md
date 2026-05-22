
- Shared contracts live under libs/shared-contracts with schema.json as source of truth, mirrored TypeScript DTOs, dependency-free Python DTOs, canonical .gtl folder schema, API envelope, and drift verifier.

- T9 uses native-first PDF extraction via PyMuPDF spans/blocks, with OCR fallback via pytesseract only when no native text exists on page. Coordinates stored in PDF points by scaling OCR image coordinates back by render zoom.
