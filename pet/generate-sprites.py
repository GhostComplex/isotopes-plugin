#!/usr/bin/env python3
"""Generate Bangboo sprite sheet animations from base sprite."""

from PIL import Image, ImageDraw, ImageFilter
import math, os

BASE = "/Users/steinsz/_repos/isotopes/plugins/pet/ui"
SRC = os.path.join(BASE, "bangboo.png")

# Load and work at a clean pixel-art friendly size
orig = Image.open(SRC).convert("RGBA")
# Resize to 64x84 for pixel art crispness (keeps aspect ~0.757)
W, H = 64, 84
base = orig.resize((W, H), Image.NEAREST)

FRAME_W, FRAME_H = W, H + 20  # extra vertical space for jump frames

def make_frame(img=None, dy=0, sx=1.0, sy=1.0, rot=0, dx=0, eye_color=None, brightness=1.0):
    """Create a single animation frame with transformations."""
    src = img or base.copy()

    # Apply brightness
    if brightness != 1.0:
        pixels = src.load()
        for y in range(src.height):
            for x in range(src.width):
                r, g, b, a = pixels[x, y]
                r = min(255, int(r * brightness))
                g = min(255, int(g * brightness))
                b = min(255, int(b * brightness))
                pixels[x, y] = (r, g, b, a)

    # Apply eye color change (eyes are the bright yellow-green pixels in upper portion)
    if eye_color:
        pixels = src.load()
        er, eg, eb = eye_color
        for y in range(src.height * 30 // 100, src.height * 55 // 100):
            for x in range(src.width * 20 // 100, src.width * 80 // 100):
                r, g, b, a = pixels[x, y]
                # Detect eye pixels: bright yellow-green (high G, moderate R, low B)
                if a > 100 and g > 140 and g > b + 60 and r < 230:
                    # Recolor proportionally
                    lum = (r + g + b) / 3.0 / 255.0
                    pixels[x, y] = (
                        min(255, int(er * lum * 1.3)),
                        min(255, int(eg * lum * 1.3)),
                        min(255, int(eb * lum * 1.3)),
                        a
                    )

    # Scale
    if sx != 1.0 or sy != 1.0:
        nw, nh = max(1, int(src.width * sx)), max(1, int(src.height * sy))
        src = src.resize((nw, nh), Image.NEAREST)

    # Rotate
    if rot != 0:
        src = src.rotate(rot, resample=Image.NEAREST, expand=True)

    # Place on frame canvas
    frame = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
    px = (FRAME_W - src.width) // 2 + dx
    py = (FRAME_H - src.height) // 2 + dy - 10  # baseline offset
    frame.paste(src, (px, py), src)
    return frame


def generate_idle():
    """Idle breathing: 4 frames, subtle up/down."""
    return [
        make_frame(dy=0),
        make_frame(dy=-2),
        make_frame(dy=-3),
        make_frame(dy=-2),
    ]


def generate_bounce():
    """Bounce: 6 frames."""
    return [
        make_frame(dy=0, sy=0.95, sx=1.05),   # squash
        make_frame(dy=-6, sy=1.02),             # launch
        make_frame(dy=-14, sy=1.05),            # peak
        make_frame(dy=-8, sy=1.02),             # fall
        make_frame(dy=0, sy=0.92, sx=1.08),    # land squash
        make_frame(dy=0),                        # recover
    ]


def generate_jump():
    """Jump: 8 frames, big height."""
    return [
        make_frame(dy=2, sy=0.9, sx=1.1),     # crouch
        make_frame(dy=-4, sy=1.05),             # launch
        make_frame(dy=-16),                      # rise
        make_frame(dy=-22, sy=1.03),            # peak
        make_frame(dy=-20),                      # hang
        make_frame(dy=-12),                      # fall
        make_frame(dy=-4),                       # approach
        make_frame(dy=2, sy=0.9, sx=1.1),      # land
    ]


def generate_poke():
    """Poke reaction: 6 frames, squish and wobble."""
    return [
        make_frame(dy=0),
        make_frame(dy=2, sy=0.85, sx=1.15),   # squish down
        make_frame(dy=0, sy=0.88, sx=1.12),    # still squished
        make_frame(dy=-4, sy=1.08, sx=0.95),   # spring up
        make_frame(dy=-2, sy=1.03),             # overshoot
        make_frame(dy=0),                        # settle
    ]


def generate_shake():
    """Shake: 6 frames, left-right wobble."""
    return [
        make_frame(dx=0),
        make_frame(dx=-4, rot=3),
        make_frame(dx=4, rot=-3),
        make_frame(dx=-3, rot=2),
        make_frame(dx=3, rot=-2),
        make_frame(dx=0),
    ]


def generate_spin():
    """Spin: 8 frames, full rotation simulated via squash."""
    return [
        make_frame(sx=1.0),
        make_frame(sx=0.7),
        make_frame(sx=0.3),
        make_frame(sx=0.05),   # edge-on
        make_frame(sx=0.3),
        make_frame(sx=0.7),
        make_frame(sx=1.0),
        make_frame(sx=0.85),
    ]


def generate_dance():
    """Dance: 8 frames, bouncy side to side."""
    return [
        make_frame(dy=0, dx=0),
        make_frame(dy=-6, dx=-3, rot=5),
        make_frame(dy=0, dx=0),
        make_frame(dy=-6, dx=3, rot=-5),
        make_frame(dy=0, dx=0),
        make_frame(dy=-8, dx=-2, rot=3),
        make_frame(dy=0, dx=0),
        make_frame(dy=-8, dx=2, rot=-3),
    ]


def generate_wave():
    """Wave: 6 frames, tilt side to side."""
    return [
        make_frame(rot=0),
        make_frame(rot=-8),
        make_frame(rot=-12),
        make_frame(rot=0),
        make_frame(rot=8),
        make_frame(rot=12),
    ]


def generate_nod():
    """Nod: 4 frames."""
    return [
        make_frame(dy=0),
        make_frame(dy=4),
        make_frame(dy=5),
        make_frame(dy=2),
    ]


def generate_sleep():
    """Sleep: 4 frames, gentle sway + dim."""
    return [
        make_frame(dy=0, brightness=0.7),
        make_frame(dy=2, brightness=0.65),
        make_frame(dy=3, brightness=0.6),
        make_frame(dy=2, brightness=0.65),
    ]


# Mood eye colors
def generate_mood_happy():
    return [make_frame(eye_color=(127, 255, 127), dy=-2)]

def generate_mood_sad():
    return [make_frame(eye_color=(60, 120, 180), brightness=0.8)]

def generate_mood_excited():
    return [make_frame(eye_color=(220, 255, 0), dy=-3)]

def generate_mood_angry():
    return [make_frame(eye_color=(255, 50, 50))]

def generate_mood_love():
    return [make_frame(eye_color=(255, 100, 150))]

def generate_mood_confused():
    return [make_frame(eye_color=(200, 200, 80), rot=3)]

def generate_mood_sleepy():
    return [make_frame(eye_color=(80, 140, 80), brightness=0.65)]

def generate_mood_neutral():
    return [make_frame()]


# Build all animations
ANIMS = {
    "idle": generate_idle(),
    "bounce": generate_bounce(),
    "jump": generate_jump(),
    "poke": generate_poke(),
    "shake": generate_shake(),
    "spin": generate_spin(),
    "dance": generate_dance(),
    "wave": generate_wave(),
    "nod": generate_nod(),
    "sleep": generate_sleep(),
    "mood_happy": generate_mood_happy(),
    "mood_sad": generate_mood_sad(),
    "mood_excited": generate_mood_excited(),
    "mood_angry": generate_mood_angry(),
    "mood_love": generate_mood_love(),
    "mood_confused": generate_mood_confused(),
    "mood_sleepy": generate_mood_sleepy(),
    "mood_neutral": generate_mood_neutral(),
}

# Create sprite sheet: all animations stacked vertically
# Each row = one animation, columns = frames (max frames across all anims)
max_frames = max(len(f) for f in ANIMS.values())
num_anims = len(ANIMS)

sheet_w = FRAME_W * max_frames
sheet_h = FRAME_H * num_anims
sheet = Image.new("RGBA", (sheet_w, sheet_h), (0, 0, 0, 0))

# Also generate a JSON manifest
manifest = {}
for i, (name, frames) in enumerate(ANIMS.items()):
    manifest[name] = {
        "row": i,
        "frames": len(frames),
        "frameWidth": FRAME_W,
        "frameHeight": FRAME_H,
    }
    for j, frame in enumerate(frames):
        sheet.paste(frame, (j * FRAME_W, i * FRAME_H), frame)

# Save sprite sheet (upscale 4x for rendering, keeping pixel art crisp)
SCALE = 4
sheet_up = sheet.resize((sheet_w * SCALE, sheet_h * SCALE), Image.NEAREST)
sheet_up.save(os.path.join(BASE, "bangboo-sheet.png"))

# Save manifest
import json
with open(os.path.join(BASE, "bangboo-manifest.json"), "w") as f:
    json.dump({
        "scale": SCALE,
        "animations": manifest,
    }, f, indent=2)

print(f"Sprite sheet: {sheet_w * SCALE}x{sheet_h * SCALE}px")
print(f"Animations: {list(ANIMS.keys())}")
print(f"Frame size: {FRAME_W * SCALE}x{FRAME_H * SCALE}px")
print("Done!")
