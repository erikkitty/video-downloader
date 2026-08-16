# backend/utils.py
import re
from urllib.parse import urlparse

ANSI_ESCAPE = re.compile(r"\x1b\[[0-9;]*[a-zA-Z]")


def is_valid_url(url: str) -> bool:
    try:
        result = urlparse(url)
        return all([result.scheme in ("http", "https"), result.netloc])
    except ValueError:
        return False


def sanitize_filename(name: str) -> str:
    return re.sub(r'[\\/*?:"<>|]', "_", name).strip()


def clean_error(message: str) -> str:
    return ANSI_ESCAPE.sub("", message).strip()