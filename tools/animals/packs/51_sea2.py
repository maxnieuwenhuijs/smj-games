"""Zee, deel 2: haai en rog.

Dit bestand draait in de module van build_animals.py (na 50_sea.py) en gebruikt dus alles wat daar staat.
Eigen namen beginnen met sea2_ (behalve de <soort>_decor-functies).

De haai bouwt net als dolfijn en orka via ice_build met ice_flipper in dims (vinnen-skelet van de zeehond)
en neemt de voorvinnen en de staartwortel over van sea_flippers. Anders dan bij de dolfijn:
  - de staartvin staat rechtop (twee lobben boven elkaar, de bovenste langer) en zwiept dus opzij;
  - de rugvin is een hoge rechte driehoek, met een klein tweede vinnetje op de staartwortel;
  - de snuit is een spitse wig met een platte onderkant; daaronder een lachende bek met een paar tandjes.

De rog is plat en breed: een lage schijf met een punt voor en achter, twee grote vleugels aan leg_FL/FR
(draaipunt in de schouder, zodat ze kunnen klapwieken) en een dunne lange staart aan tail1/tail2.
De ogen staan in een bult boven op de schijf. De rog heeft eigen houdingen (sea2_ray_pose): hij zweeft
bij lopen en rennen een stukje boven de grond en slaat dan met zijn vleugels.
Het skelet (tien botten) en de twaalf animatienamen blijven gelijk aan die van de andere dieren.
"""


# ---------------------------------------------------------------- hulpjes
def sea2_wedge(b, bone, col, size, loc, ax, end, tip, shift=(0.0, 0.0), bevel=None, seg=1, rx=0.0, ry=0.0):
    """Wig: een doos waarvan het uiteinde aan de kant `end` (+1 of -1) van as `ax` kleiner is.
    tip = de twee factoren voor de andere assen (in volgorde x, y, z zonder ax); shift verschuift het
    midden van dat uiteinde langs dezelfde twee assen. Zo kan de breedte los van de dikte toelopen,
    blijft een onderkant plat of wijst een punt schuin naar achteren."""
    tmp = bmesh.new()
    bmesh.ops.create_cube(tmp, size=1.0)
    bmesh.ops.scale(tmp, vec=Vector(size), verts=tmp.verts)
    others = [i for i in range(3) if i != ax]
    for v in tmp.verts:
        if v.co[ax] * end > 0:
            for i, kk, d in zip(others, tip, shift):
                v.co[i] = v.co[i] * kk + d
    off = min(size) * min(1.0, *tip) * 0.3 if bevel is None else bevel
    if off > 0.0005:
        bmesh.ops.bevel(tmp, geom=list(tmp.edges), offset=off, segments=seg, profile=0.5, affect='EDGES')
    b._add(tmp, bone, col, loc, rx, ry)


def sea2_slab(b, bone, col, under, size, loc, ax, end, tip, shift=(0.0, 0.0), frac=0.42, rim=0.012):
    """Platte wig in twee lagen (as ax is 0 of 1, de dikte is altijd z): de onderste strook (frac van de
    dikte) in de kleur under, de rest in col. De bovenlaag steekt rondom `rim` uit, zodat je van boven
    alleen de bovenkleur ziet. tip = (factor dwars, factor dikte), shift = (dwars, omlaag/omhoog) van de punt.
    Geeft top(u) terug: de hoogte van de bovenkant (tegenover loc) op afstand u vanaf de voet,
    en de helling van die bovenkant in graden."""
    sz = size[2]
    L = size[ax]
    kc, kt = tip
    dc, dz = shift
    loc = Vector(loc)
    for color, lo, hi, grow in ((under, -sz / 2, -sz / 2 + sz * frac, 0.0), (col, -sz / 2 + sz * frac, sz / 2, rim)):
        mid, th = (lo + hi) / 2, hi - lo
        part = [size[0] + 2 * grow, size[1] + 2 * grow, th]
        part[ax] = L + grow
        sea2_wedge(b, bone, color, part, loc + Vector((0, 0, mid)), ax, end, (kc, kt), shift=(dc, dz + kt * mid - mid))
    top0, top1 = sz / 2, dz + kt * sz / 2

    def top(u):
        return top0 + (top1 - top0) * u / L
    return top, math.degrees(math.atan2(top0 - top1, L))


def sea2_icon(c, bones, pitch=0.0):
    """Kopplaatje (modus icons): render_icons houdt alleen over wat aan het kop-bot hangt. Alleen voor dat
    plaatje gaan de genoemde botten mee aan het kop-bot (net als bij sea_icon) en kantelt het dier `pitch`
    graden met de neus omlaag, zodat je bij een plat dier ook de bovenkant ziet.
    In de modellen voor het spel verandert er niets."""
    if globals().get('mode') != 'icons':
        return
    bm = c.b.bm
    dv = bm.verts.layers.deform.verify()
    hi = BONES.index('head')
    idx = [BONES.index(n) for n in bones]
    for v in bm.verts:
        for i in idx:
            if i in v[dv]:
                del v[dv][i]
                v[dv][hi] = 1.0
    if pitch:
        bmesh.ops.rotate(bm, cent=(0, 0, c.bz), matrix=Matrix.Rotation(math.radians(pitch), 3, 'X'), verts=bm.verts)
    # de kern en ice_build meten romp en staart op aan hun botten: een blokje binnenin houdt die maten geldig
    for n in ('body', 'tail1', 'tail2'):
        if n in bones:
            c.b.box(n, c.C['body'], (0.02, 0.02, 0.02), (0, 0, c.bz), bevel=0)


# ---------------------------------------------------------------- haai
def sea2_caudal(c, col, fl, up=(0.46, 0.18, 58), low=(0.27, 0.15, 36), th=0.055, room=0.03):
    """Staande staartvin aan tail2: twee lobben in het vlak van de romp, de bovenste langer.
    up en low = (lengte, breedte bij de voet, hoek in graden). De onderste lob wijst minder steil
    omlaag als hij anders door de grond zou steken (korte staartwortel bij de jongen)."""
    b = c.b
    base = fl.end - fl.u * 0.07
    L, w, ang = low
    while ang > 4:
        a = math.radians(ang)
        if base.z - (L - 0.05) * math.sin(a) - w * 0.35 / 2 * math.cos(a) >= room:
            break
        ang -= 2
    for L, w, ang in (up, (L, w, -ang)):
        a = math.radians(ang)
        d = Vector((0, math.cos(a), math.sin(a)))
        b.box('tail2', col, (th, L, w), base + d * (L / 2 - 0.05), rx=ang, taper=(1, 1.0, 0.35), hard=True, seg=1)


def shark_decor(c):
    b, C, P, k = c.b, c.C, c.P, c.k
    hcy, hz, hh, hw, hl, face, bz, bh, bw = c.hcy, c.hz, c.hh, c.hw, c.hl, c.face, c.bz, c.bh, c.bw
    f = c.bl / 0.84
    white = C['belly']
    belly(c, white, 0.36)
    sea_chin(c, white, 0.30)
    if P.get('cape'):   # donkere rug en kruin
        ice_saddle(c, C['cape'], 0.20)
        b.box('head', C['cape'], (hw * 0.52, hl * 0.62, 0.02 * k), (0, hcy + 0.04 * k, hz + hh / 2 - 0.002 * k), seg=1)

    # spitse snuit: een wig met een platte onderkant, de bovenkant loopt vanaf het voorhoofd schuin af
    sw, sl, sh = 0.38 * k, 0.32 * k, 0.17 * k
    kw, kh = 0.28, 0.25
    y0 = face + 0.05 * k              # de voet zit een stukje in de kop
    zu = hz - 0.105 * k               # onderkant van de snuit = bovenlip
    sea2_wedge(b, 'head', C['body'], (sw, sl, sh), (0, y0 - sl / 2, zu + sh / 2), 1, -1, (kw, kh),
               shift=(0, -sh * (1 - kh) / 2))

    def half(y, w0=sw, kk=kw):
        """Halve breedte van de snuit op plek y."""
        return w0 / 2 * (1 - (1 - kk) * (y0 - y) / sl)
    # bek: witte onderkaak die korter is dan de snuit, met een donkere lachlijn ertussen
    jl, jh = 0.21 * k, 0.05 * k
    yj = y0 - jl                      # voorkant van de onderkaak
    kj = half(yj) / (sw / 2)
    b_line = 0.030 * k
    sea2_wedge(b, 'head', C['mouth'], (sw - 0.02 * k, jl + 0.012 * k, b_line), (0, y0 - jl / 2 - 0.006 * k, zu - b_line / 2 + 0.006 * k),
               1, -1, (kj, 1.0), bevel=0)
    sea2_wedge(b, 'head', white, (sw - 0.034 * k, jl, jh), (0, y0 - jl / 2, zu - b_line - jh / 2 + 0.008 * k),
               1, -1, (kj, 0.7), shift=(0, jh * 0.15))
    # tandjes: kleine witte puntjes die van de bovenlip over de lachlijn hangen
    tw, th_ = 0.032 * k, 0.032 * k
    n = P.get('teeth', 3)
    for i in range(n):
        y = face - (0.015 + 0.12 * (i + 0.5) / n) * k
        for sx in (1, -1):
            sea2_wedge(b, 'head', C['tooth'], (0.02 * k, tw, th_), (sx * (half(y) - 0.012 * k), y, zu - th_ / 2 + 0.004 * k),
                       2, -1, (1.0, 0.2), bevel=0)
    for sx in (1, -1):   # twee tandjes vooraan
        sea2_wedge(b, 'head', C['tooth'], (tw, 0.02 * k, th_), (sx * 0.026 * k, yj - 0.008 * k, zu - th_ / 2 + 0.004 * k),
                   2, -1, (0.2, 1.0), bevel=0)
        # mondhoek: de lachlijn krult achteraan omhoog
        b.box('head', C['mouth'], (0.02 * k, 0.03 * k, 0.05 * k), (sx * (half(face) - 0.004 * k), face - 0.004 * k, zu + 0.012 * k),
              bevel=0)
        if P.get('cheeks'):   # vrouwtje: blosjes
            b.box('head', C['cheek'], (0.02 * k, 0.075 * k, 0.05 * k), (sx * (hw / 2 - 0.004 * k), face + 0.13 * k, hz - 0.015 * k),
                  seg=1)
        # kieuwspleten: drie donkere streepjes op de flank, vlak achter de kop
        for i in range(3):
            b.box('body', C['gill'], (0.014, 0.022, 0.10 - 0.012 * i), (sx * (bw / 2 + 0.001), c.front + (0.19 + 0.05 * i) * f, bz + 0.012),
                  bevel=0)

    fl = sea_flippers(c, C['flip'], reach=0.30, wide=0.17, stock=0.44 * (0.4 + 0.6 * P['body_l']), fluke=None,
                      sweep=40, tipk=0.5, lift=12, under=white)
    sea2_caudal(c, C['flip'], fl)
    # hoge driehoekige rugvin midden op de rug, en een klein tweede vinnetje op de staartwortel
    sea_fin(b, 'body', C['flip'], (0, 0.0, bz + bh / 2 - 0.03), P.get('fin', 0.36), 0.34, th=0.07,
            lean=30, hook=6, split=0.55, tip=0.16)
    fr = 0.50
    L0 = fl.stock + 0.09
    p = Vector((0, c.back - 0.09, fl.zb + 0.004 + fl.h0 / 2)) + fl.u * (L0 * fr)
    sea_fin(b, 'tail1', C['flip'], p + Vector((0, 0, fl.h0 / 2 * (1 - 0.68 * fr) - 0.02)), 0.10, 0.12, th=0.05,
            lean=32, hook=0, tip=0.3)
    sea2_icon(c, ('body',))


# ---------------------------------------------------------------- rog
def ray_decor(c):
    b, C, P, k = c.b, c.C, c.P, c.k
    hcy, hz, hh, hw, hl, face, bz, bh, bw = c.hcy, c.hz, c.hh, c.hw, c.hl, c.face, c.bz, c.bh, c.bw
    f = c.bl / 0.64
    top_c, pale, spot = C['body'], C['belly'], C['spot']
    ice_drop(c, ('leg_FL', 'leg_FR', 'leg_HL', 'leg_HR'))
    zb = bz - bh / 2
    belly(c, pale, 0.42)
    # lage bult over de rug, loopt smal toe naar de staart
    sea2_wedge(b, 'body', top_c, (bw * 0.66, c.bl * 0.86, 0.075), (0, 0.03 * f, bz + bh / 2 + 0.006), 1, 1, (0.5, 0.6),
               shift=(0, -0.012), bevel=0.02, seg=2)
    # achter de ogenbult loopt de rug schuin af (net iets smaller en lager dan de bult, die los kan bewegen)
    ny, nh = hcy + hl / 2 - 0.05 * k, hz + hh / 2 - 0.02 * k - (bz + bh / 2)
    nl_ = 0.24 * f
    sea2_wedge(b, 'body', top_c, (hw * 0.88, nl_, nh), (0, ny + nl_ / 2, bz + bh / 2 + nh / 2), 1, 1, (0.7, 0.22),
               shift=(0, -nh * 0.39), bevel=0.02, seg=2)

    # neus en achterpunt: samen met de vleugels maken ze van de schijf een ruit
    th = bh * 0.90
    nl = 0.30 * f
    sea2_slab(b, 'body', top_c, pale, (bw * 0.94, nl, th), (0, c.front + 0.09 - nl / 2, bz), 1, -1, (0.34, 0.42),
              shift=(0, -0.026))
    rl = 0.28 * f
    sea2_slab(b, 'body', top_c, pale, (bw * 0.90, rl, th), (0, c.back - 0.09 + rl / 2, bz), 1, 1, (0.26, 0.42),
              shift=(0, -0.020))

    # vleugels: brede platte driehoeken, de punt hangt iets naar achteren en rust bijna op de grond
    wl, wth, inset = P['wing'], bh * 0.82, 0.07
    chord = c.bl * 0.94
    wy = -0.02 * f
    kc, kt = 0.13, 0.16
    sweep = 0.10 * f
    for sx, bone in ((1, 'leg_FL'), (-1, 'leg_FR')):
        S = Vector((sx * (bw / 2 - 0.04), wy, bz - 0.008))
        drop = 0.020 + wth * kt / 2 - S.z      # de punt eindigt net boven de grond
        mid = S + Vector((sx * (wl / 2 - inset), 0, 0))
        top, slope = sea2_slab(b, bone, top_c, pale, (wl, chord, wth), mid, 0, sx, (kc, kt), shift=(sweep, drop))
        for u, y, d in P.get('wing_spots', ()):
            x = sx * (u * wl - inset)
            b.box(bone, spot, (d, d, 0.02), S + Vector((x, y * f + sweep * u, top(u * wl) - 0.003)), ry=sx * slope, seg=1)
        c.piv[bone] = S.copy()
    for sx, bone in ((1, 'leg_HL'), (-1, 'leg_HR')):
        c.piv[bone] = Vector((sx * 0.1, c.legs[2][2], zb + 0.06))
    for x, y, d in P.get('back_spots', ()):   # lichte vlekken op de rug (de bult loopt naar achteren af)
        b.box('body', spot, (d, d, 0.02), (x, y * f, bz + bh / 2 + 0.026 - 0.05 * y), seg=1)

    # dunne lange staart, ligt bijna plat en loopt uit in een punt
    a1, a2 = 4, 9
    L1, L2 = P['tail']
    T = Vector((0, c.back + 0.09 * f, zb + 0.062))
    d1 = Vector((0, math.cos(math.radians(a1)), math.sin(math.radians(a1))))
    d2 = Vector((0, math.cos(math.radians(a2)), math.sin(math.radians(a2))))
    T2 = T + d1 * L1
    b.box('tail1', C['tail'], (0.085, L1 + 0.06, 0.07), T + d1 * (L1 / 2 - 0.01), rx=a1, taper=(1, 1.0, 0.62), hard=True, seg=1)
    b.box('tail2', C['tail'], (0.052, L2 + 0.05, 0.045), T2 + d2 * (L2 / 2), rx=a2, taper=(1, 1.0, 0.22), hard=True, seg=1)
    # klein vinnetje op de staart
    sea_fin(b, 'tail1', C['tail'], T + d1 * (L1 * 0.55) + Vector((0, 0, 0.02)), 0.075, 0.10, th=0.04, lean=34, hook=0, tip=0.3)
    c.piv['tail1'], c.piv['tail2'] = T, T2

    # gezicht op de voorkant van de bult: lachje, bij het vrouwtje blosjes
    my, mz = face - 0.004 * k, hz - 0.052 * k
    b.box('head', C['mouth'], (0.10 * k, 0.014 * k, 0.016 * k), (0, my, mz), bevel=0)
    for sx in (1, -1):
        b.box('head', C['mouth'], (0.018 * k, 0.014 * k, 0.034 * k), (sx * 0.055 * k, my, mz + 0.011 * k), bevel=0)
        if P.get('cheeks'):
            b.box('head', C['cheek'], (0.055 * k, 0.016 * k, 0.036 * k), (sx * 0.112 * k, my + 0.002 * k, mz + 0.012 * k), seg=1)
    b.box('head', spot, (hw * 0.42, hl * 0.42, 0.02 * k), (0, hcy + 0.02 * k, hz + hh / 2 - 0.004 * k), seg=1)
    sea2_icon(c, ('body', 'leg_FL', 'leg_FR', 'tail1', 'tail2'), pitch=22)


def sea2_ray_build(species, variant, style, name):
    """De rog bouwt via ice_build (staart telt mee voor 'back') maar krijgt eigen houdingen."""
    rig, obj, G = ice_build(species, variant, style, name)
    G['poser'] = sea2_ray_pose
    return rig, obj, G


def sea2_ray_pose(name, t, G):
    """Houdingen voor de rog: plat op de grond, de vleugels (leg_FL/FR) slaan op en neer, de dunne
    staart (tail1/tail2) zwiept. Bij lopen, rennen, eten en springen zweeft hij los van de grond; de
    vleugelpunten zakken nooit verder dan de romp is opgetild. Hoeken in graden om de wereld-assen."""
    w = 2 * math.pi * t
    sn = math.sin(w)

    def lids(closed):
        return {'lids': {'loc': (0, -0.05 * G['k'] * closed, 0)}}

    def wing(up=0.0, up_r=None):
        """Vleugels: plus tilt de punt op (links, en rechts als up_r ontbreekt)."""
        return {'leg_FL': {'ry': -up}, 'leg_FR': {'ry': up if up_r is None else up_r}}

    def tail(wag=8, up=0.0, speed=1):
        return {'tail1': {'rz': wag * math.sin(speed * w), 'rx': up},
                'tail2': {'rz': wag * 1.4 * math.sin(speed * w - 0.9)}}

    def body(z=0.0, pitch=0.0, roll=0.0):
        """Romp: z omhoog, pitch plus = neus omhoog; de staart blijft daarbij vlak liggen."""
        return {'body': {'rx': -pitch, 'ry': roll, 'loc': (0, 0, z)}, 'tail1': {'rx': pitch}}

    blink = lids(1.0 if 0.60 <= t < 0.65 else 0.0)
    if name == 'Idle':
        return merge(body(0.006 + 0.004 * sn), wing(3 + 3 * math.sin(w - 0.6)), tail(8), blink,
                     {'head': {'rz': 5 * sn, 'rx': 1.5 * sn}})
    if name in ('Walk', 'Run'):
        # zweven: de vleugels slaan, de romp deint mee
        z, flap, nod = (0.10, 15, 3) if name == 'Walk' else (0.15, 22, 4)
        return merge(body(z + 0.012 * math.cos(w), pitch=nod * math.cos(w)), wing(4 + flap * sn), tail(6),
                     {'head': {'rx': -nod * 0.5 * math.cos(w)}})
    if name == 'Eat':
        return merge(body(0.06, pitch=-6), wing(6 + 5 * math.sin(3 * w)), tail(5),
                     {'head': {'rx': 4 + 4 * math.sin(3 * w)}})
    if name == 'Sit':
        return merge(body(0.02, pitch=12), wing(-4), blink, {'head': {'rx': 8 + 2 * sn, 'rz': 6 * sn}, 'tail2': {'rz': 10 * sn}})
    if name == 'Lie':
        return merge(body(0.002), tail(4), blink, {'head': {'rz': 5 * sn, 'rx': 2 + math.sin(2 * w)}})
    if name == 'Sleep':
        return merge(body(0.004 + 0.004 * sn), lids(1.0), wing(1.5 + 1.5 * sn),
                     {'head': {'rx': 4 + sn}, 'tail1': {'rz': 22}, 'tail2': {'rz': 28}})
    if name == 'Poop':
        squeeze = lids(1.0 if 0.30 <= t < 0.62 else 0.0)
        return merge(body(0.02, pitch=7), wing(-2), squeeze,
                     {'body': {'rz': 1.5 * math.sin(6 * w)}, 'head': {'rx': -3},
                      'tail1': {'rx': G.get('tail_up', 30)}, 'tail2': {'rx': 12}})
    if name == 'Pee':
        return merge(body(0.04, roll=-6), wing(22, 8), blink,
                     {'head': {'rz': 10 + 3 * sn},
                      'tail1': {'rx': G.get('tail_up', 30) * 0.6, 'rz': -16 + 5 * sn}, 'tail2': {'rz': -12}})
    if name == 'Play':
        if t < 0.5:   # neus omhoog en snel met de vleugels wapperen
            a = math.sin(math.pi * t / 0.5)
            return merge(body(0.10 * a, pitch=14 * a), wing(a * (8 + 15 * math.sin(8 * w))), tail(14, speed=6),
                         {'head': {'rx': 6 * a, 'rz': 6 * math.sin(4 * w)}})
        j = max(0.0, math.sin(2 * math.pi * (t - 0.5)))
        return merge(body(0.24 * j, pitch=6 * j), wing(30 * j), tail(18, up=14 * j, speed=6), {'head': {'rx': 4 * j}})
    if name == 'Happy':
        hop = abs(math.sin(2 * w))
        return merge(body(0.14 * hop, pitch=4 * hop), wing(32 * hop), tail(20, up=14 * hop, speed=4),
                     {'head': {'rx': -4, 'rz': 6 * sn}})
    if name == 'Sad':
        return merge(body(0.004), {'head': {'rx': min(G.get('sad', 30), 12), 'rz': 5 * sn},
                                   'tail1': {'rz': 8}, 'tail2': {'rz': 12}})
    return {}


# ---------------------------------------------------------------- recepten
# s is de maat tegenover het leeuwenmannetje (1.00). De haai is iets groter dan de dolfijn; de rugvin en
# de bovenste staartlob tellen mee in de hoogte. De rog is laag en breder dan zijn schijf lang is;
# ice_flipper staat bij hem alleen aan zodat ice_build de staart meetelt in 'back' (de houdingen zijn eigen).
SPECIES['shark'] = dict(
    decor=shark_decor, build=ice_build, view=1.1,
    dims=dict(leg_len=0.055, leg_w=0.10, leg_d=0.10, bw=0.46, bl=0.84, bh=0.42, BT=(1.0, 1.0), body_bevel=0.38,
              head=(0.44, 0.36, 0.38), head_at=(0.02, 0.10), head_fwd=0.22, head_bevel=0.25, eye=(0.13, 0.095),
              leg_f=0.25, leg_h=0.05, lie_hp=0.2, eat=(0, 80), sleep=(60, 0.0), tail_up=30, ice_flipper=0.30),
    col=dict(cheek='#F0A9A6', mouth='#7A4350', tooth='#FFFFFF'),
    variants={
        'male':    dict(s=1.00, head_k=1.00, leg_k=1.0, body_l=1.00, eye_k=1.2, cape=True, fin=0.38, teeth=3,
                        col=dict(body='#6B8296', cape='#566C80', belly='#EEF2F3', flip='#4F6477', gill='#465A6C')),
        'female':  dict(s=0.93, head_k=0.97, leg_k=1.0, body_l=1.00, eye_k=1.2, cheeks=True, fin=0.33, teeth=3,
                        col=dict(body='#8CA1B2', belly='#F4F7F7', flip='#6F8799', gill='#657C8E')),
        'young_m': dict(s=0.62, head_k=1.26, leg_k=1.0, body_l=0.80, eye_k=1.4, cape=True, fin=0.24, teeth=2,
                        col=dict(body='#7A91A5', cape='#647B8F', belly='#F0F4F5', flip='#5C7286', gill='#54697C')),
        'young_f': dict(s=0.62, head_k=1.26, leg_k=1.0, body_l=0.80, eye_k=1.4, cheeks=True, fin=0.24, teeth=2,
                        col=dict(body='#9DB1C1', belly='#F6F9F9', flip='#7C93A5', gill='#72899B')),
    })
SPECIES['ray'] = dict(
    decor=ray_decor, build=sea2_ray_build, view=1.1,
    dims=dict(leg_len=0.055, leg_w=0.10, leg_d=0.10, bw=0.40, bl=0.64, bh=0.15, BT=(1.0, 1.0),
              head=(0.34, 0.26, 0.20), head_at=(0.5, 0.15), head_fwd=-0.25, head_bevel=0.24, eye=(0.09, 0.034),
              leg_f=0.30, leg_h=0.05, lie_hp=0.2, eat=(0, 20), sleep=(20, 0.0), tail_up=30, ice_flipper=0.50),
    col=dict(cheek='#F0A9A6', mouth='#6A4A3A'),
    variants={
        'male':    dict(s=1.00, head_k=1.00, leg_k=1.0, body_l=1.00, eye_k=1.15, wing=0.56, tail=(0.24, 0.30),
                        wing_spots=((0.22, -0.10, 0.075), (0.36, 0.03, 0.06), (0.20, 0.13, 0.06), (0.52, 0.0, 0.045)),
                        back_spots=((0.03, 0.14, 0.065), (-0.03, 0.24, 0.055)),
                        col=dict(body='#B58F58', belly='#F5ECD8', spot='#F0DDB0', tail='#96744A')),
        'female':  dict(s=0.93, head_k=0.97, leg_k=1.0, body_l=1.00, eye_k=1.15, cheeks=True, wing=0.54, tail=(0.24, 0.30),
                        wing_spots=((0.22, -0.08, 0.07), (0.34, 0.06, 0.055), (0.50, 0.0, 0.045)),
                        back_spots=((0.0, 0.17, 0.065),),
                        col=dict(body='#CFAE78', belly='#FAF3E3', spot='#F8EBC8', tail='#B08E5E')),
        'young_m': dict(s=0.66, head_k=1.22, leg_k=1.0, body_l=0.84, eye_k=1.35, wing=0.48, tail=(0.20, 0.24),
                        wing_spots=((0.24, -0.06, 0.07), (0.40, 0.03, 0.055)),
                        back_spots=((0.0, 0.17, 0.06),),
                        col=dict(body='#C19C66', belly='#F7EFDD', spot='#F4E3BA', tail='#A28052')),
        'young_f': dict(s=0.66, head_k=1.22, leg_k=1.0, body_l=0.84, eye_k=1.35, cheeks=True, wing=0.48, tail=(0.20, 0.24),
                        wing_spots=((0.26, 0.0, 0.07),),
                        back_spots=((0.0, 0.17, 0.06),),
                        col=dict(body='#D9BB88', belly='#FCF6E8', spot='#FBF0D2', tail='#BC9A6A')),
    })
