import asyncio
import json
import subprocess
import tempfile
import textwrap
from pathlib import Path

import edge_tts
import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont

ROOT_DIR = Path(__file__).resolve().parent.parent
ASSETS_DIR = ROOT_DIR / "assets"
DASHBOARD_SRC = Path(
    r"C:\Users\SYDEAR\.gemini\antigravity\brain\9ec65af2-0183-4f2f-84a6-fee6ac756389\.system_generated\steps\1503\media_0.png"
)

FONT_BOLD = r"C:\Windows\Fonts\segoeuib.ttf"
FONT_REG = r"C:\Windows\Fonts\segoeui.ttf"
FONT_MONO_BOLD = r"C:\Windows\Fonts\consolab.ttf"

VOICE = "en-US-ChristopherNeural"
FFMPEG_EXE = imageio_ffmpeg.get_ffmpeg_exe()

SCENES = [
    {
        "id": 1,
        "badge": "01 / 06  ·  THE PRIVACY PARADOX",
        "title": "AI Assistants Shouldn't Cost You Your Secrets",
        "image": "safepaste-thumbnail.png",
        "highlight": None,
        "narration": (
            "Every day, developers and professionals paste API keys, database passwords, "
            "financial figures, and confidential client names into cloud AI assistants. "
            "Traditional regex filters miss contextual secrets, while cloud scrubbers expose raw data before it can be masked. "
            "Meet SafePaste AI — Your Private Gateway to AI, built for Google Firebase BuildHybridAI 2026."
        ),
        "subtitle": (
            "Meet SafePaste AI — Your Private Gateway to AI. Built with Gemini Nano + Firebase AI Logic "
            "so sensitive keys, PII, and business deals never leave your browser raw."
        ),
    },
    {
        "id": 2,
        "badge": "02 / 06  ·  HYBRID ARCHITECTURE",
        "title": "Firebase AI Logic + Gemini Nano + App Check",
        "image": "safepaste-architecture.png",
        "highlight": None,
        "narration": (
            "SafePaste AI is powered by the official Firebase AI Logic Web SDK, "
            "combining Chrome's built-in Gemini Nano with Gemini 3.8 Flash in the cloud, "
            "secured by Firebase App Check and Firebase Remote Config."
        ),
        "subtitle": (
            "Official firebase/ai Web SDK orchestrates local Gemini Nano (ONLY_ON_DEVICE) "
            "and Cloud Gemini 3.8 Flash (PREFER_ON_DEVICE), protected by Firebase App Check & Remote Config."
        ),
    },
    {
        "id": 3,
        "badge": "03 / 06  ·  STAGE 1 & 2: ON-DEVICE SANITIZATION",
        "title": "Deterministic Regex + Gemini Nano (ONLY_ON_DEVICE)",
        "image": "screen-cloud-workspace.png",
        "highlight": (70, 120, 955, 1015),
        "narration": (
            "In Stages 1 and 2, raw user input is scanned strictly on-device. "
            "Our dual engine pairs sub-millisecond regex and Luhn checksums with Gemini Nano "
            "running in strict ONLY_ON_DEVICE mode — with zero cloud fallback. "
            "Sensitive entities are converted into collision-free SP tokens stored exclusively in browser IndexedDB."
        ),
        "subtitle": (
            "Stages 1 & 2 run 100% locally: Regex (99-100%) + Gemini Nano (ONLY_ON_DEVICE) replace secrets "
            "with collision-free [[SP_*]] tokens stored only in browser IndexedDB."
        ),
    },
    {
        "id": 4,
        "badge": "04 / 06  ·  STAGE 3 & 4: HYBRID AI & REHYDRATION",
        "title": "Sanitized Cloud Inference + Validated Local Restore",
        "image": "screen-cloud-workspace.png",
        "highlight": (970, 230, 1850, 860),
        "narration": (
            "In Stages 3 and 4, only the sanitized prompt containing SP placeholders is passed to "
            "Firebase AI Logic Hybrid Inference using PREFER_ON_DEVICE or ONLY_IN_CLOUD with Gemini 3.8 Flash. "
            "When the AI responds, SafePaste validates every token and rehydrates your original secrets locally on-device."
        ),
        "subtitle": (
            "Stages 3 & 4: Cloud Gemini 3.8 Flash processes ONLY [[SP_*]] tokens via App Check; "
            "SafePaste validates the response and restores real values strictly on-device."
        ),
    },
    {
        "id": 5,
        "badge": "05 / 06  ·  PROVABLE PRIVACY & TELEMETRY",
        "title": "Zero-Leakage Network Inspector & Privacy Dashboard",
        "image": "screen-network-inspector.png",
        "second_image": "screen-privacy-dashboard.png",
        "highlight": None,
        "narration": (
            "For provable privacy, our real-time Zero-Leakage Network Inspector audits every outbound payload "
            "to verify that zero raw secrets ever leave your browser, "
            "while the Privacy Dashboard tracks local containment metrics in IndexedDB without storing raw text."
        ),
        "subtitle": (
            "Zero-Leakage Network Inspector proves 0 raw secrets leave the device, "
            "while IndexedDB Privacy Dashboard audits masked entities without storing user text."
        ),
    },
    {
        "id": 6,
        "badge": "06 / 06  ·  WEB APP + CHROME MV3 EXTENSION",
        "title": "Try SafePaste AI — Smart AI Without Trading Secrets",
        "image": "safepaste-extension-flow.png",
        "highlight": None,
        "narration": (
            "SafePaste AI runs both as a full Web Workspace and as a Chrome Manifest V3 Extension "
            "with one-click Control-Shift-Y inline sanitization and Side Panel integration "
            "across ChatGPT, Claude, and Gemini Web. "
            "Try SafePaste AI today — smart AI without trading away your secrets."
        ),
        "subtitle": (
            "Live at https://techfrontiers.github.io/safepaste/ | Apache-2.0 Open Source: "
            "https://github.com/Techfrontiers/safepaste (Web Workspace + Chrome MV3 Extension)"
        ),
    },
]


def create_privacy_dashboard_crop():
    out = ASSETS_DIR / "screen-privacy-dashboard.png"
    if not DASHBOARD_SRC.exists():
        raise FileNotFoundError(f"Missing dashboard source: {DASHBOARD_SRC}")
    im = Image.open(DASHBOARD_SRC).convert("RGB")
    sw, sh = im.size
    # Bottom half contains the Zero-Leakage Network Inspector tab & Privacy Dashboard panel
    y0 = max(0, int(sh * 0.56))
    crop = im.crop((0, y0, sw, sh))
    crop.thumbnail((1920, 1080), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (1920, 1080), (6, 11, 20))
    canvas.paste(crop, ((1920 - crop.width) // 2, (1080 - crop.height) // 2))
    canvas.save(out, "PNG")
    print("Created:", out, crop.size)


async def synth_audio(out_dir: Path):
    for s in SCENES:
        mp3_path = out_dir / f"scene_{s['id']:02d}.mp3"
        comm = edge_tts.Communicate(s["narration"], VOICE, rate="+4%")
        await comm.save(str(mp3_path))
        print("Synthesized:", mp3_path.name)


def get_duration(media_path: Path) -> float:
    proc = subprocess.run(
        [FFMPEG_EXE, "-i", str(media_path)],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="ignore",
    )
    # Parse Duration: 00:00:18.42
    for line in proc.stderr.splitlines():
        if "Duration:" in line:
            part = line.split("Duration:")[1].split(",")[0].strip()
            h, m, sec = part.split(":")
            return int(h) * 3600 + int(m) * 60 + float(sec)
    return 15.0


def render_slide(scene: dict, out_path: Path):
    W, H = 1920, 1080
    TOP_H = 88
    BOT_H = 128
    VIEW_H = H - TOP_H - BOT_H  # 864 px crisp viewport region

    canvas = Image.new("RGBA", (W, H), (6, 11, 20, 255))
    d = ImageDraw.Draw(canvas)

    # Top sleek header bar
    d.rectangle([(0, 0), (W, TOP_H)], fill=(11, 18, 32, 255))
    d.line([(0, TOP_H), (W, TOP_H)], fill=(30, 41, 59, 255), width=2)

    font_badge = ImageFont.truetype(FONT_MONO_BOLD, 19)
    font_title = ImageFont.truetype(FONT_BOLD, 28)
    font_sub = ImageFont.truetype(FONT_REG, 27)
    font_brand = ImageFont.truetype(FONT_MONO_BOLD, 18)

    # Scene badge
    bw = int(d.textlength(scene["badge"], font=font_badge)) + 32
    d.rounded_rectangle([(32, 20), (32 + bw, 68)], radius=10, fill=(11, 38, 36), outline=(16, 185, 129), width=2)
    d.text((32 + bw // 2, 44), scene["badge"], font=font_badge, fill=(110, 231, 183), anchor="mm")

    # Title
    d.text((32 + bw + 26, 44), scene["title"], font=font_title, fill=(248, 250, 252), anchor="lm")

    # Right brand pill
    d.rounded_rectangle([(W - 312, 20), (W - 32, 68)], radius=10, fill=(15, 23, 42), outline=(51, 65, 85), width=2)
    d.text((W - 172, 44), "SafePaste AI · Hybrid", font=font_brand, fill=(148, 163, 184), anchor="mm")

    # Content region
    if "second_image" in scene:
        im1 = Image.open(ASSETS_DIR / scene["image"]).convert("RGBA")
        im2 = Image.open(ASSETS_DIR / scene["second_image"]).convert("RGBA")
        panel_w = (W - 72) // 2
        im1.thumbnail((panel_w, VIEW_H - 24), Image.Resampling.LANCZOS)
        im2.thumbnail((panel_w, VIEW_H - 24), Image.Resampling.LANCZOS)
        y1 = TOP_H + (VIEW_H - im1.height) // 2
        y2 = TOP_H + (VIEW_H - im2.height) // 2
        x1 = 24 + (panel_w - im1.width) // 2
        x2 = 48 + panel_w + (panel_w - im2.width) // 2
        canvas.alpha_composite(im1, (x1, y1))
        canvas.alpha_composite(im2, (x2, y2))
        d.rounded_rectangle([(x1 - 2, y1 - 2), (x1 + im1.width + 2, y1 + im1.height + 2)], radius=12, outline=(16, 185, 129), width=3)
        d.rounded_rectangle([(x2 - 2, y2 - 2), (x2 + im2.width + 2, y2 + im2.height + 2)], radius=12, outline=(56, 189, 248), width=3)
    else:
        im = Image.open(ASSETS_DIR / scene["image"]).convert("RGBA")
        # Scale proportionally to fit within W-48 x VIEW_H-16
        scale = min((W - 48) / im.width, (VIEW_H - 16) / im.height)
        nw, nh = int(im.width * scale), int(im.height * scale)
        im_r = im.resize((nw, nh), Image.Resampling.LANCZOS)
        ox = (W - nw) // 2
        oy = TOP_H + (VIEW_H - nh) // 2
        canvas.alpha_composite(im_r, (ox, oy))

        if scene.get("highlight"):
            hx0, hy0, hx1, hy1 = scene["highlight"]
            # Map highlight box from original 1920x1080 coordinate space into placed screenshot
            sx0 = ox + int(hx0 * (nw / 1920.0))
            sy0 = oy + int(hy0 * (nh / 1080.0))
            sx1 = ox + int(hx1 * (nw / 1920.0))
            sy1 = oy + int(hy1 * (nh / 1080.0))
            d.rounded_rectangle([(sx0, sy0), (sx1, sy1)], radius=18, outline=(16, 185, 129), width=6)

    # Bottom subtitle bar
    by0 = H - BOT_H
    d.rectangle([(0, by0), (W, H)], fill=(8, 13, 24, 248))
    d.line([(0, by0), (W, by0)], fill=(16, 185, 129, 180), width=3)

    lines = textwrap.wrap(scene["subtitle"], width=94)[:2]
    if len(lines) == 1:
        d.text((W // 2, by0 + BOT_H // 2), lines[0], font=font_sub, fill=(248, 250, 252), anchor="mm")
    else:
        d.text((W // 2, by0 + 42), lines[0], font=font_sub, fill=(248, 250, 252), anchor="mm")
        d.text((W // 2, by0 + 84), lines[1], font=font_sub, fill=(248, 250, 252), anchor="mm")

    canvas.convert("RGB").save(out_path, "PNG")


def build_video():
    create_privacy_dashboard_crop()
    out_video = ASSETS_DIR / "safepaste-demo.mp4"

    with tempfile.TemporaryDirectory() as tmp:
        tmp_dir = Path(tmp)
        asyncio.run(synth_audio(tmp_dir))

        seg_files = []
        total_dur = 0.0
        for s in SCENES:
            mp3_path = tmp_dir / f"scene_{s['id']:02d}.mp3"
            dur = get_duration(mp3_path)
            total_dur += dur + 0.4
            slide_png = tmp_dir / f"slide_{s['id']:02d}.png"
            seg_mp4 = tmp_dir / f"seg_{s['id']:02d}.mp4"
            render_slide(s, slide_png)

            cmd = [
                FFMPEG_EXE,
                "-y",
                "-loop", "1",
                "-i", str(slide_png),
                "-i", str(mp3_path),
                "-c:v", "libx264",
                "-tune", "stillimage",
                "-pix_fmt", "yuv420p",
                "-r", "30",
                "-c:a", "aac",
                "-b:a", "192k",
                "-af", "apad",
                "-t", f"{dur + 0.45:.3f}",
                str(seg_mp4),
            ]
            subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            seg_files.append(seg_mp4)
            print(f"Encoded scene {s['id']}: {dur:.2f}s")

        concat_txt = tmp_dir / "concat.txt"
        concat_txt.write_text("\n".join(f"file '{p.as_posix()}'" for p in seg_files), encoding="utf-8")

        subprocess.run(
            [
                FFMPEG_EXE,
                "-y",
                "-f", "concat",
                "-safe", "0",
                "-i", str(concat_txt),
                "-c", "copy",
                str(out_video),
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

    final_dur = get_duration(out_video)
    size_mb = out_video.stat().st_size / (1024 * 1024)
    print(json.dumps({
        "output": str(out_video),
        "duration_sec": round(final_dur, 2),
        "size_mb": round(size_mb, 2),
        "under_3min": final_dur < 180.0,
    }))


if __name__ == "__main__":
    build_video()
