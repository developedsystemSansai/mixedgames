"""สร้างโลโก้ 'Let me ทาย' + ฝังลงภาพฉาก (รันซ้ำได้)
ต้องมีฟอนต์ TTF: fredoka.ttf, mitr-thai.ttf ใน FONT_DIR และภาพต้นฉบับ ORIG"""
import math, sys, numpy as np
from PIL import Image, ImageDraw, ImageFont
FONT_DIR = sys.argv[1] if len(sys.argv) > 1 else '/home/claude/fonts/'
ORIG = sys.argv[2] if len(sys.argv) > 2 else '/mnt/user-data/uploads/632d44d4-efaf-482d-a094-d5c562864410.png'
S = 3
orig = Image.open(ORIG).convert('RGB'); OW, OH = orig.size
DARK = (66, 32, 14); BROWN = (131, 70, 32); CREAM = (255, 246, 222); GOLD = (255, 208, 52)

def sign_layer():
    L = Image.new('RGBA', (OW * S, 340 * S), (0, 0, 0, 0)); d = ImageDraw.Draw(L)
    grow = lambda b, g: (b[0] - g, b[1] - g, b[2] + g, b[3] + g)
    body, hump = (482, 104, 1192, 270), (650, 90, 1025, 200)
    for b, r in ((body, 46), (hump, 44)): d.rounded_rectangle([v * S for v in grow(b, 9)], radius=(r + 9) * S, fill=DARK + (255,))
    for b, r in ((body, 46), (hump, 44)): d.rounded_rectangle([v * S for v in b], radius=r * S, fill=BROWN + (255,))
    m = Image.new('L', L.size, 0); md = ImageDraw.Draw(m)
    for b, r in ((body, 46), (hump, 44)): md.rounded_rectangle([v * S for v in b], radius=r * S, fill=255)
    g = Image.new('RGBA', L.size, (0, 0, 0, 0)); gd = ImageDraw.Draw(g)
    for i, y in enumerate(range(112, 268, 13)):
        gd.line([(470 * S, (y + (i % 3) * 2) * S), (1205 * S, (y - (i % 2) * 3) * S)], fill=(98, 48, 20, 90), width=3 * S)
    gd.rounded_rectangle([500 * S, 112 * S, 1174 * S, 128 * S], radius=8 * S, fill=(255, 170, 90, 70))
    g.putalpha(Image.composite(g.getchannel('A'), Image.new('L', L.size, 0), m)); L.alpha_composite(g)
    d = ImageDraw.Draw(L)
    fa = ImageFont.truetype(FONT_DIR + 'fredoka.ttf', 138 * S); ft = ImageFont.truetype(FONT_DIR + 'mitr-thai.ttf', 128 * S)
    t1, t2 = 'Let me ', 'ทาย'
    w1 = d.textlength(t1, font=fa); w2 = d.textlength(t2, font=ft); x = 837 * S - (w1 + w2) / 2; yb = 222 * S
    sh = (40, 18, 6, 255)
    d.text((x, yb + 9 * S), t1, font=fa, fill=sh, anchor='ls', stroke_width=7 * S, stroke_fill=sh)
    d.text((x + w1, yb + 9 * S), t2, font=ft, fill=sh, anchor='ls', stroke_width=7 * S, stroke_fill=sh)
    d.text((x, yb), t1, font=fa, fill=(255, 255, 255, 255), anchor='ls', stroke_width=7 * S, stroke_fill=DARK + (255,))
    d.text((x + w1, yb), t2, font=ft, fill=GOLD + (255,), anchor='ls', stroke_width=7 * S, stroke_fill=DARK + (255,))
    rb = (566, 232, 1108, 314)
    pts = lambda b: [(b[0], b[1]), (b[2], b[1]), (b[2] - 24, (b[1] + b[3]) / 2), (b[2], b[3]), (b[0], b[3]), (b[0] + 24, (b[1] + b[3]) / 2)]
    d.polygon([(px * S, py * S) for px, py in pts(grow(rb, 7))], fill=DARK + (255,))
    d.polygon([(px * S, py * S) for px, py in pts(rb)], fill=CREAM + (255,))
    d.rounded_rectangle([(rb[0] + 34) * S, (rb[1] + 7) * S, (rb[2] - 34) * S, (rb[1] + 16) * S], radius=4 * S, fill=(255, 251, 238, 255))
    fr = ImageFont.truetype(FONT_DIR + 'mitr-thai.ttf', 50 * S)
    d.text((837 * S, (rb[1] + rb[3]) / 2 * S + 19 * S), 'เกมทายคำวงเพื่อน', font=fr, fill=(92, 46, 18, 255), anchor='ms')
    def star(cx, cy, R):
        p = []
        for i in range(10):
            a = -math.pi / 2 + i * math.pi / 5; r = R if i % 2 == 0 else R * 0.45
            p.append(((cx + r * math.cos(a)) * S, (cy + r * math.sin(a)) * S))
        d.polygon(p, fill=GOLD + (255,), outline=(232, 140, 20, 255), width=3 * S)
    star(rb[0] + 54, (rb[1] + rb[3]) / 2, 17); star(rb[2] - 54, (rb[1] + rb[3]) / 2, 17)
    return L.resize((OW, 340), Image.LANCZOS)

layer = sign_layer()
rect = (640, 5, 1060, 104)
c = np.array(orig.crop(rect)).astype(float)
crown = Image.fromarray(np.dstack([c, np.clip((236 - c[..., 2]) / 28 * 255, 0, 255)]).astype('uint8'), 'RGBA')
scene = orig.convert('RGBA'); scene.alpha_composite(layer, (0, 0)); scene.alpha_composite(crown, rect[:2])
scene.convert('RGB').resize((1600, round(1600 * OH / OW)), Image.LANCZOS).save('assets/scene.webp', quality=80, method=6)
lg = layer.copy(); lg.alpha_composite(crown, rect[:2]); lg = lg.crop(lg.getbbox()); lg.thumbnail((900, 900), Image.LANCZOS)
lg.save('assets/logo.webp', quality=90, method=6)
print('ok', lg.size)
