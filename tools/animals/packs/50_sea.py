"""Zee: dolfijn en orka.

Dit bestand draait in de module van build_animals.py (na 30_ice.py) en gebruikt dus alles wat daar staat.
Eigen namen beginnen met sea_ (behalve de <soort>_decor-functies).

Beide soorten bouwen via ice_build met ice_flipper in dims: hetzelfde vinnen-skelet en dezelfde
houdingen als de zeehond (buik op de grond, voorvinnen aan leg_FL/FR, achterlijf aan tail1).
Anders dan bij de zeehond:
  - het achterlijf is een lange, smalle staartwortel die iets omhoog loopt, zodat de staart nooit
    door de grond zakt (de houdingen tillen de staart alleen op, nooit omlaag);
  - aan tail2 hangt geen paar achtervinnen maar een platte, liggende staartvin (twee lobben);
  - op de rug staat een rugvin (aan het romp-bot).
Het skelet (tien botten) en de twaalf animatienamen blijven gelijk aan die van de andere dieren.
"""


# ---------------------------------------------------------------- hulpjes
def sea_turn(b, n, rz=0.0, rx=0.0, loc=(0, 0, 0)):
    """Alles wat sinds punt n is toegevoegd draait om de oorsprong (eerst om Z, dan om X) en gaat naar loc."""
    new = list(b.bm.verts)[n:]
    if rz:
        bmesh.ops.rotate(b.bm, cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(rz), 3, 'Z'), verts=new)
    if rx:
        bmesh.ops.rotate(b.bm, cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(rx), 3, 'X'), verts=new)
    bmesh.ops.translate(b.bm, vec=Vector(loc), verts=new)


def sea_fin(b, bone, col, base, h, L, th=0.07, lean=24, hook=22, split=0.6, tip=0.3):
    """Rugvin in twee stukken: het onderste leunt naar achteren (lean), de punt buigt verder door (hook).
    base is het midden van de voet, h de hoogte langs de vin, L de lengte van de voet."""
    B = Vector(base)
    a2 = lean + hook
    d1 = Vector((0, math.sin(math.radians(lean)), math.cos(math.radians(lean))))
    d2 = Vector((0, math.sin(math.radians(a2)), math.cos(math.radians(a2))))
    h1, h2 = h * split, h * (1 - split)
    mid = 1.0 - (1.0 - tip) * split   # hoe smal de vin is waar de twee stukken elkaar raken
    b.box(bone, col, (th, L, h1 + 0.05), B + d1 * (h1 / 2 - 0.025), rx=-lean, taper=(2, 1.0, mid), hard=True, seg=1)
    P = B + d1 * h1 + Vector((0, L * mid * 0.10, 0))
    b.box(bone, col, (th * mid, L * mid, h2 + 0.04), P + d2 * (h2 / 2 - 0.02), rx=-a2, taper=(2, 1.0, tip / mid),
          hard=True, seg=1)


def sea_flippers(c, col, reach, wide, stock, fluke, sweep=40, tipk=0.55, paddle=False, lift=8.0, thin=0.32,
                 spread=58, fluke_up=8.0, under=None):
    """Dolfijn en orka: de poten uit de kern weghalen en vinnen tekenen.
    Voorvinnen aan leg_FL/FR met het draaipunt in de schouder (puntig, of rond als peddel),
    een lange taps toelopende staartwortel aan tail1 waarvan de onderkant `lift` graden omhoog loopt,
    en een liggende staartvin van twee lobben aan tail2. De achterpoot-botten blijven leeg."""
    b = c.b
    ice_drop(c, ('leg_FL', 'leg_FR', 'leg_HL', 'leg_HR'))
    zb = c.bz - c.bh / 2
    fy = c.legs[0][2]
    Lb, th, tilt = reach + 0.09, 0.065, 12
    endk = 1.0 if paddle else tipk
    sz = Lb / 2 * math.sin(math.radians(tilt)) + th * endk / 2 + 0.006   # de punt rust net op de grond
    for sx, bone in ((1, 'leg_FL'), (-1, 'leg_FR')):
        S = Vector((sx * (c.bw / 2 - 0.03), fy, sz))
        pre = (sx * (Lb / 2 - 0.09), 0, 0)
        if paddle:
            ice_rz(b, sx * sweep, S, b.band, bone, col, (Lb, wide, th), pre=pre, bev=wide * 0.42, axis=2, ry=sx * tilt)
        else:
            ice_rz(b, sx * sweep, S, b.box, bone, col, (Lb, wide, th), pre=pre, ry=sx * tilt,
                   taper=(0, 1.0, tipk) if sx > 0 else (0, tipk, 1.0), hard=True)
        c.piv[bone] = S + Vector((0, 0, 0.02))
    for sx, bone in ((1, 'leg_HL'), (-1, 'leg_HR')):
        c.piv[bone] = Vector((sx * 0.1, c.legs[2][2], zb + 0.08))

    # staartwortel: begint in de romp en loopt taps toe; de onderkant komt langzaam van de grond
    w0, h0 = c.bw * 0.90, c.bh * 0.90
    L0, y0 = stock + 0.09, c.back - 0.09

    def wedge(color, w, h, z0, frac=1.0):
        """Taps stuk vanaf de romp; frac < 1 houdt eerder op, met dezelfde versmalling per meter."""
        L, k1 = L0 * frac, 1 - (1 - thin) * frac
        a = math.radians(lift) - math.atan2(h * (1 - k1) / 2, L)
        u = Vector((0, math.cos(a), math.sin(a)))
        root = Vector((0, y0, z0 + h / 2))
        b.box('tail1', color, (w, L, h), root + u * (L / 2), rx=math.degrees(a), taper=(1, 1.0, k1), hard=True)
        return root + u * L, u

    end, u = wedge(c.C['body'], w0, h0, zb + 0.004)
    if under:   # lichte onderkant: een platte wig die net naast de staartwortel uitsteekt en voor de staartvin ophoudt
        wedge(under, w0 + 0.016, h0 * 0.34, zb + 0.001, frac=0.78)
    c.piv['tail1'] = Vector((0, c.back - 0.03, zb + h0 * 0.4))
    c.piv['tail2'] = end - u * 0.09

    # staartvin: twee platte lobben die schuin naar achteren wijzen, met een inkeping ertussen
    fl_len, fl_w = fluke
    base = end - u * 0.07
    for sx in (1, -1):
        n = len(b.bm.verts)
        b.box('tail2', col, (fl_w, fl_len, 0.055), (0, fl_len / 2 - 0.05, 0), taper=(1, 1.0, 0.42), hard=True, seg=1)
        sea_turn(b, n, rz=-sx * spread, rx=fluke_up, loc=base + Vector((sx * 0.02, 0, 0)))
    return SimpleNamespace(zb=zb, w0=w0, h0=h0, end=end, u=u, stock=stock)


def sea_icon(c):
    """Kopplaatje (modus icons): render_icons houdt alleen over wat aan het kop-bot hangt, en een kop zonder
    rugvin lijkt weinig op een dolfijn of orka. Alleen voor dat plaatje gaan romp en rugvin daarom mee aan
    het kop-bot (net als het schild van de schildpad); staart en voorvinnen blijven buiten beeld.
    In de modellen voor het spel verandert er niets."""
    if globals().get('mode') != 'icons':
        return
    bm = c.b.bm
    dv = bm.verts.layers.deform.verify()
    bi, hi = BONES.index('body'), BONES.index('head')
    for v in bm.verts:
        if bi in v[dv]:
            del v[dv][bi]
            v[dv][hi] = 1.0
    # de kern meet de romp op aan het romp-bot: een blokje binnenin houdt die maat geldig
    c.b.box('body', c.C['body'], (0.02, 0.02, 0.02), (0, 0, c.bz), bevel=0)


def sea_chin(c, col, frac=0.30):
    """Lichte keel: schil om de onderste strook van de kop (tegenhanger van belly voor de romp)."""
    bev = min(c.hw, c.hl, c.hh) * (c.D.get('head_bevel') or 0.3)
    c.b.band('head', col, (c.hw + 0.014, c.hl - 2 * bev + 0.05, c.hh + 0.014), (0, c.hcy, c.hz), bev,
             cut=(2, -c.hh / 2 + c.hh * frac, 1))


# ---------------------------------------------------------------- dolfijn
def dolphin_decor(c):
    b, C, P, k = c.b, c.C, c.P, c.k
    hcy, hz, hh, hw, hl, face, bz, bh, bw = c.hcy, c.hz, c.hh, c.hw, c.hl, c.face, c.bz, c.bh, c.bw
    f = c.bl / 0.78
    belly(c, C['belly'], 0.36)
    sea_chin(c, C['belly'], 0.30)
    if P.get('cape'):   # donkere rug en kruin
        ice_saddle(c, C['cape'], 0.20)
        b.box('head', C['cape'], (hw * 0.52, hl * 0.62, 0.02 * k), (0, hcy + 0.04 * k, hz + hh / 2 - 0.002 * k), seg=1)
    # snavel: bovenkaak in de kleur van de rug, lichte onderkaak die iets korter is (dat geeft de glimlach)
    b.box('head', C['body'], (0.19 * k, 0.30 * k, 0.075 * k), (0, face - 0.11 * k, hz - 0.066 * k),
          taper=(1, 0.68, 1.0), hard=True)
    b.box('head', C['belly'], (0.175 * k, 0.28 * k, 0.055 * k), (0, face - 0.095 * k, hz - 0.122 * k),
          taper=(1, 0.68, 1.0), hard=True)
    # spuitgat boven op de kop
    b.box('head', C['flip'], (0.055 * k, 0.045 * k, 0.014 * k), (0, hcy + 0.07 * k, hz + hh / 2), bevel=0)
    if P.get('cheeks'):   # vrouwtje: blosjes
        for sx in (1, -1):
            b.box('head', C['cheek'], (0.07 * k, 0.02 * k, 0.045 * k), (sx * 0.14 * k, face - 0.002 * k, hz - 0.045 * k), seg=1)
    sea_flippers(c, C['flip'], reach=0.28, wide=0.15, stock=0.44 * (0.4 + 0.6 * P['body_l']), fluke=(0.36, 0.22),
                 sweep=42, tipk=0.55, lift=12, fluke_up=12, under=C['belly'])
    # gebogen rugvin midden op de rug
    sea_fin(b, 'body', C['flip'], (0, 0.03 * f, bz + bh / 2 - 0.03), P.get('fin', 0.25), 0.27, th=0.07,
            lean=26, hook=24)
    sea_icon(c)


# ---------------------------------------------------------------- orka
def orca_decor(c):
    b, C, P, k = c.b, c.C, c.P, c.k
    hcy, hz, hh, hw, hl, face, bz, bh, bw = c.hcy, c.hz, c.hh, c.hw, c.hl, c.face, c.bz, c.bh, c.bw
    f = c.bl / 0.90
    white = C['belly']
    wild_eye(c, lid=C['body'])
    belly(c, white, 0.40)
    sea_chin(c, white, 0.30)
    # ronde stompe snuit zonder snavel, met een witte onderkaak
    b.box('head', C['body'], (0.36 * k, 0.16 * k, 0.19 * k), (0, face - 0.02 * k, hz - 0.085 * k), bevel=0.45)
    b.box('head', white, (0.34 * k, 0.15 * k, 0.10 * k), (0, face - 0.018 * k, hz - 0.180 * k), bevel=0.4)
    for sx in (1, -1):
        # witte ovale vlek achter en boven elk oog, op de zijkant van de kop
        b.band('head', white, (0.03 * k, 0.17 * k, 0.095 * k), (sx * (hw / 2 - 0.009 * k), face + 0.23 * k, hz + 0.045 * k),
               0.045 * k, axis=0, rx=8)
        # witte flankvlek: loopt achteraan vanuit de buik schuin omhoog
        b.band('body', white, (0.05, 0.22 * f, 0.13), (sx * (bw / 2 - 0.018), c.back - 0.31 * f, bz - 0.005),
               0.06, axis=0, rx=14)
    fin_y = -0.05 * f
    # zadelvlek: lichte band over de rug vlak achter de rugvin
    ice_saddle(c, C['saddle'], 0.17, y=fin_y + 0.27 * f, length=0.15 * f)
    sea_flippers(c, C['flip'], reach=0.36, wide=0.25, stock=0.42 * (0.4 + 0.6 * P['body_l']), fluke=(0.43, 0.28),
                 sweep=30, paddle=True, lift=12, fluke_up=12, spread=60, under=white)
    # rugvin: bij het mannetje hoog en recht, bij vrouwtje en jongen korter en gebogen
    sea_fin(b, 'body', C['flip'], (0, fin_y, bz + bh / 2 - 0.03), P.get('fin', 0.30), P.get('fin_l', 0.30), th=0.08,
            lean=P.get('lean', 20), hook=P.get('hook', 22))
    sea_icon(c)


# ---------------------------------------------------------------- recepten
# s is de maat tegenover het leeuwenmannetje (1.00). Net als zeehond en walrus zijn ze laag maar lang;
# de rugvin telt mee in de hoogte. De orka is duidelijk groter en dikker dan de dolfijn.
SPECIES['dolphin'] = dict(
    decor=dolphin_decor, build=ice_build,
    dims=dict(leg_len=0.055, leg_w=0.10, leg_d=0.10, bw=0.42, bl=0.78, bh=0.38, BT=(1.0, 1.0), body_bevel=0.38,
              head=(0.40, 0.38, 0.35), head_at=(0.04, 0.10), head_fwd=0.22, head_bevel=0.36, eye=(0.125, 0.055),
              leg_f=0.22, leg_h=0.05, lie_hp=0.2, eat=(0, 80), sleep=(60, 0.0), tail_up=30, ice_flipper=0.28),
    col=dict(cheek='#F0A9A6'),
    variants={
        'male':    dict(s=0.95, head_k=1.00, leg_k=1.0, body_l=1.00, eye_k=1.3, cape=True, fin=0.28,
                        col=dict(body='#6F8DA6', cape='#587489', belly='#DCE7EE', flip='#506C82')),
        'female':  dict(s=0.88, head_k=0.97, leg_k=1.0, body_l=1.00, eye_k=1.3, cheeks=True, fin=0.25,
                        col=dict(body='#93AFC4', belly='#EEF4F7', flip='#7391A8')),
        'young_m': dict(s=0.58, head_k=1.26, leg_k=1.0, body_l=0.80, eye_k=1.5, cape=True, fin=0.17,
                        col=dict(body='#7F9DB5', cape='#688499', belly='#E4EDF2', flip='#607C92')),
        'young_f': dict(s=0.58, head_k=1.26, leg_k=1.0, body_l=0.80, eye_k=1.5, cheeks=True, fin=0.17,
                        col=dict(body='#A5BFD1', belly='#F2F7F9', flip='#84A1B6')),
    })
SPECIES['orca'] = dict(
    decor=orca_decor, build=ice_build, view=1.15,
    dims=dict(leg_len=0.055, leg_w=0.10, leg_d=0.10, bw=0.60, bl=0.90, bh=0.52, BT=(1.0, 1.0), body_bevel=0.36,
              head=(0.56, 0.46, 0.47), head_at=(-0.06, 0.16), head_fwd=0.24, eye=(0.165, 0.05),
              eye_white=True, leg_f=0.26, leg_h=0.05, lie_hp=0.2, eat=(0, 80), sleep=(60, 0.0), tail_up=28,
              ice_flipper=0.36),
    col=dict(lidline='#6A727C'),
    variants={
        'male':    dict(s=1.30, head_k=1.00, leg_k=1.0, body_l=1.00, eye_k=1.25, fin=0.50, fin_l=0.30, lean=10, hook=10,
                        col=dict(body='#23272E', belly='#F4F6F6', saddle='#C9D0D6', flip='#1A1D23')),
        'female':  dict(s=1.18, head_k=0.97, leg_k=1.0, body_l=1.00, eye_k=1.25, fin=0.30, fin_l=0.30, lean=22, hook=26,
                        col=dict(body='#30353D', belly='#F8F9F8', saddle='#D6DCE0', flip='#262A31')),
        'young_m': dict(s=0.76, head_k=1.24, leg_k=1.0, body_l=0.80, eye_k=1.45, fin=0.20, fin_l=0.24, lean=22, hook=24,
                        col=dict(body='#292D35', belly='#F6ECD6', saddle='#C4C2B8', flip='#1F2229')),
        'young_f': dict(s=0.76, head_k=1.24, leg_k=1.0, body_l=0.80, eye_k=1.45, fin=0.20, fin_l=0.24, lean=22, hook=24,
                        col=dict(body='#383D46', belly='#FAF2E0', saddle='#D2D0C6', flip='#2C3038')),
    })
