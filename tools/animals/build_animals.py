"""Dieren uit code: elke soort in vier varianten (man, vrouw, zoontje, dochtertje).

Draaien zonder Blender-venster, vanuit de hoofdmap van de repo:
  blender --background --python tools/animals/build_animals.py -- out <modus> [soort ...]

Modus:
  export  GLB's + manifest.json naar games/zoo/public/models
  render  controleplaatjes naar de map out (familie en houdingen per soort)
  all     export en render
  sheet   alle twaalf houdingen van een soort
  styles  de leeuw in de drie stijlen (A blok, B rond, C facet)
  check   snelle controle per soort: familieplaatje + houdingen van het mannetje van opzij
  icons   kopplaatjes voor de knoppen (128x128, doorzichtig) naar games/zoo/public/icons
  info    alleen bouwen en per variant de maten tonen (driehoeken, hoogte, lengte)

Voorbeeld voor een enkele soort:
  blender --background --python tools/animals/build_animals.py -- out export giraffe
  blender --background --python tools/animals/build_animals.py -- out check giraffe
  blender --background --python tools/animals/build_animals.py -- out icons giraffe

Alle viervoeters delen hetzelfde skelet en dezelfde twaalf animaties.
"""
import bpy, bmesh, math, sys, os, json, struct, random
from types import SimpleNamespace
from mathutils import Vector, Matrix

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = os.path.abspath(ARGS[0] if ARGS else 'out')
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODELS = os.path.join(ROOT, 'games', 'zoo', 'public', 'models')
ICONS = os.path.join(ROOT, 'games', 'zoo', 'public', 'icons')
os.makedirs(OUT, exist_ok=True)
FPS = 24
STYLE = 'blok'


# ---------------------------------------------------------------- kleuren
def _lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hexc(h):
    h = h.lstrip('#')
    return (_lin(int(h[0:2], 16) / 255), _lin(int(h[2:4], 16) / 255), _lin(int(h[4:6], 16) / 255), 1.0)


# ---------------------------------------------------------------- skelet
BONES = ['root', 'body', 'head', 'lids', 'leg_FL', 'leg_FR', 'leg_HL', 'leg_HR', 'tail1', 'tail2']
PARENT = {'root': None, 'body': 'root', 'head': 'body', 'lids': 'head', 'leg_FL': 'body', 'leg_FR': 'body',
          'leg_HL': 'body', 'leg_HR': 'body', 'tail1': 'body', 'tail2': 'tail1'}
VARIANT_NAMES = ['male', 'female', 'young_m', 'young_f']

BASE_COL = dict(cream='#F7E6BC', nose='#5A3320', eye='#2B1B14', white='#FFFFFF', ear='#D49A7A')

# Drie stijlen: zelfde dier, andere vormen en verhoudingen. Het spel gebruikt 'blok'.
STYLES = {
    'blok':  dict(label='A', head=1.00, leg_w=1.0, leg_k=1.00, body_h=1.00, body_l=1.00, taper=0.0, snout=1.0),
    'rond':  dict(label='B', head=1.14, leg_w=1.2, leg_k=0.82, body_h=1.10, body_l=0.90, taper=0.5, snout=1.0),
    'facet': dict(label='C', head=0.86, leg_w=0.8, leg_k=1.30, body_h=0.90, body_l=1.20, taper=1.5, snout=1.6),
}


# ---------------------------------------------------------------- bouwer
class Builder:
    """Alle onderdelen in een enkel mesh; elk onderdeel hangt star aan een bot."""

    def __init__(self, style):
        self.style = style
        self.bm = bmesh.new()
        self.bm.loops.layers.float_color.new('Col')
        self.bm.verts.layers.deform.verify()

    def _add(self, tmp, bone, color, loc, rx, ry=0.0):
        if self.style == 'rond':
            for f in tmp.faces:
                f.smooth = True
        if rx:
            bmesh.ops.rotate(tmp, cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(rx), 3, 'X'), verts=tmp.verts)
        if ry:
            bmesh.ops.rotate(tmp, cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(ry), 3, 'Y'), verts=tmp.verts)
        bmesh.ops.translate(tmp, vec=Vector(loc), verts=tmp.verts)
        me = bpy.data.meshes.new('tmp')
        tmp.to_mesh(me)
        tmp.free()
        nv, nf = len(self.bm.verts), len(self.bm.faces)
        self.bm.from_mesh(me)
        bpy.data.meshes.remove(me)
        col = self.bm.loops.layers.float_color['Col']
        dv = self.bm.verts.layers.deform.verify()
        gi, c = BONES.index(bone), hexc(color)
        for v in list(self.bm.verts)[nv:]:
            v[dv][gi] = 1.0
        for f in list(self.bm.faces)[nf:]:
            for l in f.loops:
                l[col] = c

    def box(self, bone, color, size, loc, bevel=None, seg=2, rx=0.0, ry=0.0, taper=None, hard=False):
        """taper=(as, factor aan min-kant, factor aan plus-kant) versmalt de doorsnede.
        Zonder hard=True telt de taper alleen in de stijlen die dat willen."""
        st = self.style
        tmp = bmesh.new()
        bmesh.ops.create_cube(tmp, size=1.0)
        bmesh.ops.scale(tmp, vec=Vector(size), verts=tmp.verts)
        narrow = 1.0
        strength = 1.0 if hard else STYLES[st]['taper']
        if taper and strength:
            ax, k0, k1 = taper
            k0, k1 = 1 + (k0 - 1) * strength, 1 + (k1 - 1) * strength
            narrow = min(k0, k1, 1.0)
            for v in tmp.verts:
                kk = k0 if v.co[ax] < 0 else k1
                for i in range(3):
                    if i != ax:
                        v.co[i] *= kk
        if bevel != 0:
            if st == 'blok':
                bv, sg = (0.3 if bevel is None else bevel), seg
            elif st == 'rond':
                bv, sg = 0.46, (4 if min(size) > 0.06 else 2)
            else:
                bv, sg = (0.2 if bevel is None else min(bevel, 0.2)), 1
            bmesh.ops.bevel(tmp, geom=list(tmp.edges), offset=min(size) * narrow * bv, segments=sg,
                            profile=0.5, affect='EDGES')
        self._add(tmp, bone, color, loc, rx, ry)

    def band(self, bone, color, size, loc, bev, axis=1, seg=2, rx=0.0, ry=0.0, cut=None):
        """Band, streep of vlek: een doos waarvan alleen de randen langs `axis` zijn afgeschuind (bev in meters).
        Met dezelfde bev als de doos eronder volgt de band die doos als een schil.
        cut=(as, grens, kant) haalt alles weg aan de plus-kant (kant 1) of min-kant (kant -1) van de grens."""
        tmp = bmesh.new()
        bmesh.ops.create_cube(tmp, size=1.0)
        bmesh.ops.scale(tmp, vec=Vector(size), verts=tmp.verts)
        edges = [e for e in tmp.edges if abs((e.verts[0].co - e.verts[1].co)[axis]) > 1e-6]
        room = min(size[i] for i in range(3) if i != axis) * 0.49
        bmesh.ops.bevel(tmp, geom=edges, offset=min(bev, room), segments=seg, profile=0.5, affect='EDGES')
        if cut:
            ax, lim, side = cut
            co, no = Vector((0, 0, 0)), Vector((0, 0, 0))
            co[ax], no[ax] = lim, side
            geom = list(tmp.verts) + list(tmp.edges) + list(tmp.faces)
            bmesh.ops.bisect_plane(tmp, geom=geom, dist=1e-5, plane_co=co, plane_no=no, clear_outer=True)
        self._add(tmp, bone, color, loc, rx, ry)

    def ball(self, bone, color, radii, loc, sub=2, rx=0.0, spiky=0.0):
        st = self.style
        tmp = bmesh.new()
        bmesh.ops.create_icosphere(tmp, subdivisions=3 if st == 'rond' else sub, radius=1.0)
        if spiky and st == 'facet':
            rnd = random.Random(7)
            for v in tmp.verts:
                v.co *= 1 + spiky * rnd.random()
        bmesh.ops.scale(tmp, vec=Vector(radii), verts=tmp.verts)
        self._add(tmp, bone, color, loc, rx)

    def finish(self, name, s):
        bmesh.ops.scale(self.bm, vec=(s, s, s), verts=self.bm.verts)
        me = bpy.data.meshes.new(name)
        self.bm.to_mesh(me)
        tris = sum(len(f.verts) - 2 for f in self.bm.faces)
        self.bm.free()
        obj = bpy.data.objects.new(name, me)
        for b in BONES:
            obj.vertex_groups.new(name=b)
        return obj, tris


def get_material():
    mat = bpy.data.materials.get('AnimalVC')
    if mat:
        return mat
    mat = bpy.data.materials.new('AnimalVC')
    try:
        mat.use_nodes = True
    except Exception:
        pass
    nt = mat.node_tree
    bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if bsdf is None:
        bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
        out = next((n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'), None) or nt.nodes.new('ShaderNodeOutputMaterial')
        nt.links.new(bsdf.outputs[0], out.inputs[0])
    vc = nt.nodes.new('ShaderNodeVertexColor')
    vc.layer_name = 'Col'
    nt.links.new(vc.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.85
    return mat


# ---------------------------------------------------------------- gedeelde onderdelen
def tail_chain(c, tp, a1, a2, L1, L2, w1, w2, col1, col2, tuft=None, tuft_out=0.04, seg=2):
    """Staart in twee stukken; a1 en a2 zijn hoeken in graden (0 = recht naar achteren, plus = omhoog)."""
    b = c.b
    tp = Vector(tp)
    d1 = Vector((0, math.cos(math.radians(a1)), math.sin(math.radians(a1))))
    d2 = Vector((0, math.cos(math.radians(a2)), math.sin(math.radians(a2))))
    p2 = tp + d1 * L1
    b.box('tail1', col1, (w1, L1 + 0.05, w1), tp + d1 * L1 / 2, rx=a1, seg=seg)
    b.box('tail2', col2, (w2, L2 + 0.05, w2), p2 + d2 * L2 / 2, rx=a2, seg=seg)
    if tuft:
        b.ball('tail2', tuft[1], tuft[0], p2 + d2 * (L2 + tuft_out), sub=1, rx=a2)
    c.piv['tail1'], c.piv['tail2'] = tp, p2


def shell(c, y, length, sx, color, wf=0.7, hf=0.7):
    """Vlek: een schil die net buiten de bovenhoek van de romp steekt."""
    off = 0.012
    size = (c.bw * wf, length, c.bh * hf)
    cx = sx * (c.bw / 2 - size[0] / 2 + off)
    cz = c.bz + c.bh / 2 - size[2] / 2 + off
    body_bevel = min(c.bw, c.bl, c.bh) * (c.D.get('body_bevel') or 0.3)
    c.b.box('body', color, size, (cx, y, cz), bevel=min(0.45, body_bevel / min(size)))


# ---------------------------------------------------------------- leeuw
def lion_decor(c):
    b, C, P, k, S, style = c.b, c.C, c.P, c.k, c.S, c.style
    hcy, hz, hh, face, front, back, bz, bh = c.hcy, c.hz, c.hh, c.face, c.front, c.back, c.bz, c.bh
    if P['spots']:
        for x, y in [(0.07, -0.22), (-0.06, -0.06), (0.07, 0.10), (-0.05, 0.24)]:
            yy = y * P['body_l'] * S['body_l']
            b.box('body', C['spot'], (0.085, 0.085, 0.02), (x, yy, bz + bh / 2 * c.body_k(yy) - 0.004), seg=1)

    md = 0.15 * k * S['snout']
    tip = face - (md - 0.03 * k)
    b.box('head', C['cream'], (0.25 * k, md, 0.17 * k), (0, face - (md / 2 - 0.03 * k), hz - 0.085 * k), taper=(1, 0.8, 1.0))
    b.box('head', C['nose'], (0.10 * k, 0.05 * k, 0.06 * k), (0, tip, hz - 0.025 * k), seg=1)
    b.box('head', C['nose'], (0.02 * k, 0.02 * k, 0.055 * k), (0, tip, hz - 0.085 * k), bevel=0)

    full = P['mane'] == 'full'
    ear_x, ear_y, ear_z = (0.215 * k, hcy - 0.03 * k, hz + 0.25 * k) if full else (0.165 * k, hcy + 0.02 * k, hz + hh / 2 + 0.015 * k)
    if full and style == 'rond':
        ear_x, ear_y, ear_z = 0.21 * k, hcy - 0.12 * k, hz + 0.24 * k
    for sx in (1, -1):
        if style == 'rond':
            b.ball('head', C['body'], (0.085 * k, 0.05 * k, 0.085 * k), (sx * ear_x, ear_y, ear_z))
            b.ball('head', C['ear'], (0.05 * k, 0.03 * k, 0.05 * k), (sx * ear_x, ear_y - 0.03 * k, ear_z - 0.005 * k))
        else:
            b.box('head', C['body'], (0.14 * k, 0.07 * k, 0.13 * k), (sx * ear_x, ear_y, ear_z), taper=(2, 1.0, 0.4))
            b.box('head', C['ear'], (0.08 * k, 0.03 * k, 0.07 * k), (sx * ear_x, ear_y - 0.03 * k, ear_z - 0.005 * k),
                  seg=1, taper=(2, 1.0, 0.4))

    if full and style == 'rond':
        for i in range(9):  # manen als krans van bolletjes
            a = 2 * math.pi * i / 9
            b.ball('head', C['mane'], (0.17 * k, 0.15 * k, 0.17 * k),
                   (0.30 * k * math.sin(a), hcy + 0.06 * k, hz - 0.02 * k + 0.30 * k * math.cos(a)))
        b.ball('head', C['mane'], (0.32 * k, 0.20 * k, 0.32 * k), (0, hcy + 0.14 * k, hz - 0.02 * k))
        b.ball('body', C['mane'], (0.23, 0.18, 0.21), (0, front + 0.05, bz - 0.04))
    elif full:
        b.ball('head', C['mane'], (0.40 * k, 0.25 * k, 0.40 * k), (0, hcy + 0.09 * k, hz - 0.03 * k), sub=2, spiky=0.45)
        b.ball('body', C['mane'], (0.25, 0.20, 0.24), (0, front + 0.06, bz - 0.04), sub=1, spiky=0.2)
    elif P['mane'] == 'tuft':
        b.ball('head', C['mane'], (0.10 * k, 0.12 * k, 0.07 * k), (0, hcy - 0.02 * k, hz + hh / 2 + 0.005 * k), sub=1)
        b.ball('head', C['mane'], (0.08 * k, 0.09 * k, 0.06 * k), (0, hcy + 0.11 * k, hz + hh / 2 - 0.01 * k), sub=1)

    tail_chain(c, (0, back - 0.03, bz + 0.08), -40, 15, 0.26, 0.24, 0.07, 0.065, C['body'], C['body'],
               tuft=((0.075, 0.105, 0.075), C['tuft']))


# ---------------------------------------------------------------- varken
def pig_decor(c):
    b, C, P, k = c.b, c.C, c.P, c.k
    hcy, hz, hh, face = c.hcy, c.hz, c.hh, c.face
    sy, sz = face - 0.035 * k, hz - 0.06 * k
    b.box('head', C['snout'], (0.25 * k, 0.11 * k, 0.17 * k), (0, sy, sz), bevel=0.35)
    for sx in (1, -1):
        b.box('head', C['nostril'], (0.04 * k, 0.02 * k, 0.065 * k), (sx * 0.055 * k, sy - 0.05 * k, sz), bevel=0.3, seg=1)
        # flaporen: driehoek die naar voren hangt
        b.box('head', C['ear'], (0.18 * k, 0.05 * k, 0.20 * k), (sx * 0.20 * k, hcy - 0.07 * k, hz + hh / 2 + 0.02 * k),
              taper=(2, 1.0, 0.2), hard=True, rx=32, ry=sx * 28)
        if P.get('tusks'):
            b.box('head', C['white'], (0.04 * k, 0.04 * k, 0.09 * k), (sx * 0.145 * k, sy - 0.02 * k, sz - 0.03 * k),
                  taper=(2, 1.0, 0.3), hard=True, seg=1)
    if P.get('patch'):
        f = c.bl / 0.88
        b.box('body', C['patch'], (0.30, 0.30 * f, 0.03), (0.03, 0.08 * f, c.bz + c.bh / 2 - 0.006), seg=1)
    # krulstaart
    tail_chain(c, (0, c.back - 0.02, c.bz + 0.10), 60, 165, 0.10, 0.09, 0.05, 0.05, C['tail'], C['tail'],
               tuft=((0.035, 0.035, 0.035), C['tail']), tuft_out=0.035)


# ---------------------------------------------------------------- koe
def cow_decor(c):
    b, C, P, k = c.b, c.C, c.P, c.k
    hcy, hz, hh, hw, face = c.hcy, c.hz, c.hh, c.hw, c.face
    my, mz = face - 0.04 * k, hz - 0.11 * k
    b.box('head', C['muzzle'], (0.36 * k, 0.16 * k, 0.20 * k), (0, my, mz))
    for sx in (1, -1):
        b.box('head', C['nostril'], (0.045 * k, 0.02 * k, 0.05 * k), (sx * 0.08 * k, my - 0.075 * k, mz + 0.02 * k), bevel=0.3, seg=1)
        b.box('head', C['ear'], (0.15 * k, 0.05 * k, 0.09 * k), (sx * (hw / 2 + 0.055 * k), hcy + 0.07 * k, hz + 0.09 * k))
    horns = P.get('horns', 0)  # 0 geen, 1 stompjes, 2 klein, 3 groot
    if horns:
        hx, hy_, hl_ = {1: (0.055, 0.055, 0.05), 2: (0.055, 0.055, 0.12), 3: (0.075, 0.075, 0.22)}[horns]
        for sx in (1, -1):
            b.box('head', C['horn'], (hx * k, hy_ * k, hl_ * k),
                  (sx * (0.14 * k + hl_ * k * 0.28), hcy + 0.07 * k, hz + hh / 2 + hl_ * k * 0.36),
                  taper=(2, 1.0, 0.35), hard=True, ry=sx * (32 if horns > 1 else 0), seg=1)
    if P.get('ring'):
        ry_ = my - 0.085 * k
        for sx in (1, -1):
            b.box('head', C['ring'], (0.022 * k, 0.022 * k, 0.07 * k), (sx * 0.045 * k, ry_, mz - 0.115 * k), bevel=0)
        b.box('head', C['ring'], (0.112 * k, 0.022 * k, 0.022 * k), (0, ry_, mz - 0.15 * k), bevel=0)
    if P.get('patches'):
        f = c.bl / 1.05
        shell(c, -0.21 * f, 0.36 * f, 1, C['patch'])
        shell(c, 0.25 * f, 0.34 * f, -1, C['patch'])
        b.box('head', C['patch'], (0.17 * k, 0.03 * k, 0.17 * k), (-0.125 * k, face + 0.005 * k, hz + 0.09 * k), seg=1)
    if P.get('udder'):
        b.box('body', C['udder'], (0.24, 0.22, 0.13), (0, c.back - 0.32, c.bz - c.bh / 2 - 0.02), bevel=0.35)
    tail_chain(c, (0, c.back - 0.02, c.bz + 0.13), -68, -84, 0.24, 0.22, 0.05, 0.045, C['body'], C['body'],
               tuft=((0.06, 0.09, 0.06), C['tuft']))


# ---------------------------------------------------------------- schaap
def sheep_decor(c):
    b, C, P, k = c.b, c.C, c.P, c.k
    hcy, hz, hh, hw, face, bz, bh = c.hcy, c.hz, c.hh, c.hw, c.face, c.bz, c.bh
    f = c.bl / 0.78
    cols = [C['wool'], C['wool2']]
    pts = []
    for y in (-0.27, 0.0, 0.27):
        pts += [(0, y * f, bz + bh / 2 - 0.03, 0.19), (0.19, y * f, bz + 0.05, 0.18), (-0.19, y * f, bz + 0.05, 0.18)]
    pts += [(0, c.back - 0.02, bz + 0.02, 0.19), (0.12, c.front + 0.03, bz + 0.10, 0.15),
            (-0.12, c.front + 0.03, bz + 0.10, 0.15), (0, c.front + 0.04, bz - 0.07, 0.16)]
    for i, (x, y, z, r) in enumerate(pts):
        b.ball('body', cols[i % 2], (r, r * 1.05, r * 0.95), (x, y, z), sub=2)
    # kop: wollen kuif, lichtere snuit
    b.ball('head', C['wool'], (0.17 * k, 0.15 * k, 0.10 * k), (0, hcy + 0.06 * k, hz + hh / 2), sub=2)
    b.box('head', C['muzzle'], (0.22 * k, 0.10 * k, 0.14 * k), (0, face - 0.03 * k, hz - 0.09 * k))
    b.box('head', C['nose'], (0.075 * k, 0.03 * k, 0.045 * k), (0, face - 0.075 * k, hz - 0.045 * k), seg=1)
    horns = P.get('horns', 0)  # 0 geen, 1 stompjes, 3 gekrulde ramshoorns
    for sx in (1, -1):
        x = sx * (hw / 2 + 0.05 * k)
        b.box('head', C['ear'], (0.11 * k, 0.05 * k, 0.07 * k),
              (sx * (hw / 2 + 0.035 * k), hcy - 0.04 * k if horns == 3 else hcy + 0.05 * k, hz + 0.05 * k), ry=sx * 24)
        if horns == 3:
            # krulhoorn als vierkante spiraal: naar achteren, omlaag, naar voren, puntje omhoog
            hx = sx * (hw / 2 + 0.045 * k)
            b.box('head', C['horn'], (0.08 * k, 0.20 * k, 0.08 * k), (hx, hcy + 0.07 * k, hz + 0.19 * k))
            b.box('head', C['horn'], (0.08 * k, 0.08 * k, 0.19 * k), (hx, hcy + 0.15 * k, hz + 0.10 * k))
            b.box('head', C['horn2'], (0.07 * k, 0.17 * k, 0.07 * k), (hx + sx * 0.01 * k, hcy + 0.085 * k, hz + 0.01 * k))
            b.box('head', C['horn2'], (0.06 * k, 0.06 * k, 0.09 * k), (hx + sx * 0.02 * k, hcy + 0.02 * k, hz + 0.045 * k),
                  taper=(2, 1.0, 0.5), hard=True)
        elif horns == 1:
            b.box('head', C['horn'], (0.065 * k, 0.065 * k, 0.09 * k), (sx * 0.13 * k, hcy - 0.06 * k, hz + hh / 2 + 0.03 * k),
                  taper=(2, 1.0, 0.6), hard=True, seg=1)
    tail_chain(c, (0, c.back + 0.13, bz + 0.0), -25, -45, 0.05, 0.04, 0.07, 0.065, C['wool'], C['wool'],
               tuft=((0.05, 0.05, 0.05), C['wool2']), tuft_out=0.02)


# ---------------------------------------------------------------- nek en buik (nieuwe soorten)
def neck(c, col, w, d, y0=0.10, z0=0.04, ty=0.12, tz=-0.10, taper=None):
    """Schuine nek van de schoft naar de kop. De nek hangt aan het kop-bot en het draaipunt
    van dat bot komt onderaan de nek, zodat kop en nek samen buigen (eten, slapen).
    Geeft de maten terug om manen, strepen en vlekken langs de nek te leggen."""
    B = Vector((0, c.front + y0, c.bz + z0))
    T = Vector((0, c.hcy + ty * c.k, c.hz + tz * c.k))
    v = T - B
    L = v.length
    a = math.atan2(-v.y, v.z)
    u, n = v / L, Vector((0, math.cos(a), math.sin(a)))   # langs de nek, en haaks erop naar achteren
    ext = 0.06
    k0, k1 = (taper[1], taper[2]) if taper else (1.0, 1.0)
    c.b.box('head', col, (w, d, L + 2 * ext), (B + T) / 2, rx=math.degrees(a), taper=taper, hard=bool(taper))
    c.piv['head'] = c.piv['lids'] = B.copy()
    # kopplaatje: alleen het bovenste stuk nek hoeft in beeld
    c.extra['icon_low'] = c.hz - c.hh / 2 - 0.16 * c.k

    def kf(f):
        return k0 + (k1 - k0) * (f * L + ext) / (L + 2 * ext)

    def at(f, back=0.0, x=0.0):
        return B + u * (L * f) + n * back + Vector((x, 0, 0))
    return SimpleNamespace(B=B, T=T, L=L, deg=math.degrees(a), at=at, kf=kf, w=w, d=d,
                           bev=min(w, d) * min(k0, k1, 1.0) * 0.3)


def belly(c, col, frac=0.36):
    """Lichte buik: schil om de onderste strook van de romp."""
    L = c.bl - 2 * c.body_bev + 0.06
    c.b.band('body', col, (c.bw + 0.016, L, c.bh + 0.016), (0, 0, c.bz), c.body_bev,
             cut=(2, -c.bh / 2 + c.bh * frac, 1))


# ---------------------------------------------------------------- paard
def horse_decor(c):
    b, C, P, k = c.b, c.C, c.P, c.k
    hcy, hz, hh, hl, face, bz = c.hcy, c.hz, c.hh, c.hl, c.face, c.bz
    nk = neck(c, C['body'], 0.21, 0.27, taper=(2, 1.2, 0.85))
    # lange snuit
    my, mz = face - 0.10 * k, hz - 0.095 * k
    b.box('head', C['muzzle'], (0.24 * k, 0.30 * k, 0.21 * k), (0, my, mz))
    for sx in (1, -1):
        b.box('head', C['nostril'], (0.04 * k, 0.02 * k, 0.045 * k), (sx * 0.06 * k, my - 0.145 * k, mz + 0.03 * k),
              bevel=0.3, seg=1)
        b.box('head', C['body'], (0.085 * k, 0.05 * k, 0.16 * k), (sx * 0.105 * k, hcy + 0.09 * k, hz + hh / 2 + 0.055 * k),
              taper=(2, 1.0, 0.35), hard=True, seg=1)
    # manen: kuif, kruin, achterhoofd en een rand langs de nek
    m = C['mane']
    if P.get('forelock'):
        b.box('head', m, (0.11 * k, 0.05 * k, 0.13 * k), (0, face - 0.012 * k, hz + hh / 2 - 0.035 * k),
              taper=(2, 0.55, 1.0), hard=True, seg=1)
    b.box('head', m, (0.11 * k, hl * 0.9, 0.06 * k), (0, hcy + 0.03 * k, hz + hh / 2 + 0.012 * k), seg=1)
    b.box('head', m, (0.10 * k, 0.07 * k, hh * 0.8), (0, hcy + hl / 2 + 0.015 * k, hz + 0.02 * k), seg=1)
    b.box('head', m, (0.10, 0.09, nk.L * 0.95), nk.at(0.5, back=nk.d / 2 * nk.kf(0.5) + 0.02), rx=nk.deg, seg=1)
    if P.get('blaze'):  # witte bles over het voorhoofd en de neus
        b.box('head', C['white'], (0.07 * k, 0.02 * k, 0.20 * k), (0, face - 0.002 * k, hz + 0.085 * k), bevel=0)
        b.box('head', C['white'], (0.07 * k, 0.22 * k, 0.02 * k), (0, my - 0.045 * k, mz + 0.099 * k), bevel=0)
        b.box('head', C['white'], (0.07 * k, 0.02 * k, 0.10 * k), (0, my - 0.144 * k, mz + 0.055 * k), bevel=0)
    tail_chain(c, (0, c.back - 0.03, bz + 0.13), -48, -78, 0.22, 0.30, 0.10, 0.115, m, m, seg=1)


# ---------------------------------------------------------------- ezel
def donkey_decor(c):
    b, C, P, k = c.b, c.C, c.P, c.k
    hcy, hz, hh, face, bz, bh = c.hcy, c.hz, c.hh, c.face, c.bz, c.bh
    nk = neck(c, C['body'], 0.23, 0.27, taper=(2, 1.15, 0.9))
    belly(c, C['belly'], 0.42)
    my, mz = face - 0.07 * k, hz - 0.10 * k
    b.box('head', C['muzzle'], (0.27 * k, 0.24 * k, 0.22 * k), (0, my, mz))
    exk, ezk = c.D['eye']
    for sx in (1, -1):
        b.box('head', C['nostril'], (0.045 * k, 0.02 * k, 0.04 * k), (sx * 0.065 * k, my - 0.115 * k, mz + 0.035 * k),
              bevel=0.3, seg=1)
        # lichte vlek om het oog
        b.box('head', C['muzzle'], (0.115 * k, 0.014 * k, 0.125 * k), (sx * exk * k, face, hz + ezk * k), seg=1)
        # lange oren met lichte binnenkant
        ear = (sx * 0.135 * k, hcy + 0.10 * k, hz + hh / 2 + 0.14 * k)
        b.box('head', C['body'], (0.105 * k, 0.06 * k, 0.34 * k), ear, taper=(2, 0.9, 0.45), hard=True, ry=sx * 10)
        b.box('head', C['ear'], (0.055 * k, 0.02 * k, 0.23 * k), (ear[0], ear[1] - 0.032 * k, ear[2]),
              taper=(2, 0.9, 0.45), hard=True, ry=sx * 10, seg=1)
    m = C['mane']
    b.box('head', m, (0.07, 0.07, nk.L * 0.9), nk.at(0.5, back=nk.d / 2 * nk.kf(0.5) + 0.015), rx=nk.deg, seg=1)
    if P.get('fluff'):  # jong: pluizige bol op het voorhoofd
        b.ball('head', C['body'], (0.15 * k, 0.13 * k, 0.09 * k), (0, hcy - 0.01 * k, hz + hh / 2 + 0.015 * k))
    else:
        b.box('head', m, (0.10 * k, 0.14 * k, 0.07 * k), (0, hcy + 0.06 * k, hz + hh / 2 + 0.015 * k), seg=1)
    if P.get('cross'):  # ezelskruis: streep over de rug en over de schouders
        b.box('body', m, (0.07, c.bl - 2 * c.body_bev - 0.02, 0.02), (0, 0.03, bz + bh / 2 + 0.002), bevel=0)
        b.band('body', m, (c.bw + 0.02, 0.07, bh + 0.02), (0, c.front + 0.30, bz), c.body_bev, cut=(2, 0.03, -1))
    tail_chain(c, (0, c.back - 0.02, bz + 0.12), -62, -80, 0.20, 0.14, 0.05, 0.045, C['body'], C['body'],
               tuft=((0.055, 0.085, 0.055), m), seg=1)


# ---------------------------------------------------------------- geit
def goat_decor(c):
    b, C, P, k = c.b, c.C, c.P, c.k
    hcy, hz, hh, hw, face, bz, bh = c.hcy, c.hz, c.hh, c.hw, c.face, c.bz, c.bh
    neck(c, C['body'], 0.19, 0.22, taper=(2, 1.15, 0.9))
    my, mz = face - 0.05 * k, hz - 0.085 * k
    b.box('head', C['muzzle'], (0.22 * k, 0.17 * k, 0.17 * k), (0, my, mz))
    b.box('head', C['nose'], (0.08 * k, 0.03 * k, 0.045 * k), (0, my - 0.085 * k, mz + 0.045 * k), seg=1)
    beard = {0: 0, 1: 0.09, 2: 0.17}[P.get('beard', 0)]
    if beard:  # sikje onder de kin
        b.box('head', C['beard'], (0.085 * k, 0.07 * k, beard * k), (0, my + 0.005 * k, mz - 0.07 * k - beard * k / 2),
              taper=(2, 0.35, 1.0), hard=True, seg=1)
    horns = P.get('horns', 0)  # 0 geen, 1 stompjes, 2 klein, 3 groot en gebogen
    for sx in (1, -1):
        b.box('head', C['ear'], (0.15 * k, 0.05 * k, 0.08 * k), (sx * (hw / 2 + 0.05 * k), hcy + 0.07 * k, hz + 0.045 * k),
              ry=sx * 22)
        top = hz + hh / 2
        if horns == 3:  # eerst schuin omhoog, dan in een boog naar achteren
            b.box('head', C['horn'], (0.075 * k, 0.075 * k, 0.22 * k), (sx * 0.09 * k, hcy + 0.04 * k, top + 0.08 * k),
                  rx=-25, seg=1)
            b.box('head', C['horn'], (0.065 * k, 0.065 * k, 0.21 * k), (sx * 0.10 * k, hcy + 0.175 * k, top + 0.165 * k),
                  rx=-100, taper=(2, 1.0, 0.3), hard=True, seg=1)
        elif horns == 2:
            b.box('head', C['horn'], (0.055 * k, 0.055 * k, 0.13 * k), (sx * 0.085 * k, hcy + 0.05 * k, top + 0.04 * k),
                  rx=-20, taper=(2, 1.0, 0.35), hard=True, seg=1)
        elif horns == 1:
            b.box('head', C['horn'], (0.055 * k, 0.055 * k, 0.07 * k), (sx * 0.085 * k, hcy + 0.04 * k, top + 0.015 * k),
                  taper=(2, 1.0, 0.6), hard=True, seg=1)
    if P.get('udder'):
        b.box('body', C['udder'], (0.19, 0.17, 0.11), (0, c.back - 0.25, bz - bh / 2 - 0.015), bevel=0.35)
    if P.get('stripe'):  # donkere aalstreep over de rug
        b.box('body', C['stripe'], (0.07, c.bl - 2 * c.body_bev - 0.02, 0.02), (0, 0.03, bz + bh / 2 + 0.002), bevel=0)
    tail_chain(c, (0, c.back - 0.03, bz + 0.13), 45, 68, 0.07, 0.06, 0.07, 0.06, C['body'], C['body'], seg=1)


# ---------------------------------------------------------------- alpaca
def alpaca_decor(c):
    b, C, P, k = c.b, c.C, c.P, c.k
    hcy, hz, hh, face, bz = c.hcy, c.hz, c.hh, c.face, c.bz
    nk = neck(c, C['wool'], 0.19, 0.20, z0=0.06, taper=(2, 1.2, 0.9))
    f = c.bl / 0.66
    cols = [C['wool'], C['wool2']]
    # wolbollen: spaarzaam, acht om de romp en twee om de nek (80 driehoeken per bol)
    pts = [(0, -0.15 * f, bz + 0.13, 0.20), (0, 0.15 * f, bz + 0.13, 0.20),
           (0.14, -0.16 * f, bz - 0.02, 0.18), (-0.14, 0.16 * f, bz - 0.02, 0.18),
           (0.14, 0.16 * f, bz - 0.02, 0.18), (-0.14, -0.16 * f, bz - 0.02, 0.18),
           (0, c.back - 0.03, bz + 0.02, 0.19), (0, c.front + 0.03, bz - 0.04, 0.18)]
    for i, (x, y, z, r) in enumerate(pts):
        b.ball('body', cols[i % 2], (r, r * 1.05, r * 0.95), (x, y, z))
    b.ball('head', C['wool2'], (0.15, 0.15, 0.14), nk.at(0.26, back=0.02))
    b.ball('head', C['wool'], (0.125, 0.125, 0.12), nk.at(0.60, back=-0.01))
    # klein kopje met kuif
    b.ball('head', C['wool'], (0.17 * k, 0.17 * k, 0.12 * k), (0, hcy + 0.02 * k, hz + hh / 2 + 0.02 * k))
    b.ball('head', C['wool2'], (0.10 * k, 0.08 * k, 0.07 * k), (0, face + 0.02 * k, hz + hh / 2 - 0.005 * k))
    b.box('head', C['muzzle'], (0.17 * k, 0.13 * k, 0.13 * k), (0, face - 0.04 * k, hz - 0.065 * k))
    b.box('head', C['nose'], (0.06 * k, 0.025 * k, 0.035 * k), (0, face - 0.105 * k, hz - 0.03 * k), seg=1)
    for sx in (1, -1):
        b.box('head', C['head'], (0.075 * k, 0.045 * k, 0.14 * k), (sx * 0.13 * k, hcy + 0.10 * k, hz + hh / 2 + 0.045 * k),
              taper=(2, 1.0, 0.4), hard=True, seg=1, ry=sx * 14)
    tail_chain(c, (0, c.back + 0.11, bz + 0.04), -20, -45, 0.05, 0.04, 0.07, 0.065, C['wool'], C['wool'],
               tuft=((0.055, 0.055, 0.055), C['wool2']), tuft_out=0.02, seg=1)


# ---------------------------------------------------------------- zebra
def zebra_decor(c):
    b, C, P, k = c.b, c.C, c.P, c.k
    hcy, hz, hh, hw, hl, face, bz, bh = c.hcy, c.hz, c.hh, c.hw, c.hl, c.face, c.bz, c.bh
    nk = neck(c, C['body'], 0.22, 0.27)   # recht, zonder versmalling, zodat de banden passen
    st, sw, n = C['stripe'], P['stripe_w'], P['stripes']
    # strepen als banden om romp, nek, poten en kop
    y0, y1 = c.front + 0.27, c.back - 0.11
    for i in range(n):
        b.band('body', st, (c.bw + 0.022, sw, bh + 0.022), (0, y0 + (y1 - y0) * i / (n - 1), bz), c.body_bev)
    nn = P.get('neck_stripes', 3)
    for i in range(nn):
        b.band('head', st, (nk.w + 0.022, nk.d + 0.022, sw * 0.85), nk.at(0.24 + 0.62 * i / max(1, nn - 1)), nk.bev,
               axis=2, rx=nk.deg)
    for bone, x, y in c.legs:
        for fz in P.get('leg_rings', (0.40, 0.68)):
            b.band(bone, st, (c.leg_w + 0.02, c.leg_d + 0.02, sw * 0.6), (x, y, c.leg_len * fz), c.leg_w * 0.3, axis=2)
    for dy in (0.035, 0.125):
        b.band('head', st, (hw + 0.02, 0.045 * k, hh + 0.02), (0, hcy + dy * k, hz), min(hw, hl, hh) * 0.3)
    # zwarte snuit
    my, mz = face - 0.09 * k, hz - 0.085 * k
    b.box('head', C['muzzle'], (0.24 * k, 0.28 * k, 0.21 * k), (0, my, mz))
    for sx in (1, -1):
        b.box('head', C['nostril'], (0.04 * k, 0.02 * k, 0.04 * k), (sx * 0.06 * k, my - 0.135 * k, mz + 0.03 * k),
              bevel=0.3, seg=1)
        ear = (sx * 0.105 * k, hcy + 0.11 * k, hz + hh / 2 + 0.055 * k)
        b.box('head', C['body'], (0.09 * k, 0.05 * k, 0.16 * k), ear, taper=(2, 1.0, 0.45), hard=True, seg=1)
        b.box('head', st, (0.045 * k, 0.02 * k, 0.09 * k), (ear[0], ear[1] - 0.026 * k, ear[2] - 0.005 * k),
              taper=(2, 1.0, 0.45), hard=True, seg=1)
    # korte staande manen: blokjes om en om zwart en wit
    nm = 5
    for i in range(nm):
        b.box('head', st if i % 2 == 0 else C['body'], (0.08, 0.085, nk.L / nm + 0.004),
              nk.at((i + 0.5) / nm, back=nk.d / 2 + 0.025), rx=nk.deg, seg=1)
    b.box('head', st, (0.09 * k, 0.17 * k, 0.07 * k), (0, hcy + 0.0 * k, hz + hh / 2 + 0.02 * k), seg=1)
    b.box('head', st, (0.08 * k, 0.06 * k, hh * 0.7), (0, hcy + hl / 2 + 0.012 * k, hz + 0.03 * k), seg=1)
    tail_chain(c, (0, c.back - 0.02, bz + 0.12), -62, -80, 0.20, 0.16, 0.055, 0.05, C['body'], C['body'],
               tuft=((0.055, 0.09, 0.055), st), seg=1)


# ---------------------------------------------------------------- giraf
def giraffe_decor(c):
    b, C, P, k = c.b, c.C, c.P, c.k
    hcy, hz, hh, hw, face, bz, bh, bw = c.hcy, c.hz, c.hh, c.hw, c.face, c.bz, c.bh, c.bw
    nk = neck(c, C['body'], 0.20, 0.22, y0=0.12, z0=0.06, taper=(2, 1.25, 0.85))
    sp, t = C['spot'], 0.026

    def spot(bone, size, loc, axis, rx=0.0):   # vlek met afgeronde hoeken
        b.band(bone, sp, size, loc, sorted(size)[1] * 0.3, axis=axis, seg=1, rx=rx)
    f = c.bl / 0.72
    for sx in (1, -1):
        for y, z, ly, lz in [(-0.17, 0.035, 0.15, 0.14), (0.03, -0.035, 0.14, 0.13), (0.21, 0.04, 0.13, 0.13)]:
            spot('body', (t, ly * f, lz), (sx * (bw / 2 + 0.001), (y + sx * 0.015) * f, bz + z), 0)
    for x, y, lx_, ly in [(0.05, 0.0, 0.15, 0.14), (-0.05, 0.19, 0.14, 0.14)]:
        spot('body', (lx_, ly * f, t), (x, y * f, bz + bh / 2 + 0.001), 2)
    spot('body', (0.15, t, 0.12), (0.0, c.back + 0.001, bz - 0.04), 1)
    for bone, x, y in c.legs:
        sx = 1 if x > 0 else -1
        spot(bone, (t, c.leg_d * 0.75, 0.11), (x + sx * (c.leg_w / 2 + 0.001), y, c.leg_len * 0.74), 0)
        spot(bone, (t, c.leg_d * 0.6, 0.08), (x + sx * (c.leg_w / 2 + 0.001), y, c.leg_len * 0.50), 0)
    n = P.get('neck_spots', 4)
    for sx in (1, -1):
        for i in range(n):
            fr = 0.16 + 0.68 * i / max(1, n - 1)
            off = 0.02 if (i + (sx > 0)) % 2 else -0.02
            spot('head', (t, 0.10, 0.115), nk.at(fr, back=off, x=sx * (nk.w / 2 * nk.kf(fr) + 0.001)), 0, rx=nk.deg)
    for i in range(n - 1):
        fr = 0.28 + 0.56 * i / max(1, n - 2)
        spot('head', (0.10, t, 0.10), nk.at(fr, back=-(nk.d / 2 * nk.kf(fr) + 0.001)), 1, rx=nk.deg)
    # kop: lichte snuit, twee hoorntjes met een bolletje, oren opzij
    my, mz = face - 0.085 * k, hz - 0.06 * k
    b.box('head', C['muzzle'], (0.21 * k, 0.25 * k, 0.17 * k), (0, my, mz))
    for sx in (1, -1):
        b.box('head', C['nostril'], (0.035 * k, 0.02 * k, 0.035 * k), (sx * 0.05 * k, my - 0.12 * k, mz + 0.03 * k),
              bevel=0.3, seg=1)
        b.box('head', C['body'], (0.04 * k, 0.04 * k, 0.12 * k), (sx * 0.075 * k, hcy + 0.05 * k, hz + hh / 2 + 0.05 * k), seg=1)
        b.box('head', C['knob'], (0.07 * k, 0.07 * k, 0.06 * k), (sx * 0.075 * k, hcy + 0.05 * k, hz + hh / 2 + 0.125 * k),
              bevel=0.4, seg=1)
        b.box('head', C['body'], (0.14 * k, 0.045 * k, 0.075 * k), (sx * (hw / 2 + 0.055 * k), hcy + 0.11 * k, hz + 0.075 * k),
              ry=-sx * 12)
    b.box('head', C['mane'], (0.05, 0.05, nk.L * 0.92), nk.at(0.5, back=nk.d / 2 * nk.kf(0.5) + 0.012), rx=nk.deg, seg=1)
    tail_chain(c, (0, c.back - 0.02, bz + 0.10), -68, -84, 0.22, 0.18, 0.045, 0.04, C['body'], C['body'],
               tuft=((0.05, 0.085, 0.05), C['knob']), seg=1)


# ---------------------------------------------------------------- olifant
def elephant_decor(c):
    b, C, P, k = c.b, c.C, c.P, c.k
    hcy, hz, hh, hw, face, bz = c.hcy, c.hz, c.hh, c.hw, c.face, c.bz
    # slurf aan het kop-bot: twee stukken omlaag, het puntje krult naar voren.
    # Niet langer dan de poten, anders zakt hij bij liggen door de grond.
    tl = P.get('trunk', 1.0)
    z0 = hz - 0.03 * k
    l1, l2 = 0.26 * k * tl, 0.20 * k * tl
    b.box('head', C['body'], (0.20 * k, 0.18 * k, l1 + 0.04 * k), (0, face - 0.05 * k, z0 - l1 / 2 + 0.02 * k),
          taper=(2, 0.85, 1.0), hard=True)
    b.box('head', C['body'], (0.16 * k, 0.15 * k, l2 + 0.05 * k), (0, face - 0.07 * k, z0 - l1 - l2 / 2 + 0.025 * k),
          taper=(2, 0.9, 1.0), hard=True)
    b.box('head', C['trunk'], (0.13 * k, 0.17 * k, 0.10 * k), (0, face - 0.115 * k, z0 - l1 - l2 - 0.01 * k))
    # grote flaporen met lichte binnenkant
    for sx in (1, -1):
        ex = sx * (hw / 2 + 0.14 * k)
        b.band('head', C['body'], (0.36 * k, 0.07 * k, 0.50 * k), (ex, hcy + 0.13 * k, hz + 0.02 * k), 0.11 * k, ry=sx * 5)
        b.band('head', C['ear_in'], (0.23 * k, 0.02 * k, 0.36 * k), (ex + sx * 0.015 * k, hcy + 0.09 * k, hz + 0.02 * k),
               0.08 * k, seg=1, ry=sx * 5)
    tusks = P.get('tusks', 0)  # 0 geen, 1 mini, 2 groot
    if tusks:
        ln, tw = {1: (0.11 * k, 0.05 * k), 2: (0.26 * k, 0.075 * k)}[tusks]
        for sx in (1, -1):   # vanaf de mondhoek schuin naar voren en omlaag
            b.box('head', C['tusk'], (tw, tw, ln), (sx * 0.17 * k, face + 0.02 * k - 0.32 * ln, hz - 0.21 * k - 0.38 * ln),
                  taper=(2, 0.3, 1.0), hard=True, rx=-40, seg=1)
    if P.get('hair'):  # jong: kuifje van drie haren
        for dx in (-0.05, 0.0, 0.05):
            b.box('head', C['tuft'], (0.03 * k, 0.03 * k, 0.10 * k), (dx * k, hcy - 0.03 * k + abs(dx) * 0.5 * k, hz + hh / 2 + 0.035 * k),
                  taper=(2, 1.0, 0.4), hard=True, seg=1, ry=dx * 240)
    for bone, x, y in c.legs:   # teennagels
        for dx in (-0.055, 0.055):
            b.box(bone, C['nail'], (0.06, 0.02, 0.05), (x + dx, y - c.leg_d / 2 - 0.012, 0.03), bevel=0)
    tail_chain(c, (0, c.back - 0.02, bz + 0.14), -70, -84, 0.20, 0.16, 0.055, 0.05, C['body'], C['body'],
               tuft=((0.05, 0.075, 0.05), C['tuft']), seg=1)


# ---------------------------------------------------------------- neushoorn
def rhino_decor(c):
    b, C, P, k = c.b, c.C, c.P, c.k
    hcy, hz, hh, face, bz, bh = c.hcy, c.hz, c.hh, c.face, c.bz, c.bh
    # brede, lage snuit; daarbovenop de hoorns
    sy, sz = face - 0.13 * k, hz - 0.07 * k
    b.box('head', C['body'], (0.42 * k, 0.34 * k, 0.28 * k), (0, sy, sz))
    top = sz + 0.14 * k
    h1, h2 = P['horns']   # hoogte van de voorste en de achterste hoorn
    if h1:
        w1 = min(0.13, max(0.085, h1 * 0.45)) * k
        b.box('head', C['horn'], (w1, w1, h1 * k + 0.03 * k), (0, sy - 0.09 * k, top + h1 * k / 2 - 0.015 * k),
              taper=(2, 1.0, 0.25), hard=True, rx=-8)
    if h2:
        w2 = min(0.10, max(0.08, h2 * 0.5)) * k
        b.box('head', C['horn'], (w2, w2, h2 * k + 0.03 * k), (0, sy + 0.07 * k, top + h2 * k / 2 - 0.015 * k),
              taper=(2, 1.0, 0.3), hard=True, seg=1)
    for sx in (1, -1):
        b.box('head', C['nostril'], (0.05 * k, 0.02 * k, 0.035 * k), (sx * 0.11 * k, sy - 0.165 * k, sz + 0.02 * k),
              bevel=0.3, seg=1)
        ear = (sx * 0.17 * k, hcy + 0.17 * k, hz + hh / 2 + 0.04 * k)
        b.box('head', C['body'], (0.10 * k, 0.07 * k, 0.14 * k), ear, taper=(2, 1.0, 0.5), hard=True, seg=1, ry=sx * 14)
        b.box('head', C['ear_in'], (0.05 * k, 0.02 * k, 0.08 * k), (ear[0], ear[1] - 0.034 * k, ear[2]),
              taper=(2, 1.0, 0.5), hard=True, seg=1, ry=sx * 14)
    # pantserplaten: twee brede banden om schouders en heupen
    w = (c.bl - 2 * c.body_bev) * 0.42
    for y in (c.front + c.body_bev + w / 2 - 0.02, c.back - c.body_bev - w / 2 + 0.02):
        b.band('body', C['plate'], (c.bw + 0.03, w, bh + 0.03), (0, y, bz), c.body_bev)
    tail_chain(c, (0, c.back - 0.02, bz + 0.12), -70, -84, 0.14, 0.10, 0.05, 0.045, C['body'], C['body'],
               tuft=((0.045, 0.06, 0.045), C['plate']), seg=1)


# ---------------------------------------------------------------- nijlpaard
def hippo_decor(c):
    b, C, P, k = c.b, c.C, c.P, c.k
    hcy, hz, hh, face, bz = c.hcy, c.hz, c.hh, c.face, c.bz
    belly(c, C['pink'], 0.38)
    # enorme brede snuit met roze onderkaak
    sy, sz = face - 0.13 * k, hz - 0.06 * k
    b.box('head', C['body'], (0.66 * k, 0.36 * k, 0.30 * k), (0, sy, sz), bevel=0.35)
    b.box('head', C['pink'], (0.60 * k, 0.33 * k, 0.12 * k), (0, sy + 0.005 * k, sz - 0.16 * k), bevel=0.4)
    exk, ezk = c.D['eye']
    for sx in (1, -1):
        # neusgaten bovenop
        b.box('head', C['body'], (0.11 * k, 0.10 * k, 0.07 * k), (sx * 0.16 * k, sy - 0.10 * k, sz + 0.155 * k), seg=1)
        b.box('head', C['nostril'], (0.05 * k, 0.02 * k, 0.03 * k), (sx * 0.16 * k, sy - 0.147 * k, sz + 0.165 * k), bevel=0)
        # oogbulten bovenop de kop, kleine oortjes
        b.box('head', C['body'], (0.13 * k, 0.13 * k, 0.15 * k), (sx * exk * k, face + 0.065 * k, hz + ezk * k), bevel=0.2)
        ear = (sx * 0.21 * k, hcy + 0.16 * k, hz + hh / 2 + 0.03 * k)
        b.box('head', C['body'], (0.10 * k, 0.06 * k, 0.10 * k), ear, bevel=0.4, seg=1)
        b.box('head', C['pink'], (0.05 * k, 0.02 * k, 0.05 * k), (ear[0], ear[1] - 0.03 * k, ear[2]), seg=1)
        teeth = P.get('teeth', 0)
        if teeth:   # twee tanden die uit de onderkaak omhoog steken
            b.box('head', C['white'], (0.06 * k * teeth, 0.05 * k, 0.085 * k * teeth),
                  (sx * 0.20 * k, sy - 0.165 * k, sz - 0.10 * k + 0.04 * k * teeth), taper=(2, 1.0, 0.6), hard=True, seg=1)
        if P.get('cheeks'):
            b.box('head', C['cheek'], (0.11 * k, 0.02 * k, 0.07 * k), (sx * 0.17 * k, sy - 0.172 * k, sz + 0.02 * k), seg=1)
    tail_chain(c, (0, c.back - 0.02, bz + 0.10), -60, -80, 0.09, 0.07, 0.07, 0.06, C['body'], C['body'], seg=1)


# ---------------------------------------------------------------- kameel (dromedaris)
def camel_decor(c):
    b, C, P, k = c.b, c.C, c.P, c.k
    hcy, hz, hh, face, bz, bh = c.hcy, c.hz, c.hh, c.face, c.bz, c.bh
    nk = neck(c, C['body'], 0.18, 0.21, y0=0.08, z0=-0.02, taper=(2, 1.25, 0.88))
    # een bult: brede voet, smalle ronde top
    hw_, hl_, hh_ = P['hump']
    f = c.bl / 0.90
    b.box('body', C['body'], (hw_, hl_ * f, hh_ + 0.14), (0, 0.05 * f, bz + bh / 2 + hh_ / 2 - 0.07), bevel=0.42,
          taper=(2, 1.0, 0.55), hard=True)
    fur = C['fur']
    if P.get('fluff'):   # jong: pluizig
        b.ball('body', fur, (hw_ * 0.36, hl_ * f * 0.36, 0.06), (0, 0.05 * f, bz + bh / 2 + hh_ - 0.01))
        b.ball('head', fur, (0.15 * k, 0.14 * k, 0.09 * k), (0, hcy + 0.02 * k, hz + hh / 2 + 0.015 * k))
        b.ball('head', fur, (0.13, 0.11, 0.12), nk.at(0.22, back=-0.07))
    else:
        b.box('head', fur, (0.15 * k, 0.17 * k, 0.07 * k), (0, hcy + 0.03 * k, hz + hh / 2 + 0.015 * k), bevel=0.4, seg=1)
    # snuit met hangende onderlip
    my, mz = face - 0.09 * k, hz - 0.05 * k
    b.box('head', C['muzzle'], (0.23 * k, 0.26 * k, 0.17 * k), (0, my, mz))
    b.box('head', C['lip'], (0.18 * k, 0.16 * k, 0.08 * k), (0, my - 0.065 * k, mz - 0.105 * k), bevel=0.4)
    for sx in (1, -1):
        b.box('head', C['nostril'], (0.045 * k, 0.02 * k, 0.025 * k), (sx * 0.055 * k, my - 0.125 * k, mz + 0.04 * k), bevel=0)
        # kleine oren opzij van de kop
        b.box('head', C['body'], (0.10 * k, 0.05 * k, 0.075 * k), (sx * (c.hw / 2 + 0.035 * k), hcy + 0.12 * k, hz + hh / 2 - 0.05 * k),
              ry=-sx * 22, seg=1)
    tail_chain(c, (0, c.back - 0.02, bz + 0.12), -66, -82, 0.18, 0.14, 0.05, 0.045, C['body'], C['body'],
               tuft=((0.05, 0.075, 0.05), fur), seg=1)


# ---------------------------------------------------------------- recepten
YOUNG = dict(head_k=1.32, leg_k=0.72, body_l=0.78, eye_k=1.25)
SPECIES = {
    'lion': dict(
        decor=lion_decor,
        dims=dict(leg_len=0.42, leg_w=0.17, leg_d=0.19, bw=0.50, bl=0.95, bh=0.44, BT=(1.08, 0.82),
                  head=(0.46, 0.40, 0.42)),
        col={},
        variants={
            'male':    dict(s=1.00, head_k=1.00, leg_k=0.90, body_l=1.00, eye_k=1.0, mane='full', spots=False,
                            col=dict(body='#E3A23C', mane='#8A4A1E', tuft='#8A4A1E', spot='#C98A30')),
            'female':  dict(s=0.92, head_k=0.96, leg_k=0.90, body_l=1.00, eye_k=1.0, mane=None, spots=False,
                            col=dict(body='#E8AE4C', mane='#8A4A1E', tuft='#9A5A26', spot='#C98A30')),
            'young_m': dict(s=0.56, **YOUNG, mane='tuft', spots=True,
                            col=dict(body='#EDB95A', mane='#A85F24', tuft='#A85F24', spot='#D49A3E')),
            'young_f': dict(s=0.56, **YOUNG, mane=None, spots=True,
                            col=dict(body='#F2C776', mane='#A85F24', tuft='#B87030', spot='#DCA94E')),
        }),
    'pig': dict(
        decor=pig_decor,
        dims=dict(leg_len=0.26, leg_w=0.15, leg_d=0.16, bw=0.56, bl=0.88, bh=0.52, BT=(1.0, 1.0), body_bevel=0.4,
                  head=(0.48, 0.38, 0.44), head_at=(0.10, 0.20), eye=(0.14, 0.105),
                  paw=(0.012, 0.012, 0.07, 0.0), leg_f=0.17, leg_h=0.16, leg_in=0.04),
        col=dict(nostril='#8A3A4C', paw='#A0686F'),
        variants={
            'male':    dict(s=0.75, head_k=1.00, leg_k=1.0, body_l=1.00, eye_k=1.0, tusks=True,
                            col=dict(body='#E0879A', snout='#C96079', ear='#CF6F86', tail='#CF6F86')),
            'female':  dict(s=0.70, head_k=0.97, leg_k=1.0, body_l=1.00, eye_k=1.0,
                            col=dict(body='#F4AEBB', snout='#E58499', ear='#E993A5', tail='#E993A5')),
            'young_m': dict(s=0.43, head_k=1.30, leg_k=0.85, body_l=0.80, eye_k=1.3, patch=True,
                            col=dict(body='#F8C6D0', snout='#EC9AAD', ear='#EFA8B7', tail='#EFA8B7', patch='#B45C76')),
            'young_f': dict(s=0.43, head_k=1.30, leg_k=0.85, body_l=0.80, eye_k=1.3,
                            col=dict(body='#FBD3DA', snout='#F0A3B4', ear='#F3B2BF', tail='#F3B2BF')),
        }),
    'cow': dict(
        decor=cow_decor,
        dims=dict(leg_len=0.46, leg_w=0.15, leg_d=0.16, bw=0.54, bl=1.05, bh=0.50, BT=(1.0, 1.0),
                  head=(0.40, 0.42, 0.42), head_at=(0.32, 0.25), eye=(0.125, 0.09),
                  paw=(0.012, 0.012, 0.09, 0.0)),
        col=dict(paw='#3A3030', nostril='#7A4A50', horn='#F0E6CC', ring='#E8B830', udder='#F4A9B8', patch='#2E2A2A'),
        variants={
            'male':    dict(s=1.10, head_k=1.00, leg_k=1.0, body_l=1.00, eye_k=1.0, horns=3, ring=True,
                            col=dict(body='#8B5A3A', muzzle='#E3BFA6', ear='#7A4D31', tuft='#4A2E1C')),
            'female':  dict(s=1.02, head_k=0.97, leg_k=1.0, body_l=1.00, eye_k=1.0, horns=2, udder=True, patches=True,
                            col=dict(body='#FAF8F2', muzzle='#F2AEB6', ear='#2E2A2A', tuft='#2E2A2A')),
            'young_m': dict(s=0.60, head_k=1.30, leg_k=0.85, body_l=0.80, eye_k=1.25, horns=1,
                            col=dict(body='#A9744C', muzzle='#EBCDB8', ear='#96633F', tuft='#5A3A24')),
            'young_f': dict(s=0.60, head_k=1.30, leg_k=0.85, body_l=0.80, eye_k=1.25, horns=0, patches=True,
                            col=dict(body='#FAF8F2', muzzle='#F5BBC2', ear='#2E2A2A', tuft='#2E2A2A')),
        }),
    'sheep': dict(
        decor=sheep_decor,
        dims=dict(leg_len=0.30, leg_w=0.11, leg_d=0.12, bw=0.46, bl=0.78, bh=0.44, BT=(1.0, 1.0), body_bevel=0.4,
                  head=(0.34, 0.36, 0.36), head_at=(0.20, 0.25), head_fwd=0.50, eye=(0.10, 0.075), eye_white=True,
                  paw=(0.01, 0.01, 0.06, 0.0)),
        col=dict(head='#4E4A4C', leg='#4E4A4C', paw='#2B2728', muzzle='#666062', nose='#2B2526', ear='#3E3A3C',
                 horn='#D8C492', horn2='#BBA46E', lidline='#A7A0A3'),
        variants={
            'male':    dict(s=0.75, head_k=1.00, leg_k=1.0, body_l=1.00, eye_k=1.0, horns=3,
                            col=dict(body='#F3EFE2', wool='#F3EFE2', wool2='#E7E0CE')),
            'female':  dict(s=0.70, head_k=0.97, leg_k=1.0, body_l=1.00, eye_k=1.0, horns=0,
                            col=dict(body='#FFFDF7', wool='#FFFDF7', wool2='#F3EEE2')),
            'young_m': dict(s=0.43, head_k=1.30, leg_k=0.90, body_l=0.80, eye_k=1.3, horns=1,
                            col=dict(body='#F3EFE2', wool='#F3EFE2', wool2='#E7E0CE')),
            'young_f': dict(s=0.43, head_k=1.30, leg_k=0.90, body_l=0.80, eye_k=1.3, horns=0,
                            col=dict(body='#FFFDF7', wool='#FFFDF7', wool2='#F3EEE2')),
        }),
    # ---- boerderij, tweede lichting. Nieuwe sleutels in dims:
    #   neck=(omhoog, naar voren)  kop staat zoveel hoger en verder naar voren; de soort tekent zelf de nek
    #   eat=(kanteling romp, grootste hoek kop), sleep=(grootste hoek kop, vloer), lie_hp=heuphoogte bij liggen
    # en per variant neck_k (kortere nek bij jongen).
    'horse': dict(
        decor=horse_decor,
        dims=dict(leg_len=0.56, leg_w=0.13, leg_d=0.15, bw=0.44, bl=0.98, bh=0.44, BT=(1.0, 1.0), body_bevel=0.34,
                  head=(0.30, 0.34, 0.40), neck=(0.40, 0.15), eye=(0.105, 0.09), paw=(0.012, 0.012, 0.10, 0.0),
                  eat=(10, 88), sleep=(50, 0.0), tail_lie=True),
        col=dict(paw='#2A2220', nostril='#3A2418'),
        variants={
            'male':    dict(s=1.15, head_k=1.00, leg_k=1.0, body_l=1.00, eye_k=1.0, forelock=True,
                            col=dict(body='#6E4428', mane='#1F1A1A', muzzle='#8F6242', leg='#2E211B')),
            'female':  dict(s=1.06, head_k=0.97, leg_k=1.0, body_l=1.00, eye_k=1.0, forelock=True,
                            col=dict(body='#B8703A', mane='#E9CC8E', muzzle='#D9A77C')),
            'young_m': dict(s=0.63, head_k=1.28, leg_k=0.85, body_l=0.78, eye_k=1.25, neck_k=0.7, blaze=True,
                            col=dict(body='#C48C58', mane='#4A3020', muzzle='#E0B890')),
            'young_f': dict(s=0.63, head_k=1.28, leg_k=0.85, body_l=0.78, eye_k=1.25, neck_k=0.7,
                            col=dict(body='#D6A26A', mane='#F0DCA6', muzzle='#E8C8A2')),
        }),
    'donkey': dict(
        decor=donkey_decor,
        dims=dict(leg_len=0.42, leg_w=0.13, leg_d=0.14, bw=0.46, bl=0.86, bh=0.46, BT=(1.0, 1.0),
                  head=(0.36, 0.38, 0.40), neck=(0.16, 0.06), eye=(0.12, 0.08), paw=(0.012, 0.012, 0.09, 0.0),
                  eat=(10, 76), sleep=(40, 0.0)),
        col=dict(paw='#3A3636', nostril='#5A5050', muzzle='#F3EEE4', belly='#E9E3D8', ear='#E6BDB2', mane='#4A4644'),
        variants={
            'male':    dict(s=0.90, head_k=1.00, leg_k=1.0, body_l=1.00, eye_k=1.0, cross=True,
                            col=dict(body='#7F7A76')),
            'female':  dict(s=0.83, head_k=0.97, leg_k=1.0, body_l=1.00, eye_k=1.0,
                            col=dict(body='#A9A39C', mane='#6A6562')),
            'young_m': dict(s=0.50, head_k=1.34, leg_k=0.85, body_l=0.78, eye_k=1.25, neck_k=0.7, fluff=True, cross=True,
                            col=dict(body='#8F8A85')),
            'young_f': dict(s=0.50, head_k=1.34, leg_k=0.85, body_l=0.78, eye_k=1.25, neck_k=0.7, fluff=True,
                            col=dict(body='#BDB7AF', mane='#7A7572')),
        }),
    'goat': dict(
        decor=goat_decor,
        dims=dict(leg_len=0.36, leg_w=0.10, leg_d=0.11, bw=0.40, bl=0.74, bh=0.40, BT=(1.0, 1.0),
                  head=(0.32, 0.34, 0.36), neck=(0.12, 0.04), eye=(0.105, 0.08), paw=(0.012, 0.012, 0.07, 0.0),
                  eat=(10, 70), sleep=(40, 0.0), tail_up=25),
        col=dict(paw='#4A4038', horn='#8C7B66', nose='#D98C8C', udder='#F4A9B8'),
        variants={
            'male':    dict(s=0.65, head_k=1.00, leg_k=1.0, body_l=1.00, eye_k=1.0, horns=3, beard=2, stripe=True,
                            col=dict(body='#C89B6A', muzzle='#F3E8D6', beard='#F3E8D6', ear='#B5855A', stripe='#8A6238')),
            'female':  dict(s=0.60, head_k=0.97, leg_k=1.0, body_l=1.00, eye_k=1.0, horns=2, beard=1, udder=True,
                            col=dict(body='#F7F2E8', muzzle='#F3DCD0', beard='#E6DCCB', ear='#EBD3C2')),
            'young_m': dict(s=0.37, head_k=1.30, leg_k=0.88, body_l=0.80, eye_k=1.3, neck_k=0.7, horns=1, stripe=True,
                            col=dict(body='#D9B38A', muzzle='#F6ECDD', ear='#C89B6A', stripe='#A87C4E')),
            'young_f': dict(s=0.37, head_k=1.30, leg_k=0.88, body_l=0.80, eye_k=1.3, neck_k=0.7, horns=0,
                            col=dict(body='#FAF6EE', muzzle='#F6E2D8', ear='#EFD9CA')),
        }),
    'alpaca': dict(
        decor=alpaca_decor,
        dims=dict(leg_len=0.44, leg_w=0.10, leg_d=0.11, bw=0.40, bl=0.66, bh=0.40, BT=(1.0, 1.0), body_bevel=0.4,
                  head=(0.28, 0.30, 0.28), neck=(0.50, 0.09), eye=(0.085, 0.045), paw=(0.012, 0.012, 0.07, 0.0),
                  eat=(10, 88), sleep=(50, 0.0)),
        col=dict(paw='#3A3230', nose='#3A2A26'),
        variants={
            'male':    dict(s=0.90, head_k=1.00, leg_k=1.0, body_l=1.00, eye_k=1.0,
                            col=dict(body='#8A5C3A', wool='#8A5C3A', wool2='#7A4F31', head='#A8784F', muzzle='#C9A07A',
                                     leg='#7A4F31')),
            'female':  dict(s=0.83, head_k=0.97, leg_k=1.0, body_l=1.00, eye_k=1.0,
                            col=dict(body='#F4EAD4', wool='#F4EAD4', wool2='#E9DDC2', head='#EEE1C6', muzzle='#FBF5E8',
                                     leg='#E9DDC2')),
            'young_m': dict(s=0.50, head_k=1.30, leg_k=0.88, body_l=0.80, eye_k=1.3, neck_k=0.7,
                            col=dict(body='#A6744A', wool='#A6744A', wool2='#94653F', head='#BF8E63', muzzle='#DDB892',
                                     leg='#94653F')),
            'young_f': dict(s=0.50, head_k=1.30, leg_k=0.88, body_l=0.80, eye_k=1.3, neck_k=0.7,
                            col=dict(body='#F8F0DE', wool='#F8F0DE', wool2='#EEE4CC', head='#F3E8D0', muzzle='#FFFAEE',
                                     leg='#EEE4CC')),
        }),
    # ---- savanne. 'view' maakt de controleplaatjes ruimer voor hoge of brede soorten.
    'zebra': dict(
        decor=zebra_decor,
        dims=dict(leg_len=0.50, leg_w=0.13, leg_d=0.15, bw=0.46, bl=0.92, bh=0.46, BT=(1.0, 1.0),
                  head=(0.30, 0.34, 0.38), neck=(0.34, 0.13), eye=(0.105, 0.085), paw=(0.012, 0.012, 0.09, 0.0),
                  paw_seg=1, eat=(10, 88), sleep=(50, 0.0), tail_lie=True),
        col=dict(paw='#2A2A2C', nostril='#101014'),
        variants={
            'male':    dict(s=1.05, head_k=1.00, leg_k=1.0, body_l=1.00, eye_k=1.0, stripes=4, stripe_w=0.08,
                            neck_stripes=3, col=dict(body='#FAFAF6', stripe='#1E1E22', muzzle='#1E1E22')),
            'female':  dict(s=0.97, head_k=0.97, leg_k=1.0, body_l=1.00, eye_k=1.0, stripes=6, stripe_w=0.045,
                            neck_stripes=4, leg_rings=(0.34, 0.54, 0.74),
                            col=dict(body='#FFFFFF', stripe='#2A2A30', muzzle='#62626A')),
            'young_m': dict(s=0.58, head_k=1.28, leg_k=0.85, body_l=0.78, eye_k=1.25, neck_k=0.7, stripes=4,
                            stripe_w=0.07, neck_stripes=2,
                            col=dict(body='#EFE2CC', stripe='#8A6848', muzzle='#6A4E38', nostril='#3A2A1E')),
            'young_f': dict(s=0.58, head_k=1.28, leg_k=0.85, body_l=0.78, eye_k=1.25, neck_k=0.7, stripes=5,
                            stripe_w=0.045, neck_stripes=2,
                            col=dict(body='#F4E9D6', stripe='#B0906C', muzzle='#9A7A5C', nostril='#5A4634')),
        }),
    'giraffe': dict(
        decor=giraffe_decor, view=1.55,
        dims=dict(leg_len=0.80, leg_w=0.11, leg_d=0.12, bw=0.44, bl=0.72, bh=0.42, BT=(1.0, 1.0), body_bevel=0.22,
                  head=(0.30, 0.34, 0.30), neck=(0.62, 0.16), eye=(0.10, 0.06), paw=(0.012, 0.012, 0.09, 0.0),
                  paw_seg=1, eat=(20, 86), sleep=(62, 0.0), tail_lie=True),
        col=dict(paw='#5A4030', muzzle='#F8E8C0', nostril='#6A4A30', knob='#5A3A20'),
        variants={
            'male':    dict(s=1.20, head_k=1.00, leg_k=1.0, body_l=1.00, eye_k=1.0,
                            col=dict(body='#F0BE48', spot='#8A5024', mane='#8A5024')),
            'female':  dict(s=1.11, head_k=0.97, leg_k=1.0, body_l=1.00, eye_k=1.0,
                            col=dict(body='#F6D066', spot='#B9783A', mane='#B9783A')),
            'young_m': dict(s=0.66, head_k=1.28, leg_k=0.80, body_l=0.80, eye_k=1.25, neck_k=0.6, neck_spots=3,
                            col=dict(body='#F6D066', spot='#9A6230', mane='#9A6230')),
            'young_f': dict(s=0.66, head_k=1.28, leg_k=0.80, body_l=0.80, eye_k=1.25, neck_k=0.6, neck_spots=3,
                            col=dict(body='#FADB80', spot='#C98C4C', mane='#C98C4C')),
        }),
    'elephant': dict(
        decor=elephant_decor, view=1.2,
        dims=dict(leg_len=0.40, leg_w=0.22, leg_d=0.24, bw=0.68, bl=0.98, bh=0.66, BT=(1.0, 1.0),
                  head=(0.58, 0.46, 0.58), head_at=(0.22, 0.20), head_fwd=0.35, eye=(0.165, 0.03),
                  paw=(0.012, 0.012, 0.08, 0.0), leg_in=0.05, leg_f=0.21, leg_h=0.20, leg_top=0.16, lie_hp=0.10),
        col=dict(nail='#EDE8DC', tusk='#FFF8E8', tuft='#4A4A50'),
        variants={
            'male':    dict(s=1.50, head_k=1.00, leg_k=1.0, body_l=1.00, eye_k=1.0, tusks=2,
                            col=dict(body='#8B929B', trunk='#7E858E', ear_in='#B9A0A8', paw='#7A8089')),
            'female':  dict(s=1.38, head_k=0.97, leg_k=1.0, body_l=1.00, eye_k=1.0,
                            col=dict(body='#A2A9B1', trunk='#959CA4', ear_in='#E2B2BC', paw='#8F969E')),
            'young_m': dict(s=0.83, head_k=1.26, leg_k=0.80, body_l=0.80, eye_k=1.25, trunk=0.8, tusks=1, hair=True,
                            col=dict(body='#A4ABB3', trunk='#979EA6', ear_in='#D9B4BC', paw='#91989F')),
            'young_f': dict(s=0.83, head_k=1.26, leg_k=0.80, body_l=0.80, eye_k=1.25, trunk=0.8, hair=True,
                            col=dict(body='#B4BAC1', trunk='#A7ADB4', ear_in='#F0BCC6', paw='#A1A7AE')),
        }),
    'rhino': dict(
        decor=rhino_decor, view=1.1,
        dims=dict(leg_len=0.30, leg_w=0.20, leg_d=0.22, bw=0.64, bl=1.05, bh=0.60, BT=(1.0, 1.0),
                  head=(0.48, 0.44, 0.44), head_at=(0.12, 0.10), head_fwd=0.42, head_bevel=0.2, eye=(0.15, 0.125),
                  paw=(0.012, 0.012, 0.08, 0.0), leg_in=0.04, leg_f=0.20, leg_h=0.19, leg_top=0.16, lie_hp=0.09),
        col=dict(horn='#EFE8D8', nostril='#5A544C', ear_in='#C9B5AC'),
        variants={
            'male':    dict(s=1.30, head_k=1.00, leg_k=1.0, body_l=1.00, eye_k=1.0, horns=(0.30, 0.15),
                            col=dict(body='#948D84', plate='#827B73', paw='#7A746C')),
            'female':  dict(s=1.20, head_k=0.97, leg_k=1.0, body_l=1.00, eye_k=1.0, horns=(0.18, 0.09),
                            col=dict(body='#ABA49A', plate='#9A9389', paw='#8E877E')),
            'young_m': dict(s=0.72, head_k=1.26, leg_k=0.85, body_l=0.80, eye_k=1.25, horns=(0.07, 0),
                            col=dict(body='#A39C92', plate='#928B82', paw='#87807A')),
            'young_f': dict(s=0.72, head_k=1.26, leg_k=0.85, body_l=0.80, eye_k=1.25, horns=(0.055, 0),
                            col=dict(body='#BAB3A9', plate='#A9A298', paw='#9C958C')),
        }),
    'hippo': dict(
        decor=hippo_decor, view=1.1,
        dims=dict(leg_len=0.22, leg_w=0.20, leg_d=0.22, bw=0.70, bl=1.05, bh=0.62, BT=(1.0, 1.0), body_bevel=0.36,
                  head=(0.52, 0.44, 0.40), head_at=(0.15, 0.20), head_fwd=0.40, eye=(0.16, 0.17),
                  paw=(0.012, 0.012, 0.07, 0.0), leg_in=0.07, leg_f=0.25, leg_h=0.24, leg_top=0.16, lie_hp=0.09),
        col=dict(nostril='#4E3E5C'),
        variants={
            'male':    dict(s=1.25, head_k=1.00, leg_k=1.0, body_l=1.00, eye_k=1.0, teeth=1.0,
                            col=dict(body='#7E6F92', pink='#E3A1B0', paw='#6C5E80')),
            'female':  dict(s=1.15, head_k=0.97, leg_k=1.0, body_l=1.00, eye_k=1.0, cheeks=True,
                            col=dict(body='#9A8BAE', pink='#F2B5C2', cheek='#F58FA8', paw='#87799B')),
            'young_m': dict(s=0.69, head_k=1.24, leg_k=0.90, body_l=0.80, eye_k=1.25, teeth=0.7,
                            col=dict(body='#BFA3C6', pink='#F7C6D0', paw='#AB90B3')),
            'young_f': dict(s=0.69, head_k=1.24, leg_k=0.90, body_l=0.80, eye_k=1.25, cheeks=True,
                            col=dict(body='#D0B4D4', pink='#FAD2DA', cheek='#F7A0B6', paw='#BBA0C0')),
        }),
    'camel': dict(
        decor=camel_decor, view=1.25,
        dims=dict(leg_len=0.62, leg_w=0.12, leg_d=0.13, bw=0.46, bl=0.90, bh=0.44, BT=(1.0, 1.0),
                  head=(0.30, 0.36, 0.32), neck=(0.42, 0.14), eye=(0.105, 0.07), paw=(0.04, 0.05, 0.07, -0.012),
                  eat=(10, 88), sleep=(50, 0.0)),
        col=dict(nostril='#6A4A30'),
        variants={
            'male':    dict(s=1.25, head_k=1.00, leg_k=1.0, body_l=1.00, eye_k=1.0, hump=(0.40, 0.62, 0.32),
                            col=dict(body='#C4955A', fur='#8A5E32', muzzle='#DDB98C', lip='#B48A5A', paw='#8E6A40')),
            'female':  dict(s=1.15, head_k=0.97, leg_k=1.0, body_l=1.00, eye_k=1.0, hump=(0.36, 0.52, 0.23),
                            col=dict(body='#E0B87E', fur='#C2965C', muzzle='#F0D6AE', lip='#CFA672', paw='#A98556')),
            'young_m': dict(s=0.69, head_k=1.28, leg_k=0.85, body_l=0.80, eye_k=1.25, neck_k=0.7,
                            hump=(0.32, 0.40, 0.12), fluff=True,
                            col=dict(body='#E6C48E', fur='#C9A06A', muzzle='#F4DEB8', lip='#D6B282', paw='#B08E60')),
            'young_f': dict(s=0.69, head_k=1.28, leg_k=0.85, body_l=0.80, eye_k=1.25, neck_k=0.7,
                            hump=(0.32, 0.40, 0.12), fluff=True,
                            col=dict(body='#F0D6A6', fur='#E0BC86', muzzle='#F8E8C8', lip='#E0C296', paw='#C0A074')),
        }),
}


# ---------------------------------------------------------------- viervoeter
def build_animal(species, variant, style, name):
    R = SPECIES[species]
    if R.get('build'):   # eigen bouwfunctie uit een pakket (bijvoorbeeld de tweevoeters)
        return R['build'](species, variant, style, name)
    P, S, D = R['variants'][variant], STYLES[style], R['dims']
    C = dict(BASE_COL, **R['col'])
    C.update(P['col'])
    for key, fallback in (('head', 'body'), ('leg', 'body'), ('paw', 'cream'), ('lidline', 'eye')):
        C.setdefault(key, C[fallback])
    k, s = P['head_k'] * S['head'], P['s']
    b = Builder(style)
    piv = {'root': Vector((0, 0, 0))}

    leg_len, leg_w, leg_d = D['leg_len'] * P['leg_k'] * S['leg_k'], D['leg_w'] * S['leg_w'], D['leg_d'] * S['leg_w']
    bw, bl, bh = D['bw'], D['bl'] * P['body_l'] * S['body_l'], D['bh'] * S['body_h']
    BT = D.get('BT', (1.08, 0.82))  # borst breder, heupen smaller (alleen in stijlen met taper)

    def body_k(y):
        kk = BT[0] if y < 0 else BT[1]
        return 1 + (kk - 1) * S['taper']
    bz = leg_len + bh / 2 - 0.05
    front, back = -bl / 2, bl / 2

    # romp
    b.box('body', C['body'], (bw, bl, bh), (0, 0, bz), bevel=D.get('body_bevel'), taper=(1, BT[0], BT[1]))

    # poten (dier kijkt naar -Y, links is +X)
    lx = bw / 2 - leg_w / 2 - D.get('leg_in', 0.01)
    fy, hy = front + D.get('leg_f', 0.15), back - D.get('leg_h', 0.14)
    pw = D.get('paw', (0.03, 0.05, 0.09, -0.02))
    legs = [('leg_FL', lx, fy), ('leg_FR', -lx, fy), ('leg_HL', lx, hy), ('leg_HR', -lx, hy)]
    for bone, x, y in legs:
        h = leg_len + D.get('leg_top', 0.06)   # dikke poten onder een ronde buik steken dieper in de romp
        b.box(bone, C['leg'], (leg_w, leg_d, h), (x, y, h / 2), taper=(2, 0.78, 1.2))
        ph = pw[2] * (1.45 if style == 'rond' else 1.0)
        b.box(bone, C['paw'], (leg_w + pw[0], leg_d + pw[1], ph), (x, y + pw[3], ph / 2), seg=D.get('paw_seg', 2))
        piv[bone] = Vector((x, y, leg_len))
    piv['body'] = Vector((0, hy, bz))

    # kop (met neck staat de kop hoger en verder naar voren; de soort tekent dan zelf de nek)
    hw, hl, hh = (v * k for v in D['head'])
    ha, hb = D.get('head_at', (0.30, 0.30))
    nu, nf = (v * P.get('neck_k', 1.0) for v in D.get('neck', (0.0, 0.0)))
    hcy, hz = front - hl * D.get('head_fwd', 0.30) - nf, bz + bh * ha + hh * hb + nu
    face = hcy - hl / 2
    piv['head'] = Vector((0, front + 0.06, bz + bh * 0.2))
    piv['lids'] = piv['head']
    b.box('head', C['head'], (hw, hl, hh), (0, hcy, hz), bevel=D.get('head_bevel'), taper=(1, 0.8, 1.05))

    # ogen en oogleden
    e = 0.06 * k * P['eye_k']
    exk, ezk = D.get('eye', (0.125, 0.07))
    for sx in (1, -1):
        ex, ez = sx * exk * k, hz + ezk * k
        # ooglid zit verstopt in de kop en schuift naar voren bij knipperen en slapen
        b.box('lids', C['head'], (e * 1.3, 0.03 * k, e * 1.5), (ex, face + 0.025 * k, ez), bevel=0)
        b.box('lids', C['lidline'], (e * 1.0, 0.008 * k, e * 0.16), (ex, face + 0.008 * k, ez - e * 0.25), bevel=0)
        if D.get('eye_white'):  # donkere kop: wit oog met donkere pupil
            b.box('head', C['white'], (e * 1.2, 0.02 * k, e * 1.35), (ex, face, ez), seg=1)
            b.box('head', C['eye'], (e * 0.62, 0.02 * k, e * 0.8), (ex, face - 0.012 * k, ez - e * 0.05), seg=1)
        elif style == 'rond':
            b.ball('head', C['eye'], (e * 0.62, 0.03 * k, e * 0.7), (ex, face + 0.002 * k, ez))
            b.ball('head', C['white'], (e * 0.2, 0.012 * k, e * 0.2), (ex + 0.014 * k, face - 0.022 * k, ez + e * 0.26))
        else:
            b.box('head', C['eye'], (e, 0.03 * k, e * 1.15), (ex, face - 0.005 * k, ez), bevel=0.35, seg=1)
            b.box('head', C['white'], (e * 0.36, 0.014 * k, e * 0.36), (ex + 0.013 * k, face - 0.02 * k, ez + e * 0.26), bevel=0)

    # eigen onderdelen van de soort (snuit, oren, hoorns, manen, wol, staart)
    c = SimpleNamespace(b=b, C=C, P=P, S=S, D=D, style=style, k=k, s=s, piv=piv, body_k=body_k,
                        leg_len=leg_len, leg_w=leg_w, leg_d=leg_d, bw=bw, bl=bl, bh=bh, bz=bz,
                        front=front, back=back, hw=hw, hl=hl, hh=hh, hcy=hcy, hz=hz, face=face,
                        legs=legs, body_bev=min(bw, bl, bh) * (D.get('body_bevel') or 0.3), extra={})
    R['decor'](c)

    obj, tris = b.finish(name, s)
    obj.data.materials.append(get_material())
    bpy.context.scene.collection.objects.link(obj)

    # skelet
    arm = bpy.data.armatures.new(name + '_rig')
    rig = bpy.data.objects.new(name + '_rig', arm)
    bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    for bn in BONES:
        eb = arm.edit_bones.new(bn)
        eb.head = piv[bn] * s
        eb.tail = piv[bn] * s + Vector((0, 0, 0.15 * s))
        eb.roll = 0
    for bn in BONES:
        if PARENT[bn]:
            arm.edit_bones[bn].parent = arm.edit_bones[PARENT[bn]]
    bpy.ops.object.mode_set(mode='OBJECT')
    rig.select_set(False)
    obj.parent = rig
    obj.modifiers.new('Armature', 'ARMATURE').object = rig

    # maten voor het spel: lids tellen niet mee (zitten in de kop)
    gi = {g.name: g.index for g in obj.vertex_groups}
    ys, zs, body_ys = [], [], []
    for v in obj.data.vertices:
        groups = [g.group for g in v.groups]
        if gi['lids'] in groups:
            continue
        ys.append(v.co.y)
        zs.append(v.co.z)
        if gi['body'] in groups:
            body_ys.append(v.co.y)
    geo = dict(s=s, leg_len=leg_len, d=hy - fy, tris=tris, h=bz - leg_len, k=k, back=back,
               height=round(max(zs), 3), length=round(max(ys) - min(ys), 3), body_back=round(max(body_ys), 3))
    lie_hp = geo['lie_hp'] = D.get('lie_hp', 0.06)   # dikke poten: iets hoger liggen
    if 'tail_up' in D:
        geo['tail_up'] = D['tail_up']
    geo['icon_low'] = c.extra.get('icon_low')

    # hoe ver mag de kop omlaag bij eten en slapen zonder door de grond te zakken
    head_pts = [v.co.copy() for v in obj.data.vertices if gi['head'] in [g.group for g in v.groups]]
    pb, ph = piv['body'] * s, piv['head'] * s

    def head_limit(pitch, hp, wanted, lo=0, floor=0.0):
        dz = stance(geo, pitch, hp)['body']['loc'][2] * s
        rb = Matrix.Rotation(math.radians(pitch), 3, 'X')
        for ang in range(int(wanted), lo, -2):
            rh = Matrix.Rotation(math.radians(ang), 3, 'X')
            low = min((rb @ (ph - pb + rh @ (p - ph))).z for p in head_pts) + pb.z + dz
            if low >= floor * s:
                return ang
        return lo
    eat_pitch, eat_max = D.get('eat', (10, 50))
    sleep_max, sleep_floor = D.get('sleep', (32, 0.0))
    geo['eat_pitch'] = eat_pitch
    geo['eat'] = head_limit(eat_pitch, None, eat_max) - 6      # min 6 graden speling voor het kauwen
    geo['sleep'] = head_limit(0, lie_hp, sleep_max, -30, sleep_floor) - 2
    geo['lie'] = min(4, head_limit(0, lie_hp, 6, -30) - 2)     # liggen: kop zo nodig iets omhoog (slurf, sik)
    geo['sad'] = head_limit(0, None, 30)                       # verdrietig: grote kop op korte poten buigt minder ver
    if D.get('tail_lie'):
        # lange hangende staart: bij liggen zoveel optillen dat hij op de grond ligt in plaats van erdoor
        tg = (gi['tail1'], gi['tail2'])
        tail_pts = [v.co.copy() for v in obj.data.vertices if any(g.group in tg for g in v.groups)]
        tp, dz = piv['tail1'] * s, stance(geo, 0, lie_hp)['body']['loc'][2] * s
        geo['tail_lie'] = next((a for a in range(0, 90, 3) if min(
            (Matrix.Rotation(math.radians(a), 3, 'X') @ (p - tp)).z for p in tail_pts) + tp.z + dz >= 0.0), 90)
    return rig, obj, geo


# ---------------------------------------------------------------- animatie
ANIMS = [('Idle', 48, 2), ('Walk', 24, 2), ('Run', 12, 1), ('Eat', 48, 2), ('Sit', 48, 4), ('Lie', 48, 2),
         ('Sleep', 72, 6), ('Poop', 48, 2), ('Pee', 48, 4), ('Play', 36, 2), ('Happy', 24, 1), ('Sad', 48, 4)]
FRONT, HIND = ('leg_FL', 'leg_FR'), ('leg_HL', 'leg_HR')


def merge(*poses):
    out = {}
    for pz in poses:
        for bone, d in pz.items():
            o = out.setdefault(bone, {})
            for key, val in d.items():
                if key == 'loc':
                    o['loc'] = tuple(a + c for a, c in zip(o.get('loc', (0, 0, 0)), val))
                else:
                    o[key] = o.get(key, 0) + val
    return out


def stance(G, pitch=0.0, hp=None):
    """Romp kantelt (pitch, plus = voorkant omlaag) en de heup zakt tot hoogte hp;
    de poten draaien vanzelf zo dat de voeten op de grond blijven."""
    L, d, h = G['leg_len'], G['d'], G['h']
    hp = L if hp is None else min(hp, L)
    th = math.radians(pitch)
    dz = hp + h * math.cos(th) - (L + h)
    fz = hp - d * math.sin(th)
    ang = lambda z: math.degrees(math.acos(max(0.0, min(1.0, z / L))))
    out = {'body': {'rx': pitch, 'loc': (0, 0, dz)}}
    for b in FRONT:
        out[b] = {'rx': -ang(fz) - pitch}
    for b in HIND:
        out[b] = {'rx': -ang(hp) - pitch}
    return out


def anim_pose(name, t, G):
    """Houding op lus-moment t (0..1). Hoeken in graden om de wereld-assen."""
    w = 2 * math.pi * t
    sn, L = math.sin(w), G['leg_len']

    def tail(a1=14, a2=18, up=0.0, speed=1):
        return {'tail1': {'rz': a1 * math.sin(speed * w), 'rx': up}, 'tail2': {'rz': a2 * math.sin(speed * w - 0.9)}}

    def lids(closed):
        return {'lids': {'loc': (0, -0.05 * G['k'] * closed, 0)}}

    def legs(front=0.0, hind=0.0):
        return {'leg_FL': {'rx': front}, 'leg_FR': {'rx': front}, 'leg_HL': {'rx': hind}, 'leg_HR': {'rx': hind}}

    blink = lids(1.0 if 0.60 <= t < 0.65 else 0.0)

    if name == 'Idle':
        return merge(stance(G), tail(18, 22), blink,
                     {'body': {'loc': (0, 0, 0.006 * sn)},
                      'head': {'rz': 9 * sn, 'ry': 3 * math.sin(2 * w), 'rx': 2 * sn}})
    if name == 'Walk':
        A = 26
        return merge(tail(12, 16),
                     {'body': {'loc': (0, 0, 0.012 * math.cos(2 * w)), 'rz': 2.5 * sn, 'ry': 2 * sn},
                      'head': {'rx': 3 * math.cos(2 * w), 'rz': -2.5 * sn},
                      'leg_FL': {'rx': -A * sn}, 'leg_HR': {'rx': -A * sn},
                      'leg_FR': {'rx': A * sn}, 'leg_HL': {'rx': A * sn}})
    if name == 'Run':
        A = 40  # galop: voorpoten samen, achterpoten samen
        return merge(legs(-A * sn, A * math.sin(w - 0.5)), tail(6, 10, up=28),
                     {'body': {'loc': (0, 0, 0.04 + 0.04 * sn), 'rx': 6 * math.cos(w)},
                      'head': {'rx': -5 * math.cos(w)}})
    lie_hp = G.get('lie_hp', 0.06)
    if name == 'Eat':
        return merge(stance(G, pitch=G.get('eat_pitch', 10)), tail(10, 14),
                     {'head': {'rx': G.get('eat', 44) + 6 * math.sin(3 * w)}})
    if name == 'Sit':
        hp = max(0.07, lie_hp)
        pitch = -math.degrees(math.asin(min(0.5, max(0.0, (L - hp) / G['d']))))
        return merge(stance(G, pitch, hp), tail(12, 16), blink,
                     {'head': {'rx': -pitch * 0.8 + 2 * sn, 'rz': 8 * sn}})
    if name == 'Lie':
        return merge(stance(G, 0, lie_hp), tail(10, 16, up=G.get('tail_lie', 0)), blink,
                     {'head': {'rz': 10 * sn, 'rx': G.get('lie', 4) + 2 * math.sin(2 * w)}})
    if name == 'Sleep':
        return merge(stance(G, 0, lie_hp), lids(1.0),
                     {'body': {'loc': (0, 0, 0.008 * sn)},
                      'head': {'rx': G.get('sleep', 30) + 2 * sn, 'ry': 10},
                      'tail1': {'rz': 25, 'rx': G.get('tail_lie', 0)}, 'tail2': {'rz': 30}})
    if name == 'Poop':
        squeeze = lids(1.0 if 0.30 <= t < 0.62 else 0.0)
        return merge(stance(G, -12, 0.62 * L), squeeze,
                     {'body': {'rz': 1.5 * math.sin(6 * w)},
                      'head': {'rx': -6},
                      'tail1': {'rx': G.get('tail_up', 62)}, 'tail2': {'rx': 10}})
    if name == 'Pee':
        return merge(stance(G), blink,
                     {'body': {'ry': 5},
                      'leg_HL': {'ry': -58, 'rx': -12},
                      'head': {'rz': 14 + 3 * sn},
                      'tail1': {'rx': G.get('tail_up', 62) * 0.5, 'rz': 6 * sn}})
    if name == 'Play':
        if t < 0.5:  # speelbuiging
            bw = math.sin(2 * w)
            return merge(stance(G, 16 * bw), tail(26, 30, up=G.get('tail_up', 62) * 0.7 * bw, speed=6),
                         {'head': {'rx': -18 * bw, 'ry': 8 * bw}})
        j = max(0.0, math.sin(2 * math.pi * (t - 0.5)))
        return merge(stance(G, -14 * j), legs(-40 * j, 36 * j), tail(26, 30, up=G.get('tail_up', 62) * 0.55 * j, speed=6),
                     {'body': {'loc': (0, 0, 0.30 * j)}, 'head': {'rx': 10 * j}})
    if name == 'Happy':
        hop = abs(math.sin(2 * w))
        return merge(legs(-20 * hop, 20 * hop), tail(34, 38, up=G.get('tail_up', 62) * 0.55, speed=4),
                     {'body': {'loc': (0, 0, 0.16 * hop)},
                      'head': {'rx': -12, 'ry': 8 * sn}})
    if name == 'Sad':
        return merge(stance(G), {'body': {'ry': 1.5 * sn},
                                 'head': {'rx': G.get('sad', 30), 'rz': 7 * sn},
                                 'tail1': {'rx': -18}, 'tail2': {'rx': -10}})
    return {}


def pose_of(name, t, G):
    """Houding van dit dier: een pakket kan in G['poser'] eigen houdingen meegeven."""
    return (G.get('poser') or anim_pose)(name, t, G)


def apply_pose(rig, pose, s):
    for pb in rig.pose.bones:
        d = pose.get(pb.name, {})
        R = (Matrix.Rotation(math.radians(d.get('rz', 0)), 3, 'Z')
             @ Matrix.Rotation(math.radians(d.get('ry', 0)), 3, 'Y')
             @ Matrix.Rotation(math.radians(d.get('rx', 0)), 3, 'X'))
        Mr = pb.bone.matrix_local.to_3x3()
        pb.rotation_mode = 'QUATERNION'
        pb.rotation_quaternion = (Mr.inverted() @ R @ Mr).to_quaternion()
        pb.location = Mr.inverted() @ (Vector(d.get('loc', (0, 0, 0))) * s)


def make_actions(rig, G):
    ad = rig.animation_data_create()
    for name, n, step in ANIMS:
        act = bpy.data.actions.new(name)
        ad.action = act
        for f in range(0, n + 1, step):
            apply_pose(rig, pose_of(name, f / n, G), G['s'])
            for pb in rig.pose.bones:
                pb.keyframe_insert('rotation_quaternion', frame=f + 1)
                pb.keyframe_insert('location', frame=f + 1)
        track = ad.nla_tracks.new()
        track.name = name
        track.strips.new(name, 1, act)
        ad.action = None
    apply_pose(rig, {}, G['s'])


# ---------------------------------------------------------------- uitvoer
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = FPS


def glb_info(path):
    with open(path, 'rb') as f:
        f.read(12)
        n, _ = struct.unpack('<I4s', f.read(8))
        j = json.loads(f.read(n))
    prims = [p for m in j.get('meshes', []) for p in m['primitives']]
    return dict(kb=round(os.path.getsize(path) / 1024, 1),
                animations=[a.get('name') for a in j.get('animations', [])],
                primitives=len(prims), attributes=sorted(prims[0]['attributes']) if prims else [],
                joints=len(j['skins'][0]['joints']) if j.get('skins') else 0)


def build_poop(style, name='poop'):
    b = Builder(style)
    for r, z in [((0.11, 0.11, 0.06), 0.05), ((0.08, 0.08, 0.05), 0.125), ((0.045, 0.045, 0.05), 0.19)]:
        b.ball('root', '#7A4A22', r, (0, 0, z), sub=2)
    obj, _ = b.finish(name, 1.0)
    obj.vertex_groups.clear()
    obj.data.materials.append(get_material())
    bpy.context.scene.collection.objects.link(obj)
    return obj


def export_models(species_list, style):
    os.makedirs(MODELS, exist_ok=True)
    mpath = os.path.join(MODELS, 'manifest.json')
    mine = {}
    report = {}
    expect = sorted(a[0] for a in ANIMS)
    for sp in species_list:
        for v in VARIANT_NAMES:
            reset()
            key = '%s_%s' % (sp, v)
            rig, obj, G = build_animal(sp, v, style, key)
            make_actions(rig, G)
            path = os.path.join(MODELS, key + '.glb')
            bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_animations=True,
                                      export_animation_mode='ACTIONS')
            info = glb_info(path)
            mine[key] = dict(height=G['height'], back=G['body_back'], length=G['length'])
            report[key] = dict(kb=info['kb'], tris=G['tris'], anims=len(info['animations']),
                               anims_ok=sorted(info['animations']) == expect, prims=info['primitives'],
                               joints=info['joints'])
    reset()
    build_poop(style)
    bpy.ops.export_scene.gltf(filepath=os.path.join(MODELS, 'poop.glb'), export_format='GLB')
    # het lijstje pas nu inlezen en alleen de eigen soorten bijwerken: er kan tegelijk nog iemand exporteren
    manifest = {'models': {}}
    if os.path.exists(mpath):
        try:
            manifest = json.load(open(mpath, encoding='utf-8'))
        except Exception:
            pass
    manifest.setdefault('models', {}).update(mine)
    manifest['models'] = dict(sorted(manifest['models'].items()))
    manifest['animations'] = [a[0] for a in ANIMS]
    with open(mpath, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=1)
    return report


def setup_stage():
    sc = bpy.context.scene
    for eng in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE'):
        try:
            sc.render.engine = eng
            break
        except Exception:
            continue
    sc.view_settings.view_transform = 'Standard'
    sc.render.resolution_x, sc.render.resolution_y = 1500, 800
    world = bpy.data.worlds.new('W')
    sc.world = world
    try:
        world.use_nodes = True
    except Exception:
        pass
    bg = next((n for n in world.node_tree.nodes if n.type == 'BACKGROUND'), None)
    if bg:
        bg.inputs[0].default_value = (0.78, 0.90, 1.0, 1.0)
        bg.inputs[1].default_value = 0.65
    sun = bpy.data.objects.new('Sun', bpy.data.lights.new('Sun', 'SUN'))
    sun.data.energy, sun.data.angle = 2.3, math.radians(10)
    sun.rotation_euler = (math.radians(50), 0, math.radians(20))
    sc.collection.objects.link(sun)
    me = bpy.data.meshes.new('ground')
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=30)
    bm.to_mesh(me)
    bm.free()
    g = bpy.data.objects.new('ground', me)
    gm = bpy.data.materials.new('Grass')
    try:
        gm.use_nodes = True
    except Exception:
        pass
    bs = next((n for n in gm.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if bs:
        bs.inputs['Base Color'].default_value = hexc('#79BD52')
        bs.inputs['Roughness'].default_value = 1.0
    me.materials.append(gm)
    sc.collection.objects.link(g)
    cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam'))
    cam.data.type = 'ORTHO'
    sc.collection.objects.link(cam)
    sc.camera = cam
    return cam


def aim(cam, target, direction, scale):
    d = Vector(direction).normalized()
    cam.location = Vector(target) + d * 20
    cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    cam.data.ortho_scale = scale


def render(path):
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def label(text, pos, size=0.9):
    cu = bpy.data.curves.new('lbl', 'FONT')
    cu.body, cu.size, cu.extrude, cu.align_x = text, size, 0.02, 'CENTER'
    ob = bpy.data.objects.new('lbl_' + text, cu)
    ob.location = Vector(pos) + Vector((0, 0, 0.02))
    ob.rotation_euler.z = math.radians(45)
    m = bpy.data.materials.new('lbl')
    try:
        m.use_nodes = True
    except Exception:
        pass
    bs = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if bs:
        bs.inputs['Base Color'].default_value = (1, 1, 1, 1)
    cu.materials.append(m)
    bpy.context.scene.collection.objects.link(ob)
    return ob


LINE = Vector((0.7071, 0.7071, 0))    # op het scherm: naar rechts
NEAR = Vector((0.7071, -0.7071, 0))   # op het scherm: naar voren
TURN = Matrix.Rotation(math.radians(22), 3, 'Z')
SLOTS = {'male': -1.9, 'female': -0.35, 'young_m': 0.95, 'young_f': 1.9}
LABELS = {'Idle': 'Staan', 'Walk': 'Lopen', 'Run': 'Rennen', 'Eat': 'Eten', 'Sit': 'Zitten', 'Lie': 'Liggen',
          'Sleep': 'Slapen', 'Poop': 'Poepen', 'Pee': 'Plassen', 'Play': 'Spelen', 'Happy': 'Blij', 'Sad': 'Verdrietig'}
SHOW_T = {'Idle': 0.15, 'Walk': 0.25, 'Run': 0.25, 'Eat': 0.1, 'Sit': 0.2, 'Lie': 0.2, 'Sleep': 0.25,
          'Poop': 0.45, 'Pee': 0.3, 'Play': 0.75, 'Happy': 0.125, 'Sad': 0.25}


def size_of(species):
    """Maat voor de controleplaatjes; 'view' maakt het beeld ruimer voor hoge of brede soorten."""
    return max(v['s'] for v in SPECIES[species]['variants'].values()) * SPECIES[species].get('view', 1.0)


def place(species, variant, style, name, pos, anim, t=None, rot=22):
    rig, obj, G = build_animal(species, variant, style, name)
    rig.location = pos
    rig.rotation_euler.z = math.radians(rot)
    apply_pose(rig, pose_of(anim, SHOW_T[anim] if t is None else t, G), G['s'])
    if anim == 'Poop':
        turn = Matrix.Rotation(math.radians(rot), 3, 'Z')
        build_poop(style, 'poop_' + name).location = Vector(pos) + turn @ Vector((0, G['body_back'] + 0.28 * G['s'], 0))
    return rig, obj, G


POSES = ['Eat', 'Lie', 'Sleep', 'Poop', 'Sit', 'Pee']


def render_family(species, style, side=True):
    reset()
    cam = setup_stage()
    f = max(0.8, size_of(species))
    for v, off in SLOTS.items():
        G = place(species, v, style, '%s_%s' % (species, v), LINE * off * f, 'Idle')[2]
        print('INFO %s_%s tris=%d height=%.3f length=%.3f eat=%d sleep=%d lie=%d'
              % (species, v, G['tris'], G['height'], G['length'], G['eat'], G['sleep'], G['lie']))
    aim(cam, Vector((0, 0, 0.55 * f)), (0.7, -0.7, 0.55), 5.6 * f)
    render(os.path.join(OUT, 'familie_%s.png' % species))
    if not side:
        return
    # zijaanzicht: neus naar links
    reset()
    cam = setup_stage()
    for i, v in enumerate(VARIANT_NAMES):
        place(species, v, style, '%s_%s' % (species, v), Vector((0, (i - 1.5) * 1.9 * f, 0)), 'Idle', rot=0)
    bpy.context.scene.render.resolution_x, bpy.context.scene.render.resolution_y = 1700, 520
    aim(cam, Vector((0, 0, 0.55 * f)), (1, 0, 0.1), 8.2 * f)
    render(os.path.join(OUT, 'familie_%s_zij.png' % species))


def render_poses4(species, style):
    """Houdingen waar korte poten het lastigst zijn: schuin van voren en van opzij."""
    f = max(0.8, size_of(species))
    reset()
    cam = setup_stage()
    n = len(POSES)
    for i, name in enumerate(POSES):
        place(species, 'male', style, 'm%d' % i, LINE * ((i * 2 - n + 0.5) * 1.2 * f), name)
        place(species, 'young_m', style, 'y%d' % i, LINE * ((i * 2 - n + 1.5) * 1.2 * f), name)
    bpy.context.scene.render.resolution_x, bpy.context.scene.render.resolution_y = 2200, 640
    aim(cam, Vector((0, 0, 0.4 * f)), (0.7, -0.7, 0.6), 15.2 * f)
    render(os.path.join(OUT, 'houdingen_%s.png' % species))
    for v in ('male', 'young_m'):
        render_poses_side(species, style, v)


def render_poses_side(species, style, v):
    f = max(0.8, size_of(species))
    n = len(POSES)
    reset()
    cam = setup_stage()
    g = f if v == 'male' else f * 0.6
    for i, name in enumerate(POSES):
        place(species, v, style, 'p%d' % i, Vector((0, (i - (n - 1) / 2) * 2.0 * g, 0)), name, rot=0)
    bpy.context.scene.render.resolution_x, bpy.context.scene.render.resolution_y = 2200, 480
    aim(cam, Vector((0, 0, 0.45 * g)), (1, 0, 0.08), 12.6 * g)
    render(os.path.join(OUT, 'houdingen_%s_zij_%s.png' % (species, v)))


# ---------------------------------------------------------------- kopplaatjes
ICON_VARIANT = {'cow': 'female'}   # de koe is het herkenbaarst als zwartbonte


def render_icons(species_list, style, px=128):
    """Kop (en bovenste stuk nek) van elke soort, driekwart van voren, doorzichtige achtergrond."""
    os.makedirs(ICONS, exist_ok=True)
    for sp in species_list:
        reset()
        sc = bpy.context.scene
        for eng in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE'):
            try:
                sc.render.engine = eng
                break
            except Exception:
                continue
        sc.view_settings.view_transform = 'Standard'
        sc.render.film_transparent = True
        sc.render.image_settings.file_format = 'PNG'
        sc.render.image_settings.color_mode = 'RGBA'
        sc.render.resolution_x = sc.render.resolution_y = px
        sc.render.resolution_percentage = 100
        world = bpy.data.worlds.new('W')
        sc.world = world
        try:
            world.use_nodes = True
        except Exception:
            pass
        bg = next((n for n in world.node_tree.nodes if n.type == 'BACKGROUND'), None)
        if bg:
            bg.inputs[0].default_value = (1.0, 0.98, 0.95, 1.0)
            bg.inputs[1].default_value = 0.75
        for nm, energy, rot in (('Key', 2.2, (52, 0, 28)), ('Fill', 0.5, (70, 0, -60))):
            sun = bpy.data.objects.new(nm, bpy.data.lights.new(nm, 'SUN'))
            sun.data.energy, sun.data.angle = energy, math.radians(12)
            sun.rotation_euler = tuple(math.radians(a) for a in rot)
            sc.collection.objects.link(sun)
        cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam'))
        cam.data.type = 'ORTHO'
        sc.collection.objects.link(cam)
        sc.camera = cam

        rig, obj, G = build_animal(sp, ICON_VARIANT.get(sp, 'male'), style, sp)
        # alleen wat aan het kop-bot hangt blijft over: kop, nek, oogleden
        gi = {g.name: g.index for g in obj.vertex_groups}
        keep = {gi['head'], gi['lids']}
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        dv = bm.verts.layers.deform.verify()
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not (keep & set(v[dv].keys()))], context='VERTS')
        bm.to_mesh(obj.data)
        bm.free()
        low = G.get('icon_low')
        zmin = -1e9 if low is None else low * G['s']
        pts = [v.co.copy() for v in obj.data.vertices if v.co.z >= zmin]
        d = Vector((0.60, -0.74, 0.30)).normalized()
        q = (-d).to_track_quat('-Z', 'Y')
        right, up = q @ Vector((1, 0, 0)), q @ Vector((0, 1, 0))
        us, vs = [p.dot(right) for p in pts], [p.dot(up) for p in pts]
        cu, cv = (min(us) + max(us)) / 2, (min(vs) + max(vs)) / 2
        cam.location = right * cu + up * cv + d * 20
        cam.rotation_euler = q.to_euler()
        cam.data.ortho_scale = max(max(us) - min(us), max(vs) - min(vs)) * 1.08
        render(os.path.join(ICONS, sp + '.png'))


def render_sheet(species, style):
    reset()
    cam = setup_stage()
    f = max(0.8, size_of(species))
    for i, (name, _, _) in enumerate(ANIMS):
        pos = LINE * ((i % 4 - 1.5) * 2.4 * f) + NEAR * ((i // 4 - 1) * 3.7 * f)
        place(species, 'male' if i % 2 == 0 else 'female', style, 'a%d' % i, pos, name)
        label(LABELS[name], pos + NEAR * 1.15 * f, size=0.34 * f)
    bpy.context.scene.render.resolution_x, bpy.context.scene.render.resolution_y = 1600, 1200
    aim(cam, Vector((0, 0, 0.3)), (0.7, -0.7, 0.7), 10.6 * f)
    render(os.path.join(OUT, 'animaties_%s.png' % species))


def render_styles():
    reset()
    cam = setup_stage()
    sc = bpy.context.scene
    rows = {'blok': -2.9, 'rond': 0.0, 'facet': 2.9}
    for st, row in rows.items():
        label(STYLES[st]['label'], LINE * -3.1 + NEAR * row)
        for v, off in SLOTS.items():
            place('lion', v, st, 'lion_%s_%s' % (st, v), LINE * off + NEAR * row, 'Idle')
    sc.render.resolution_x, sc.render.resolution_y = 1500, 1150
    aim(cam, LINE * -0.5 + Vector((0, 0, 0.5)), (0.7, -0.7, 0.7), 7.6)
    render(os.path.join(OUT, 'stijlen.png'))


# ---------------------------------------------------------------- pakketten
# Extra soorten staan in tools/animals/packs/*.py. Elk bestand draait in deze module en kan dus alles
# hierboven gebruiken (Builder, neck, belly, tail_chain, shell, stance, merge, ...). Een pakket voegt
# soorten toe met SPECIES['naam'] = dict(decor=..., dims=..., col=..., variants=...).
# Met SPECIES['naam']['build'] = functie bouwt een pakket het dier helemaal zelf (tweevoeters);
# die functie geeft (rig, obj, G) terug en zet in G['poser'] de functie voor de houdingen.
PACKS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'packs')
if os.path.isdir(PACKS):
    for _f in sorted(os.listdir(PACKS)):
        if not _f.endswith('.py'):
            continue
        try:
            with open(os.path.join(PACKS, _f), encoding='utf-8') as _h:
                exec(compile(_h.read(), os.path.join(PACKS, _f), 'exec'), globals())
        except Exception as _err:   # een kapot pakket mag de andere soorten niet tegenhouden
            import traceback
            print('PACK FAILED %s' % _f)
            traceback.print_exc()

mode = ARGS[1] if len(ARGS) > 1 else 'all'
_unknown = [a for a in ARGS[2:] if a not in SPECIES]
if _unknown:
    print('ONBEKENDE SOORT: %s' % ', '.join(_unknown))
    sys.exit(1)
species_list = ARGS[2:] or list(SPECIES)
if mode in ('all', 'export'):
    print('REPORT ' + json.dumps(export_models(species_list, STYLE)))
if mode in ('all', 'render'):
    for sp in species_list:
        render_family(sp, STYLE)
        render_poses4(sp, STYLE)
    print('RENDER OK')
if mode == 'sheet':
    for sp in species_list:
        render_sheet(sp, STYLE)
    print('RENDER OK')
if mode == 'styles':
    render_styles()
    print('RENDER OK')
if mode == 'check':
    for sp in species_list:
        render_family(sp, STYLE, side=False)
        render_poses_side(sp, STYLE, 'male')
    print('RENDER OK')
if mode == 'icons':
    render_icons(species_list, STYLE)
    print('RENDER OK')
if mode == 'info':   # alleen bouwen en de maten tonen, zonder plaatjes of bestanden
    for sp in species_list:
        for v in VARIANT_NAMES:
            reset()
            G = build_animal(sp, v, STYLE, '%s_%s' % (sp, v))[2]
            print('INFO %s_%s s=%.2f tris=%d height=%.3f length=%.3f eat=%d sleep=%d lie=%d sad=%d'
                  % (sp, v, G['s'], G['tris'], G['height'], G['length'], G['eat'], G['sleep'], G['lie'], G['sad']))
