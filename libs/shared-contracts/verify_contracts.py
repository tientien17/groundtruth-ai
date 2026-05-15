import json
from pathlib import Path

from python.shared_contracts.models import CORE_TABLES, PROJECT_FOLDER_SCHEMA


ROOT = Path(__file__).resolve().parent
SCHEMA = json.loads((ROOT / "schema.json").read_text(encoding="utf-8"))


def main() -> None:
    defs = SCHEMA["$defs"]
    folder = defs["ProjectFolderSchema"]["properties"]
    schema_folder = {
        "extension": folder["extension"]["const"],
        "requiredPaths": folder["requiredPaths"]["const"],
        "alternativePaths": folder["alternativePaths"]["const"],
    }
    schema_tables = defs["ApiContract"]["properties"]["models"]["const"]

    assert PROJECT_FOLDER_SCHEMA == schema_folder
    assert CORE_TABLES == schema_tables


if __name__ == "__main__":
    main()
