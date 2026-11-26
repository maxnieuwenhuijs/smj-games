"""De letters S, M en J van het logo losknippen van hun witte achtergrond (met de schaduw eronder).

Draaien zonder Blender-venster, vanuit de hoofdmap van de repo:
  blender --background --python tools/logo/knip.py

Leest tools/logo/bron/{s,m,j}.jpg en schrijft games/zoo/public/logo/{s,m,j}.png: doorzichtig, bijgesneden,
hooguit 512 pixels hoog. Wit en lichtgrijs dat met de rand van het plaatje verbonden is, wordt doorzichtig; wit
binnen de figuur (de ogen) blijft staan. De rand van de figuur loopt zacht af.
"""
import os
import bpy
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'tools', 'logo', 'bron')
OUT = os.path.join(ROOT, 'games', 'zoo', 'public', 'logo')
os.makedirs(OUT, exist_ok=True)
MAX = 512


def load(path):
    img = bpy.data.images.load(path)
    w, h = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
    bpy.data.images.remove(img)
    return px


def half(px):
    h, w = px.shape[0] // 2 * 2, px.shape[1] // 2 * 2
    p = px[:h, :w]
    return (p[0::2, 0::2] + p[1::2, 0::2] + p[0::2, 1::2] + p[1::2, 1::2]) / 4


def grow(mask):
    out = mask.copy()
    out[1:] |= mask[:-1]
    out[:-1] |= mask[1:]
    out[:, 1:] |= mask[:, :-1]
    out[:, :-1] |= mask[:, 1:]
    return out


def cut(px):
    rgb = px[..., :3]
    lo, hi = rgb.min(axis=2), rgb.max(axis=2)
    # achtergrond: licht en bijna grijs (wit papier en de lila schaduw)
    cand = (lo > 0.70) & (hi - lo < 0.17)
    bg = np.zeros_like(cand)
    bg[0, :] = cand[0, :]
    bg[-1, :] = cand[-1, :]
    bg[:, 0] = cand[:, 0]
    bg[:, -1] = cand[:, -1]
    while True:
        nxt = grow(bg) & cand
        if (nxt == bg).all():
            break
        bg = nxt
    alpha = np.where(bg, 0.0, 1.0).astype(np.float32)
    # de zachte rand: pixels naast de achtergrond worden half doorzichtig, hoe lichter hoe doorzichtiger
    band = grow(bg) & ~bg
    soft = np.clip((0.97 - lo) / 0.40, 0.15, 1.0)
    alpha[band] = soft[band]
    # nog een beetje gladstrijken langs de rand
    near = grow(grow(bg)) & ~(~grow(bg) & ~bg)
    pad = np.pad(alpha, 1, mode='edge')
    mean = (pad[:-2, 1:-1] + pad[2:, 1:-1] + pad[1:-1, :-2] + pad[1:-1, 2:] + 4 * alpha) / 8
    alpha = np.where(near, np.minimum(alpha, mean) if False else mean, alpha)
    alpha[bg & ~grow(~bg)] = 0.0
    # de kleur van de randpixels zonder het wit erin (anders krijgt de figuur een witte rand)
    a = np.maximum(alpha, 1e-3)[..., None]
    col = np.clip((rgb - (1 - a) * 1.0) / a, 0, 1)
    col = np.where(alpha[..., None] > 0.98, rgb, col)
    out = np.concatenate([col, alpha[..., None]], axis=2)
    # bijsnijden tot wat er te zien is, met een klein randje
    ys, xs = np.where(alpha > 0.05)
    m = 6
    y0, y1 = max(0, ys.min() - m), min(px.shape[0], ys.max() + m + 1)
    x0, x1 = max(0, xs.min() - m), min(px.shape[1], xs.max() + m + 1)
    return out[y0:y1, x0:x1]


def save(px, path):
    h, w = px.shape[:2]
    img = bpy.data.images.new('out', width=w, height=h, alpha=True)
    img.pixels[:] = px.ravel().tolist()
    k = min(1.0, MAX / max(w, h))
    if k < 1:
        img.scale(max(1, round(w * k)), max(1, round(h * k)))
    img.filepath_raw = path
    img.file_format = 'PNG'
    img.save()
    print('LOGO %s %dx%d' % (os.path.basename(path), img.size[0], img.size[1]))
    bpy.data.images.remove(img)


bpy.context.scene.view_settings.view_transform = 'Standard'
for name in ('s', 'm', 'j'):
    px = half(load(os.path.join(SRC, name + '.jpg')))
    save(cut(px), os.path.join(OUT, name + '.png'))
print('KNIP OK')
