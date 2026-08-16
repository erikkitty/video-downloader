# backend/main.py
import asyncio
import logging
import os
import platform
import subprocess
import threading
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.config import (
    DATA_DIR,
    DEFAULT_CONFIG,
    ensure_dirs,
    load_config,
    save_config,
)
from backend.downloader import VideoDownloader
from backend.history import History
from backend.utils import clean_error, is_valid_url

log = logging.getLogger(__name__)

QUALITY_VALUES = ["Максимальное", "2160p", "1440p", "1080p", "720p", "480p", "360p"]


class Broadcaster:
    def __init__(self):
        self.clients: set[asyncio.Queue] = set()
        self.loop: asyncio.AbstractEventLoop | None = None

    async def connect(self, ws: WebSocket):
        q: asyncio.Queue = asyncio.Queue()
        self.clients.add(q)
        try:
            while True:
                await ws.send_json(await q.get())
        except WebSocketDisconnect:
            pass
        finally:
            self.clients.discard(q)

    def emit(self, event: dict):
        if self.loop is None:
            return
        for q in list(self.clients):
            asyncio.run_coroutine_threadsafe(q.put(event), self.loop)


broadcaster = Broadcaster()


class ProgressAggregator:
    def __init__(self):
        self.streams: dict[str, tuple[int, int]] = {}

    def update(self, d: dict) -> dict:
        name = d.get("filename") or "file"
        if d.get("status") == "finished":
            down, total = self.streams.get(name, (0, 0))
            self.streams[name] = (total or down, total or down)
            return {"type": "progress", "merging": True, "percent": 1.0}
        downloaded = d.get("downloaded_bytes") or 0
        total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
        self.streams[name] = (downloaded, total)
        sum_down = sum(v[0] for v in self.streams.values())
        sum_total = sum(v[1] for v in self.streams.values())
        return {
            "type": "progress",
            "merging": False,
            "percent": min(sum_down / sum_total, 1.0) if sum_total else None,
            "downloaded": sum_down,
            "total": sum_total or None,
            "speed": d.get("speed") or 0,
            "eta": d.get("eta") or 0,
        }


class Session:
    def __init__(self):
        self.busy = False
        self.cancel = threading.Event()
        self.queue_items: list[dict] = []


session = Session()
cfg = load_config()
dl = VideoDownloader(cfg)
history = History()


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_dirs()
    logging.basicConfig(
        filename=str(DATA_DIR / "logs" / "app.log"),
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )
    broadcaster.loop = asyncio.get_running_loop()
    if not VideoDownloader.ffmpeg_installed():
        log.warning("FFmpeg не найден — склейка потоков не сработает")
    yield


app = FastAPI(title="Video Downloader Web", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class DownloadRequest(BaseModel):
    url: str
    quality: str = "Максимальное"
    container: str = "mp4"
    audio_only: bool = False
    filename: str | None = None
    out_dir: str | None = None
    cookies_from_browser: str | None = None


class QueueAdd(BaseModel):
    url: str
    name: str | None = None
    quality: str = "Максимальное"
    cookies_from_browser: str | None = None


class OpenFolderRequest(BaseModel):
    path: str


def _fmt_and_flags(quality: str, audio_only: bool):
    if audio_only:
        return VideoDownloader.build_format(audio_only=True), True
    if quality == "Максимальное":
        return VideoDownloader.build_format(), False
    return VideoDownloader.build_format(height=int(quality.rstrip("p"))), False


def _run_download(url: str, opts: dict) -> dict:
    agg = ProgressAggregator()
    title = url
    cookies = opts.get("cookies_from_browser")
    try:
        info = dl.get_info(url, cookies_from_browser=cookies)
        title = (info or {}).get("title") or url
    except Exception:
        pass

    fmt, audio_only = _fmt_and_flags(opts["quality"], opts["audio_only"])
    result = dl.download(
        url=url,
        output_dir=opts["out_dir"],
        format_str=fmt,
        container=None if opts["container"] == "original" else opts["container"],
        audio_only=audio_only,
        filename=opts.get("filename"),
        progress_cb=lambda d: broadcaster.emit(agg.update(d)),
        cancel_check=session.cancel.is_set,
        cookies_from_browser=cookies,
    )

    path = size = None
    if result["status"] == "done":
        newest = VideoDownloader.latest_file(opts["out_dir"])
        if newest:
            path, size = str(newest), newest.stat().st_size
    history.add(
        {
            "url": url,
            "title": title,
            "quality": opts["quality"],
            "container": opts["container"],
            "status": result["status"],
            "path": path,
            "size": size,
        }
    )
    logging.info("%s | %s | %s", result["status"], url, title)
    broadcaster.emit({"type": "status", "url": url, "title": title, **result})
    return result


def _single_worker(req: DownloadRequest):
    try:
        _run_download(
            req.url,
            {
                "quality": req.quality,
                "container": req.container,
                "audio_only": req.audio_only,
                "filename": req.filename,
                "out_dir": req.out_dir or cfg["output_dir"],
                "cookies_from_browser": req.cookies_from_browser
                or cfg.get("cookies_from_browser"),
            },
        )
    finally:
        session.busy = False


def _queue_worker():
    try:
        for item in session.queue_items:
            if session.cancel.is_set():
                break
            if item["status"] not in ("ожидает", "ошибка", "отменено"):
                continue
            item["status"] = "качается"
            broadcaster.emit({"type": "queue"})
            result = _run_download(
                item["url"],
                {
                    "quality": item.get("quality", "Максимальное"),
                    "container": cfg["container"],
                    "audio_only": False,
                    "filename": item.get("name"),
                    "out_dir": cfg["output_dir"],
                    "cookies_from_browser": item.get("cookies_from_browser")
                    or cfg.get("cookies_from_browser"),
                },
            )
            item["status"] = {
                "done": "готово",
                "cancelled": "отменено",
                "error": "ошибка",
            }[result["status"]]
            broadcaster.emit({"type": "queue"})
    finally:
        session.busy = False
        broadcaster.emit({"type": "queue_done"})


@app.get("/api/info")
async def api_info(url: str, cookies_from_browser: str | None = None):
    if not is_valid_url(url):
        raise HTTPException(400, "Некорректный URL")
    cookies = cookies_from_browser or cfg.get("cookies_from_browser")
    try:
        data = await asyncio.to_thread(dl.get_info, url, cookies)
    except Exception as e:
        raise HTTPException(502, clean_error(str(e)))
    return {
        "title": data.get("title"),
        "duration": data.get("duration"),
        "heights": VideoDownloader.available_heights(data),
        "formats_count": len(data.get("formats", [])),
    }


@app.post("/api/download")
async def api_download(req: DownloadRequest):
    if session.busy:
        raise HTTPException(409, "Уже идёт скачивание")
    if not is_valid_url(req.url):
        raise HTTPException(400, "Некорректный URL")
    if req.quality not in QUALITY_VALUES:
        raise HTTPException(400, "Некорректное качество")
    session.busy = True
    session.cancel.clear()
    threading.Thread(target=_single_worker, args=(req,), daemon=True).start()
    return {"status": "started"}


@app.post("/api/cancel")
async def api_cancel():
    session.cancel.set()
    return {"status": "cancelling"}


@app.get("/api/queue")
async def api_queue():
    return {"items": session.queue_items, "busy": session.busy}


@app.post("/api/queue/add")
async def api_queue_add(req: QueueAdd):
    if not is_valid_url(req.url):
        raise HTTPException(400, "Некорректный URL")
    session.queue_items.append(
        {
            "url": req.url,
            "name": req.name,
            "quality": req.quality,
            "status": "ожидает",
            "cookies_from_browser": req.cookies_from_browser,
        }
    )
    broadcaster.emit({"type": "queue"})
    return {"status": "added"}


@app.post("/api/queue/start")
async def api_queue_start():
    if session.busy:
        raise HTTPException(409, "Уже идёт скачивание")
    pending = [
        i for i in session.queue_items if i["status"] in ("ожидает", "ошибка", "отменено")
    ]
    if not pending:
        raise HTTPException(400, "Очередь пуста")
    session.busy = True
    session.cancel.clear()
    threading.Thread(target=_queue_worker, daemon=True).start()
    return {"status": "started"}


@app.post("/api/queue/clear")
async def api_queue_clear():
    session.queue_items = [i for i in session.queue_items if i["status"] == "качается"]
    broadcaster.emit({"type": "queue"})
    return {"status": "cleared"}


@app.delete("/api/queue/{index}")
async def api_queue_remove(index: int):
    if 0 <= index < len(session.queue_items):
        session.queue_items.pop(index)
        broadcaster.emit({"type": "queue"})
        return {"status": "removed"}
    raise HTTPException(404, "Нет такого элемента")


@app.get("/api/history")
async def api_history():
    return {"items": history.all()}


@app.post("/api/history/clear")
async def api_history_clear():
    history.clear()
    return {"status": "cleared"}


@app.get("/api/settings")
async def api_settings():
    return cfg


@app.put("/api/settings")
async def api_settings_put(patch: dict):
    for key, value in patch.items():
        if key in DEFAULT_CONFIG:
            cfg[key] = value
    save_config(cfg)
    return cfg


@app.post("/api/open-folder")
async def api_open_folder(req: OpenFolderRequest):
    p = Path(req.path)
    if not p.exists():
        raise HTTPException(400, "Папка не существует")
    system = platform.system()
    if system == "Darwin":
        subprocess.run(["open", str(p)], check=False)
    elif system == "Windows":
        os.startfile(str(p))
    else:
        subprocess.run(["xdg-open", str(p)], check=False)
    return {"status": "opened"}


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    await broadcaster.connect(ws)