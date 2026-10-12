from fontTools.ttLib import TTFont
from fontTools.pens.recordingPen import RecordingPen
from PIL import Image, ImageFont, ImageDraw

p = "src/assets/fonts/ChoiceSans-Medium.web.ttf"
font = TTFont(p)
print("glyf", "glyf" in font, "cff", "CFF " in font)
print("win", font["OS/2"].usWinAscent, font["OS/2"].usWinDescent, "fs", font["OS/2"].fsSelection)
print("gasp", font["gasp"].gaspRange)
print("bbox", font["head"].yMin, font["head"].yMax)
cmap = font.getBestCmap()
gs = font.getGlyphSet()
for ch in ["i", "o", "a", "e", ".", "\u05d0", "\u05e1"]:
    name = cmap.get(ord(ch))
    pen = RecordingPen()
    gs[name].draw(pen)
    moves = sum(1 for op, _ in pen.value if op == "moveTo")
    print(repr(ch), name, "contours", moves)

im = Image.new("RGB", (1200, 220), (18, 28, 24))
d = ImageDraw.Draw(im)
f = ImageFont.truetype(p, 110)
d.text((20, 40), "Text  WhatsApp  Voice  i j .", font=f, fill=(240, 245, 242))
out = r"C:\Users\Roee\.cursor\projects\c-Users-Roee-BetterChoice-newweb-my-app\assets\web-ttf-check.png"
im.save(out)
print("rendered", out)
