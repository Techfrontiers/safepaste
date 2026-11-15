from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ASSETS_DIR = Path(__file__).resolve().parent.parent / "assets"
ASSETS_DIR.mkdir(parents=True, exist_ok=True)

FONT_BOLD = r"C:\Windows\Fonts\segoeuib.ttf"
FONT_REG = r"C:\Windows\Fonts\segoeui.ttf"
FONT_MONO_BOLD = r"C:\Windows\Fonts\consolab.ttf"
FONT_MONO = r"C:\Windows\Fonts\consola.ttf"


def f_sans(size: int, bold: bool = False):
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REG, size)


def f_mono(size: int, bold: bool = False):
    return ImageFont.truetype(FONT_MONO_BOLD if bold else FONT_MONO, size)


def draw_grid_bg(w: int, h: int, step: int = 48) -> Image.Image:
    img = Image.new("RGBA", (w, h), (6, 11, 20, 255))
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)

    # Subtle radial-like soft glow ellipses
    d.ellipse((-180, -220, w * 0.65, h * 0.72), fill=(16, 185, 129, 28))
    d.ellipse((w * 0.42, h * 0.25, w + 220, h + 260), fill=(6, 182, 212, 24))
    d.ellipse((w * 0.25, h * 0.08, w * 0.85, h * 0.65), fill=(59, 130, 246, 14))

    # Crisp subtle grid
    for x in range(0, w, step):
        d.line([(x, 0), (x, h)], fill=(148, 163, 184, 16), width=1)
    for y in range(0, h, step):
        d.line([(0, y), (w, y)], fill=(148, 163, 184, 16), width=1)

    return Image.alpha_composite(img, overlay).convert("RGB")


def draw_round_box(d: ImageDraw.ImageDraw, xy, radius, fill, outline=None, width=2):
    d.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def draw_shield(d: ImageDraw.ImageDraw, cx: int, cy: int, scale: float = 1.0):
    pts = [
        (cx, cy - 58 * scale),
        (cx + 48 * scale, cy - 38 * scale),
        (cx + 44 * scale, cy + 12 * scale),
        (cx, cy + 56 * scale),
        (cx - 44 * scale, cy + 12 * scale),
        (cx - 48 * scale, cy - 38 * scale),
    ]
    d.polygon(pts, fill=(13, 37, 42), outline=(16, 185, 129))
    inner = [
        (cx, cy - 42 * scale),
        (cx + 34 * scale, cy - 27 * scale),
        (cx + 31 * scale, cy + 8 * scale),
        (cx, cy + 40 * scale),
        (cx - 31 * scale, cy + 8 * scale),
        (cx - 34 * scale, cy - 27 * scale),
    ]
    d.polygon(inner, fill=(16, 185, 129), outline=(110, 231, 183))
    # Lock keyhole / check mark inside shield
    d.line(
        [
            (cx - 14 * scale, cy - 1 * scale),
            (cx - 3 * scale, cy + 11 * scale),
            (cx + 18 * scale, cy - 12 * scale),
        ],
        fill=(6, 11, 20),
        width=max(4, int(6 * scale)),
    )


def build_thumbnail():
    w, h = 1200, 800
    img = draw_grid_bg(w, h, step=40)
    d = ImageDraw.Draw(img)

    # Outer sleek frame
    draw_round_box(d, (28, 28, w - 28, h - 28), 28, fill=None, outline=(30, 41, 59), width=2)

    # Top badge
    badge_text = "GOOGLE FIREBASE  #BUILDHYBRIDAI 2026"
    font_badge = f_mono(18, bold=True)
    bw = d.textlength(badge_text, font=font_badge) + 44
    bx0 = (w - bw) // 2
    draw_round_box(d, (bx0, 62, bx0 + bw, 104), 21, fill=(16, 42, 46), outline=(16, 185, 129), width=2)
    d.text((w // 2, 83), badge_text, font=font_badge, fill=(110, 231, 183), anchor="mm")

    # Shield icon
    draw_shield(d, w // 2, 205, scale=1.15)

    # Title & Tagline
    d.text((w // 2, 315), "SafePaste AI", font=f_sans(74, bold=True), fill=(248, 250, 252), anchor="mm")
    d.text(
        (w // 2, 378),
        "Your Private Gateway to AI  ·  Zero Raw Secret Leakage",
        font=f_sans(28, bold=False),
        fill=(148, 163, 184),
        anchor="mm",
    )

    # Center live transform preview card
    draw_round_box(d, (88, 434, w - 88, 616), 20, fill=(13, 21, 35), outline=(51, 65, 85), width=2)

    # Left raw box
    draw_round_box(d, (112, 456, 528, 594), 14, fill=(30, 18, 28), outline=(244, 63, 94), width=2)
    d.text((132, 474), "RAW PROMPT (STAYS ON-DEVICE)", font=f_mono(15, bold=True), fill=(253, 164, 175))
    d.text((132, 508), "Key: sk-proj-9482aF...", font=f_mono(20, bold=True), fill=(248, 250, 252))
    d.text((132, 540), "Deal: Acme $15.4M · CEO", font=f_mono(20, bold=False), fill=(226, 232, 240))

    # Arrow middle
    d.text((600, 508), "Nano + Regex", font=f_mono(15, bold=True), fill=(16, 185, 129), anchor="mm")
    d.line([(542, 532), (656, 532)], fill=(16, 185, 129), width=4)
    d.polygon([(660, 532), (644, 522), (644, 542)], fill=(16, 185, 129))

    # Right sanitized box
    draw_round_box(d, (672, 456, 1088, 594), 14, fill=(11, 35, 36), outline=(16, 185, 129), width=2)
    d.text((692, 474), "SENT TO FIREBASE AI LOGIC", font=f_mono(15, bold=True), fill=(110, 231, 183))
    d.text((692, 508), "Key: [[SP_API_KEY_01]]", font=f_mono(20, bold=True), fill=(52, 211, 153))
    d.text((692, 540), "Deal: [[SP_ORG_01]] [[SP_MONEY_01]]", font=f_mono(18, bold=False), fill=(167, 243, 208))

    # Bottom feature pills
    pills = [
        ("Gemini Nano", "ONLY_ON_DEVICE Scan", (6, 182, 212)),
        ("Firebase AI Logic", "PREFER_ON_DEVICE + Cloud", (245, 158, 11)),
        ("App Check Active", "Remote Config + IndexedDB", (16, 185, 129)),
        ("Chrome MV3", "Web App + Extension", (139, 92, 246)),
    ]
    px = 88
    pw = 244
    gap = 16
    for title, sub, color in pills:
        draw_round_box(d, (px, 650, px + pw, 738), 14, fill=(15, 23, 42), outline=color, width=2)
        d.text((px + pw // 2, 680), title, font=f_sans(20, bold=True), fill=(248, 250, 252), anchor="mm")
        d.text((px + pw // 2, 712), sub, font=f_mono(13, bold=False), fill=color, anchor="mm")
        px += pw + gap

    out = ASSETS_DIR / "safepaste-thumbnail.png"
    img.save(out, "PNG")
    print("Saved:", out)


def build_architecture():
    w, h = 1920, 1080
    img = draw_grid_bg(w, h, step=48)
    d = ImageDraw.Draw(img)

    # Top title bar
    draw_round_box(d, (48, 36, w - 48, 134), 18, fill=(13, 21, 35), outline=(30, 41, 59), width=2)
    draw_shield(d, 105, 85, scale=0.45)
    d.text((155, 52), "SafePaste AI — 4-Stage Hybrid Privacy Architecture", font=f_sans(30, bold=True), fill=(248, 250, 252))
    d.text((155, 96), "Firebase AI Logic Web SDK (firebase/ai) + Gemini Nano (Chrome Prompt API) + App Check + Remote Config", font=f_mono(16), fill=(52, 211, 153))
    draw_round_box(d, (w - 310, 56, w - 72, 114), 12, fill=(11, 35, 36), outline=(16, 185, 129), width=2)
    d.text((w - 191, 85), "ZERO RAW LEAKAGE", font=f_mono(18, bold=True), fill=(110, 231, 183), anchor="mm")

    # 4 Main Stage Columns
    stages = [
        (
            "STAGE 1",
            "On-Device Privacy Scan",
            "NEVER LEAVES BROWSER",
            (6, 182, 212),
            [
                ("Deterministic Engine (~0.2ms)", "Regex + Luhn Card + Thai ID checksum"),
                ("High-Precision Secrets", "API keys (AIza, sk-, ghp_), emails, phones"),
                ("Contextual Engine (Gemini Nano)", "Firebase InferenceMode.ONLY_ON_DEVICE"),
                ("Zero Cloud Fallback", "Detects orgs, people, deal names, financials"),
                ("Interactive Review", "Toggle entities or add custom secret terms"),
            ],
        ),
        (
            "STAGE 2",
            "Local Tokenization & Vault",
            "INDEXEDDB LOCAL ONLY",
            (16, 185, 129),
            [
                ("Invariant Placeholder Format", "[[SP_ORG_01]], [[SP_KEY_01]], [[SP_MONEY_01]]"),
                ("Collision-Free Tokens", "Unique per request, never duplicated"),
                ("Browser-Only Secret Vault", "Mapping persisted strictly in IndexedDB"),
                ("Zero Mapping Egress", "Secret lookup dictionary never leaves browser"),
                ("Semantic Structure Preserved", "Context intact so AI reasons accurately"),
            ],
        ),
        (
            "STAGE 3",
            "Firebase AI Logic Workspace",
            "HYBRID INFERENCE SDK",
            (245, 158, 11),
            [
                ("PREFER_ON_DEVICE (Default)", "Auto-routes locally or Cloud fallback"),
                ("ONLY_IN_CLOUD Mode", "Sanitized [[SP_*]] -> gemini-3.8-flash"),
                ("ONLY_ON_DEVICE Mode", "Strict offline execution via Gemini Nano"),
                ("Firebase App Check", "ReCaptcha / Debug Token protects quota"),
                ("Firebase Remote Config", "Dynamic policy & model override support"),
            ],
        ),
        (
            "STAGE 4",
            "Validated Rehydration & Audit",
            "PROOF-BY-INSPECTION",
            (139, 92, 246),
            [
                ("Strict Token Validation", "Blocks hallucinated / unknown [[SP_*]]"),
                ("Safe Local Restoration", "Restores placeholders from IndexedDB map"),
                ("Side-by-Side Comparison", "Inspect sanitized AI reply vs restored text"),
                ("Zero-Leakage Inspector", "Verifies 0 raw secrets in outbound HTTP"),
                ("Privacy Dashboard", "On-Device vs Cloud & entity stats"),
            ],
        ),
    ]

    x0 = 48
    card_w = 420
    gap = 48
    y0 = 176
    y1 = 830

    for idx, (num, title, sub, accent, bullets) in enumerate(stages):
        cx0 = x0 + idx * (card_w + gap)
        cx1 = cx0 + card_w
        draw_round_box(d, (cx0, y0, cx1, y1), 22, fill=(13, 21, 35), outline=accent, width=3)

        # Header band
        draw_round_box(d, (cx0 + 18, y0 + 18, cx0 + 132, y0 + 52), 10, fill=accent)
        d.text((cx0 + 75, y0 + 35), num, font=f_mono(16, bold=True), fill=(6, 11, 20), anchor="mm")
        d.text((cx0 + 148, y0 + 35), sub, font=f_mono(14, bold=True), fill=accent, anchor="lm")

        d.text((cx0 + 22, y0 + 78), title, font=f_sans(25, bold=True), fill=(248, 250, 252))
        d.line([(cx0 + 22, y0 + 118), (cx1 - 22, y0 + 118)], fill=(30, 41, 59), width=2)

        by = y0 + 144
        for head, desc in bullets:
            draw_round_box(d, (cx0 + 20, by, cx1 - 20, by + 92), 12, fill=(19, 29, 48), outline=(51, 65, 85), width=1)
            d.ellipse((cx0 + 34, by + 18, cx0 + 46, by + 30), fill=accent)
            d.text((cx0 + 58, by + 13), head, font=f_sans(18, bold=True), fill=(241, 245, 249))
            d.text((cx0 + 58, by + 48), desc, font=f_mono(13, bold=False), fill=(148, 163, 184))
            by += 108

        # Connector arrow to next stage
        if idx < 3:
            ax0 = cx1 + 6
            ax1 = cx1 + gap - 6
            ay = (y0 + y1) // 2
            d.line([(ax0, ay), (ax1 - 10, ay)], fill=(110, 231, 183), width=5)
            d.polygon([(ax1, ay), (ax1 - 14, ay - 10), (ax1 - 14, ay + 10)], fill=(110, 231, 183))

    # Bottom security guarantee bar
    draw_round_box(d, (48, 868, w - 48, 1028), 20, fill=(10, 25, 32), outline=(16, 185, 129), width=2)
    d.text((82, 898), "Security Invariant Enforced Across Web App & Chrome Manifest V3 Extension:", font=f_sans(23, bold=True), fill=(110, 231, 183))
    d.text(
        (82, 938),
        "1) Raw user input is restricted strictly to InferenceMode.ONLY_ON_DEVICE + local Regex/Luhn scanners (Cloud fallback disabled).",
        font=f_mono(18),
        fill=(226, 232, 240),
    )
    d.text(
        (82, 974),
        "2) Cloud / Hybrid inference (PREFER_ON_DEVICE -> gemini-3.8-flash) receives ONLY tokenized [[SP_*]] prompts verified by Zero-Leakage Auditor.",
        font=f_mono(18),
        fill=(226, 232, 240),
    )

    out = ASSETS_DIR / "safepaste-architecture.png"
    img.save(out, "PNG")
    print("Saved:", out)


def build_extension_flow():
    w, h = 1920, 1080
    img = draw_grid_bg(w, h, step=48)
    d = ImageDraw.Draw(img)

    # Header
    draw_round_box(d, (48, 36, w - 48, 134), 18, fill=(13, 21, 35), outline=(30, 41, 59), width=2)
    draw_shield(d, 105, 85, scale=0.45)
    d.text((155, 52), "Chrome Manifest V3 Extension + Real-Time AI Chat Protection", font=f_sans(30, bold=True), fill=(248, 250, 252))
    d.text((155, 96), "Same @safepaste/core Privacy Engine running inside Side Panel & Content Script (ChatGPT, Claude, Gemini Web)", font=f_mono(16), fill=(56, 189, 248))

    # Left: Browser Window Mockup showing content script + Ctrl+Shift+Y badge
    draw_round_box(d, (48, 174, 1180, 930), 22, fill=(15, 23, 42), outline=(71, 85, 105), width=2)
    # Browser chrome bar
    draw_round_box(d, (48, 174, 1180, 234), 22, fill=(30, 41, 59))
    d.ellipse((78, 194, 96, 212), fill=(239, 68, 68))
    d.ellipse((106, 194, 124, 212), fill=(245, 158, 11))
    d.ellipse((134, 194, 152, 212), fill=(16, 185, 129))
    draw_round_box(d, (186, 188, 920, 222), 10, fill=(15, 23, 42))
    d.text((208, 205), "https://gemini.google.com/app  ·  Protected by SafePaste MV3 Content Script", font=f_mono(16), fill=(148, 163, 184), anchor="lm")

    # Floating SafePaste pill inside chat window
    draw_round_box(d, (820, 260, 1146, 308), 24, fill=(11, 38, 36), outline=(16, 185, 129), width=2)
    d.text((983, 284), "SafePaste Active · Ctrl+Shift+Y", font=f_mono(16, bold=True), fill=(110, 231, 183), anchor="mm")

    # Before prompt box
    draw_round_box(d, (92, 336, 1136, 560), 16, fill=(24, 20, 32), outline=(244, 63, 94), width=2)
    d.text((118, 358), "BEFORE SANITIZATION (Blocked by Paste / Hotkey Guard):", font=f_mono(17, bold=True), fill=(253, 164, 175))
    d.text((118, 402), "Debug this deployment error for Acme FinTech:", font=f_mono(20), fill=(226, 232, 240))
    d.text((118, 438), "OPENAI_API_KEY=sk-live-9876543210abcdef   DB_PASS=P@ssw0rd!2026", font=f_mono(20, bold=True), fill=(251, 113, 133))
    d.text((118, 474), "Notify cfo@acmefintech.io (+66-81-234-5678) about $15.4M Wire.", font=f_mono(20), fill=(226, 232, 240))
    draw_round_box(d, (118, 514, 490, 544), 8, fill=(159, 18, 57))
    d.text((304, 529), "5 SECRETS DETECTED ON-DEVICE", font=f_mono(14, bold=True), fill=(255, 255, 255), anchor="mm")

    # Down arrow
    d.text((614, 586), "One-Click Ctrl+Shift+Y / Auto-Protect (0.4ms)", font=f_mono(18, bold=True), fill=(52, 211, 153), anchor="mm")

    # After sanitized box
    draw_round_box(d, (92, 618, 1136, 886), 16, fill=(10, 32, 34), outline=(16, 185, 129), width=2)
    d.text((118, 640), "AFTER INLINE SANITIZATION (Ready for Cloud AI):", font=f_mono(17, bold=True), fill=(110, 231, 183))
    d.text((118, 686), "Debug this deployment error for [[SP_ORGANIZATION_01]]:", font=f_mono(20), fill=(226, 232, 240))
    d.text((118, 722), "OPENAI_API_KEY=[[SP_API_KEY_01]]   DB_PASS=[[SP_PASSWORD_01]]", font=f_mono(20, bold=True), fill=(52, 211, 153))
    d.text((118, 758), "Notify [[SP_EMAIL_01]] ([[SP_PHONE_01]]) about [[SP_MONEY_01]] Wire.", font=f_mono(20), fill=(226, 232, 240))
    draw_round_box(d, (118, 812, 680, 858), 10, fill=(16, 185, 129))
    d.text((399, 835), "SAFE TO SEND  ·  REHYDRATE RESPONSE ON-DEVICE", font=f_mono(15, bold=True), fill=(6, 11, 20), anchor="mm")

    # Right: Chrome Side Panel Mockup
    draw_round_box(d, (1220, 174, 1872, 930), 22, fill=(10, 17, 30), outline=(16, 185, 129), width=3)
    d.text((1254, 210), "Chrome Side Panel", font=f_sans(28, bold=True), fill=(248, 250, 252))
    d.text((1254, 246), "SafePaste AI Gateway · MV3 Build", font=f_mono(16), fill=(16, 185, 129))
    d.line([(1254, 278), (1838, 278)], fill=(30, 41, 59), width=2)

    panel_cards = [
        ("1. Runtime Status", "Gemini Nano: Ready (On-Device)\nFirebase AI Logic + App Check: Connected\nScan Policy: ONLY_ON_DEVICE", (6, 182, 212)),
        ("2. Active Sites Protected", "chat.openai.com / chatgpt.com\nclaude.ai\ngemini.google.com  ·  aistudio.google.com", (139, 92, 246)),
        ("3. Extension Permissions", "Minimal MV3 permissions:\nsidePanel · activeTab · storage\nBuilt directly to apps/extension/dist", (245, 158, 11)),
        ("4. Rehydration & Copy", "Paste AI reply -> SafePaste Side Panel\nRestores real secrets via IndexedDB\nZero Raw Leakage Verified", (16, 185, 129)),
    ]
    py = 304
    for title, body, col in panel_cards:
        draw_round_box(d, (1254, py, 1838, py + 136), 14, fill=(17, 26, 44), outline=col, width=2)
        d.text((1276, py + 20), title, font=f_sans(20, bold=True), fill=col)
        d.text((1276, py + 54), body, font=f_mono(15), fill=(226, 232, 240))
        py += 154

    # Bottom footer
    draw_round_box(d, (48, 956, w - 48, 1036), 16, fill=(13, 21, 35), outline=(51, 65, 85), width=2)
    d.text((84, 996), "Load unpacked from apps/extension/dist  |  Web App live at https://techfrontiers.github.io/safepaste/", font=f_mono(20, bold=True), fill=(110, 231, 183), anchor="lm")

    out = ASSETS_DIR / "safepaste-extension-flow.png"
    img.save(out, "PNG")
    print("Saved:", out)


def make_1080p_crops_from_verified():
    src = ASSETS_DIR / "safepaste-firebase-cloud-verified.png"
    if not src.exists():
        return
    im = Image.open(src).convert("RGB")
    sw, sh = im.size  # 1913 x 1956

    # Top view crop (Stage 1-4 Workspace) placed centered on 1920x1080 dark canvas
    top_crop = im.crop((0, 0, sw, min(sh, 1180)))
    top_crop.thumbnail((1920, 1080), Image.Resampling.LANCZOS)
    canvas1 = Image.new("RGB", (1920, 1080), (6, 11, 20))
    canvas1.paste(top_crop, ((1920 - top_crop.width) // 2, (1080 - top_crop.height) // 2))
    out1 = ASSETS_DIR / "screen-cloud-workspace.png"
    canvas1.save(out1, "PNG")
    print("Saved:", out1)

    # Bottom view crop (Stage 3-4 + Zero-Leakage Network Inspector)
    bot_y0 = max(0, sh - 1160)
    bot_crop = im.crop((0, bot_y0, sw, sh))
    bot_crop.thumbnail((1920, 1080), Image.Resampling.LANCZOS)
    canvas2 = Image.new("RGB", (1920, 1080), (6, 11, 20))
    canvas2.paste(bot_crop, ((1920 - bot_crop.width) // 2, (1080 - bot_crop.height) // 2))
    out2 = ASSETS_DIR / "screen-network-inspector.png"
    canvas2.save(out2, "PNG")
    print("Saved:", out2)


if __name__ == "__main__":
    build_thumbnail()
    build_architecture()
    build_extension_flow()
    make_1080p_crops_from_verified()
