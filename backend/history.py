# backend/history.py
import json
import threading
from datetime import datetime
from pathlib import Path

from backend.config import DATA_DIR


class History:
    def __init__(self, path=None):
        self.path = Path(path) if path else DATA_DIR / "history.json"
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()

    def _load(self):
        if not self.path.exists():
            return []
        try:
            with open(self.path, encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            return []

    def add(self, record: dict):
        with self._lock:
            data = self._load()
            record["date"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            data.append(record)
            with open(self.path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

    def all(self):
        with self._lock:
            return self._load()

    def clear(self):
        with self._lock:
            with open(self.path, "w", encoding="utf-8") as f:
                json.dump([], f)