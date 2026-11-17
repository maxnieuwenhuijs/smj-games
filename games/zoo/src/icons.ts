// Eigen plaatjes voor knoppen, wolkjes en cursors. Geen emoji: die zien er op elk apparaat anders uit.
const WOOD = '#c58a4b', WOOD_D = '#a8743f', INK = '#3a2a1a', GRASS = '#86c95c', GRASS_D = '#5fa544';
const MUD = '#9c6b44', MUD_D = '#7a5132', RED = '#e0584f', SUN = '#ffd23f', SUN_D = '#e5b520';
const SKIN = '#f6cfa6', PINK = '#f3a6b8', PINK_D = '#e27f9c', GREEN = '#6cc04a', GREY = '#8a8f98';

const tile = (a: string, b = a): string =>
  `<path d="M24 9 L45 24 L24 39 L3 24Z" fill="${a}"/>` + (b !== a ? `<path d="M24 9 L45 24 L24 39Z" fill="${b}"/>` : '');
const disc = (c: string): string => `<circle cx="24" cy="24" r="20" fill="${c}"/>`;
const face = (c: string, mouth: string): string =>
  `<circle cx="24" cy="24" r="20" fill="${c}" stroke="#fff" stroke-width="3"/><circle cx="17" cy="20" r="3" fill="${INK}"/><circle cx="31" cy="20" r="3" fill="${INK}"/>` +
  `<path d="${mouth}" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`;

const HAND =
  `<g fill="${SKIN}" stroke="${INK}" stroke-width="2" stroke-linejoin="round">` +
  '<rect x="13" y="10" width="6" height="18" rx="3"/><rect x="19" y="6" width="6" height="20" rx="3"/>' +
  '<rect x="25" y="7" width="6" height="20" rx="3"/><rect x="31" y="11" width="6" height="17" rx="3"/>' +
  '<path d="M13 26 L8 20 Q5 16 8 14 Q11 12 13 17Z"/><path d="M13 21 V32 Q13 43 25 43 Q37 43 37 32 V21"/></g>';
const HEART = `<path d="M24 41 C6 28 6 11 16 9 C21 8 24 12 24 15 C24 12 27 8 32 9 C42 11 42 28 24 41Z" fill="${RED}"/>`;
const CARROT =
  '<path d="M30 15 Q37 19 33 26 L13 41 Q8 42 8 37Z" fill="#f08a2c"/><path d="M18 30 l4 3 M24 25 l4 3" stroke="#c96a15" stroke-width="2" stroke-linecap="round"/>' +
  `<path d="M31 16 L33 5 M33 18 L43 13 M32 15 L41 6" stroke="${GRASS_D}" stroke-width="4" stroke-linecap="round"/>`;
const TROUGH =
  `<path d="M5 22 H43 L39 38 Q38 41 35 41 H13 Q10 41 9 38Z" fill="${WOOD_D}"/><rect x="3" y="18" width="42" height="7" rx="3" fill="${WOOD}"/>`;

const ICONS = {
  hand: HAND,
  terrain:
    tile(GRASS, MUD) +
    `<path d="M11 25 l2 -5 l2 5" fill="none" stroke="${GRASS_D}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="33" cy="26" rx="5" ry="2.5" fill="${MUD_D}"/>`,
  grass:
    tile(GRASS) +
    `<path d="M13 25 l2 -5 l2 5 M23 32 l2 -5 l2 5 M27 20 l2 -5 l2 5" fill="none" stroke="${GRASS_D}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  mud:
    tile(MUD) +
    `<ellipse cx="17" cy="24" rx="6" ry="3" fill="${MUD_D}"/><ellipse cx="30" cy="30" rx="5" ry="2.5" fill="${MUD_D}"/><ellipse cx="29" cy="19" rx="4" ry="2" fill="${MUD_D}"/>`,
  fence:
    `<g fill="${WOOD}"><rect x="3" y="17" width="42" height="6" rx="2"/><rect x="3" y="29" width="42" height="6" rx="2"/></g>` +
    `<g fill="${WOOD_D}"><rect x="6" y="10" width="7" height="30" rx="2"/><rect x="20.5" y="10" width="7" height="30" rx="2"/><rect x="35" y="10" width="7" height="30" rx="2"/></g>`,
  gate:
    `<rect x="11" y="18" width="26" height="22" rx="2" fill="${WOOD}"/><path d="M11 18 L37 40 M37 18 L11 40" stroke="${WOOD_D}" stroke-width="3"/>` +
    `<g fill="${WOOD_D}"><rect x="5" y="8" width="7" height="34" rx="2"/><rect x="36" y="8" width="7" height="34" rx="2"/></g><rect x="3" y="5" width="42" height="7" rx="2" fill="${WOOD}"/>`,
  boy:
    disc('#4a90e2') +
    '<circle cx="21" cy="28" r="8" fill="none" stroke="#fff" stroke-width="4"/><path d="M27 22 L36 13 M36 13 H28 M36 13 V21" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>',
  girl:
    disc('#f06aa6') +
    '<circle cx="24" cy="19" r="8" fill="none" stroke="#fff" stroke-width="4"/><path d="M24 27 V39 M18 33 H30" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>',
  trough:
    '<path d="M12 20 L15 8 L18 20Z M21 20 L24 6 L27 20Z M30 20 L33 9 L36 20Z" fill="#f08a2c"/>' +
    `<path d="M15 8 l-2 -4 M15 8 l2 -4 M24 6 l-2 -4 M24 6 l2 -4 M33 9 l-2 -4 M33 9 l2 -4" stroke="${GRASS_D}" stroke-width="2.5" stroke-linecap="round"/>` +
    TROUGH,
  trough_empty: TROUGH + `<rect x="8" y="20" width="32" height="3" rx="1.5" fill="${INK}" opacity=".35"/>`,
  straw:
    '<ellipse cx="24" cy="33" rx="20" ry="9" fill="#c9a93a"/><ellipse cx="24" cy="29" rx="18" ry="9" fill="#e9d05a"/>' +
    '<path d="M11 27 l6 -4 M20 24 l7 -2 M30 25 l6 3 M15 32 l8 -2 M27 31 l8 1" fill="none" stroke="#c9a93a" stroke-width="2.5" stroke-linecap="round"/>',
  shed:
    `<rect x="9" y="20" width="30" height="22" fill="${WOOD_D}"/><rect x="14" y="26" width="20" height="16" rx="2" fill="${INK}" opacity=".45"/>` +
    '<ellipse cx="24" cy="41" rx="12" ry="3.5" fill="#e9d05a"/><path d="M3 23 L24 6 L45 23 L41 27 L24 13 L7 27Z" fill="#c0523f"/>',
  rock: '<path d="M5 37 L10 20 L22 12 L36 16 L44 30 L40 38Z" fill="#a9adb3"/><path d="M10 20 L22 25 L36 16 M22 25 L24 38" fill="none" stroke="#7d8189" stroke-width="2"/>',
  shade:
    `<rect x="21" y="24" width="6" height="19" rx="2" fill="${WOOD_D}"/><ellipse cx="24" cy="18" rx="19" ry="13" fill="${GRASS_D}"/><ellipse cx="18" cy="14" rx="8" ry="5" fill="${GRASS}"/>`,
  wall:
    '<g fill="#a9adb3"><rect x="6" y="8" width="8" height="8" rx="1"/><rect x="20" y="8" width="8" height="8" rx="1"/><rect x="34" y="8" width="8" height="8" rx="1"/><rect x="4" y="14" width="40" height="26" rx="2"/></g>' +
    '<path d="M4 23 H44 M4 31 H44 M16 14 V23 M30 14 V23 M10 23 V31 M24 23 V31 M38 23 V31 M16 31 V40 M30 31 V40" fill="none" stroke="#7d8189" stroke-width="2"/>',
  sand: tile('#ecd591') + '<g fill="#d3b96c"><circle cx="16" cy="24" r="1.8"/><circle cx="25" cy="30" r="1.8"/><circle cx="30" cy="20" r="1.8"/><circle cx="22" cy="18" r="1.4"/><circle cx="34" cy="27" r="1.4"/></g>',
  water: tile('#6ec3e8') + '<path d="M12 23 q3 -3 6 0 t6 0 M22 30 q3 -3 6 0 t6 0 M24 17 q3 -3 6 0" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>',
  path: tile('#d8c7ab') + '<g fill="#b9a686"><ellipse cx="15" cy="24" rx="4" ry="2.2"/><ellipse cx="26" cy="29" rx="4" ry="2.2"/><ellipse cx="30" cy="20" rx="4" ry="2.2"/><ellipse cx="21" cy="17" rx="3" ry="1.7"/></g>',
  fruit:
    `<path d="M24 15 C12 9 6 20 9 30 C12 41 20 43 24 40 C28 43 36 41 39 30 C42 20 36 9 24 15Z" fill="#e0453a"/><path d="M24 15 Q24 8 28 5" fill="none" stroke="${WOOD_D}" stroke-width="3" stroke-linecap="round"/>` +
    `<path d="M27 9 Q35 4 38 10 Q31 14 27 9Z" fill="${GRASS_D}"/><ellipse cx="16" cy="24" rx="3" ry="5" fill="#f0766c"/>`,
  grain:
    '<path d="M12 16 Q24 22 36 16 L40 38 Q24 46 8 38Z" fill="#e3c88f"/><path d="M14 12 Q24 6 34 12 Q24 20 14 12Z" fill="#cfae6e"/>' +
    '<path d="M24 23 V37 M24 27 l-5 -4 M24 27 l5 -4 M24 32 l-5 -4 M24 32 l5 -4" fill="none" stroke="#b08a45" stroke-width="2.5" stroke-linecap="round"/>',
  meat:
    '<path d="M29 29 L39 39" stroke="#f4ead8" stroke-width="6" stroke-linecap="round"/><circle cx="40" cy="36" r="4" fill="#f4ead8"/><circle cx="36" cy="40" r="4" fill="#f4ead8"/>' +
    '<ellipse cx="20" cy="20" rx="15" ry="12" fill="#c9553f" transform="rotate(-35 20 20)"/><ellipse cx="16" cy="16" rx="6" ry="3.5" fill="#e0806a" transform="rotate(-35 16 16)"/>',
  leaves:
    `<path d="M8 41 Q24 30 41 8" fill="none" stroke="${WOOD_D}" stroke-width="3" stroke-linecap="round"/>` +
    `<g fill="${GRASS_D}"><ellipse cx="14" cy="28" rx="8" ry="4.5" transform="rotate(-60 14 28)"/><ellipse cx="27" cy="33" rx="8" ry="4.5" transform="rotate(15 27 33)"/><ellipse cx="24" cy="17" rx="8" ry="4.5" transform="rotate(-65 24 17)"/><ellipse cx="37" cy="21" rx="8" ry="4.5" transform="rotate(10 37 21)"/></g>`,
  coin: `<circle cx="24" cy="24" r="19" fill="${SUN}" stroke="${SUN_D}" stroke-width="4"/><circle cx="24" cy="24" r="10" fill="none" stroke="${SUN_D}" stroke-width="2.5"/>`,
  guest: `<path d="M6 45 Q6 29 24 29 Q42 29 42 45Z" fill="#4a90e2"/><circle cx="24" cy="17" r="11" fill="${SKIN}"/><path d="M13 15 Q24 1 35 15 Q24 10 13 15Z" fill="#7a4a22"/><circle cx="20" cy="18" r="1.8" fill="${INK}"/><circle cx="28" cy="18" r="1.8" fill="${INK}"/>`,
  foodstall:
    `<rect x="8" y="24" width="32" height="18" rx="2" fill="${WOOD}"/><path d="M4 10 H44 L46 23 H2Z" fill="#fff"/><path d="M4 10 H12 L10.5 23 H2Z M20 10 H28 L28.5 23 H19.5Z M36 10 H44 L46 23 H37.5Z" fill="${RED}"/>` +
    `<path d="M17 36 Q24 26 31 36Z" fill="#e9a23b"/><rect x="16" y="36" width="16" height="3" rx="1.5" fill="#7a4a22"/>`,
  drinkstall:
    `<rect x="8" y="24" width="32" height="18" rx="2" fill="${WOOD}"/><path d="M4 10 H44 L46 23 H2Z" fill="#fff"/><path d="M4 10 H12 L10.5 23 H2Z M20 10 H28 L28.5 23 H19.5Z M36 10 H44 L46 23 H37.5Z" fill="#4a90e2"/>` +
    '<path d="M19 28 H29 L27.5 40 H20.5Z" fill="#cfeaff"/><path d="M26 28 L29 22" stroke="#e0584f" stroke-width="2" stroke-linecap="round"/>',
  bench:
    `<g fill="${WOOD_D}"><rect x="9" y="18" width="5" height="24" rx="1.5"/><rect x="34" y="18" width="5" height="24" rx="1.5"/></g><rect x="5" y="26" width="38" height="6" rx="2" fill="${WOOD}"/><rect x="5" y="12" width="38" height="9" rx="2" fill="${WOOD}"/>`,
  born: `${HEART}<g transform="translate(25 25) scale(.46)"><circle cx="24" cy="24" r="22" fill="#6cc04a" stroke="#fff" stroke-width="4"/><path d="M24 13 V35 M13 24 H35" stroke="#fff" stroke-width="6" stroke-linecap="round"/></g>`,
  paw:
    '<g fill="#7a4a22"><ellipse cx="24" cy="31" rx="10" ry="8"/><ellipse cx="11" cy="21" rx="4" ry="5.5"/><ellipse cx="19.5" cy="13" rx="4" ry="5.5"/>' +
    '<ellipse cx="28.5" cy="13" rx="4" ry="5.5"/><ellipse cx="37" cy="21" rx="4" ry="5.5"/></g>',
  erase:
    `<rect x="16" y="20" width="24" height="12" rx="2" fill="${SUN}"/><rect x="26" y="9" width="13" height="12" rx="2" fill="${SUN_D}"/><rect x="29" y="12" width="7" height="6" rx="1" fill="#cfeaff"/>` +
    `<path d="M12 17 Q5 27 10 38 L15 38 L15 17Z" fill="${GREY}"/><rect x="14" y="31" width="30" height="10" rx="5" fill="${INK}"/>` +
    `<g fill="${GREY}"><circle cx="20" cy="36" r="2.5"/><circle cx="29" cy="36" r="2.5"/><circle cx="38" cy="36" r="2.5"/></g>`,
  veg: CARROT,
  hay:
    '<path d="M8 14 l3 3 M22 11 l1 5 M38 13 l-3 4 M28 11 l2 5" stroke="#e9d05a" stroke-width="2.5" stroke-linecap="round"/>' +
    '<rect x="6" y="15" width="36" height="24" rx="5" fill="#e9d05a"/><rect x="14" y="15" width="4" height="24" fill="#c9a93a"/><rect x="30" y="15" width="4" height="24" fill="#c9a93a"/>',
  pig:
    `<path d="M9 16 L11 6 L20 12Z M39 16 L37 6 L28 12Z" fill="${PINK_D}"/><circle cx="24" cy="26" r="17" fill="${PINK}"/><ellipse cx="24" cy="31" rx="9" ry="6.5" fill="${PINK_D}"/>` +
    `<circle cx="20.5" cy="31" r="1.8" fill="#9c4a63"/><circle cx="27.5" cy="31" r="1.8" fill="#9c4a63"/><circle cx="17" cy="21" r="2.4" fill="${INK}"/><circle cx="31" cy="21" r="2.4" fill="${INK}"/>`,
  cow:
    `<path d="M13 12 L9 3 L18 9Z M35 12 L39 3 L30 9Z" fill="#f1e2bd"/><ellipse cx="7" cy="19" rx="5" ry="3.5" fill="${INK}"/><ellipse cx="41" cy="19" rx="5" ry="3.5" fill="${INK}"/>` +
    `<rect x="9" y="8" width="30" height="34" rx="12" fill="#fff"/><path d="M26 8 H31 Q39 8 39 18 V24 Q30 26 26 18Z" fill="${INK}"/><ellipse cx="24" cy="34" rx="12" ry="8" fill="${PINK}"/>` +
    `<circle cx="19.5" cy="34" r="2" fill="#9c4a63"/><circle cx="28.5" cy="34" r="2" fill="#9c4a63"/><circle cx="17" cy="20" r="2.4" fill="${INK}"/><circle cx="31.5" cy="19" r="2.6" fill="#fff"/><circle cx="31.5" cy="19" r="1.3" fill="${INK}"/>`,
  sheep:
    '<g fill="#f4f1e8"><circle cx="14" cy="17" r="8"/><circle cx="34" cy="17" r="8"/><circle cx="10" cy="28" r="7"/><circle cx="38" cy="28" r="7"/></g>' +
    '<ellipse cx="10" cy="24" rx="4.5" ry="3" fill="#55505a" transform="rotate(-20 10 24)"/><ellipse cx="38" cy="24" rx="4.5" ry="3" fill="#55505a" transform="rotate(20 38 24)"/>' +
    '<ellipse cx="24" cy="29" rx="11" ry="13" fill="#55505a"/><circle cx="24" cy="13" r="8.5" fill="#f4f1e8"/>' +
    `<circle cx="19.5" cy="27" r="3" fill="#fff"/><circle cx="28.5" cy="27" r="3" fill="#fff"/><circle cx="19.5" cy="27" r="1.5" fill="${INK}"/><circle cx="28.5" cy="27" r="1.5" fill="${INK}"/><ellipse cx="24" cy="36" rx="3" ry="2" fill="#38343c"/>`,
  pen:
    `<path d="M24 12 L42 24 L24 36 L6 24Z" fill="${GRASS}" stroke="${WOOD}" stroke-width="4" stroke-linejoin="round"/>` +
    `<g fill="${WOOD_D}"><rect x="21" y="5" width="6" height="11" rx="2"/><rect x="39" y="17" width="6" height="11" rx="2"/><rect x="21" y="29" width="6" height="11" rx="2"/><rect x="3" y="17" width="6" height="11" rx="2"/></g>`,
  poop:
    '<g fill="#7a4a22"><ellipse cx="24" cy="36" rx="15" ry="7"/><ellipse cx="24" cy="26" rx="11" ry="6.5"/><ellipse cx="24" cy="17" rx="7" ry="5.5"/><path d="M21 13 Q24 4 29 8 Q26 9 27 14Z"/></g>' +
    '<ellipse cx="19" cy="24" rx="3" ry="1.5" fill="#9a6a3a"/>',
  broom:
    `<path d="M39 5 L22 26" stroke="${WOOD_D}" stroke-width="5" stroke-linecap="round"/><path d="M14 20 L30 32 L22 43 L5 30Z" fill="${SUN}"/>` +
    `<path d="M10 31 l6 5 M14 27 l6 5" stroke="${SUN_D}" stroke-width="2"/><path d="M14 20 L30 32" stroke="${RED}" stroke-width="5" stroke-linecap="round"/>`,
  heart: HEART,
  star: `<path d="M24 4 L30 17 L44 19 L34 29 L36.5 43 L24 36.5 L11.5 43 L14 29 L4 19 L18 17Z" fill="${SUN}" stroke="${SUN_D}" stroke-width="2.5" stroke-linejoin="round"/>`,
  trophy:
    `<path d="M13 10 H6 Q6 22 14 22 M35 10 H42 Q42 22 34 22" fill="none" stroke="${SUN_D}" stroke-width="4"/><path d="M13 7 H35 V18 Q35 30 24 30 Q13 30 13 18Z" fill="${SUN}"/>` +
    `<rect x="21" y="29" width="6" height="8" fill="${SUN_D}"/><rect x="14" y="36" width="20" height="6" rx="2" fill="${SUN_D}"/>`,
  home: `<rect x="10" y="22" width="28" height="20" rx="2" fill="#fff3d6"/><path d="M4 25 L24 6 L44 25Z" fill="${RED}"/><rect x="20" y="29" width="8" height="13" rx="1.5" fill="${WOOD}"/>`,
  next: '<path d="M16 9 L40 24 L16 39Z" fill="#fff" stroke="#fff" stroke-width="4" stroke-linejoin="round"/>',
  check: disc(GREEN) + '<path d="M14 25 L21 32 L35 17" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>',
  cross: disc(RED) + '<path d="M16 16 L32 32 M32 16 L16 32" stroke="#fff" stroke-width="6" stroke-linecap="round"/>',
  plus: disc(GREEN) + '<path d="M24 13 V35 M13 24 H35" stroke="#fff" stroke-width="6" stroke-linecap="round"/>',
  smile_good: face(GREEN, 'M14 28 Q24 38 34 28'),
  smile_ok: face('#f5a623', 'M15 31 H33'),
  smile_bad: face(RED, 'M14 34 Q24 24 34 34'),
  sparkle: `<path d="M24 3 Q26 20 45 24 Q26 28 24 45 Q22 28 3 24 Q22 20 24 3Z" fill="#fff" stroke="${SUN}" stroke-width="2.5"/>`,
  pet: `<g transform="translate(0 9) scale(.82)">${HAND}</g><g transform="translate(25 0) scale(.48)">${HEART}</g>`,
  feed: `<g transform="translate(9 -2) scale(.62)">${CARROT}</g><path d="M5 32 Q24 46 43 32 L43 38 Q24 52 5 38Z" fill="${SKIN}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`,
  name:
    `<path d="M4 24 L16 10 H42 V38 H16Z" fill="#fff3d6" stroke="${WOOD_D}" stroke-width="3" stroke-linejoin="round"/><circle cx="15" cy="24" r="3" fill="${WOOD_D}"/>` +
    `<path d="M22 20 H37 M22 28 H33" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`,
  dice:
    `<rect x="7" y="7" width="34" height="34" rx="8" fill="#fff" stroke="${INK}" stroke-width="3"/><g fill="${INK}"><circle cx="16" cy="16" r="3.2"/><circle cx="32" cy="16" r="3.2"/>` +
    '<circle cx="24" cy="24" r="3.2"/><circle cx="16" cy="32" r="3.2"/><circle cx="32" cy="32" r="3.2"/></g>',
  sleep: disc('#6f8fe0') + '<path d="M13 14 H23 L13 26 H23 M27 22 H35 L27 32 H35" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>',
  move:
    disc('#2bb5a8') +
    '<path d="M24 9 V39 M9 24 H39 M24 9 l-5 5 M24 9 l5 5 M24 39 l-5 -5 M24 39 l5 -5 M9 24 l5 -5 M9 24 l5 5 M39 24 l-5 -5 M39 24 l-5 5" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>',
  empty:
    `<rect x="4" y="8" width="7" height="34" rx="2" fill="${WOOD_D}"/><rect x="11" y="13" width="6" height="26" rx="2" fill="${RED}"/>` +
    `<path d="M23 25 H41 M41 25 l-7 -7 M41 25 l-7 7" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`,
  trash:
    `<path d="M12 14 H36 L33 42 H15Z" fill="${GREY}"/><rect x="9" y="9" width="30" height="5" rx="2" fill="#6c7078"/><rect x="19" y="5" width="10" height="5" rx="2" fill="#6c7078"/>` +
    '<path d="M20 20 V36 M28 20 V36" stroke="#fff" stroke-width="3" stroke-linecap="round"/>',
  snow:
    tile('#f4f8fc', '#e2ecf5') +
    '<path d="M16 24 h8 M20 20 v8 M17 21 l6 6 M23 21 l-6 6 M29 29 h6 M32 26 v6" fill="none" stroke="#8fc3e8" stroke-width="2" stroke-linecap="round"/>',
  forest:
    tile('#4f9a4a', '#3f8a3f') +
    '<path d="M14 27 q4 -8 8 0 q-4 3 -8 0Z M27 22 q4 -8 8 0 q-4 3 -8 0Z M24 33 q3 -6 6 0 q-3 2 -6 0Z" fill="#2f7036"/>',
  net:
    '<rect x="5" y="5" width="6" height="39" rx="2" fill="#3f7f6b"/><rect x="37" y="5" width="6" height="39" rx="2" fill="#3f7f6b"/>' +
    '<path d="M11 9 H37 M11 19 H37 M11 29 H37 M11 39 H37 M18 7 V42 M24 7 V42 M30 7 V42" fill="none" stroke="#5aa58c" stroke-width="2.5"/>',
  fish:
    `<path d="M5 24 Q18 9 35 24 Q18 39 5 24Z" fill="#7fa7c9"/><path d="M32 24 L44 13 V35Z" fill="#5f8db3"/><circle cx="14" cy="21" r="2.6" fill="${INK}"/>` +
    '<path d="M21 18 Q25 24 21 30" fill="none" stroke="#5f8db3" stroke-width="2.5" stroke-linecap="round"/>',
  bamboo:
    '<rect x="13" y="5" width="8" height="39" rx="3" fill="#9bd05a"/><rect x="27" y="9" width="8" height="35" rx="3" fill="#86bf48"/>' +
    `<path d="M13 17 H21 M13 30 H21 M27 21 H35 M27 34 H35" stroke="${GRASS_D}" stroke-width="2.5"/><path d="M35 14 Q45 9 46 19 Q39 20 35 14Z" fill="${GRASS_D}"/><path d="M13 12 Q4 8 3 17 Q9 18 13 12Z" fill="${GRASS_D}"/>`,
  nest:
    '<ellipse cx="24" cy="31" rx="20" ry="11" fill="#b98a4a"/><ellipse cx="24" cy="28" rx="14" ry="6" fill="#7d582b"/>' +
    '<ellipse cx="19" cy="25" rx="5" ry="6.5" fill="#fff"/><ellipse cx="29" cy="25" rx="5" ry="6.5" fill="#f1ece0"/>' +
    '<path d="M6 32 l6 -3 M36 30 l6 3 M14 39 l5 -2 M29 38 l6 2" stroke="#e0b872" stroke-width="2" stroke-linecap="round"/>',
  cave:
    '<path d="M4 41 Q3 10 24 8 Q45 10 44 41Z" fill="#8f949c"/><path d="M9 24 Q14 14 24 13" fill="none" stroke="#b4b8bf" stroke-width="3" stroke-linecap="round"/>' +
    `<path d="M14 41 Q13 22 24 22 Q35 22 34 41Z" fill="${INK}"/>`,
  climb:
    `<rect x="20" y="8" width="7" height="36" rx="2" fill="${WOOD_D}"/><rect x="5" y="21" width="23" height="5" rx="2" fill="${WOOD}"/><rect x="21" y="32" width="22" height="5" rx="2" fill="${WOOD}"/>` +
    `<circle cx="23.5" cy="10" r="8.5" fill="${GRASS_D}"/><path d="M38 37 V44" stroke="${INK}" stroke-width="2"/><circle cx="38" cy="45" r="2" fill="${INK}"/>`,
  toilet:
    '<rect x="5" y="5" width="38" height="38" rx="9" fill="#4a90e2"/><rect x="14" y="11" width="8" height="15" rx="2" fill="#fff"/>' +
    '<path d="M14 25 H36 Q36 35 27 35 H22 Q14 35 14 25Z" fill="#fff"/><rect x="21" y="34" width="9" height="5" rx="1" fill="#fff"/>',
  icecream:
    '<path d="M14 25 L24 46 L34 25Z" fill="#e3b778"/><path d="M18 30 L28 37 M22 26 L31 32" stroke="#c9975a" stroke-width="1.6"/>' +
    '<circle cx="24" cy="17" r="12" fill="#ffc1d6"/><circle cx="19" cy="12" r="3.2" fill="#fff" opacity=".7"/>',
  balloon:
    `<ellipse cx="24" cy="18" rx="12" ry="14" fill="${RED}"/><path d="M24 32 l-3 4 h6Z" fill="#b8433b"/>` +
    `<path d="M24 36 Q19 40 26 46" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/><ellipse cx="19" cy="12" rx="3" ry="4.5" fill="#fff" opacity=".55"/>`,
  flowers:
    `<rect x="8" y="31" width="32" height="12" rx="3" fill="${WOOD}"/><path d="M15 31 V21 M24 31 V17 M33 31 V21" stroke="${GRASS_D}" stroke-width="3"/>` +
    `<circle cx="15" cy="18" r="5.5" fill="${RED}"/><circle cx="24" cy="12" r="6" fill="${SUN}"/><circle cx="33" cy="18" r="5.5" fill="#f06aa6"/>` +
    '<circle cx="15" cy="18" r="2" fill="#fff"/><circle cx="24" cy="12" r="2.2" fill="#fff"/><circle cx="33" cy="18" r="2" fill="#fff"/>',
  bin:
    '<path d="M12 16 H36 L33 44 H15Z" fill="#3d8b5a"/><rect x="9" y="10" width="30" height="6" rx="2" fill="#2c6a43"/>' +
    '<path d="M20 22 V38 M28 22 V38" stroke="#bfe6c9" stroke-width="3" stroke-linecap="round"/>',
  litter:
    `<path d="M6 35 L13 22 L24 26 L26 37 L15 42Z" fill="#fff" stroke="${GREY}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M29 21 H41 L39 42 H31Z" fill="${RED}"/><rect x="27.5" y="17" width="15" height="5" rx="2" fill="#fff" stroke="${GREY}" stroke-width="1.2"/>`,
  sick:
    face('#bfd96e', 'M16 34 Q24 28 32 34') +
    `<rect x="27" y="27" width="16" height="5" rx="2.5" fill="#fff" stroke="${INK}" stroke-width="1.5" transform="rotate(-28 27 29)"/><circle cx="41.5" cy="20" r="3.6" fill="${RED}"/>`,
  vet:
    `<rect x="6" y="14" width="36" height="28" rx="6" fill="#fff" stroke="${GREY}" stroke-width="2.5"/><path d="M18 14 V10 Q18 7 21 7 H27 Q30 7 30 10 V14" fill="none" stroke="${GREY}" stroke-width="3.5"/>` +
    `<path d="M24 20 V36 M16 28 H32" stroke="${RED}" stroke-width="6.5" stroke-linecap="round"/>`,
  keeper:
    `<circle cx="24" cy="27" r="14" fill="${SKIN}"/><path d="M9 23 Q11 6 24 6 Q37 6 39 23Z" fill="#3c8747"/><rect x="5" y="20" width="28" height="6" rx="3" fill="#2f6e39"/>` +
    `<circle cx="19" cy="30" r="2.2" fill="${INK}"/><circle cx="29" cy="30" r="2.2" fill="${INK}"/><path d="M18 35 Q24 40 30 35" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>`,
  catch:
    `<path d="M7 43 L21 27" stroke="${WOOD_D}" stroke-width="5.5" stroke-linecap="round"/><circle cx="29" cy="18" r="13" fill="#fff" fill-opacity=".5" stroke="${INK}" stroke-width="3"/>` +
    `<path d="M18 13 H40 M17 21 H41 M22 8 V28 M29 5 V31 M36 8 V28" stroke="${GREY}" stroke-width="1.6"/>`,
  kinds:
    `<circle cx="15" cy="17" r="10.5" fill="${PINK}"/><circle cx="33" cy="17" r="10.5" fill="${SUN}"/><circle cx="24" cy="33" r="10.5" fill="#b98a5a"/>` +
    `<g fill="${INK}"><circle cx="12" cy="16" r="1.6"/><circle cx="18" cy="16" r="1.6"/><circle cx="30" cy="16" r="1.6"/><circle cx="36" cy="16" r="1.6"/><circle cx="21" cy="32" r="1.6"/><circle cx="27" cy="32" r="1.6"/></g>`,
  sound_on:
    `<path d="M5 19 H14 L25 9 V39 L14 29 H5Z" fill="${INK}"/><path d="M31 17 Q36 24 31 31 M36 11 Q45 24 36 37" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`,
  sound_off:
    `<path d="M5 19 H14 L25 9 V39 L14 29 H5Z" fill="${GREY}"/><path d="M31 18 L43 30 M43 18 L31 30" fill="none" stroke="${RED}" stroke-width="4.5" stroke-linecap="round"/>`,
  gear:
    `<circle cx="24" cy="24" r="16" fill="none" stroke="${GREY}" stroke-width="8" stroke-dasharray="6.28 6.28"/><circle cx="24" cy="24" r="10" fill="none" stroke="${GREY}" stroke-width="8"/>`,
  download:
    `<path d="M24 6 V28 M24 28 l-9 -9 M24 28 l9 -9 M8 34 V41 H40 V34" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`,
  upload:
    `<path d="M24 30 V8 M24 8 l-9 9 M24 8 l9 9 M8 34 V41 H40 V34" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`,
  globe:
    `<circle cx="24" cy="24" r="18" fill="#6ec3e8" stroke="${INK}" stroke-width="2.5"/><path d="M6 24 H42 M24 6 Q11 24 24 42 M24 6 Q37 24 24 42" fill="none" stroke="${INK}" stroke-width="2.5"/>`,
  souvenir:
    '<circle cx="14" cy="11" r="6" fill="#b07a4a"/><circle cx="34" cy="11" r="6" fill="#b07a4a"/><ellipse cx="24" cy="39" rx="11" ry="8" fill="#b07a4a"/>' +
    '<circle cx="24" cy="20" r="13" fill="#b07a4a"/><ellipse cx="24" cy="25" rx="6.5" ry="5" fill="#e3bf94"/><ellipse cx="24" cy="40" rx="6" ry="4.5" fill="#e3bf94"/>' +
    `<g fill="${INK}"><circle cx="19" cy="17" r="2"/><circle cx="29" cy="17" r="2"/><circle cx="24" cy="23" r="1.9"/></g>`,
  playground:
    `<path d="M9 44 V14 M21 44 V14 M9 24 H21 M9 34 H21" fill="none" stroke="${WOOD_D}" stroke-width="4" stroke-linecap="round"/>` +
    `<path d="M21 16 Q35 18 44 41" fill="none" stroke="${SUN}" stroke-width="8" stroke-linecap="round"/><path d="M5 14 L15 4 L25 14Z" fill="${RED}"/>`,
} satisfies Record<string, string>;

export type IconId = keyof typeof ICONS;
export const ICON_IDS = Object.keys(ICONS) as IconId[];

/** Het plaatje als SVG-tekst, om in HTML te zetten. */
export function icon(name: IconId, cls = ''): string {
  return `<svg class="ic ${cls}" viewBox="0 0 48 48" aria-hidden="true">${ICONS[name]}</svg>`;
}

/** Het plaatje als muiscursor. (hx, hy) is het punt waarmee je aanwijst. */
export function cursor(name: IconId, hx = 16, hy = 16, fallback = 'pointer'): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 48 48">${ICONS[name]}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${hx} ${hy}, ${fallback}`;
}
