"""IJs en noorden: luiaard, ijsbeer, zeehond, walrus, rendier, wolf, poolvos en bruine beer.

Dit bestand draait in de module van build_animals.py en gebruikt dus alles wat daar staat.
Eigen namen beginnen met ice_ (behalve de <soort>_decor-functies).

Alle acht soorten bouwen via ice_build: dat roept de gewone viervoeter aan en zet er een eigen
houdingen-functie bij. Die is nodig voor
  - lange staarten: bij zitten, verdrietig, de speelbuiging en slapen zakt de staart anders door de grond;
  - zeehond en walrus: die liggen op hun buik, hebben vinnen in plaats van poten en bewegen anders.
Het skelet (tien botten) en de twaalf animatienamen blijven gelijk aan die van de andere dieren.
"""


# ---------------------------------------------------------------- hulpjes
def ice_rz(b, rz, loc, fn, *args, pre=(0, 0, 0), **kw):
    """Onderdeel dat ook om de Z-as draait (de bouwer kent alleen rx en ry).
    Het onderdeel wordt op `pre` gemaakt, om de oorsprong gedraaid en dan naar `loc` gezet."""
    n = len(b.bm.verts)
    fn(*args, pre, **kw)
    new = list(b.bm.verts)[n:]
    bmesh.ops.rotate(b.bm, cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(rz), 3, 'Z'), verts=new)
    bmesh.ops.translate(b.bm, vec=Vector(loc), verts=new)


def ice_stick(b, bone, col, p0, p1, w, tip=1.0, bevel=None, seg=1, ext=None):
    """Stokje van p0 naar p1 (gewei, slagtand, klauw, snorhaar); tip < 1 maakt het einde bij p1 dunner."""
    p0, p1 = Vector(p0), Vector(p1)
    v = p1 - p0
    d = v.normalized()
    rx = -math.degrees(math.asin(max(-1.0, min(1.0, d.y))))
    ry = math.degrees(math.atan2(d.x, d.z))
    ext = w * 0.5 if ext is None else ext
    b.box(bone, col, (w, w, v.length + ext), (p0 + p1) / 2, bevel=bevel, seg=seg, rx=rx, ry=ry,
          taper=(2, 1.0, tip) if tip != 1.0 else None, hard=True)


def ice_drop(c, bones):
    """Haalt weg wat de kern al aan deze botten heeft gehangen (de poten van zeehond en walrus)."""
    b = c.b
    dv = b.bm.verts.layers.deform.verify()
    idx = {BONES.index(n) for n in bones}
    bmesh.ops.delete(b.bm, geom=[v for v in b.bm.verts if idx & set(v[dv].keys())], context='VERTS')
    # Opnieuw inlezen: na weghalen vult bmesh de gaten met nieuwe punten, terwijl de bouwer erop rekent
    # dat nieuwe punten achteraan komen (anders krijgen verkeerde punten het bot en de kleur).
    me = bpy.data.meshes.new('tmp')
    b.bm.to_mesh(me)
    b.bm.free()
    b.bm = bmesh.new()
    b.bm.from_mesh(me)
    bpy.data.meshes.remove(me)
    b.bm.verts.layers.deform.verify()


def ice_tail(c, tp, a1, a2, L1, L2, w1, w2, col, tip=None, tip_l=0.12, seg=2):
    """Pluimstaart in twee stukken met een puntig uiteinde in een eigen kleur."""
    tail_chain(c, tp, a1, a2, L1, L2, w1, w2, col, col, seg=seg)
    if tip:
        d1 = Vector((0, math.cos(math.radians(a1)), math.sin(math.radians(a1))))
        d2 = Vector((0, math.cos(math.radians(a2)), math.sin(math.radians(a2))))
        p = Vector(tp) + d1 * L1 + d2 * (L2 + tip_l * 0.28)
        c.b.box('tail2', tip, (w2 * 0.9, tip_l, w2 * 0.9), p, rx=a2, taper=(1, 1.0, 0.4), hard=True, seg=seg)


def ice_ears(c, x, y, z, size, col, inner, tip=0.25, ry=0.0, bevel=None, seg=1):
    """Twee oren; tip < 1 maakt ze puntig, bevel 0.45 maakt ze rond."""
    w, d, h = size
    tap = (2, 1.0, tip) if tip != 1.0 else None
    for sx in (1, -1):
        c.b.box('head', col, (w, d, h), (sx * x, y, z), taper=tap, hard=True, ry=sx * ry, bevel=bevel, seg=seg)
        c.b.box('head', inner, (w * 0.55, 0.02 * c.k, h * 0.58), (sx * x, y - d / 2 - 0.003 * c.k, z - h * 0.06),
                taper=tap, hard=True, ry=sx * ry, bevel=bevel, seg=1)


def ice_claws(c, col, n=3, gap=0.05, size=(0.03, 0.04, 0.035)):
    """Nagels vooraan op elke voet."""
    pw = c.D.get('paw', (0.03, 0.05, 0.09, -0.02))
    for bone, x, y in c.legs:
        fy = y + pw[3] - (c.leg_d + pw[1]) / 2
        for i in range(n):
            c.b.box(bone, col, size, (x + (i - (n - 1) / 2) * gap, fy - size[1] * 0.2, size[2] / 2 + 0.012), bevel=0)


def ice_saddle(c, col, frac=0.25, y=0.0, length=None):
    """Donkere rug: schil om de bovenste strook van de romp (tegenhanger van belly)."""
    L = (c.bl - 2 * c.body_bev + 0.06) if length is None else length
    c.b.band('body', col, (c.bw + 0.018, L, c.bh + 0.018), (0, y, c.bz), c.body_bev,
             cut=(2, c.bh / 2 - c.bh * frac, -1))


# ---------------------------------------------------------------- bouwen en houdingen
def ice_build(species, variant, style, name):
    """Gewone viervoeter uit de kern, met eigen houdingen erbij."""
    R = SPECIES[species]
    fn = R.pop('build')
    try:
        rig, obj, G = build_animal(species, variant, style, name)
    finally:
        R['build'] = fn
    D, s = R['dims'], G['s']
    gi = {g.name: g.index for g in obj.vertex_groups}
    if D.get('ice_flipper'):
        G['ice_reach'] = D['ice_flipper']
        G['poser'] = ice_flipper_pose
        # Het achterlijf en de achtervinnen hangen aan de staartbotten, maar het dier houdt pas op bij de
        # vinnen: 'back' (waar het spel de drol neerlegt) telt ze mee, anders ligt de drol onder het achterlijf.
        G['body_back'] = round(max(v.co.y for v in obj.data.vertices
                                   if v.groups[0].group in (gi['tail1'], gi['tail2'])), 3)
        return rig, obj, G
    # staart: hoeveel optillen bij zitten, en hoe ver mag hij omlaag bij verdrietig en bij de speelbuiging
    bones = rig.data.bones
    pb, t1, t2 = (bones[n].head_local.copy() for n in ('body', 'tail1', 'tail2'))
    pts = [(v.groups[0].group == gi['tail2'], v.co.copy()) for v in obj.data.vertices
           if v.groups[0].group in (gi['tail1'], gi['tail2'])]

    def low(pitch, hp, a1, a2=0.0):
        dz = stance(G, pitch, hp)['body']['loc'][2] * s
        rb, r1, r2 = (Matrix.Rotation(math.radians(a), 3, 'X') for a in (pitch, a1, a2))
        return min((rb @ (t1 - pb + r1 @ ((t2 - t1 + r2 @ (p - t2)) if second else (p - t1)))).z
                   for second, p in pts) + pb.z + dz
    L = G['leg_len']
    hp = max(0.07, G['lie_hp'])
    pitch = -math.degrees(math.asin(min(0.5, max(0.0, (L - hp) / G['d']))))
    G['ice_sit'] = next((a for a in range(0, 120, 3) if low(pitch, hp, a) >= 0.0), 120)
    # Omlaag telt alleen het aaneengesloten stuk vanaf de rusthoek: een hangende staart die voorbij
    # loodrecht draait komt weer boven de grond, maar zakt er onderweg doorheen.
    G['ice_sad'] = 0.0
    for f in (0.25, 0.5, 0.75, 1.0):
        if low(0, None, -18 * f, -10 * f) < 0.0:
            break
        G['ice_sad'] = f
    # De speelbuiging (romp tot 16 graden achterover) kwispelt hard en de staart draait dan ook om een
    # schuine as: wat ruimte boven de grond houden. Plus = de staart moet omhoog.
    room, a = 0.05 * s, 0
    if low(-16, None, 0) < room:
        a = next((x for x in range(3, 91, 3) if low(-16, None, x) >= room), 90)
    else:
        while a > -45 and low(-16, None, a - 3) >= room:
            a -= 3
    G['ice_play'] = a
    G['poser'] = ice_pose
    return rig, obj, G


def ice_pose(name, t, G):
    """De gedeelde houdingen; alleen de staart blijft boven de grond bij zitten, verdrietig,
    de speelbuiging (achterlijf omlaag) en slapen (staart opzij gekruld)."""
    pose = anim_pose(name, t, G)
    if name == 'Sit' and G.get('ice_sit'):
        pose = merge(pose, {'tail1': {'rx': G['ice_sit']}})
    elif name == 'Sad':
        f = G.get('ice_sad', 1.0)
        pose['tail1'] = {'rx': -18 * f}
        pose['tail2'] = {'rx': -10 * f}
    elif name == 'Play':
        pitch = pose.get('body', {}).get('rx', 0.0)
        if pitch < 0:   # achterlijf omlaag: de staart mag niet verder zakken dan de grond
            lim = G.get('ice_play', -90)
            if lim > 0:
                lim *= min(1.0, -pitch / 16)
            tail = pose.setdefault('tail1', {})
            tail['rx'] = max(tail.get('rx', 0.0), lim)
    elif name == 'Sleep' and G.get('tail_lie'):
        pose = merge(pose, {'tail1': {'rx': 4}})
    return pose


def ice_flipper_pose(name, t, G):
    """Houdingen voor zeehond en walrus: buik op de grond, voorvinnen (leg_FL/FR) opzij,
    achterlijf (tail1) met twee achtervinnen (tail2). Hoeken in graden om de wereld-assen."""
    w = 2 * math.pi * t
    sn = math.sin(w)
    reach = G['ice_reach']

    def lids(closed):
        return {'lids': {'loc': (0, -0.05 * G['k'] * closed, 0)}}

    def flip(fwd=0.0, up=0.0, up_l=None):
        """Voorvinnen: fwd zwaait ze naar voren, up tilt de punt op."""
        ul = up if up_l is None else up_l
        return {'leg_FL': {'rz': -fwd, 'ry': -ul}, 'leg_FR': {'rz': fwd, 'ry': up}}

    def rear(wag=10, up=0.0, speed=1):
        return {'tail1': {'rz': wag * math.sin(speed * w), 'rx': up},
                'tail2': {'rz': wag * 1.3 * math.sin(speed * w - 0.9)}}

    def chest(deg, z=0.0, prop=1.0):
        """Borst omhoog: de romp kantelt om het achterlijf, het achterlijf blijft plat liggen
        en de voorvinnen zakken mee naar de grond (prop 1) of blijven vrij (prop 0)."""
        rise = G['d'] * math.sin(math.radians(deg)) + z
        a = math.degrees(math.asin(max(0.0, min(0.85, rise / reach)))) * prop
        return {'body': {'rx': -deg, 'loc': (0, 0, z)}, 'tail1': {'rx': deg},
                'leg_FL': {'ry': a, 'rx': deg}, 'leg_FR': {'ry': -a, 'rx': deg}}

    blink = lids(1.0 if 0.60 <= t < 0.65 else 0.0)
    if name == 'Idle':
        return merge(rear(10), blink, flip(4 * sn),
                     {'body': {'loc': (0, 0, 0.004 + 0.004 * sn)},
                      'head': {'rz': 9 * sn, 'ry': 3 * math.sin(2 * w), 'rx': 2 * sn}})
    if name in ('Walk', 'Run'):
        # hobbelen: borst omhoog en vinnen naar voren, dan neer en het achterlijf wipt op
        big = 1.0 if name == 'Walk' else 1.5
        up, down = max(0.0, sn), max(0.0, -sn)
        return merge(chest(9 * big * up, z=0.02 * (big - 1) * abs(sn)), flip(16 * math.cos(w) * big),
                     {'head': {'rx': 6 * big * up - 3}, 'tail1': {'rx': 8 * big * down, 'rz': 5 * sn},
                      'tail2': {'rx': 12 * big * down}})
    if name == 'Eat':
        return merge(rear(6), flip(-6), {'head': {'rx': G.get('eat', 30) + 6 * math.sin(3 * w)}})
    if name == 'Sit':
        return merge(chest(20), blink, {'head': {'rx': 12 + 2 * sn, 'rz': 8 * sn}, 'tail2': {'rz': 10 * sn}})
    if name == 'Lie':
        return merge(rear(5), blink, flip(-22),
                     {'head': {'rz': 9 * sn, 'rx': G.get('sleep', 20) * 0.55 + 2 * math.sin(2 * w)}})
    if name == 'Sleep':
        return merge(lids(1.0), flip(-30),
                     {'body': {'loc': (0, 0, 0.004 + 0.004 * sn)},
                      'head': {'rx': G.get('sleep', 20) - 2 + 2 * sn, 'ry': 4},
                      'tail1': {'rz': 22}, 'tail2': {'rz': 28}})
    if name == 'Poop':
        squeeze = lids(1.0 if 0.30 <= t < 0.62 else 0.0)
        return merge(chest(9), squeeze,
                     {'body': {'rz': 1.5 * math.sin(6 * w)}, 'head': {'rx': -4},
                      'tail1': {'rx': G.get('tail_up', 46)}, 'tail2': {'rx': 12}})
    if name == 'Pee':
        return merge(chest(5, z=0.03, prop=0.0), blink, flip(0, 8, up_l=34),
                     {'body': {'ry': -8}, 'head': {'rz': 14 + 3 * sn},
                      'tail1': {'rx': G.get('tail_up', 46) * 0.6, 'rz': -16 + 5 * sn}, 'tail2': {'rz': -12}})
    if name == 'Play':
        if t < 0.5:   # borst omhoog en in de vinnen klappen
            a = math.sin(math.pi * t / 0.5)
            clap = 24 * a * math.sin(8 * w)
            return merge(chest(18 * a, prop=0.0), flip(10 * a, clap), rear(14, up=0.0, speed=6),
                         {'head': {'rx': -10 * a, 'ry': 8 * math.sin(4 * w)}})
        j = max(0.0, math.sin(2 * math.pi * (t - 0.5)))
        return merge(chest(8 * j, z=0.22 * j, prop=0.0), flip(0, 32 * j), rear(18, up=14 * j, speed=6),
                     {'head': {'rx': 8 * j}})
    if name == 'Happy':
        hop = abs(math.sin(2 * w))
        return merge(chest(6 * hop, z=0.13 * hop, prop=0.0), flip(8 * hop, 34 * hop), rear(22, up=16 * hop, speed=4),
                     {'head': {'rx': -12, 'ry': 8 * sn}})
    if name == 'Sad':
        return merge(flip(-24), {'body': {'ry': 1.5 * sn, 'loc': (0, 0, 0.006)},
                                    'head': {'rx': G.get('sad', 30), 'rz': 7 * sn}})
    return {}


def ice_flippers(c, col, reach, stock, hind, wide=0.19):
    """Zeehond en walrus: de poten uit de kern weghalen en vinnen tekenen.
    Voorvinnen aan leg_FL/FR met het draaipunt in de schouder, een taps achterlijf aan tail1
    en twee achtervinnen in een V aan tail2. De achterpoot-botten blijven leeg."""
    b = c.b
    ice_drop(c, ('leg_FL', 'leg_FR', 'leg_HL', 'leg_HR'))
    zb = c.bz - c.bh / 2
    fy = c.legs[0][2]
    Lb, th, tilt = reach + 0.09, 0.07, 12
    sz = Lb / 2 * math.sin(math.radians(tilt)) + th * 1.15 / 2 + 0.004
    for sx, bone in ((1, 'leg_FL'), (-1, 'leg_FR')):
        S = Vector((sx * (c.bw / 2 - 0.03), fy, sz))
        ice_rz(b, sx * 30, S, b.box, bone, col, (Lb, wide, th), pre=(sx * (Lb / 2 - 0.09), 0, 0), ry=sx * tilt,
               taper=(0, 0.7, 1.15) if sx > 0 else (0, 1.15, 0.7), hard=True)
        c.piv[bone] = S + Vector((0, 0, 0.02))
    for sx, bone in ((1, 'leg_HL'), (-1, 'leg_HR')):
        c.piv[bone] = Vector((sx * 0.1, c.legs[2][2], zb + 0.08))
    # achterlijf: loopt taps toe, de onderkant blijft op de grond
    w0, h0 = c.bw * 0.92, c.bh * 0.92
    Lh = (stock + 0.12) / 2
    ang = math.atan2(h0 / 4, 2 * Lh)
    cz = zb + 0.004 + h0 / 2 * math.cos(ang) - Lh * math.sin(ang)
    b.box('tail1', c.C['body'], (w0, 2 * Lh, h0), (0, c.back + stock / 2 - 0.06, cz),
          rx=-math.degrees(ang), taper=(1, 1.0, 0.5), hard=True)
    c.piv['tail1'] = Vector((0, c.back - 0.03, zb + h0 * 0.4))
    c.piv['tail2'] = Vector((0, c.back + stock - 0.05, zb + 0.06))
    for sx in (1, -1):
        ice_rz(b, -sx * 24, (sx * 0.04, c.back + stock - 0.07, zb + 0.048), b.box, 'tail2', col, (0.15, hind, 0.055),
               pre=(0, hind / 2, 0), taper=(1, 0.55, 1.25), hard=True)
    return SimpleNamespace(zb=zb, w0=w0, h0=h0, ang=math.degrees(ang), stock=stock)


# ---------------------------------------------------------------- luiaard
def sloth_decor(c):
    b, C, P, k = c.b, c.C, c.P, c.k
    hcy, hz, hh, hw, hl, face, bz, bh, bw = c.hcy, c.hz, c.hh, c.hw, c.hl, c.face, c.bz, c.bh, c.bw
    fur, fur2 = C['body'], C['fur2']
    exk, ezk = c.D['eye']
    # kap van vacht om het bleke gezicht, met een pony over het voorhoofd
    b.box('head', fur, (hw + 0.07 * k, hl * 0.80, hh + 0.06 * k), (0, hcy + hl * 0.16, hz + 0.01 * k), bevel=0.34)
    b.box('head', fur2, (hw * 0.62, 0.12 * k, 0.07 * k), (0, face + 0.075 * k, hz + hh / 2), seg=1)
    for sx in (1, -1):
        # donkere streep door het oog, schuin naar buiten omlaag
        b.box('head', C['mask'], (0.165 * k, 0.07 * k, 0.072 * k), (sx * (exk + 0.04) * k, face + 0.031 * k, hz + (ezk - 0.02) * k),
              ry=sx * 24, seg=1)
    # snuitje met neus en een glimlach
    b.box('head', C['snout'], (0.19 * k, 0.09 * k, 0.14 * k), (0, face - 0.02 * k, hz - 0.095 * k))
    b.box('head', C['nose'], (0.09 * k, 0.04 * k, 0.05 * k), (0, face - 0.055 * k, hz - 0.055 * k), seg=1)
    b.box('head', C['nose'], (0.11 * k, 0.014 * k, 0.016 * k), (0, face - 0.066 * k, hz - 0.125 * k), bevel=0)
    for sx in (1, -1):
        b.box('head', C['nose'], (0.018 * k, 0.014 * k, 0.032 * k), (sx * 0.055 * k, face - 0.066 * k, hz - 0.113 * k), bevel=0)
    if P.get('tuft'):   # jong: plukje haar
        b.ball('head', fur2, (0.10 * k, 0.11 * k, 0.07 * k), (0, hcy + 0.02 * k, hz + hh / 2 + 0.045 * k), sub=1)
    # ruige vacht: twee capes over schouders en heupen met franje langs de rand
    f = c.bl / 0.66
    for y in (-0.17 * f, 0.17 * f):
        b.band('body', fur2, (bw + 0.03, 0.25 * f, bh + 0.03), (0, y, bz), c.body_bev + 0.01, cut=(2, -0.03, -1))
        for sx in (1, -1):
            for dy in (-0.07, 0.0, 0.07):
                b.box('body', fur2, (0.04, 0.075 * f, 0.11), (sx * bw / 2, y + dy * f, bz - 0.06),
                      taper=(2, 0.3, 1.0), hard=True, seg=1)
    if P.get('patch'):   # mannetje: oranje rugvlek met een donkere streep
        b.box('body', C['patch'], (0.24, 0.20 * f, 0.04), (0, 0.0, bz + bh / 2 + 0.002), seg=1)
        b.box('body', C['mask'], (0.06, 0.21 * f, 0.045), (0, 0.0, bz + bh / 2 + 0.003), seg=1)
    # drie lange bleke klauwen aan elke poot
    for bone, x, y in c.legs:
        fy = y - c.leg_d / 2
        for dx in (-0.042, 0.0, 0.042):
            ice_stick(b, bone, C['claw'], (x + dx, fy + 0.02, 0.07), (x + dx * 1.35, fy - 0.11, 0.014), 0.036, tip=0.3, bevel=0, ext=0)
    tail_chain(c, (0, c.back - 0.02, bz - 0.02), -25, -45, 0.04, 0.03, 0.09, 0.07, fur, fur, seg=1)


# ---------------------------------------------------------------- ijsbeer
def polarbear_decor(c):
    b, C, P, k = c.b, c.C, c.P, c.k
    hcy, hz, hh, hw, face, bz, bh, bw = c.hcy, c.hz, c.hh, c.hw, c.face, c.bz, c.bh, c.bw
    # Lange nek in twee stukken: de schouderhelft zit vast aan de romp, de kophelft buigt mee met de kop.
    # Zo knikt de nek halverwege en staat op het kopplaatje alleen de kop met een kort stuk nek.
    B0 = Vector((0, c.front + 0.16, bz + 0.05))
    T = Vector((0, hcy + 0.10 * k, hz - 0.04 * k))
    M = (B0 + T) / 2
    u = (T - B0).normalized()
    up = Vector((0, u.z, -u.y))
    ice_stick(b, 'body', C['body'], B0 - u * 0.07, M + u * 0.05, 0.40, seg=2, ext=0)
    neck(c, C['body'], 0.36, 0.36, y0=M.y - c.front, z0=M.z - bz, ty=0.10, tz=-0.04)
    # lange snuit met zwarte neus
    my, mz = face - 0.09 * k, hz - 0.07 * k
    b.box('head', C['muzzle'], (0.23 * k, 0.26 * k, 0.18 * k), (0, my, mz), taper=(1, 0.85, 1.0), hard=True)
    b.box('head', C['nose'], (0.11 * k, 0.06 * k, 0.07 * k), (0, my - 0.115 * k, mz + 0.055 * k), seg=1)
    b.box('head', C['nose'], (0.02 * k, 0.02 * k, 0.06 * k), (0, my - 0.125 * k, mz - 0.01 * k), bevel=0)
    ice_ears(c, 0.14 * k, hcy + 0.09 * k, hz + hh / 2 + 0.025 * k, (0.12 * k, 0.07 * k, 0.11 * k), C['ear'], C['ear_in'],
             tip=1.0, bevel=0.45)
    if P.get('ruff'):   # mannetje: ruige plukken over de nek
        for fr in (0.14, 0.42, 0.74):
            b.box('body' if fr < 0.5 else 'head', C['shade'], (0.17, 0.14, 0.10), B0 + (T - B0) * fr + up * 0.20, rx=8,
                  taper=(1, 1.0, 0.35), hard=True, seg=1)
    if P.get('cheeks'):   # vrouwtje: blosjes
        for sx in (1, -1):
            b.box('head', C['cheek'], (0.02 * k, 0.09 * k, 0.06 * k), (sx * 0.112 * k, my + 0.03 * k, mz - 0.01 * k), seg=1)
    if P.get('fluff'):   # jong: bol en pluizig
        b.box('body', C['body'], (bw + 0.07, c.bl + 0.03, bh + 0.06), (0, 0.0, bz + 0.012), bevel=0.45)
        for sx in (1, -1):
            b.box('head', C['body'], (0.13 * k, 0.15 * k, 0.16 * k), (sx * (hw / 2 - 0.015 * k), hcy + 0.01 * k, hz - 0.075 * k), bevel=0.45)
    if P.get('tuft'):
        b.ball('head', C['shade'], (0.085 * k, 0.09 * k, 0.065 * k), (0, hcy - 0.02 * k, hz + hh / 2 + 0.02 * k), sub=1)
    # grote voeten: donkere nagels en donkere zolen
    ice_claws(c, C['claw'], n=3, gap=0.065, size=(0.035, 0.045, 0.04))
    pw = c.D['paw']
    for bone, x, y in c.legs:
        b.box(bone, C['claw'], (c.leg_w * 0.72, c.leg_d * 0.72, 0.012), (x, y + pw[3], 0.004), bevel=0)
    tail_chain(c, (0, c.back - 0.02, bz + 0.10), -35, -60, 0.07, 0.05, 0.11, 0.09, C['body'], C['tail'], seg=1)


# ---------------------------------------------------------------- zeehond
def seal_decor(c):
    b, C, P, k = c.b, c.C, c.P, c.k
    hcy, hz, hh, hw, face, bz, bh, bw = c.hcy, c.hz, c.hh, c.hw, c.face, c.bz, c.bh, c.bw
    nk = neck(c, C['body'], 0.40, 0.36, y0=0.17, z0=0.0, taper=(2, 1.12, 0.92))
    c.extra['icon_low'] = hz - hh / 2 - 0.05 * k   # kopplaatje: de kop groot in beeld, de dikke nek loopt het beeld uit
    belly(c, C['belly'], 0.34)
    b.box('head', C['belly'], (nk.w * 0.76, 0.06, nk.L * 0.9), nk.at(0.48, back=-(nk.d / 2 * nk.kf(0.48) - 0.012)),
          rx=nk.deg, seg=1)
    fl = ice_flippers(c, C['flip'], reach=0.30, stock=0.36, hind=0.28)
    # snuit: twee bolle wangen met snorharen, neus ertussen
    for sx in (1, -1):
        b.box('head', C['muzzle'], (0.15 * k, 0.11 * k, 0.12 * k), (sx * 0.07 * k, face - 0.03 * k, hz - 0.105 * k), bevel=0.4)
        for dz in (0.02, -0.025):
            ice_stick(b, 'head', C['whisker'], (sx * 0.11 * k, face - 0.05 * k, hz - (0.105 - dz) * k),
                      (sx * 0.29 * k, face - 0.02 * k, hz - (0.125 - 2.2 * dz) * k), 0.02 * k, bevel=0, ext=0)
    b.box('head', C['nose'], (0.085 * k, 0.045 * k, 0.05 * k), (0, face - 0.078 * k, hz - 0.06 * k), seg=1)
    # vlekken op rug, flanken, kop en achterlijf
    f = c.bl / 0.74
    spots, fluff = P.get('spots', 0), P.get('fluff')
    if spots:
        sp = C['spot']
        if fluff:   # pup: twee vlekjes midden op de pluizige rug
            for x, y in [(0.05, -0.07), (-0.05, 0.06)]:
                b.box('body', sp, (0.09, 0.09, 0.02), (x, y * f, bz + bh / 2 + 0.052), seg=1)
        else:
            for x, y in [(0.10, -0.20), (-0.09, -0.04), (0.09, 0.13), (-0.08, 0.27)][:spots + 1]:
                b.box('body', sp, (0.11, 0.11, 0.02), (x, y * f, bz + bh / 2 - 0.003), seg=1)
            for sx, y, z in [(1, -0.08, 0.05), (-1, 0.10, 0.06), (1, 0.22, 0.03), (-1, -0.20, 0.04)][:spots + 1]:
                b.box('body', sp, (0.02, 0.10, 0.09), (sx * (bw / 2 - 0.003), y * f, bz + z), seg=1)
        if spots > 1 or fluff:
            for x, y in [(0.08, 0.07), (-0.07, -0.04)]:
                b.box('head', sp, (0.075 * k, 0.075 * k, 0.02 * k), (x * k, hcy + y * k, hz + hh / 2 - 0.003 * k), seg=1)
        fr = (0.12 + 0.36 * fl.stock) / (fl.stock + 0.12)
        b.box('tail1', sp, (0.10, 0.10, 0.02), (0.03, c.back + 0.36 * fl.stock, fl.zb + fl.h0 * (1 - 0.5 * fr) * 0.99),
              rx=-2 * fl.ang, seg=1)
    if fluff:   # pup: wit en pluizig
        b.box('body', C['fluff'], (bw + 0.06, c.bl * 0.98, bh + 0.05), (0, 0.0, bz + 0.03), bevel=0.45)
        for sx in (1, -1):
            b.box('head', C['fluff'], (0.12 * k, 0.15 * k, 0.15 * k), (sx * (hw / 2 - 0.01 * k), hcy + 0.02 * k, hz - 0.07 * k), bevel=0.45)
    if P.get('tuft'):
        b.ball('head', C['fluff'], (0.15 * k, 0.14 * k, 0.085 * k), (0, hcy + 0.02 * k, hz + hh / 2 + 0.01 * k))


# ---------------------------------------------------------------- walrus
def walrus_decor(c):
    b, C, P, k = c.b, c.C, c.P, c.k
    hcy, hz, hh, hw, face, bz, bh, bw = c.hcy, c.hz, c.hh, c.hw, c.face, c.bz, c.bh, c.bw
    nk = neck(c, C['body'], 0.52, 0.46, y0=0.22, z0=0.0, taper=(2, 1.12, 0.9))
    # rimpels: donkere plooien om romp en nek
    fold = C['fold']
    for y in P.get('folds', (-0.10, 0.12)):
        b.band('body', fold, (bw + 0.022, 0.045, bh + 0.022), (0, y * c.bl, bz), c.body_bev)
    for fr in (0.30, 0.66):
        b.band('head', fold, (nk.w * nk.kf(fr) + 0.022, nk.d * nk.kf(fr) + 0.022, 0.04), nk.at(fr), nk.bev, axis=2, rx=nk.deg)
    ice_flippers(c, C['flip'], reach=0.34, stock=0.34, hind=0.30, wide=0.22)
    # brede snorrenkussens met stoppels
    py, pz = face - 0.05 * k, hz - 0.10 * k
    for sx in (1, -1):
        b.box('head', C['pad'], (0.23 * k, 0.17 * k, 0.20 * k), (sx * 0.108 * k, py, pz), bevel=0.4)
        for dx, dz in ((0.07, 0.02), (0.14, 0.02), (0.07, -0.03), (0.14, -0.03)):
            b.box('head', C['dot'], (0.022 * k, 0.012 * k, 0.022 * k), (sx * dx * k, py - 0.086 * k, pz + dz * k), bevel=0)
        tusk = P.get('tusk', 0)
        if tusk:   # slagtanden: recht omlaag, iets naar buiten
            ice_stick(b, 'head', C['tusk'], (sx * 0.085 * k, py - 0.02 * k, pz - 0.05 * k),
                      (sx * 0.105 * k, py - 0.05 * k, pz - (0.10 + tusk) * k), 0.065 * k, tip=0.35, ext=0)
    b.box('head', C['nose'], (0.12 * k, 0.06 * k, 0.06 * k), (0, py - 0.065 * k, pz + 0.085 * k), seg=1)
    if P.get('tuft'):
        b.ball('head', C['fold'], (0.09 * k, 0.10 * k, 0.06 * k), (0, hcy, hz + hh / 2 + 0.03 * k), sub=1)


# ---------------------------------------------------------------- rendier
def ice_antler(b, k, sx, O, col, level):
    """Gewei aan een kant: 3 groot en vertakt (man), 2 kleiner (vrouw), 1 knopjes (jong)."""
    def at(dx, dy, dz):
        return O + Vector((sx * dx * k, dy * k, dz * k))
    if level == 1:
        ice_stick(b, 'head', col, at(0, 0, -0.03), at(0.02, 0.01, 0.08), 0.07 * k, tip=0.6)
        return
    if level == 2:
        A = at(0.07, 0.07, 0.15)
        ice_stick(b, 'head', col, at(0, 0, -0.03), A, 0.062 * k)
        ice_stick(b, 'head', col, A, at(0.14, 0.03, 0.31), 0.055 * k, tip=0.5)
        ice_stick(b, 'head', col, A, at(0.07, 0.17, 0.25), 0.05 * k, tip=0.5)
        ice_stick(b, 'head', col, at(0.01, 0, 0.03), at(0.03, -0.12, 0.10), 0.05 * k, tip=0.5)
        return
    A, T = at(0.10, 0.10, 0.20), at(0.20, 0.07, 0.42)
    ice_stick(b, 'head', col, at(0, 0, -0.03), A, 0.075 * k)                       # stang
    ice_stick(b, 'head', col, A, T, 0.068 * k)
    ice_stick(b, 'head', col, at(0.01, 0, 0.03), at(0.04, -0.17, 0.12), 0.055 * k, tip=0.5)    # oogtak naar voren
    ice_stick(b, 'head', col, A, at(0.09, 0.27, 0.30), 0.055 * k, tip=0.5)         # achtertak
    ice_stick(b, 'head', col, at(0.15, 0.085, 0.31), at(0.29, 0.06, 0.37), 0.055 * k, tip=0.5)  # zijtak
    ice_stick(b, 'head', col, T, at(0.31, 0.05, 0.55), 0.055 * k, tip=0.5)         # kroon
    ice_stick(b, 'head', col, T, at(0.16, 0.0, 0.59), 0.055 * k, tip=0.5)


def reindeer_decor(c):
    b, C, P, k = c.b, c.C, c.P, c.k
    hcy, hz, hh, hw, face, bz, bh, bw = c.hcy, c.hz, c.hh, c.hw, c.face, c.bz, c.bh, c.bw
    ruff = C['ruff']
    nk = neck(c, ruff, 0.22, 0.27, taper=(2, 1.22, 0.9))
    # bruine streep over de nek, ruige kraag eronder, lichte borst en lichte bips
    b.box('head', C['body'], (0.13, 0.06, nk.L * 0.95), nk.at(0.5, back=nk.d / 2 * nk.kf(0.5) + 0.004), rx=nk.deg, seg=1)
    mane = P.get('mane', 0.0)
    if mane:
        b.box('head', ruff, (0.18, mane, nk.L * 0.8), nk.at(0.40, back=-(nk.d / 2 * nk.kf(0.40) + mane * 0.3)), rx=nk.deg,
              taper=(2, 0.5, 1.0), hard=True, seg=1)
    b.box('body', ruff, (bw * 0.70, 0.05, bh * 0.62), (0, c.front + 0.002, bz - 0.03), seg=1)
    b.box('body', ruff, (bw * 0.64, 0.05, bh * 0.56), (0, c.back - 0.002, bz + 0.02), seg=1)
    belly(c, C['belly'], 0.22)
    # snuit met donkere neus, oren opzij
    my, mz = face - 0.08 * k, hz - 0.075 * k
    b.box('head', C['muzzle'], (0.22 * k, 0.24 * k, 0.19 * k), (0, my, mz))
    b.box('head', C['nose'], (0.13 * k, 0.05 * k, 0.085 * k), (0, my - 0.11 * k, mz + 0.03 * k), seg=1)
    for sx in (1, -1):
        b.box('head', C['body'], (0.15 * k, 0.05 * k, 0.085 * k), (sx * (hw / 2 + 0.055 * k), hcy + 0.13 * k, hz + 0.05 * k),
              ry=-sx * 16, seg=1)
        O = Vector((sx * 0.085 * k, hcy + 0.05 * k, hz + hh / 2))
        level = P.get('antlers', 0)
        if level:
            ice_antler(b, k, sx, O, C['antler'], level)
    if P.get('blaze'):   # jong: witte bles
        b.box('head', ruff, (0.09 * k, 0.02 * k, 0.15 * k), (0, face - 0.002 * k, hz + 0.09 * k), bevel=0)
    tail_chain(c, (0, c.back - 0.02, bz + 0.13), -30, -55, 0.07, 0.06, 0.10, 0.09, C['body'], C['tail'], seg=1)


# ---------------------------------------------------------------- wolf
def wolf_decor(c):
    b, C, P, k = c.b, c.C, c.P, c.k
    hcy, hz, hh, hw, hl, face, bz, bh, bw = c.hcy, c.hz, c.hh, c.hw, c.hl, c.face, c.bz, c.bh, c.bw
    pale, dark = C['pale'], C['dark']
    nk = neck(c, C['body'], 0.26, 0.28, taper=(2, 1.2, 0.9))
    # lichte keel, borst en buik; donkere rug
    b.box('head', pale, (nk.w * 0.80, 0.06, nk.L * 0.95), nk.at(0.45, back=-(nk.d / 2 * nk.kf(0.45) - 0.01)), rx=nk.deg, seg=1)
    b.box('body', pale, (bw * 0.70, 0.05, bh * 0.60), (0, c.front + 0.002, bz - 0.05), seg=1)
    belly(c, pale, 0.34)
    if P.get('saddle'):
        ice_saddle(c, dark, 0.24)
        b.box('head', dark, (0.15 * k, hl * 0.72, 0.03 * k), (0, hcy + 0.035 * k, hz + hh / 2 + 0.002 * k), seg=1)
    # lange lichte snuit, zwarte neus, lichte wangen
    my, mz = face - 0.09 * k, hz - 0.09 * k
    b.box('head', pale, (0.21 * k, 0.25 * k, 0.16 * k), (0, my, mz), taper=(1, 0.8, 1.0), hard=True)
    b.box('head', C['nose'], (0.10 * k, 0.06 * k, 0.065 * k), (0, my - 0.115 * k, mz + 0.055 * k), seg=1)
    for sx in (1, -1):   # wangen: lichte wiggen om de onderste hoeken van de kop
        b.box('head', pale, (0.13 * k, 0.12 * k, 0.17 * k), (sx * 0.122 * k, face + 0.052 * k, hz - hh / 2 + 0.08 * k),
              taper=(2, 1.0, 0.35), hard=True, seg=1)
    # spitse oren recht omhoog
    ice_ears(c, 0.125 * k, hcy + 0.07 * k, hz + hh / 2 + 0.085 * k, (0.14 * k, 0.07 * k, 0.23 * k), C['ear'], C['ear_in'], tip=0.2)
    ice_tail(c, (0, c.back - 0.04, bz + 0.09), -52, -68, 0.24, 0.26, 0.15, 0.19, C['body'], tip=C['tip'], tip_l=0.17)


# ---------------------------------------------------------------- poolvos
def arcticfox_decor(c):
    b, C, P, k = c.b, c.C, c.P, c.k
    hcy, hz, hh, hw, hl, face, bz, bh, bw = c.hcy, c.hz, c.hh, c.hw, c.hl, c.face, c.bz, c.bh, c.bw
    if P.get('saddle'):
        ice_saddle(c, C['saddle'], 0.26)
        b.box('head', C['saddle'], (0.16 * k, hl * 0.72, 0.03 * k), (0, hcy + 0.035 * k, hz + hh / 2 + 0.002 * k), seg=1)
    # kort snuitje, zwart neusje, dikke wangen
    my, mz = face - 0.04 * k, hz - 0.095 * k
    b.box('head', C['muzzle'], (0.18 * k, 0.13 * k, 0.12 * k), (0, my, mz), taper=(1, 0.8, 1.0), hard=True)
    b.box('head', C['nose'], (0.075 * k, 0.045 * k, 0.05 * k), (0, my - 0.06 * k, mz + 0.04 * k), seg=1)
    b.box('head', C['muzzle'], (hw + 0.11 * k, 0.15 * k, 0.17 * k), (0, hcy, hz - hh / 2 + 0.095 * k),
          taper=(2, 0.7, 1.0), hard=True)
    ice_ears(c, 0.135 * k, hcy + 0.06 * k, hz + hh / 2 + 0.06 * k, (0.15 * k, 0.07 * k, 0.17 * k), C['ear'], C['ear_in'], tip=0.25)
    # heel dikke pluimstaart
    ice_tail(c, (0, c.back - 0.06, bz + 0.03), -18, -4, 0.16, 0.27, 0.22, 0.30, C['body'], tip=C['tip'], tip_l=0.20)


# ---------------------------------------------------------------- bruine beer
def bear_decor(c):
    b, C, P, k = c.b, c.C, c.P, c.k
    hcy, hz, hh, hw, face, bz, bh, bw = c.hcy, c.hz, c.hh, c.hw, c.face, c.bz, c.bh, c.bw
    hump = P.get('hump', 0.0)
    if hump:   # schoftbult
        b.box('body', C['hump'], (bw * 0.86, 0.52 * c.bl, hump + 0.16), (0, c.front + 0.28 * c.bl, bz + bh / 2 + hump / 2 - 0.08),
              bevel=0.45)
    if P.get('collar'):   # welp: lichte kraag
        b.band('body', C['collar'], (bw + 0.022, 0.12, bh + 0.022), (0, c.front + c.body_bev + 0.07, bz), c.body_bev)
    # lichte snuit, donkere neus, ronde oren
    my, mz = face - 0.065 * k, hz - 0.10 * k
    b.box('head', C['snout'], (0.27 * k, 0.21 * k, 0.20 * k), (0, my, mz))
    b.box('head', C['nose'], (0.12 * k, 0.06 * k, 0.075 * k), (0, my - 0.095 * k, mz + 0.065 * k), seg=1)
    b.box('head', C['nose'], (0.02 * k, 0.02 * k, 0.06 * k), (0, my - 0.106 * k, mz - 0.005 * k), bevel=0)
    ice_ears(c, 0.21 * k, hcy + 0.06 * k, hz + hh / 2 + 0.035 * k, (0.17 * k, 0.08 * k, 0.16 * k), C['body'], C['ear_in'],
             tip=1.0, bevel=0.45)
    if P.get('tuft'):
        b.ball('head', C['hump'], (0.09 * k, 0.10 * k, 0.07 * k), (0, hcy - 0.03 * k, hz + hh / 2 + 0.03 * k), sub=1)
    ice_claws(c, C['claw'], n=3, gap=0.065, size=(0.035, 0.045, 0.04))
    tail_chain(c, (0, c.back - 0.02, bz + 0.12), -35, -60, 0.07, 0.05, 0.12, 0.10, C['body'], C['body'], seg=1)


# ---------------------------------------------------------------- recepten
# s is de maat tegenover het leeuwenmannetje (1.00). Speelgoedmaten: elke volwassene minstens 0.42 hoog,
# elk jong minstens 0.28 (zeehond en walrus zijn laag maar lang en breed).
SPECIES['sloth'] = dict(
    decor=sloth_decor, build=ice_build,
    dims=dict(leg_len=0.40, leg_w=0.11, leg_d=0.12, bw=0.44, bl=0.66, bh=0.42, BT=(1.0, 1.0),
              head=(0.44, 0.34, 0.40), head_at=(0.25, 0.25), eye=(0.10, 0.035), paw=(0.012, 0.012, 0.06, 0.0),
              eat=(12, 46), sleep=(40, 0.0)),
    col=dict(nose='#3E2A1E', claw='#F3EBD2', mask='#5B3F2B', patch='#EDA63A'),
    variants={
        'male':    dict(s=0.68, head_k=1.00, leg_k=1.0, body_l=1.00, eye_k=1.1, patch=True,
                        col=dict(body='#A08058', fur2='#86683F', head='#F0E2BF', snout='#D9C39A', paw='#6E5436')),
        'female':  dict(s=0.63, head_k=0.97, leg_k=1.0, body_l=1.00, eye_k=1.1,
                        col=dict(body='#B8996F', fur2='#9E7F56', head='#F5E9CB', snout='#E0CCA6', paw='#84683F')),
        'young_m': dict(s=0.44, head_k=1.28, leg_k=0.78, body_l=0.80, eye_k=1.3, tuft=True,
                        col=dict(body='#AE8E64', fur2='#8E7048', head='#F3E6C6', snout='#DCC8A0', paw='#775B3A')),
        'young_f': dict(s=0.44, head_k=1.28, leg_k=0.78, body_l=0.80, eye_k=1.3,
                        col=dict(body='#C6A77C', fur2='#AE8F64', head='#F8EED4', snout='#E6D4B0', paw='#907246')),
    })
SPECIES['polarbear'] = dict(
    decor=polarbear_decor, build=ice_build, view=1.15,
    dims=dict(leg_len=0.40, leg_w=0.20, leg_d=0.23, bw=0.58, bl=1.10, bh=0.52, BT=(1.0, 1.0), body_bevel=0.34,
              head=(0.38, 0.38, 0.36), head_at=(0.15, 0.20), neck=(0.10, 0.26), eye=(0.11, 0.075),
              paw=(0.03, 0.06, 0.08, -0.025), leg_in=0.03, leg_f=0.20, leg_h=0.19, leg_top=0.14, lie_hp=0.10,
              eat=(10, 80), sleep=(40, 0.0)),
    col=dict(nose='#1F1B1B', claw='#3A3430'),
    variants={
        'male':    dict(s=1.30, head_k=1.00, leg_k=1.0, body_l=1.00, eye_k=1.0, ruff=True,
                        col=dict(body='#E8D9B4', leg='#DECEA8', paw='#BCA982', muzzle='#D8C7A0', shade='#CDBB92',
                                 ear='#5E524A', ear_in='#3A322E', tail='#A8946E')),
        'female':  dict(s=1.16, head_k=0.97, leg_k=1.0, body_l=1.00, eye_k=1.0, cheeks=True,
                        col=dict(body='#EEE0BC', leg='#E4D5B0', paw='#C6B48E', muzzle='#E0D0AA', shade='#D6C6A0',
                                 ear='#7A6258', ear_in='#D49A92', cheek='#EBA9A0', tail='#B4A078')),
        'young_m': dict(s=0.68, head_k=1.30, leg_k=0.75, body_l=0.76, eye_k=1.25, neck_k=0.55, fluff=True, tuft=True,
                        col=dict(body='#F0E4C4', leg='#E6D8B6', paw='#C8B690', muzzle='#E0D0AC', shade='#C8B690',
                                 ear='#5E524A', ear_in='#3A322E', tail='#B4A078')),
        'young_f': dict(s=0.68, head_k=1.30, leg_k=0.75, body_l=0.76, eye_k=1.25, neck_k=0.55, fluff=True, cheeks=True,
                        col=dict(body='#F4EACE', leg='#EADDBE', paw='#CEBD98', muzzle='#E6D8B6', shade='#D6C6A0',
                                 ear='#7A6258', ear_in='#D49A92', cheek='#EBA9A0', tail='#BCA982')),
    })
SPECIES['seal'] = dict(
    decor=seal_decor, build=ice_build,
    dims=dict(leg_len=0.055, leg_w=0.10, leg_d=0.10, bw=0.50, bl=0.74, bh=0.40, BT=(1.0, 1.0), body_bevel=0.36,
              head=(0.44, 0.40, 0.40), head_at=(0.30, 0.30), head_bevel=0.36, neck=(0.14, 0.04), eye=(0.125, 0.055),
              leg_f=0.20, leg_h=0.05, lie_hp=0.2, eat=(0, 80), sleep=(60, 0.0), ice_flipper=0.30),
    col=dict(nose='#1E1E22', whisker='#F4F4F0'),
    variants={
        'male':    dict(s=0.90, head_k=1.00, leg_k=1.0, body_l=1.00, eye_k=1.3, spots=3,
                        col=dict(body='#7F8A96', belly='#D9DEE0', spot='#525C68', flip='#5F6975', muzzle='#C9CED2')),
        'female':  dict(s=0.83, head_k=0.97, leg_k=1.0, body_l=1.00, eye_k=1.3, spots=2,
                        col=dict(body='#A7B0B8', belly='#EDF0EE', spot='#7A8490', flip='#838D98', muzzle='#E3E6E6')),
        'young_m': dict(s=0.56, head_k=1.28, leg_k=1.0, body_l=0.80, eye_k=1.5, neck_k=0.7, spots=1, fluff=True,
                        col=dict(body='#EFE4C8', belly='#F8F1DE', fluff='#F1E7CE', spot='#AEB4B8', flip='#98A2AB',
                                 muzzle='#D9CFB6', whisker='#5E5E64')),
        'young_f': dict(s=0.56, head_k=1.28, leg_k=1.0, body_l=0.80, eye_k=1.5, neck_k=0.7, fluff=True, tuft=True,
                        col=dict(body='#F4EBD4', belly='#FBF5E4', fluff='#F7EFDA', flip='#AEB6BD',
                                 muzzle='#E0D6BE', whisker='#5E5E64')),
    })
SPECIES['walrus'] = dict(
    decor=walrus_decor, build=ice_build, view=1.1,
    dims=dict(leg_len=0.06, leg_w=0.10, leg_d=0.10, bw=0.66, bl=0.86, bh=0.54, BT=(1.0, 1.0), body_bevel=0.36,
              head=(0.46, 0.40, 0.42), head_at=(0.30, 0.30), neck=(0.16, 0.04), eye=(0.13, 0.10),
              leg_f=0.22, leg_h=0.05, lie_hp=0.2, eat=(0, 80), sleep=(60, 0.0), ice_flipper=0.34),
    col=dict(nose='#3A2620', tusk='#FFF8E8', dot='#6A4630'),
    variants={
        'male':    dict(s=1.25, head_k=1.00, leg_k=1.0, body_l=1.00, eye_k=0.95, tusk=0.30, folds=(-0.22, 0.0, 0.22),
                        col=dict(body='#9B6B4E', fold='#7E543C', flip='#75503A', pad='#D9B38C')),
        'female':  dict(s=1.12, head_k=0.97, leg_k=1.0, body_l=1.00, eye_k=0.95, tusk=0.17,
                        col=dict(body='#B07E5E', fold='#94664A', flip='#8A6046', pad='#E6C4A0')),
        'young_m': dict(s=0.70, head_k=1.26, leg_k=1.0, body_l=0.80, eye_k=1.2, neck_k=0.7, tusk=0.06, folds=(0.05,),
                        col=dict(body='#8F7466', fold='#765E52', flip='#6E574C', pad='#D6BCA4')),
        'young_f': dict(s=0.70, head_k=1.26, leg_k=1.0, body_l=0.80, eye_k=1.2, neck_k=0.7, folds=(0.05,), tuft=True,
                        col=dict(body='#A68A7A', fold='#8C7264', flip='#836A5C', pad='#E6CEB8')),
    })
SPECIES['reindeer'] = dict(
    decor=reindeer_decor, build=ice_build, view=1.3,
    dims=dict(leg_len=0.52, leg_w=0.11, leg_d=0.13, bw=0.42, bl=0.86, bh=0.42, BT=(1.0, 1.0),
              head=(0.30, 0.36, 0.34), neck=(0.24, 0.12), eye=(0.105, 0.075), paw=(0.014, 0.014, 0.08, 0.0),
              eat=(10, 88), sleep=(50, 0.0)),
    col=dict(nose='#2A1E1A', paw='#2E2420', antler='#C9A46A'),
    variants={
        'male':    dict(s=1.05, head_k=1.00, leg_k=1.0, body_l=1.00, eye_k=1.0, antlers=3, mane=0.14,
                        col=dict(body='#7A5236', ruff='#EFE6D2', belly='#5E3E2A', leg='#5E3E2A', muzzle='#A07A58',
                                 tail='#EFE6D2')),
        'female':  dict(s=0.95, head_k=0.97, leg_k=1.0, body_l=1.00, eye_k=1.0, antlers=2, mane=0.08,
                        col=dict(body='#96704E', ruff='#F3ECDA', belly='#7A5A3E', leg='#7A5A3E', muzzle='#B8946E',
                                 tail='#F3ECDA')),
        'young_m': dict(s=0.58, head_k=1.28, leg_k=0.85, body_l=0.78, eye_k=1.25, neck_k=0.7, antlers=1,
                        col=dict(body='#9A7450', ruff='#EFE6D2', belly='#7E5E40', leg='#7E5E40', muzzle='#BC9A76',
                                 tail='#EFE6D2')),
        'young_f': dict(s=0.58, head_k=1.28, leg_k=0.85, body_l=0.78, eye_k=1.25, neck_k=0.7, blaze=True,
                        col=dict(body='#B08A62', ruff='#F5EEDC', belly='#94724E', leg='#94724E', muzzle='#CCAC88',
                                 tail='#F5EEDC')),
    })
SPECIES['wolf'] = dict(
    decor=wolf_decor, build=ice_build,
    dims=dict(leg_len=0.46, leg_w=0.12, leg_d=0.14, bw=0.40, bl=0.86, bh=0.40, BT=(1.0, 1.0),
              head=(0.38, 0.34, 0.36), neck=(0.12, 0.07), eye=(0.11, 0.075), paw=(0.02, 0.04, 0.07, -0.015),
              eat=(12, 80), sleep=(45, 0.0), tail_lie=True),
    col=dict(nose='#1E1A1A'),
    variants={
        'male':    dict(s=0.92, head_k=1.00, leg_k=1.0, body_l=1.00, eye_k=1.0, saddle=True,
                        col=dict(body='#7E8791', dark='#4E555E', pale='#E9E4D8', leg='#C9C6BC', paw='#A9A59A',
                                 ear='#4E555E', ear_in='#D9B8B0', tip='#2E3238')),
        'female':  dict(s=0.85, head_k=0.97, leg_k=1.0, body_l=1.00, eye_k=1.0,
                        col=dict(body='#A39A8C', dark='#6E655A', pale='#F3EEE2', leg='#D9D2C2', paw='#BAB2A2',
                                 ear='#8A8072', ear_in='#E6C4BC', tip='#3A3430')),
        'young_m': dict(s=0.52, head_k=1.30, leg_k=0.80, body_l=0.78, eye_k=1.25, neck_k=0.7, saddle=True,
                        col=dict(body='#77706A', dark='#4A4440', pale='#E0D8CA', leg='#BDB6A9', paw='#9F988B',
                                 ear='#4A4440', ear_in='#D9B8B0', tip='#2E2A28')),
        'young_f': dict(s=0.52, head_k=1.30, leg_k=0.80, body_l=0.78, eye_k=1.25, neck_k=0.7,
                        col=dict(body='#968E84', dark='#6A625A', pale='#EFE8DC', leg='#D2CABC', paw='#B5AD9F',
                                 ear='#7C746A', ear_in='#E6C4BC', tip='#3A3430')),
    })
SPECIES['arcticfox'] = dict(
    decor=arcticfox_decor, build=ice_build,
    dims=dict(leg_len=0.23, leg_w=0.10, leg_d=0.11, bw=0.36, bl=0.60, bh=0.34, BT=(1.0, 1.0), body_bevel=0.34,
              head=(0.42, 0.34, 0.36), head_at=(0.28, 0.28), eye=(0.12, 0.065), paw=(0.016, 0.03, 0.06, -0.01),
              eat=(14, 60), sleep=(34, 0.0), tail_lie=True),
    col=dict(nose='#1E1E24'),
    variants={
        'male':    dict(s=0.62, head_k=1.00, leg_k=1.0, body_l=1.00, eye_k=1.1, saddle=True,
                        col=dict(body='#C9D5E0', saddle='#9FB0C0', muzzle='#F2F5F8', leg='#B7C5D2', paw='#7F92A5',
                                 ear='#9FB0C0', ear_in='#4A596C', tip='#6F8498')),
        'female':  dict(s=0.57, head_k=0.97, leg_k=1.0, body_l=1.00, eye_k=1.1,
                        col=dict(body='#DCE4EB', muzzle='#FBFCFD', leg='#C9D4DE', paw='#93A4B5',
                                 ear='#C9D4DE', ear_in='#C99AA0', tip='#9FB0C0')),
        'young_m': dict(s=0.42, head_k=1.26, leg_k=0.85, body_l=0.82, eye_k=1.3, saddle=True,
                        col=dict(body='#B9C6D3', saddle='#8FA1B3', muzzle='#EEF2F5', leg='#A7B6C4', paw='#73869A',
                                 ear='#8FA1B3', ear_in='#4A596C', tip='#5F7388')),
        'young_f': dict(s=0.42, head_k=1.26, leg_k=0.85, body_l=0.82, eye_k=1.3,
                        col=dict(body='#D3DCE5', muzzle='#FAFBFC', leg='#C1CCD6', paw='#8D9EAF',
                                 ear='#C1CCD6', ear_in='#C99AA0', tip='#FFFFFF')),
    })
SPECIES['bear'] = dict(
    decor=bear_decor, build=ice_build, view=1.1,
    dims=dict(leg_len=0.36, leg_w=0.21, leg_d=0.23, bw=0.62, bl=1.00, bh=0.56, BT=(1.0, 1.0), body_bevel=0.34,
              head=(0.50, 0.42, 0.46), head_at=(0.18, 0.25), head_fwd=0.40, eye=(0.14, 0.095),
              paw=(0.02, 0.05, 0.08, -0.02), leg_in=0.04, leg_f=0.20, leg_h=0.19, leg_top=0.16, lie_hp=0.11,
              eat=(12, 60), sleep=(32, 0.0)),
    col=dict(nose='#2A1C16', claw='#EADFC6'),
    variants={
        'male':    dict(s=1.22, head_k=1.00, leg_k=1.0, body_l=1.00, eye_k=1.0, hump=0.10,
                        col=dict(body='#6E4A2E', hump='#5C3C24', snout='#C99E6E', ear_in='#B88A5E', leg='#5C3C24',
                                 paw='#4A2E1C')),
        'female':  dict(s=1.08, head_k=0.97, leg_k=1.0, body_l=1.00, eye_k=1.0, hump=0.06,
                        col=dict(body='#94683E', hump='#855C36', snout='#E0BC8C', ear_in='#D2A878', leg='#7E5632',
                                 paw='#684628')),
        'young_m': dict(s=0.64, head_k=1.26, leg_k=0.80, body_l=0.78, eye_k=1.25, collar=True,
                        col=dict(body='#7E5636', hump='#6A4628', snout='#D2AA7C', ear_in='#C0946A', leg='#6A4628',
                                 paw='#563820', collar='#E6CFA4')),
        'young_f': dict(s=0.64, head_k=1.26, leg_k=0.80, body_l=0.78, eye_k=1.25, tuft=True,
                        col=dict(body='#A2764A', hump='#8E6640', snout='#E6C698', ear_in='#D8B284', leg='#8A6238',
                                 paw='#74522E')),
    })
