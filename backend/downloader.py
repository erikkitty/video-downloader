# backend/downloader.py
import logging
import shutil
from pathlib import Path

import yt_dlp

from backend.utils import clean_error, sanitize_filename

log = logging.getLogger(__name__)


class CancelledError(Exception):
    
    class VideoDownloader:
        def __init__(self, cfg: dict):
            self.cfg = cfg

    @staticmethod
    def ffmpeg_installed() -> bool:
        return bool(shutil.which("ffmpeg"))

    def get_info(self, url: str, cookies_from_browser: str | None = None):
        opts = {
            "quiet": True,
            "noplaylist": True,
            "remote_components": "ejs:github",
        }
        if cookies_from_browser:
            opts["cookiesfrombrowser"] = (cookies_from_browser,)
        with yt_dlp.YoutubeDL(opts) as ydl:
            return ydl.extract_info(url, download=False)

    @staticmethod
    def available_heights(info: dict) -> list:
        heights = {f.get("height") for f in info.get("formats", []) if f.get("height")}
        return sorted(heights, reverse=True)

    @staticmethod
    def build_format(height=None, audio_only=False) -> str:
        if audio_only:
            return "bestaudio/best"
        video = "bv*"
        audio = "ba"
        fallback = "b"
        if height:
            video += f"[height<={height}]"
            fallback += f"[height<={height}]"
        return f"{video}+{audio}/{fallback}"

    @staticmethod
    def latest_file(out_dir):
        p = Path(out_dir)
        files = [f for f in p.iterdir() if f.is_file()]
        return max(files, key=lambda f: f.stat().st_mtime) if files else None

    def _build_outtmpl(self, out_dir: Path, template: str) -> str:
        for key, value in {
            "{title}": "%(title)s",
            "{id}": "%(id)s",
            "{height}": "%(height)s",
            "{date}": "%(upload_date)s",
        }.items():
            template = template.replace(key, value)
        return str(out_dir / f"{template}.%(ext)s")

    def download(
        self,
        url,
        output_dir,
        format_str,
        container=None,
        audio_only=False,
        filename=None,
        progress_cb=None,
        cancel_check=None,
        cookies_from_browser: str | None = None,
    ):
        out = Path(output_dir)
        out.mkdir(parents=True, exist_ok=True)

        free_mb = shutil.disk_usage(out).free // (1024 * 1024)
        if free_mb < 200:
            return {
                "status": "error",
                "message": f"Недостаточно места на диске (свободно {free_mb} МБ)",
            }

        if filename:
            safe = sanitize_filename(filename).replace("%", "%%")
            outtmpl = str(out / f"{safe}.%(ext)s")
        else:
            outtmpl = self._build_outtmpl(out, "{title} [{id}]")

        opts = {
            "format": format_str,
            "merge_output_format": container,
            "outtmpl": outtmpl,
            "noplaylist": True,
            "retries": 5,
            "fragment_retries": 5,
            "socket_timeout": 30,
            "quiet": True,
            "no_warnings": True,
            "remote_components": "ejs:github",
        }
        if cookies_from_browser:
            opts["cookiesfrombrowser"] = (cookies_from_browser,)
        if self.cfg.get("skip_existing"):
            opts["nooverwrites"] = True

        postprocessors = []
        if audio_only:
            postprocessors.append({"key": "FFmpegExtractAudio", "preferredcodec": "mp3"})
        if self.cfg.get("embed_metadata"):
            postprocessors.append({"key": "FFmpegMetadata"})
        if self.cfg.get("subtitles"):
            opts["writesubtitles"] = True
            opts["subtitleslangs"] = [
                s.strip()
                for s in str(self.cfg.get("subtitle_langs", "ru,en")).split(",")
                if s.strip()
            ]
            postprocessors.append({"key": "FFmpegEmbedSubtitle"})
        if self.cfg.get("embed_thumbnail"):
            opts["writethumbnail"] = True
            postprocessors.append({"key": "EmbedThumbnail", "when": "after_move"})
        if postprocessors:
            opts["postprocessors"] = postprocessors

        def hook(d):
            if cancel_check and cancel_check():
                raise CancelledError()
            if progress_cb:
                progress_cb(d)

        opts["progress_hooks"] = [hook]

        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                ydl.download([url])
            return {"status": "done"}
        except CancelledError:
            return {"status": "cancelled"}
        except yt_dlp.utils.DownloadError as e:
            if cancel_check and cancel_check():
                return {"status": "cancelled"}
            return {"status": "error", "message": clean_error(str(e))}
        except PermissionError:
            return {"status": "error", "message": f"Нет прав на запись в папку {out}"}