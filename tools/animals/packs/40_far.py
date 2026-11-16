"""Pakket 'far': jak, schildpad, otter, bever, koala, rode panda, ringstaartmaki en bizon.

Draait in de module build_animals.py (zie de pakketlader onderaan dat bestand) en gebruikt dus
Builder, neck, belly, tail_chain, anim_pose, SPECIES, ... rechtstreeks.

Alle acht zijn gewone viervoeters op het gedeelde skelet met de twaalf gedeelde animaties.
Drie dingen regelt dit pakket zelf, via de haak SPECIES[soort]['build'] (zie far_build):
  * een variant mag met P['dims'] een maat van de soort overschrijven (de jak ligt per variant
    op een andere hoogte, omdat zijn haarrok dan net de grond raakt);
  * een eigen poser tilt de staart in elke houding precies zoveel op dat hij op de grond ligt
    in plaats van erdoor te zakken (zitten, liggen, slapen, verdrietig; peddelstaart, lange staart);
  * voor het kopplaatje (render_icons) krijgt de soort dims['far_icon'] = True mee; de schildpad
    hangt dan zijn schild aan het kop-bot, zodat het schild mee op het plaatje komt.
"""
import numpy as far_np


# ---------------------------------------------------------------- gedeeld: staart boven de grond
def far_rot(d, lift=0.0):
    return (Matrix.Rotation(math.radians(d.get('rz', 0)), 3, 'Z')
            @ Matrix.Rotation(math.radians(d.get('ry', 0)), 3, 'Y')
            @ Matrix.Rotation(math.radians(d.get('rx', 0) + lift), 3, 'X'))


def far_low(G, pose, a1, a2):
    """Laagste punt van de twee staartstukken in deze houding, met a1 en a2 graden extra optillen.
    Derde getal: hoe steil tail2 dan omhoog wijst (sinus van de hoek met de grond)."""
    piv, pts = G['far_piv'], G['far_pts']
    db = pose.get('body', {})
    Rb = far_rot(db)
    M1 = Rb @ far_rot(pose.get('tail1', {}), a1)
    M2 = M1 @ far_rot(pose.get('tail2', {}), a2)
    c1 = Rb[2].dot(piv['tail1'] - piv['body']) + piv['body'].z + db.get('loc', (0, 0, 0))[2]
    c2 = c1 + M1[2].dot(piv['tail2'] - piv['tail1'])
    return (float((pts['tail1'] @ far_np.array(M1[2])).min()) + c1,
            float((pts['tail2'] @ far_np.array(M2[2])).min()) + c2, M2[2].dot(G['far_ax']))


def far_solve(test, top=110.0):
    """Kleinste hoek waarbij test(hoek) klopt."""
    if test(0.0):
        return 0.0
    lo = hi = 0.0
    while hi < top:
        hi += 5.0
        if test(hi):
            break
        lo = hi
    for _ in range(6):
        mid = (lo + hi) / 2
        if test(mid):
            hi = mid
        else:
            lo = mid
    return hi


def far_poser(name, t, G):
    """De gedeelde houdingen; daarna de staart zoveel optillen dat hij niet door de grond zakt.
    tail1 gaat omhoog tot hij vrij ligt en tail2 ook vrij kan liggen zonder omhoog te gaan wijzen
    (een hangende staart mag dus naar achteren knikken, een liggende staart krijgt geen krul omhoog);
    daarna buigt tail2 precies zover omhoog of omlaag dat hij op de grond ligt."""
    pose = anim_pose(name, t, G)
    gap = G.get('far_gap', 0.004)

    def ok(a1):
        z1, z2, up = far_low(G, pose, a1, 0.0)
        if z1 < gap:
            return False
        if z2 >= gap:
            return True
        for a in range(5, 80, 5):
            z1, z2, up = far_low(G, pose, a1, float(a))
            if up > 0.07:
                return False   # tail2 zou omhoog gaan wijzen: dan liever tail1 verder optillen
            if z2 >= gap:
                return True
        return False
    a1 = far_solve(ok)
    if a1 and far_low(G, pose, a1, 0.0)[1] >= gap:
        # tail1 is opgetild en tail2 hangt nu los in de lucht: laten zakken tot hij weer op de grond ligt
        a2 = -a1 + far_solve(lambda a: far_low(G, pose, a1, a - a1)[1] >= gap, top=a1)
    else:
        a2 = far_solve(lambda a: far_low(G, pose, a1, a)[1] >= gap, top=75.0)
    for bone, a in (('tail1', a1), ('tail2', a2)):
        if a:
            d = pose.setdefault(bone, {})
            d['rx'] = d.get('rx', 0) + a
    return pose


def far_build(species, variant, style, name):
    """Gewone viervoeter uit build_animal, met maten per variant en de poser hierboven."""
    R = SPECIES[species]
    fn, D0 = R.pop('build'), R['dims']
    # render_icons bouwt het dier met name == soort en houdt alleen over wat aan het kop-bot hangt;
    # far_icon laat een soort daar rekening mee houden (de schildpad neemt dan zijn schild mee op de foto)
    R['dims'] = dict(D0, far_icon=(name == species), **R['variants'][variant].get('dims', {}))
    try:
        rig, obj, G = build_animal(species, variant, style, name)
    finally:
        R['build'], R['dims'] = fn, D0
    s = G['s']
    gi = {g.name: g.index for g in obj.vertex_groups}
    piv = {bn: rig.data.bones[bn].head_local / s for bn in ('body', 'tail1', 'tail2')}
    pts = {}
    for bn in ('tail1', 'tail2'):
        co = [tuple(v.co / s - piv[bn]) for v in obj.data.vertices if gi[bn] in [g.group for g in v.groups]]
        pts[bn] = far_np.array(co or [(0.0, 0.0, 0.0)])
    G['far_piv'], G['far_pts'], G['poser'] = piv, pts, far_poser
    # richting van tail2: van de knik naar zijn verste punt
    G['far_ax'] = Vector(pts['tail2'][(pts['tail2'] ** 2).sum(axis=1).argmax()]).normalized()
    return rig, obj, G


# ---------------------------------------------------------------- gedeeld: onderdelen
def far_tail(c, tp, a1, a2, L1, L2, w, col1, col2, hk=1.0, seg=2):
    """Staart in twee stukken die taps toeloopt: w = (breedte bij de wortel, bij de knik, bij de punt),
    hk maakt hem platter of hoger. Hoeken als bij tail_chain. Geeft maten terug voor ringen en een punt."""
    b = c.b
    ang, L = (a1, a2), (L1, L2)
    d = [Vector((0, math.cos(math.radians(a)), math.sin(math.radians(a)))) for a in ang]
    base = [Vector(tp), Vector(tp) + d[0] * L1]
    for i, col in enumerate((col1, col2)):
        b.box('tail%d' % (i + 1), col, (w[i], L[i] + 0.05, w[i] * hk), base[i] + d[i] * L[i] / 2, rx=ang[i], seg=seg,
              taper=(1, 1.0, w[i + 1] / w[i]), hard=True)
    c.piv['tail1'], c.piv['tail2'] = base

    def ring(i, y, length, col, extra=0.022, seg=1):
        """Ring om stuk i (0 of 1), midden op afstand y vanaf het begin van dat stuk."""
        f = max(0.0, min(1.0, (y - length / 2) / L[i]))
        ww = w[i] + (w[i + 1] - w[i]) * f
        b.band('tail%d' % (i + 1), col, (ww + extra, length, ww * hk + extra), base[i] + d[i] * y,
               min(ww, ww * hk) * 0.3, axis=1, rx=ang[i], seg=seg)

    def tip(length, col, extra=0.022):
        ring(1, L2 + 0.025 - length / 2 + 0.012, length, col, extra)
    return SimpleNamespace(ring=ring, tip=tip, base=base, d=d, L=L)


def far_horn(b, col, tip, k, root, sx, segs, w):
    """Hoorn als ketting van doosjes. segs = [(hoek vanaf recht omhoog naar buiten, lengte), ...]"""
    p = Vector(root)
    for i, (ang, ln) in enumerate(segs):
        a = math.radians(ang)
        d = Vector((sx * math.sin(a), 0, math.cos(a)))
        last = i == len(segs) - 1
        b.box('head', tip if last else col, (w * k, w * k, (ln + 0.035) * k), p + d * (ln * k / 2), ry=sx * ang, seg=1,
              taper=(2, 1.0, 0.35 if last else 0.85), hard=True)
        p = p + d * (ln * k)
        w *= 0.85


def far_saddle(c, col, frac=0.3):
    """Rug in een andere kleur: schil om de bovenste strook van de romp (tegenhanger van belly)."""
    L = c.bl - 2 * c.body_bev + 0.06
    c.b.band('body', col, (c.bw + 0.016, L, c.bh + 0.016), (0, 0, c.bz), c.body_bev,
             cut=(2, c.bh / 2 - c.bh * frac, -1))


# ---------------------------------------------------------------- jak
def yak_decor(c):
    b, C, P, k, D = c.b, c.C, c.P, c.k, c.D
    hcy, hz, hh, hw, face = c.hcy, c.hz, c.hh, c.hw, c.face
    bz, bh, bw, front, back = c.bz, c.bh, c.bw, c.front, c.back
    f = c.bl / D['bl']
    # schoft: hoge ronde bult boven de voorpoten, daarachter een lagere trede naar de rug
    hp = P['hump']
    b.box('body', C['hump'], (bw * 0.92, 0.50 * f, hp + 0.18), (0, front + 0.27 * f, bz + bh / 2 + hp / 2 - 0.09),
          bevel=0.42, taper=(2, 1.0, 0.7), hard=True)
    b.box('body', C['hump'], (bw * 0.80, 0.36 * f, hp * 0.5 + 0.18), (0, front + 0.60 * f, bz + bh / 2 + hp * 0.25 - 0.09),
          bevel=0.42, taper=(1, 1.0, 0.6), hard=True)
    # rok van lang haar langs de flanken: een dichte lap met daaronder puntige lokken van ongelijke lengte.
    # De rok hangt precies zo laag dat hij bij liggen (heup op lie_hp) net de grond raakt.
    top, low = bz + 0.08, c.leg_len - D['lie_hp'] + 0.012
    mid = low + 0.21
    y0, y1 = front + 0.04, back - 0.03
    n = 6
    ly = (y1 - y0) / n
    for sx in (1, -1):
        x = sx * (bw / 2 + 0.012)
        b.box('body', C['hair'], (0.08, y1 - y0, top - mid + 0.04), (x, (y0 + y1) / 2, (top + mid - 0.04) / 2), seg=1)
        for i in range(n):
            z0 = low + (0.05 if i % 2 else 0.0) + (0.035 if i == n - 1 else 0.0)
            b.box('body', C['hair2'] if i % 2 else C['hair'], (0.085, ly + 0.012, mid + 0.05 - z0),
                  (x + sx * 0.003, y0 + ly * (i + 0.5), (mid + 0.05 + z0) / 2), seg=1, taper=(2, 0.4, 1.0), hard=True)
    # haar voor de borst en over de bips
    z0, z1 = low + 0.05, bz - 0.04
    b.box('body', C['hair'], (bw * 0.84, 0.09, z1 - z0), (0, front - 0.012, (z0 + z1) / 2), seg=1,
          taper=(2, 0.6, 1.0), hard=True)
    z0 = low + 0.09
    b.box('body', C['hair'], (bw * 0.86, 0.08, top - z0), (0, back + 0.004, (top + z0) / 2), seg=1,
          taper=(2, 0.6, 1.0), hard=True)
    # kop: lichte snuit, hangoren, ruige kuif
    my, mz = face - 0.04 * k, hz - 0.11 * k
    b.box('head', C['muzzle'], (0.32 * k, 0.16 * k, 0.19 * k), (0, my, mz))
    b.box('head', C['tuft'], (0.28 * k, 0.27 * k, 0.10 * k), (0, hcy + 0.0 * k, hz + hh / 2 + 0.02 * k), bevel=0.4, seg=1)
    b.box('head', C['tuft'], (0.19 * k, 0.06 * k, 0.13 * k), (0, face - 0.008 * k, hz + hh / 2 - 0.035 * k),
          taper=(2, 0.5, 1.0), hard=True, seg=1)
    horns = P.get('horns', 0)   # 0 geen, 1 stompjes, 2 klein, 3 breed en gebogen
    segs, hw_ = {1: ([(50, 0.08)], 0.06), 2: ([(76, 0.12), (18, 0.13)], 0.065),
                 3: ([(80, 0.19), (42, 0.11), (4, 0.17)], 0.085)}.get(horns, ([], 0))
    for sx in (1, -1):
        b.box('head', C['nostril'], (0.045 * k, 0.02 * k, 0.05 * k), (sx * 0.075 * k, my - 0.075 * k, mz + 0.02 * k),
              bevel=0.3, seg=1)
        b.box('head', C['hair'], (0.15 * k, 0.06 * k, 0.09 * k), (sx * (hw / 2 + 0.05 * k), hcy + 0.11 * k, hz + 0.02 * k),
              ry=sx * 20, seg=1)
        if segs:
            far_horn(b, C['horn'], C['horn_tip'], k, (sx * 0.12 * k, hcy + 0.07 * k, hz + hh / 2 - 0.035 * k), sx, segs, hw_)
    # dikke pluimstaart
    tail_chain(c, (0, back - 0.03, bz + 0.12), -54, -78, 0.20, 0.28, 0.11, 0.15, C['hair'], C['tail'], seg=1)


# ---------------------------------------------------------------- bizon
def bison_decor(c):
    b, C, P, k, D = c.b, c.C, c.P, c.k, c.D
    hcy, hz, hh, hw, hl, face = c.hcy, c.hz, c.hh, c.hw, c.hl, c.face
    bz, bh, bw, front, back = c.bz, c.bh, c.bw, c.front, c.back
    f = c.bl / D['bl']
    # schoudermantel: donker, breder en iets lager dan de romp, die daardoor smalle heupen lijkt te hebben
    cw, ch = P['cape']
    z0, z1 = bz - bh / 2 - 0.045, bz + bh / 2 + ch
    cl = 0.48 * f
    cy = front + cl / 2 - 0.03
    b.box('body', C['cape'], (bw + cw, cl, z1 - z0), (0, cy, (z0 + z1) / 2), bevel=0.3)
    # de bult: een hoog rond blok boven de schouders en daarachter een lagere wig die afloopt naar de heupen
    hump = P['hump']
    b.box('body', C['hump'], (bw + cw - 0.04, 0.46 * f, hump + 0.22), (0, front + 0.25 * f, bz + bh / 2 + hump / 2 - 0.11),
          bevel=0.42, taper=(2, 1.0, 0.72), hard=True)
    b.box('body', C['hump'], ((bw + cw) * 0.80, 0.46 * f, hump * 1.2), (0, front + 0.60 * f, bz + bh / 2), bevel=0.42,
          taper=(1, 1.0, 0.5), hard=True)
    # ruige voorpoten
    for bone, x, y in c.legs[:2]:
        b.box(bone, C['shag'], (c.leg_w + 0.06, c.leg_d + 0.06, c.leg_len * 0.62), (x, y, c.leg_len * 0.66), seg=1,
              taper=(2, 0.8, 1.0), hard=True)
    # kop: brede donkere snuit, ruige kruin, sik, korte gebogen hoorns
    my, mz = face - 0.04 * k, hz - 0.12 * k
    b.box('head', C['muzzle'], (0.30 * k, 0.15 * k, 0.19 * k), (0, my, mz))
    b.box('head', C['shag'], (hw + 0.05 * k, hl * 0.74, 0.17 * k), (0, hcy + 0.045 * k, hz + hh / 2 + 0.01 * k), bevel=0.4)
    beard = P.get('beard', 0)
    if beard:
        b.box('head', C['shag'], (0.16 * k, 0.14 * k, (beard + 0.05) * k), (0, hcy - 0.03 * k, hz - hh / 2 - beard * k / 2 + 0.025 * k),
              taper=(2, 0.45, 1.0), hard=True, seg=1)
    horns = P.get('horns', 0)   # 0 geen, 1 stompjes, 2 klein, 3 groot
    segs, hw_ = {1: ([(55, 0.07)], 0.055), 2: ([(80, 0.08), (12, 0.11)], 0.06),
                 3: ([(84, 0.11), (36, 0.08), (0, 0.13)], 0.08)}.get(horns, ([], 0))
    for sx in (1, -1):
        b.box('head', C['nostril'], (0.05 * k, 0.02 * k, 0.045 * k), (sx * 0.075 * k, my - 0.07 * k, mz + 0.025 * k),
              bevel=0.3, seg=1)
        b.box('head', C['shag'], (0.10 * k, 0.05 * k, 0.07 * k), (sx * (hw / 2 + 0.035 * k), hcy + 0.14 * k, hz + 0.0 * k),
              ry=sx * 15, seg=1)
        if segs:
            far_horn(b, C['horn'], C['horn'], k, (sx * (hw / 2 - 0.02 * k), hcy + 0.05 * k, hz + hh / 2 - 0.10 * k), sx, segs, hw_)
    tail_chain(c, (0, back - 0.02, bz + 0.10), -66, -82, 0.18, 0.12, 0.05, 0.045, C['body'], C['body'],
               tuft=((0.055, 0.085, 0.055), C['shag']), seg=1)


# ---------------------------------------------------------------- schildpad
def turtle_decor(c):
    b, C, P, k, D = c.b, c.C, c.P, c.k, c.D
    hcy, hz, hh, hw, face = c.hcy, c.hz, c.hh, c.hw, c.face
    bz, bh, bw, front, back = c.bz, c.bh, c.bw, c.front, c.back
    # korte rimpelige nek die onder de rand van het schild vandaan komt
    nk = neck(c, C['skin'], 0.15, 0.14, y0=-0.02, z0=0.03, ty=0.10, tz=-0.03)
    for fr in (0.36, 0.56):
        b.band('head', C['wrinkle'], (nk.w + 0.018, nk.d + 0.018, 0.035), nk.at(fr), nk.bev, axis=2, rx=nk.deg, seg=1)
    # schild: koepel met een afgeschuinde rand (een vlak per kant), platen erop en een lichte rand
    W, Lh, H = bw + 0.14, c.bl + 0.10, P.get('dome', 0.40)
    z0 = bz - 0.02
    top = z0 + H
    r = min(W, Lh, H) * 0.46
    sb = 'head' if D.get('far_icon') else 'body'   # alleen voor het kopplaatje hangt het schild aan de kop
    b.box(sb, C['shell'], (W, Lh, H), (0, 0, z0 + H / 2), bevel=0.46, seg=1)
    b.band(sb, C['rim'], (W + 0.06, Lh + 0.06, 0.08), (0, 0, z0 + 0.09), 0.20, axis=2)
    t, e = 0.032, 0.006
    tw, tl = W - 2 * r + 0.03, (Lh - 2 * r + 0.03) / 3
    sw = r * 1.414 - 0.05
    for i in (-1, 0, 1):
        b.band(sb, C['plate'], (tw - 0.03, tl - 0.03, t), (0, i * tl, top - t / 2 + e), 0.035, axis=2, seg=1)
        b.band(sb, C['plate2'], (tw * 0.45, tl * 0.42, t), (0, i * tl, top - t / 2 + e + 0.008), 0.02, axis=2, seg=1)
        for sx in (1, -1):
            b.band(sb, C['plate'], (sw, tl - 0.03, t), (sx * (W / 2 - r / 2 - 0.007), i * tl, top - r / 2 - 0.007),
                   0.035, axis=2, seg=1, ry=sx * 45)
    for sy in (1, -1):
        b.band(sb, C['plate'], (tw - 0.03, sw, t), (0, sy * (Lh / 2 - r / 2 - 0.007), top - r / 2 - 0.007),
               0.035, axis=2, seg=1, rx=-sy * 45)
    # kop: snavelmond, neusgaatjes
    b.box('head', C['beak'], (0.19 * k, 0.07 * k, 0.085 * k), (0, face - 0.012 * k, hz - 0.07 * k), seg=1)
    b.box('head', C['mouth'], (0.15 * k, 0.012 * k, 0.012 * k), (0, face - 0.045 * k, hz - 0.085 * k), bevel=0)
    for sx in (1, -1):
        b.box('head', C['mouth'], (0.018 * k, 0.012 * k, 0.018 * k), (sx * 0.03 * k, face - 0.045 * k, hz - 0.045 * k), bevel=0)
    # klein staartje
    tail_chain(c, (0, back, bz - 0.03), -16, -38, 0.09, 0.05, 0.08, 0.055, C['skin'], C['skin'], seg=1)


# ---------------------------------------------------------------- otter
def otter_decor(c):
    b, C, P, k, D = c.b, c.C, c.P, c.k, c.D
    hcy, hz, hh, hw, hl, face = c.hcy, c.hz, c.hh, c.hw, c.hl, c.face
    bz, bh, bw, front, back = c.bz, c.bh, c.bw, c.front, c.back
    belly(c, C['pale'], 0.30)
    if P.get('saddle'):
        far_saddle(c, C['back'], 0.30)
    # lichte borst en keel
    b.box('body', C['pale'], (bw * 0.80, 0.12, bh * 0.56), (0, front + 0.04, bz - bh * 0.20), bevel=0.35)
    b.box('head', C['pale'], (hw * 0.78, hl * 0.72, 0.05 * k), (0, hcy - 0.03 * k, hz - hh / 2 + 0.008 * k), seg=1)
    # brede lichte snuit, grote neus, snorharen
    my, mz = face - 0.03 * k, hz - 0.07 * k
    b.box('head', C['pale'], (0.30 * k, 0.13 * k, 0.16 * k), (0, my, mz), bevel=0.35)
    b.box('head', C['nose'], (0.12 * k, 0.05 * k, 0.075 * k), (0, my - 0.055 * k, mz + 0.05 * k), seg=1)
    for sx in (1, -1):
        for i, a in enumerate((-16, 0, 16)):
            b.box('head', C['whisker'], (0.15 * k, 0.012 * k, 0.012 * k),
                  (sx * 0.20 * k, my - 0.03 * k, mz - 0.02 * k + i * 0.028 * k), bevel=0, ry=-sx * a)
        # kleine ronde oortjes
        ear = (sx * (hw / 2 - 0.02 * k), hcy + 0.10 * k, hz + hh / 2 + 0.0 * k)
        b.box('head', C['ear'], (0.095 * k, 0.05 * k, 0.085 * k), ear, bevel=0.45, seg=1)
        b.box('head', C['ear_in'], (0.045 * k, 0.02 * k, 0.04 * k), (ear[0], ear[1] - 0.022 * k, ear[2] + 0.005 * k), seg=1)
    # dikke staart die taps toeloopt en vlak boven de grond hangt
    tl = far_tail(c, (0, back - 0.08, bz - 0.01), -24, -9, 0.36 * P.get('tail', 1.0), 0.38 * P.get('tail', 1.0),
                  (0.25, 0.17, 0.07), C['tail'], C['tail'], hk=0.85)
    if P.get('tip'):
        tl.tip(0.12, C['tip'])


# ---------------------------------------------------------------- bever
def beaver_decor(c):
    b, C, P, k, D = c.b, c.C, c.P, c.k, c.D
    hcy, hz, hh, hw, face = c.hcy, c.hz, c.hh, c.hw, c.face
    bz, bh, bw, front, back = c.bz, c.bh, c.bw, c.front, c.back
    if P.get('belly'):
        belly(c, C['belly'], 0.34)
    # snuit, grote neus en twee flinke oranje voortanden
    my, mz = face - 0.035 * k, hz - 0.09 * k
    b.box('head', C['muzzle'], (0.30 * k, 0.14 * k, 0.17 * k), (0, my, mz), bevel=0.35)
    b.box('head', C['nose'], (0.13 * k, 0.05 * k, 0.075 * k), (0, my - 0.06 * k, mz + 0.055 * k), seg=1)
    for sx in (1, -1):
        b.box('head', C['tooth'], (0.082 * k, 0.045 * k, 0.12 * k), (sx * 0.045 * k, my - 0.045 * k, mz - 0.105 * k),
              bevel=0.2, seg=1)
        ear = (sx * (hw / 2 - 0.03 * k), hcy + 0.10 * k, hz + hh / 2 + 0.005 * k)
        b.box('head', C['ear'], (0.10 * k, 0.05 * k, 0.09 * k), ear, bevel=0.45, seg=1)
        b.box('head', C['ear_in'], (0.05 * k, 0.02 * k, 0.045 * k), (ear[0], ear[1] - 0.022 * k, ear[2] + 0.005 * k), seg=1)
    if P.get('tuft'):   # jong: plukje haar op de kop
        b.box('head', C['ear'], (0.12 * k, 0.13 * k, 0.07 * k), (0, hcy - 0.02 * k, hz + hh / 2 + 0.015 * k), bevel=0.4, seg=1)
    # brede platte peddelstaart: steel aan tail1, peddel aan tail2, met een ruitjespatroon
    tp = Vector((0, back - 0.06, bz - 0.17))
    a1, a2, L1, L2 = -32, -5, 0.24, 0.46
    d1 = Vector((0, math.cos(math.radians(a1)), math.sin(math.radians(a1))))
    d2 = Vector((0, math.cos(math.radians(a2)), math.sin(math.radians(a2))))
    n2 = Vector((0, -math.sin(math.radians(a2)), math.cos(math.radians(a2))))
    p2 = tp + d1 * L1
    b.band('tail1', C['tail'], (0.19, L1 + 0.10, 0.085), tp + d1 * L1 / 2, 0.06, axis=2, rx=a1)
    b.band('tail2', C['tail'], (0.36, L2, 0.07), p2 + d2 * (L2 / 2 - 0.04), 0.15, axis=2, rx=a2)
    for i in range(3):
        b.box('tail2', C['scale'], (0.27, 0.02, 0.012), p2 + d2 * (0.07 + 0.105 * i) + n2 * 0.036, rx=a2, bevel=0)
    for x in (-0.07, 0.07):
        b.box('tail2', C['scale'], (0.02, 0.33, 0.012), p2 + d2 * 0.175 + n2 * 0.036 + Vector((x, 0, 0)), rx=a2, bevel=0)
    c.piv['tail1'], c.piv['tail2'] = tp, p2


# ---------------------------------------------------------------- koala
def koala_decor(c):
    b, C, P, k, D = c.b, c.C, c.P, c.k, c.D
    hcy, hz, hh, hw, face = c.hcy, c.hz, c.hh, c.hw, c.face
    bz, bh, bw, front, back = c.bz, c.bh, c.bw, c.front, c.back
    belly(c, C['pale'], 0.30)
    if P.get('saddle'):
        far_saddle(c, C['back'], 0.32)
    # lichte borst, bij het mannetje met een bruine vlek; lichte bips
    b.box('body', C['pale'], (bw * 0.66, 0.12, bh * 0.62), (0, front + 0.035, bz - bh * 0.12), bevel=0.35)
    if P.get('patch'):
        b.box('body', C['patch'], (0.12, 0.03, 0.15), (0, front - 0.016, bz - bh * 0.10), seg=1)
    b.box('body', C['rump'], (bw * 0.56, 0.16, bh * 0.50), (0, back - 0.068, bz - 0.03), bevel=0.45)
    # grote ronde pluizige oren met witte binnenkant en witte plukken
    for sx in (1, -1):
        ex, ey, ez = sx * (hw / 2 + 0.06 * k), hcy + 0.05 * k, hz + hh / 2 - 0.02 * k
        b.band('head', C['body'], (0.29 * k, 0.10 * k, 0.29 * k), (ex, ey, ez), 0.115 * k, axis=1)
        b.band('head', C['ear_in'], (0.20 * k, 0.03 * k, 0.20 * k), (ex + sx * 0.005 * k, ey - 0.045 * k, ez), 0.08 * k, axis=1, seg=1)
        for dx, dz, ry in ((0.095, -0.095, 40), (0.035, -0.135, 12)):
            b.box('head', C['white'], (0.075 * k, 0.07 * k, 0.085 * k), (ex + sx * dx * k, ey - 0.035 * k, ez + dz * k),
                  taper=(2, 0.45, 1.0), hard=True, seg=1, ry=-sx * ry)
    # grote zwarte ovale neus, lichte kin
    b.box('head', C['nose'], (0.14 * k, 0.08 * k, 0.21 * k), (0, face - 0.02 * k, hz - 0.045 * k), bevel=0.45)
    b.box('head', C['pale'], (0.15 * k, 0.05 * k, 0.06 * k), (0, face - 0.006 * k, hz - hh / 2 + 0.035 * k), seg=1)
    if P.get('tuft'):   # jong: pluizig kuifje
        b.box('head', C['rump'], (0.14 * k, 0.13 * k, 0.07 * k), (0, hcy - 0.03 * k, hz + hh / 2 + 0.015 * k), bevel=0.4, seg=1)
    # geen zichtbare staart: twee blokjes diep in de romp, alleen voor de botten
    tp = Vector((0, back - 0.16, bz))
    b.box('tail1', C['body'], (0.04, 0.04, 0.04), tp + Vector((0, 0.02, 0)), bevel=0)
    b.box('tail2', C['body'], (0.04, 0.04, 0.04), tp + Vector((0, 0.06, 0)), bevel=0)
    c.piv['tail1'], c.piv['tail2'] = tp, tp + Vector((0, 0.04, 0))


# ---------------------------------------------------------------- rode panda
def redpanda_decor(c):
    b, C, P, k, D = c.b, c.C, c.P, c.k, c.D
    hcy, hz, hh, hw, face = c.hcy, c.hz, c.hh, c.hw, c.face
    bz, bh, bw, front, back = c.bz, c.bh, c.bw, c.front, c.back
    # donkere buik en borst
    belly(c, C['dark'], 0.42)
    b.box('body', C['dark'], (bw * 0.80, 0.12, bh * 0.66), (0, front + 0.04, bz - bh * 0.15), bevel=0.35)
    # rond gezicht: witte snuit, witte wangen en wenkbrauwen, daartussen een roestbruine traanstreep
    exk, ezk = D['eye']
    my, mz = face - 0.03 * k, hz - 0.095 * k
    b.box('head', C['white'], (0.19 * k, 0.12 * k, 0.14 * k), (0, my, mz), bevel=0.35)
    b.box('head', C['nose'], (0.085 * k, 0.04 * k, 0.055 * k), (0, my - 0.055 * k, mz + 0.04 * k), seg=1)
    for sx in (1, -1):
        b.box('head', C['white'], (0.115 * k, 0.07 * k, 0.14 * k), (sx * 0.19 * k, face + 0.018 * k, hz - 0.085 * k), bevel=0.4, seg=1)
        b.box('head', C['white'], (0.075 * k, 0.03 * k, 0.05 * k), (sx * exk * k, face - 0.004 * k, hz + (ezk + 0.095) * k), seg=1)
        # grote spitse witte oren met donker hart
        ear = (sx * 0.185 * k, hcy + 0.05 * k, hz + hh / 2 + 0.055 * k)
        b.box('head', C['white'], (0.17 * k, 0.06 * k, 0.19 * k), ear, taper=(2, 1.0, 0.4), hard=True, ry=sx * 14)
        b.box('head', C['ear_in'], (0.085 * k, 0.03 * k, 0.10 * k), (ear[0], ear[1] - 0.025 * k, ear[2] - 0.01 * k),
              taper=(2, 1.0, 0.4), hard=True, ry=sx * 14, seg=1)
    # lange pluimstaart met lichte en donkere ringen
    tk = P.get('tail', 1.0)
    L1, L2 = 0.34 * tk, 0.36 * tk
    tl = far_tail(c, (0, back - 0.05, bz + 0.03), -16, -4, L1, L2, (0.19, 0.20, 0.16), C['tail'], C['tail'])
    for i in (0, 1):
        for fr in (0.30, 0.72):
            tl.ring(i, (L1, L2)[i] * fr, 0.075 * tk, C['ring'])
    tl.tip(0.11 * tk, C['tip'])


# ---------------------------------------------------------------- ringstaartmaki
def lemur_decor(c):
    b, C, P, k, D = c.b, c.C, c.P, c.k, c.D
    hcy, hz, hh, hw, hl, face = c.hcy, c.hz, c.hh, c.hw, c.hl, c.face
    bz, bh, bw, front, back = c.bz, c.bh, c.bw, c.front, c.back
    belly(c, C['white'], 0.36)
    b.box('body', C['white'], (bw * 0.74, 0.10, bh * 0.66), (0, front + 0.03, bz - bh * 0.14), bevel=0.35)
    # grijze kruin op een witte kop
    hb = min(hw, hl, hh) * 0.3
    y0, y1, y2 = face + hb - 0.03 * k, hcy + hl * 0.08, hcy + hl / 2 - hb + 0.03 * k
    b.band('head', C['cap'], (hw + 0.014 * k, y1 - y0 + 0.004, hh + 0.014 * k), (0, (y0 + y1) / 2, hz), hb, axis=1,
           cut=(2, hh / 2 - hh * 0.2, -1))
    b.band('head', C['cap'], (hw + 0.014 * k, y2 - y1, hh + 0.014 * k), (0, (y1 + y2) / 2, hz), hb, axis=1,
           cut=(2, -hh * 0.10, -1))
    b.box('head', C['cap'], (hw * 0.78, 0.04 * k, hh * 0.62), (0, hcy + hl / 2 - 0.006 * k, hz + hh * 0.12), seg=1)
    # zwarte oogvlekken, oranje ogen met pupil, zwarte snuit
    exk, ezk = D['eye']
    e = 0.06 * k * P['eye_k']
    my, mz = face - 0.045 * k, hz - 0.085 * k
    b.box('head', C['muzzle'], (0.14 * k, 0.14 * k, 0.11 * k), (0, my, mz))
    for sx in (1, -1):
        ex, ez = sx * exk * k, hz + ezk * k
        b.box('head', C['patch'], (e * 1.55, 0.02 * k, e * 1.75), (ex + sx * 0.002 * k, face + 0.002 * k, ez - e * 0.06), bevel=0.4, seg=1)
        b.box('head', C['pupil'], (e * 0.50, 0.008 * k, e * 0.62), (ex, face - 0.019 * k, ez - e * 0.04), bevel=0)
        # witte puntoren
        ear = (sx * 0.135 * k, hcy + 0.07 * k, hz + hh / 2 + 0.045 * k)
        b.box('head', C['white'], (0.11 * k, 0.05 * k, 0.13 * k), ear, taper=(2, 1.0, 0.4), hard=True, seg=1, ry=sx * 12)
        b.box('head', C['ear_in'], (0.05 * k, 0.02 * k, 0.065 * k), (ear[0], ear[1] - 0.022 * k, ear[2] - 0.008 * k),
              taper=(2, 1.0, 0.4), hard=True, seg=1, ry=sx * 12)
    # heel lange staart recht omhoog, wit met zwarte ringen
    tk = P.get('tail', 1.0)
    L1, L2 = 0.44 * tk, 0.46 * tk
    tl = far_tail(c, (0, back - 0.04, bz + 0.07), 64, 84, L1, L2, (0.12, 0.115, 0.10), C['white'], C['white'], seg=1)
    for i in (0, 1):
        for fr in (0.18, 0.50, 0.82):
            tl.ring(i, (L1, L2)[i] * fr, 0.07 * tk, C['ring'])
    tl.tip(0.08 * tk, C['tip'])


# ---------------------------------------------------------------- recepten
SPECIES['yak'] = dict(
    decor=yak_decor, view=1.1,
    dims=dict(leg_len=0.38, leg_w=0.16, leg_d=0.17, bw=0.56, bl=1.00, bh=0.50, BT=(1.0, 1.0), body_bevel=0.34,
              head=(0.42, 0.40, 0.42), head_at=(0.06, 0.20), eye=(0.13, 0.085), eye_white=True,
              paw=(0.012, 0.012, 0.09, 0.0), eat=(10, 66), sleep=(36, 0.0), lie_hp=0.23),
    col=dict(paw='#1E1614', nostril='#6A5548', muzzle='#E8DCC8', horn='#E9E0CC', horn_tip='#9A8A74', lidline='#C8B8A8'),
    variants={
        'male':    dict(s=1.20, head_k=1.00, leg_k=1.0, body_l=1.00, eye_k=1.0, horns=3, hump=0.20,
                        col=dict(body='#4B3628', head='#40291D', hump='#3E2B20', hair='#33231A', hair2='#402C20',
                                 leg='#33231A', tuft='#33231A', tail='#2A1C15')),
        'female':  dict(s=1.08, head_k=0.97, leg_k=1.0, body_l=1.00, eye_k=1.0, horns=2, hump=0.13,
                        col=dict(body='#7B5638', head='#6E4B30', hump='#6E4B30', hair='#5B3D27', hair2='#6C4A30',
                                 leg='#5B3D27', tuft='#5B3D27', tail='#4A3020')),
        'young_m': dict(s=0.66, head_k=1.30, leg_k=0.78, body_l=0.80, eye_k=1.25, horns=1, hump=0.08,
                        dims=dict(lie_hp=0.18),
                        col=dict(body='#644634', head='#573A2A', hump='#573A2A', hair='#4A3124', hair2='#583C2C',
                                 leg='#4A3124', tuft='#4A3124', tail='#3A261C')),
        'young_f': dict(s=0.66, head_k=1.30, leg_k=0.78, body_l=0.80, eye_k=1.25, horns=0, hump=0.08,
                        dims=dict(lie_hp=0.18),
                        col=dict(body='#8E6846', head='#825C3C', hump='#825C3C', hair='#6E4E34', hair2='#7E5C3E',
                                 leg='#6E4E34', tuft='#F4EAD8', tail='#F4EAD8')),
    })

SPECIES['bison'] = dict(
    decor=bison_decor, view=1.15,
    dims=dict(leg_len=0.40, leg_w=0.15, leg_d=0.16, bw=0.48, bl=1.06, bh=0.44, BT=(1.0, 1.0), body_bevel=0.32,
              head=(0.42, 0.40, 0.46), head_at=(-0.02, 0.10), head_fwd=0.42, eye=(0.135, 0.075), eye_white=True,
              paw=(0.012, 0.012, 0.09, 0.0), leg_f=0.18, eat=(6, 62), sleep=(30, 0.0), lie_hp=0.12),
    col=dict(paw='#1C1512', nostril='#120C0A', horn='#DDD5C2', lidline='#B8A898'),
    variants={
        'male':    dict(s=1.30, head_k=1.00, leg_k=1.0, body_l=1.00, eye_k=1.0, horns=3, beard=0.12,
                        cape=(0.12, 0.12), hump=0.36,
                        col=dict(body='#8A5C38', hump='#7A4E2E', cape='#553622', shag='#33211A', head='#3E271C',
                                 muzzle='#2A1C16', leg='#5A3A24')),
        'female':  dict(s=1.15, head_k=0.97, leg_k=1.0, body_l=1.00, eye_k=1.0, horns=2, beard=0.06,
                        cape=(0.09, 0.08), hump=0.25,
                        col=dict(body='#9C6C44', hump='#8E5F3A', cape='#6E4A2C', shag='#4A3020', head='#573826',
                                 muzzle='#33221A', leg='#6A4830')),
        'young_m': dict(s=0.70, head_k=1.28, leg_k=0.80, body_l=0.80, eye_k=1.25, horns=1,
                        cape=(0.07, 0.04), hump=0.14,
                        col=dict(body='#C9803E', hump='#C9803E', cape='#B56C2E', shag='#7A4420', head='#B56C2E',
                                 muzzle='#5A3420', leg='#B56C2E')),
        'young_f': dict(s=0.70, head_k=1.28, leg_k=0.80, body_l=0.80, eye_k=1.25, horns=0,
                        cape=(0.07, 0.04), hump=0.14,
                        col=dict(body='#D9964E', hump='#D9964E', cape='#C9803E', shag='#C9803E', head='#C9803E',
                                 muzzle='#7A4A2C', leg='#C9803E')),
    })

SPECIES['turtle'] = dict(
    decor=turtle_decor,
    dims=dict(leg_len=0.15, leg_w=0.17, leg_d=0.19, bw=0.50, bl=0.74, bh=0.24, BT=(1.0, 1.0),
              head=(0.25, 0.27, 0.23), neck=(0.0, 0.20), head_at=(0.22, 0.20), head_fwd=0.5, eye=(0.082, 0.035),
              paw=(0.016, 0.03, 0.055, -0.012), leg_in=-0.045, leg_f=0.17, leg_h=0.17, leg_top=0.08,
              lie_hp=0.09, eat=(8, 60), sleep=(40, 0.0)),
    col=dict(mouth='#24402A'),
    variants={
        'male':    dict(s=0.92, head_k=1.00, leg_k=1.0, body_l=1.00, eye_k=1.15, dome=0.46,
                        col=dict(body='#D9C88A', skin='#4E8A54', head='#4E8A54', leg='#4E8A54', paw='#3A6E42',
                                 wrinkle='#3A6E42', beak='#86BC84', shell='#5A3F24', plate='#A8763A', plate2='#D0A45A',
                                 rim='#E8D08C')),
        'female':  dict(s=0.84, head_k=0.97, leg_k=1.0, body_l=1.00, eye_k=1.15, dome=0.42,
                        col=dict(body='#E2D59A', skin='#5C9A62', head='#5C9A62', leg='#5C9A62', paw='#467E4E',
                                 wrinkle='#467E4E', beak='#94C892', shell='#3F5A2C', plate='#7FA046', plate2='#B9CF70',
                                 rim='#F0E3A2')),
        'young_m': dict(s=0.56, head_k=1.28, leg_k=0.90, body_l=0.80, eye_k=1.35, neck_k=0.8, dome=0.40,
                        col=dict(body='#E2D59A', skin='#62A56A', head='#62A56A', leg='#62A56A', paw='#4E8A54',
                                 wrinkle='#4E8A54', beak='#9CD09A', shell='#6E5030', plate='#BC8C4C', plate2='#E0BA70',
                                 rim='#F0DCA0')),
        'young_f': dict(s=0.56, head_k=1.28, leg_k=0.90, body_l=0.80, eye_k=1.35, neck_k=0.8, dome=0.40,
                        col=dict(body='#EADFAA', skin='#6EB076', head='#6EB076', leg='#6EB076', paw='#5C9A62',
                                 wrinkle='#5C9A62', beak='#A8D8A6', shell='#4F6E38', plate='#93B458', plate2='#C8DC84',
                                 rim='#F5EAB2')),
    })

SPECIES['otter'] = dict(
    decor=otter_decor, view=1.35,
    dims=dict(leg_len=0.17, leg_w=0.13, leg_d=0.15, bw=0.40, bl=1.04, bh=0.34, BT=(1.0, 1.0), body_bevel=0.42,
              head=(0.40, 0.38, 0.30), head_at=(0.12, 0.20), head_fwd=0.55, eye=(0.12, 0.055),
              paw=(0.03, 0.05, 0.06, -0.02), leg_f=0.17, leg_h=0.15, lie_hp=0.07, eat=(6, 50), sleep=(32, 0.04)),
    col=dict(nose='#2E1E1A', whisker='#FFFFFF'),
    variants={
        'male':    dict(s=0.90, head_k=1.00, leg_k=1.0, body_l=1.00, eye_k=1.0, saddle=True,
                        col=dict(body='#7B5134', back='#573620', tail='#573620', pale='#EAD6B4', ear='#573620',
                                 ear_in='#C9A07A', paw='#4A2E1E')),
        'female':  dict(s=0.82, head_k=0.97, leg_k=1.0, body_l=1.00, eye_k=1.0,
                        col=dict(body='#9A6B41', tail='#9A6B41', pale='#F3E4C8', ear='#7B5134', ear_in='#E8B8A8',
                                 paw='#5E3C26')),
        'young_m': dict(s=0.56, head_k=1.30, leg_k=0.85, body_l=0.74, eye_k=1.3, saddle=True, tail=0.8,
                        col=dict(body='#A97C52', back='#86603E', tail='#86603E', pale='#F3E4C8', ear='#86603E',
                                 ear_in='#D9B48E', paw='#6E4C32')),
        'young_f': dict(s=0.56, head_k=1.30, leg_k=0.85, body_l=0.74, eye_k=1.3, tail=0.8, tip=True,
                        col=dict(body='#BC9063', tail='#BC9063', pale='#F8EDD8', ear='#A97C52', ear_in='#F0C2B4',
                                 paw='#86603E', tip='#F8EDD8')),
    })

SPECIES['beaver'] = dict(
    decor=beaver_decor,
    dims=dict(leg_len=0.17, leg_w=0.16, leg_d=0.17, bw=0.58, bl=0.78, bh=0.52, BT=(1.0, 1.0), body_bevel=0.42,
              head=(0.46, 0.38, 0.40), head_at=(0.14, 0.20), head_fwd=0.50, eye=(0.14, 0.085),
              paw=(0.03, 0.06, 0.05, -0.03), leg_in=0.03, leg_f=0.17, leg_h=0.16, leg_top=0.14, lie_hp=0.08,
              eat=(8, 50)),
    col=dict(tooth='#F39A1E', nose='#2E1E1A', tail='#3A322E', scale='#5E544E', paw='#3A2A22'),
    variants={
        'male':    dict(s=0.76, head_k=1.00, leg_k=1.0, body_l=1.00, eye_k=1.0,
                        col=dict(body='#8A5A32', muzzle='#B98A5C', ear='#5E3A1E', ear_in='#B98A5C')),
        'female':  dict(s=0.70, head_k=0.97, leg_k=1.0, body_l=1.00, eye_k=1.0, belly=True,
                        col=dict(body='#AC7742', muzzle='#DDB888', ear='#7A4E2A', ear_in='#E8B8A8', belly='#E3C79A')),
        'young_m': dict(s=0.47, head_k=1.28, leg_k=0.88, body_l=0.82, eye_k=1.3, tuft=True,
                        col=dict(body='#B58450', muzzle='#DDB888', ear='#7A4E2A', ear_in='#DDB888')),
        'young_f': dict(s=0.47, head_k=1.28, leg_k=0.88, body_l=0.82, eye_k=1.3, belly=True,
                        col=dict(body='#CB9C68', muzzle='#EBCFA6', ear='#A9743F', ear_in='#F0C2B4', belly='#F0DCB8')),
    })

SPECIES['koala'] = dict(
    decor=koala_decor,
    dims=dict(leg_len=0.24, leg_w=0.17, leg_d=0.18, bw=0.52, bl=0.66, bh=0.50, BT=(1.0, 1.0), body_bevel=0.42,
              head=(0.52, 0.40, 0.44), head_at=(0.30, 0.22), head_fwd=0.42, eye=(0.155, 0.07),
              paw=(0.02, 0.04, 0.07, -0.015), leg_f=0.16, leg_h=0.15, leg_top=0.12, lie_hp=0.08),
    col=dict(nose='#1F1B1D', paw='#4A4A52'),
    variants={
        'male':    dict(s=0.74, head_k=1.00, leg_k=1.0, body_l=1.00, eye_k=1.0, patch=True, saddle=True,
                        col=dict(body='#8C9098', back='#6C7078', pale='#F2F0EA', ear_in='#FFFFFF', patch='#8A5A3A',
                                 rump='#C2C5CA')),
        'female':  dict(s=0.68, head_k=0.97, leg_k=1.0, body_l=1.00, eye_k=1.0,
                        col=dict(body='#A3A7AE', pale='#FBFAF6', ear_in='#FFFFFF', rump='#CDD0D5')),
        'young_m': dict(s=0.45, head_k=1.26, leg_k=0.85, body_l=0.85, eye_k=1.25, tuft=True, saddle=True,
                        col=dict(body='#A9ADB4', back='#8A8E96', pale='#FBFAF6', ear_in='#FFFFFF', rump='#D2D5DA')),
        'young_f': dict(s=0.45, head_k=1.26, leg_k=0.85, body_l=0.85, eye_k=1.25,
                        col=dict(body='#BBBEC5', pale='#FFFFFF', ear_in='#F6C4CC', rump='#DCDFE3')),
    })

SPECIES['redpanda'] = dict(
    decor=redpanda_decor,
    dims=dict(leg_len=0.25, leg_w=0.14, leg_d=0.15, bw=0.44, bl=0.76, bh=0.40, BT=(1.0, 1.0), body_bevel=0.38,
              head=(0.48, 0.36, 0.40), head_at=(0.30, 0.25), head_fwd=0.42, eye=(0.12, 0.055),
              paw=(0.02, 0.04, 0.07, -0.015), lie_hp=0.07),
    col=dict(nose='#1E1614'),
    variants={
        'male':    dict(s=0.72, head_k=1.00, leg_k=1.0, body_l=1.00, eye_k=1.0,
                        col=dict(body='#BF4F28', head='#D0622E', dark='#33201C', leg='#33201C', paw='#241614',
                                 ear_in='#8A341A', tail='#E39A58', ring='#8A341A', tip='#33201C')),
        'female':  dict(s=0.66, head_k=0.97, leg_k=1.0, body_l=1.00, eye_k=1.0,
                        col=dict(body='#D86E34', head='#E38240', dark='#4A2C22', leg='#4A2C22', paw='#33201C',
                                 ear_in='#A8481E', tail='#F3C68C', ring='#A8481E', tip='#FBF0DC')),
        'young_m': dict(s=0.44, head_k=1.28, leg_k=0.85, body_l=0.80, eye_k=1.25, tail=0.8,
                        col=dict(body='#CC6634', head='#DA7840', dark='#4A2C22', leg='#4A2C22', paw='#33201C',
                                 ear_in='#9A4420', tail='#EEB478', ring='#9A4420', tip='#3E2418')),
        'young_f': dict(s=0.44, head_k=1.28, leg_k=0.85, body_l=0.80, eye_k=1.25, tail=0.8,
                        col=dict(body='#E08648', head='#EA9858', dark='#5E3A2C', leg='#5E3A2C', paw='#432A20',
                                 ear_in='#F0B8B0', tail='#F6D2A4', ring='#B8602E', tip='#FFFFFF')),
    })

SPECIES['lemur'] = dict(
    decor=lemur_decor,
    dims=dict(leg_len=0.32, leg_w=0.11, leg_d=0.12, bw=0.36, bl=0.64, bh=0.34, BT=(1.0, 1.0), body_bevel=0.36,
              head=(0.40, 0.34, 0.36), head_at=(0.38, 0.30), head_fwd=0.38, eye=(0.105, 0.035),
              paw=(0.02, 0.04, 0.06, -0.015), eat=(16, 84), tail_up=10),
    col=dict(eye='#F28A1E', pupil='#141416', patch='#1E1E22', muzzle='#26262A', lidline='#26262A', ring='#1E1E22',
             paw='#2E2E34', head='#F7F5F0', white='#F7F5F0'),
    variants={
        'male':    dict(s=0.70, head_k=1.00, leg_k=1.0, body_l=1.00, eye_k=1.15,
                        col=dict(body='#8A8B94', cap='#4E4F58', leg='#A0A1A9', ear_in='#4E4F58', tip='#1E1E22')),
        'female':  dict(s=0.64, head_k=0.97, leg_k=1.0, body_l=1.00, eye_k=1.15,
                        col=dict(body='#A99C90', cap='#7A6C62', leg='#BDB2A8', ear_in='#E8B8B0', tip='#1E1E22')),
        'young_m': dict(s=0.44, head_k=1.28, leg_k=0.82, body_l=0.82, eye_k=1.35, tail=0.78,
                        col=dict(body='#A2A3AB', cap='#62636C', leg='#B6B7BE', ear_in='#62636C', tip='#1E1E22')),
        'young_f': dict(s=0.44, head_k=1.28, leg_k=0.82, body_l=0.82, eye_k=1.35, tail=0.78,
                        col=dict(body='#BCB1A6', cap='#8E8177', leg='#CEC5BC', ear_in='#F2C0BA', tip='#F7F5F0')),
    })

for far_name in ('yak', 'bison', 'turtle', 'otter', 'beaver', 'koala', 'redpanda', 'lemur'):
    SPECIES[far_name]['build'] = far_build
