"""Turn the CFF web fonts into TrueType.

Choice Sans is shipped as an unhinted CFF font from opentype.js. Chrome's
CFF scaler (stem darkening + grid fit) keeps the tittles and counters at
100% zoom and drops them at every other zoom. TrueType outlines with
grayscale smoothing and no grid-fitting stay stable across zoom levels.
"""
import os
from fontTools.ttLib import TTFont, newTable
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.ttGlyphPen import TTGlyphPen

SRC = os.path.join(os.path.dirname(__file__), "..", "..", "src", "assets", "fonts")


def otf_to_ttf(src_path, dst_path):
    font = TTFont(src_path)
    order = font.getGlyphOrder()
    glyph_set = font.getGlyphSet()

    glyf = newTable("glyf")
    glyf.glyphOrder = order
    glyf.glyphs = {}
    for name in order:
        tt_pen = TTGlyphPen(None)
        # CFF outer contours in this file are already clockwise, which is
        # what TrueType fills. Don't reverse them.
        glyph_set[name].draw(Cu2QuPen(tt_pen, max_err=1.0, reverse_direction=False))
        glyf[name] = tt_pen.glyph()

    del font["CFF "]
    # OTTO means "this is a CFF font". FreeType then looks for a CFF table,
    # fails, and drops the whole face — including every tittle.
    font.sfntVersion = "\x00\x01\x00\x00"
    font["glyf"] = glyf
    font["loca"] = newTable("loca")

    maxp = newTable("maxp")
    maxp.tableVersion = 0x00010000
    maxp.numGlyphs = len(order)
    maxp.maxPoints = 0
    maxp.maxContours = 0
    maxp.maxCompositePoints = 0
    maxp.maxCompositeContours = 0
    maxp.maxZones = 1
    maxp.maxTwilightPoints = 0
    maxp.maxStorage = 0
    maxp.maxFunctionDefs = 0
    maxp.maxInstructionDefs = 0
    maxp.maxStackElements = 0
    maxp.maxSizeOfInstructions = 0
    maxp.maxComponentElements = 0
    maxp.maxComponentDepth = 0
    font["maxp"] = maxp

    # Windows clips to usWinAscent/Descent. The generated CFF set those to the
    # tight glyph box, which shears tittles off once the zoom isn't 1:1.
    os2 = font["OS/2"]
    os2.version = 4
    os2.usWinAscent = 950
    os2.usWinDescent = 300
    os2.sxHeight = getattr(os2, "sxHeight", 507)
    os2.sCapHeight = getattr(os2, "sCapHeight", 657)
    os2.usDefaultChar = getattr(os2, "usDefaultChar", 0)
    os2.usBreakChar = getattr(os2, "usBreakChar", 32)
    os2.usMaxContext = getattr(os2, "usMaxContext", 0)
    # Use the typo metrics for line spacing, but keep the wider Windows
    # clip box so tittles are not sheared off while zooming.
    os2.fsSelection = (os2.fsSelection or 0) | 0x80

    gasp = newTable("gasp")
    gasp.version = 1
    # Grayscale + symmetric smoothing. No grid-fit, so counters and dots
    # are not snapped shut at non-integer sizes.
    gasp.gaspRange = {65535: 0x000A}
    font["gasp"] = gasp

    head = font["head"]
    head.flags = 0b11
    head.lowestRecPPEM = 8
    xmin = ymin = 10 ** 9
    xmax = ymax = -10 ** 9
    for name in order:
        glyph = glyf[name]
        glyph.recalcBounds(glyf)
        if glyph.xMin is None:
            continue
        xmin = min(xmin, glyph.xMin)
        ymin = min(ymin, glyph.yMin)
        xmax = max(xmax, glyph.xMax)
        ymax = max(ymax, glyph.yMax)
    head.xMin, head.yMin, head.xMax, head.yMax = xmin, ymin, xmax, ymax

    font.save(dst_path)
    print("wrote", dst_path, "glyphs", len(order))


if __name__ == "__main__":
    otf_to_ttf(os.path.join(SRC, "ChoiceSans-Regular.otf"), os.path.join(SRC, "ChoiceSans-Regular.web.ttf"))
    otf_to_ttf(os.path.join(SRC, "ChoiceSans-Medium.otf"), os.path.join(SRC, "ChoiceSans-Medium.web.ttf"))
