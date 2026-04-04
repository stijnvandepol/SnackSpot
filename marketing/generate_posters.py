#!/usr/bin/env python3
"""
SnackSpot Marketing Posters — clean, informative, app-focused
"""

import math
import os
import qrcode
from PIL import Image, ImageDraw, ImageFont, ImageFilter

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "posters")
FONT_DIR = "/Users/stijnvandepol/.claude/plugins/marketplaces/anthropic-agent-skills/skills/canvas-design/canvas-fonts"
ICON_PATH = "/Users/stijnvandepol/Documents/GitHub/SnackSpot/apps/web/public/icons/icon-512.png"

os.makedirs(OUTPUT_DIR, exist_ok=True)

# Brand colors
ORANGE = (249, 115, 22)
ORANGE_LIGHT = (255, 237, 213)
ORANGE_SOFT = (254, 215, 170)
RED = (220, 38, 38)
AMBER = (245, 158, 11)
DARK = (15, 23, 42)
SLATE = (71, 85, 105)
GRAY = (148, 163, 184)
LIGHT_BG = (252, 250, 247)
WHITE = (255, 255, 255)

W, H = 1200, 1600


def font(name, size):
    try:
        return ImageFont.truetype(os.path.join(FONT_DIR, name), size)
    except:
        return ImageFont.load_default()


def generate_qr(url, size=280, fg=DARK, bg=WHITE):
    qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=10, border=2)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color=fg, back_color=bg).convert("RGBA")
    return img.resize((size, size), Image.LANCZOS)


def center_text(draw, y, text, f, fill):
    bb = draw.textbbox((0, 0), text, font=f)
    tw = bb[2] - bb[0]
    draw.text(((W - tw) // 2, y), text, fill=fill, font=f)
    return bb[3] - bb[1]


def draw_rounded_rect(draw, box, radius, fill, outline=None, outline_width=0):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=outline_width)


def load_logo(size=120):
    try:
        logo = Image.open(ICON_PATH).convert("RGBA")
        return logo.resize((size, size), Image.LANCZOS)
    except:
        return None


def draw_location_pin(draw, cx, cy, size=28, color=ORANGE):
    """Simple location pin icon."""
    r = size
    # Pin body (circle)
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)
    # Pin point (triangle)
    draw.polygon([(cx - r * 0.6, cy + r * 0.5), (cx, cy + r * 2), (cx + r * 0.6, cy + r * 0.5)], fill=color)
    # Inner circle (white)
    ir = r * 0.4
    draw.ellipse([cx - ir, cy - ir, cx + ir, cy + ir], fill=WHITE)


def draw_star(draw, cx, cy, size=12, color=AMBER):
    """Simple 5-point star."""
    points = []
    for i in range(10):
        angle = math.radians(i * 36 - 90)
        r = size if i % 2 == 0 else size * 0.4
        points.append((cx + r * math.cos(angle), cy + r * math.sin(angle)))
    draw.polygon(points, fill=color)


def draw_feature_row(draw, x, y, icon_type, text, sub, f_text, f_sub):
    """Draw a feature with icon, title, and subtitle."""
    if icon_type == "pin":
        draw_location_pin(draw, x + 22, y + 20, size=16, color=ORANGE)
    elif icon_type == "star":
        draw_star(draw, x + 22, y + 18, size=14, color=AMBER)
    elif icon_type == "share":
        # Simple share icon: three dots connected
        draw.ellipse([x + 14, y + 6, x + 22, y + 14], fill=ORANGE)
        draw.ellipse([x + 28, y + 18, x + 36, y + 26], fill=ORANGE)
        draw.ellipse([x + 14, y + 28, x + 22, y + 36], fill=ORANGE)
        draw.line([(x + 20, y + 12), (x + 30, y + 20)], fill=ORANGE, width=2)
        draw.line([(x + 20, y + 30), (x + 30, y + 24)], fill=ORANGE, width=2)

    draw.text((x + 52, y + 2), text, fill=DARK, font=f_text)
    draw.text((x + 52, y + 30), sub, fill=SLATE, font=f_sub)


# ─── POSTER 1: Clean white, logo-focused, vertical layout ───

def create_poster_1():
    img = Image.new("RGB", (W, H), WHITE)
    draw = ImageDraw.Draw(img)

    # Soft orange accent bar at very top
    draw.rectangle([(0, 0), (W, 8)], fill=ORANGE)

    # Logo
    logo = load_logo(140)
    if logo:
        lx = (W - 140) // 2
        img.paste(logo, (lx, 80), logo)

    # Brand name
    f_brand = font("Outfit-Bold.ttf", 64)
    center_text(draw, 240, "SnackSpot", f_brand, DARK)

    # Tagline
    f_tag = font("InstrumentSans-Regular.ttf", 28)
    center_text(draw, 320, "De app voor snackbar-liefhebbers", f_tag, SLATE)

    # Divider
    draw.line([(W // 2 - 60, 380), (W // 2 + 60, 380)], fill=ORANGE, width=3)

    # Main headline
    f_headline = font("Outfit-Bold.ttf", 44)
    f_headline_sub = font("InstrumentSans-Regular.ttf", 26)
    center_text(draw, 420, "Ontdek de beste snackbars", f_headline, DARK)
    center_text(draw, 478, "bij jou in de buurt", f_headline, DARK)

    # Feature cards area — light background
    card_y = 550
    card_h = 380
    card_margin = 80
    draw_rounded_rect(draw, [card_margin, card_y, W - card_margin, card_y + card_h], 20, LIGHT_BG)

    # Features
    f_feat = font("Outfit-Bold.ttf", 24)
    f_desc = font("InstrumentSans-Regular.ttf", 19)

    features = [
        ("pin", "Vind snackbars", "Zoek op locatie, naam of type snack"),
        ("star", "Lees reviews", "Bekijk beoordelingen van andere snackliefhebbers"),
        ("share", "Deel je favorieten", "Schrijf reviews en help anderen kiezen"),
    ]

    fy = card_y + 40
    for icon, title, desc in features:
        draw_feature_row(draw, card_margin + 40, fy, icon, title, desc, f_feat, f_desc)
        fy += 105

    # Separator dots between features
    for i in range(2):
        dot_y = card_y + 40 + 105 * (i + 1) - 15
        for dx in range(0, 200, 12):
            draw.ellipse([card_margin + 92 + dx, dot_y, card_margin + 94 + dx, dot_y + 2], fill=(*GRAY, ))

    # "Gratis beschikbaar" badge
    f_badge = font("Outfit-Bold.ttf", 20)
    f_badge_sub = font("InstrumentSans-Regular.ttf", 17)
    badge_y = card_y + card_h + 30
    badge_text = "100% gratis  —  Geen account nodig"
    center_text(draw, badge_y, badge_text, f_badge_sub, SLATE)

    # QR Section
    qr_section_y = 1100
    draw.line([(card_margin, qr_section_y - 20), (W - card_margin, qr_section_y - 20)], fill=(*ORANGE_SOFT,), width=1)

    f_cta = font("Outfit-Bold.ttf", 32)
    center_text(draw, qr_section_y, "Scan en begin met ontdekken", f_cta, DARK)

    # QR code
    qr_img = generate_qr("https://snackspot.online", size=260)
    qr_x = (W - 260) // 2
    qr_y = qr_section_y + 60

    # White card with subtle shadow
    shadow_pad = 36
    draw_rounded_rect(draw, [qr_x - shadow_pad + 4, qr_y - shadow_pad + 4,
                              qr_x + 260 + shadow_pad + 4, qr_y + 260 + shadow_pad + 4],
                      18, (230, 230, 230))
    draw_rounded_rect(draw, [qr_x - shadow_pad, qr_y - shadow_pad,
                              qr_x + 260 + shadow_pad, qr_y + 260 + shadow_pad],
                      18, WHITE)
    img.paste(qr_img, (qr_x, qr_y), qr_img)

    # URL under QR
    f_url = font("Outfit-Bold.ttf", 26)
    center_text(draw, qr_y + 280, "snackspot.online", f_url, ORANGE)

    # Bottom bar
    draw.rectangle([(0, H - 8), (W, H)], fill=ORANGE)

    path = os.path.join(OUTPUT_DIR, "snackspot-poster-01.png")
    img.save(path, "PNG", dpi=(300, 300))
    print(f"Created: {path}")


# ─── POSTER 2: Orange header, bold and energetic ───

def create_poster_2():
    img = Image.new("RGB", (W, H), WHITE)
    draw = ImageDraw.Draw(img)

    # Large orange header section
    header_h = 480
    draw.rectangle([(0, 0), (W, header_h)], fill=ORANGE)

    # Logo in header
    logo = load_logo(100)
    if logo:
        img.paste(logo, ((W - 100) // 2, 50), logo)

    # Title on orange
    f_title = font("Outfit-Bold.ttf", 56)
    f_sub = font("InstrumentSans-Regular.ttf", 26)
    center_text(draw, 170, "SnackSpot", f_title, WHITE)

    # Tagline on orange
    center_text(draw, 245, "Ontdek  ·  Beoordeel  ·  Deel", f_sub, (*WHITE,))

    # Big CTA text on orange
    f_big = font("Outfit-Bold.ttf", 38)
    center_text(draw, 340, "Jouw gids voor de beste", f_big, WHITE)
    center_text(draw, 390, "snackbars van Nederland", f_big, WHITE)

    # Wave/curve transition (simple rounded rectangle overlap)
    draw_rounded_rect(draw, [0, header_h - 30, W, header_h + 30], 30, WHITE)

    # Content section
    f_heading = font("Outfit-Bold.ttf", 30)
    f_body = font("InstrumentSans-Regular.ttf", 21)
    f_bold = font("InstrumentSans-Bold.ttf", 21)

    # What is SnackSpot
    section_x = 100
    sy = 530

    draw.text((section_x, sy), "Wat is SnackSpot?", fill=DARK, font=f_heading)
    draw.rectangle([(section_x, sy + 42), (section_x + 50, sy + 45)], fill=ORANGE)

    desc_lines = [
        "SnackSpot helpt je de lekkerste snackbars",
        "te vinden, waar je ook bent. Bekijk reviews,",
        "ontdek nieuwe plekken en deel je mening.",
    ]
    for i, line in enumerate(desc_lines):
        draw.text((section_x, sy + 65 + i * 32), line, fill=SLATE, font=f_body)

    # Feature list with orange bullets
    fy = 730
    draw.text((section_x, fy), "Dit kan je met SnackSpot:", fill=DARK, font=f_heading)
    draw.rectangle([(section_x, fy + 42), (section_x + 50, fy + 45)], fill=ORANGE)

    bullet_items = [
        "Zoek snackbars op locatie of naam",
        "Bekijk foto's, menu's en openingstijden",
        "Lees en schrijf beoordelingen",
        "Bewaar je favoriete plekken",
        "Deel tips met vrienden en familie",
    ]
    f_bullet = font("InstrumentSans-Regular.ttf", 22)
    for i, item in enumerate(bullet_items):
        by = fy + 65 + i * 46
        # Orange bullet dot
        draw.ellipse([section_x + 4, by + 10, section_x + 14, by + 20], fill=ORANGE)
        draw.text((section_x + 30, by), item, fill=DARK, font=f_bullet)

    # QR section at bottom
    qr_bg_y = 1100
    draw_rounded_rect(draw, [60, qr_bg_y, W - 60, H - 60], 24, LIGHT_BG)

    f_cta = font("Outfit-Bold.ttf", 30)
    center_text(draw, qr_bg_y + 30, "Probeer het nu — helemaal gratis!", f_cta, DARK)

    f_cta_sub = font("InstrumentSans-Regular.ttf", 20)
    center_text(draw, qr_bg_y + 75, "Scan de QR-code of ga naar:", f_cta_sub, SLATE)

    # QR
    qr_img = generate_qr("https://snackspot.online", size=220)
    qr_x = (W - 220) // 2
    qr_y = qr_bg_y + 115

    draw_rounded_rect(draw, [qr_x - 20, qr_y - 20, qr_x + 240, qr_y + 240], 14, WHITE)
    img.paste(qr_img, (qr_x, qr_y), qr_img)

    f_url = font("Outfit-Bold.ttf", 28)
    center_text(draw, qr_y + 245, "snackspot.online", f_url, ORANGE)

    # Bottom accent
    draw.rectangle([(0, H - 6), (W, H)], fill=ORANGE)

    path = os.path.join(OUTPUT_DIR, "snackspot-poster-02.png")
    img.save(path, "PNG", dpi=(300, 300))
    print(f"Created: {path}")


# ─── POSTER 3: Dark/modern, app-showcase style ───

def create_poster_3():
    img = Image.new("RGB", (W, H), DARK)
    draw = ImageDraw.Draw(img)

    DARK_CARD = (30, 41, 59)
    DARK_BORDER = (51, 65, 85)

    # Top accent line
    draw.rectangle([(0, 0), (W, 4)], fill=ORANGE)

    # Logo
    logo = load_logo(120)
    if logo:
        img.paste(logo, ((W - 120) // 2, 70), logo)

    # Title
    f_title = font("Outfit-Bold.ttf", 60)
    f_sub = font("InstrumentSans-Regular.ttf", 24)
    center_text(draw, 210, "SnackSpot", f_title, WHITE)

    # Tagline
    center_text(draw, 285, "De snackbar-app van Nederland", f_sub, GRAY)

    # Orange divider
    draw.rectangle([(W // 2 - 40, 340), (W // 2 + 40, 343)], fill=ORANGE)

    # Headline
    f_head = font("Outfit-Bold.ttf", 38)
    center_text(draw, 380, "Altijd een goede snackbar", f_head, WHITE)
    center_text(draw, 430, "binnen handbereik", f_head, WHITE)

    # Feature cards — 3 cards in a column
    card_data = [
        ("Zoek & Vind", "Vind snackbars bij jou in de buurt\nop basis van locatie, naam of snack", "pin"),
        ("Reviews & Ratings", "Lees eerlijke beoordelingen en\nbekijk foto's van andere bezoekers", "star"),
        ("Deel & Bewaar", "Sla favorieten op en deel je\nbeste snackbar-tips met anderen", "share"),
    ]

    f_card_title = font("Outfit-Bold.ttf", 24)
    f_card_body = font("InstrumentSans-Regular.ttf", 19)

    card_y_start = 510
    card_h = 110
    card_gap = 20
    card_mx = 80

    for i, (title, body, icon) in enumerate(card_data):
        cy = card_y_start + i * (card_h + card_gap)

        # Card background
        draw_rounded_rect(draw, [card_mx, cy, W - card_mx, cy + card_h], 14, DARK_CARD, DARK_BORDER, 1)

        # Orange accent left border
        draw_rounded_rect(draw, [card_mx, cy, card_mx + 5, cy + card_h], 3, ORANGE)

        # Icon area
        icon_x = card_mx + 30
        icon_y = cy + card_h // 2

        if icon == "pin":
            draw_location_pin(draw, icon_x + 12, icon_y - 4, size=14, color=ORANGE)
        elif icon == "star":
            draw_star(draw, icon_x + 12, icon_y - 4, size=12, color=AMBER)
        elif icon == "share":
            draw.ellipse([icon_x + 6, icon_y - 14, icon_x + 12, icon_y - 8], fill=ORANGE)
            draw.ellipse([icon_x + 18, icon_y - 4, icon_x + 24, icon_y + 2], fill=ORANGE)
            draw.ellipse([icon_x + 6, icon_y + 4, icon_x + 12, icon_y + 10], fill=ORANGE)
            draw.line([(icon_x + 11, icon_y - 10), (icon_x + 19, icon_y - 2)], fill=ORANGE, width=2)
            draw.line([(icon_x + 11, icon_y + 6), (icon_x + 19, icon_y + 0)], fill=ORANGE, width=2)

        # Text
        text_x = card_mx + 70
        draw.text((text_x, cy + 18), title, fill=WHITE, font=f_card_title)
        body_lines = body.split("\n")
        for j, line in enumerate(body_lines):
            draw.text((text_x, cy + 52 + j * 24), line, fill=GRAY, font=f_card_body)

    # Stats row
    stats_y = card_y_start + 3 * (card_h + card_gap) + 30
    f_stat_num = font("Outfit-Bold.ttf", 42)
    f_stat_label = font("InstrumentSans-Regular.ttf", 16)

    stats = [
        ("500+", "Snackbars"),
        ("1000+", "Reviews"),
        ("Gratis", "Geen kosten"),
    ]

    stat_spacing = W // 4
    for i, (num, label) in enumerate(stats):
        sx = stat_spacing * (i + 1)
        nb = draw.textbbox((0, 0), num, font=f_stat_num)
        nw = nb[2] - nb[0]
        draw.text((sx - nw // 2, stats_y), num, fill=ORANGE, font=f_stat_num)
        lb = draw.textbbox((0, 0), label, font=f_stat_label)
        lw = lb[2] - lb[0]
        draw.text((sx - lw // 2, stats_y + 50), label, fill=GRAY, font=f_stat_label)

    # Divider dots
    dot_y = stats_y + 90
    for dx in range(0, 200, 8):
        draw.ellipse([W // 2 - 100 + dx, dot_y, W // 2 - 98 + dx, dot_y + 2], fill=DARK_BORDER)

    # QR Section
    qr_section_y = stats_y + 120
    f_cta = font("Outfit-Bold.ttf", 28)
    center_text(draw, qr_section_y, "Scan en ontdek jouw nieuwe", f_cta, WHITE)
    center_text(draw, qr_section_y + 40, "favoriete snackbar", f_cta, WHITE)

    # QR
    qr_img = generate_qr("https://snackspot.online", size=240, fg=DARK, bg=WHITE)
    qr_x = (W - 240) // 2
    qr_y = qr_section_y + 100

    # QR glow
    draw_rounded_rect(draw, [qr_x - 24, qr_y - 24, qr_x + 264, qr_y + 264], 18, WHITE)
    img.paste(qr_img, (qr_x, qr_y), qr_img)

    # URL
    f_url = font("Outfit-Bold.ttf", 26)
    center_text(draw, qr_y + 260, "snackspot.online", f_url, ORANGE)

    # Bottom accent
    draw.rectangle([(0, H - 4), (W, H)], fill=ORANGE)

    path = os.path.join(OUTPUT_DIR, "snackspot-poster-03.png")
    img.save(path, "PNG", dpi=(300, 300))
    print(f"Created: {path}")


if __name__ == "__main__":
    print("Generating SnackSpot posters...")
    create_poster_1()
    create_poster_2()
    create_poster_3()
    print(f"\nDone! 3 posters saved to: {OUTPUT_DIR}")
