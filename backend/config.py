# backend/config.py
import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
CONFIG_PATH = DATA_DIR / "config.json"

DEFAULT_CONFIG = {
    "output_dir": str(Path.home() / "Downloads"),
    "container": "mp4",
    "cookies_from_browser": None,
    "subtitles": False,
    "subtitle_langs": "ru,en",
    "embed_metadata": True,
    "embed_thumbnail": False,
    "skip_existing": False,
}


def ensure_dirs() -> None:
    (DATA_DIR / "logs").mkdir(parents=True, exist_ok=True)


def load_config() -> dict:
    cfg = DEFAULT_CONFIG.copy()
    if not CONFIG_PATH.exists():
        save_config(cfg)
        return cfg
    try:
        with open(CONFIG_PATH, encoding="utf-8") as f:
            cfg.update(json.load(f))
    except json.JSONDecodeError:
        print("⚠ config.json повреждён — использую настройки по умолчанию")
    return cfg


def save_config(cfg: dict) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)