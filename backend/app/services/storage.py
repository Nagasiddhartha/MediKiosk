import hashlib
import uuid
from pathlib import Path

from app.core.config import settings


ALLOWED_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".tiff",
    ".tif",
    ".pdf",
    ".txt",
}


def allowed_filename(filename: str | None) -> bool:
    if not filename:
        return False

    suffix = Path(filename).suffix.lower()
    return suffix in ALLOWED_EXTENSIONS


def ensure_storage_root() -> Path:
    root = Path(settings.storage_root)
    root.mkdir(parents=True, exist_ok=True)
    return root


def store_upload(
    user_id: uuid.UUID,
    filename: str,
    content: bytes,
) -> tuple[str, str, str]:
    root = ensure_storage_root()

    file_hash = hashlib.sha256(content).hexdigest()
    extension = Path(filename).suffix.lower()
    stored_name = f"{uuid.uuid4()}{extension}"

    user_dir = root / str(user_id)
    user_dir.mkdir(parents=True, exist_ok=True)

    file_path = user_dir / stored_name
    file_path.write_bytes(content)

    return str(file_path), file_hash, extension