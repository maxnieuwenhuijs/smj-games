// De figuren als 2D-portret: de vijf van het park, en de juf en de meester die met een schoolklas meekomen.
// Elk portret is opgebouwd uit laagjes: een vaste basis, drie gezichten (blij, bezorgd, dringend) en drie
// mondjes (dicht, half, open).
export type FigureId = 'director' | 'keeper' | 'builder' | 'host' | 'cashier' | 'teacher' | 'master';
export type Mood = 'happy' | 'worried' | 'urgent';
export type Mouth = 0 | 1 | 2;
/** Wie er met een schoolklas meekomt: de juf of de meester. */
export type TeacherId = 'teacher' | 'master';

/** De mensen van het park zelf. Alleen zij roepen de speler bij zijn naam. */
export const STAFF: FigureId[] = ['director', 'keeper', 'builder', 'host', 'cashier'];
export const TEACHERS: TeacherId[] = ['teacher', 'master'];
export const FIGURES: FigureId[] = [...STAFF, ...TEACHERS];
export const MOODS: Mood[] = ['happy', 'worried', 'urgent'];

const INK = '#3a2a1a';
const MOUTH = '#5a2a1e';
const TONGUE = '#f0767a';

interface Look {
  bg: string;
  skin: string;
  shirt: string;
  hair: string;
  /** Hoogte van de mond; lager als er een snor boven zit. */
  mouthY: number;
  /** Achter het hoofd, bijvoorbeeld een staart of knot. */
  back: string;
  /** Op de kleding. */
  outfit: string;
  /** Over het hoofd: haar, pet, helm. */
  top: string;
  /** Over het gezicht: bril, snor. */
  face: string;
}

const LOOKS: Record<FigureId, Look> = {
  director: {
    bg: '#ffe7a8', skin: '#f2c9a0', shirt: '#2f5d50', hair: '#c9cdd2', mouthY: 75,
    back: '',
    outfit:
      '<path d="M50 92 L60 106 L70 92Z" fill="#fff"/>' +
      '<path d="M60 95 L49 89 L49 101Z M60 95 L71 89 L71 101Z" fill="#e0584f"/><circle cx="60" cy="95" r="3" fill="#b8433b"/>',
    top: '<path d="M33 56 Q29 30 60 28 Q91 30 87 56 Q85 42 72 39 L48 39 Q35 42 33 56Z" fill="#c9cdd2"/>',
    face:
      '<g fill="none" stroke="#3a2a1a" stroke-width="2"><circle cx="50" cy="58" r="8"/><circle cx="70" cy="58" r="8"/><path d="M58 58 L62 58"/></g>' +
      '<path d="M47 69 Q54 63 60 67 Q66 63 73 69 Q66 72 60 70 Q54 72 47 69Z" fill="#c9cdd2"/>',
  },
  keeper: {
    bg: '#cdefc4', skin: '#e8b48a', shirt: '#4fa35a', hair: '#7a4a22', mouthY: 71,
    back: '<path d="M82 38 Q108 42 100 78 Q94 66 84 58Z" fill="#7a4a22"/>',
    outfit: '<path d="M50 92 Q60 100 70 92 L70 96 Q60 104 50 96Z" fill="#3c8747"/>',
    top:
      '<rect x="32" y="44" width="7" height="18" rx="3.5" fill="#7a4a22"/><rect x="81" y="44" width="7" height="18" rx="3.5" fill="#7a4a22"/>' +
      '<path d="M31 46 Q33 21 60 21 Q87 21 89 46Z" fill="#3c8747"/><rect x="26" y="42" width="52" height="8" rx="4" fill="#2f6e39"/>' +
      '<g fill="#fff"><ellipse cx="61" cy="35" rx="4.5" ry="3.5"/><circle cx="55" cy="30" r="1.9"/><circle cx="61" cy="28" r="1.9"/><circle cx="67" cy="30" r="1.9"/></g>',
    face: '',
  },
  builder: {
    bg: '#ffd9b0', skin: '#a86b42', shirt: '#f08a2c', hair: '#2b1b14', mouthY: 71,
    back: '',
    outfit: '<rect x="38" y="95" width="8" height="25" fill="#fff3b0"/><rect x="74" y="95" width="8" height="25" fill="#fff3b0"/>',
    top:
      '<path d="M30 46 Q32 19 60 19 Q88 19 90 46Z" fill="#ffd23f"/><rect x="25" y="42" width="70" height="8" rx="4" fill="#e5b520"/>' +
      '<rect x="56" y="19" width="8" height="24" rx="4" fill="#e5b520"/>',
    face: '',
  },
  host: {
    bg: '#ffd6e4', skin: '#f6d2b8', shirt: '#e86a9a', hair: '#d9532b', mouthY: 71,
    back:
      '<circle cx="60" cy="20" r="12" fill="#d9532b"/>' +
      '<path d="M29 60 Q25 28 60 26 Q95 28 91 60 L91 80 Q84 86 80 78 L80 48 L40 48 L40 78 Q36 86 29 80Z" fill="#d9532b"/>',
    outfit: '<path d="M47 91 Q60 103 73 91 L73 96 Q60 109 47 96Z" fill="#fff"/>',
    top:
      '<path d="M33 52 Q35 29 60 29 Q85 29 87 52 Q76 38 60 41 Q45 38 33 52Z" fill="#d9532b"/>' +
      '<circle cx="83" cy="36" r="7" fill="#ffd23f"/><circle cx="83" cy="36" r="3" fill="#fff"/>',
    face: '',
  },
  cashier: {
    bg: '#dcd3ff', skin: '#d9a070', shirt: '#7a5cc9', hair: '#3a2a1a', mouthY: 71,
    back: '',
    outfit: '<circle cx="80" cy="106" r="8" fill="#ffd23f" stroke="#e5b520" stroke-width="2.5"/>',
    top:
      '<path d="M33 54 Q31 27 60 27 Q89 27 87 54 Q83 40 60 40 Q37 40 33 54Z" fill="#3a2a1a"/>' +
      '<path d="M32 45 Q60 33 88 45 L88 50 Q60 39 32 50Z" fill="#2bb5a8"/>',
    face: '<g fill="none" stroke="#3a2a1a" stroke-width="2.2"><circle cx="50" cy="58" r="8.5"/><circle cx="70" cy="58" r="8.5"/><path d="M58.5 58 L61.5 58"/></g>',
  },
  // de juf: blond haar in een knot met een potlood erdoor, een rode bril en een oranje vest over een witte blouse
  teacher: {
    bg: '#cfe6ff', skin: '#f3cba8', shirt: '#f08a24', hair: '#e6b446', mouthY: 71,
    back:
      '<path d="M41 9 L80 25" stroke="#4a90e2" stroke-width="4.5" stroke-linecap="round"/><path d="M41 9 L46.5 11.3" stroke="#3a2a1a" stroke-width="4.5" stroke-linecap="round"/>' +
      '<circle cx="60" cy="18" r="11.5" fill="#e6b446"/><path d="M52 14 Q60 9 68 14" fill="none" stroke="#c9972f" stroke-width="2" stroke-linecap="round"/>',
    outfit:
      '<path d="M48 91 L60 113 L72 91Z" fill="#fff"/><path d="M48 91 L60 113 L72 91" fill="none" stroke="#c96f14" stroke-width="3" stroke-linejoin="round"/>' +
      '<circle cx="60" cy="116" r="2.4" fill="#fff3d6"/><path d="M53 92 Q60 99 67 92" fill="none" stroke="#e0584f" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="0.5 4"/>',
    top:
      '<path d="M33 56 Q30 27 60 27 Q90 27 87 56 Q84 42 68 38 Q50 42 33 56Z" fill="#e6b446"/>' +
      '<path d="M40 40 Q52 31 68 36" fill="none" stroke="#c9972f" stroke-width="2" stroke-linecap="round"/>',
    face:
      '<g fill="none" stroke="#d9483b" stroke-width="2.6"><circle cx="50" cy="58" r="8.5"/><circle cx="70" cy="58" r="8.5"/><path d="M58.5 58 L61.5 58"/></g>' +
      '<circle cx="33.5" cy="67" r="2.6" fill="#ffd23f"/><circle cx="86.5" cy="67" r="2.6" fill="#ffd23f"/>',
  },
  // de meester: kort bruin haar, een baard en een groene trui met een geel randje
  master: {
    bg: '#f6e6c8', skin: '#e9b98f', shirt: '#4f9a5a', hair: '#a85f2a', mouthY: 73,
    back: '',
    outfit:
      '<path d="M51 90 L60 100 L69 90Z" fill="#fff"/><path d="M47 92 Q60 106 73 92" fill="none" stroke="#3c7f47" stroke-width="4" stroke-linecap="round"/>' +
      '<path d="M27.5 113 l6.5 -5 l6.5 5 l6.5 -5 l6.5 5 l6.5 -5 l6.5 5 l6.5 -5 l6.5 5 l6.5 -5 l6.5 5" fill="none" stroke="#ffd23f" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
    top:
      '<rect x="32" y="45" width="6.5" height="17" rx="3" fill="#a85f2a"/><rect x="81.5" y="45" width="6.5" height="17" rx="3" fill="#a85f2a"/>' +
      '<path d="M33 52 Q31 25 60 25 Q89 25 87 52 Q82 39 66 38 Q60 33 52 38 Q38 40 33 52Z" fill="#a85f2a"/>',
    face:
      '<path d="M34 58 Q33 90 60 92 Q87 90 86 58 Q84 68 76 66.5 Q60 61 44 66.5 Q36 68 34 58Z" fill="#a85f2a"/>' +
      '<ellipse cx="60" cy="75.5" rx="12.5" ry="9" fill="#e9b98f"/>',
  },
};

function eyes(mood: Mood): string {
  let out = '';
  for (const x of [50, 70]) {
    if (mood === 'urgent') out += `<circle cx="${x}" cy="58" r="6.6" fill="#fff"/><circle cx="${x}" cy="58" r="3.3" fill="${INK}"/>`;
    else out += `<circle cx="${x}" cy="58" r="4" fill="${INK}"/><circle cx="${x + 1.4}" cy="56.6" r="1.3" fill="#fff"/>`;
  }
  return out;
}

function brows(mood: Mood): string {
  const d = {
    happy: 'M44 49 Q50 46 56 49 M64 49 Q70 46 76 49',
    worried: 'M44 50 L56 46 M76 50 L64 46',
    urgent: 'M44 46 Q50 41 56 45 M64 45 Q70 41 76 46',
  }[mood];
  return `<path d="${d}" fill="none" stroke="${INK}" stroke-width="2.8" stroke-linecap="round"/>`;
}

function extras(mood: Mood): string {
  if (mood === 'happy') return '<circle cx="42" cy="68" r="5" fill="#ff9e9e" opacity="0.55"/><circle cx="78" cy="68" r="5" fill="#ff9e9e" opacity="0.55"/>';
  const drop = '<path d="M92 50 Q97 58 92 61 Q87 58 92 50Z" fill="#7fc8f0"/>';
  if (mood === 'worried') return drop;
  return drop + '<circle cx="100" cy="20" r="12" fill="#e0453a"/><rect x="98" y="12" width="4" height="10" rx="2" fill="#fff"/><circle cx="100" cy="26" r="2.2" fill="#fff"/>';
}

function mouth(mood: Mood, frame: Mouth, y: number): string {
  const line = (d: string) => `<path d="${d}" fill="none" stroke="${MOUTH}" stroke-width="3" stroke-linecap="round"/>`;
  const oval = (rx: number, ry: number, dy: number) => `<ellipse cx="60" cy="${y + dy}" rx="${rx}" ry="${ry}" fill="${MOUTH}"/>`;
  const tongue = (dy: number) => `<ellipse cx="60" cy="${y + dy}" rx="4" ry="2.6" fill="${TONGUE}"/>`;
  if (mood === 'happy') {
    if (frame === 0) return line(`M51 ${y - 1} Q60 ${y + 7} 69 ${y - 1}`);
    if (frame === 1) return `<path d="M51 ${y - 1} Q60 ${y + 9} 69 ${y - 1}Z" fill="${MOUTH}"/>`;
    return `<path d="M50 ${y - 2} Q60 ${y + 15} 70 ${y - 2}Z" fill="${MOUTH}"/>` + tongue(4.5);
  }
  if (mood === 'worried') {
    if (frame === 0) return line(`M53 ${y + 3} Q60 ${y - 2} 67 ${y + 3}`);
    return frame === 1 ? oval(5, 3, 2) : oval(6, 6, 3);
  }
  if (frame === 0) return oval(3.6, 2.6, 2);
  return frame === 1 ? oval(5, 5, 3) : oval(7, 8.5, 4) + tongue(8);
}

/** Het portret als SVG-tekst. */
export function portrait(id: FigureId, mood: Mood = 'happy', frame: Mouth = 0): string {
  const l = LOOKS[id];
  return (
    '<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<defs><clipPath id="fig-clip"><circle cx="60" cy="60" r="60"/></clipPath></defs>' +
    `<circle cx="60" cy="60" r="60" fill="${l.bg}"/>` +
    '<g clip-path="url(#fig-clip)">' +
    l.back +
    `<path d="M20 122 Q20 91 60 91 Q100 91 100 122Z" fill="${l.shirt}"/>` +
    l.outfit +
    `<rect x="53" y="78" width="14" height="16" fill="${l.skin}"/>` +
    `<circle cx="34" cy="60" r="5.5" fill="${l.skin}"/><circle cx="86" cy="60" r="5.5" fill="${l.skin}"/>` +
    `<rect x="34" y="32" width="52" height="52" rx="20" fill="${l.skin}"/>` +
    l.top +
    extras(mood) + eyes(mood) + brows(mood) + l.face + mouth(mood, frame, l.mouthY) +
    '</g></svg>'
  );
}
