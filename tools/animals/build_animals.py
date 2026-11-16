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
}


# ---------------------------------------------------------------- viervoeter
def build_animal(species, variant, style, name):
    R = SPECIES[species]
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
    for bone, x, y in [('leg_FL', lx, fy), ('leg_FR', -lx, fy), ('leg_HL', lx, hy), ('leg_HR', -lx, hy)]:
        h = leg_len + 0.06
        b.box(bone, C['leg'], (leg_w, leg_d, h), (x, y, h / 2), taper=(2, 0.78, 1.2))
        ph = pw[2] * (1.45 if style == 'rond' else 1.0)
        b.box(bone, C['paw'], (leg_w + pw[0], leg_d + pw[1], ph), (x, y + pw[3], ph / 2))
        piv[bone] = Vector((x, y, leg_len))
    piv['body'] = Vector((0, hy, bz))

    # kop
    hw, hl, hh = (v * k for v in D['head'])
    ha, hb = D.get('head_at', (0.30, 0.30))
    hcy, hz = front - hl * D.get('head_fwd', 0.30), bz + bh * ha + hh * hb
    face = hcy - hl / 2
    piv['head'] = Vector((0, front + 0.06, bz + bh * 0.2))
    piv['lids'] = piv['head']
    b.box('head', C['head'], (hw, hl, hh), (0, hcy, hz), taper=(1, 0.8, 1.05))

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
                        front=front, back=back, hw=hw, hl=hl, hh=hh, hcy=hcy, hz=hz, face=face)
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

    # hoe ver mag de kop omlaag bij eten en slapen zonder door de grond te zakken
    head_pts = [v.co.copy() for v in obj.data.vertices if gi['head'] in [g.group for g in v.groups]]
    pb, ph = piv['body'] * s, piv['head'] * s

    def head_limit(pitch, hp, wanted):
        dz = stance(geo, pitch, hp)['body']['loc'][2] * s
        rb = Matrix.Rotation(math.radians(pitch), 3, 'X')
        for ang in range(int(wanted), 0, -2):
            rh = Matrix.Rotation(math.radians(ang), 3, 'X')
            low = min((rb @ (ph - pb + rh @ (p - ph))).z for p in head_pts) + pb.z + dz
            if low >= 0.0:
                return ang
        return 0
    geo['eat'] = head_limit(10, None, 50) - 6      # min 6 graden speling voor het kauwen
    geo['sleep'] = head_limit(0, 0.06, 32) - 2
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
    if name == 'Eat':
        return merge(stance(G, pitch=10), tail(10, 14), {'head': {'rx': G.get('eat', 44) + 6 * math.sin(3 * w)}})
    if name == 'Sit':
        hp = 0.07
        pitch = -math.degrees(math.asin(min(0.5, max(0.0, (L - hp) / G['d']))))
        return merge(stance(G, pitch, hp), tail(12, 16), blink,
                     {'head': {'rx': -pitch * 0.8 + 2 * sn, 'rz': 8 * sn}})
    if name == 'Lie':
        return merge(stance(G, 0, 0.06), tail(10, 16), blink,
                     {'head': {'rz': 10 * sn, 'rx': 4 + 2 * math.sin(2 * w)}})
    if name == 'Sleep':
        return merge(stance(G, 0, 0.06), lids(1.0),
                     {'body': {'loc': (0, 0, 0.008 * sn)},
                      'head': {'rx': G.get('sleep', 30) + 2 * sn, 'ry': 10},
                      'tail1': {'rz': 25}, 'tail2': {'rz': 30}})
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
                                 'head': {'rx': 30, 'rz': 7 * sn},
                                 'tail1': {'rx': -18}, 'tail2': {'rx': -10}})
    return {}


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
            apply_pose(rig, anim_pose(name, f / n, G), G['s'])
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
    manifest = {'models': {}}
    if os.path.exists(mpath):
        try:
            manifest = json.load(open(mpath, encoding='utf-8'))
        except Exception:
            pass
    manifest.setdefault('models', {})
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
            manifest['models'][key] = dict(height=G['height'], back=G['body_back'], length=G['length'])
            report[key] = dict(kb=info['kb'], tris=G['tris'], anims=len(info['animations']),
                               anims_ok=sorted(info['animations']) == expect, prims=info['primitives'],
                               joints=info['joints'])
    reset()
    build_poop(style)
    bpy.ops.export_scene.gltf(filepath=os.path.join(MODELS, 'poop.glb'), export_format='GLB')
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
    return max(v['s'] for v in SPECIES[species]['variants'].values())


def place(species, variant, style, name, pos, anim, t=None, rot=22):
    rig, obj, G = build_animal(species, variant, style, name)
    rig.location = pos
    rig.rotation_euler.z = math.radians(rot)
    apply_pose(rig, anim_pose(anim, SHOW_T[anim] if t is None else t, G), G['s'])
    if anim == 'Poop':
        turn = Matrix.Rotation(math.radians(rot), 3, 'Z')
        build_poop(style, 'poop_' + name).location = Vector(pos) + turn @ Vector((0, G['body_back'] + 0.28 * G['s'], 0))
    return rig, obj, G


POSES = ['Eat', 'Lie', 'Sleep', 'Poop', 'Sit', 'Pee']


def render_family(species, style):
    reset()
    cam = setup_stage()
    f = max(0.8, size_of(species))
    for v, off in SLOTS.items():
        place(species, v, style, '%s_%s' % (species, v), LINE * off * f, 'Idle')
    aim(cam, Vector((0, 0, 0.55 * f)), (0.7, -0.7, 0.55), 5.6 * f)
    render(os.path.join(OUT, 'familie_%s.png' % species))
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
        reset()
        cam = setup_stage()
        g = f if v == 'male' else f * 0.6
        for i, name in enumerate(POSES):
            place(species, v, style, 'p%d' % i, Vector((0, (i - (n - 1) / 2) * 2.0 * g, 0)), name, rot=0)
        bpy.context.scene.render.resolution_x, bpy.context.scene.render.resolution_y = 2200, 480
        aim(cam, Vector((0, 0, 0.45 * g)), (1, 0, 0.08), 12.6 * g)
        render(os.path.join(OUT, 'houdingen_%s_zij_%s.png' % (species, v)))


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


mode = ARGS[1] if len(ARGS) > 1 else 'all'
species_list = [a for a in ARGS[2:] if a in SPECIES] or list(SPECIES)
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
