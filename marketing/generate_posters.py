#!/usr/bin/env python3
"""
SnackSpot Marketing Posters — Thermal Cartography aesthetic
Generates small promotional posters with QR code to snackspot.online
"""

import math
import os
import qrcode
from PIL import Image, ImageDraw, ImageFont

# Paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "posters")
FONT_DIR = "/Users/stijnvandepol/.claude/plugins/marketplaces/anthropic-agent-skills/skills/canvas-design/canvas-fonts"
ICON_PATH = "/Users/stijnvandepol/Documents/GitHub/SnackSpot/apps/web/public/icons/icon-512.png"

os.makedirs(OUTPUT_DIR, exist_ok=True)

# Brand colors
ORANGE = (249, 115, 22)       # #F97316
RED = (220, 38, 38)           # #DC2626
AMBER = (245, 158, 11)        # #F59E0B
DARK = (15, 23, 42)           # #0F172A
WHITE = (255, 255, 255)
BONE = (250, 248, 244)        # warm white
LIGHT_ORANGE = (254, 237, 220)  # soft warm tint

# Poster dimensions (A5-ish, 300 DPI = 1748x2480)
# Using a compact poster size: 1200x1600px (good for print at ~4x5.3 inches)
W, H = 1200, 1600

def load_font(name, size):
    path = os.path.join(FONT_DIR, name)
    try:
        return ImageFont.truetype(path, size)
    except:
        return ImageFont.load_default()

def generate_qr(url, size=280):
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=2,
    )
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color=DARK, back_color=WHITE).convert("RGBA")
    img = img.resize((size, size), Image.LANCZOS)
    return img

def draw_concentric_rings(draw, cx, cy, max_r, color, alpha_start=60, ring_width=2, gap=18):
    """Draw concentric rings radiating from a center point — thermal plume effect."""
    r = gap
    while r < max_r:
        alpha = max(5, int(alpha_start * (1 - r / max_r)))
        c = (*color, alpha)
        bbox = [cx - r, cy - r, cx + r, cy + r]
        draw.ellipse(bbox, outline=c, width=ring_width)
        r += gap

def draw_dot_field(draw, x0, y0, x1, y1, color, spacing=24, dot_r=2):
    """Grid of tiny dots — systematic repetition."""
    for x in range(x0, x1, spacing):
        for y in range(y0, y1, spacing):
            # slight variation in opacity based on distance from center
            cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
            dist = math.sqrt((x - cx)**2 + (y - cy)**2)
            max_dist = math.sqrt((x1 - x0)**2 + (y1 - y0)**2) / 2
            alpha = max(15, int(80 * (1 - dist / max_dist)))
            draw.ellipse([x - dot_r, y - dot_r, x + dot_r, y + dot_r], fill=(*color, alpha))

def draw_radial_dots(draw, cx, cy, max_r, color, count=120, dot_r=3):
    """Dots radiating outward from a point — like a thermal signature."""
    import random
    random.seed(42)
    for i in range(count):
        angle = random.uniform(0, 2 * math.pi)
        r = random.uniform(20, max_r)
        x = cx + r * math.cos(angle)
        y = cy + r * math.sin(angle)
        alpha = max(10, int(120 * (1 - r / max_r)))
        size = max(1, int(dot_r * (1 - r / max_r * 0.7)))
        draw.ellipse([x - size, y - size, x + size, y + size], fill=(*color, alpha))

def create_poster_1():
    """Poster variant 1: Central thermal pulse with concentric rings."""
    img = Image.new("RGBA", (W, H), BONE)
    draw = ImageDraw.Draw(img, "RGBA")

    # Background dot field — subtle systematic pattern
    draw_dot_field(draw, 0, 0, W, H, ORANGE, spacing=32, dot_r=1)

    # Central thermal rings
    cx, cy = W // 2, H // 2 - 80
    draw_concentric_rings(draw, cx, cy, 500, ORANGE, alpha_start=50, ring_width=2, gap=20)
    draw_concentric_rings(draw, cx, cy, 300, RED, alpha_start=40, ring_width=1, gap=14)

    # Radial dots — thermal scatter
    draw_radial_dots(draw, cx, cy, 400, AMBER, count=200, dot_r=4)
    draw_radial_dots(draw, cx, cy, 250, ORANGE, count=100, dot_r=3)

    # Central hot spot — solid circle
    draw.ellipse([cx-45, cy-45, cx+45, cy+45], fill=(*ORANGE, 220))
    draw.ellipse([cx-25, cy-25, cx+25, cy+25], fill=(*RED, 240))

    # Location pin silhouette in center (simple geometric)
    # Pin body
    pin_top = cy - 18
    pin_size = 14
    draw.ellipse([cx-pin_size, pin_top-pin_size, cx+pin_size, pin_top+pin_size], fill=WHITE)
    draw.polygon([(cx-pin_size, pin_top+4), (cx, pin_top+pin_size+16), (cx+pin_size, pin_top+4)], fill=WHITE)
    draw.ellipse([cx-6, pin_top-6, cx+6, pin_top+6], fill=(*RED, 240))

    # Title — large, architectural
    font_title = load_font("Outfit-Bold.ttf", 96)
    font_sub = load_font("InstrumentSans-Regular.ttf", 28)
    font_tiny = load_font("DMMono-Regular.ttf", 16)

    # "SNACKSPOT" at top
    title_text = "SNACKSPOT"
    bbox_t = draw.textbbox((0, 0), title_text, font=font_title)
    tw = bbox_t[2] - bbox_t[0]
    draw.text(((W - tw) // 2, 100), title_text, fill=(*DARK, 230), font=font_title)

    # Thin line under title
    line_y = 215
    draw.line([(W//2 - 160, line_y), (W//2 + 160, line_y)], fill=(*ORANGE, 120), width=2)

    # Subtitle
    sub_text = "Ontdek de beste snacks bij jou in de buurt"
    bbox_s = draw.textbbox((0, 0), sub_text, font=font_sub)
    sw = bbox_s[2] - bbox_s[0]
    draw.text(((W - sw) // 2, 235), sub_text, fill=(*DARK, 160), font=font_sub)

    # QR code at bottom
    qr_img = generate_qr("https://snackspot.online", size=240)
    qr_x = (W - 240) // 2
    qr_y = H - 380

    # QR background
    qr_pad = 24
    draw.rounded_rectangle(
        [qr_x - qr_pad, qr_y - qr_pad, qr_x + 240 + qr_pad, qr_y + 240 + qr_pad],
        radius=16, fill=WHITE
    )
    img.paste(qr_img, (qr_x, qr_y), qr_img)

    # URL label under QR
    url_text = "snackspot.online"
    bbox_u = draw.textbbox((0, 0), url_text, font=font_sub)
    uw = bbox_u[2] - bbox_u[0]
    draw.text(((W - uw) // 2, qr_y + 260), url_text, fill=(*DARK, 200), font=font_sub)

    # Coordinate-style markers — scientific notation feel
    draw.text((40, H - 60), "52.3676°N  4.9041°E", fill=(*DARK, 60), font=font_tiny)
    draw.text((W - 240, H - 60), "THERMAL CARTOGRAPHY", fill=(*DARK, 40), font=font_tiny)

    # Top corner — minimal marker
    draw.text((40, 40), "▪ 001", fill=(*ORANGE, 100), font=font_tiny)

    out = img.convert("RGB")
    path = os.path.join(OUTPUT_DIR, "snackspot-poster-01.png")
    out.save(path, "PNG", dpi=(300, 300))
    print(f"Created: {path}")
    return path


def create_poster_2():
    """Poster variant 2: Clean geometric — warm minimalism with structured space."""
    img = Image.new("RGBA", (W, H), BONE)
    draw = ImageDraw.Draw(img, "RGBA")

    # Subtle warm tint at top — very gentle, drawn on separate layer to avoid alpha accumulation
    tint = Image.new("RGBA", (W, 160), (0, 0, 0, 0))
    tint_draw = ImageDraw.Draw(tint, "RGBA")
    for y in range(0, 160):
        progress = y / 160
        alpha = int(18 * (1 - progress))
        tint_draw.line([(0, y), (W, y)], fill=(*ORANGE, alpha))
    img = Image.alpha_composite(img, Image.new("RGBA", (W, H), (0, 0, 0, 0)))
    # Paste tint onto a full-size transparent image, then composite
    tint_full = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    tint_full.paste(tint, (0, 0))
    img = Image.alpha_composite(img, tint_full)
    draw = ImageDraw.Draw(img, "RGBA")

    # Thin horizontal rules — cartographic structure
    for y in range(300, 1100, 60):
        draw.line([(100, y), (W - 100, y)], fill=(*DARK, 12), width=1)

    # Vertical thin accent lines at margins
    for x in [100, W - 100]:
        draw.line([(x, 280), (x, 1120)], fill=(*ORANGE, 20), width=1)

    # Dot grid — subtle, not overlapping with center
    draw_dot_field(draw, 120, 340, 400, 1080, ORANGE, spacing=30, dot_r=1)
    draw_dot_field(draw, W - 400, 340, W - 120, 1080, ORANGE, spacing=30, dot_r=1)

    # Central element — concentric rings only (no filled circles)
    cx, cy = W // 2, 680
    draw_concentric_rings(draw, cx, cy, 280, ORANGE, alpha_start=35, ring_width=1, gap=22)

    # Small hot center
    draw.ellipse([cx-20, cy-20, cx+20, cy+20], fill=(*ORANGE, 160))
    draw.ellipse([cx-8, cy-8, cx+8, cy+8], fill=(*RED, 200))

    # Brand mark top — clean and bold
    font_brand = load_font("Outfit-Bold.ttf", 80)
    font_tagline = load_font("InstrumentSans-Regular.ttf", 24)
    font_label = load_font("DMMono-Regular.ttf", 14)
    font_url = load_font("InstrumentSans-Bold.ttf", 26)

    brand = "SNACKSPOT"
    bb = draw.textbbox((0, 0), brand, font=font_brand)
    bw = bb[2] - bb[0]
    draw.text(((W - bw) // 2, 80), brand, fill=(*DARK, 230), font=font_brand)

    # Thin orange accent bar
    bar_y = 178
    bar_w = 50
    draw.rectangle([(W//2 - bar_w, bar_y), (W//2 + bar_w, bar_y + 2)], fill=(*ORANGE, 180))

    # Tagline
    tag = "Vind jouw favoriete snackbar"
    tb = draw.textbbox((0, 0), tag, font=font_tagline)
    ttw = tb[2] - tb[0]
    draw.text(((W - ttw) // 2, 200), tag, fill=(*DARK, 130), font=font_tagline)

    # Three feature labels — minimal, well-spaced
    features = ["ONTDEK", "BEOORDEEL", "DEEL"]
    feat_font = load_font("DMMono-Regular.ttf", 15)
    feat_y = 1140
    spacing = W // 4
    for i, feat in enumerate(features):
        fx = spacing * (i + 1)
        fb = draw.textbbox((0, 0), feat, font=feat_font)
        fw = fb[2] - fb[0]
        draw.text((fx - fw // 2, feat_y), feat, fill=(*ORANGE, 160), font=feat_font)
        # small dot above
        draw.ellipse([fx - 2, feat_y - 12, fx + 2, feat_y - 8], fill=(*RED, 140))

    # QR section at bottom — generous spacing
    qr_img = generate_qr("https://snackspot.online", size=200)
    qr_x = (W - 200) // 2
    qr_y = H - 380

    # Clean white card behind QR
    card_pad = 28
    draw.rounded_rectangle(
        [qr_x - card_pad, qr_y - card_pad - 6, qr_x + 200 + card_pad, qr_y + 200 + card_pad + 46],
        radius=16, fill=WHITE, outline=(*ORANGE, 30), width=1
    )
    img.paste(qr_img, (qr_x, qr_y), qr_img)

    # URL
    url = "snackspot.online"
    ub = draw.textbbox((0, 0), url, font=font_url)
    uw = ub[2] - ub[0]
    draw.text(((W - uw) // 2, qr_y + 215), url, fill=(*DARK, 190), font=font_url)

    # Scan label
    scan = "SCAN & ONTDEK"
    sb = draw.textbbox((0, 0), scan, font=font_label)
    sw = sb[2] - sb[0]
    draw.text(((W - sw) // 2, qr_y - card_pad + 6), scan, fill=(*ORANGE, 120), font=font_label)

    # Bottom coordinates
    draw.text((40, H - 50), "▪ 002", fill=(*ORANGE, 70), font=font_label)
    draw.text((W - 200, H - 50), "THERMAL CARTOGRAPHY", fill=(*DARK, 35), font=font_label)

    out = img.convert("RGB")
    path = os.path.join(OUTPUT_DIR, "snackspot-poster-02.png")
    out.save(path, "PNG", dpi=(300, 300))
    print(f"Created: {path}")
    return path


def create_poster_3():
    """Poster variant 3: Dark mode — thermal imaging aesthetic."""
    img = Image.new("RGBA", (W, H), DARK)
    draw = ImageDraw.Draw(img, "RGBA")

    # Subtle grid — like thermal camera overlay
    for x in range(0, W, 40):
        draw.line([(x, 0), (x, H)], fill=(255, 255, 255, 8), width=1)
    for y in range(0, H, 40):
        draw.line([(0, y), (W, y)], fill=(255, 255, 255, 8), width=1)

    # Multiple heat sources — scattered thermal signatures
    import random
    random.seed(77)
    heat_points = [
        (W // 2, H // 2 - 100, 350, ORANGE, 45),
        (280, 500, 180, AMBER, 30),
        (W - 300, 550, 200, ORANGE, 35),
        (400, 900, 150, RED, 25),
        (W - 250, 950, 170, AMBER, 28),
    ]

    for hx, hy, hr, hcolor, halpha in heat_points:
        draw_concentric_rings(draw, hx, hy, hr, hcolor, alpha_start=halpha, ring_width=1, gap=16)
        draw_radial_dots(draw, hx, hy, hr * 0.7, hcolor, count=60, dot_r=2)
        # Hot center
        draw.ellipse([hx-8, hy-8, hx+8, hy+8], fill=(*hcolor, 200))

    # Central dominant source
    cx, cy = W // 2, H // 2 - 100
    draw.ellipse([cx-35, cy-35, cx+35, cy+35], fill=(*ORANGE, 160))
    draw.ellipse([cx-18, cy-18, cx+18, cy+18], fill=(*AMBER, 220))
    draw.ellipse([cx-6, cy-6, cx+6, cy+6], fill=(*WHITE, 240))

    # Title — glowing on dark
    font_title = load_font("Outfit-Bold.ttf", 88)
    font_sub = load_font("InstrumentSans-Regular.ttf", 26)
    font_tiny = load_font("DMMono-Regular.ttf", 14)
    font_url = load_font("InstrumentSans-Bold.ttf", 24)

    title = "SNACKSPOT"
    tb = draw.textbbox((0, 0), title, font=font_title)
    tw = tb[2] - tb[0]
    # Glow effect
    for offset in range(3, 0, -1):
        alpha = 20 * offset
        draw.text(((W - tw) // 2, 90 - offset), title, fill=(*ORANGE, alpha), font=font_title)
    draw.text(((W - tw) // 2, 90), title, fill=(*ORANGE, 240), font=font_title)

    # Accent line
    draw.line([(W//2 - 100, 195), (W//2 + 100, 195)], fill=(*ORANGE, 80), width=1)

    # Subtitle
    sub = "De snackbar-app van Nederland"
    sb = draw.textbbox((0, 0), sub, font=font_sub)
    sw = sb[2] - sb[0]
    draw.text(((W - sw) // 2, 210), sub, fill=(200, 200, 200, 160), font=font_sub)

    # QR — white on dark stands out
    qr_img = generate_qr("https://snackspot.online", size=220)
    qr_x = (W - 220) // 2
    qr_y = H - 400

    # Subtle glow behind QR
    glow_r = 160
    for r in range(glow_r, 0, -2):
        alpha = int(8 * (1 - r / glow_r))
        draw.ellipse([qr_x + 110 - r, qr_y + 110 - r, qr_x + 110 + r, qr_y + 110 + r],
                     fill=(*ORANGE, alpha))

    # QR white background
    qr_pad = 20
    draw.rounded_rectangle(
        [qr_x - qr_pad, qr_y - qr_pad, qr_x + 220 + qr_pad, qr_y + 220 + qr_pad],
        radius=14, fill=WHITE
    )
    img.paste(qr_img, (qr_x, qr_y), qr_img)

    # URL
    url = "snackspot.online"
    ub = draw.textbbox((0, 0), url, font=font_url)
    uw = ub[2] - ub[0]
    draw.text(((W - uw) // 2, qr_y + 250), url, fill=(*ORANGE, 200), font=font_url)

    # Corner data
    draw.text((30, 30), "▪ 003", fill=(*ORANGE, 80), font=font_tiny)
    draw.text((30, H - 40), "52.37°N  4.90°E", fill=(200, 200, 200, 40), font=font_tiny)
    draw.text((W - 220, H - 40), "THERMAL CARTOGRAPHY", fill=(200, 200, 200, 30), font=font_tiny)

    # Crosshair on main heat source
    ch_len = 20
    draw.line([(cx - ch_len, cy), (cx - 8, cy)], fill=(255, 255, 255, 100), width=1)
    draw.line([(cx + 8, cy), (cx + ch_len, cy)], fill=(255, 255, 255, 100), width=1)
    draw.line([(cx, cy - ch_len), (cx, cy - 8)], fill=(255, 255, 255, 100), width=1)
    draw.line([(cx, cy + 8), (cx, cy + ch_len)], fill=(255, 255, 255, 100), width=1)

    out = img.convert("RGB")
    path = os.path.join(OUTPUT_DIR, "snackspot-poster-03.png")
    out.save(path, "PNG", dpi=(300, 300))
    print(f"Created: {path}")
    return path


if __name__ == "__main__":
    print("Generating SnackSpot posters...")
    p1 = create_poster_1()
    p2 = create_poster_2()
    p3 = create_poster_3()
    print(f"\nDone! 3 posters saved to: {OUTPUT_DIR}")
