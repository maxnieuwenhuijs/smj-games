"""Pakket 20: wilde dieren - konijn, jachtluipaard, gazelle, tijger, panter, aap, gorilla, krokodil, panda.

Dit bestand draait in de module van build_animals.py en gebruikt alles wat daar staat.
Alle negen zijn gewone viervoeters: gedeeld skelet, gedeelde twaalf animaties.

Een ding is anders dan bij de soorten in de kern: ze worden gebouwd via wild_build. Die roept de gewone
build_animal aan en hangt er daarna een eigen 'poser' aan (wild_pose). De poser neemt de gedeelde houding en
- tilt de staart of de kop op als die anders door de grond zou zakken (lange staart bij zitten en
  verdrietig, de lange snuit en de staart van de krokodil);
- laat soorten met wild=dict(sit=...) rechtop zitten met rechte voorpoten (lange poten, korte romp);
- geeft de krokodil een paar eigen houdingen (wild_low_pose), omdat zijn lage lange romp niet kan kantelen
  zoals bij de andere dieren.
"""


# ---------------------------------------------------------------- gedeeld
def wild_dir(a):
    """Richting in het YZ-vlak: 0 = recht naar achteren, plus = omhoog (zoals tail_chain)."""
    return Vector((0, math.cos(math.radians(a)), math.sin(math.radians(a))))


def wild_spot(c, bone, col, size, loc, axis, rx=0.0, ry=0.0):
    """Platte vlek met ronde hoeken; `axis` is de dunne kant."""
    c.b.band(bone, col, size, loc, sorted(size)[1] * 0.3, axis=axis, seg=1, rx=rx, ry=ry)


def wild_tail(c, tp, a1, a2, L1, L2, w1, w2, col, rings=(), ring_col=None, tip=None):
    """Staart in twee stukken met ringen. rings = (stuk 1 of 2, plek 0..1, lengte); tip = (lengte, kleur)."""
    b = c.b
    tail_chain(c, tp, a1, a2, L1, L2, w1, w2, col, col, seg=1)
    tp = Vector(tp)
    d1, d2 = wild_dir(a1), wild_dir(a2)
    p2 = tp + d1 * L1
    for part, f, ln in rings:
        if part == 1:
            b.box('tail1', ring_col, (w1 + 0.014, ln, w1 + 0.014), tp + d1 * (L1 * f), rx=a1, seg=1)
        else:
            b.box('tail2', ring_col, (w2 + 0.014, ln, w2 + 0.014), p2 + d2 * (L2 * f), rx=a2, seg=1)
    if tip:
        ln, tc = tip
        b.box('tail2', tc, (w2 + 0.016, ln, w2 + 0.016), p2 + d2 * (L2 + 0.03 - ln / 2), rx=a2, seg=1)


def wild_cat_face(c, muzzle, nose, line, mw=0.25, md=0.15, mh=0.17):
    """Kattensnuit zoals bij de leeuw: lichte snuit, neus en een streepje eronder."""
    b, k, face, hz = c.b, c.k, c.face, c.hz
    md = md * k * c.S['snout']
    tip = face - (md - 0.03 * k)
    b.box('head', muzzle, (mw * k, md, mh * k), (0, face - (md / 2 - 0.03 * k), hz - 0.085 * k))
    b.box('head', nose, (0.10 * k, 0.05 * k, 0.06 * k), (0, tip, hz - 0.025 * k), seg=1)
    b.box('head', line, (0.02 * k, 0.02 * k, 0.055 * k), (0, tip, hz - 0.085 * k), bevel=0)
    return tip


def wild_cat_ears(c, col, inner, x=0.165, y=0.02, z=0.015, w=0.14, h=0.13, back=None):
    """Ronde kattenoren op de bovenhoeken van de kop; back = kleur van de vlek achter op het oor."""
    b, k = c.b, c.k
    for sx in (1, -1):
        ex, ey, ez = sx * x * k, c.hcy + y * k, c.hz + c.hh / 2 + z * k
        b.box('head', col, (w * k, 0.07 * k, h * k), (ex, ey, ez), taper=(2, 1.0, 0.65), hard=True)
        b.box('head', inner, (w * 0.56 * k, 0.03 * k, h * 0.54 * k), (ex, ey - 0.03 * k, ez - 0.005 * k), seg=1,
              taper=(2, 1.0, 0.65), hard=True)
        if back:
            b.box('head', back, (w * 0.45 * k, 0.02 * k, h * 0.42 * k), (ex, ey + 0.03 * k, ez), seg=1)


def wild_eye(c, pw=0.78, ph=0.92, dz=-0.10, lid=None, lw=1.45, lh=1.6):
    """Oog met eye_white: de kern tekent een kleine pupil zonder lichtje. Hier komt er een grotere donkere
    pupil overheen (pw x ph, in oogmaten, dz omlaag geschoven) met een wit lichtje: zo blijft het oog groot
    en vriendelijk, met het wit vooral boven de pupil.
    Er komt ook een groter en dieper ooglid om het lid uit de kern (kleur lid, anders de kleur van de kop):
    van schuin boven zie je anders bij een dicht oog nog een randje oogwit."""
    k = c.k
    e = 0.06 * k * c.P['eye_k']
    exk, ezk = c.D.get('eye', (0.125, 0.07))
    for sx in (1, -1):
        ex, ez = sx * exk * k, c.hz + ezk * k
        c.b.box('head', c.C['eye'], (e * pw, 0.02 * k, e * ph), (ex, c.face - 0.013 * k, ez + e * dz), bevel=0.35, seg=1)
        c.b.box('head', '#FFFFFF', (e * 0.32, 0.008 * k, e * 0.32),
                (ex + e * 0.18 * min(1.0, pw / 0.7), c.face - 0.026 * k, ez + e * (dz + 0.22)), bevel=0)
        # 0.05 diep: dicht (0.05 naar voren) reikt het lid terug tot het gezicht en zit het oogwit er helemaal in
        c.b.box('lids', lid or c.C['head'], (e * lw, 0.050 * k, e * lh), (ex, c.face + 0.0335 * k, ez), bevel=0)


def wild_belly(c, col, frac=0.36, ext=-0.02, out=0.012):
    """Lichte buik zoals belly() uit de kern, maar korter en strakker om de romp: zo steekt er aan de
    voorkant geen lichte rand uit die op een tuigje lijkt."""
    L = c.bl - 2 * c.body_bev + ext
    c.b.band('body', col, (c.bw + out, L, c.bh + out), (0, 0, c.bz), c.body_bev, cut=(2, -c.bh / 2 + c.bh * frac, 1))


def wild_horn(c, base, pieces, col, ring_col, sx, out=0.0):
    """Hoorn uit stukken (lengte, hoek naar achteren, dikte, aantal ringen); het laatste stuk loopt spits toe.
    out = hoek naar buiten."""
    b = c.b
    p = Vector(base)
    for i, (ln, a, w, nr) in enumerate(pieces):
        ar, o = math.radians(a), math.radians(sx * out)
        d = Vector((math.cos(ar) * math.sin(o), math.sin(ar), math.cos(ar) * math.cos(o)))
        last = i == len(pieces) - 1
        b.box('head', col, (w, w, ln + 0.02), p + d * (ln / 2), rx=-a, ry=sx * out, seg=1,
              taper=(2, 1.0, 0.4) if last else None, hard=last)
        for j in range(nr):
            f = (j + 0.6) / (nr + 0.4)
            kk = 1 - 0.6 * f if last else 1.0
            b.box('head', ring_col, (w * kk + 0.014, w * kk + 0.014, 0.022 * c.k), p + d * (ln * f), rx=-a,
                  ry=sx * out, bevel=0)
        p = p + d * ln


# ---------------------------------------------------------------- houdingen: niets door de grond
def wild_fk(piv, pose):
    """Per bot (R, t) zodat een punt p van dat bot op R @ p + t terechtkomt (maten zonder schaal s)."""
    out = {}
    for bn in BONES:
        d = pose.get(bn, {})
        R = (Matrix.Rotation(math.radians(d.get('rz', 0)), 3, 'Z')
             @ Matrix.Rotation(math.radians(d.get('ry', 0)), 3, 'Y')
             @ Matrix.Rotation(math.radians(d.get('rx', 0)), 3, 'X'))
        t = piv[bn] + Vector(d.get('loc', (0, 0, 0))) - R @ piv[bn]
        if PARENT[bn]:
            Rp, tp = out[PARENT[bn]]
            R, t = Rp @ R, Rp @ t + tp
        out[bn] = (R, t)
    return out


def wild_hull(pts, n=140):
    """Alleen de uiterste punten bewaren (in n richtingen): genoeg om het laagste punt te vinden."""
    if len(pts) <= n:
        return list(pts)
    keep = {}
    for i in range(n):
        z = 1 - 2 * (i + 0.5) / n
        r = math.sqrt(1 - z * z)
        a = i * 2.399963
        d = Vector((r * math.cos(a), r * math.sin(a), z))
        j = max(range(len(pts)), key=lambda q: pts[q].dot(d))
        keep[j] = pts[j]
    return list(keep.values())


def wild_low(G, pose, bones):
    """Laagste punt van de botten `bones` in deze houding."""
    W = G['wild']
    M = wild_fk(W['piv'], pose)
    return min((M[bn][0] @ p).z + M[bn][1].z for bn in bones for p in W['hull'][bn])


def wild_lift(G, pose, bones, bone, sign, floor, limit=110):
    """Draai `bone` om X (richting sign) tot de punten van `bones` boven de vloer liggen."""
    if wild_low(G, pose, bones) >= floor:
        return pose
    base = pose.get(bone, {}).get('rx', 0.0)

    def turned(a):
        q = dict(pose)
        q[bone] = dict(pose.get(bone, {}), rx=base + sign * a)
        return q
    lo, hi = 0.0, None
    a = 0.0
    while a < limit:
        a += 4.0
        if wild_low(G, turned(a), bones) >= floor:
            hi = a
            break
        lo = a
    if hi is None:
        return turned(limit)
    for _ in range(4):
        mid = (lo + hi) / 2
        if wild_low(G, turned(mid), bones) >= floor:
            hi = mid
        else:
            lo = mid
    return turned(hi)


def wild_sit(t, G, cap):
    """Zitten met lange poten: de gedeelde houding laat de voorpoten dan ver naar voren glijden.
    Hier kantelt de romp steiler (sinus tot cap) en blijft de heup zo hoog dat de voorpoten recht staan."""
    L, d = G['leg_len'], G['d']
    hp = max(0.07, G.get('lie_hp', 0.06), L - cap * d)
    pitch = -math.degrees(math.asin(min(cap, max(0.0, (L - hp) / d))))
    pose = anim_pose('Sit', t, G)          # staart, knipperen en kop uit de gedeelde houding
    for bone, dd in stance(G, pitch, hp).items():
        pose[bone] = dict(pose.get(bone, {}), **dd)
    pose['head'] = dict(pose['head'], rx=-pitch * 0.8 + 2 * math.sin(2 * math.pi * t))
    return pose


def wild_pose(name, t, G):
    """De gedeelde houding, en daarna staart en kop optillen als ze door de grond zouden zakken."""
    opt = G['wild']['opt']
    own = opt.get('pose')
    pose = (own and own(name, t, G)) or None
    if pose is None and name == 'Sit' and 'sit' in opt:
        pose = wild_sit(t, G, opt['sit'])
    if pose is None:
        pose = anim_pose(name, t, G)
    pose = wild_lift(G, pose, ('tail1', 'tail2'), 'tail1', 1, 0.004)
    pose = wild_lift(G, pose, ('head',), 'head', -1, -0.004, limit=60)
    return pose


def wild_build(species, variant, style, name):
    """Gewone viervoeter uit de kern, plus de gegevens en de poser voor wild_pose."""
    R = SPECIES[species]
    own = R.pop('build')          # even weg, zodat build_animal de gewone viervoeter bouwt
    try:
        rig, obj, G = build_animal(species, variant, style, name)
    finally:
        R['build'] = own
    s = G['s']
    names = {g.index: g.name for g in obj.vertex_groups}
    pts = {bn: [] for bn in ('head', 'tail1', 'tail2')}
    for v in obj.data.vertices:
        bn = names[v.groups[0].group]
        if bn in pts:
            pts[bn].append(v.co / s)
    G['wild'] = dict(piv={bn: rig.data.bones[bn].head_local / s for bn in BONES},
                     hull={bn: wild_hull(p) for bn, p in pts.items()}, opt=R.get('wild', {}))
    G['poser'] = wild_pose
    return rig, obj, G


def wild_add(name, **recipe):
    recipe['build'] = wild_build
    SPECIES[name] = recipe


def wild_low_pose(name, t, G):
    """Krokodil: de romp ligt laag en is lang, dus bijna niet kantelen bij rennen, spelen en poepen."""
    w = 2 * math.pi * t
    sn, L, up = math.sin(w), G['leg_len'], G.get('tail_up', 62)

    def legs(front, hind):
        return {'leg_FL': {'rx': front}, 'leg_FR': {'rx': front}, 'leg_HL': {'rx': hind}, 'leg_HR': {'rx': hind}}

    def tail(a1, a2, lift, speed):
        return {'tail1': {'rz': a1 * math.sin(speed * w), 'rx': lift}, 'tail2': {'rz': a2 * math.sin(speed * w - 0.9)}}
    if name == 'Run':     # snel waggelen: poten kruislings, romp en staart slingeren
        A = 40
        return {'body': {'loc': (0, 0, 0.02 + 0.015 * math.cos(2 * w)), 'rz': 5 * sn, 'ry': 2 * sn},
                'head': {'rz': -4 * sn, 'rx': -3},
                'leg_FL': {'rx': -A * sn}, 'leg_HR': {'rx': -A * sn}, 'leg_FR': {'rx': A * sn}, 'leg_HL': {'rx': A * sn},
                'tail1': {'rz': -16 * sn, 'rx': 5}, 'tail2': {'rz': -20 * math.sin(w - 0.9)}}
    if name == 'Poop':
        pose = anim_pose(name, t, G)
        for bone, d in stance(G, -4, 0.62 * L).items():
            pose[bone] = dict(pose[bone], **d)
        return pose
    if name == 'Sit':     # rusten: kop omhoog, staart opzij gekruld
        pose = anim_pose(name, t, G)
        pose['head'] = dict(pose['head'], rx=pose['head'].get('rx', 0) - 14)
        pose['tail1'] = dict(pose['tail1'], rz=pose['tail1'].get('rz', 0) * 0.5 - 30)
        pose['tail2'] = dict(pose['tail2'], rz=pose['tail2'].get('rz', 0) * 0.5 - 38)
        return pose
    if name == 'Eat':     # happen: kop omhoog en weer naar het eten
        pose = anim_pose(name, t, G)
        pose['head'] = dict(pose['head'], rx=G['eat'] + 6 - 18 * abs(math.sin(1.5 * w)))
        return pose
    if name == 'Play':
        if t < 0.5:
            bw = math.sin(2 * w)
            return merge(stance(G, 4 * max(0.0, bw)), tail(26, 30, up * 0.7 * abs(bw), 6),
                         {'head': {'rx': -16 * abs(bw), 'ry': 8 * bw}})
        j = max(0.0, math.sin(2 * math.pi * (t - 0.5)))
        return merge(stance(G, -4 * j), legs(-40 * j, 36 * j), tail(26, 30, up * 0.55 * j, 6),
                     {'body': {'loc': (0, 0, 0.22 * j)}, 'head': {'rx': -6 * j}})
    return None


# ---------------------------------------------------------------- konijn
def rabbit_decor(c):
    b, C, P, k = c.b, c.C, c.P, c.k
    hcy, hz, hh, face, bz, bh = c.hcy, c.hz, c.hh, c.face, c.bz, c.bh
    wild_belly(c, C['belly'], 0.34, ext=0.02)
    # hoge ronde bips, dikke achterbouten, lange achtervoeten, pluisje op de borst
    b.box('body', C['body'], (c.bw * 0.92, 0.36, 0.30), (0, c.back - 0.19, bz + bh / 2 - 0.09), bevel=0.45)
    hy = c.legs[2][2]
    for sx in (1, -1):
        b.box('body', C['body'], (0.13, 0.30, 0.27), (sx * (c.bw / 2 - 0.015), hy - 0.01, bz - 0.08), bevel=0.45)
    for bone, x, y in c.legs[2:]:
        b.box(bone, C['paw'], (c.leg_w + 0.012, 0.21, 0.06), (x, y - 0.045, 0.03))
    b.ball('body', C['belly'], (0.15, 0.10, 0.13), (0, c.front + 0.03, bz - 0.07), sub=1)
    # dikke wangen, roze neus, twee voortanden
    for sx in (1, -1):
        b.box('head', C['cheek'], (0.19 * k, 0.15 * k, 0.16 * k), (sx * 0.095 * k, face - 0.03 * k, hz - 0.095 * k),
              bevel=0.42)
    b.box('head', C['nose'], (0.075 * k, 0.04 * k, 0.05 * k), (0, face - 0.095 * k, hz - 0.035 * k), seg=1)
    b.box('head', C['tooth'], (0.075 * k, 0.03 * k, 0.065 * k), (0, face - 0.088 * k, hz - 0.17 * k), bevel=0.15, seg=1)
    b.box('head', C['nose'], (0.008 * k, 0.032 * k, 0.05 * k), (0, face - 0.088 * k, hz - 0.175 * k), bevel=0)
    if P.get('patch'):   # vlek om een oog en een op de rug
        exk, ezk = c.D['eye']
        b.box('head', C['patch'], (0.15 * k, 0.05 * k, 0.17 * k), (-exk * k, face + 0.016 * k, hz + ezk * k), bevel=0.4, seg=1)
        shell(c, -0.10, 0.24, 1, C['patch'], wf=0.6, hf=0.5)
    # lange oren; bij flop hangt er een
    top = hz + hh / 2
    flop = P.get('flop', 0)
    for sx in (1, -1):
        ex, ey = sx * 0.115 * k, hcy + 0.09 * k
        if flop == sx:
            b.box('head', C['body'], (0.12 * k, 0.07 * k, 0.20 * k), (ex, ey, top + 0.07 * k), ry=sx * 10)
            b.box('head', C['body'], (0.12 * k, 0.07 * k, 0.28 * k), (ex + sx * 0.13 * k, ey, top + 0.13 * k),
                  taper=(2, 1.0, 0.6), hard=True, ry=sx * 112)
            b.box('head', C['ear'], (0.065 * k, 0.02 * k, 0.18 * k), (ex + sx * 0.13 * k, ey - 0.03 * k, top + 0.13 * k),
                  ry=sx * 112, seg=1)
        else:
            b.box('head', C['body'], (0.12 * k, 0.07 * k, 0.46 * k), (ex + sx * 0.02 * k, ey, top + 0.19 * k),
                  taper=(2, 1.0, 0.6), hard=True, ry=sx * 7)
            b.box('head', C['ear'], (0.065 * k, 0.02 * k, 0.33 * k), (ex + sx * 0.02 * k, ey - 0.03 * k, top + 0.19 * k),
                  taper=(2, 1.0, 0.6), hard=True, ry=sx * 7, seg=1)
    # rond wit pluimstaartje
    tail_chain(c, (0, c.back - 0.03, bz + 0.03), 20, 35, 0.05, 0.04, 0.08, 0.08, C['tail'], C['tail'], seg=1)
    b.ball('tail2', C['tail'], (0.105, 0.105, 0.105), (0, c.back + 0.06, bz + 0.065), sub=2)


wild_add('rabbit', decor=rabbit_decor,
         dims=dict(leg_len=0.17, leg_w=0.13, leg_d=0.15, bw=0.46, bl=0.62, bh=0.42, BT=(1.0, 1.0), body_bevel=0.42,
                   head=(0.44, 0.38, 0.40), head_at=(0.22, 0.28), head_fwd=0.40, eye=(0.14, 0.085),
                   paw=(0.012, 0.03, 0.06, -0.01), leg_in=0.03, leg_f=0.14, leg_h=0.15, leg_top=0.12, tail_up=18),
         col=dict(nose='#E88A98', tooth='#FFFFFF', tail='#FFFFFF'),
         variants={
             'male':    dict(s=0.62, head_k=1.00, leg_k=1.0, body_l=1.00, eye_k=1.1,
                             col=dict(body='#A67A50', belly='#F6EAD6', cheek='#F6EAD6', ear='#EBAAA2', paw='#F6EAD6')),
             'female':  dict(s=0.56, head_k=0.98, leg_k=1.0, body_l=1.00, eye_k=1.1,
                             col=dict(body='#F3EEE4', belly='#FFFFFF', cheek='#FFFFFF', ear='#F5B4C0', paw='#FFFFFF',
                                      tooth='#FFF6E0')),
             'young_m': dict(s=0.42, head_k=1.30, leg_k=0.90, body_l=0.80, eye_k=1.3, flop=1,
                             col=dict(body='#BA8E62', belly='#F8EEDC', cheek='#F8EEDC', ear='#EFB4AC', paw='#F8EEDC')),
             'young_f': dict(s=0.42, head_k=1.30, leg_k=0.90, body_l=0.80, eye_k=1.3, patch=True,
                             col=dict(body='#F7F2EA', belly='#FFFFFF', cheek='#FFFFFF', ear='#F7BECA', paw='#FFFFFF',
                                      patch='#B98C60', tooth='#FFF6E0')),
         })


# ---------------------------------------------------------------- jachtluipaard
def cheetah_decor(c):
    b, C, P, k = c.b, c.C, c.P, c.k
    hcy, hz, hh, face, bz, bh = c.hcy, c.hz, c.hh, c.face, c.bz, c.bh
    nk = neck(c, C['body'], 0.20, 0.22, y0=0.10, z0=0.03, ty=0.10, tz=-0.08, taper=(2, 1.15, 0.9))
    wild_belly(c, C['cream'], 0.34)
    sp, t, sz = C['spot'], 0.022, P.get('spot', 0.065)
    f = c.bl / 0.92
    mantle = P.get('mantle', 0)   # jong: zilvergrijze manen over kop en nek (2: ook over de rug)
    if mantle < 2:
        for i in range(5):        # rug: twee rijen vlekken
            for sx in (1, -1):
                wild_spot(c, 'body', sp, (sz, sz, t), (sx * 0.065, (-0.34 + 0.17 * i + sx * 0.035) * f, bz + bh / 2 + 0.001), 2)
    for sx in (1, -1):            # flanken: twee rijen, verspringend
        for i in range(5):
            wild_spot(c, 'body', sp, (t, sz, sz), (sx * (c.bw / 2 + 0.001), (-0.36 + 0.18 * i) * f, bz + 0.055), 0)
        for i in range(3):
            wild_spot(c, 'body', sp, (t, sz * 0.85, sz * 0.85), (sx * (c.bw / 2 + 0.001), (-0.27 + 0.27 * i) * f, bz - 0.03), 0)
        for fr in (0.3, 0.72):
            wild_spot(c, 'head', sp, (t, 0.06, 0.06), nk.at(fr, x=sx * (nk.w / 2 * nk.kf(fr) + 0.001)), 0, rx=nk.deg)
    for bone, x, y in c.legs:
        sx = 1 if x > 0 else -1
        for fz, dy in ((0.80, 0.0), (0.55, 0.012)):
            wild_spot(c, bone, sp, (t, 0.055, 0.055), (x + sx * (c.leg_w / 2 + 0.001), y + dy, c.leg_len * fz), 0)
    if not mantle:
        for x, y in ((0.0, 0.01), (0.06, 0.07), (-0.06, 0.07)):
            wild_spot(c, 'head', sp, (0.05 * k, 0.05 * k, 0.02 * k), (x * k, hcy + y * k, hz + hh / 2 + 0.001 * k), 2)
    # kleine kop: lichte snuit, zwarte neus, traanstrepen van oog naar mondhoek
    wild_cat_face(c, C['cream'], C['nose'], C['tear'], mw=0.20, md=0.13, mh=0.14)
    for sx in (1, -1):
        b.box('head', C['tear'], (0.026 * k, 0.03 * k, 0.16 * k), (sx * 0.114 * k, face, hz - 0.045 * k), bevel=0)
    wild_cat_ears(c, C['body'], C['cream'], x=0.115, y=0.03, z=0.01, w=0.10, h=0.10, back=C['tear'])
    if mantle:
        b.ball('head', C['mantle'], (0.13 * k, 0.14 * k, 0.07 * k), (0, hcy + 0.05 * k, hz + hh / 2 + 0.01 * k), sub=1)
        b.box('head', C['mantle'], (0.14, 0.08, nk.L * 0.9), nk.at(0.5, back=nk.d / 2 * nk.kf(0.5) + 0.02), rx=nk.deg, seg=1)
        if mantle > 1:
            b.box('body', C['mantle'], (c.bw * 0.66, c.bl * 0.74, 0.08), (0, -0.02, bz + bh / 2 + 0.015), bevel=0.45)
    elif P.get('crest'):   # man: korte kraag in de nek
        b.box('head', C['crest'], (0.08, 0.06, nk.L * 0.85), nk.at(0.5, back=nk.d / 2 * nk.kf(0.5) + 0.012), rx=nk.deg, seg=1)
    wild_tail(c, (0, c.back - 0.03, bz + 0.05), -50, 8, 0.34, 0.36, 0.065, 0.06, C['body'],
              rings=[(1, 0.7, 0.045), (2, 0.2, 0.05), (2, 0.55, 0.05)], ring_col=sp,
              tip=(0.075, C['tip']))


wild_add('cheetah', decor=cheetah_decor, wild=dict(sit=0.70),
         dims=dict(leg_len=0.56, leg_w=0.11, leg_d=0.13, bw=0.36, bl=0.92, bh=0.34, BT=(1.0, 1.0), body_bevel=0.2,
                   head=(0.34, 0.31, 0.32), head_bevel=0.24, neck=(0.12, 0.05), eye=(0.105, 0.065),
                   eat=(16, 88), sleep=(45, 0.0), tail_lie=True),
         col=dict(spot='#2B211C', tear='#1E1A1C', nose='#2B211C', cream='#F8EBC8', paw='#F6E3B4'),
         variants={
             'male':    dict(s=0.94, head_k=1.00, leg_k=1.0, body_l=1.00, eye_k=1.0, crest=True, spot=0.07,
                             col=dict(body='#E8B050', tip='#FFFFFF', crest='#A97A34')),
             'female':  dict(s=0.86, head_k=0.97, leg_k=1.0, body_l=1.00, eye_k=1.0, spot=0.055,
                             col=dict(body='#F2C774', tip='#FFFFFF')),
             'young_m': dict(s=0.56, **YOUNG, neck_k=0.7, mantle=2,
                             col=dict(body='#E2B466', tip='#FFFFFF', mantle='#D6D2C6')),
             'young_f': dict(s=0.56, **YOUNG, neck_k=0.7, mantle=1,
                             col=dict(body='#EEC98A', tip='#2B211C', mantle='#F1ECE0')),
         })


# ---------------------------------------------------------------- gazelle
def gazelle_decor(c):
    b, C, P, k = c.b, c.C, c.P, c.k
    hcy, hz, hh, hw, face, bz, bh = c.hcy, c.hz, c.hh, c.hw, c.face, c.bz, c.bh
    nk = neck(c, C['body'], 0.17, 0.19, y0=0.09, z0=0.03, taper=(2, 1.2, 0.9))
    wild_belly(c, C['white'], 0.36)
    zs = bz - bh / 2 + bh * 0.36       # bovenrand van de witte buik: daar loopt de donkere streep
    for sx in (1, -1):
        b.box('body', C['stripe'], (0.03, c.bl - 2 * c.body_bev - 0.02, 0.075), (sx * (c.bw / 2 + 0.002), 0.0, zs + 0.03),
              bevel=0.3, seg=1)
    # witte bips en witte keel
    b.box('body', C['white'], (c.bw * 0.80, 0.12, bh * 0.74), (0, c.back - 0.046, bz - 0.03), bevel=0.42)
    b.box('head', C['white'], (nk.w * 0.62, 0.03, nk.L * 0.55), nk.at(0.42, back=-(nk.d / 2 * nk.kf(0.42) + 0.001)),
          rx=nk.deg, seg=1)
    # kop: witte snuit, zwarte neus, donkere bles, witte ring om het oog
    my, mz = face - 0.05 * k, hz - 0.065 * k
    b.box('head', C['white'], (0.19 * k, 0.17 * k, 0.15 * k), (0, my, mz))
    b.box('head', C['nose'], (0.08 * k, 0.03 * k, 0.05 * k), (0, my - 0.085 * k, mz + 0.035 * k), seg=1)
    b.box('head', C['stripe'], (0.07 * k, 0.03 * k, 0.11 * k), (0, face + 0.004 * k, hz + 0.075 * k), seg=1)
    exk, ezk = c.D['eye']
    top = hz + hh / 2
    for sx in (1, -1):
        b.box('head', C['white'], (0.088 * k, 0.03 * k, 0.098 * k), (sx * exk * k, face + 0.008 * k, hz + ezk * k), bevel=0.4, seg=1)
        ear = (sx * (hw / 2 + 0.045 * k), hcy + 0.10 * k, top + 0.02 * k)
        b.box('head', C['body'], (0.085 * k, 0.05 * k, 0.19 * k), ear, taper=(2, 0.9, 0.4), hard=True, ry=sx * 40)
        b.box('head', C['white'], (0.045 * k, 0.02 * k, 0.12 * k), (ear[0], ear[1] - 0.028 * k, ear[2]),
              taper=(2, 0.9, 0.4), hard=True, ry=sx * 40, seg=1)
        horns = P.get('horns', 0)   # 0 geen, 1 knopjes, 2 kort en dun (vrouw), 3 lang met ringen (man)
        base = (sx * 0.065 * k, hcy + 0.05 * k, top - 0.02 * k)
        if horns == 3:
            wild_horn(c, base, [(0.27 * k, 24, 0.058 * k, 3), (0.23 * k, -6, 0.052 * k, 2)], C['horn'], C['ring'], sx, out=9)
        elif horns == 2:
            wild_horn(c, base, [(0.19 * k, 14, 0.038 * k, 2)], C['horn'], C['ring'], sx, out=6)
        elif horns == 1:
            wild_horn(c, base, [(0.07 * k, 10, 0.045 * k, 0)], C['horn'], C['ring'], sx)
    tail_chain(c, (0, c.back + 0.0, bz + 0.07), -50, -68, 0.09, 0.08, 0.05, 0.045, C['stripe'], C['stripe'], seg=1)


wild_add('gazelle', decor=gazelle_decor, wild=dict(sit=0.72),
         dims=dict(leg_len=0.52, leg_w=0.09, leg_d=0.105, bw=0.34, bl=0.70, bh=0.34, BT=(1.0, 1.0), body_bevel=0.24,
                   head=(0.28, 0.30, 0.28), head_bevel=0.24, neck=(0.30, 0.10), eye=(0.10, 0.055),
                   paw=(0.012, 0.012, 0.07, 0.0), paw_seg=1, eat=(10, 88), sleep=(50, 0.0)),
         col=dict(paw='#2E2622', stripe='#3B2A1E', horn='#3A302A', ring='#9A8A74', nose='#2A2020'),
         variants={
             'male':    dict(s=0.80, head_k=1.00, leg_k=1.0, body_l=1.00, eye_k=1.0, horns=3,
                             col=dict(body='#D9934A')),
             'female':  dict(s=0.74, head_k=0.97, leg_k=1.0, body_l=1.00, eye_k=1.0, horns=2,
                             col=dict(body='#E3A962')),
             'young_m': dict(s=0.50, head_k=1.28, leg_k=0.85, body_l=0.78, eye_k=1.25, neck_k=0.7, horns=1,
                             col=dict(body='#E0A45E')),
             'young_f': dict(s=0.50, head_k=1.28, leg_k=0.85, body_l=0.78, eye_k=1.25, neck_k=0.7, horns=0,
                             col=dict(body='#ECBC82', stripe='#8E6A4C')),
         })


# ---------------------------------------------------------------- tijger
def tiger_decor(c):
    b, C, P, k = c.b, c.C, c.P, c.k
    hcy, hz, hh, hw, hl, face, bz, bh = c.hcy, c.hz, c.hh, c.hw, c.hl, c.face, c.bz, c.bh
    st = C['stripe']
    wild_belly(c, C['white'], 0.42)
    # strepen over rug en flanken, om en om lang en kort; ringen om de poten
    n, sw = P['stripes'], P['stripe_w']
    y0, y1 = c.front + 0.25, c.back - 0.10
    for i in range(n):
        b.band('body', st, (c.bw + 0.022, sw, bh + 0.022), (0, y0 + (y1 - y0) * i / (n - 1), bz), c.body_bev, seg=1,
               cut=(2, -0.07 if i % 2 == 0 else 0.04, -1))
    for bone, x, y in c.legs:
        for fz in (0.42, 0.72):
            b.band(bone, st, (c.leg_w + 0.02, c.leg_d + 0.02, sw * 0.8), (x, y, c.leg_len * fz), c.leg_w * 0.3, axis=2, seg=1)
    # kop: strepen over de kruin, streep op het voorhoofd, witte wangen met streepjes
    for dy in (0.04, 0.13):
        b.band('head', st, (hw + 0.02, 0.04 * k, hh + 0.02), (0, hcy + dy * k, hz), min(hw, hl, hh) * 0.3, seg=1,
               cut=(2, 0.03 * k, -1))
    b.box('head', st, (0.035 * k, 0.045 * k, 0.11 * k), (0, face + 0.008 * k, hz + 0.105 * k), bevel=0)
    for sx in (1, -1):
        b.box('head', st, (0.03 * k, 0.06 * k, 0.07 * k), (sx * 0.09 * k, face + 0.02 * k, hz + 0.15 * k), bevel=0, ry=-sx * 16)
    ruff = P.get('ruff', 1.0)
    for sx in (1, -1):
        if ruff:
            rx_ = sx * (hw / 2 - 0.02 * k)
            b.box('head', C['white'], (0.14 * k * ruff, 0.17 * k, 0.21 * k), (rx_, hcy - 0.055 * k, hz - 0.09 * k),
                  taper=(2, 0.6, 1.0), hard=True)
            for dy in (-0.10, -0.02):
                b.box('head', st, (0.02 * k, 0.025 * k, 0.08 * k), (rx_ + sx * 0.066 * k * ruff, hcy + dy * k, hz - 0.045 * k),
                      bevel=0)
    wild_cat_face(c, C['white'], C['nose'], st, mw=0.27, md=0.15, mh=0.18)
    wild_cat_ears(c, st, C['white'], back=C['white'])
    wild_tail(c, (0, c.back - 0.03, bz + 0.08), -42, 14, 0.30, 0.30, 0.075, 0.07, C['body'],
              rings=[(1, 0.32, 0.05), (1, 0.74, 0.05), (2, 0.22, 0.05), (2, 0.58, 0.05)], ring_col=st,
              tip=(0.08, C['tip']))


wild_add('tiger', decor=tiger_decor,
         dims=dict(leg_len=0.42, leg_w=0.17, leg_d=0.19, bw=0.50, bl=1.00, bh=0.44, BT=(1.08, 0.82),
                   head=(0.48, 0.40, 0.42), eat=(12, 70), tail_lie=True),
         col=dict(stripe='#1E1A1C', nose='#E8798C', paw='#FFF4E0'),
         variants={
             'male':    dict(s=1.02, head_k=1.00, leg_k=0.92, body_l=1.00, eye_k=1.0, stripes=6, stripe_w=0.055, ruff=1.0,
                             col=dict(body='#F0871E', tip='#1E1A1C')),
             'female':  dict(s=0.93, head_k=0.96, leg_k=0.92, body_l=1.00, eye_k=1.0, stripes=6, stripe_w=0.04, ruff=0.7,
                             col=dict(body='#F5A03C', tip='#1E1A1C')),
             'young_m': dict(s=0.57, **YOUNG, stripes=4, stripe_w=0.05, ruff=0.9,
                             col=dict(body='#F6A548', tip='#1E1A1C')),
             'young_f': dict(s=0.57, **YOUNG, stripes=4, stripe_w=0.04, ruff=0,
                             col=dict(body='#FAB966', tip='#FFFFFF')),
         })


# ---------------------------------------------------------------- zwarte panter
def panther_decor(c):
    C, P, bz, bh = c.C, c.P, c.bz, c.bh
    if P.get('rosettes'):   # vage vlekken die je in het licht nog net ziet
        f = c.bl / 1.0
        for i, y in enumerate((-0.32, -0.16, 0.0, 0.16, 0.32)):
            wild_spot(c, 'body', C['spot'], (0.10, 0.10, 0.02), ((0.07 if i % 2 else -0.07), y * f, bz + bh / 2 + 0.001), 2)
        for sx in (1, -1):
            for i, y in enumerate((-0.26, -0.06, 0.14, 0.33)):
                wild_spot(c, 'body', C['spot'], (0.02, 0.10, 0.085),
                          (sx * (c.bw / 2 + 0.001), (y + sx * 0.03) * f, bz + (0.03 if i % 2 else -0.02)), 0)
    wild_cat_face(c, C['muzzle'], C['nose'], C['eye'], mw=0.24, md=0.15, mh=0.16)
    wild_cat_ears(c, C['body'], C['ear'], x=0.155, w=0.13, h=0.12)
    wild_eye(c, pw=0.66, ph=1.1, dz=-0.03)
    wild_tail(c, (0, c.back - 0.03, bz + 0.07), -46, 20, 0.34, 0.34, 0.07, 0.065, C['body'],
              tip=(0.09, C['tip']) if 'tip' in C else None)


wild_add('panther', decor=panther_decor,
         dims=dict(leg_len=0.42, leg_w=0.15, leg_d=0.17, bw=0.44, bl=1.00, bh=0.40, BT=(1.08, 0.82),
                   head=(0.44, 0.40, 0.40), eye_white=True, eat=(12, 70), tail_lie=True),
         # 'white' is hier de kleur van het oog (geelgroen), 'eye' de pupil
         col=dict(white='#C6E24A', eye='#15121C', nose='#8E6C94'),
         variants={
             'male':    dict(s=0.96, head_k=1.00, leg_k=0.92, body_l=1.00, eye_k=1.0, rosettes=True,
                             col=dict(body='#2C2944', muzzle='#59547E', ear='#7C6E9A', spot='#3F3B66', paw='#3C385C',
                                      lidline='#6A648C')),
             'female':  dict(s=0.88, head_k=0.96, leg_k=0.92, body_l=1.00, eye_k=1.0,
                             col=dict(body='#3A3454', muzzle='#6C668F', ear='#9A84AE', paw='#4B4569', tip='#9A94C2',
                                      lidline='#7A749C')),
             'young_m': dict(s=0.55, **YOUNG, rosettes=True,
                             col=dict(body='#393558', muzzle='#6A6590', ear='#8C7EAA', spot='#514D7C', paw='#48446A',
                                      lidline='#7A749C', white='#8FD4F2')),
             'young_f': dict(s=0.55, **YOUNG,
                             col=dict(body='#463F64', muzzle='#7A749E', ear='#A892BC', paw='#A29CC8', tip='#A29CC8',
                                      lidline='#8A84AC')),
         })


# ---------------------------------------------------------------- aap
def monkey_decor(c):
    b, C, P, k = c.b, c.C, c.P, c.k
    hcy, hz, hh, hw, face, bz, bh = c.hcy, c.hz, c.hh, c.hw, c.face, c.bz, c.bh
    wild_belly(c, C['face'], 0.52, ext=0.02)
    # licht masker in hartvorm, snuit met een lach
    b.box('head', C['face'], (0.31 * k, 0.05 * k, 0.20 * k), (0, face + 0.014 * k, hz + 0.05 * k), bevel=0.4, seg=1)
    b.box('head', C['body'], (0.07 * k, 0.03 * k, 0.07 * k), (0, face - 0.002 * k, hz + 0.14 * k), taper=(2, 0.3, 1.0),
          hard=True, seg=1)
    b.box('head', C['face'], (0.25 * k, 0.13 * k, 0.16 * k), (0, face - 0.035 * k, hz - 0.10 * k), bevel=0.4)
    b.box('head', C['nose'], (0.13 * k, 0.014 * k, 0.016 * k), (0, face - 0.097 * k, hz - 0.125 * k), bevel=0)
    for sx in (1, -1):
        b.box('head', C['nose'], (0.025 * k, 0.02 * k, 0.03 * k), (sx * 0.03 * k, face - 0.096 * k, hz - 0.065 * k), bevel=0)
        b.box('head', C['nose'], (0.016 * k, 0.014 * k, 0.03 * k), (sx * 0.065 * k, face - 0.097 * k, hz - 0.115 * k), bevel=0)
        # ronde oren opzij van de kop
        ex = sx * (hw / 2 + 0.05 * k)
        b.band('head', C['body'], (0.15 * k, 0.06 * k, 0.17 * k), (ex, hcy - 0.02 * k, hz + 0.04 * k), 0.05 * k, axis=1)
        b.band('head', C['ear'], (0.085 * k, 0.02 * k, 0.10 * k), (ex + sx * 0.005 * k, hcy - 0.055 * k, hz + 0.04 * k),
               0.03 * k, axis=1, seg=1)
    if P.get('crest'):       # man: donker kapje over de kruin
        b.box('head', C['crest'], (0.30 * k, 0.27 * k, 0.07 * k), (0, hcy + 0.025 * k, hz + hh / 2 + 0.006 * k), bevel=0.4, seg=1)
    if P.get('tuft'):        # kuifje
        for dx in (-0.045, 0.0, 0.045):
            b.box('head', C['body'], (0.04 * k, 0.04 * k, 0.11 * k), (dx * k, hcy - 0.03 * k + abs(dx) * 0.5 * k, hz + hh / 2 + 0.035 * k),
                  taper=(2, 1.0, 0.4), hard=True, seg=1, ry=dx * 260)
    # lange staart: omhoog en aan het eind een krul
    w = 0.05
    tp = Vector((0, c.back - 0.03, bz + 0.07))
    a1, a2, L1, L2 = 24, 60, 0.24, 0.24
    tail_chain(c, tp, a1, a2, L1, L2, w + 0.005, w, C['body'], C['body'], seg=1)
    p3 = tp + wild_dir(a1) * L1 + wild_dir(a2) * L2
    tc = C.get('tip', C['body'])
    b.box('tail2', C['body'], (w, 0.13, w), p3 + Vector((0, 0.045, 0.0)), seg=1)
    b.box('tail2', tc, (w, w, 0.11), p3 + Vector((0, 0.085, -0.04)), seg=1)
    b.box('tail2', tc, (w, 0.08, w), p3 + Vector((0, 0.06, -0.075)), seg=1)


wild_add('monkey', decor=monkey_decor, wild=dict(sit=0.80),
         dims=dict(leg_len=0.34, leg_w=0.10, leg_d=0.11, bw=0.34, bl=0.58, bh=0.34, BT=(1.0, 1.0), body_bevel=0.36,
                   head=(0.40, 0.34, 0.38), head_at=(0.35, 0.35), head_fwd=0.36, eye=(0.105, 0.06),
                   paw=(0.02, 0.05, 0.06, -0.02), eat=(16, 80), tail_up=28),
         col=dict(nose='#4A2E22'),
         variants={
             'male':    dict(s=0.70, head_k=1.00, leg_k=1.0, body_l=1.00, eye_k=1.1, crest=True,
                             col=dict(body='#8A5830', face='#F2D2A4', ear='#E7A98E', paw='#5E3B20', crest='#4E2E18')),
             'female':  dict(s=0.63, head_k=0.98, leg_k=1.0, body_l=1.00, eye_k=1.1,
                             col=dict(body='#AA7240', face='#F8DFB8', ear='#F0B8A0', paw='#75492A')),
             'young_m': dict(s=0.45, head_k=1.30, leg_k=0.88, body_l=0.80, eye_k=1.3, tuft=True,
                             col=dict(body='#99683C', face='#F6DAB0', ear='#EDB29A', paw='#6A4326')),
             'young_f': dict(s=0.45, head_k=1.30, leg_k=0.88, body_l=0.80, eye_k=1.3,
                             col=dict(body='#BA8452', face='#FBE6C4', ear='#F5C2AE', paw='#84552F', tip='#FBE6C4')),
         })


# ---------------------------------------------------------------- gorilla
def gorilla_decor(c):
    b, C, P, k = c.b, c.C, c.P, c.k
    hcy, hz, hh, hw, face, bz, bh, bw = c.hcy, c.hz, c.hh, c.hw, c.face, c.bz, c.bh, c.bw
    fur = C['body']
    # zware schouders vooraan, aflopende rug (zilver bij de man), lage heupen die de achterpoten half bedekken:
    # zo lijken de voorpoten lange armen, terwijl alle vier de poten in het skelet even lang zijn
    b.box('body', fur, (bw + 0.14, 0.50, 0.56), (0, c.front + 0.21, bz + 0.17), bevel=0.36)
    b.box('body', C['back'], (bw + 0.05, 0.56, 0.32), (0, 0.10, bz + 0.16), rx=-24, bevel=0.4)
    b.box('body', fur, (bw - 0.02, 0.36, 0.38), (0, c.back - 0.16, bz - 0.13), bevel=0.4)
    for i, (bone, x, y) in enumerate(c.legs):
        sx = 1 if x > 0 else -1
        if i < 2:   # dikke bovenarmen
            b.box(bone, fur, (c.leg_w + 0.06, c.leg_d + 0.06, 0.30), (x + sx * 0.03, y, c.leg_len - 0.07), bevel=0.35)
        else:       # dijen
            b.box(bone, fur, (c.leg_w + 0.04, c.leg_d + 0.09, 0.20), (x + sx * 0.02, y + 0.01, c.leg_len - 0.20), bevel=0.35)
    if P.get('rump'):   # jong: wit plukje op de bips
        b.box('body', C['rump'], (0.18, 0.05, 0.13), (0, c.back + 0.012, bz - 0.11), bevel=0.4, seg=1)
    # kop: koepel bovenop, grijs gezicht, wenkbrauwrichel, brede neus
    b.box('head', fur, (0.32 * k, 0.30 * k, 0.18 * k), (0, hcy + 0.05 * k, hz + hh / 2 + 0.03 * k), bevel=0.45,
          taper=(2, 1.0, 0.7), hard=True)
    exk, ezk = c.D['eye']
    b.box('head', C['face'], (0.36 * k, 0.03 * k, 0.25 * k), (0, face + 0.011 * k, hz), bevel=0.3, seg=1)
    b.box('head', fur, (0.40 * k, 0.08 * k, 0.07 * k), (0, face - 0.012 * k, hz + ezk * k + 0.092 * k), bevel=0.35)
    my, mz = face - 0.04 * k, hz - 0.115 * k
    b.box('head', C['face'], (0.29 * k, 0.14 * k, 0.20 * k), (0, my, mz), bevel=0.35)
    b.box('head', C['nose'], (0.15 * k, 0.014 * k, 0.016 * k), (0, my - 0.068 * k, mz - 0.045 * k), bevel=0)
    for sx in (1, -1):
        b.box('head', C['nose'], (0.016 * k, 0.014 * k, 0.03 * k), (sx * 0.075 * k, my - 0.068 * k, mz - 0.035 * k), bevel=0)
        b.box('head', C['nose'], (0.05 * k, 0.02 * k, 0.04 * k), (sx * 0.045 * k, my - 0.066 * k, mz + 0.045 * k), bevel=0.3, seg=1)
        b.box('head', C['face'], (0.06 * k, 0.07 * k, 0.11 * k), (sx * (hw / 2 + 0.015 * k), hcy + 0.05 * k, hz + 0.03 * k), seg=1)
    if P.get('tuft'):   # jong: pluizig kuifje
        b.ball('head', fur, (0.12 * k, 0.12 * k, 0.09 * k), (0, hcy + 0.03 * k, hz + hh / 2 + 0.12 * k), sub=1)
    wild_eye(c)
    # geen staart te zien: de staartbotjes zitten als klein stompje in de heup
    tail_chain(c, (0, c.back - 0.13, bz - 0.10), 0, 0, 0.03, 0.03, 0.05, 0.05, fur, fur, seg=1)


wild_add('gorilla', decor=gorilla_decor, view=1.2, wild=dict(sit=0.62),
         dims=dict(leg_len=0.50, leg_w=0.17, leg_d=0.19, bw=0.56, bl=0.78, bh=0.34, BT=(1.0, 1.0),
                   head=(0.44, 0.40, 0.44), head_at=(0.62, 0.30), head_fwd=0.36, eye=(0.105, 0.06), eye_white=True,
                   paw=(0.03, 0.07, 0.09, -0.03), leg_in=-0.03, leg_f=0.18, leg_h=0.16, lie_hp=0.20,
                   eat=(20, 80), sleep=(40, 0.0), tail_up=8),
         col=dict(eye='#1A1820'),
         variants={
             'male':    dict(s=1.08, head_k=1.00, leg_k=1.0, body_l=1.00, eye_k=1.0,
                             col=dict(body='#3A3944', back='#B6BAC2', face='#5C5A64', nose='#26252C', paw='#2A2930',
                                      lidline='#8A8892')),
             'female':  dict(s=0.93, head_k=0.97, leg_k=1.0, body_l=1.00, eye_k=1.0,
                             col=dict(body='#4A4650', back='#4A4650', face='#6E6A72', nose='#2E2C32', paw='#35323A',
                                      lidline='#9A96A0')),
             'young_m': dict(s=0.58, head_k=1.28, leg_k=0.80, body_l=0.80, eye_k=1.25, tuft=True,
                             col=dict(body='#45434E', back='#45434E', face='#6A6870', nose='#2A2930', paw='#302F36',
                                      lidline='#9A98A2')),
             'young_f': dict(s=0.58, head_k=1.28, leg_k=0.80, body_l=0.80, eye_k=1.25, rump=True,
                             col=dict(body='#57525A', back='#57525A', face='#7E7A80', nose='#34323A', paw='#3E3A42',
                                      rump='#F0F0F2', lidline='#AAA6B0')),
         })


# ---------------------------------------------------------------- krokodil
def crocodile_decor(c):
    b, C, P, k = c.b, c.C, c.P, c.k
    hz, face, bz, bh = c.hz, c.face, c.bz, c.bh
    wild_belly(c, C['belly'], 0.42, ext=0.04, out=0.016)
    # lange platte snuit: bovenkaak, onderkaak en witte tanden ertussen
    jl = P.get('snout', 0.48) * k
    jb = face + 0.03 * k                 # achterkant van de kaak
    b.box('head', C['body'], (0.34 * k, jl, 0.11 * k), (0, jb - jl / 2, hz), taper=(1, 0.70, 1.0), hard=True)
    b.box('head', C['jaw'], (0.30 * k, jl - 0.04 * k, 0.07 * k), (0, jb - jl / 2 + 0.02 * k, hz - 0.075 * k),
          taper=(1, 0.70, 1.0), hard=True)
    nt, ts = P.get('teeth', 4), P.get('tooth', 1.0)
    for i in range(nt):
        u = 0.20 + 0.68 * i / max(1, nt - 1)
        kk = 1 - 0.30 * u
        for sx in (1, -1):
            b.box('head', C['tooth'], (0.035 * k * ts, 0.045 * k * ts, 0.06 * k * ts),
                  (sx * (0.17 * kk - 0.012) * k, jb - jl * u, hz - (0.055 * kk + 0.012) * k), taper=(2, 0.25, 1.0), hard=True, bevel=0)
    for sx in (1, -1):
        b.box('head', C['tooth'], (0.035 * k, 0.035 * k, 0.05 * k), (sx * 0.05 * k, jb - jl + 0.012 * k, hz - 0.05 * k),
              taper=(2, 0.25, 1.0), hard=True, bevel=0)
        # neusgaten op de punt van de snuit
        b.box('head', C['body'], (0.075 * k, 0.075 * k, 0.05 * k), (sx * 0.055 * k, jb - jl + 0.065 * k, hz + 0.045 * k), seg=1)
        b.box('head', C['nostril'], (0.03 * k, 0.02 * k, 0.02 * k), (sx * 0.055 * k, jb - jl + 0.03 * k, hz + 0.05 * k), bevel=0)
        # oogbulten bovenop de kop: de gele ogen kijken er vooraan uit
        exk, ezk = c.D['eye']
        b.box('head', C['body'], (0.15 * k, 0.17 * k, 0.16 * k), (sx * exk * k, face + 0.085 * k, hz + ezk * k - 0.005 * k), bevel=0.22)
    wild_eye(c, pw=0.5, ph=1.15, dz=-0.03, lw=1.4, lh=1.55)
    # bobbels over de rug, in twee rijen
    rg = C['ridge']
    n = P.get('ridges', 6)
    y0, y1 = c.front + 0.13, c.back - 0.10
    if P.get('bands'):   # jong: donkere dwarsbanden
        for i in range(n - 1):
            b.band('body', C['band'], (c.bw + 0.02, 0.07, bh + 0.02), (0, y0 + (y1 - y0) * (i + 0.5) / (n - 1), bz), c.body_bev,
                   seg=1, cut=(2, -0.02, -1))
    for i in range(n):
        for sx in (1, -1):
            b.box('body', rg, (0.10, 0.11, 0.08), (sx * 0.10, y0 + (y1 - y0) * i / (n - 1), bz + bh / 2 + 0.015),
                  taper=(2, 1.0, 0.45), hard=True, seg=1)
    # dikke staart die spits toeloopt en op de grond ligt, met een rij bobbels
    tp = Vector((0, c.back - 0.05, bz - 0.01))
    L1 = L2 = P.get('tail', 0.46)
    a1 = math.degrees(math.asin((0.125 - tp.z) / L1))     # hart van de staart: 0.125 hoog bij de knik
    d1 = wild_dir(a1)
    p2 = tp + d1 * L1
    a2 = math.degrees(math.asin((0.05 - p2.z) / L2))      # en 0.05 hoog bij de punt
    d2 = wild_dir(a2)
    b.box('tail1', C['body'], (0.36, L1 + 0.08, 0.21), tp + d1 * (L1 / 2), rx=a1, taper=(1, 1.0, 0.60), hard=True)
    b.box('tail2', C['body'], (0.215, L2 + 0.04, 0.125), p2 + d2 * (L2 / 2), rx=a2, taper=(1, 1.0, 0.28), hard=True)
    for i in range(3):
        f = 0.18 + 0.30 * i
        up1 = 0.105 * (1 - 0.40 * (f * L1 + 0.04) / (L1 + 0.08))
        b.box('tail1', rg, (0.09, 0.10, 0.08), tp + d1 * (L1 * f) + Vector((0, 0, up1 + 0.012)), rx=a1,
              taper=(2, 1.0, 0.45), hard=True, seg=1)
        f = 0.12 + 0.27 * i
        up2 = 0.0625 * (1 - 0.72 * (f * L2 + 0.02) / (L2 + 0.04))
        b.box('tail2', rg, (0.07, 0.085, 0.065), p2 + d2 * (L2 * f) + Vector((0, 0, up2 + 0.008)), rx=a2,
              taper=(2, 1.0, 0.45), hard=True, seg=1)
    if 'tip' in C:
        b.box('tail2', C['tip'], (0.095, 0.15, 0.06), p2 + d2 * (L2 - 0.055), rx=a2, taper=(1, 1.0, 0.45), hard=True, seg=1)
    c.piv['tail1'], c.piv['tail2'] = tp, p2


wild_add('crocodile', decor=crocodile_decor, view=1.35, wild=dict(pose=wild_low_pose),
         dims=dict(leg_len=0.13, leg_w=0.14, leg_d=0.16, bw=0.50, bl=0.92, bh=0.26, BT=(1.0, 1.0),
                   head=(0.42, 0.34, 0.22), head_at=(0.0, 0.10), head_fwd=0.50, head_bevel=0.25, eye=(0.125, 0.15),
                   eye_white=True, paw=(0.04, 0.05, 0.05, -0.02), leg_in=-0.11, leg_f=0.19, leg_h=0.19, leg_top=0.07,
                   eat=(4, 30), sleep=(12, 0.0), tail_lie=True, tail_up=48),
         # 'white' is hier de kleur van het oog (geel), 'eye' de pupil
         col=dict(white='#F6D83A', eye='#1A1A14', tooth='#FFFFFF', nostril='#24401A'),
         variants={
             'male':    dict(s=0.92, head_k=1.00, leg_k=1.0, body_l=1.00, eye_k=1.0, teeth=5, tooth=1.15,
                             col=dict(body='#2F7D46', belly='#DCE08E', jaw='#5CA868', ridge='#1F5A30', paw='#256838',
                                      lidline='#1A4A28')),
             'female':  dict(s=0.83, head_k=0.97, leg_k=1.0, body_l=1.00, eye_k=1.0, teeth=4, tooth=0.85,
                             col=dict(body='#3F9A60', belly='#E8EBA6', jaw='#74BE84', ridge='#C4DC84', paw='#33834E',
                                      lidline='#236238')),
             'young_m': dict(s=0.60, head_k=1.20, leg_k=0.90, body_l=0.80, eye_k=1.3, teeth=3, snout=0.38, tail=0.40,
                             ridges=5, bands=True,
                             col=dict(body='#4CA870', belly='#EEF0B4', jaw='#80C892', ridge='#2E7C4A', paw='#3E9460',
                                      band='#2A7444', tip='#1F5A30', lidline='#2A7444')),
             'young_f': dict(s=0.60, head_k=1.20, leg_k=0.90, body_l=0.80, eye_k=1.3, teeth=3, snout=0.38, tail=0.40,
                             ridges=5,
                             col=dict(body='#62BA86', belly='#F4F4C4', jaw='#96D4A6', ridge='#DCEC9E', paw='#52A674',
                                      tip='#F4E27A', lidline='#3E9460')),
         })


# ---------------------------------------------------------------- panda
def panda_decor(c):
    b, C, P, k = c.b, c.C, c.P, c.k
    hcy, hz, hh, face, bz, bh = c.hcy, c.hz, c.hh, c.face, c.bz, c.bh
    bk = C['black']
    # zwarte kap over borst en schouders: een iets grotere doos met dezelfde ronding om de voorkant van de romp
    b.box('body', bk, (c.bw + 0.02, 0.44, bh + 0.02), (0, c.front + 0.21, bz), bevel=0.48)
    # snuit met zwarte neus en een lachje
    my, mz = face - 0.03 * k, hz - 0.11 * k
    b.box('head', C['body'], (0.26 * k, 0.13 * k, 0.17 * k), (0, my, mz), bevel=0.4)
    b.box('head', bk, (0.10 * k, 0.05 * k, 0.06 * k), (0, my - 0.062 * k, mz + 0.045 * k), seg=1)
    b.box('head', bk, (0.02 * k, 0.02 * k, 0.05 * k), (0, my - 0.06 * k, mz - 0.005 * k), bevel=0)
    b.box('head', bk, (0.09 * k, 0.02 * k, 0.016 * k), (0, my - 0.06 * k, mz - 0.035 * k), bevel=0)
    exk, ezk = c.D['eye']
    for sx in (1, -1):
        ex, ez = sx * exk * k, hz + ezk * k
        # zwarte oogvlek, schuin (het ooglid is ook zwart: zie wild_eye hieronder)
        b.band('head', bk, (0.15 * k, 0.05 * k, 0.21 * k), (ex + sx * 0.012 * k, face + 0.018 * k, ez - 0.015 * k), 0.055 * k,
               axis=1, ry=-sx * 20)
        # ronde zwarte oren
        b.band('head', bk, (0.19 * k, 0.08 * k, 0.18 * k), (sx * 0.21 * k, hcy + 0.03 * k, hz + hh / 2 + 0.03 * k), 0.07 * k, axis=1)
        if P.get('cheeks'):
            b.box('head', C['cheek'], (0.09 * k, 0.05 * k, 0.06 * k), (sx * 0.195 * k, face + 0.015 * k, hz - 0.11 * k), bevel=0.4, seg=1)
    if P.get('tuft'):   # jong: kuifje van drie haren
        for dx in (-0.05, 0.0, 0.05):
            b.box('head', bk, (0.035 * k, 0.035 * k, 0.10 * k), (dx * k, hcy - 0.03 * k + abs(dx) * 0.5 * k, hz + hh / 2 + 0.035 * k),
                  taper=(2, 1.0, 0.4), hard=True, seg=1, ry=dx * 240)
    wild_eye(c, lid=bk)
    # kort wit staartje
    tail_chain(c, (0, c.back - 0.03, bz - 0.02), -15, -35, 0.05, 0.04, 0.10, 0.09, C['body'], C['body'], seg=1)
    b.ball('tail2', C['body'], (0.10, 0.09, 0.09), (0, c.back + 0.05, bz - 0.05), sub=1)


wild_add('panda', decor=panda_decor, view=1.1,
         dims=dict(leg_len=0.30, leg_w=0.20, leg_d=0.22, bw=0.64, bl=0.84, bh=0.58, BT=(1.0, 1.0), body_bevel=0.4,
                   head=(0.56, 0.44, 0.50), head_at=(0.20, 0.25), head_fwd=0.36, eye=(0.14, 0.05), eye_white=True,
                   paw=(0.012, 0.03, 0.07, -0.01), leg_in=0.05, leg_f=0.21, leg_h=0.19, leg_top=0.16, lie_hp=0.09,
                   eat=(14, 64), tail_up=25),
         col=dict(eye='#1B1A20', lidline='#9A98A2', cheek='#F7A0B6'),
         variants={
             'male':    dict(s=1.00, head_k=1.00, leg_k=1.0, body_l=1.00, eye_k=1.0,
                             col=dict(body='#F7F6F0', black='#25232B', leg='#25232B', paw='#35333D')),
             'female':  dict(s=0.90, head_k=0.97, leg_k=1.0, body_l=1.00, eye_k=1.0, cheeks=True,
                             col=dict(body='#FFFEFA', black='#3A3640', leg='#3A3640', paw='#4A4650')),
             'young_m': dict(s=0.56, head_k=1.28, leg_k=0.85, body_l=0.80, eye_k=1.25, tuft=True,
                             col=dict(body='#F7F6F0', black='#2B2931', leg='#2B2931', paw='#3B3943')),
             'young_f': dict(s=0.56, head_k=1.28, leg_k=0.85, body_l=0.80, eye_k=1.25, cheeks=True,
                             col=dict(body='#FFFEFA', black='#423E48', leg='#423E48', paw='#524E58')),
         })
