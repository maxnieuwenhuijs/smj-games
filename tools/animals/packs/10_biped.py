"""Tweevoeters: tien vogels en de kangoeroe op hetzelfde skelet als de viervoeters.

Zelfde tien botten met dezelfde namen en ouders, zelfde twaalf animaties:
  leg_HL / leg_HR  de twee poten (links is +X), draaipunt in de heup
  leg_FL / leg_FR  de vleugels (bij de kangoeroe de armen), draaipunt in de schouder
  tail1 / tail2    de staart
  head             kop, nek, snavel en kam;  lids = oogleden (verstopt in de kop, schuiven naar voren)

Het draaipunt van de romp ligt in de heup. Kantelt de romp, dan blijven de voeten dus staan.
Elke houding gaat door bip_fix: die rekent met de echte punten van het model uit waar het laagste
punt zit en zet het dier precies op de grond. Niets zakt daardoor onder z = 0. De sleutelbeelden
krijgen rechte lijnen ertussen (bip_linear), zodat dat ook tussen twee sleutelbeelden blijft kloppen.

Een poot is een enkel bot zonder knie. Zakken gaat daarom zo: de poot schuift de romp in (hurken,
zitten, liggen) en wat niet past draait naar voren. Lange poten liggen bij zitten en liggen dus
gestrekt naar voren. Vogels zonder nek (uil, pinguin) kiepen bij het eten voorover tot op de borst.

Controleren (alle namen van dit pakket beginnen met bip_):
  blender --background --python tools/animals/build_animals.py -- out/biped check chicken duck
  BIP_DEBUG=1 ... info chicken    toont de vaste hoeken (eten, slapen, verdriet) en het laagste punt in rust
  BIP_DEBUG=2 ... info chicken    toont ook per animatie het laagste punt en de hoogte van de voeten
"""
import numpy as bip_np

BIP_LEGS = ('leg_HL', 'leg_HR')
BIP_WINGS = ('leg_FL', 'leg_FR')
BIP_BODY = ('body',) + BIP_WINGS
BIP_CORE = BIP_LEGS + BIP_BODY
BIP_TAIL = ('tail1', 'tail2')
BIP_ALL = BIP_CORE + ('head',) + BIP_TAIL
BIP_DEBUG = os.environ.get('BIP_DEBUG', '')   # 1: vaste hoeken tonen, 2: ook per animatie het laagste punt

# houdingen: standaardwaarden, per soort bij te stellen met dims['pose']
BIP_POSE = dict(
    walk=24, run=38, run_pitch=12, run_wing=14, run_air=0.03, waddle=0.0, slide=0.0, bob=0.035, yaw=3.0,
    eat_pitch=25, eat_max=66, peck=14, eat_wing=0.0, eat_arm=0.0,
    sit_pitch=-14, sit_head=None, sit_toes=0.0, lie_pitch=4, lie_head=6, lie_legs='fold', lie=None,
    sleep_max=44, sleep_tilt=10, tuck=None, sad_max=36, sad_tail=-18, hop=0.22,
    poop_pitch=-12, pee_pitch=-5, squat=0.3, tail_up=45, wag=1.0, flap=1.0, look=12)


# ---------------------------------------------------------------- rekenen met het skelet
def bip_rot(d):
    rx, ry, rz = (math.radians(d.get(key, 0.0)) for key in ('rx', 'ry', 'rz'))
    cx, sx, cy, sy, cz, sz = math.cos(rx), math.sin(rx), math.cos(ry), math.sin(ry), math.cos(rz), math.sin(rz)
    Rx = bip_np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    Ry = bip_np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    Rz = bip_np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return Rz @ Ry @ Rx


def bip_fk(G, pose):
    """Per bot (A, t): een punt p van het model komt in deze houding op A p + t (zelfde regels als apply_pose)."""
    M, s, out = G['bip'], G['s'], {}
    for bn in BONES:
        d = pose.get(bn) or {}
        R = bip_rot(d)
        piv = M['piv'][bn]
        t = piv + bip_np.array(d.get('loc', (0.0, 0.0, 0.0)), dtype=float) * s - R @ piv
        if PARENT[bn]:
            A0, t0 = out[PARENT[bn]]
            R, t = A0 @ R, A0 @ t + t0
        out[bn] = (R, t)
    return out


def bip_low(G, pose, bones):
    """Laagste punt (in modelmaat, dus geschaald) van de onderdelen aan deze botten."""
    fk, lo = bip_fk(G, pose), 1e9
    for bn in bones:
        pts = G['bip']['pts'][bn]
        if len(pts):
            A, t = fk[bn]
            lo = min(lo, float((pts @ A[2]).min() + t[2]))
    return lo


def bip_fix(G, pose, ground=BIP_CORE, hop=0.0, settle=True):
    """Zet het dier op de grond: het laagste punt van `ground` komt op z = 0. Daarna gaan staart
    en kop zo nodig omhoog tot ze boven de grond zijn; een staart die op de grond hoort te rusten
    (kangoeroe) zakt juist tot hij de grond raakt. hop tilt het dier daarna op (springen)."""
    M, s = G['bip'], G['s']
    body = pose.setdefault('body', {})
    z = bip_low(G, pose, ground) / s
    loc = body.get('loc', (0.0, 0.0, 0.0))
    body['loc'] = (loc[0], loc[1], loc[2] - z)
    t1 = pose.setdefault('tail1', {})
    if M['tail_rest']:   # zo'n staart kantelt niet mee met de romp
        t1['rx'] = t1.get('rx', 0.0) - body.get('rx', 0.0)
    bip_touch(G, pose, 'tail1', BIP_TAIL, 1, M['tail_rest'] and settle and hop <= 1e-6)
    bip_touch(G, pose, 'head', ('head',), -1, False)
    if hop:
        loc = body['loc']
        body['loc'] = (loc[0], loc[1], loc[2] + hop)
    return pose


def bip_touch(G, pose, bone, bones, up, rest):
    """Draait `bone` om de dwars-as tot de onderdelen `bones` niet meer door de grond gaan maar er
    net op liggen (up = draairichting waarin ze stijgen). Met rest=True zakken ze ook als ze zweven.
    In kleine stappen heen en terug, zodat de uitkomst van beeld tot beeld vloeiend verloopt."""
    s, d = G['s'], pose.setdefault(bone, {})
    lo = bip_low(G, pose, bones) / s
    if lo >= -0.002 and not (rest and lo > 0.006):
        return
    start, step, last = d.get('rx', 0.0), 4.0, 0
    for _ in range(40):
        if lo < -0.002:
            way = 1
        elif lo > 0.006:
            way = -1
        else:
            break
        if way == -last:
            step *= 0.5
        d['rx'] = d.get('rx', 0.0) + up * way * step
        if abs(d['rx'] - start) > 100:
            break
        last = way
        lo = bip_low(G, pose, bones) / s


def bip_fold(M, hp, pitch=0.0):
    """Poten bij een heup op hoogte hp. Zakt de romp, dan schuiven de poten eerst recht omhoog de
    romp in (voeten blijven plat staan); wat dan nog over is draait naar voren, met het bovenste
    stuk schuin naar achteren de romp in. Stijgt de heup (voorover kiepen), dan schuiven ze uit."""
    L = M['L']
    if hp >= L:
        a, w = 0.0, (0.0, -min(hp - L, M['ext']))
    else:
        u = min(L - hp, M['hide'])
        if L - hp - u < 0.004:
            a, w = 0.0, (0.0, L - hp)
        else:
            ua = min(M['hide_a'], L * 0.5)
            for _ in range(8):   # het bovenste stuk van de poot mag niet boven uit de rug steken
                a = math.acos(max(0.0, min(1.0, (hp + u) / (L - ua))))
                over = u + (ua + M['ltop']) * math.cos(a) - (M['hide'] + M['ltop'])
                if over <= 1e-4:
                    break
                u = max(0.0, u - over)
            w = (ua * math.sin(a), u + ua * math.cos(a))
    th = math.radians(-pitch)   # verplaatsing omrekenen naar het (gekantelde) stelsel van de romp
    loc = (0.0, w[0] * math.cos(th) - w[1] * math.sin(th), w[0] * math.sin(th) + w[1] * math.cos(th))
    return {'rx': -math.degrees(a) - pitch, 'loc': loc}


def bip_rest(G, pitch, legs='fold', max_drop=None):
    """Rusten: romp gekanteld en zo laag dat hij op de grond ligt, poten opgevouwen."""
    M = G['bip']
    key = (pitch, legs, max_drop)
    if key not in M['rest']:
        L = M['L']
        low = bip_low(G, {'body': {'rx': pitch}}, BIP_BODY) / G['s']
        hp = L - low
        if max_drop is not None:
            hp = max(hp, L - max_drop)
        lp = {'rx': M['trail']} if legs == 'trail' else bip_fold(M, hp, pitch)
        M['rest'][key] = {'body': {'rx': pitch, 'loc': (0.0, 0.0, hp - L)}, 'leg_HL': lp, 'leg_HR': dict(lp)}
    return M['rest'][key]


def bip_eat_pose(G, p, a):
    """Eten: romp kiept p graden voorover om de heupen, kop nog eens a graden."""
    M = G['bip']
    key = ('eat', p)
    if key not in M['rest']:
        low = bip_low(G, {'body': {'rx': p}}, BIP_BODY) / G['s']
        rise = max(0.0, -low)   # zo ver komt de heup omhoog als de buik de grond raakt
        if rise <= M['ext'] + 0.002:
            lp = bip_fold(M, M['L'] + rise, p)
        else:   # ligt op de buik: poten steken naar achteren
            lp = {'rx': M['trail']}
        M['rest'][key] = {'body': {'rx': p, 'loc': (0.0, 0.0, rise)}, 'leg_HL': lp, 'leg_HR': dict(lp)}
    return merge(M['rest'][key], {'head': {'rx': a}})


def bip_solve_eat(G):
    """Kleinste kanteling van de romp waarbij de snavel de grond haalt, en de hoek van de kop erbij."""
    M, s = G['bip'], G['s']
    A = M['A']
    best = (A['eat_pitch'], 0.0)
    for p in range(int(A['eat_pitch']), 91, 5):
        base = bip_eat_pose(G, p, 0.0)
        z0 = bip_low(G, base, BIP_CORE)
        prev = None
        for a in range(-40, int(A['eat_max']) + 1, 2):
            base['head']['rx'] = float(a)
            lo = (bip_low(G, base, ('head',)) - z0) / s
            if lo < 0.0:
                if prev is None:
                    return p, float(a)
                a0, a1 = prev[0], float(a)   # verfijnen tot de snavel precies raakt
                for _ in range(8):
                    am = (a0 + a1) / 2
                    base['head']['rx'] = am
                    if (bip_low(G, base, ('head',)) - z0) / s < 0.0:
                        a1 = am
                    else:
                        a0 = am
                return p, a0
            prev = (float(a), lo)
        if prev:
            best = (p, prev[0])
    return best


def bip_solve_head(G, pose, a0, a1, ground):
    """Grootste hoek van de kop tussen a0 en a1 waarbij de kop nog boven de grond blijft."""
    pose = merge(pose, {'head': {}})
    z0 = bip_low(G, pose, ground)
    best = a0
    a = a0
    while a <= a1 + 1e-6:
        pose['head']['rx'] = a
        if (bip_low(G, pose, ('head',)) - z0) / G['s'] < 0.0:
            break
        best = a
        a += 2.0
    return best


# ---------------------------------------------------------------- houdingen
def bip_linear(G):
    """make_actions vraagt per sleutelbeeld een houding op. Hier krijgt het sleutelbeeld dat er net is
    neergezet rechte lijnen naar het volgende (Blender maakt er anders vloeiende bochten van, per kanaal
    verschillend). Dan klopt tussen twee sleutelbeelden ook wat op de beelden zelf klopt: voeten op de
    grond, niets erdoor. Bij plaatjes is er geen animatie en gebeurt er niets."""
    try:
        ad = G['bip']['rig'].animation_data
        act = ad.action if ad else None
        if not act:
            return
        try:      # Blender 4.4 en later: lagen met kanalenbakken
            curves = [fc for layer in act.layers for strip in layer.strips for bag in strip.channelbags
                      for fc in bag.fcurves]
        except AttributeError:
            curves = list(act.fcurves)
        for fc in curves:
            if len(fc.keyframe_points):
                fc.keyframe_points[-1].interpolation = 'LINEAR'
    except (ReferenceError, KeyError, AttributeError):
        pass


def bip_pose(name, t, G):
    """Houding op lus-moment t (0..1), zelfde soort antwoord als anim_pose."""
    bip_linear(G)
    M = G['bip']
    A, L = M['A'], M['L']
    w = 2 * math.pi * t
    sn, cs = math.sin(w), math.cos(w)

    def tail(a1=10, a2=14, up=0.0, speed=1):
        return {'tail1': {'rz': a1 * A['wag'] * math.sin(speed * w), 'rx': up},
                'tail2': {'rz': a2 * A['wag'] * math.sin(speed * w - 0.9)}}

    def lids(closed):
        return {'lids': {'loc': (0, -M['lid_slide'] * closed, 0)}}

    def wings(out=0.0, fwd=0.0, drop=0.0):
        out *= A['flap']
        if M['arms']:   # armen zwaaien vooral naar voren
            out, fwd = out * 0.3, fwd + out * 0.7
        return {'leg_FL': {'ry': -out, 'rx': -fwd, 'loc': (0, 0, -drop)},
                'leg_FR': {'ry': out, 'rx': -fwd, 'loc': (0, 0, -drop)}}

    def squat(drop, pitch):
        lp = bip_fold(M, L - drop, pitch)
        return {'body': {'rx': pitch, 'loc': (0, 0, -drop)}, 'leg_HL': lp, 'leg_HR': dict(lp)}

    def hopping(n, height, pitch, swing, tail_amp):
        """Kangoeroe: beide poten tegelijk. Eerste helft van elke sprong in de lucht, tweede helft veren."""
        ph = 2 * math.pi * ((t * n) % 1.0)
        sp = round(math.sin(ph), 9)   # afgerond, zodat begin en eind van de lus precies gelijk zijn
        air, crouch = max(0.0, sp), max(0.0, -sp)
        p = pitch + 6 * air - 3 * crouch
        th = swing * math.sin(2 * ph) if air > 0 else 0.0     # eerst achter, dan naar voren, plat landen
        lp = bip_fold(M, L - min(M['hide'], 0.08) * crouch, p)
        lp['rx'] += th
        pose = merge({'body': {'rx': p}, 'leg_HL': lp, 'leg_HR': dict(lp)}, wings(0, 12 + 14 * air),
                     {'head': {'rx': -p * 0.75},
                      'tail1': {'rx': tail_amp * (air - 0.5 * crouch)}, 'tail2': {'rx': tail_amp * 0.6 * air}})
        return bip_fix(G, pose, hop=height * air)

    blink = lids(1.0 if 0.60 <= t < 0.65 else 0.0)
    roll = -A['waddle'] * cs   # waggelen: romp helt naar de poot die staat

    if name == 'Idle':
        return bip_fix(G, merge(tail(10, 14), blink, wings(1.5 + 1.5 * math.sin(2 * w)),
                                {'head': {'rz': A['look'] * sn, 'ry': 4 * math.sin(2 * w), 'rx': 2 * sn}}))
    if name == 'Walk':
        if M['hops']:
            return hopping(2, A['hop'] * 0.4, 8, 10, 8)
        th = A['walk'] * sn
        pose = merge(tail(8, 12), wings(2 + 2 * abs(sn)),
                     {'body': {'rz': A['yaw'] * sn, 'ry': roll},
                      'head': {'loc': (0, A['bob'] * math.sin(2 * w), 0), 'rx': 3 * math.cos(2 * w),
                               'rz': -A['yaw'] * sn, 'ry': -roll * 0.8},
                      'leg_HL': {'rx': -th, 'ry': -roll, 'loc': (0, -A['slide'] * sn, M['step'] * max(0.0, cs))},
                      'leg_HR': {'rx': th, 'ry': -roll, 'loc': (0, A['slide'] * sn, M['step'] * max(0.0, -cs))}})
        return bip_fix(G, pose)
    if name == 'Run':
        if M['hops']:
            return hopping(1, A['hop'] * 1.5, 20, 26, 16)
        th, p = A['run'] * sn, A['run_pitch']
        lift = min(M['step'] * 1.6, M['hide'])
        pose = merge(tail(6, 10, up=8), wings(A['run_wing'] + 8 * math.sin(2 * w)),
                     {'body': {'rx': p, 'rz': A['yaw'] * 1.3 * sn, 'ry': roll * 1.2},
                      'head': {'loc': (0, A['bob'] * math.sin(2 * w), 0), 'rx': -p * 0.8 + 4 * math.cos(2 * w),
                               'ry': -roll},
                      'leg_HL': {'rx': -th - p, 'ry': -roll * 1.2, 'loc': (0, -A['slide'] * sn, lift * max(0.0, cs))},
                      'leg_HR': {'rx': th - p, 'ry': -roll * 1.2, 'loc': (0, A['slide'] * sn, lift * max(0.0, -cs))}})
        return bip_fix(G, pose, hop=A['run_air'] * (0.5 - 0.5 * math.cos(2 * w)))
    if name == 'Eat':
        a = M['eat_a'] - A['peck'] * (0.5 - 0.5 * math.sin(3 * w))
        pose = merge(bip_eat_pose(G, M['eat_p'], a), tail(8, 12), wings(A['eat_wing'], A['eat_arm']))
        return bip_fix(G, pose, ground=BIP_CORE)
    if name == 'Sit':
        p = A['sit_pitch']
        hr = -p * 0.8 if A['sit_head'] is None else A['sit_head']
        pose = merge(bip_rest(G, p, max_drop=M['max_drop']), tail(8, 12), blink, wings(0),
                     {'head': {'rx': hr + 2 * sn, 'rz': 10 * sn}})
        for bn in BIP_LEGS:   # op de billen met de tenen omhoog (pinguin)
            pose[bn]['rx'] -= A['sit_toes']
        return bip_fix(G, pose, ground=BIP_CORE)
    if name in ('Lie', 'Sleep'):
        asleep = name == 'Sleep'
        breath = 0.008 * (0.5 + 0.5 * sn) if asleep else 0.0
        if A['lie'] == 'side':   # kangoeroe: op de zij
            r = A['side_roll']
            hr = -r * 0.12 + 2 * sn if asleep else -r * 0.72 + 3 * sn
            pose = merge(lids(1.0) if asleep else blink,
                         {'body': {'ry': r},
                          'head': {'ry': hr, 'rz': 0.0 if asleep else 8 * sn, 'rx': 8 if asleep else 0},
                          'leg_HL': {'rx': -30}, 'leg_HR': {'rx': -12},
                          'leg_FL': {'rx': -30}, 'leg_FR': {'rx': 10},
                          'tail1': {'rz': M['side_tail']}})
            return bip_fix(G, pose, ground=BIP_ALL, hop=breath, settle=False)
        base = bip_rest(G, A['lie_pitch'], A['lie_legs'], M['max_drop'])
        if asleep:
            if A['tuck']:   # kop achterstevoren op de rug, snavel in de veren
                head = {'rx': A['tuck'][0] + 1.5 * sn, 'rz': A['tuck'][1]}
            else:           # kop hangt naar voren, zo ver als de grond toelaat
                head = {'rx': M['sleep_a'] + 2 * sn, 'ry': A['sleep_tilt']}
            pose = merge(base, lids(1.0), wings(0),
                         {'head': head, 'tail1': {'rz': 10 * A['wag']}, 'tail2': {'rz': 12 * A['wag']}})
        else:
            pose = merge(base, tail(8, 12), blink, wings(0),
                         {'head': {'rx': A['lie_head'] + 2 * math.sin(2 * w), 'rz': 10 * sn}})
        return bip_fix(G, pose, ground=BIP_CORE, hop=breath)
    if name == 'Poop':
        squeeze = lids(1.0 if 0.30 <= t < 0.62 else 0.0)
        p = A['poop_pitch']
        pose = merge(squat(M['squat'], p), squeeze, wings(8),
                     {'body': {'rz': 1.5 * math.sin(6 * w)}, 'head': {'rx': -p * 0.5 - 4},
                      'tail1': {'rx': A['tail_up']}, 'tail2': {'rx': A['tail_up'] * 0.25}})
        return bip_fix(G, pose, ground=BIP_CORE, settle=False)
    if name == 'Pee':
        p = A['pee_pitch']
        wig = math.sin(4 * w)
        pose = merge(squat(M['squat'] * 0.5, p), blink, wings(4),
                     {'body': {'rz': 4 * wig, 'ry': 2.5 * wig}, 'head': {'rx': -p * 0.5, 'rz': 10 + 3 * sn - 4 * wig},
                      'tail1': {'rx': A['tail_up'] * 0.5, 'rz': 8 * A['wag'] * wig}})
        return bip_fix(G, pose, ground=BIP_CORE, settle=False)
    if name == 'Play':
        if t < 0.5:   # buiging met klapperende vleugels
            bw = math.sin(2 * w)
            lp = {'rx': -14 * bw}
            pose = merge({'body': {'rx': 14 * bw}, 'leg_HL': lp, 'leg_HR': dict(lp)},
                         wings(34 + 28 * math.sin(8 * w)), tail(20, 24, up=A['tail_up'] * 0.4 * max(0.0, bw), speed=6),
                         {'head': {'rx': -16 * bw, 'ry': 8 * bw}})
            return bip_fix(G, pose, ground=BIP_CORE)
        j = max(0.0, math.sin(2 * math.pi * (t - 0.5)))
        pose = merge({'body': {'rx': -8 * j}, 'leg_HL': {'rx': -22 * j + 8 * j}, 'leg_HR': {'rx': 22 * j + 8 * j}},
                     wings(34 + j * (30 + 22 * math.sin(8 * w))), tail(20, 24, up=A['tail_up'] * 0.4 * j, speed=6),
                     {'head': {'rx': 8 * j}})
        return bip_fix(G, pose, hop=A['hop'] * j)
    if name == 'Happy':
        hop = abs(math.sin(2 * w))
        pose = merge({'leg_HL': {'rx': -12 * hop}, 'leg_HR': {'rx': 12 * hop}},
                     wings(52 + 18 * math.sin(4 * w)), tail(24, 28, up=A['tail_up'] * 0.4, speed=4),
                     {'head': {'rx': -12, 'ry': 8 * sn}})
        return bip_fix(G, pose, hop=A['hop'] * 0.7 * hop)
    if name == 'Sad':
        lp = {'rx': -6}
        pose = merge({'body': {'rx': 6, 'ry': 1.5 * sn}, 'leg_HL': lp, 'leg_HR': dict(lp)}, wings(9, drop=0.03),
                     {'head': {'rx': M['sad_a'], 'rz': 6 * sn},
                      'tail1': {'rx': A['sad_tail']}, 'tail2': {'rx': A['sad_tail'] * 0.5}})
        return bip_fix(G, pose)
    return {}


def bip_check(G, name):
    s = G['s']
    for an, n, step in ANIMS:
        lo_all, lo_feet, hi_feet = 1e9, 1e9, -1e9
        for f in range(0, n + 1, step):
            pose = bip_pose(an, f / n, G)
            lo_all = min(lo_all, bip_low(G, pose, BIP_ALL))
            fz = bip_low(G, pose, BIP_LEGS)
            lo_feet, hi_feet = min(lo_feet, fz), max(hi_feet, fz)
        print('BIPCHK %s %-5s laagste=%.3f voeten=%.3f..%.3f' % (name, an, lo_all / s, lo_feet / s, hi_feet / s))


# ---------------------------------------------------------------- onderdelen
def bip_foot(b, bone, C, D, x, hy):
    fw, fl, fh = D['foot']
    y0 = hy - D.get('foot_fwd', fl * 0.3)   # midden van de voet
    kind = D.get('foot_kind', 'toes')
    if kind == 'web':     # zwemvlies: smalle hiel, brede voorkant
        b.box(bone, C['foot'], (fw * 0.55, fl * 0.6, fh), (x, y0 + fl * 0.2, fh / 2), seg=1)
        b.box(bone, C['foot'], (fw, fl * 0.55, fh), (x, y0 - fl * 0.225, fh / 2), bevel=0.35, seg=1)
    elif kind == 'toes':  # drie tenen
        b.box(bone, C['foot'], (fw * 0.5, fl * 0.5, fh), (x, y0 + fl * 0.25, fh / 2), seg=1)
        for dx, ln in ((-0.36, 0.5), (0.0, 0.62), (0.36, 0.5)):
            b.box(bone, C['claw'], (fw * 0.26, fl * ln, fh), (x + dx * fw, y0 - fl * ln / 2 + 0.02, fh / 2), seg=1)


def bip_neck(c, col, w, d, ty=0.03, tz=-0.08, taper=None, low=0.03):
    """Nek van de romp naar de kop (de nek van de viervoeters); het draaipunt van de kop blijft
    op de romp liggen, de nek begint iets dieper zodat er bij buigen geen gat komt."""
    nk = neck(c, col, w, d, y0=c.NB.y - c.front, z0=c.NB.z - c.bz - low, ty=ty, tz=tz, taper=taper)
    c.piv['head'] = c.piv['lids'] = c.NB.copy()
    return nk


def bip_stick(b, bone, col, p0, p1, w, d, ext=0.03, **kw):
    """Balk van p0 naar p1 (in het vlak van zij)."""
    p0, p1 = Vector(p0), Vector(p1)
    v = p1 - p0
    b.box(bone, col, (w, d, v.length + 2 * ext), (p0 + p1) / 2, rx=math.degrees(math.atan2(-v.y, v.z)), **kw)


def bip_tail(c, tp, a1, a2, L1, L2, sz1, sz2, col1, col2, seg=1, bevel=None):
    """Platte staart in twee stukken; sz = (breedte, dikte), hoeken als bij tail_chain."""
    b, tp = c.b, Vector(tp)
    d1 = Vector((0, math.cos(math.radians(a1)), math.sin(math.radians(a1))))
    d2 = Vector((0, math.cos(math.radians(a2)), math.sin(math.radians(a2))))
    p2 = tp + d1 * L1
    b.box('tail1', col1, (sz1[0], L1 + 0.05, sz1[1]), tp + d1 * L1 / 2, rx=a1, seg=seg, bevel=bevel)
    b.box('tail2', col2, (sz2[0], L2 + 0.05, sz2[1]), p2 + d2 * L2 / 2, rx=a2, seg=seg, bevel=bevel)
    c.piv['tail1'], c.piv['tail2'] = tp, p2
    return p2, p2 + d2 * L2


def bip_eyes(c):
    """Grote donkere ogen met een wit lichtje, voor op de kop; oogleden zoals bij de viervoeters."""
    b, C, D, P, k = c.b, c.C, c.D, c.P, c.k
    e = D.get('eye_e', 0.07) * k * P.get('eye_k', 1.0)
    exk, ezk = D.get('eye', (0.09, 0.03))
    kind = D.get('eye_kind', 'dark')
    patch = D.get('eye_patch')   # (breedte, hoogte) in oogmaten: lichte vlek achter het oog
    out = (D.get('eye_out', 0.0) + (0.012 if patch else 0.0)) * k
    face, hz = c.face - out, c.hz
    for sx in (1, -1):
        ex, ez = sx * exk * k, hz + ezk * k
        if patch:
            b.box('head', C['patch'], (e * patch[0], 0.03 * k, e * patch[1]), (ex, face + 0.012 * k, ez), bevel=0.3, seg=1)
        if kind == 'ring':   # uil: geel oog met zwarte pupil
            b.box('head', C['iris'], (e, 0.03 * k, e), (ex, face - 0.005 * k, ez), bevel=0.35, seg=1)
            b.box('head', C['eye'], (e * 0.54, 0.02 * k, e * 0.6), (ex, face - 0.02 * k, ez), bevel=0.3, seg=1)
            b.box('head', C['white'], (e * 0.2, 0.012 * k, e * 0.2), (ex + e * 0.14, face - 0.031 * k, ez + e * 0.16), bevel=0)
            lw, lh = e * 1.14, e * 1.14
        else:
            b.box('head', C['eye'], (e, 0.03 * k, e * 1.15), (ex, face - 0.005 * k, ez), bevel=0.35, seg=1)
            b.box('head', C['white'], (e * 0.36, 0.014 * k, e * 0.36), (ex + e * 0.2, face - 0.02 * k, ez + e * 0.26), bevel=0)
            lw, lh = e * 1.3, e * 1.5
        # ooglid: verstopt in de kop, schuift naar voren bij knipperen en slapen
        b.box('lids', C['lid'], (lw, 0.05 * k, lh), (ex, c.face + 0.03 * k, ez), bevel=0)
        b.box('lids', C['lidline'], (e * 0.9, 0.008 * k, e * 0.14), (ex, c.face + 0.003 * k, ez - e * 0.2), bevel=0)
    c.extra['lid_slide'] = 0.045 * k + out


# ---------------------------------------------------------------- bouwen
def bip_build(species, variant, style, name):
    R = SPECIES[species]
    P, D = R['variants'][variant], R['dims']
    C = dict(BASE_COL, **R.get('col', {}))
    C.update(P.get('col', {}))
    for key, fallback in (('head', 'body'), ('neck', 'head'), ('wing', 'body'), ('beak', 'nose'), ('leg', 'beak'),
                          ('foot', 'leg'), ('claw', 'foot'), ('lid', 'head'), ('lidline', 'eye'), ('iris', 'white'),
                          ('patch', 'white')):
        C.setdefault(key, C[fallback])
    k, s = P.get('head_k', 1.0), P['s']
    b = Builder(style)
    piv = {'root': Vector((0, 0, 0))}

    # romp; het draaipunt ligt in de heup
    L = D['leg_len'] * P.get('leg_k', 1.0)
    bw, bl, bh = D['body']
    bl, bh = bl * P.get('body_l', 1.0), bh * P.get('body_h', 1.0)
    sink = D.get('sink', 0.04)
    bz = L + bh / 2 - sink
    front, back, top = -bl / 2, bl / 2, bz + bh / 2
    body_bev = min(bw, bl, bh) * (D.get('body_bevel') or 0.3)
    if not D.get('own_body'):
        b.box('body', C['body'], (bw, bl, bh), (0, 0, bz), bevel=D.get('body_bevel'))

    # poten (dier kijkt naar -Y, links is +X)
    hy, lx = D.get('hip_y', 0.0) * P.get('body_l', 1.0), D['leg_x']
    lw, ld = D.get('leg', (0.06, 0.06))
    ltop = D.get('leg_top', 0.06)
    legs = [('leg_HL', lx, hy), ('leg_HR', -lx, hy)]
    for bone, x, y in legs:
        if not D.get('own_legs'):
            b.box(bone, C['leg'], (lw, ld, L + ltop), (x, y, (L + ltop) / 2), seg=1)
            bip_foot(b, bone, C, D, x, y)
        piv[bone] = Vector((x, y, L))
    piv['body'] = Vector((0, hy, L))

    # vleugels: draaipunt in de schouder
    wings = []
    if D.get('wing'):
        wt, wl, wh = D['wing']
        wl, wh = wl * P.get('body_l', 1.0), wh * P.get('body_h', 1.0)
        wy, wz = D.get('wing_at', (0.02, 0.02))
        for bone, sx in (('leg_FL', 1), ('leg_FR', -1)):
            wc = Vector((sx * (bw / 2 + wt / 2 - D.get('wing_in', 0.014)), wy, bz + wz))
            b.box(bone, C['wing'], (wt, wl, wh), wc, bevel=D.get('wing_bevel', 0.35), ry=-sx * D.get('wing_ry', 0.0))
            piv[bone] = Vector((sx * (bw / 2 - 0.01), wy - wl * 0.2, bz + wz + wh / 2 - 0.03))
            wings.append((bone, sx, wc, (wt, wl, wh)))

    # kop: het draaipunt (onderkant van de nek) ligt op de romp
    nk_ = P.get('neck_k', 1.0)
    nf, nu = (v * nk_ for v in D.get('neck', (0.0, 0.0)))
    if D.get('neck_pt'):
        NB = Vector((0, D['neck_pt'][0], L + D['neck_pt'][1]))
    else:
        ny, nz = D.get('neck_at', (0.12, -0.06))
        NB = Vector((0, front + ny * P.get('body_l', 1.0), top + nz))
    hw, hl, hh = (v * k for v in D['head'])
    hcy, hz = NB.y - nf - hl * D.get('head_fwd', 0.15), NB.z + nu + hh / 2
    face = hcy - hl / 2
    piv['head'] = piv['lids'] = NB.copy()
    b.box('head', C['head'], (hw, hl, hh), (0, hcy, hz), bevel=D.get('head_bevel', 0.25))

    c = SimpleNamespace(b=b, C=C, P=P, D=D, style=style, k=k, s=s, piv=piv, L=L, leg_len=L, bw=bw, bl=bl, bh=bh, bz=bz,
                        front=front, back=back, top=top, hy=hy, body_bev=body_bev, hw=hw, hl=hl, hh=hh, hcy=hcy, hz=hz,
                        face=face, NB=NB, legs=legs, wings=wings, nk_=nk_, extra={})
    bip_eyes(c)
    R['decor'](c)
    piv.setdefault('tail1', Vector((0, back - 0.03, bz)))
    piv.setdefault('tail2', piv['tail1'] + Vector((0, 0.06, 0)))
    for bone, sx in (('leg_FL', 1), ('leg_FR', -1)):
        piv.setdefault(bone, Vector((sx * bw / 2, 0, top - 0.05)))

    obj, tris = b.finish(name, s)
    obj.data.materials.append(get_material())
    bpy.context.scene.collection.objects.link(obj)

    # skelet (zelfde opbouw als bij de viervoeters)
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

    # maten voor het spel (oogleden tellen niet mee) en de punten per bot voor het rekenwerk
    names = {g.index: g.name for g in obj.vertex_groups}
    pts = {bn: [] for bn in BONES}
    for v in obj.data.vertices:
        for g in v.groups:
            pts[names[g.group]].append(tuple(v.co))
    ys = [p[1] for bn in BONES if bn != 'lids' for p in pts[bn]]
    zs = [p[2] for bn in BONES if bn != 'lids' for p in pts[bn]]
    A = dict(BIP_POSE, **D.get('pose', {}))
    A.update(P.get('pose', {}))
    hide = D.get('hide')
    if hide is None:
        hide = max(0.0, bh - sink - ltop - 0.3 * body_bev - 0.02)
    M = dict(L=L, A=A, rest={},
             piv={bn: bip_np.array(piv[bn], dtype=float) * s for bn in BONES},
             pts={bn: bip_np.array(pts[bn], dtype=float).reshape(-1, 3) for bn in BONES},
             hide=hide, hide_a=D.get('hide_a', 0.0) * P.get('body_l', 1.0), ltop=ltop, ext=max(0.0, ltop - 0.02),
             trail=D.get('trail', 60.0),
             max_drop=D.get('max_drop'), tail_rest=bool(D.get('tail_rest')), arms=bool(D.get('arms')),
             hops=bool(D.get('hops')), lid_slide=c.extra['lid_slide'], side_tail=0.0)
    M['step'] = min(max(0.25 * L, 0.03), max(hide, 0.02), 0.12)
    G = dict(s=s, k=k, tris=tris, leg_len=L, d=0.0, h=bz - L, back=back, lie_hp=sink,
             height=round(max(zs), 3), length=round(max(ys) - min(ys), 3),
             body_back=round(max(p[1] for p in pts['body']), 3),
             icon_low=c.extra.get('icon_low'), poser=bip_pose, bip=M)

    # vaste hoeken: hoe ver kantelen bij eten, hoe ver mag de kop omlaag bij slapen en verdriet
    clear = bip_low(G, {'body': {'rx': A['poop_pitch']}}, BIP_BODY) / s
    M['squat'] = max(0.0, min(max(A['squat'] * L, 0.05), hide, 0.14, clear - 0.01))
    M['eat_p'], M['eat_a'] = bip_solve_eat(G)
    if A['lie'] == 'side':
        r = A['side_roll']
        side = bip_fix(G, {'body': {'ry': r}, 'leg_HL': {'rx': -30}, 'leg_HR': {'rx': -12}}, ground=BIP_CORE,
                       settle=False)
        for ang in range(0, 60):   # staart laten zakken tot hij op de grond ligt
            side['tail1'] = {'rz': float(ang)}
            if bip_low(G, side, BIP_TAIL) / s < 0.0:
                break
            M['side_tail'] = float(ang)
        M['sleep_a'] = 8.0
    else:
        lie = bip_fix(G, merge(bip_rest(G, A['lie_pitch'], A['lie_legs'], M['max_drop'])), ground=BIP_CORE)
        M['sleep_a'] = bip_solve_head(G, lie, min(A['lie_head'], A['sleep_max']), A['sleep_max'], BIP_CORE)
    M['sad_a'] = bip_solve_head(G, {'body': {'rx': 6}, 'leg_HL': {'rx': -6}, 'leg_HR': {'rx': -6}}, 0.0, A['sad_max'],
                                BIP_LEGS)
    G['eat'], G['sleep'], G['lie'], G['sad'] = (int(round(v)) for v in (M['eat_a'], M['sleep_a'], A['lie_head'],
                                                                         M['sad_a']))
    G['eat_pitch'] = M['eat_p']
    M['rig'] = rig   # voor bip_linear
    if BIP_DEBUG:
        print('BIPCHK %s eat=%d/%d sleep=%d sad=%d hide=%.2f squat=%.2f step=%.2f rust=%.3f'
              % (name, M['eat_p'], M['eat_a'], M['sleep_a'], M['sad_a'], hide, M['squat'], M['step'],
                 bip_low(G, {}, BIP_ALL) / s))
        if BIP_DEBUG == '2':
            bip_check(G, name)
    return rig, obj, G


# ---------------------------------------------------------------- kip
def bip_chicken(c):
    b, C, P, k = c.b, c.C, c.P, c.k
    hcy, hz, hh, face = c.hcy, c.hz, c.hh, c.face
    bip_neck(c, C['neck'], 0.21, 0.21)
    if P.get('chest'):
        b.box('body', C['chest'], (c.bw * 0.74, 0.12, c.bh * 0.66), (0, c.front + 0.035, c.bz - 0.03), bevel=0.4)
    b.box('head', C['beak'], (0.115 * k, 0.13 * k, 0.085 * k), (0, face - 0.05 * k, hz - 0.045 * k),
          taper=(1, 0.45, 1.0), hard=True, seg=1)
    lobes = {0: (), 1: (0.045,), 2: (0.055, 0.075), 3: (0.10, 0.15, 0.11)}[P.get('comb', 0)]
    for i, h in enumerate(lobes):   # kam: bolle lobben van voor naar achter
        y = hcy - 0.03 * k + (i - (len(lobes) - 1) / 2) * 0.09 * k
        b.box('head', C['comb'], (0.055 * k, 0.10 * k, (h + 0.03) * k), (0, y, hz + hh / 2 + h * k / 2 - 0.012 * k),
              bevel=0.4, seg=1)
    wat = P.get('wattle', 0)
    if wat:   # lellen onder de snavel
        for sx in (1, -1):
            b.box('head', C['comb'], (0.05 * k, 0.05 * k, wat * k), (sx * 0.035 * k, face - 0.02 * k, hz - 0.085 * k - wat * k / 2),
                  bevel=0.4, seg=1)
    if P.get('tuft'):   # kuiken: pluisje op de kop
        b.ball('head', C['tuft'], (0.07 * k, 0.07 * k, 0.06 * k), (0, hcy, hz + hh / 2 + 0.02 * k), sub=2)
    for bone, sx, wc, wsz in c.wings:
        if P.get('wingtip'):
            b.box(bone, C['wingtip'], (wsz[0] + 0.012, wsz[1] * 0.42, wsz[2] * 0.6),
                  (wc[0], wc[1] + wsz[1] * 0.3, wc[2] - wsz[2] * 0.16), seg=1)
    tp = Vector((0, c.back - 0.08, c.bz + 0.09))
    kind = P.get('tail', 'chick')
    if kind == 'rooster':   # grote sikkelveren: eerst omhoog, dan in een boog naar achteren en omlaag
        p2, p3 = bip_tail(c, tp, 66, 12, 0.34, 0.26, (0.17, 0.16), (0.14, 0.13), C['tail'], C['tail2'], seg=2)
        b.box('tail2', C['tail'], (0.11, 0.20, 0.10), p3 + Vector((0, 0.06, -0.06)), rx=-48, seg=1)
        for sx in (1, -1):
            b.box('tail1', C['tail2'], (0.07, 0.30, 0.11), tp + Vector((sx * 0.10, 0.12, 0.10)), rx=38, seg=1)
    elif kind == 'hen':
        bip_tail(c, tp, 48, 62, 0.16, 0.10, (0.22, 0.15), (0.15, 0.10), C['tail'], C['tail2'])
    else:
        bip_tail(c, tp + Vector((0, 0.03, -0.04)), 35, 50, 0.07, 0.05, (0.15, 0.09), (0.10, 0.07), C['tail'], C['tail'])


SPECIES['chicken'] = dict(
    build=bip_build, decor=bip_chicken,
    dims=dict(leg_len=0.24, leg=(0.055, 0.055), leg_x=0.10, hip_y=0.02, foot=(0.17, 0.20, 0.035),
              body=(0.42, 0.52, 0.40), body_bevel=0.38, neck_at=(0.12, -0.06), neck=(0.06, 0.10),
              head=(0.30, 0.28, 0.28), eye=(0.085, 0.035), eye_e=0.07,
              wing=(0.06, 0.34, 0.24), wing_at=(0.02, 0.02), pose=dict(tuck=(18, 158))),
    col=dict(beak='#F2B632', leg='#F2A72E', comb='#E0352B'),
    variants={
        'male':    dict(s=0.60, comb=3, wattle=0.10, tail='rooster', wingtip=True,
                        col=dict(body='#A8452A', neck='#E9A23B', head='#E9A23B', wing='#8A3220', wingtip='#1E5B4F',
                                 tail='#1E5B4F', tail2='#2F8A6E')),
        'female':  dict(s=0.56, comb=2, wattle=0.05, tail='hen', chest=True,
                        col=dict(body='#B9793F', head='#C98A4E', wing='#9A6030', chest='#D9A56A', tail='#8A5428',
                                 tail2='#6E4220')),
        'young_m': dict(s=0.37, head_k=1.30, leg_k=0.72, neck_k=0.5, body_l=0.80, eye_k=1.2, comb=1, wingtip=True,
                        col=dict(body='#FFD84A', wing='#F5C52E', wingtip='#E8A63A', tail='#F5C52E', beak='#F59A23',
                                 leg='#F59A23', comb='#F0703A')),
        'young_f': dict(s=0.37, head_k=1.30, leg_k=0.72, neck_k=0.5, body_l=0.80, eye_k=1.2, tuft=True,
                        col=dict(body='#FFE98A', wing='#FFDB5C', tail='#FFDB5C', tuft='#FFF6C8', beak='#F59A23',
                                 leg='#F59A23')),
    })


# ---------------------------------------------------------------- eend
def bip_duck(c):
    b, C, P, k = c.b, c.C, c.P, c.k
    hcy, hz, hh, hw, hl, face = c.hcy, c.hz, c.hh, c.hw, c.hl, c.face
    nk = bip_neck(c, C['neck'], 0.18, 0.19)
    if P.get('ring'):   # witte halsring
        b.band('head', C['white'], (nk.w + 0.024, nk.d + 0.024, 0.05), nk.at(0.58), nk.bev, axis=2, rx=nk.deg, seg=1)
    if P.get('chest'):
        b.box('body', C['chest'], (c.bw + 0.014, 0.24, c.bh + 0.014), (0, c.front + 0.115, c.bz), bevel=0.42)
    for y in P.get('bands', ()):   # gespikkeld: donkere banen over de rug
        b.band('body', C['spot'], (c.bw + 0.016, 0.06, c.bh + 0.016), (0, y * c.bl, c.bz), c.body_bev, seg=1,
               cut=(2, 0.02, -1))
    # platte snavel
    b.box('head', C['beak'], (0.19 * k, 0.20 * k, 0.065 * k), (0, face - 0.075 * k, hz - 0.06 * k), bevel=0.35, seg=1)
    if P.get('saddle'):
        b.box('head', C['spot'], (0.09 * k, 0.10 * k, 0.02 * k), (0, face - 0.07 * k, hz - 0.03 * k), bevel=0)
    if P.get('cap'):
        b.box('head', C['cap'], (hw * 0.80, hl * 0.84, 0.07 * k), (0, hcy + 0.012 * k, hz + hh / 2 - 0.022 * k),
              bevel=0.4, seg=1)
    if P.get('stripe'):   # oogstreep opzij van de kop
        for sx in (1, -1):
            b.box('head', C['cap'], (0.02 * k, hl * 0.6, 0.04 * k), (sx * hw / 2, hcy + 0.04 * k, hz + c.D['eye'][1] * k),
                  bevel=0)
    if P.get('backstripe'):
        b.box('body', C['cap'], (0.13, c.bl * 0.62, 0.03), (0, 0.03, c.top - 0.008), seg=1)
    for bone, sx, wc, wsz in c.wings:
        if P.get('spec'):   # blauwe spiegel op de vleugel
            b.box(bone, C['white'], (wsz[0] + 0.01, 0.15, 0.085), (wc[0], wc[1] + wsz[1] * 0.2, wc[2] - 0.02), bevel=0)
            b.box(bone, C['spec'], (wsz[0] + 0.014, 0.10, 0.09), (wc[0], wc[1] + wsz[1] * 0.2, wc[2] - 0.02), bevel=0)
        if P.get('wingspot'):
            b.box(bone, C['spot'], (wsz[0] + 0.012, 0.07, 0.06), (wc[0], wc[1] - wsz[1] * 0.2, wc[2] + 0.03), bevel=0)
    tp = Vector((0, c.back - 0.06, c.bz + 0.03))
    p2, p3 = bip_tail(c, tp, 28, 55, 0.14, 0.10, (0.22, 0.10), (0.15, 0.07), C['tail'], C['tail2'])
    if P.get('curl'):   # krulveer van de woerd
        b.box('tail2', C['tail'], (0.06, 0.06, 0.08), p3 + Vector((0, -0.03, 0.05)), seg=1)


SPECIES['duck'] = dict(
    build=bip_build, decor=bip_duck,
    dims=dict(leg_len=0.17, leg=(0.055, 0.055), leg_x=0.11, hip_y=0.04, foot=(0.19, 0.21, 0.03), foot_kind='web',
              body=(0.44, 0.62, 0.34), body_bevel=0.4, neck_at=(0.12, -0.07), neck=(0.04, 0.14),
              head=(0.30, 0.30, 0.28), eye=(0.09, 0.03), eye_e=0.07,
              wing=(0.05, 0.40, 0.20), wing_at=(0.04, 0.03), pose=dict(waddle=5, sit_pitch=-10, tuck=(26, 160))),
    col=dict(leg='#F08A24', spec='#2F62C9'),
    variants={
        'male':    dict(s=0.64, ring=True, chest=True, spec=True, curl=True,
                        col=dict(body='#C9C4B8', head='#1F7A4D', chest='#7B4A32', beak='#F2C230', wing='#A39C8F',
                                 tail='#2A2A2E', tail2='#F4F1EA')),
        'female':  dict(s=0.60, bands=(-0.12, 0.08, 0.28), saddle=True, stripe=True, cap=True, spec=True, wingspot=True,
                        col=dict(body='#BF9360', head='#D2A976', spot='#7E5A34', cap='#7E5A34', beak='#E8962E',
                                 wing='#A87C4A', tail='#8E683C', tail2='#7E5A34')),
        'young_m': dict(s=0.39, head_k=1.30, leg_k=0.80, neck_k=0.5, body_l=0.80, eye_k=1.2, cap=True, backstripe=True,
                        col=dict(body='#FFD94D', wing='#F5C63A', cap='#8A5A2B', beak='#E8962E', tail='#8A5A2B',
                                 tail2='#8A5A2B')),
        'young_f': dict(s=0.39, head_k=1.30, leg_k=0.80, neck_k=0.5, body_l=0.80, eye_k=1.2, cap=True, stripe=True,
                        col=dict(body='#FFE680', wing='#FFD95C', cap='#B98A4E', beak='#F2A85A', tail='#FFD95C',
                                 tail2='#FFD95C')),
    })


# ---------------------------------------------------------------- pelikaan
def bip_pelican(c):
    b, C, P, k = c.b, c.C, c.P, c.k
    hcy, hz, hh, hl, face = c.hcy, c.hz, c.hh, c.hl, c.face
    bip_neck(c, C['neck'], 0.18, 0.20)
    c.extra['icon_low'] = None
    # enorme snavel schuin omlaag, met een keelzak eronder
    bill, deg = 0.50 * P.get('bill', 1.0), P.get('bill_a', 26)
    ang = math.radians(deg)
    d = Vector((0, -math.cos(ang), -math.sin(ang)))   # langs de snavel
    n = Vector((0, math.sin(ang), -math.cos(ang)))    # haaks erop, omlaag
    O = Vector((0, face + 0.03 * k, hz - 0.005 * k))
    b.box('head', C['beak'], (0.11 * k, bill, 0.06 * k), O + d * (bill / 2 - 0.02), rx=deg, bevel=0.3, seg=1)
    b.box('head', C['pouch'], (0.175 * k, bill * 0.84, 0.17 * k), O + d * (bill * 0.44) + n * (0.088 * k), rx=deg - 7,
          taper=(1, 0.38, 1.0), hard=True, bevel=0.3)
    b.box('head', C['hook'], (0.075 * k, 0.06 * k, 0.07 * k), O + d * (bill - 0.03) + n * (0.02 * k), rx=deg, seg=1)
    if P.get('crest'):   # kuif achter op de kop
        b.box('head', C['crest'], (0.12 * k, 0.15 * k, 0.06 * k), (0, hcy + hl / 2 + 0.02 * k, hz + hh / 2 - 0.035 * k),
              rx=-28, seg=1)
    if P.get('tuft'):
        b.ball('head', C['crest'], (0.08 * k, 0.08 * k, 0.05 * k), (0, hcy + 0.02 * k, hz + hh / 2 + 0.01 * k), sub=2)
    for bone, sx, wc, wsz in c.wings:   # zwarte slagpennen
        b.box(bone, C['tip'], (wsz[0] + 0.012, wsz[1] * 0.36, wsz[2] * 0.52),
              (wc[0], wc[1] + wsz[1] * 0.34, wc[2] - wsz[2] * 0.22), seg=1)
    bip_tail(c, (0, c.back - 0.06, c.bz + 0.05), 14, 6, 0.13, 0.09, (0.26, 0.11), (0.18, 0.08), C['body'], C['tip'])


SPECIES['pelican'] = dict(
    build=bip_build, decor=bip_pelican,
    dims=dict(leg_len=0.15, leg=(0.07, 0.07), leg_x=0.12, hip_y=0.05, foot=(0.20, 0.22, 0.035), foot_kind='web',
              body=(0.50, 0.66, 0.44), body_bevel=0.4, neck_at=(0.12, -0.08), neck=(0.03, 0.26),
              head=(0.28, 0.28, 0.26), eye=(0.085, 0.045), eye_e=0.065,
              wing=(0.07, 0.46, 0.28), wing_at=(0.04, 0.0), wing_in=0.04,
              pose=dict(waddle=4, sit_pitch=-10, tuck=(0, 165))),
    col=dict(leg='#F2A07A', tip='#2B2B30'),
    variants={
        'male':    dict(s=0.86, crest=True,
                        col=dict(body='#FAF8F2', beak='#F2A93B', pouch='#F7C23E', hook='#E8662E', crest='#F3E3A8')),
        'female':  dict(s=0.79, bill=0.9,
                        col=dict(body='#FFFDF8', beak='#F5B56A', pouch='#F6B7A0', hook='#E88A5A')),
        'young_m': dict(s=0.50, head_k=1.28, leg_k=0.85, neck_k=0.6, body_l=0.82, eye_k=1.2, bill=0.66, tuft=True,
                        col=dict(body='#B9AFA4', wing='#9C9288', beak='#D9C3A8', pouch='#E8D2B0', hook='#B89A78',
                                 crest='#8A8076', tip='#5A544E')),
        'young_f': dict(s=0.50, head_k=1.28, leg_k=0.85, neck_k=0.6, body_l=0.82, eye_k=1.2, bill=0.66,
                        col=dict(body='#D8D0C6', wing='#C2B9AE', beak='#E6CDB4', pouch='#F2CDBE', hook='#C9A88A',
                                 tip='#7A736C')),
    })


# ---------------------------------------------------------------- toekan
def bip_toucan(c):
    b, C, P, k = c.b, c.C, c.P, c.k
    hcy, hz, hh, hw, face = c.hcy, c.hz, c.hh, c.hw, c.face
    bip_neck(c, C['neck'], 0.24, 0.24)
    c.extra['icon_low'] = None
    # witte bef met een gele rand, door tot op de keel
    b.box('body', C['bib'], (c.bw * 0.76, 0.12, c.bh * 0.56), (0, c.front + 0.04, c.bz + 0.07), bevel=0.4)
    b.box('body', C['bib2'], (c.bw * 0.76 + 0.006, 0.124, 0.06), (0, c.front + 0.04, c.bz + 0.07 - c.bh * 0.25), seg=1)
    b.box('head', C['bib'], (hw * 0.80, 0.10 * k, hh * 0.40), (0, face + 0.035 * k, hz - hh * 0.31), bevel=0.4, seg=1)
    # reusachtige snavel in drie stukken die steeds verder omlaag buigen; het puntje is donker
    f = P.get('bill', 1.0)

    def dv(a):
        return Vector((0, -math.cos(math.radians(a)), -math.sin(math.radians(a))))
    O = Vector((0, face + 0.02 * k, hz - 0.065 * k))
    L1, L2, L3 = 0.24 * f, 0.20 * f, 0.09 * f
    p1 = O + dv(4) * L1
    p2 = p1 + dv(20) * L2
    b.box('head', C['beak'], (0.13 * k, L1 + 0.04, 0.20 * k), O + dv(4) * (L1 / 2), rx=4, bevel=0.3)
    b.box('head', C['beak2'], (0.118 * k, L2 + 0.05, 0.165 * k), p1 + dv(20) * (L2 / 2) + Vector((0, 0, -0.008 * k)),
          rx=20, bevel=0.3, seg=1)
    if P.get('tip', True):
        b.box('head', C['tip'], (0.10 * k, L3 + 0.04, 0.115 * k), p2 + dv(38) * (L3 / 2) + Vector((0, 0, -0.012 * k)),
              rx=38, bevel=0.35, seg=1)
    b.box('head', C['tip'], (0.14 * k, 0.03, 0.21 * k), O + dv(4) * 0.04, rx=4, bevel=0)   # zwarte rand bij de kop
    tp = Vector((0, c.back - 0.05, c.bz - 0.02))
    bip_tail(c, tp, -12, -18, 0.16, 0.16, (0.22, 0.08), (0.18, 0.07), C['body'], C['body'])
    b.box('tail1', C['bib'], (0.226, 0.07, 0.086), tp + Vector((0, 0.05, -0.008)), rx=-12, seg=1)   # witte stuit
    b.box('body', C['red'], (0.20, 0.08, 0.07), (0, c.back - 0.035, c.bz - c.bh / 2 + 0.09), seg=1)


SPECIES['toucan'] = dict(
    build=bip_build, decor=bip_toucan,
    dims=dict(leg_len=0.16, leg=(0.055, 0.055), leg_x=0.10, hip_y=0.02, foot=(0.17, 0.18, 0.035),
              body=(0.40, 0.46, 0.44), body_bevel=0.38, neck_at=(0.14, -0.06), neck=(0.02, 0.05),
              head=(0.32, 0.30, 0.30), eye=(0.112, 0.075), eye_e=0.06, eye_patch=(1.45, 1.5),
              wing=(0.055, 0.36, 0.26), wing_at=(0.03, 0.02), pose=dict(eat_max=50, tuck=(-14, 165))),
    col=dict(body='#1E1E22', leg='#5E7FA8', red='#D9362B', tip='#1E1E22'),
    variants={
        'male':    dict(s=0.66,
                        col=dict(bib='#FFF6DC', bib2='#FFD23A', beak='#FF9A1F', beak2='#FF7A1A', patch='#3FA7E0',
                                 lid='#3FA7E0')),
        'female':  dict(s=0.61, bill=0.86,
                        col=dict(bib='#FFE680', bib2='#FF9A3A', beak='#FFC53D', beak2='#FFA22A', patch='#57C4B8',
                                 lid='#57C4B8')),
        'young_m': dict(s=0.38, head_k=1.28, leg_k=0.85, body_l=0.85, eye_k=1.2, bill=0.62,
                        col=dict(body='#2A2A30', bib='#FFF6DC', bib2='#FFE27A', beak='#FFD45A', beak2='#FFB03A',
                                 patch='#3FA7E0', lid='#3FA7E0')),
        'young_f': dict(s=0.38, head_k=1.28, leg_k=0.85, body_l=0.85, eye_k=1.2, bill=0.62, tip=False,
                        col=dict(body='#2A2A30', bib='#FFE680', bib2='#FFB85A', beak='#FFE08A', beak2='#FF9E8A',
                                 patch='#F58FB0', lid='#F58FB0')),
    })


# ---------------------------------------------------------------- papegaai (ara)
def bip_parrot(c):
    b, C, P, k = c.b, c.C, c.P, c.k
    hcy, hz, hh, hw, hl, face = c.hcy, c.hz, c.hh, c.hw, c.hl, c.face
    bip_neck(c, C['neck'], 0.24, 0.24)
    c.extra['icon_low'] = None
    # wit gezicht (de ogen staan erop) en een grote kromme snavel
    b.box('head', C['face'], (hw * 0.88, 0.03 * k, hh * 0.56), (0, face + 0.003 * k, hz + 0.02 * k), bevel=0.3, seg=1)
    f = P.get('beak_k', 1.0)
    b.box('head', C['beak'], (0.16 * k * f, 0.15 * k * f, 0.13 * k * f), (0, face - 0.055 * k * f, hz - 0.085 * k), bevel=0.35)
    b.box('head', C['beak'], (0.11 * k * f, 0.085 * k * f, 0.11 * k * f), (0, face - 0.10 * k * f, hz - 0.17 * k),
          taper=(2, 0.35, 1.0), hard=True, seg=1)
    b.box('head', C['beak2'], (0.10 * k, 0.07 * k, 0.05 * k), (0, face - 0.015 * k, hz - 0.17 * k), seg=1)
    if P.get('cap'):
        b.box('head', C['cap'], (hw * 0.72, hl * 0.5, 0.05 * k), (0, hcy - hl * 0.2, hz + hh / 2 - 0.015 * k), seg=1)
    if P.get('back'):   # rug in een andere kleur dan de borst
        b.box('body', C['back'], (c.bw + 0.012, c.bl * 0.56, c.bh + 0.012), (0, c.back - c.bl * 0.28 + 0.006, c.bz),
              bevel=0.36)
    for bone, sx, wc, wsz in c.wings:   # vleugel in drie kleuren
        b.box(bone, C['wing2'], (wsz[0] + 0.012, wsz[1] + 0.012, wsz[2] * 0.30), (wc[0], wc[1], wc[2] - wsz[2] * 0.04),
              bevel=0.3, seg=1)
        b.box(bone, C['wing3'], (wsz[0] + 0.014, wsz[1] + 0.014, wsz[2] * 0.40), (wc[0], wc[1], wc[2] - wsz[2] * 0.31),
              bevel=0.3, seg=1)
    tk = P.get('tail_k', 1.0)
    bip_tail(c, (0, c.back - 0.05, c.bz - 0.10), -16, -20, 0.30 * tk, 0.28 * tk, (0.17, 0.07), (0.12, 0.06),
             C['tail'], C['tail2'])


SPECIES['parrot'] = dict(
    build=bip_build, decor=bip_parrot,
    dims=dict(leg_len=0.18, leg=(0.055, 0.055), leg_x=0.09, hip_y=0.0, foot=(0.16, 0.18, 0.035),
              body=(0.36, 0.40, 0.50), body_bevel=0.36, neck_at=(0.16, -0.05), neck=(0.02, 0.03),
              head=(0.32, 0.30, 0.30), eye=(0.10, 0.045), eye_e=0.062, eye_out=0.012,
              wing=(0.06, 0.30, 0.36), wing_at=(0.04, 0.0), pose=dict(eat_max=56, tuck=(-6, 160), tail_up=60)),
    col=dict(leg='#6A6A70', face='#FFF7EE', lid='#FFF7EE'),
    variants={
        'male':    dict(s=0.60,
                        col=dict(body='#E02B20', wing2='#FFD23A', wing3='#2456C9', tail='#E02B20', tail2='#2456C9',
                                 beak='#F4E8D0', beak2='#2B2422')),
        'female':  dict(s=0.57, back=True, cap=True,
                        col=dict(body='#FFC928', head='#1E7BD9', back='#1E7BD9', wing='#1E7BD9', wing2='#2FA6E8',
                                 wing3='#1557A8', tail='#1E7BD9', tail2='#FFC928', beak='#3A3230', beak2='#2B2422',
                                 cap='#3FAE5A')),
        'young_m': dict(s=0.36, head_k=1.26, leg_k=0.85, body_h=0.85, eye_k=1.2, tail_k=0.55, beak_k=0.85,
                        col=dict(body='#EE4A36', wing2='#FFDD5C', wing3='#3FAE5A', tail='#EE4A36', tail2='#3FAE5A',
                                 beak='#F4E8D0', beak2='#2B2422')),
        'young_f': dict(s=0.36, head_k=1.26, leg_k=0.85, body_h=0.85, eye_k=1.2, tail_k=0.55, beak_k=0.85, back=True,
                        col=dict(body='#FFD65C', head='#3F93E0', back='#3F93E0', wing='#3F93E0', wing2='#6FC0F0',
                                 wing3='#2A6FC0', tail='#3F93E0', tail2='#FFD65C', beak='#4A4240', beak2='#2B2422')),
    })


# ---------------------------------------------------------------- struisvogel
def bip_ostrich(c):
    b, C, P, k = c.b, c.C, c.P, c.k
    hcy, hz, hh, face = c.hcy, c.hz, c.hh, c.face
    nk = bip_neck(c, C['neck'], 0.105, 0.105, ty=0.03, tz=-0.05, low=0.06)
    # donzen kraag waar de nek uit de romp komt
    b.ball('body', C['collar'], (0.16, 0.15, 0.09), (0, c.NB.y, c.NB.z + 0.02))
    for i in range(P.get('neck_rings', 0)):   # kuiken: gestreepte nek
        b.band('head', C['ring'], (nk.w + 0.022, nk.d + 0.022, 0.05), nk.at(0.38 + 0.24 * i), nk.bev, axis=2,
               rx=nk.deg, seg=1)
    c.extra['icon_low'] = hz - hh / 2 - 0.30 * k   # kopplaatje: klein kopje op een lange dunne nek
    # platte snavel die naar voren smaller wordt, wimpers, pluisje op de kop
    b.box('head', C['beak'], (0.15 * k, 0.17 * k, 0.055 * k), (0, face - 0.065 * k, hz - 0.055 * k),
          taper=(1, 0.6, 1.0), hard=True, bevel=0.35, seg=1)
    exk, ezk = c.D['eye']
    e = c.D['eye_e'] * k * P.get('eye_k', 1.0)
    for sx in (1, -1):   # een krulletje aan de buitenste ooghoek
        b.box('head', C['lash'], (e * 0.38, 0.03 * k, e * 0.12), (sx * (exk * k + e * 0.68), face - 0.008 * k, hz + ezk * k + e * 0.52),
              bevel=0, ry=-sx * 32)
    b.ball('head', C['fuzz'], (0.075 * k, 0.085 * k, 0.045 * k), (0, hcy + 0.01 * k, hz + hh / 2))
    for bone, x, y in c.legs:   # dikke dijen en knieën
        b.box(bone, C['thigh'], (0.125, 0.145, c.L * 0.36), (x, y, c.L * 0.86), bevel=0.35, seg=1)
        b.box(bone, C['leg'], (0.095, 0.095, 0.07), (x, y, c.L * 0.5), seg=1)
    for bone, sx, wc, wsz in c.wings:   # pluimen aan de vleugelpunt
        b.ball(bone, C['plume'], (0.075, 0.15, 0.125), (wc[0] + sx * 0.012, wc[1] + wsz[1] * 0.38, wc[2] - wsz[2] * 0.2))
    tp = Vector((0, c.back - 0.07, c.bz + 0.10))
    b.ball('tail1', C['plume'], (0.18, 0.15, 0.16), tp + Vector((0, 0.08, 0.03)))
    b.ball('tail2', C['plume'], (0.13, 0.12, 0.12), tp + Vector((0, 0.19, 0.09)))
    c.piv['tail1'], c.piv['tail2'] = tp, tp + Vector((0, 0.12, 0.05))


SPECIES['ostrich'] = dict(
    build=bip_build, decor=bip_ostrich, view=1.5,
    dims=dict(leg_len=0.80, leg=(0.075, 0.075), leg_x=0.13, hip_y=0.03, foot=(0.15, 0.22, 0.045),
              body=(0.50, 0.66, 0.46), body_bevel=0.4, sink=0.05, neck_at=(0.10, -0.10), neck=(0.10, 0.64),
              head=(0.22, 0.26, 0.19), head_fwd=0.25, head_bevel=0.2, eye=(0.066, 0.02), eye_e=0.062,
              wing=(0.07, 0.44, 0.26), wing_at=(0.02, 0.0), hide=0.12, hide_a=0.12,
              pose=dict(walk=22, run=40, run_wing=22, run_air=0.05, eat_pitch=40, eat_max=92, tuck=(56, 165),
                        sad_max=30, hop=0.26, bob=0.045)),
    col=dict(lash='#3A2C2A'),
    variants={
        'male':    dict(s=0.82,
                        col=dict(body='#232124', plume='#F4F1EA', collar='#F4F1EA', neck='#E3B3A6', head='#E3B3A6',
                                 fuzz='#CFC6BC', beak='#E8967A', leg='#DDB0A2', thigh='#DDB0A2')),
        'female':  dict(s=0.76,
                        col=dict(body='#8C7A66', wing='#7E6D5A', plume='#D9CCB8', collar='#A89680', neck='#D2B9A6',
                                 head='#D2B9A6', fuzz='#B9A792', beak='#D9A58A', leg='#CDB3A2', thigh='#CDB3A2')),
        'young_m': dict(s=0.53, head_k=1.30, leg_k=0.70, neck_k=0.6, body_l=0.85, eye_k=1.2, neck_rings=2,
                        col=dict(body='#B79E7C', wing='#8A7458', plume='#6A5844', collar='#D9C6A6', neck='#E6D2AE',
                                 head='#E6D2AE', ring='#7A6248', fuzz='#7A6248', beak='#D9A58A', leg='#D9C3AE',
                                 thigh='#D9C3AE')),
        'young_f': dict(s=0.53, head_k=1.30, leg_k=0.70, neck_k=0.6, body_l=0.85, eye_k=1.2,
                        col=dict(body='#D2BC9A', wing='#BDA682', plume='#F0E6D2', collar='#F0E6D2', neck='#F0DFC0',
                                 head='#F0DFC0', fuzz='#F7EED8', beak='#E8B49A', leg='#E0CDB8', thigh='#E0CDB8')),
    })


# ---------------------------------------------------------------- flamingo
def bip_flamingo(c):
    b, C, P, k = c.b, c.C, c.P, c.k
    hcy, hz, hh, hl, face, NB, q = c.hcy, c.hz, c.hh, c.hl, c.face, c.NB, c.nk_
    # nek in een S: eerst naar voren, dan terug, dan weer naar voren naar de kop
    HB = Vector((0, hcy + hl * 0.25, hz - hh / 2 + 0.03 * k))
    pts = [NB + Vector((0, 0.03, -0.06)), NB + Vector((0, -0.25 * q, 0.20 * q)), NB + Vector((0, -0.07 * q, 0.47 * q)), HB]
    for p0, p1 in zip(pts, pts[1:]):
        bip_stick(b, 'head', C['neck'], p0, p1, 0.085, 0.085, ext=0.035, seg=1)
    c.extra['icon_low'] = hz - hh / 2 - 0.24 * k
    # geknikte snavel met zwarte punt
    b.box('head', C['beak'], (0.10 * k, 0.14 * k, 0.09 * k), (0, face - 0.05 * k, hz - 0.035 * k), rx=24, bevel=0.3, seg=1)
    b.box('head', C['tip'], (0.085 * k, 0.12 * k, 0.075 * k), (0, face - 0.115 * k, hz - 0.115 * k), rx=66, bevel=0.3, seg=1)
    for bone, x, y in c.legs:   # knieën
        b.box(bone, C['knee'], (0.07, 0.07, 0.065), (x, y, c.L * 0.52), seg=1)
    for bone, sx, wc, wsz in c.wings:   # zwarte slagpennen
        b.box(bone, C['tip'], (wsz[0] + 0.01, 0.12, 0.08), (wc[0], wc[1] + wsz[1] / 2 - 0.05, wc[2] - wsz[2] / 2 + 0.05),
              seg=1)
    bip_tail(c, (0, c.back - 0.05, c.bz + 0.04), 8, -5, 0.12, 0.09, (0.20, 0.10), (0.13, 0.07), C['wing'], C['tip'])


SPECIES['flamingo'] = dict(
    build=bip_build, decor=bip_flamingo, view=1.4,
    dims=dict(leg_len=0.74, leg=(0.045, 0.045), leg_x=0.085, hip_y=0.03, foot=(0.13, 0.16, 0.03), foot_kind='web',
              body=(0.32, 0.50, 0.32), body_bevel=0.4, neck_at=(0.08, -0.10), neck=(0.14, 0.66),
              head=(0.19, 0.22, 0.19), head_bevel=0.2, eye=(0.058, 0.02), eye_e=0.055,
              wing=(0.05, 0.38, 0.22), wing_at=(0.03, 0.02), hide_a=0.12,
              pose=dict(walk=20, run=34, eat_pitch=35, eat_max=95, sleep_max=80, sad_max=26, bob=0.045)),
    col=dict(tip='#221C1E'),
    variants={
        'male':    dict(s=0.76,
                        col=dict(body='#FF7FA0', wing='#FF5C8A', beak='#FFE6DC', leg='#F0608A', knee='#D94C78')),
        'female':  dict(s=0.71,
                        col=dict(body='#FFA9BF', wing='#FF8FAD', beak='#FFF0E8', leg='#F584A4', knee='#E06A8E')),
        'young_m': dict(s=0.50, head_k=1.30, leg_k=0.62, neck_k=0.55, body_l=0.85, eye_k=1.2,
                        col=dict(body='#CFC9C4', wing='#A9A29C', beak='#BDB5AE', tip='#4A4446', leg='#8E8A8C',
                                 knee='#75716F')),
        'young_f': dict(s=0.50, head_k=1.30, leg_k=0.62, neck_k=0.55, body_l=0.85, eye_k=1.2,
                        col=dict(body='#EDE6E0', wing='#F7C3D0', beak='#D9D0C8', tip='#5A5456', leg='#A9A3A5',
                                 knee='#8E8A8C')),
    })


# ---------------------------------------------------------------- pauw
def bip_peacock(c):
    b, C, P, k = c.b, c.C, c.P, c.k
    hcy, hz, hh, face = c.hcy, c.hz, c.hh, c.face
    bip_neck(c, C['neck'], 0.14, 0.14, ty=0.03, tz=-0.06, low=0.05)
    b.box('head', C['beak'], (0.08 * k, 0.10 * k, 0.06 * k), (0, face - 0.04 * k, hz - 0.05 * k),
          taper=(1, 0.45, 1.0), hard=True, seg=1)
    n = P.get('crest', 3)   # kroontje: steeltjes met een bolletje
    base, ln = Vector((0, hcy + 0.02 * k, hz + hh / 2 - 0.01 * k)), 0.11 * k
    for i in range(n):
        a = (i - (n - 1) / 2) * 24
        u = Vector((math.sin(math.radians(a)), 0, math.cos(math.radians(a))))
        b.box('head', C['crest'], (0.02 * k, 0.02 * k, ln), base + u * (ln / 2), ry=a, bevel=0)
        b.box('head', C['knob'], (0.05 * k, 0.04 * k, 0.05 * k), base + u * ln, ry=a, seg=1)
    if P.get('chest'):
        b.box('body', C['chest'], (c.bw * 0.74, 0.12, c.bh * 0.62), (0, c.front + 0.035, c.bz - 0.03), bevel=0.4)
    for bone, sx, wc, wsz in c.wings:   # gestreepte vleugels
        for j in range(P.get('bars', 0)):
            b.box(bone, C['bar'], (wsz[0] + 0.012, 0.05, wsz[2] * 0.82), (wc[0], wc[1] + (j - 1) * wsz[1] * 0.28, wc[2]),
                  bevel=0)
    if P.get('fan'):
        # waaier: zeven veren op een flauwe kegel, met ogen aan beide kanten; om en om aan tail1 en tail2
        tp, ln, tilt = Vector((0, c.back - 0.10, c.bz + 0.06)), 0.80 * P['fan'], -20
        Rt = Matrix.Rotation(math.radians(tilt), 3, 'X')
        for i, a in enumerate((-78, -52, -26, 0, 26, 52, 78)):
            Rm = Matrix.Rotation(math.radians(a), 3, 'Y') @ Rt
            bone = 'tail2' if i % 2 else 'tail1'
            b.box(bone, C['fan2' if i % 2 else 'fan'], (0.34, 0.045, ln), tp + Rm @ Vector((0, 0, ln * 0.5)), rx=tilt, ry=a,
                  taper=(2, 0.3, 1.0), hard=True, seg=1)
            for f, size in ((0.80, 0.16), (0.46, 0.095)):
                at = tp + Rm @ Vector((0, 0, ln * f))
                b.box(bone, C['eye1'], (size, 0.075, size), at, rx=tilt, ry=a, bevel=0.3, seg=1)
                b.box(bone, C['eye2'], (size * 0.55, 0.10, size * 0.55), at, rx=tilt, ry=a, bevel=0)
        c.piv['tail1'] = c.piv['tail2'] = tp
    else:
        tk = P.get('tail_k', 1.0)
        bip_tail(c, (0, c.back - 0.06, c.bz + 0.04), -8, -14, 0.22 * tk, 0.20 * tk, (0.22, 0.08), (0.17, 0.07),
                 C['tail'], C['tail2'])


SPECIES['peacock'] = dict(
    build=bip_build, decor=bip_peacock, view=1.25,
    dims=dict(leg_len=0.28, leg=(0.055, 0.055), leg_x=0.09, hip_y=0.03, foot=(0.16, 0.20, 0.035),
              body=(0.36, 0.52, 0.38), body_bevel=0.4, neck_at=(0.10, -0.08), neck=(0.06, 0.30),
              head=(0.23, 0.25, 0.22), head_bevel=0.2, eye=(0.066, 0.02), eye_e=0.056, eye_patch=(1.5, 1.7),
              wing=(0.05, 0.38, 0.22), wing_at=(0.03, 0.02),
              pose=dict(wag=0.25, tail_up=14, sad_tail=-22, eat_max=80, tuck=(50, 165), sad_max=30)),
    col=dict(beak='#E6DCC6', leg='#9A8E84', lid='#FFFFFF', fan='#2E9E6B', fan2='#1F7F6B', eye1='#F2C230',
             eye2='#2456C9'),
    variants={
        'male':    dict(s=0.68, fan=1.0, bars=3,
                        col=dict(body='#1F4FB8', neck='#1F5FCC', head='#1F5FCC', wing='#D9C9A6', bar='#5A4632',
                                 crest='#1F5FCC', knob='#2FB8A0')),
        'female':  dict(s=0.62, chest=True,
                        col=dict(body='#8E7B66', neck='#3F9A6A', head='#8E7B66', wing='#7E6C58', chest='#EFE6D2',
                                 crest='#6E5C4A', knob='#3F9A6A', tail='#7E6C58', tail2='#5E4E3E')),
        'young_m': dict(s=0.37, head_k=1.30, leg_k=0.75, neck_k=0.6, body_l=0.82, eye_k=1.2, crest=2, tail_k=0.5,
                        col=dict(body='#B79B76', neck='#3F74B8', head='#3F74B8', wing='#A08462', crest='#3F74B8',
                                 knob='#2FB8A0', tail='#A08462', tail2='#7E6C58')),
        'young_f': dict(s=0.37, head_k=1.30, leg_k=0.75, neck_k=0.6, body_l=0.82, eye_k=1.2, crest=2, tail_k=0.5,
                        chest=True,
                        col=dict(body='#C9B18E', wing='#B79B76', chest='#F4ECDA', crest='#8E7B66', knob='#C98A5A',
                                 tail='#B79B76', tail2='#8E7B66')),
    })


# ---------------------------------------------------------------- pinguin
def bip_penguin(c):
    b, C, P, k = c.b, c.C, c.P, c.k
    hcy, hz, hh, hw, hl, face = c.hcy, c.hz, c.hh, c.hw, c.hl, c.face
    # witte buik met een gele gloed bovenaan
    b.box('body', C['belly'], (c.bw * 0.76, 0.14, c.bh * 0.76), (0, c.front + 0.052, c.bz - 0.03), bevel=0.4)
    if P.get('chest'):
        b.box('body', C['chest'], (c.bw * 0.56, 0.142, c.bh * 0.13), (0, c.front + 0.05, c.bz + c.bh * 0.25),
              bevel=0.4, seg=1)
    # wit gezicht (de ogen staan erop), oranje snavel, gele wangvlek
    fk = P.get('face_k', 1.0)
    b.box('head', C['face'], (hw * 0.80, 0.03 * k, hh * 0.56 * fk), (0, face + 0.003 * k, hz - 0.01 * k), bevel=0.3, seg=1)
    b.box('head', C['beak'], (0.10 * k, 0.12 * k, 0.07 * k), (0, face - 0.045 * k, hz - 0.065 * k),
          taper=(1, 0.5, 1.0), hard=True, seg=1)
    if P.get('ear'):
        for sx in (1, -1):
            b.box('head', C['ear'], (0.03 * k, hl * 0.42, hh * 0.42), (sx * hw / 2, hcy + 0.01 * k, hz - 0.03 * k),
                  bevel=0.3, seg=1)
    if P.get('tuft'):
        b.ball('head', C['tuft'], (0.08 * k, 0.08 * k, 0.05 * k), (0, hcy, hz + hh / 2 + 0.01 * k))
    bip_tail(c, (0, c.back - 0.04, c.bz - c.bh / 2 + 0.09), -20, -28, 0.09, 0.06, (0.20, 0.06), (0.13, 0.05),
             C['body'], C['body'])


SPECIES['penguin'] = dict(
    build=bip_build, decor=bip_penguin,
    dims=dict(leg_len=0.06, leg=(0.09, 0.08), leg_x=0.11, hip_y=-0.01, leg_top=0.20, foot=(0.17, 0.24, 0.045),
              foot_fwd=0.10, foot_kind='web', body=(0.44, 0.36, 0.60), body_bevel=0.36, sink=0.03,
              neck_at=(0.18, -0.04), head=(0.38, 0.34, 0.30), head_fwd=0.06, eye=(0.10, 0.03), eye_e=0.066,
              eye_out=0.012, wing=(0.05, 0.17, 0.40), wing_at=(0.0, 0.04), wing_ry=8, wing_bevel=0.3, trail=62,
              pose=dict(walk=14, run=18, waddle=9, slide=0.035, yaw=6, run_pitch=6, run_wing=30, bob=0.0,
                        eat_pitch=55, eat_max=56, lie_pitch=84, lie_legs='trail', lie_head=-58, sleep_max=-20,
                        sit_pitch=-12, sit_toes=55, poop_pitch=10, pee_pitch=0, sad_max=28, hop=0.16)),
    col=dict(beak='#F28A1E', leg='#F28A1E', face='#FAFAF7', lid='#FAFAF7'),
    variants={
        'male':    dict(s=0.84, chest=True, ear=True,
                        col=dict(body='#22252B', head='#16181C', belly='#FAFAF7', chest='#FFD23A', ear='#FFB52E')),
        'female':  dict(s=0.77, chest=True, ear=True,
                        col=dict(body='#3A4350', head='#2A313B', belly='#FFFFFF', chest='#FFE98A', ear='#FFE27A',
                                 beak='#F2A03A')),
        'young_m': dict(s=0.50, head_k=1.22, body_h=0.82, eye_k=1.2, face_k=1.15,
                        col=dict(body='#AEB4BC', head='#22252B', belly='#E9ECEF', face='#FFFFFF', lid='#FFFFFF',
                                 beak='#3A3A40', leg='#4A4A52')),
        'young_f': dict(s=0.50, head_k=1.22, body_h=0.82, eye_k=1.2, face_k=1.15, tuft=True,
                        col=dict(body='#C9CED4', head='#3A4350', belly='#F4F6F8', face='#FFFFFF', lid='#FFFFFF',
                                 tuft='#E9ECEF', beak='#4A4A52', leg='#5E5E66')),
    })


# ---------------------------------------------------------------- sneeuwuil
def bip_owl(c):
    b, C, P, k = c.b, c.C, c.P, c.k
    hcy, hz, hh, hw, hl, face = c.hcy, c.hz, c.hh, c.hw, c.hl, c.face
    # gezichtsschijf en kleine haaksnavel
    b.box('head', C['face'], (hw * 0.86, 0.03 * k, hh * 0.74), (0, face + 0.003 * k, hz), bevel=0.35, seg=1)
    b.box('head', C['beak'], (0.075 * k, 0.07 * k, 0.10 * k), (0, face - 0.03 * k, hz - 0.08 * k),
          taper=(2, 0.3, 1.0), hard=True, seg=1)
    # donkere vlekjes: dwarsbanden over de borst, strepen op de vleugels, stippen op de kop
    for x, f in P.get('flecks', ()):
        b.box('body', C['fleck'], (0.075, 0.03, 0.032), (x, c.front - 0.003, c.bz + f * c.bh), bevel=0)
    for bone, sx, wc, wsz in c.wings:
        for i, f in enumerate(P.get('wing_bars', ())):
            b.box(bone, C['fleck'], (wsz[0] + 0.012, wsz[1] * 0.42, 0.032),
                  (wc[0], wc[1] + (0.16 if i % 2 else -0.16) * wsz[1], wc[2] + f * wsz[2]), bevel=0)
    for x, y in P.get('spots', ()):
        b.box('head', C['fleck'], (0.07 * k, 0.05 * k, 0.02 * k), (x * k, hcy + y * k, hz + hh / 2 - 0.002 * k), bevel=0)
    if P.get('tufts'):   # donsje boven op de kop en een pluizige borst
        b.ball('head', C['tuft'], (0.10 * k, 0.09 * k, 0.06 * k), (0, hcy - 0.02 * k, hz + hh / 2 + 0.01 * k))
        b.ball('body', C['tuft'], (0.15, 0.07, 0.13), (0, c.front + 0.01, c.bz + 0.02))
    bip_tail(c, (0, c.back - 0.04, c.bz - c.bh / 2 + 0.12), -25, -30, 0.10, 0.07, (0.26, 0.07), (0.20, 0.06),
             C['body'], C['fleck'])


SPECIES['owl'] = dict(
    build=bip_build, decor=bip_owl,
    dims=dict(leg_len=0.06, leg=(0.10, 0.09), leg_x=0.11, hip_y=0.0, leg_top=0.20, foot=(0.17, 0.19, 0.05),
              foot_fwd=0.08, body=(0.48, 0.40, 0.50), body_bevel=0.3, sink=0.03, neck_at=(0.20, -0.05),
              head=(0.56, 0.42, 0.44), head_bevel=0.3, head_fwd=0.04, eye=(0.13, 0.03), eye_e=0.115,
              eye_kind='ring', eye_out=0.012, wing=(0.06, 0.26, 0.38), wing_at=(0.02, 0.0), trail=62,
              pose=dict(walk=14, run=18, waddle=6, slide=0.03, yaw=5, run_pitch=8, run_wing=24, bob=0.0, look=26,
                        eat_pitch=45, eat_max=58, lie_pitch=14, sit_pitch=-6, lie_head=-8, sleep_max=20, sad_max=24,
                        poop_pitch=8, pee_pitch=0, hop=0.18)),
    col=dict(beak='#3A3432', iris='#FFC61E', claw='#4A4440', face='#FFFFFF', lid='#FFFFFF'),
    variants={
        'male':    dict(s=0.62, flecks=((-0.07, 0.10), (0.07, 0.10), (0.0, -0.02), (-0.07, -0.14), (0.07, -0.14)),
                        wing_bars=(-0.2, 0.15), spots=((-0.08, 0.02), (0.08, -0.03)),
                        col=dict(body='#F6F4EE', fleck='#6A635E', foot='#F6F4EE')),
        'female':  dict(s=0.67, flecks=((-0.09, 0.16), (0.01, 0.14), (0.09, 0.17), (-0.045, 0.06), (0.05, 0.04),
                                        (-0.095, -0.05), (-0.005, -0.06), (0.085, -0.04), (-0.05, -0.15), (0.04, -0.16)),
                        wing_bars=(-0.32, -0.14, 0.04, 0.22),
                        spots=((-0.10, 0.03), (0.0, -0.03), (0.10, 0.03), (-0.05, 0.10), (0.06, 0.10)),
                        col=dict(body='#F1EEE6', fleck='#4E4844', foot='#F1EEE6')),
        'young_m': dict(s=0.36, head_k=1.18, body_h=0.85, eye_k=1.08,
                        col=dict(body='#8E8984', wing='#7A7570', face='#F2EFEA', lid='#F2EFEA', fleck='#6E6964',
                                 foot='#8E8984')),
        'young_f': dict(s=0.36, head_k=1.18, body_h=0.85, eye_k=1.08, tufts=True, wing_bars=(-0.1, 0.2),
                        col=dict(body='#B9B3AC', wing='#A8A29B', face='#FFFFFF', fleck='#F6F4EE', tuft='#DAD5CE',
                                 foot='#B9B3AC')),
    })


# ---------------------------------------------------------------- kangoeroe
def bip_kangaroo(c):
    b, C, P, k, L = c.b, c.C, c.P, c.k, c.L
    hcy, hz, hh, face, NB, bz = c.hcy, c.hz, c.hh, c.face, c.NB, c.bz
    q = P.get('leg_k', 1.0)
    # romp: brede heupen, daarboven een bovenlijf dat iets voorover helt
    lean = 18
    Rl = Matrix.Rotation(math.radians(lean), 3, 'X')
    tc = Vector((0, -0.13, bz + 0.34))
    b.box('body', C['body'], (0.42, 0.46, 0.36), (0, 0.02, bz), bevel=0.36)
    b.box('body', C['body'], (0.35, 0.33, 0.56), tc, rx=lean, bevel=0.32)
    b.box('body', C['belly'], (0.24, 0.06, 0.42), tc + Rl @ Vector((0, -0.15, -0.02)), rx=lean, bevel=0.4, seg=1)
    if P.get('chest'):   # mannetje: brede borst
        b.box('body', C['body'], (0.42, 0.31, 0.25), tc + Rl @ Vector((0, -0.02, 0.15)), rx=lean, bevel=0.36)
    bip_neck(c, C['body'], 0.21, 0.20, ty=0.04, tz=-0.07, low=0.06)
    c.extra['icon_low'] = None
    # snuit, neus en lange oren
    b.box('head', C['muzzle'], (0.17 * k, 0.18 * k, 0.14 * k), (0, face - 0.055 * k, hz - 0.05 * k))
    b.box('head', C['nose'], (0.08 * k, 0.04 * k, 0.05 * k), (0, face - 0.14 * k, hz - 0.01 * k), seg=1)
    for sx in (1, -1):
        ear = Vector((sx * 0.085 * k, hcy + 0.09 * k, hz + hh / 2 + 0.10 * k))
        b.box('head', C['body'], (0.085 * k, 0.05 * k, 0.26 * k), ear, taper=(2, 1.0, 0.5), hard=True, ry=sx * 12, seg=1)
        b.box('head', C['ear'], (0.045 * k, 0.02 * k, 0.17 * k), ear + Vector((0, -0.03 * k, 0)), taper=(2, 1.0, 0.5),
              hard=True, ry=sx * 12, seg=1)
    # grote achterpoten met lange voeten
    for bone, x, y in c.legs:
        b.box(bone, C['body'], (0.12, 0.30, 0.28 * q), (x, y - 0.02, L - 0.03 * q), bevel=0.36)
        b.box(bone, C['body'], (0.085, 0.10, 0.24 * q), (x, y - 0.07, 0.15 * q), seg=1)
        b.box(bone, C['paw'], (0.105, 0.40, 0.065), (x, y - 0.16, 0.0325), bevel=0.35)
    # korte armen (de vleugel-botten), draaipunt in de schouder
    Ra = Matrix.Rotation(math.radians(-32), 3, 'X')
    for bone, sx in (('leg_FL', 1), ('leg_FR', -1)):
        sh = Vector((sx * 0.195, NB.y, NB.z - 0.12))
        b.box(bone, C['body'], (0.075, 0.08, 0.25), sh + Ra @ Vector((0, 0, -0.10)), rx=-32, seg=1)
        b.box(bone, C['paw'], (0.08, 0.085, 0.07), sh + Ra @ Vector((0, 0, -0.225)), rx=-32, seg=1)
        c.piv[bone] = sh
    # dikke staart: schuin omlaag en dan over de grond
    tk = P.get('tail_k', 1.0)
    tz = bz - 0.07
    a1 = -math.degrees(math.asin(max(0.1, min(0.9, (tz - 0.085) / (0.36 * tk)))))
    tail_chain(c, (0, 0.20, tz), a1, -3, 0.36 * tk, 0.38 * tk, 0.15, 0.10, C['body'], C['body'])
    if P.get('pouch'):   # buidel met een jong dat eruit kijkt
        b.box('body', C['belly'], (0.26, 0.12, 0.20), (0, -0.215, bz + 0.10), bevel=0.4)
        b.box('body', C['slit'], (0.20, 0.03, 0.03), (0, -0.262, bz + 0.19), bevel=0)
        jy, jz = -0.275, bz + 0.245
        b.box('body', C['joey'], (0.13, 0.13, 0.12), (0, jy, jz), bevel=0.3, seg=1)
        b.box('body', C['muzzle'], (0.075, 0.05, 0.06), (0, jy - 0.075, jz - 0.02), seg=1)
        b.box('body', C['nose'], (0.035, 0.02, 0.025), (0, jy - 0.10, jz - 0.005), bevel=0)
        for sx in (1, -1):
            b.box('body', C['joey'], (0.04, 0.03, 0.10), (sx * 0.04, jy + 0.03, jz + 0.095), taper=(2, 1.0, 0.5),
                  hard=True, seg=1)
            b.box('body', C['eye'], (0.028, 0.012, 0.032), (sx * 0.036, jy - 0.066, jz + 0.015), bevel=0)


SPECIES['kangaroo'] = dict(
    build=bip_build, decor=bip_kangaroo, view=1.2,
    dims=dict(own_body=True, own_legs=True, leg_len=0.36, leg_x=0.245, hip_y=0.06, body=(0.42, 0.46, 0.36), sink=0.18,
              neck_pt=(-0.215, 0.58), neck=(0.03, 0.02), head=(0.25, 0.30, 0.25), head_bevel=0.22, head_fwd=0.2,
              eye=(0.082, 0.045), eye_e=0.062, hide=0.10, max_drop=0.10, tail_rest=True, arms=True, hops=True,
              pose=dict(lie='side', side_roll=-80, eat_pitch=40, eat_max=60, eat_arm=30, sit_pitch=-10, poop_pitch=-6, bob=0.0,
                        tail_up=46, hop=0.26, wag=0.4, sad_max=32, sad_tail=0, look=14)),
    col=dict(nose='#3A2620'),
    variants={
        'male':    dict(s=0.80, chest=True,
                        col=dict(body='#B5683C', belly='#EBD3B0', muzzle='#E2C29C', paw='#6E3E24', ear='#E8A89A')),
        'female':  dict(s=0.72, pouch=True,
                        col=dict(body='#9A9FA8', belly='#EDEEF0', muzzle='#DADCE0', paw='#5E636C', ear='#E8B4B0',
                                 joey='#B8BCC4', slit='#6E737C')),
        'young_m': dict(s=0.46, head_k=1.25, leg_k=0.80, tail_k=0.85, eye_k=1.2,
                        col=dict(body='#C98250', belly='#F2DFC2', muzzle='#EBD0AE', paw='#8A5232', ear='#EDB4A6')),
        'young_f': dict(s=0.46, head_k=1.25, leg_k=0.80, tail_k=0.85, eye_k=1.2,
                        col=dict(body='#B4B9C1', belly='#F4F5F6', muzzle='#E6E8EB', paw='#787D86', ear='#EFC2BE')),
    })
