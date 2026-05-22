import asyncio
import os
import shutil
import tempfile
import uuid
from pathlib import Path

import httpx

from app.config import settings


def _escape_subtitle_path(path: str) -> str:
    """Escape a filesystem path for use inside FFmpeg's subtitles= filter.

    FFmpeg's filter option-value parser uses ':' as an option separator, so a
    Windows path like ``D:\\work\\sub.srt`` must become ``D\\:/work/sub.srt``
    before it can be embedded in a filtergraph. Forward slashes are accepted
    on Windows by FFmpeg and avoid the double-escape ambiguity that backslashes
    introduce inside filter strings.
    """
    p = os.path.abspath(path).replace("\\", "/")
    # Escape the drive-letter colon (and any other ':') for the option parser.
    p = p.replace(":", r"\:")
    return p


def _check_ffmpeg() -> None:
    """Raise a clear error early if the ffmpeg binary is not found."""
    if not shutil.which(settings.FFMPEG_BIN):
        raise FileNotFoundError(
            f"FFmpeg binary '{settings.FFMPEG_BIN}' not found in PATH. "
            "Install FFmpeg (https://ffmpeg.org/download.html) or set FFMPEG_BIN in .env "
            "to the full path of the ffmpeg executable."
        )


async def _run_subprocess(cmd: list[str]) -> tuple[bytes, bytes]:
    """Run a subprocess with a clear error if the binary is not found."""
    try:
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
    except FileNotFoundError:
        raise FileNotFoundError(
            f"Binary not found: '{cmd[0]}'. "
            "Install FFmpeg (https://ffmpeg.org/download.html) or set "
            "FFMPEG_BIN / FFPROBE_BIN in .env to the full path."
        )
    return await process.communicate()


class FFmpegService:
    def __init__(self):
        self.work_dir = Path(settings.MEDIA_WORK_DIR)
        self.work_dir.mkdir(parents=True, exist_ok=True)
        _check_ffmpeg()

    async def download_to_work_dir(self, url: str) -> str:
        """Download a file from URL to a temp location and return the local path."""
        async with httpx.AsyncClient(timeout=300.0, follow_redirects=True) as client:
            response = await client.get(url)
            response.raise_for_status()

        suffix = ".mp4" if "video" in response.headers.get("content-type", "") else ".png"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False, dir=str(self.work_dir)) as f:
            f.write(response.content)
            return f.name

    async def create_silent_video_from_image(self, image_path: str, duration: float, output_path: str):
        """Create a still-frame video segment from an image."""
        cmd = [
            settings.FFMPEG_BIN, "-y",
            "-loop", "1", "-i", image_path,
            "-c:v", "libx264", "-t", str(duration),
            "-pix_fmt", "yuv420p", "-r", "30",
            output_path,
        ]
        _, stderr = await _run_subprocess(cmd)
        if stderr and b"Error" in stderr:
            raise RuntimeError(f"FFmpeg image-to-video failed: {stderr.decode()}")

    async def compose_video(
        self,
        video_clips: list[str],
        srt_path: str,
        voiceover_path: str,
        output_path: str,
        bgm_path: str | None = None,
        width: int = 1080,
        height: int = 1920,
        fps: int = 30,
    ) -> str:
        cmd = [
            settings.FFMPEG_BIN, "-y",
            "-f", "concat", "-safe", "0", "-i", self._concat_list(video_clips),
            "-i", voiceover_path,
        ]

        filter_parts = []
        filter_parts.append(
            f"[0:v]scale={width}:{height}:force_original_aspect_ratio=decrease,"
            f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2[v]"
        )

        if os.path.exists(srt_path):
            # The subtitles= filter is finicky on Windows: the filtergraph
            # parser treats ':' as an option separator and would otherwise
            # chop the drive letter off the path. Empirically, the ONLY combo
            # FFmpeg accepts on Windows is:
            #   subtitles='D\:/full/forward/slash/path.srt'
            # i.e. forward slashes throughout, the drive-letter colon escaped
            # as '\:', and the whole value wrapped in single quotes so the
            # filtergraph parser hands the escaped value to libavfilter intact.
            escaped_srt = _escape_subtitle_path(srt_path)
            subtitle_filter = (
                f"subtitles='{escaped_srt}':"
                f"force_style='FontSize=24,PrimaryColour=&H00FFFFFF,"
                f"OutlineColour=&H00000000,BorderStyle=1,Outline=1,Shadow=1,"
                f"Alignment=2'"
            )
            filter_parts.append(f"[v]{subtitle_filter},fps={fps}[vout]")
        else:
            filter_parts.append(f"[v]fps={fps}[vout]")

        cmd.extend(["-filter_complex", ";".join(filter_parts)])

        cmd.extend(["-map", "[vout]"])
        cmd.extend(["-map", "1:a"])

        cmd.extend([
            "-c:v", "libx264", "-preset", "medium", "-crf", "23",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "192k",
            "-movflags", "+faststart",
            output_path,
        ])

        _, stderr = await _run_subprocess(cmd)
        if stderr and b"Error" in stderr:
            raise RuntimeError(f"FFmpeg failed: {stderr.decode()}")

        return output_path

    def _concat_list(self, clips: list[str]) -> str:
        concat_file = self.work_dir / f"concat_{uuid.uuid4().hex[:8]}.txt"
        concat_file.write_text("\n".join(f"file '{c}'" for c in clips))
        return str(concat_file)

    async def probe(self, file_path: str) -> dict:
        cmd = [
            settings.FFPROBE_BIN, "-v", "quiet", "-print_format", "json",
            "-show_format", "-show_streams", file_path,
        ]
        stdout, _ = await _run_subprocess(cmd)
        import json
        return json.loads(stdout)
