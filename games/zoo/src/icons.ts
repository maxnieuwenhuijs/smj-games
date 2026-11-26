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

const capIcon = (c: string, d: string): string =>
  `<path d="M8 30 Q8 10 24 10 Q40 10 40 30Z" fill="${c}"/><path d="M6 30 H46 Q46 38 34 37 L8 34Z" fill="${d}"/><circle cx="24" cy="10" r="3" fill="${d}"/>`;
const balloonIcon = (c: string, d: string): string =>
  `<ellipse cx="24" cy="18" rx="12" ry="14" fill="${c}"/><path d="M24 32 l-3 4 h6Z" fill="${d}"/>` +
  `<path d="M24 36 Q19 40 26 46" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/><ellipse cx="19" cy="12" rx="3" ry="4.5" fill="#fff" opacity=".55"/>`;

// een druppel (regen, traan) met de punt omhoog, en een gloeiend lampje aan een snoer
const drop = (x: number, y: number, c = '#6ec3e8'): string =>
  `<path d="M${x} ${y - 5} C${x + 5} ${y} ${x + 4} ${y + 4} ${x} ${y + 4} C${x - 4} ${y + 4} ${x - 5} ${y} ${x} ${y - 5}Z" fill="${c}"/>`;
const bulb = (x: number, y: number, c: string): string =>
  `<circle cx="${x}" cy="${y + 9}" r="8" fill="${c}" opacity=".3"/><rect x="${x - 2}" y="${y}" width="4" height="4" rx="1" fill="#3d4f5a"/><ellipse cx="${x}" cy="${y + 9}" rx="4.2" ry="5.5" fill="${c}"/>`;
const HEART_PATH = 'M24 41 C6 28 6 11 16 9 C21 8 24 12 24 15 C24 12 27 8 32 9 C42 11 42 28 24 41Z';
const STAR_PATH = 'M24 4 L30 17 L44 19 L34 29 L36.5 43 L24 36.5 L11.5 43 L14 29 L4 19 L18 17Z';
// de kabouter en het windmolentje staan ook samen op de knop van de groep 'voor het park'
const GNOME =
  `<path d="M14 44 Q13 30 24 29 Q35 30 34 44Z" fill="#4a90e2" stroke="#2f6fb8" stroke-width="2" stroke-linejoin="round"/><circle cx="24" cy="24" r="8" fill="${SKIN}"/>` +
  `<path d="M16 25 Q15 38 24 41 Q33 38 32 25 Q28 30 24 27.5 Q20 30 16 25Z" fill="#fff" stroke="#d5cfc0" stroke-width="1.4" stroke-linejoin="round"/>` +
  `<circle cx="24" cy="26.5" r="2.6" fill="${PINK}"/><circle cx="20.5" cy="22.5" r="1.3" fill="${INK}"/><circle cx="27.5" cy="22.5" r="1.3" fill="${INK}"/>` +
  `<path d="M12.5 21 L24 3 L35.5 21 Q24 16.5 12.5 21Z" fill="${RED}" stroke="#b83a32" stroke-width="2" stroke-linejoin="round"/>`;
const PINWHEEL =
  `<path d="M24 21 V45" stroke="${WOOD_D}" stroke-width="3.5" stroke-linecap="round"/>` +
  `<g stroke-width="1.6" stroke-linejoin="round"><path d="M24 19 L24 3 L37 12Z" fill="${RED}" stroke="#b83a32"/><path d="M24 19 L40 19 L31 32Z" fill="${SUN}" stroke="${SUN_D}"/>` +
  `<path d="M24 19 L24 35 L11 26Z" fill="#4a90e2" stroke="#2f6fb8"/><path d="M24 19 L8 19 L17 6Z" fill="${GREEN}" stroke="${GRASS_D}"/></g>` +
  `<circle cx="24" cy="19" r="3.2" fill="#fff" stroke="${INK}" stroke-width="1.5"/>`;

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
  // een lap vlees met een vetrandje en een rond botje erin (het oude plaatje, een bol met een steel, leek op een paddenstoel)
  meat:
    '<path d="M10 14 Q20 4 34 9 Q46 14 42 28 Q39 42 24 42 Q8 42 6 28 Q5 19 10 14Z" fill="#f4d9c6"/><path d="M12.5 16.5 Q21 8.5 33 12.5 Q42 17 39 28 Q36.5 38.5 24 38.5 Q11 38.5 9.5 28 Q9 21 12.5 16.5Z" fill="#c9553f"/>' +
    '<circle cx="19" cy="21" r="5.5" fill="#f4ead8"/><circle cx="19" cy="21" r="2.2" fill="#d9a08c"/><path d="M27 26 q5 -3.5 9 -0.5 M21 32.5 q6 -2.5 10 1" fill="none" stroke="#e58f7c" stroke-width="2.4" stroke-linecap="round"/>',
  leaves:
    `<path d="M8 41 Q24 30 41 8" fill="none" stroke="${WOOD_D}" stroke-width="3" stroke-linecap="round"/>` +
    `<g fill="${GRASS_D}"><ellipse cx="14" cy="28" rx="8" ry="4.5" transform="rotate(-60 14 28)"/><ellipse cx="27" cy="33" rx="8" ry="4.5" transform="rotate(15 27 33)"/><ellipse cx="24" cy="17" rx="8" ry="4.5" transform="rotate(-65 24 17)"/><ellipse cx="37" cy="21" rx="8" ry="4.5" transform="rotate(10 37 21)"/></g>`,
  coin: `<circle cx="24" cy="24" r="19" fill="${SUN}" stroke="${SUN_D}" stroke-width="4"/><circle cx="24" cy="24" r="10" fill="none" stroke="${SUN_D}" stroke-width="2.5"/>`,
  // een lege portemonnee: open, met niets erin
  wallet:
    `<path d="M8 20 Q8 14 14 14 H34 Q40 14 40 20 V38 Q40 43 35 43 H13 Q8 43 8 38Z" fill="${WOOD}" stroke="${WOOD_D}" stroke-width="2.5"/>` +
    `<path d="M10 20 Q24 4 38 20" fill="${WOOD_D}"/><circle cx="24" cy="15" r="3" fill="${SUN_D}"/>` +
    `<path d="M15 30 Q24 36 33 30" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round" opacity=".55"/>`,
  guest: `<path d="M6 45 Q6 29 24 29 Q42 29 42 45Z" fill="#4a90e2"/><circle cx="24" cy="17" r="11" fill="${SKIN}"/><path d="M13 15 Q24 1 35 15 Q24 10 13 15Z" fill="#7a4a22"/><circle cx="20" cy="18" r="1.8" fill="${INK}"/><circle cx="28" cy="18" r="1.8" fill="${INK}"/>`,
  // een hamburger: wat je bij de eetkraam haalt (dezelfde als op het dak van de kraam)
  foodstall:
    '<path d="M7 22 Q7 7 24 7 Q41 7 41 22Z" fill="#e9a23b"/><g fill="#fff3d0"><ellipse cx="16" cy="13" rx="1.8" ry="1.1"/><ellipse cx="24" cy="10.5" rx="1.8" ry="1.1"/><ellipse cx="32" cy="13" rx="1.8" ry="1.1"/><ellipse cx="20" cy="17" rx="1.8" ry="1.1"/><ellipse cx="29" cy="17.5" rx="1.8" ry="1.1"/></g>' +
    `<path d="M4 25 Q8 20.5 12 24 T20 24 T28 24 T36 24 T44 25 V28 H4Z" fill="${GREEN}"/><rect x="6" y="27" width="36" height="4" fill="${RED}"/>` +
    `<path d="M4 30 H44 L37 36 L31 30.5Z" fill="${SUN}"/><rect x="5" y="31" width="38" height="7.5" rx="3.7" fill="#7a4a22"/><path d="M7 39 H41 Q41 45.5 35 45.5 H13 Q7 45.5 7 39Z" fill="#e9a23b"/>`,
  // een beker met een deksel en een rietje: wat je bij de drinkkraam haalt
  drinkstall:
    '<path d="M12 17 H36 L33 45 H15Z" fill="#fff" stroke="#9fb8c9" stroke-width="2"/>' +
    `<path d="M17.5 18 H22.5 L22 44 H18.5Z M26 18 H31 L29.6 44 H26.4Z" fill="${RED}"/><rect x="9" y="12" width="30" height="6" rx="2.5" fill="#4a90e2"/>` +
    `<path d="M25 12 L28 3 H35" fill="none" stroke="${RED}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
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
  /** Een ster die je nog niet hebt: grijs. */
  star_empty: `<path d="M24 4 L30 17 L44 19 L34 29 L36.5 43 L24 36.5 L11.5 43 L14 29 L4 19 L18 17Z" fill="#dde1e6" stroke="#b4bac2" stroke-width="2.5" stroke-linejoin="round"/>`,
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
  // een naamkaartje aan een touwtje: een nieuwe naam voor het dier
  nametag:
    '<path d="M7 20 L18 9 H41 Q44 9 44 12 V36 Q44 39 41 39 H18 L7 28 Q4 24 7 20Z" fill="#ffd23f" stroke="#e5b520" stroke-width="2.5" stroke-linejoin="round"/>' +
    '<circle cx="14" cy="24" r="3.2" fill="#fff" stroke="#e5b520" stroke-width="2"/><path d="M14 24 Q6 30 3 42" fill="none" stroke="#a8743f" stroke-width="2.5" stroke-linecap="round"/>' +
    `<path d="M22 19 H38 M22 25 H38 M22 31 H32" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`,
  // 'ga erheen': staat in een melding waar je op kunt tikken om te zien waar het over gaat
  goto: '<circle cx="24" cy="24" r="13" fill="#fff" stroke="#4a90e2" stroke-width="5"/><circle cx="24" cy="24" r="5" fill="#4a90e2"/><path d="M24 2 V9 M24 39 V46 M2 24 H9 M39 24 H46" stroke="#4a90e2" stroke-width="5" stroke-linecap="round"/>',
  sleep: disc('#6f8fe0') + '<path d="M13 14 H23 L13 26 H23 M27 22 H35 L27 32 H35" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>',
  move:
    disc('#2bb5a8') +
    '<path d="M24 9 V39 M9 24 H39 M24 9 l-5 5 M24 9 l5 5 M24 39 l-5 -5 M24 39 l5 -5 M9 24 l5 -5 M9 24 l5 5 M39 24 l-5 -5 M39 24 l-5 5" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>',
  empty:
    `<rect x="4" y="8" width="7" height="34" rx="2" fill="${WOOD_D}"/><rect x="11" y="13" width="6" height="26" rx="2" fill="${RED}"/>` +
    `<path d="M23 25 H41 M41 25 l-7 -7 M41 25 l-7 7" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`,
  clock:
    `<circle cx="24" cy="24" r="18" fill="#fff7e0" stroke="${INK}" stroke-width="3"/><path d="M24 13 V24 L32 29" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`,
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
  // de vijf werelden: een schuur, een savanneboom met zon, een junglepalm, een besneeuwde berg en een eiland met zee
  world_farm:
    '<path d="M6 44 V22 L24 8 L42 22 V44Z" fill="#d8362e"/><path d="M3 24 L24 6 L45 24" fill="none" stroke="#8a2a24" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<rect x="17" y="27" width="14" height="17" fill="#fff7e0"/><path d="M17 27 L31 44 M31 27 L17 44" stroke="#d8362e" stroke-width="2.5"/><rect x="20" y="15" width="8" height="6" rx="1" fill="#fff7e0"/>',
  world_savanna:
    '<circle cx="36" cy="13" r="8" fill="#ffd23f"/><rect x="2" y="36" width="44" height="9" rx="4" fill="#ecd591"/><path d="M19 38 V25" stroke="#8a5a2c" stroke-width="4" stroke-linecap="round"/>' +
    '<ellipse cx="19" cy="20" rx="15" ry="6" fill="#6cc04a"/><ellipse cx="12" cy="24" rx="7" ry="3.5" fill="#5bab4c"/>',
  world_jungle:
    '<path d="M24 45 Q22 30 26 17" fill="none" stroke="#8a5a2c" stroke-width="5" stroke-linecap="round"/>' +
    '<path d="M26 17 Q12 6 3 16 Q14 12 26 17 Q38 4 46 14 Q36 11 26 17 Q16 18 8 30 Q14 21 26 17 Q36 18 42 30 Q36 21 26 17" fill="#3d8b3a" stroke="#2f6e2d" stroke-width="2" stroke-linejoin="round"/>' +
    '<ellipse cx="24" cy="44" rx="16" ry="3" fill="#4f9a4a"/>',
  world_ice:
    '<path d="M3 44 L18 14 L27 30 L33 20 L45 44Z" fill="#9fd8f5"/><path d="M18 14 L12 26 L17 23 L21 27 L24 24Z M33 20 L29 27 L33 25 L37 28Z" fill="#fff"/>' +
    '<g stroke="#fff" stroke-width="2.5" stroke-linecap="round"><path d="M38 6 v8 M34 10 h8 M35.2 7.2 l5.6 5.6 M40.8 7.2 l-5.6 5.6"/></g>',
  world_far:
    '<path d="M2 34 Q8 28 14 34 T26 34 T38 34 T50 34 V46 H2Z" fill="#6ec3e8"/><ellipse cx="24" cy="33" rx="14" ry="5" fill="#ecd591"/>' +
    '<path d="M24 31 Q23 22 27 14" fill="none" stroke="#8a5a2c" stroke-width="3.5" stroke-linecap="round"/><path d="M27 14 Q18 8 13 15 M27 14 Q36 8 41 16 M27 14 Q24 6 30 4" fill="none" stroke="#5bab4c" stroke-width="4" stroke-linecap="round"/>',
  // de boom van de natuur (voor in een verblijf): een brede eik met een dikke stam en takken, anders dan de ronde boom van Park
  oak:
    '<ellipse cx="24" cy="44.5" rx="12" ry="2.6" fill="#000" opacity=".12"/><path d="M20 45 Q22 36 21 28 H27 Q26 36 28 45Z" fill="#7a5230"/>' +
    '<path d="M23 33 L14 26 M25 31 L35 25" stroke="#7a5230" stroke-width="3.2" stroke-linecap="round"/>' +
    '<circle cx="12" cy="21" r="9.5" fill="#3f8f3a"/><circle cx="36" cy="21" r="9.5" fill="#3f8f3a"/><circle cx="24" cy="12" r="11" fill="#4fa446"/><circle cx="24" cy="22" r="9.5" fill="#4fa446"/>' +
    '<g fill="#7cc35f"><circle cx="17" cy="13" r="2.2"/><circle cx="29" cy="8.5" r="2"/><circle cx="33" cy="20" r="1.9"/><circle cx="14" cy="23" r="1.7"/></g>' +
    '<g fill="#a9743f"><ellipse cx="21" cy="19" rx="1.6" ry="2"/><ellipse cx="29" cy="25" rx="1.6" ry="2"/></g>',
  // de knop Park: de poort van het park met een vlaggetje, een pad eronderdoor, en een boom en een lantaarn erachter
  parkgate:
    '<ellipse cx="24" cy="43" rx="22" ry="4.5" fill="#86c95c"/><path d="M17 45 Q24 33 31 45Z" fill="#e3d3b4"/>' +
    '<rect x="5.5" y="26" width="3.4" height="14" rx="1" fill="#7a5230"/><circle cx="7.2" cy="22" r="7" fill="#4fa446"/><circle cx="5" cy="19.5" r="1.8" fill="#7cc35f"/>' +
    '<rect x="39.4" y="22" width="2.6" height="19" fill="#3d4f5a"/><rect x="36.8" y="14.5" width="7.8" height="8.5" rx="2" fill="#fff1a8" stroke="#3d4f5a" stroke-width="1.8"/><path d="M36 14.5 L40.7 11 L45.4 14.5Z" fill="#3d4f5a"/>' +
    '<rect x="12.5" y="20" width="5.5" height="24" rx="1.8" fill="#a9743f"/><rect x="30" y="20" width="5.5" height="24" rx="1.8" fill="#a9743f"/>' +
    '<path d="M9 23 Q24 4 39 23 L35.5 25.5 Q24 12 12.5 25.5Z" fill="#e0584f" stroke="#b83a32" stroke-width="1.2" stroke-linejoin="round"/>' +
    '<circle cx="24" cy="15.2" r="2.6" fill="#ffd23f"/><path d="M24 9.5 V2.5" stroke="#7a5230" stroke-width="1.8" stroke-linecap="round"/><path d="M24 2.5 L31.5 5 L24 7.8Z" fill="#4a90e2"/>',
  // de paden bij Grond: een kronkelend zandpad door het gras, met een paar steentjes (geen losse tegel)
  pathway:
    '<rect x="3" y="3" width="42" height="42" rx="10" fill="#86c95c"/>' +
    '<path d="M13 47 C7 34 31 31 25 21 C20 13 30 6 37 1" fill="none" stroke="#b9a482" stroke-width="16" stroke-linecap="round"/>' +
    '<path d="M13 47 C7 34 31 31 25 21 C20 13 30 6 37 1" fill="none" stroke="#e3d3b4" stroke-width="12" stroke-linecap="round"/>' +
    '<g fill="#c2b08e"><circle cx="15" cy="38" r="1.6"/><circle cx="23" cy="30" r="1.4"/><circle cx="26" cy="19" r="1.5"/><circle cx="31" cy="9" r="1.3"/></g>' +
    '<g fill="#6cb146"><circle cx="35" cy="34" r="3.2"/><circle cx="39" cy="38" r="2.6"/><circle cx="10" cy="14" r="3"/></g>',
  // bij de knop Hek: een heel hok slepen (een vierkant van hekjes met een sleeppijl); dit hangt als merkje op het plaatje van het hek
  fencebox:
    '<rect x="8" y="10" width="26" height="26" rx="3" fill="#dff0d0" stroke="#a9743f" stroke-width="4" stroke-dasharray="7 3.4"/>' +
    '<g fill="#7a5230"><rect x="5" y="7" width="7" height="7" rx="2"/><rect x="30" y="7" width="7" height="7" rx="2"/><rect x="5" y="32" width="7" height="7" rx="2"/><rect x="30" y="32" width="7" height="7" rx="2"/></g>' +
    '<path d="M22 22 L41 41" stroke="#f08a24" stroke-width="5" stroke-linecap="round"/><path d="M45 45 L33 43 L43 33Z" fill="#f08a24"/>',
  // het beeld draaien: een videocamera met een dikke oranje draaipijl eromheen (de linkerknop is hetzelfde plaatje in
  // spiegelbeeld). De pijl is het belangrijkst: die moet je in één oogopslag zien.
  camturn:
    '<g transform="translate(7 17) scale(0.72)"><circle cx="13" cy="20" r="5" fill="#3d4f5a"/><circle cx="13" cy="20" r="1.8" fill="#b9c2c9"/><circle cx="24.5" cy="19" r="6" fill="#3d4f5a"/><circle cx="24.5" cy="19" r="2.1" fill="#b9c2c9"/>' +
    '<rect x="5" y="24" width="27" height="19" rx="4" fill="#6f7c87"/><rect x="5" y="24" width="27" height="6" rx="3" fill="#8b98a3"/><path d="M32 30 L44 24 V43 L32 37Z" fill="#5a6670"/><circle cx="11" cy="36" r="2.4" fill="#e0584f"/><rect x="17" y="34" width="10" height="4" rx="1.5" fill="#d6ecfb"/></g>' +
    '<path d="M6 31 A19 19 0 0 1 39 15" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round"/><path d="M6 31 A19 19 0 0 1 39 15" fill="none" stroke="#f08a24" stroke-width="6" stroke-linecap="round"/>' +
    '<path d="M45.5 8 L47 24.5 L31.5 20.5Z" fill="#f08a24" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>',
  turn:
    `<path d="M38 24 A14 14 0 1 1 30 11" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M28 3 L40 10 L29 18Z" fill="${INK}"/>`,
  // meer voor in het park
  cactus:
    '<rect x="19" y="8" width="10" height="36" rx="5" fill="#4f9e45"/><path d="M19 28 H12 V18" fill="none" stroke="#4f9e45" stroke-width="6" stroke-linecap="round"/><path d="M29 24 H37 V14" fill="none" stroke="#468f3e" stroke-width="6" stroke-linecap="round"/><circle cx="24" cy="8" r="4" fill="#f06aa6"/>',
  bamboogrove:
    '<path d="M14 46 V6 M24 46 V10 M34 46 V4" stroke="#8cc152" stroke-width="5" stroke-linecap="round"/><path d="M11.5 18 h5 M11.5 32 h5 M21.5 22 h5 M21.5 36 h5 M31.5 16 h5 M31.5 30 h5" stroke="#5f9a2f" stroke-width="2"/><path d="M16 12 q8 -6 12 0 q-8 2 -12 0Z M36 10 q8 -4 10 2 q-7 2 -10 -2Z" fill="#5bab4c"/>',
  sunflowers:
    '<path d="M15 46 V24 M33 46 V20" stroke="#5bab4c" stroke-width="4" stroke-linecap="round"/><circle cx="15" cy="18" r="10" fill="#ffd23f"/><circle cx="15" cy="18" r="4.5" fill="#8a5a2c"/><circle cx="33" cy="14" r="10" fill="#ffd23f"/><circle cx="33" cy="14" r="4.5" fill="#8a5a2c"/><path d="M15 36 q8 -4 9 3 q-6 2 -9 -3Z" fill="#5bab4c"/>',
  cherry:
    '<rect x="21" y="26" width="6" height="18" rx="2" fill="#8a5a2c"/><circle cx="24" cy="18" r="14" fill="#f7b6cf"/><circle cx="15" cy="24" r="8" fill="#f48fb1"/><circle cx="33" cy="23" r="8" fill="#fbd3e2"/><circle cx="22" cy="12" r="2" fill="#fff"/><circle cx="30" cy="18" r="2" fill="#fff"/>',
  pumpkins:
    '<ellipse cx="18" cy="30" rx="14" ry="12" fill="#f08a24"/><path d="M18 18 V42 M10 20 Q6 30 10 40 M26 20 Q30 30 26 40" fill="none" stroke="#c96a12" stroke-width="2"/><rect x="16" y="13" width="4" height="7" rx="1.5" fill="#5f9a2f"/><ellipse cx="36" cy="36" rx="9" ry="8" fill="#f5a03c"/><rect x="34.5" y="25" width="3" height="5" rx="1" fill="#5f9a2f"/>',
  birdbath:
    '<rect x="20" y="22" width="8" height="18" fill="#b9c2c9"/><rect x="13" y="40" width="22" height="5" rx="2" fill="#b9c2c9"/><path d="M6 16 H42 Q40 26 24 26 Q8 26 6 16Z" fill="#cfd6dc"/><ellipse cx="24" cy="16" rx="16" ry="3.5" fill="#6ec3e8"/><path d="M27 9 q5 -5 9 0 q-1 5 -6 5 q-3 0 -3 -5Z" fill="#4a90e2"/><path d="M36 9 l4 1 l-4 2Z" fill="#ffd23f"/>',
  pump:
    '<rect x="19" y="14" width="9" height="28" rx="2" fill="#2f6e4f"/><rect x="12" y="40" width="24" height="5" rx="2" fill="#b9c2c9"/><path d="M28 22 H38 V27" fill="none" stroke="#2f6e4f" stroke-width="5" stroke-linecap="round"/><path d="M23 14 V8 L10 16" fill="none" stroke="#3d4f5a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M38 30 q-3 5 0 8 q3 -3 0 -8Z" fill="#6ec3e8"/>',
  arch:
    '<path d="M9 46 V20 Q9 6 24 6 Q39 6 39 20 V46" fill="none" stroke="#fff7e0" stroke-width="5" stroke-linecap="round"/><path d="M9 30 Q8 8 24 6 Q40 8 39 30" fill="none" stroke="#5bab4c" stroke-width="7" stroke-linecap="round"/><circle cx="10" cy="24" r="3.5" fill="#f06aa6"/><circle cx="16" cy="11" r="3.5" fill="#e0584f"/><circle cx="27" cy="6" r="3.5" fill="#ffd23f"/><circle cx="36" cy="14" r="3.5" fill="#f06aa6"/><circle cx="39" cy="26" r="3.5" fill="#e0584f"/>',
  windmill:
    '<path d="M17 46 L20 20 H28 L31 46Z" fill="#fff7e0" stroke="#8a857a" stroke-width="1.5"/><path d="M18 22 L24 13 L30 22Z" fill="#e0584f"/><rect x="21" y="36" width="6" height="10" rx="1" fill="#a8743f"/><g stroke="#a8743f" stroke-width="4" stroke-linecap="round"><path d="M24 20 L8 6 M24 20 L40 6 M24 20 L10 34 M24 20 L38 34"/></g><circle cx="24" cy="20" r="3" fill="#8a5a2c"/>',
  scarecrow:
    '<path d="M24 46 V14 M6 24 H42" stroke="#a8743f" stroke-width="4" stroke-linecap="round"/><rect x="16" y="20" width="16" height="14" rx="2" fill="#c9553f"/><circle cx="24" cy="13" r="7" fill="#e8c66a"/><path d="M13 9 H35 L30 2 H18Z" fill="#8a5a2c"/><circle cx="21.5" cy="13" r="1.2" fill="#3a2a1a"/><circle cx="26.5" cy="13" r="1.2" fill="#3a2a1a"/>',
  snowman:
    '<circle cx="24" cy="35" r="11" fill="#fff" stroke="#b9c2c9" stroke-width="1.5"/><circle cx="24" cy="18" r="8" fill="#fff" stroke="#b9c2c9" stroke-width="1.5"/><rect x="17" y="3" width="14" height="8" rx="1" fill="#3d4f5a"/><rect x="13" y="10" width="22" height="3" rx="1.5" fill="#3d4f5a"/><path d="M24 19 l8 2 l-8 1.5Z" fill="#f08a24"/><circle cx="21" cy="16" r="1.2" fill="#3a2a1a"/><circle cx="27" cy="16" r="1.2" fill="#3a2a1a"/><path d="M17 25 H31" stroke="#e0584f" stroke-width="4" stroke-linecap="round"/>',
  totem:
    '<rect x="15" y="32" width="18" height="13" rx="2" fill="#e0584f"/><rect x="15" y="19" width="18" height="13" rx="2" fill="#ffd23f"/><rect x="15" y="6" width="18" height="13" rx="2" fill="#4a90e2"/><path d="M4 9 H44 V15 H4Z" fill="#a8743f"/><g fill="#fff"><circle cx="20" cy="12" r="2.2"/><circle cx="28" cy="12" r="2.2"/><circle cx="20" cy="25" r="2.2"/><circle cx="28" cy="25" r="2.2"/><circle cx="20" cy="38" r="2.2"/><circle cx="28" cy="38" r="2.2"/></g>',
  campfire:
    '<path d="M8 42 L40 34 M8 34 L40 42" stroke="#8a5a2c" stroke-width="6" stroke-linecap="round"/><path d="M24 6 Q36 20 31 31 Q28 38 24 38 Q20 38 17 31 Q12 20 24 6Z" fill="#f08a24"/><path d="M24 18 Q30 26 27.5 32 Q26 36 24 36 Q22 36 20.5 32 Q18 26 24 18Z" fill="#ffd23f"/>',
  clocktower:
    '<rect x="21" y="26" width="6" height="18" fill="#3d4f5a"/><rect x="14" y="42" width="20" height="4" rx="2" fill="#3d4f5a"/><circle cx="24" cy="16" r="13" fill="#2f6e4f"/><circle cx="24" cy="16" r="9.5" fill="#fff"/><path d="M24 16 V9 M24 16 L29 19" stroke="#3a2a1a" stroke-width="2.2" stroke-linecap="round"/>',
  // losse speeltoestellen
  slide:
    `<path d="M8 44 V10 M18 44 V10 M8 20 H18 M8 30 H18 M8 40 H18" fill="none" stroke="${WOOD_D}" stroke-width="3.5" stroke-linecap="round"/><path d="M18 12 Q34 14 44 42" fill="none" stroke="${RED}" stroke-width="8" stroke-linecap="round"/><rect x="5" y="6" width="16" height="5" rx="2" fill="#4a90e2"/>`,
  swing:
    `<path d="M6 44 L14 6 H34 L42 44" fill="none" stroke="${RED}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 6 L16 32 M27 6 L24 32" stroke="#8a857a" stroke-width="2"/><rect x="12" y="31" width="16" height="5" rx="2" fill="#4a90e2"/><path d="M31 6 V26 M37 6 V26" stroke="#8a857a" stroke-width="2"/><rect x="29" y="25" width="10" height="4" rx="2" fill="${SUN}"/>`,
  seesaw:
    `<path d="M5 34 L43 16" stroke="${SUN}" stroke-width="6" stroke-linecap="round"/><path d="M17 44 L24 26 L31 44Z" fill="${RED}"/><path d="M11 31 v-8 M37 19 v-8" stroke="#4a90e2" stroke-width="3.5" stroke-linecap="round"/>`,
  springer:
    `<path d="M24 44 q-6 -3 0 -6 q6 -3 0 -6 q-6 -3 0 -5" fill="none" stroke="#8a857a" stroke-width="3" stroke-linecap="round"/><ellipse cx="22" cy="20" rx="14" ry="8" fill="${RED}"/><circle cx="37" cy="13" r="7" fill="${RED}"/><path d="M43 13 l5 2 l-5 2Z" fill="${SUN}"/><circle cx="38.5" cy="11.5" r="1.5" fill="#fff"/><path d="M8 18 l-5 -6 l8 2Z" fill="${SUN}"/><path d="M26 10 v-6" stroke="#3d4f5a" stroke-width="3" stroke-linecap="round"/><rect x="18" y="42" width="12" height="4" rx="2" fill="#3d4f5a"/>`,
  trampoline:
    `<ellipse cx="24" cy="30" rx="21" ry="9" fill="#4a90e2"/><ellipse cx="24" cy="29" rx="16" ry="6" fill="#3d4f5a"/><path d="M8 34 V44 M40 34 V44 M24 39 V46" stroke="#8a857a" stroke-width="3.5" stroke-linecap="round"/><circle cx="24" cy="10" r="5" fill="${SUN}"/><path d="M17 19 q7 -4 14 0" fill="none" stroke="${SUN}" stroke-width="3" stroke-linecap="round"/>`,
  // het aquarium: een glazen wand, koraal, een hoepel en het plaatje van de afdeling
  glass:
    `<rect x="5" y="10" width="38" height="30" rx="2" fill="#bfe6f7" opacity=".75"/><path d="M5 10 H43 V40 H5Z" fill="none" stroke="#7fa6bb" stroke-width="4" stroke-linejoin="round"/><path d="M12 32 L22 17 M22 34 L28 25" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`,
  coral:
    `<path d="M24 44 V30 M24 34 Q14 32 14 20 M24 30 Q34 28 34 16 M14 26 Q8 24 9 16 M34 24 Q40 22 40 14" fill="none" stroke="#f06aa6" stroke-width="5" stroke-linecap="round"/><ellipse cx="24" cy="44" rx="16" ry="3.5" fill="#8f949c"/><circle cx="14" cy="19" r="3.2" fill="#f7a8c8"/><circle cx="34" cy="15" r="3.2" fill="#f7a8c8"/><circle cx="9" cy="15" r="2.6" fill="#f7a8c8"/><circle cx="40" cy="13" r="2.6" fill="#f7a8c8"/>`,
  hoop:
    `<ellipse cx="24" cy="18" rx="14" ry="14" fill="none" stroke="${RED}" stroke-width="5"/><path d="M12 10 A14 14 0 0 1 36 10" fill="none" stroke="#fff7e0" stroke-width="5" stroke-dasharray="6 6"/><path d="M24 32 V44" stroke="#8a857a" stroke-width="4" stroke-linecap="round"/><ellipse cx="24" cy="44" rx="9" ry="2.5" fill="#6ec3e8"/>`,
  // waterfilter: een kastje met een pijp, bellen die omhoog gaan en een blauwe golf eronder
  filter:
    `<ellipse cx="24" cy="42" rx="19" ry="4" fill="#6ec3e8"/><rect x="12" y="20" width="22" height="21" rx="4" fill="#4a90e2" stroke="#2f6fb8" stroke-width="2"/>` +
    `<rect x="16" y="25" width="14" height="5" rx="2" fill="#9fd8f5"/><circle cx="18" cy="35" r="2.2" fill="${SUN}"/><circle cx="25" cy="35" r="2.2" fill="${GREEN}"/>` +
    `<path d="M30 20 V12 H36" fill="none" stroke="${GREY}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>` +
    '<circle cx="39" cy="9" r="3" fill="#fff" stroke="#6ec3e8" stroke-width="1.6"/><circle cx="42" cy="3.5" r="2" fill="#fff" stroke="#6ec3e8" stroke-width="1.4"/><circle cx="35" cy="4" r="1.6" fill="#fff" stroke="#6ec3e8" stroke-width="1.2"/>',
  // vies water: een grote druppel, groenig grijs, met bruine vlekjes erin
  murky:
    '<path d="M24 4 C35 18 40 26 40 32 C40 40 33 45 24 45 C15 45 8 40 8 32 C8 26 13 18 24 4Z" fill="#8a9a6e" stroke="#5f6e48" stroke-width="2.5" stroke-linejoin="round"/>' +
    '<ellipse cx="18" cy="31" rx="3.4" ry="2.4" fill="#6b4a22"/><ellipse cx="29" cy="36" rx="2.8" ry="2" fill="#6b4a22"/><ellipse cx="27" cy="25" rx="2" ry="1.5" fill="#6b4a22"/><circle cx="20" cy="39" r="1.4" fill="#6b4a22"/>' +
    '<path d="M15 22 Q17 16 21 12" fill="none" stroke="#c9d6b0" stroke-width="2.4" stroke-linecap="round"/>',
  world_aqua:
    '<path d="M4 28 Q12 22 20 28 T36 28 T52 28 V46 H4Z" fill="#6ec3e8"/><path d="M8 26 Q16 4 34 16 Q42 12 44 8 Q45 16 40 20 Q34 34 14 30 Q10 30 8 26Z" fill="#7f8a96"/><path d="M14 27 Q24 30 36 22 Q32 31 16 30Z" fill="#e6ecef"/><circle cx="17" cy="20" r="1.6" fill="#1e1e22"/><path d="M26 11 L31 3 L34 14Z" fill="#6c7783"/>',
  // dag en nacht
  sun:
    `<g stroke="${SUN_D}" stroke-width="3.5" stroke-linecap="round"><path d="M24 4 v6 M24 38 v6 M4 24 h6 M38 24 h6 M10 10 l4 4 M34 34 l4 4 M38 10 l-4 4 M10 38 l4 -4"/></g><circle cx="24" cy="24" r="10" fill="${SUN}" stroke="${INK}" stroke-width="2.5"/>`,
  moon:
    `<path d="M30 6 A18 18 0 1 0 42 30 A14 14 0 0 1 30 6Z" fill="#ffe9a8" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><circle cx="12" cy="12" r="1.8" fill="#fff"/><circle cx="40" cy="14" r="1.4" fill="#fff"/>`,
  // een stuk grond erbij kopen: een tegel gras met een vlag
  land: tile(GRASS) + `<path d="M24 27 V7" stroke="${WOOD_D}" stroke-width="3.5" stroke-linecap="round"/><path d="M24 7 H39 L35 12.5 L39 18 H24Z" fill="${RED}"/>`,
  // meer grond: rots, ijs, moeras, bloemenwei en droog gras
  stones: tile('#9aa0a8', '#8a9099') + '<g fill="#6f757d"><ellipse cx="16" cy="24" rx="4" ry="2.5"/><ellipse cx="27" cy="29" rx="5" ry="3"/><ellipse cx="29" cy="19" rx="4" ry="2.4"/></g>',
  ice: tile('#cfeaf7', '#bfe0f1') + '<path d="M12 25 l8 -4 M22 31 l10 -5 M24 19 l6 -3" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>',
  swamp: tile('#5f7f4a', '#526f40') + '<ellipse cx="18" cy="25" rx="6" ry="3" fill="#3f6b6b"/><ellipse cx="30" cy="29" rx="5" ry="2.5" fill="#3f6b6b"/><path d="M28 21 v-6 M31 22 v-4" stroke="#8a5a2c" stroke-width="2" stroke-linecap="round"/>',
  meadow: tile('#8fd06a', '#84c660') + '<circle cx="15" cy="24" r="2.6" fill="#f06aa6"/><circle cx="25" cy="30" r="2.6" fill="#ffd23f"/><circle cx="30" cy="20" r="2.6" fill="#fff"/><circle cx="22" cy="17" r="2.2" fill="#e0584f"/>',
  steppe: tile('#d6c46a', '#c9b65b') + '<path d="M13 26 l2 -6 l2 6 M24 32 l2 -6 l2 6 M28 21 l2 -6 l2 6" fill="none" stroke="#a8923a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>',
  // de grote voerbak (steen) en de voersilo
  trough_big:
    `<path d="M3 18 H45 L41 40 H7Z" fill="#a9adb3" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><rect x="6" y="20" width="36" height="4" rx="2" fill="${INK}" opacity=".3"/><path d="M12 30 h24" stroke="#8a8f98" stroke-width="2" stroke-linecap="round"/>`,
  trough_silo:
    `<rect x="16" y="12" width="16" height="26" rx="3" fill="#d9dde2" stroke="${INK}" stroke-width="2"/><path d="M13 13 L24 3 L35 13Z" fill="${RED}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><path d="M16 20 H32 M16 28 H32" stroke="#a9adb3" stroke-width="2"/><path d="M10 38 H38 L36 46 H12Z" fill="${WOOD}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`,
  // een kwast met verf: de kleur van het hek kiezen
  // het hek een kleur geven: een schilderspalet met klodders verf
  paint:
    `<path d="M24 5 C11 5 3 14 3 24 C3 35 12 43 24 43 C29 43 30.5 39.5 28.5 36.5 C26.5 33.5 28.5 30 33 30 L38 30 C43 30 45 26 45 21.5 C45 12 36 5 24 5Z" fill="#f0d6a3" stroke="${WOOD_D}" stroke-width="2.6" stroke-linejoin="round"/>` +
    `<circle cx="13.5" cy="17" r="4.8" fill="${RED}"/><circle cx="25" cy="12" r="4.8" fill="${SUN}"/><circle cx="36" cy="17.5" r="4.8" fill="#5bab4c"/><circle cx="11" cy="29" r="4.8" fill="#4a90e2"/><circle cx="19.5" cy="36.5" r="4.2" fill="#b06ad9"/>` +
    `<path d="M11.5 15.5 q1.5 -2 3.5 -1.5 M23 10.5 q1.5 -2 3.5 -1.5 M34 16 q1.5 -2 3.5 -1.5 M9 27.5 q1.5 -2 3.5 -1.5" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" opacity=".75"/>`,
  // de actieknop: veger, hamer en prikker naast elkaar
  action:
    `<path d="M13 4 L10 25" stroke="${WOOD_D}" stroke-width="3.5" stroke-linecap="round"/><path d="M3 26 H17 L19 41 H1Z" fill="${SUN}"/><path d="M6 31 V40 M10 31 V40 M14 31 V40" stroke="${SUN_D}" stroke-width="1.5"/><path d="M3 26 H17" stroke="${RED}" stroke-width="4" stroke-linecap="round"/>` +
    `<path d="M24 44 V17" stroke="${WOOD_D}" stroke-width="4.5" stroke-linecap="round"/><rect x="16" y="6" width="17" height="11" rx="2.5" fill="#8a857a" stroke="${INK}" stroke-width="1.8"/>` +
    `<path d="M33 31 L44 33 L43 42 L34 40Z" fill="#fff" stroke="${GREY}" stroke-width="1.8" stroke-linejoin="round"/><path d="M39 36 V46" stroke="#8a857a" stroke-width="2.5" stroke-linecap="round"/><path d="M39 5 V36" stroke="${WOOD_D}" stroke-width="3.5" stroke-linecap="round"/><path d="M39 5 V12" stroke="${RED}" stroke-width="5.5" stroke-linecap="round"/>`,
  // natuur voor in de verblijven: graspol, bloemetjes, varen, struikje, kiezels en een steen
  tuft:
    `<ellipse cx="24" cy="42" rx="13" ry="2.6" fill="#000" opacity=".12"/>` +
    `<path d="M21 42 C20 31 14 21 6 15 C15 18 21 26 23 34 C23 22 24 12 28 4 C29 14 28 24 27 34 C29 26 34 19 42 16 C35 23 31 32 30 42Z" fill="${GRASS}" stroke="${GRASS_D}" stroke-width="2.2" stroke-linejoin="round"/>` +
    `<path d="M25.5 38 C25 28 26 18 27.5 10" fill="none" stroke="${GRASS_D}" stroke-width="1.6" stroke-linecap="round" opacity=".6"/>`,
  daisies:
    `<path d="M17 44 V27 M31 44 V21" stroke="${GRASS_D}" stroke-width="3" stroke-linecap="round"/><path d="M17 38 q-8 -1 -9 -8 q8 0 9 8 M31 35 q8 -1 9 -8 q-8 0 -9 8" fill="${GRASS}"/>` +
    `<g fill="#fff" stroke="#d5cfc0" stroke-width="1.2"><circle cx="17" cy="12.5" r="4.6"/><circle cx="23.5" cy="17" r="4.6"/><circle cx="21" cy="24.5" r="4.6"/><circle cx="13" cy="24.5" r="4.6"/><circle cx="10.5" cy="17" r="4.6"/>` +
    `<circle cx="31" cy="7" r="4"/><circle cx="36.7" cy="11" r="4"/><circle cx="34.5" cy="17.5" r="4"/><circle cx="27.5" cy="17.5" r="4"/><circle cx="25.3" cy="11" r="4"/></g>` +
    `<circle cx="17" cy="19" r="4.4" fill="${SUN}" stroke="${SUN_D}" stroke-width="1.2"/><circle cx="31" cy="12.5" r="3.9" fill="${SUN}" stroke="${SUN_D}" stroke-width="1.2"/>`,
  fern:
    `<ellipse cx="24" cy="43" rx="12" ry="2.4" fill="#000" opacity=".12"/>` +
    `<path d="M24 43 C22 30 14 20 5 17 M24 43 C24 28 24 16 24 5 M24 43 C26 30 34 20 43 17 M24 43 C20 36 12 33 5 35 M24 43 C28 36 36 33 43 35" fill="none" stroke="${GRASS_D}" stroke-width="6.5" stroke-linecap="round"/>` +
    `<path d="M24 43 C22 30 14 20 5 17 M24 43 C24 28 24 16 24 5 M24 43 C26 30 34 20 43 17 M24 43 C20 36 12 33 5 35 M24 43 C28 36 36 33 43 35" fill="none" stroke="${GRASS}" stroke-width="3" stroke-linecap="round"/>`,
  shrub:
    `<ellipse cx="24" cy="42" rx="16" ry="2.8" fill="#000" opacity=".12"/><circle cx="15" cy="30" r="10.5" fill="${GRASS_D}"/><circle cx="33" cy="30" r="11" fill="${GRASS_D}"/><circle cx="24" cy="20" r="12" fill="${GRASS_D}"/>` +
    `<circle cx="24" cy="20.5" r="9.5" fill="${GRASS}"/><circle cx="16" cy="31" r="8" fill="${GRASS}"/><circle cx="32.5" cy="31" r="8.5" fill="${GRASS}"/>` +
    `<circle cx="20" cy="21" r="2.4" fill="${RED}"/><circle cx="30" cy="27" r="2.4" fill="${RED}"/><circle cx="14" cy="32" r="2.4" fill="${RED}"/><circle cx="27" cy="15" r="2.4" fill="${RED}"/>`,
  pebbles:
    `<ellipse cx="24" cy="41" rx="18" ry="3" fill="#000" opacity=".12"/><ellipse cx="15" cy="32" rx="10.5" ry="7.5" fill="#9aa0a8" stroke="#6f757d" stroke-width="2.2"/>` +
    `<ellipse cx="34" cy="34" rx="9" ry="6" fill="#b9c2c9" stroke="#6f757d" stroke-width="2.2"/><ellipse cx="26" cy="20" rx="8" ry="5.6" fill="#aab1b9" stroke="#6f757d" stroke-width="2.2"/>` +
    `<path d="M9 29 q4 -4 9 -3 M29 31.5 q4 -2.5 8 -1 M21 17.5 q4 -2.5 8 -1" fill="none" stroke="#e3e7eb" stroke-width="2" stroke-linecap="round"/>`,
  stone:
    `<ellipse cx="24" cy="41" rx="18" ry="3" fill="#000" opacity=".12"/><path d="M7 39 L10 22 L20 11 L33 12 L42 25 L41 39 Z" fill="#9aa0a8" stroke="#6f757d" stroke-width="2.6" stroke-linejoin="round"/>` +
    `<path d="M20 11 L24 24 L10 22 M24 24 L42 25 M24 24 L22 39" fill="none" stroke="#7d848c" stroke-width="2" stroke-linejoin="round"/><path d="M13.5 21 L20.5 14" stroke="#e3e7eb" stroke-width="2.6" stroke-linecap="round"/>`,
  // klein spul voor het park, ook op een kwart tegel: bloempot, kabouter, windmolentje, badeend, ballen, vogelhuisje,
  // gieter, emmertje, slak en een kistje appels; `parkprops` is de knop van de groep
  parkprops:
    `<ellipse cx="24" cy="43.5" rx="19" ry="2.8" fill="#000" opacity=".12"/><g transform="translate(19 5.5) scale(.62)">${PINWHEEL}</g><g transform="translate(-1 10) scale(.76)">${GNOME}</g>`,
  pot:
    `<ellipse cx="24" cy="43.5" rx="13" ry="2.6" fill="#000" opacity=".12"/><path d="M24 30 V18" stroke="${GRASS_D}" stroke-width="3" stroke-linecap="round"/>` +
    `<path d="M24 28 q-10 0 -12 -7 q10 -1 12 7 M24 28 q10 0 12 -7 q-10 -1 -12 7" fill="${GRASS}" stroke="${GRASS_D}" stroke-width="1.2" stroke-linejoin="round"/>` +
    `<g fill="${RED}" stroke="#b83a32" stroke-width="1.2"><circle cx="24" cy="5.8" r="4.5"/><circle cx="29.9" cy="10.1" r="4.5"/><circle cx="27.6" cy="17" r="4.5"/><circle cx="20.4" cy="17" r="4.5"/><circle cx="18.1" cy="10.1" r="4.5"/></g>` +
    `<circle cx="24" cy="12" r="4" fill="${SUN}" stroke="${SUN_D}" stroke-width="1.2"/>` +
    `<path d="M13.5 31 H34.5 L32 44 H16Z" fill="#c9653f" stroke="#9c4a2c" stroke-width="2" stroke-linejoin="round"/><rect x="11" y="27.5" width="26" height="6" rx="2" fill="#dc7a4e" stroke="#9c4a2c" stroke-width="2"/>`,
  gnome: `<ellipse cx="24" cy="44" rx="13" ry="2.6" fill="#000" opacity=".12"/>` + GNOME,
  pinwheel: `<ellipse cx="24" cy="45" rx="9" ry="2.2" fill="#000" opacity=".12"/>` + PINWHEEL,
  ducky:
    `<ellipse cx="23" cy="42.5" rx="17" ry="2.8" fill="#000" opacity=".12"/><path d="M9 31 L3 21 L14 26Z" fill="${SUN}" stroke="${SUN_D}" stroke-width="2" stroke-linejoin="round"/>` +
    `<ellipse cx="22" cy="32" rx="15" ry="10" fill="${SUN}" stroke="${SUN_D}" stroke-width="2"/><ellipse cx="42" cy="19.5" rx="5" ry="2.8" fill="#f08a24" stroke="#c96a15" stroke-width="1.4"/>` +
    `<circle cx="32" cy="17" r="9" fill="${SUN}" stroke="${SUN_D}" stroke-width="2"/><path d="M13 31 q7 -5 14 0 q-6 7 -14 0Z" fill="${SUN_D}"/><circle cx="34.5" cy="15" r="1.7" fill="${INK}"/>`,
  birdhouse:
    `<ellipse cx="24" cy="45" rx="10" ry="2.2" fill="#000" opacity=".12"/><rect x="21.5" y="32" width="5" height="13" rx="1.5" fill="${WOOD_D}"/>` +
    `<rect x="12" y="17" width="24" height="17" rx="2" fill="#fff1c9" stroke="#c9a96a" stroke-width="2"/><circle cx="24" cy="24" r="4" fill="${INK}"/>` +
    `<path d="M24 30.5 V34" stroke="${WOOD_D}" stroke-width="2.6" stroke-linecap="round"/><path d="M6.5 20 L24 4 L41.5 20Z" fill="${RED}" stroke="#b83a32" stroke-width="2" stroke-linejoin="round"/>`,
  can:
    `<ellipse cx="23" cy="43.5" rx="15" ry="2.6" fill="#000" opacity=".12"/><path d="M14 23 Q3 22 4.5 31 Q6 38 14 37" fill="none" stroke="#2f7fc0" stroke-width="3.6" stroke-linecap="round"/>` +
    `<path d="M32 36 L42 17" stroke="#2f7fc0" stroke-width="5.5" stroke-linecap="round"/><ellipse cx="42.5" cy="15" rx="4.6" ry="3" transform="rotate(28 42.5 15)" fill="${SUN}" stroke="${SUN_D}" stroke-width="1.4"/>` +
    `<rect x="13" y="19" width="21" height="25" rx="3" fill="#4aa8e8" stroke="#2f7fc0" stroke-width="2"/><ellipse cx="23.5" cy="19.5" rx="10.5" ry="3.2" fill="#bfe6f7" stroke="#2f7fc0" stroke-width="2"/>` +
    drop(44, 27),
  bucket:
    `<ellipse cx="24" cy="43.5" rx="14" ry="2.6" fill="#000" opacity=".12"/><path d="M11 25 Q24 4 37 25" fill="none" stroke="${GREY}" stroke-width="2.6" stroke-linecap="round"/>` +
    `<path d="M26 23 L33 7" stroke="#4a90e2" stroke-width="3.6" stroke-linecap="round"/><path d="M28.5 4.5 L37 8" stroke="#4a90e2" stroke-width="4" stroke-linecap="round"/>` +
    `<ellipse cx="24" cy="23" rx="12" ry="5" fill="#f0d9a0" stroke="#d1b676" stroke-width="1.4"/>` +
    `<path d="M11.5 25 H36.5 L33.5 44 H14.5Z" fill="${RED}" stroke="#b83a32" stroke-width="2" stroke-linejoin="round"/><rect x="9.5" y="22.5" width="29" height="5.5" rx="2.7" fill="${SUN}" stroke="${SUN_D}" stroke-width="1.6"/>`,
  snail:
    `<ellipse cx="24" cy="43" rx="20" ry="2.8" fill="#000" opacity=".12"/>` +
    `<path d="M40 18 L38 10 M43.5 18 L45.5 10" stroke="#c99a6a" stroke-width="2.2" stroke-linecap="round"/><circle cx="38" cy="9" r="2" fill="${INK}"/><circle cx="45.5" cy="9" r="2" fill="${INK}"/>` +
    `<path d="M4 39 Q4 35 9 35 H33 Q37.5 35 37.5 30 V21.5 Q37.5 17 41.7 17 Q46 17 46 21.5 V33 Q46 42 37 42 H7 Q4 42 4 39Z" fill="#f3c9a0" stroke="#c99a6a" stroke-width="2" stroke-linejoin="round"/>` +
    `<circle cx="20" cy="24" r="13" fill="#f08a24" stroke="#c96a15" stroke-width="2.2"/><circle cx="20" cy="24" r="7.5" fill="${SUN}"/><circle cx="20" cy="24" r="3" fill="#f08a24"/>`,
  crate:
    `<ellipse cx="24" cy="43.5" rx="19" ry="2.8" fill="#000" opacity=".12"/>` +
    `<g stroke-width="1.6"><circle cx="14.5" cy="19" r="6.5" fill="${RED}" stroke="#b83a32"/><circle cx="33.5" cy="19" r="6.5" fill="${RED}" stroke="#b83a32"/><circle cx="24" cy="15" r="6.5" fill="#8fcf4a" stroke="${GRASS_D}"/></g>` +
    `<rect x="6" y="22" width="36" height="21" rx="2" fill="${WOOD}" stroke="${WOOD_D}" stroke-width="2"/><path d="M7 29 H41 M7 36 H41" stroke="${WOOD_D}" stroke-width="2"/>` +
    `<rect x="6" y="22" width="5.5" height="21" rx="1.5" fill="${WOOD_D}"/><rect x="36.5" y="22" width="5.5" height="21" rx="1.5" fill="${WOOD_D}"/>`,
  minus: disc(RED) + '<path d="M13 24 H35" stroke="#fff" stroke-width="6" stroke-linecap="round"/>',
  // de prikker: een stok met een punt, met een propje papier eraan geprikt
  // de prikker: een stok met een rood handvat en een stalen punt, met een prop papier en een blikje eraan geprikt
  picker:
    `<ellipse cx="17" cy="43" rx="12" ry="2.6" fill="#000" opacity=".12"/>` +
    `<path d="M22 15 L31 12 L36 20 L28 25 Z" fill="#6ec3e8" stroke="#3f8fb5" stroke-width="2" stroke-linejoin="round"/><path d="M25.5 17.5 L31.5 15.5" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>` +
    `<path d="M7 30 L14 25 L23 27 L27 34 L23 41 L13 42 L6 37 Z" fill="#fff" stroke="#8a857a" stroke-width="2.2" stroke-linejoin="round"/>` +
    `<path d="M11 31 L16 34 L14 39 M20 30 L18 35 L23 37" fill="none" stroke="#b5b0a4" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M17.5 34 L10.5 43" stroke="#6f7680" stroke-width="3.4" stroke-linecap="round"/><path d="M12.6 40.3 L9 45 " stroke="#c8cdd4" stroke-width="1.6" stroke-linecap="round"/>` +
    `<path d="M40 6 L17.5 34" stroke="${WOOD_D}" stroke-width="6" stroke-linecap="round"/><path d="M39.4 6.6 L18 33.4" stroke="${WOOD}" stroke-width="3" stroke-linecap="round"/>` +
    `<path d="M41 4.8 L33.5 14.2" stroke="#a8261f" stroke-width="8.4" stroke-linecap="round"/><path d="M41 4.8 L33.5 14.2" stroke="${RED}" stroke-width="5.6" stroke-linecap="round"/>` +
    `<path d="M38.2 6.4 L36.2 8.9" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>`,
  // de hamer: een houten steel met een rood handvat en een stalen kop met een klauw
  hammer:
    `<g transform="rotate(38 24 25)">` +
    `<rect x="20.5" y="15" width="7" height="30" rx="3.5" fill="${WOOD_D}"/><rect x="22" y="16" width="3" height="22" rx="1.5" fill="${WOOD}"/>` +
    `<rect x="19.5" y="32" width="9" height="13.5" rx="4" fill="#a8261f"/><rect x="21" y="33.5" width="3.4" height="10.5" rx="1.7" fill="${RED}"/>` +
    `<path d="M13 7 H31 V19 H13 Q11 14.5 5 17 L3.5 13 Q7 6.5 13 7 Z" fill="#8f96a0" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>` +
    `<rect x="30" y="5" width="8.5" height="16" rx="2.6" fill="#b9bec6" stroke="${INK}" stroke-width="2"/>` +
    `<path d="M14 10.5 H27" stroke="#dde1e6" stroke-width="2.2" stroke-linecap="round"/><path d="M33 8.5 V17.5" stroke="#e8ebef" stroke-width="1.8" stroke-linecap="round"/>` +
    `</g>`,
  // het hok is te klein: een klein verblijf met een dier dat er bijna niet in past, en groene pijlen naar de grootte die het moet worden
  grow:
    `<rect x="4" y="4" width="40" height="40" rx="5" fill="#dff2d0" stroke="#5bab4c" stroke-width="3" stroke-dasharray="5 4"/>` +
    `<rect x="14" y="14" width="20" height="20" rx="2" fill="#f1e2c0" stroke="${WOOD_D}" stroke-width="4"/>` +
    `<ellipse cx="24" cy="25" rx="8" ry="6.5" fill="#9aa0a6"/><circle cx="31" cy="21" r="4" fill="#9aa0a6"/><circle cx="32.5" cy="20" r="1" fill="${INK}"/>` +
    `<path d="M12 12 L5 5 M5 5 h6 M5 5 v6 M36 36 L43 43 M43 43 h-6 M43 43 v-6 M36 12 L43 5 M43 5 h-6 M43 5 v6 M12 36 L5 43 M5 43 h6 M5 43 v-6" fill="none" stroke="#2f8f3a" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>`,
  tree:
    '<rect x="21" y="26" width="6" height="18" rx="2" fill="#a8743f"/><circle cx="24" cy="18" r="14" fill="#5bab4c"/><circle cx="16" cy="24" r="8" fill="#4f9e45"/><circle cx="33" cy="23" r="8" fill="#468f3e"/>',
  pine:
    '<rect x="21" y="36" width="6" height="8" fill="#a8743f"/><path d="M24 3 L34 17 H14Z M24 12 L37 28 H11Z M24 22 L40 38 H8Z" fill="#468f3e"/>',
  palm:
    '<path d="M22 44 Q20 28 25 16" fill="none" stroke="#b88a52" stroke-width="5" stroke-linecap="round"/>' +
    '<path d="M25 16 Q13 6 4 14 M25 16 Q37 6 46 14 M25 16 Q16 14 9 24 M25 16 Q34 14 41 24 M25 16 Q25 5 30 3" fill="none" stroke="#5bab4c" stroke-width="5" stroke-linecap="round"/>',
  hedge:
    '<rect x="4" y="18" width="40" height="24" rx="8" fill="#468f3e"/><rect x="7" y="16" width="34" height="10" rx="5" fill="#5bab4c"/>',
  roses:
    '<rect x="5" y="36" width="38" height="8" rx="4" fill="#7a5636"/><circle cx="16" cy="30" r="9" fill="#468f3e"/><circle cx="32" cy="30" r="9" fill="#468f3e"/><circle cx="24" cy="24" r="9" fill="#4f9e45"/>' +
    '<g fill="#d8362e"><circle cx="15" cy="26" r="5"/><circle cx="33" cy="27" r="5"/></g><circle cx="24" cy="18" r="5.5" fill="#f06aa6"/><g fill="#fff7e0"><circle cx="15" cy="26" r="1.6"/><circle cx="33" cy="27" r="1.6"/><circle cx="24" cy="18" r="1.8"/></g>',
  tulips:
    '<rect x="5" y="38" width="38" height="6" rx="3" fill="#7a5636"/><path d="M12 39 V24 M24 39 V20 M36 39 V24" stroke="#4f9e45" stroke-width="3" stroke-linecap="round"/>' +
    '<path d="M7 24 Q7 12 12 14 Q17 12 17 24Z" fill="#e0584f"/><path d="M19 20 Q19 8 24 10 Q29 8 29 20Z" fill="#ffd23f"/><path d="M31 24 Q31 12 36 14 Q41 12 41 24Z" fill="#b06ad9"/>',
  mushrooms:
    '<rect x="13" y="26" width="8" height="16" rx="3" fill="#fff7e0"/><path d="M3 28 Q17 4 31 28Z" fill="#d8362e"/><g fill="#fff"><circle cx="13" cy="21" r="2.4"/><circle cx="21" cy="17" r="2"/></g>' +
    '<rect x="33" y="33" width="5" height="10" rx="2" fill="#fff7e0"/><path d="M27 35 Q35.5 20 44 35Z" fill="#d8362e"/>',
  pond:
    '<ellipse cx="24" cy="30" rx="21" ry="12" fill="#b9c2c9"/><ellipse cx="24" cy="29" rx="17" ry="9" fill="#6ec3e8"/><ellipse cx="17" cy="30" rx="5" ry="3" fill="#5bab4c"/><ellipse cx="31" cy="26" rx="4" ry="2.4" fill="#5bab4c"/><circle cx="17" cy="28" r="2.4" fill="#f48fb1"/>',
  waterfall:
    '<path d="M6 44 V20 L14 10 H34 L42 20 V44Z" fill="#8f949c"/><rect x="19" y="10" width="10" height="28" fill="#d6f1ff"/><ellipse cx="24" cy="40" rx="15" ry="5" fill="#6ec3e8"/>',
  well:
    '<path d="M6 16 L24 4 L42 16Z" fill="#c9553f"/><path d="M12 16 V34 M36 16 V34" stroke="#a8743f" stroke-width="4"/><rect x="9" y="30" width="30" height="14" rx="3" fill="#b9c2c9"/><rect x="20" y="20" width="8" height="7" rx="1.5" fill="#8a857a"/><path d="M24 16 V20" stroke="#8a857a" stroke-width="2"/>',
  statue:
    '<rect x="8" y="36" width="32" height="8" rx="2" fill="#b9c2c9"/><rect x="13" y="28" width="22" height="9" fill="#cfd6dc"/>' +
    '<path d="M14 26 V19 H18 V14 H30 V8 L34 5 V8 H38 V16 H34 V26 H30 V21 H22 V26Z" fill="#ffd23f" stroke="#e5b520" stroke-width="1.5" stroke-linejoin="round"/>',
  topiary:
    '<path d="M16 36 H32 L29 45 H19Z" fill="#c9553f"/><rect x="22" y="28" width="4" height="9" fill="#a8743f"/><circle cx="24" cy="23" r="10" fill="#468f3e"/><circle cx="24" cy="10" r="6.5" fill="#4f9e45"/>',
  lantern:
    '<rect x="22" y="18" width="4" height="26" fill="#3d4f5a"/><rect x="17" y="42" width="14" height="4" rx="2" fill="#3d4f5a"/><rect x="16" y="8" width="16" height="13" rx="2" fill="#fff1a8" stroke="#3d4f5a" stroke-width="2.5"/><path d="M14 8 L24 2 L34 8Z" fill="#3d4f5a"/>',
  // meer licht: een laag tuinlampje, een lampion aan een stok, een fakkel en een straatlamp met twee lampen
  gardenlight:
    '<rect x="21.5" y="30" width="5" height="14" rx="2" fill="#3d4f5a"/><ellipse cx="24" cy="44" rx="9" ry="3" fill="#3d4f5a"/><circle cx="24" cy="24" r="10" fill="#fff1a8" stroke="#ffd23f" stroke-width="2.5"/><path d="M12 19 Q24 6 36 19Z" fill="#3d4f5a"/>',
  lampion:
    '<path d="M12 46 V10 Q12 4 20 4 H31" fill="none" stroke="#7a5230" stroke-width="3.5" stroke-linecap="round"/><path d="M31 4 V11" stroke="#3d4f5a" stroke-width="2"/>' +
    '<ellipse cx="31" cy="24" rx="10.5" ry="12" fill="#ffb84a" stroke="#e0584f" stroke-width="2.5"/><path d="M31 12 V36 M25 14 Q22 24 25 34 M37 14 Q40 24 37 34" fill="none" stroke="#e0584f" stroke-width="1.6"/><rect x="26" y="9.5" width="10" height="4" rx="1.5" fill="#e0584f"/><rect x="26" y="34.5" width="10" height="4" rx="1.5" fill="#e0584f"/><path d="M31 38.5 V45" stroke="#e0584f" stroke-width="2.2" stroke-linecap="round"/>',
  torch:
    '<path d="M21 46 L22.5 20 H25.5 L27 46Z" fill="#a9743f"/><path d="M17 20 H31 L28.5 27 H19.5Z" fill="#3d4f5a"/><path d="M24 2 C33 10 32 20 24 20 C16 20 15 10 24 2Z" fill="#f08a24"/><path d="M24 9 C28.5 13.5 28 19.5 24 19.5 C20 19.5 19.5 13.5 24 9Z" fill="#ffd23f"/>',
  streetlamp:
    '<rect x="22" y="9" width="4" height="35" fill="#3d4f5a"/><rect x="16" y="42" width="16" height="4" rx="2" fill="#3d4f5a"/><path d="M9 11 Q24 2 39 11" fill="none" stroke="#3d4f5a" stroke-width="3.5" stroke-linecap="round"/>' +
    '<path d="M4 11 H15 L13 14 H6Z" fill="#3d4f5a"/><path d="M33 11 H44 L42 14 H35Z" fill="#3d4f5a"/><ellipse cx="9.5" cy="18" rx="5" ry="5.5" fill="#fff1a8" stroke="#ffd23f" stroke-width="2"/><ellipse cx="38.5" cy="18" rx="5" ry="5.5" fill="#fff1a8" stroke="#ffd23f" stroke-width="2"/>',
  // de knop Winkel: een hamburger, een beker met een rietje, een ballon en een knuffel bij elkaar
  shopmix:
    '<ellipse cx="38" cy="11" rx="7" ry="8.5" fill="#e0584f"/><path d="M38 19.5 l-1.5 3 h3Z" fill="#e0584f"/><path d="M38 22 Q34 28 37 33" fill="none" stroke="#7a8691" stroke-width="1.3"/><circle cx="35.5" cy="8" r="1.8" fill="#fff" opacity=".7"/>' +
    '<path d="M3 20 Q3 9 14 9 Q25 9 25 20Z" fill="#e9a23b"/><rect x="2" y="20" width="24" height="4.5" rx="2" fill="#6cc04a"/><rect x="3" y="24" width="22" height="5" rx="2" fill="#8a4b2a"/><path d="M3 29.5 H25 Q25 35 20 35 H8 Q3 35 3 29.5Z" fill="#e9a23b"/><circle cx="10" cy="14" r="1" fill="#fff7e0"/><circle cx="15" cy="12.5" r="1" fill="#fff7e0"/><circle cx="19" cy="15" r="1" fill="#fff7e0"/>' +
    '<path d="M28 27 H41 L39.5 46 H29.5Z" fill="#4a90e2"/><rect x="27" y="24.5" width="15" height="4" rx="2" fill="#d6ecfb"/><path d="M36 25 L39 16" stroke="#e0584f" stroke-width="2.4" stroke-linecap="round"/><path d="M29.5 34 H40.5" stroke="#fff" stroke-width="2.5"/>' +
    '<circle cx="8.5" cy="38.5" r="3" fill="#b9793f"/><circle cx="19.5" cy="38.5" r="3" fill="#b9793f"/><circle cx="14" cy="42" r="6" fill="#c98a4b"/><circle cx="12" cy="41" r=".9" fill="#3a2a1a"/><circle cx="16" cy="41" r=".9" fill="#3a2a1a"/><ellipse cx="14" cy="44" rx="2.2" ry="1.6" fill="#f3d9b5"/>',
  flag:
    '<rect x="9" y="4" width="4" height="42" rx="2" fill="#9aa0a6"/><path d="M13 7 H40 L34 15 L40 23 H13Z" fill="#e0584f"/><rect x="13" y="13" width="23" height="4" fill="#ffd23f"/>',
  signpost:
    '<rect x="21" y="6" width="6" height="40" rx="2" fill="#a8743f"/><path d="M14 10 H38 L44 16 L38 22 H14Z" fill="#fff7e0" stroke="#8a857a" stroke-width="1.5"/><path d="M34 26 H10 L4 32 L10 38 H34Z" fill="#9fd8f5" stroke="#8a857a" stroke-width="1.5"/>',
  // een vraagteken: boven een gast die de weg kwijt is
  question:
    '<path d="M14 17 Q14 6 24 6 Q34 6 34 16 Q34 22 28 25 Q24 27 24 32" fill="none" stroke="#4a90e2" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="24" cy="42" r="4" fill="#4a90e2"/>',
  // bang: een oranje rondje met een wit uitroepteken
  scared:
    `<circle cx="24" cy="24" r="20" fill="#f08a24" stroke="#fff" stroke-width="3"/>` +
    '<path d="M24 11 V28" stroke="#fff" stroke-width="7" stroke-linecap="round"/><circle cx="24" cy="36.5" r="4" fill="#fff"/>',
  boulder:
    '<path d="M5 40 L10 22 L22 14 L36 20 L43 40Z" fill="#8f949c"/><path d="M22 14 L26 28 L36 20" fill="none" stroke="#6f747c" stroke-width="2"/>',
  picnic:
    '<rect x="6" y="16" width="36" height="6" rx="2" fill="#a8743f"/><rect x="3" y="28" width="42" height="5" rx="2" fill="#a8743f"/><path d="M14 22 L8 42 M34 22 L40 42" stroke="#8a5a2c" stroke-width="4" stroke-linecap="round"/><rect x="18" y="12" width="12" height="5" rx="1" fill="#e0584f"/>',
  ball:
    '<circle cx="24" cy="26" r="17" fill="#e0584f"/><path d="M8 22 Q24 32 40 22 L41 29 Q24 39 7 29Z" fill="#fff7e0"/><circle cx="17" cy="17" r="4" fill="#fff" opacity=".6"/>',
  bush:
    '<circle cx="15" cy="30" r="11" fill="#4f9e45"/><circle cx="33" cy="30" r="11" fill="#468f3e"/><circle cx="24" cy="21" r="13" fill="#5bab4c"/><rect x="6" y="36" width="36" height="6" rx="3" fill="#468f3e"/>' +
    '<g fill="#e0584f"><circle cx="18" cy="22" r="2.6"/><circle cx="29" cy="17" r="2.6"/><circle cx="33" cy="29" r="2.6"/><circle cx="14" cy="33" r="2.6"/></g>',
  log:
    '<rect x="4" y="18" width="36" height="18" rx="9" fill="#a8743f"/><ellipse cx="38" cy="27" rx="6" ry="9" fill="#e3c08a"/><ellipse cx="38" cy="27" rx="3" ry="5" fill="none" stroke="#a8743f" stroke-width="1.6"/>' +
    '<path d="M10 23 H24 M12 30 H28" stroke="#8a5a2c" stroke-width="2" stroke-linecap="round"/>',
  flowerbed:
    '<rect x="4" y="34" width="40" height="9" rx="4" fill="#7a5636"/><path d="M12 35 V20 M24 35 V14 M36 35 V22" stroke="#4f9e45" stroke-width="3" stroke-linecap="round"/>' +
    '<circle cx="12" cy="17" r="6" fill="#e0584f"/><circle cx="24" cy="11" r="6.5" fill="#ffd23f"/><circle cx="36" cy="19" r="6" fill="#f06aa6"/><g fill="#fff7e0"><circle cx="12" cy="17" r="2"/><circle cx="24" cy="11" r="2.2"/><circle cx="36" cy="19" r="2"/></g>',
  fountain:
    '<ellipse cx="24" cy="38" rx="20" ry="7" fill="#b9c2c9"/><ellipse cx="24" cy="36.5" rx="16" ry="4.5" fill="#6ec3e8"/>' +
    '<rect x="21" y="21" width="6" height="15" fill="#b9c2c9"/><ellipse cx="24" cy="22" rx="11" ry="4" fill="#b9c2c9"/><ellipse cx="24" cy="21" rx="8" ry="2.4" fill="#6ec3e8"/>' +
    '<path d="M24 20 V6 M24 8 Q16 5 14 15 M24 8 Q32 5 34 15" fill="none" stroke="#6ec3e8" stroke-width="3.2" stroke-linecap="round"/>',
  carousel:
    '<path d="M3 19 L24 4 L45 19Z" fill="#e0584f"/><path d="M16 19 L24 4 L32 19Z" fill="#fff7e0"/><rect x="3" y="18" width="42" height="5" rx="2.5" fill="#ffd23f"/>' +
    '<path d="M11 23 V40 M24 23 V40 M37 23 V40" stroke="#9aa0a6" stroke-width="2.5"/><rect x="4" y="40" width="40" height="5" rx="2.5" fill="#e0584f"/>' +
    '<path d="M7 34 h8 v-6 l3 -2 v10 h-2 v4 h-2 v-4 h-3 v4 h-2 v-4 h-2z" fill="#b07a4a"/><path d="M28 32 h8 v-6 l3 -2 v10 h-2 v4 h-2 v-4 h-3 v4 h-2 v-4 h-2z" fill="#ffffff" stroke="#9aa0a6" stroke-width="1"/>',
  playground:
    `<path d="M9 44 V14 M21 44 V14 M9 24 H21 M9 34 H21" fill="none" stroke="${WOOD_D}" stroke-width="4" stroke-linecap="round"/>` +
    `<path d="M21 16 Q35 18 44 41" fill="none" stroke="${SUN}" stroke-width="8" stroke-linecap="round"/><path d="M5 14 L15 4 L25 14Z" fill="${RED}"/>`,
  fries:
    `<path d="M13 22 H35 L32 44 H16Z" fill="${RED}"/><g fill="${SUN}" stroke="${SUN_D}" stroke-width="1"><rect x="14" y="8" width="4.5" height="18" rx="1.5"/><rect x="19.5" y="4" width="4.5" height="22" rx="1.5"/><rect x="25" y="6" width="4.5" height="20" rx="1.5"/><rect x="30.5" y="10" width="4.5" height="16" rx="1.5"/></g>` +
    `<path d="M13 22 H35 L34.3 27 H13.7Z" fill="#b8433b"/>`,
  pancake:
    '<ellipse cx="24" cy="36" rx="19" ry="6" fill="#c98d4a"/><ellipse cx="24" cy="30" rx="18" ry="6" fill="#dba25c"/><ellipse cx="24" cy="24" rx="17" ry="6" fill="#e8b873"/>' +
    `<rect x="19" y="17" width="10" height="7" rx="2" fill="${SUN}"/><path d="M12 25 Q10 31 13 33" fill="none" stroke="#a8622a" stroke-width="3" stroke-linecap="round"/>`,
  hotdog:
    '<rect x="5" y="20" width="38" height="16" rx="8" fill="#e3b778"/><rect x="3" y="17" width="42" height="10" rx="5" fill="#c9553f"/>' +
    `<path d="M9 22 q3 -4 6 0 t6 0 t6 0 t6 0 t6 0" fill="none" stroke="${SUN}" stroke-width="2.5" stroke-linecap="round"/>`,
  lemonade:
    '<path d="M13 12 H35 L32 44 H16Z" fill="#fff" stroke="#9fb8c9" stroke-width="2"/><path d="M14.5 22 H33.5 L32 42 H16Z" fill="#ffe066"/>' +
    `<path d="M26 14 L33 3" stroke="${RED}" stroke-width="3" stroke-linecap="round"/><circle cx="21" cy="30" r="2" fill="#fff" opacity=".7"/><circle cx="27" cy="36" r="1.6" fill="#fff" opacity=".7"/>`,
  milk:
    '<path d="M14 16 L18 6 H30 L34 16 V43 H14Z" fill="#fff" stroke="#9fb8c9" stroke-width="2"/><path d="M14 16 H34" stroke="#9fb8c9" stroke-width="2"/>' +
    '<rect x="14" y="24" width="20" height="10" fill="#4a90e2"/><circle cx="24" cy="29" r="3" fill="#fff"/>',
  juice:
    '<path d="M13 12 H35 L32 44 H16Z" fill="#fff" stroke="#9fb8c9" stroke-width="2"/><path d="M14.5 20 H33.5 L32 42 H16Z" fill="#f5a623"/>' +
    `<circle cx="35" cy="12" r="8" fill="#f08a2c" stroke="#fff" stroke-width="2"/><path d="M35 5 V19 M28 12 H42" stroke="#fff" stroke-width="1.5"/><path d="M22 14 L17 3" stroke="${GRASS_D}" stroke-width="3" stroke-linecap="round"/>`,
  scoop:
    '<path d="M14 25 L24 46 L34 25Z" fill="#e3b778"/><path d="M18 30 L28 37 M22 26 L31 32" stroke="#c9975a" stroke-width="1.6"/>' +
    '<circle cx="24" cy="17" r="12" fill="#ffc1d6"/><circle cx="19" cy="12" r="3.2" fill="#fff" opacity=".7"/>',
  lolly:
    `<rect x="21.5" y="30" width="5" height="15" rx="2" fill="#e3b778"/><path d="M13 16 Q13 4 24 4 Q35 4 35 16 V34 H13Z" fill="${RED}"/>` +
    `<path d="M13 14 H35 V22 H13Z" fill="${SUN}"/><rect x="17" y="9" width="3.5" height="20" rx="1.7" fill="#fff" opacity=".5"/>`,
  hats:
    `<ellipse cx="24" cy="34" rx="21" ry="7" fill="${SUN_D}"/><path d="M11 33 Q11 12 24 12 Q37 12 37 33Z" fill="${SUN}"/><path d="M11 30 Q24 36 37 30 V33 Q24 39 11 33Z" fill="${RED}"/>`,
  hat_straw:
    `<ellipse cx="24" cy="34" rx="21" ry="7" fill="${SUN_D}"/><path d="M11 33 Q11 12 24 12 Q37 12 37 33Z" fill="${SUN}"/><path d="M11 30 Q24 36 37 30 V33 Q24 39 11 33Z" fill="${RED}"/>`,
  hat_party:
    `<path d="M24 5 L39 42 H9Z" fill="#f06aa6"/><path d="M17 22 L31 22 M13 32 L35 32" stroke="#fff" stroke-width="3"/><circle cx="24" cy="6" r="5" fill="${SUN}"/><path d="M9 42 H39" stroke="${SUN}" stroke-width="5" stroke-linecap="round"/>`,
  hat_crown:
    `<path d="M6 38 L8 14 L17 25 L24 9 L31 25 L40 14 L42 38Z" fill="${SUN}" stroke="${SUN_D}" stroke-width="2" stroke-linejoin="round"/><circle cx="24" cy="30" r="3.5" fill="${RED}"/><circle cx="13" cy="31" r="2.5" fill="#4a90e2"/><circle cx="35" cy="31" r="2.5" fill="#4a90e2"/>`,
  cap_red: capIcon('#e0584f', '#b8433b'),
  cap_blue: capIcon('#4a90e2', '#3572b8'),
  balloon_red: balloonIcon('#e0584f', '#b8433b'),
  balloon_blue: balloonIcon('#4a90e2', '#3572b8'),
  balloon_yellow: balloonIcon('#ffd23f', '#e5b520'),
  balloon_heart:
    `<path d="M24 34 C6 22 8 7 17 6 C21 6 24 9 24 12 C24 9 27 6 31 6 C40 7 42 22 24 34Z" fill="#f06aa6"/><path d="M24 34 Q19 39 26 46" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/><ellipse cx="16" cy="13" rx="3" ry="4" fill="#fff" opacity=".55"/>`,
  // meer paden: kiezels, planken, een bloemenpad en een brug over water
  // rode klinkers in een visgraat, grijze keien en wit marmer met een ader
  brick: tile('#c9795a') + '<g stroke="#a85a3f" stroke-width="2" stroke-linecap="round"><path d="M14 20 l10 7 M24 13 l10 7 M12 27 l10 7 M24 27 l10 -7 M17 24 l7 -5"/></g>',
  cobble: tile('#9fa6ae') + '<g fill="#7f868e"><ellipse cx="16" cy="22" rx="4.5" ry="2.8"/><ellipse cx="27" cy="18" rx="4.5" ry="2.8"/><ellipse cx="31" cy="27" rx="4.5" ry="2.8"/><ellipse cx="20" cy="30" rx="4.5" ry="2.8"/><ellipse cx="24" cy="24" rx="3" ry="2"/></g>',
  marble: tile('#f1f3f5', '#dfe4e8') + '<path d="M12 22 q6 4 10 0 t10 4 M20 31 q4 -3 8 0" fill="none" stroke="#b9c2ca" stroke-width="1.8" stroke-linecap="round"/><path d="M24 9 L45 24 L24 39 L3 24Z" fill="none" stroke="#c5ccd3" stroke-width="2"/>',
  gravel:
    tile('#c3c6cb', '#b7bbc1') +
    '<g fill="#8a8f98"><ellipse cx="14" cy="24" rx="3" ry="2"/><ellipse cx="24" cy="16" rx="2.6" ry="1.8"/><ellipse cx="32" cy="27" rx="3" ry="2"/><ellipse cx="21" cy="31" rx="2.6" ry="1.8"/><ellipse cx="27" cy="22" rx="2.2" ry="1.5"/></g>' +
    '<g fill="#f1f2f4"><ellipse cx="20" cy="22" rx="2.6" ry="1.8"/><ellipse cx="34" cy="21" rx="2.4" ry="1.6"/><ellipse cx="27" cy="32" rx="2.2" ry="1.5"/><ellipse cx="9" cy="24" rx="2" ry="1.4"/><ellipse cx="38" cy="25" rx="1.8" ry="1.3"/></g>',
  planks:
    tile(WOOD) +
    '<path d="M8.25 27.75 L29.25 12.75 M13.5 31.5 L34.5 16.5 M18.75 35.25 L39.75 20.25" stroke="#8a5a2c" stroke-width="2" stroke-linecap="round"/>' +
    '<g fill="#8a5a2c"><circle cx="8.1" cy="24.1" r="1.1"/><circle cx="24.1" cy="12.7" r="1.1"/><circle cx="13.4" cy="27.8" r="1.1"/><circle cx="29.4" cy="16.4" r="1.1"/><circle cx="18.6" cy="31.6" r="1.1"/><circle cx="34.6" cy="20.2" r="1.1"/><circle cx="23.9" cy="35.3" r="1.1"/><circle cx="39.9" cy="23.9" r="1.1"/></g>',
  flowerpath:
    tile('#d8c7ab') +
    '<g fill="#b9a686"><ellipse cx="20" cy="24" rx="4" ry="2.2"/><ellipse cx="28" cy="27" rx="3.4" ry="1.9"/><ellipse cx="27" cy="20" rx="3" ry="1.7"/></g>' +
    '<g fill="#5bab4c"><circle cx="9" cy="24" r="3.8"/><circle cx="16" cy="18" r="3.8"/><circle cx="32" cy="18" r="3.8"/><circle cx="39" cy="24" r="3.8"/><circle cx="16" cy="30" r="3.8"/><circle cx="32" cy="30" r="3.8"/></g>' +
    `<circle cx="9" cy="24" r="2.6" fill="#f06aa6"/><circle cx="16" cy="18" r="2.6" fill="${SUN}"/><circle cx="32" cy="18" r="2.6" fill="${RED}"/><circle cx="39" cy="24" r="2.6" fill="${SUN}"/><circle cx="16" cy="30" r="2.6" fill="${RED}"/><circle cx="32" cy="30" r="2.6" fill="#f06aa6"/>` +
    '<g fill="#fff7e0"><circle cx="9" cy="24" r="1"/><circle cx="16" cy="18" r="1"/><circle cx="32" cy="18" r="1"/><circle cx="39" cy="24" r="1"/><circle cx="16" cy="30" r="1"/><circle cx="32" cy="30" r="1"/></g>',
  bridge:
    tile('#6ec3e8') +
    '<path d="M13 19.5 q1.5 -1.6 3 0 M19 15 q1.5 -1.6 3 0 M27 33 q1.5 -1.6 3 0 M33 29 q1.5 -1.6 3 0" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>' +
    `<path d="M9.3 28.5 L30.3 13.5 L38.7 19.5 L17.7 34.5Z" fill="${WOOD}"/><path d="M13.5 25.5 L21.9 31.5 M17.7 22.5 L26.1 28.5 M21.9 19.5 L30.3 25.5 M26.1 16.5 L34.5 22.5" stroke="${WOOD_D}" stroke-width="1.8"/>` +
    '<path d="M9.3 28.5 V22.5 M19.8 21 V15 M30.3 13.5 V7.5 M9.3 22.5 L30.3 7.5 M17.7 34.5 V28.5 M28.2 27 V21 M38.7 19.5 V13.5 M17.7 28.5 L38.7 13.5" fill="none" stroke="#8a5a2c" stroke-width="2.6" stroke-linecap="round"/>',
  // meer hekken: een muur met een ruit, een laag wit hekje en het poortje van de kinderboerderij
  window:
    '<rect x="4" y="9" width="40" height="32" rx="2" fill="#a9adb3"/>' +
    '<path d="M4 17 H44 M4 33 H44 M10 9 V17 M24 9 V17 M38 9 V17 M9 17 V33 M39 17 V33 M10 33 V41 M24 33 V41 M38 33 V41" fill="none" stroke="#7d8189" stroke-width="2"/>' +
    '<rect x="13" y="14" width="22" height="21" rx="2" fill="#bfe6f7" stroke="#7fa6bb" stroke-width="3"/><path d="M18 30 L26 19 M26 31 L30 25" stroke="#fff" stroke-width="3" stroke-linecap="round"/>',
  picket:
    `<rect x="2" y="40" width="44" height="5" rx="2.5" fill="${GRASS}"/>` +
    `<g fill="#fff" stroke="${GREY}" stroke-width="1.6" stroke-linejoin="round"><rect x="2" y="24" width="44" height="4.5" rx="1.5"/><rect x="2" y="33" width="44" height="4.5" rx="1.5"/>` +
    '<path d="M4.5 42 V19 L8 14 L11.5 19 V42Z M15 42 V19 L18.5 14 L22 19 V42Z M26 42 V19 L29.5 14 L33 19 V42Z M36.5 42 V19 L40 14 L43.5 19 V42Z"/></g>',
  petgate:
    `<g fill="#fff" stroke="${GREY}" stroke-width="1.8" stroke-linejoin="round"><path d="M12 43 V21 Q24 9 36 21 V43Z"/><rect x="4" y="13" width="8" height="31" rx="2"/><rect x="36" y="13" width="8" height="31" rx="2"/><circle cx="8" cy="10" r="4"/><circle cx="40" cy="10" r="4"/></g>` +
    '<path d="M17 17.5 V43 M31 17.5 V43" stroke="#b9c2c9" stroke-width="1.6"/>' +
    `<g transform="translate(15.5 20) scale(.355)">${HEART}</g>`,
  // meer voor in een verblijf: heuvel, rotsen, drinkvijver, waterval, warmtelamp, ijsblok, klimrek en tunnel
  hill:
    `<path d="M2 42 Q6 10 24 10 Q42 10 46 42Z" fill="${GRASS}"/><path d="M24 10 Q42 10 46 42 H28 Q36 28 24 10Z" fill="${GRASS_D}"/>` +
    `<path d="M10 35 l2 -5 l2 5 M17 25 l2 -5 l2 5" fill="none" stroke="${GRASS_D}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="22" cy="34" r="3" fill="#fff"/><circle cx="22" cy="34" r="1.3" fill="${SUN}"/>`,
  rocks:
    '<path d="M11 41 L14 20 L25 9 L36 15 L41 41Z" fill="#8f949c"/><path d="M25 9 L27 22 L36 15" fill="none" stroke="#6f747c" stroke-width="2" stroke-linejoin="round"/>' +
    '<path d="M2 43 L5 31 L13 25 L22 30 L25 43Z" fill="#b4b8bf"/><path d="M22 43 L25 32 L35 27 L44 33 L46 43Z" fill="#a9adb3"/>' +
    '<path d="M13 25 L14 34 M35 27 L33 35" stroke="#7d8189" stroke-width="2" stroke-linecap="round"/>',
  drink:
    '<ellipse cx="24" cy="33" rx="21" ry="10" fill="#a9adb3"/><ellipse cx="24" cy="32" rx="16.5" ry="6.5" fill="#6ec3e8"/><path d="M15 33 q3 -2.5 6 0 t6 0 t6 0" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/>' +
    '<path d="M24 2 C31 11 32 14 32 16 A8 8 0 0 1 16 16 C16 14 17 11 24 2Z" fill="#4aa8d8"/><ellipse cx="20.5" cy="15" rx="2" ry="3.2" fill="#fff" opacity=".6"/>',
  fall:
    '<path d="M5 44 V24 L11 13 H29 L33 23 H40 L44 31 V44Z" fill="#8f949c"/><path d="M13 13 H27 Q28 26 36 27 V40 H13Z" fill="#9fd8f5"/>' +
    '<path d="M18 16 V34 M23 18 V31 M30 29 V37" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><ellipse cx="24" cy="41" rx="20" ry="5" fill="#6ec3e8"/>' +
    '<circle cx="14" cy="38" r="2" fill="#fff"/><circle cx="33" cy="39" r="2.4" fill="#fff"/><circle cx="24" cy="37.5" r="1.8" fill="#fff"/>',
  lamp:
    '<path d="M21 17 L13 43 H43 L35 17Z" fill="#ff9a3c" opacity=".35"/><path d="M24 17 L21 43 H35 L32 17Z" fill="#ffd23f" opacity=".5"/>' +
    '<path d="M8 44 V10 Q8 4 14 4 H28 V8" fill="none" stroke="#3d4f5a" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/><rect x="2" y="42" width="12" height="4" rx="2" fill="#3d4f5a"/>' +
    `<ellipse cx="28" cy="18" rx="6" ry="4" fill="#ffb347"/><path d="M18 18 Q18 7 28 7 Q38 7 38 18Z" fill="${RED}"/>`,
  icebox:
    '<path d="M24 6 L42 15 V34 L24 43 L6 34 V15Z" fill="#bfe6f7"/><path d="M24 6 L42 15 L24 24 L6 15Z" fill="#e9f7fd"/><path d="M24 24 L42 15 V34 L24 43Z" fill="#8fcdeb"/>' +
    '<path d="M11 22 V31 M15.5 25 V30 M29 30 L37 26" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><path d="M24 6 L42 15 V34 L24 43 L6 34 V15Z" fill="none" stroke="#6fb3d6" stroke-width="1.6" stroke-linejoin="round"/>',
  frame:
    `<g fill="${WOOD_D}"><rect x="6" y="8" width="5" height="37" rx="2"/><rect x="21.5" y="8" width="5" height="37" rx="2"/><rect x="37" y="8" width="5" height="37" rx="2"/></g>` +
    '<path d="M27 26 L37 43 M37 26 L27 43 M27 34.5 H37" stroke="#e3c08a" stroke-width="2.2" stroke-linecap="round"/>' +
    `<g fill="${WOOD}"><rect x="3" y="6" width="42" height="6" rx="2"/><rect x="6" y="21" width="36" height="5" rx="2"/><rect x="9" y="30" width="14" height="4" rx="2"/><rect x="9" y="38" width="14" height="4" rx="2"/></g>`,
  tunnel:
    `<path d="M3 43 V26 Q3 7 24 7 Q45 7 45 26 V43Z" fill="${WOOD}"/><path d="M7 19 L14 23 M13 10.5 L18 17 M24 7 V15 M35 10.5 L30 17 M41 19 L34 23 M3 32 H12 M36 32 H45" stroke="${WOOD_D}" stroke-width="2.2" stroke-linecap="round"/>` +
    `<path d="M12 43 V27 Q12 15 24 15 Q36 15 36 27 V43Z" fill="${INK}"/><path d="M17 43 V31 Q17 24 24 24 Q31 24 31 31 V43Z" fill="${GRASS}"/>`,
  // speelgoed dat zelf beweegt: autoband, wipplank, slingerbal, kruipboog, bandenschommel en klimpaal
  tyre:
    '<circle cx="24" cy="25" r="14" fill="none" stroke="#3d4148" stroke-width="10"/><circle cx="24" cy="25" r="16.5" fill="none" stroke="#5b616a" stroke-width="5" stroke-dasharray="4 9"/>' +
    '<path d="M13.5 20 A11.5 11.5 0 0 1 24 13.5" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>',
  rocker:
    `<circle cx="24" cy="37" r="8" fill="${WOOD_D}"/><circle cx="24" cy="37" r="4" fill="none" stroke="#e3c08a" stroke-width="1.6"/>` +
    `<path d="M6 33 L42 21" stroke="#e3c08a" stroke-width="6.5" stroke-linecap="round"/><path d="M6 33 L10.5 31.5" stroke="${RED}" stroke-width="6.5" stroke-linecap="round"/><path d="M37.5 22.5 L42 21" stroke="#4a90e2" stroke-width="6.5" stroke-linecap="round"/>` +
    '<path d="M41 10 q4 4 2 9 M7 44 q-4 -3 -3 -7" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>',
  tetherball:
    `<ellipse cx="18" cy="43" rx="11" ry="3" fill="${GREY}"/><path d="M18 8 V42" stroke="${WOOD_D}" stroke-width="4.5" stroke-linecap="round"/><circle cx="18" cy="6.5" r="4" fill="${RED}"/>` +
    `<path d="M19 9 L35 25" stroke="#e8dcc0" stroke-width="2.2" stroke-linecap="round"/><circle cx="37" cy="29" r="8.5" fill="${SUN}"/><path d="M29 26.5 Q37 30.5 45 26.5 L45.4 31 Q37 35.5 28.6 31Z" fill="${RED}"/>`,
  logarch:
    `<g fill="${WOOD_D}"><rect x="5" y="10" width="6.5" height="35" rx="2"/><rect x="36.5" y="10" width="6.5" height="35" rx="2"/></g><rect x="2" y="6" width="44" height="7.5" rx="3.7" fill="${WOOD}"/>` +
    `<path d="M17 13.5 V27 M24 13.5 V32 M31 13.5 V26" stroke="#e8dcc0" stroke-width="2.2"/><circle cx="17" cy="29.5" r="3.2" fill="${RED}"/><circle cx="24" cy="34.5" r="3.2" fill="${SUN}"/><circle cx="31" cy="28.5" r="3.2" fill="#4a90e2"/>`,
  tyreswing:
    `<path d="M5 45 L12 7 H36 L43 45" fill="none" stroke="${WOOD_D}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 7 V29 M30 7 V29" stroke="#e8dcc0" stroke-width="2.2"/>` +
    '<ellipse cx="24" cy="32" rx="10.5" ry="5" fill="none" stroke="#3d4148" stroke-width="5.5"/>',
  pole:
    `<ellipse cx="24" cy="44.5" rx="9" ry="2.5" fill="#80552c"/><rect x="20" y="11" width="8" height="33" rx="2" fill="${WOOD_D}"/><rect x="19" y="24" width="10" height="10" rx="1" fill="#e8dcc0"/>` +
    `<path d="M19 27.3 H29 M19 30.6 H29" stroke="#c9b98f" stroke-width="1.2"/><path d="M28 19 H34 M20 39 H14" stroke="#80552c" stroke-width="3.2" stroke-linecap="round"/>` +
    `<rect x="7" y="6" width="34" height="6.5" rx="3.2" fill="${WOOD}"/><path d="M37 12.5 V26" stroke="#e8dcc0" stroke-width="2"/><circle cx="37" cy="28" r="2.6" fill="#e8dcc0"/>`,
  // meer gebouwen: uitkijktoren, restaurant, reuzenrad, botsauto, schuilhut, treinhalte en paraplu's
  tower:
    `<path d="M14 45 L17 22 M34 45 L31 22 M15.5 34 H32.5" fill="none" stroke="${WOOD_D}" stroke-width="3.5" stroke-linecap="round"/>` +
    `<path d="M21.5 22 V45 M26.5 22 V45 M21.5 28 H26.5 M21.5 34 H26.5 M21.5 40 H26.5" fill="none" stroke="${WOOD}" stroke-width="2"/>` +
    `<path d="M12 17 V10 M24 17 V10 M36 17 V10" stroke="${WOOD_D}" stroke-width="3"/><rect x="10" y="12.5" width="28" height="2.5" fill="${WOOD}"/><rect x="9" y="17" width="30" height="5" rx="2" fill="${WOOD}"/><path d="M6 11 L24 1 L42 11Z" fill="${RED}"/>`,
  restaurant:
    `<path d="M24 3 V45" stroke="#8a857a" stroke-width="2.5" stroke-linecap="round"/><path d="M3 22 Q5 6 24 6 Q43 6 45 22Z" fill="${RED}"/><path d="M16 22 Q17 9 24 6 Q31 9 32 22Z" fill="#fff7e0"/>` +
    `<path d="M4 45 V38 H10 M44 45 V38 H38" fill="none" stroke="${WOOD_D}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><rect x="8" y="31" width="32" height="4.5" rx="2" fill="${WOOD}"/>` +
    `<g fill="#fff" stroke="${GREY}" stroke-width="1"><ellipse cx="15" cy="30" rx="5" ry="1.8"/><ellipse cx="33" cy="30" rx="5" ry="1.8"/></g><circle cx="15" cy="28.5" r="2.2" fill="#e9a23b"/><circle cx="33" cy="28.5" r="2.2" fill="${GREEN}"/>`,
  ferris:
    '<path d="M24 21 L12 45 M24 21 L36 45" stroke="#3d4f5a" stroke-width="3.5" stroke-linecap="round"/><rect x="7" y="43" width="34" height="3.5" rx="1.75" fill="#3d4f5a"/>' +
    `<circle cx="24" cy="21" r="16" fill="none" stroke="${RED}" stroke-width="3"/><path d="M24 5 V37 M8 21 H40 M12.7 9.7 L35.3 32.3 M35.3 9.7 L12.7 32.3" stroke="#9aa0a6" stroke-width="1.8"/>` +
    `<circle cx="24" cy="5" r="3.6" fill="${SUN}"/><circle cx="35.3" cy="9.7" r="3.6" fill="#4a90e2"/><circle cx="40" cy="21" r="3.6" fill="${GREEN}"/><circle cx="35.3" cy="32.3" r="3.6" fill="#f06aa6"/>` +
    `<circle cx="24" cy="37" r="3.6" fill="${SUN}"/><circle cx="12.7" cy="32.3" r="3.6" fill="#4a90e2"/><circle cx="8" cy="21" r="3.6" fill="${GREEN}"/><circle cx="12.7" cy="9.7" r="3.6" fill="#f06aa6"/><circle cx="24" cy="21" r="3.2" fill="${RED}"/>`,
  bumper:
    `<path d="M33 22 V5" stroke="#8a857a" stroke-width="2.5" stroke-linecap="round"/><circle cx="33" cy="5" r="3" fill="${SUN}"/>` +
    `<path d="M25 24 V15 Q25 12 28 12 H31 Q34 12 34 15 V24Z" fill="#b8433b"/><path d="M5 34 Q5 22 17 22 H31 Q43 22 43 34 V37 H5Z" fill="${RED}"/>` +
    '<path d="M15 22 L19 14" stroke="#3d4f5a" stroke-width="3" stroke-linecap="round"/><circle cx="19.5" cy="13" r="3.2" fill="none" stroke="#3d4f5a" stroke-width="2.5"/>' +
    `<circle cx="13" cy="42" r="3" fill="#8a857a"/><circle cx="35" cy="42" r="3" fill="#8a857a"/><rect x="2" y="33" width="44" height="8" rx="4" fill="#3d4f5a"/><circle cx="10" cy="28" r="2.8" fill="${SUN}"/><path d="M18 28 H36" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>`,
  shelter:
    drop(10, 8) + drop(24, 6) + drop(38, 8) +
    `<rect x="8" y="27" width="5" height="18" rx="1.5" fill="${WOOD_D}"/><rect x="35" y="27" width="5" height="18" rx="1.5" fill="${WOOD_D}"/><path d="M17 39 V45 M31 39 V45" stroke="${WOOD_D}" stroke-width="3"/>` +
    `<rect x="14" y="35" width="20" height="4" rx="2" fill="${WOOD}"/><path d="M2 29 L24 15 L46 29Z" fill="#c0523f"/>`,
  station:
    '<rect x="8" y="3" width="32" height="26" rx="6" fill="#4a90e2"/><g fill="#fff"><rect x="13" y="13" width="15" height="8" rx="2"/><rect x="25" y="8" width="9" height="13" rx="1.5"/><rect x="15.5" y="8.5" width="4" height="6" rx="1"/><circle cx="18" cy="23" r="3"/><circle cx="29" cy="23" r="3"/></g>' +
    '<rect x="27.5" y="10.5" width="4" height="4" rx="1" fill="#4a90e2"/><rect x="22" y="29" width="4" height="10" fill="#3d4f5a"/>' +
    `<rect x="3" y="38" width="42" height="7" rx="2" fill="#b9c2c9"/><rect x="3" y="38" width="42" height="2.5" rx="1.25" fill="${SUN}"/>`,
  // de tribune: drie bankjes boven elkaar, met erboven een springende dolfijn met een bal op zijn neus
  show:
    `<path d="M4 45 V38 H14 V31 H24 V24 H44 V45Z" fill="#9fb4c4"/><rect x="4" y="35" width="12" height="4" rx="2" fill="${RED}"/><rect x="14" y="28" width="12" height="4" rx="2" fill="${SUN}"/><rect x="24" y="21" width="20" height="4" rx="2" fill="#4a90e2"/>` +
    `<path d="M6 22 Q12 6 28 8 Q22 11 20 15 Q14 15 10 23Z" fill="#7fa9cc"/><path d="M8 23 L3 27 M8 23 L5 18" stroke="#7fa9cc" stroke-width="3" stroke-linecap="round"/>` +
    `<path d="M16 9 L19 4 L21 10Z" fill="#7fa9cc"/><circle cx="25" cy="10" r="1.3" fill="${INK}"/><circle cx="33" cy="6" r="4" fill="${RED}"/>`,
  // de kabelbaan: twee bergen met sneeuw, en daarboven een schuine kabel met twee stoeltjes eraan
  cablecar:
    '<path d="M2 45 L16 22 L24 32 L33 17 L46 45Z" fill="#9fb4c4"/><path d="M16 22 L12 28.5 L16 27 L19.5 29Z M33 17 L29 23.5 L33 22 L37 25Z" fill="#fff"/>' +
    '<path d="M2 6 L46 17" stroke="#3d4f5a" stroke-width="2.5" stroke-linecap="round"/><path d="M14 9 V20 M34 14 V25" stroke="#3d4f5a" stroke-width="2"/>' +
    `<rect x="7" y="13" width="4" height="10" rx="2" fill="${RED}"/><rect x="7" y="19" width="14" height="4" rx="2" fill="${RED}"/>` +
    `<rect x="27" y="18" width="4" height="10" rx="2" fill="${SUN}"/><rect x="27" y="24" width="14" height="4" rx="2" fill="${SUN}"/>`,
  umbrellas:
    `<g fill="none" stroke="${WOOD_D}" stroke-width="2.5" stroke-linecap="round"><path d="M13.5 11 L11.5 5 Q10.5 1.5 7.5 3.5"/><path d="M34.5 11 L36.5 5 Q37.5 1.5 40.5 3.5"/><path d="M24 9 V5 Q24 2 27 2 Q30 2 30 5"/></g>` +
    `<path d="M10.5 10.5 L16.5 9 L20 30 L16 30Z" fill="${RED}"/><path d="M31.5 9 L37.5 10.5 L32 30 L28 30Z" fill="${SUN}"/><path d="M21 8 H27 L26 30 H22Z" fill="#4a90e2"/>` +
    `<path d="M12 28 H36 L33 45 H15Z" fill="${GREY}"/><rect x="10" y="26" width="28" height="4.5" rx="2" fill="#6c7078"/><path d="M19 34 V41 M29 34 V41" stroke="#b9bdc3" stroke-width="2.5" stroke-linecap="round"/>`,
  // meer versiering: gastenboek, plattegrond, vlaggetjes en lichtjes
  guestbook:
    `<rect x="2" y="12" width="44" height="31" rx="3" fill="${WOOD_D}"/><g fill="#fff7e0"><path d="M5 11 Q15 6 24 11 V39 Q15 34 5 39Z"/><path d="M43 11 Q33 6 24 11 V39 Q33 34 43 39Z"/></g><path d="M24 11 V39" stroke="#d3b96c" stroke-width="2"/>` +
    '<path d="M9 17 Q14 15 20 17.5 M9 23 Q14 21 20 23.5 M9 29 Q14 27 20 29.5" fill="none" stroke="#b9a686" stroke-width="2" stroke-linecap="round"/>' +
    `<g transform="translate(25.5 13) scale(.34)">${HEART}</g>`,
  mapboard:
    `<rect x="9" y="30" width="4.5" height="16" rx="1.5" fill="${WOOD_D}"/><rect x="34.5" y="30" width="4.5" height="16" rx="1.5" fill="${WOOD_D}"/><rect x="4" y="5" width="40" height="29" rx="3" fill="#fff7e0" stroke="${WOOD_D}" stroke-width="3"/>` +
    `<circle cx="13" cy="14" r="4.5" fill="${GRASS}"/><ellipse cx="35" cy="26" rx="5" ry="3" fill="#6ec3e8"/><path d="M9 28 Q15 16 24 20 T39 11" fill="none" stroke="#d3b96c" stroke-width="3.5" stroke-linecap="round"/>` +
    `<circle cx="24" cy="20" r="4.5" fill="${RED}" stroke="#fff" stroke-width="1.8"/>`,
  bunting:
    `<g transform="translate(0 4)"><path d="M3.3 9.9 L13 15 L9 28Z" fill="${RED}"/><path d="M13.9 15.3 L23.6 17 L19 31Z" fill="${SUN}"/><path d="M24.4 17 L34.1 15.3 L29 31Z" fill="#4a90e2"/><path d="M35 15 L44.7 9.9 L39 28Z" fill="${GREEN}"/>` +
    `<path d="M2 9 Q24 25 46 9" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/></g>`,
  lightstring:
    `<g transform="translate(0 5)"><path d="M2 8 Q24 26 46 8" fill="none" stroke="#3d4f5a" stroke-width="2.2" stroke-linecap="round"/>` +
    bulb(6.4, 11.2, SUN) + bulb(15.2, 15.6, '#ff9a3c') + bulb(24, 17, SUN) + bulb(32.8, 15.6, '#ff9a3c') + bulb(41.6, 11.2, SUN) +
    '</g>',
  // meer personeel: gids, fotograaf, karretje en de kleur van het pak
  guide:
    `<path d="M40 44 V4" stroke="${WOOD_D}" stroke-width="3" stroke-linecap="round"/><path d="M40 4 L30 8 L40 12Z" fill="${RED}"/>` +
    `<path d="M2 46 Q2 31 18 31 Q34 31 34 46Z" fill="#2bb5a8"/><path d="M28 38 L40 30" stroke="#2bb5a8" stroke-width="6" stroke-linecap="round"/><circle cx="40" cy="29" r="3.6" fill="${SKIN}"/>` +
    `<circle cx="18" cy="20" r="10" fill="${SKIN}"/><path d="M8 17 Q9 8 18 8 Q27 8 28 17Z" fill="#1f8f85"/><rect x="6" y="15.5" width="20" height="4" rx="2" fill="#177a71"/>` +
    `<circle cx="14.5" cy="23" r="1.7" fill="${INK}"/><circle cx="21.5" cy="23" r="1.7" fill="${INK}"/><path d="M14 26.5 Q18 30 22 26.5" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`,
  // de bewaker: donkerblauwe pet en een vangnet
  guard:
    `<path d="M38 44 L42 16" stroke="${WOOD_D}" stroke-width="3" stroke-linecap="round"/><ellipse cx="42" cy="10" rx="5.5" ry="7" fill="#fff" fill-opacity=".6" stroke="${RED}" stroke-width="2.5"/>` +
    `<path d="M2 46 Q2 31 18 31 Q34 31 34 46Z" fill="#2f3a68"/><path d="M28 38 L39 30" stroke="#2f3a68" stroke-width="6" stroke-linecap="round"/><circle cx="39" cy="29" r="3.6" fill="${SKIN}"/>` +
    `<circle cx="18" cy="20" r="10" fill="${SKIN}"/><path d="M8 17 Q9 8 18 8 Q27 8 28 17Z" fill="#2f3a68"/><rect x="6" y="15.5" width="20" height="4" rx="2" fill="#1f2748"/><circle cx="18" cy="12" r="2" fill="${SUN}"/>` +
    `<circle cx="14.5" cy="23" r="1.7" fill="${INK}"/><circle cx="21.5" cy="23" r="1.7" fill="${INK}"/><path d="M14 26.5 Q18 30 22 26.5" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/><circle cx="18" cy="36" r="2.2" fill="${SUN}"/>`,
  photo:
    `<rect x="16" y="7" width="14" height="9" rx="2.5" fill="#3d4f5a"/><rect x="7" y="9.5" width="7" height="5" rx="1.5" fill="${RED}"/><rect x="4" y="13" width="40" height="28" rx="6" fill="#3d4f5a"/>` +
    `<circle cx="24" cy="27" r="10" fill="#fff"/><circle cx="24" cy="27" r="7" fill="#4a90e2"/><circle cx="21.5" cy="24.5" r="2.2" fill="#fff" opacity=".8"/><rect x="35" y="17" width="5.5" height="4" rx="1.2" fill="${SUN}"/>`,
  cart:
    `<path d="M34 21 L46 15" stroke="${WOOD_D}" stroke-width="4" stroke-linecap="round"/><path d="M30 30 L34 43 M17 30 L13 37" stroke="#3d4f5a" stroke-width="3.2" stroke-linecap="round"/>` +
    '<path d="M11 16 Q22 3 35 16Z" fill="#e9d05a"/><path d="M6 15 H38 L32 31 H15Z" fill="#3c8747"/><path d="M6 15 H38" stroke="#2f6e39" stroke-width="3.5" stroke-linecap="round"/>' +
    '<circle cx="13" cy="38" r="7" fill="#3d4f5a"/><circle cx="13" cy="38" r="2.6" fill="#b9c2c9"/>',
  suit:
    '<path d="M16 6 L3 15 L9 25 L14 21.5 V43 H34 V21.5 L39 25 L45 15 L32 6 Q24 14 16 6Z" fill="#3c8747"/><path d="M16 6 Q24 14 32 6" fill="none" stroke="#2f6e39" stroke-width="3" stroke-linecap="round"/>' +
    `<g stroke="#fff" stroke-width="1.8"><circle cx="31" cy="33" r="4.5" fill="${RED}"/><circle cx="39.5" cy="38" r="4.5" fill="${SUN}"/><circle cx="31.5" cy="42" r="4.5" fill="#4a90e2"/></g>`,
  // het doktersspel: thermometer, pleister en een drankje
  thermo:
    `<g transform="rotate(45 24 24)"><rect x="19.5" y="1" width="9" height="33" rx="4.5" fill="#fff" stroke="${INK}" stroke-width="2"/><circle cx="24" cy="38" r="7.5" fill="${RED}" stroke="${INK}" stroke-width="2"/>` +
    `<rect x="22.2" y="14" width="3.6" height="22" rx="1.8" fill="${RED}"/><path d="M28.5 8 h-3.5 M28.5 13 h-3.5 M28.5 18 h-3.5 M28.5 23 h-3.5" stroke="${INK}" stroke-width="1.5"/></g>`,
  plaster:
    '<g transform="rotate(-35 24 24)"><rect x="3" y="15" width="42" height="18" rx="9" fill="#f0c493" stroke="#d49a63" stroke-width="2"/><rect x="16" y="16" width="16" height="16" rx="2.5" fill="#fbe6cb" stroke="#d49a63" stroke-width="1.5"/>' +
    '<g fill="#d49a63"><circle cx="8" cy="21" r="1.2"/><circle cx="8" cy="27" r="1.2"/><circle cx="12" cy="24" r="1.2"/><circle cx="40" cy="21" r="1.2"/><circle cx="40" cy="27" r="1.2"/><circle cx="36" cy="24" r="1.2"/></g></g>',
  syrup:
    `<rect x="14.5" y="10" width="9" height="8" fill="#a8622a"/><rect x="12" y="4" width="14" height="7" rx="2" fill="#fff" stroke="${GREY}" stroke-width="1.6"/><rect x="7" y="16" width="24" height="29" rx="5" fill="#a8622a"/>` +
    `<rect x="10" y="24" width="18" height="14" rx="2" fill="#fff"/><path d="M19 27 V35 M15 31 H23" stroke="${RED}" stroke-width="3.2" stroke-linecap="round"/>` +
    '<path d="M39 28 V44" stroke="#9aa0a6" stroke-width="4" stroke-linecap="round"/><ellipse cx="39" cy="20" rx="6.5" ry="8.5" fill="#b9c2c9"/><ellipse cx="39" cy="20.5" rx="4.3" ry="6" fill="#f06aa6"/>',
  // het weer en de seizoenen
  rain:
    '<g fill="#9fb2c4"><circle cx="15" cy="19" r="9"/><circle cx="27" cy="14" r="11"/><circle cx="37" cy="20" r="7.5"/><rect x="6" y="18" width="39" height="10" rx="5"/></g>' +
    drop(13, 38, '#4a90e2') + drop(24, 41, '#4a90e2') + drop(35, 38, '#4a90e2'),
  rainbow:
    `<g fill="none" stroke-width="4.6"><path d="M4.5 35 A19.5 19.5 0 0 1 43.5 35" stroke="${RED}"/><path d="M9 35 A15 15 0 0 1 39 35" stroke="${SUN}"/><path d="M13.5 35 A10.5 10.5 0 0 1 34.5 35" stroke="${GREEN}"/><path d="M18 35 A6 6 0 0 1 30 35" stroke="#4a90e2"/></g>` +
    '<g fill="#dfe8f0"><circle cx="6" cy="35" r="4.5"/><circle cx="12" cy="36.5" r="3.5"/><circle cx="42" cy="35" r="4.5"/><circle cx="36" cy="36.5" r="3.5"/><rect x="2" y="35" width="14" height="5" rx="2.5"/><rect x="32" y="35" width="14" height="5" rx="2.5"/></g>',
  spring:
    `<path d="M6 45 Q20 40 24 24" fill="none" stroke="#8a5a2c" stroke-width="3.5" stroke-linecap="round"/><ellipse cx="11" cy="37" rx="6" ry="3.2" fill="${GRASS_D}" transform="rotate(35 11 37)"/>` +
    '<g fill="#f7b6cf" stroke="#f48fb1" stroke-width="1.4"><circle cx="24" cy="11" r="7.5"/><circle cx="34.5" cy="18.6" r="7.5"/><circle cx="30.5" cy="30.9" r="7.5"/><circle cx="17.5" cy="30.9" r="7.5"/><circle cx="13.5" cy="18.6" r="7.5"/></g>' +
    `<circle cx="24" cy="22" r="5.5" fill="${SUN}"/>`,
  summer:
    `<g stroke="#f5a623" stroke-width="4" stroke-linecap="round"><path d="M20 2 v4 M20 34 v4 M2 20 h4 M34 20 h4 M7.3 7.3 l2.8 2.8 M29.9 29.9 l2.8 2.8 M32.7 7.3 l-2.8 2.8 M10.1 29.9 l-2.8 2.8"/></g><circle cx="20" cy="20" r="11.5" fill="${SUN}" stroke="${SUN_D}" stroke-width="2"/>` +
    `<circle cx="16" cy="18" r="1.7" fill="${INK}"/><circle cx="24" cy="18" r="1.7" fill="${INK}"/><path d="M15 23 Q20 27.5 25 23" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>` +
    `<path d="M38 46 V38" stroke="${GRASS_D}" stroke-width="3" stroke-linecap="round"/><g fill="${RED}"><circle cx="38" cy="30.2" r="3.4"/><circle cx="42.6" cy="33.5" r="3.4"/><circle cx="40.8" cy="38.9" r="3.4"/><circle cx="35.2" cy="38.9" r="3.4"/><circle cx="33.4" cy="33.5" r="3.4"/></g><circle cx="38" cy="35" r="2.6" fill="#fff7e0"/>`,
  autumn:
    '<path d="M24 39 V46" stroke="#8a5a2c" stroke-width="3" stroke-linecap="round"/><path d="M24 3 L28 12 L35 8 L34 18 L43 19 L37 27 L41 34 L30 34 L24 40 L18 34 L7 34 L11 27 L5 19 L14 18 L13 8 L20 12Z" fill="#f08a2c" stroke="#c96a15" stroke-width="2" stroke-linejoin="round"/>' +
    '<path d="M24 37 V14 M24 29 L15 21 M24 29 L33 21" fill="none" stroke="#c96a15" stroke-width="2" stroke-linecap="round"/>',
  winter:
    '<rect x="21" y="37" width="6" height="8" fill="#a8743f"/>' +
    '<path d="M24 22 L40 38 H8Z" fill="#468f3e"/><path d="M24 22 L35 33 Q32 35.5 29 32.5 Q26.5 35.5 24 32.5 Q21.5 35.5 19 32.5 Q16 35.5 13 33Z" fill="#fff"/>' +
    '<path d="M24 12 L37 28 H11Z" fill="#468f3e"/><path d="M24 12 L32 21.8 Q29.5 24 27 21.5 Q24 24.5 21 21.5 Q18.5 24 16 21.8Z" fill="#fff"/>' +
    '<path d="M24 3 L34 17 H14Z" fill="#468f3e"/><path d="M24 3 L29.5 10.7 Q27 12.5 24 10.5 Q21 12.5 18.5 10.7Z" fill="#fff"/>' +
    '<g fill="#9fd8f5"><circle cx="7" cy="9" r="2"/><circle cx="41" cy="7" r="2"/><circle cx="43" cy="22" r="1.8"/><circle cx="5" cy="23" r="1.8"/><circle cx="39" cy="43" r="1.6"/><circle cx="9" cy="43" r="1.6"/></g>',
  umbrella:
    `<path d="M24 22 V40 Q24 45 19.5 45 Q15.5 45 15.5 41" fill="none" stroke="${WOOD_D}" stroke-width="3.5" stroke-linecap="round"/><path d="M24 3 V7" stroke="${WOOD_D}" stroke-width="3" stroke-linecap="round"/>` +
    `<path d="M3 25 Q4 6 24 6 Q44 6 45 25 Q41.5 21 38 25 Q34.5 21 31 25 Q27.5 21 24 25 Q20.5 21 17 25 Q13.5 21 10 25 Q6.5 21 3 25Z" fill="${RED}"/><path d="M17 25 Q17 10 24 6 Q31 10 31 25 Q27.5 21 24 25 Q20.5 21 17 25Z" fill="#b8433b"/>`,
  // bijzondere gasten
  lost:
    `<circle cx="24" cy="26" r="17" fill="${SKIN}"/><path d="M7 24 Q8 6 24 6 Q40 6 41 24 Q33 13 24 15 Q15 13 7 24Z" fill="#7a4a22"/>` +
    `<path d="M13 20 L19 18 M35 20 L29 18 M13.5 25 Q16.5 22 19.5 25 M28.5 25 Q31.5 22 34.5 25" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>` +
    `<path d="M19 38 Q24 30 29 38 Q24 40.5 19 38Z" fill="${INK}"/>` +
    drop(14, 32) + drop(34, 32) + '<circle cx="8" cy="40" r="1.8" fill="#6ec3e8"/><circle cx="40" cy="40" r="1.8" fill="#6ec3e8"/>',
  seek:
    `<circle cx="21" cy="29" r="15.5" fill="${SKIN}"/><path d="M5.5 28 Q5 12 21 12 Q37 12 36.5 28 Q31 19 21 20 Q11 19 5.5 28Z" fill="${INK}"/>` +
    `<circle cx="15.5" cy="30" r="2.1" fill="${INK}"/><circle cx="26.5" cy="30" r="2.1" fill="${INK}"/><path d="M11.5 26 L17.5 24 M30.5 26 L24.5 24 M15.5 38 q2.75 -2.6 5.5 0 t5.5 0" fill="none" stroke="${INK}" stroke-width="2.3" stroke-linecap="round"/>` +
    '<circle cx="38" cy="11" r="8.5" fill="#4a90e2" stroke="#fff" stroke-width="2"/><path d="M35 9 Q35 5.5 38 5.5 Q41 5.5 41 8.3 Q41 10.3 38 11.3 V12.8" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="38" cy="16" r="1.4" fill="#fff"/>',
  wheelchair:
    '<rect x="10" y="12" width="5" height="18" rx="2" fill="#4a90e2"/><path d="M12.5 13 H7" stroke="#3d4f5a" stroke-width="3" stroke-linecap="round"/>' +
    `<circle cx="21" cy="8" r="5.5" fill="${SKIN}"/><path d="M21 16 V26" stroke="#f08a2c" stroke-width="8" stroke-linecap="round"/><path d="M21 27 H32 L35 35" fill="none" stroke="#3572b8" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>` +
    '<circle cx="19" cy="33" r="10.5" fill="none" stroke="#3d4f5a" stroke-width="3.5"/><circle cx="19" cy="33" r="2.5" fill="#3d4f5a"/><circle cx="35.5" cy="42.5" r="3.2" fill="#3d4f5a"/>',
  pram:
    '<path d="M39 21 L45 10" stroke="#3d4f5a" stroke-width="3.5" stroke-linecap="round"/><path d="M14 32 L12 40 M30 32 L32 40" stroke="#3d4f5a" stroke-width="2.5"/>' +
    `<circle cx="30" cy="17" r="5" fill="${SKIN}"/><circle cx="28.5" cy="16.5" r=".9" fill="${INK}"/><circle cx="31.8" cy="16.5" r=".9" fill="${INK}"/>` +
    '<path d="M5 20 Q5 5 21 5 V20Z" fill="#3572b8"/><path d="M21 20 L9.5 9.5 M21 20 L14 6.5" stroke="#4a90e2" stroke-width="1.6"/><path d="M5 20 H39 Q39 34 22 34 Q5 34 5 20Z" fill="#4a90e2"/>' +
    '<circle cx="12" cy="41" r="5" fill="#3d4f5a"/><circle cx="12" cy="41" r="1.8" fill="#b9c2c9"/><circle cx="32" cy="41" r="5" fill="#3d4f5a"/><circle cx="32" cy="41" r="1.8" fill="#b9c2c9"/>',
  // bij de evenementen: een groene speelknop en een vrachtwagen met voer
  play: '<circle cx="24" cy="24" r="21" fill="#54b83a" stroke="#3f9a2a" stroke-width="2.5"/><path d="M19 14 L35 24 L19 34Z" fill="#fff" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>',
  truck:
    '<rect x="3" y="13" width="27" height="21" rx="3" fill="#f08a24"/><path d="M8 19 h17 M8 25 h17" stroke="#c96f14" stroke-width="2.2" stroke-linecap="round"/>' +
    '<path d="M30 19 H39 L45 26 V34 H30Z" fill="#4a90e2"/><path d="M33 21.5 H38 L41.5 26 H33Z" fill="#d6ecfb"/>' +
    '<rect x="2" y="33" width="44" height="3.5" rx="1.5" fill="#5a6670"/><circle cx="12" cy="38" r="5.5" fill="#3d4f5a"/><circle cx="12" cy="38" r="2" fill="#b9c2c9"/><circle cx="37" cy="38" r="5.5" fill="#3d4f5a"/><circle cx="37" cy="38" r="2" fill="#b9c2c9"/>',
  cake:
    '<ellipse cx="24" cy="41.5" rx="21" ry="4" fill="#cfd6dc"/><rect x="7" y="23" width="34" height="18" rx="3" fill="#f7a8c8"/>' +
    '<path d="M7 28 Q7 22 12 22 H36 Q41 22 41 28 Q38 33 35 28.5 Q32 33 29.5 28.5 Q26.5 33 24 28.5 Q21.5 33 18.5 28.5 Q16 33 13 28.5 Q10 33 7 28Z" fill="#fff7e0"/>' +
    `<g fill="${RED}"><circle cx="14" cy="36.5" r="2"/><circle cx="24" cy="37" r="2"/><circle cx="34" cy="36.5" r="2"/></g><rect x="22" y="11" width="4" height="12" rx="1" fill="#4a90e2"/><path d="M22 16 l4 -2 M22 20 l4 -2" stroke="#fff" stroke-width="1.3"/>` +
    `<path d="M24 2 C28 7 27.5 11 24 11 C20.5 11 20 7 24 2Z" fill="#f08a24"/><path d="M24 6 C26 8.5 25.5 10.5 24 10.5 C22.5 10.5 22 8.5 24 6Z" fill="${SUN}"/>`,
  schoolclass:
    `<path d="M1 45 Q1 32 10 32 Q19 32 19 45Z" fill="${RED}"/><path d="M29 45 Q29 32 38 32 Q47 32 47 45Z" fill="#4a90e2"/>` +
    `<circle cx="10" cy="24" r="7.5" fill="${SKIN}"/><path d="M2.5 23 Q3 15 10 15 Q17 15 17.5 23 Q10 19 2.5 23Z" fill="#7a4a22"/>` +
    `<circle cx="38" cy="24" r="7.5" fill="#c99872"/><path d="M30.5 23 Q31 15 38 15 Q45 15 45.5 23 Q38 19 30.5 23Z" fill="${INK}"/>` +
    `<path d="M12 46 Q12 30 24 30 Q36 30 36 46Z" fill="${SUN}"/><circle cx="24" cy="19" r="9" fill="${SKIN}"/><path d="M15 18 Q15.5 8 24 8 Q32.5 8 33 18 Q24 13 15 18Z" fill="#e9a23b"/>` +
    `<g fill="${INK}"><circle cx="7.5" cy="25" r="1.2"/><circle cx="12.5" cy="25" r="1.2"/><circle cx="35.5" cy="25" r="1.2"/><circle cx="40.5" cy="25" r="1.2"/><circle cx="21" cy="20.5" r="1.5"/><circle cx="27" cy="20.5" r="1.5"/></g>` +
    `<path d="M21 24 Q24 26.5 27 24" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>`,
  // de burgemeester: grijs haar, een snor en een gouden ketting om
  mayor:
    `<path d="M5 46 Q5 31 24 31 Q43 31 43 46Z" fill="#3d4f8a"/><path d="M13 33.5 Q24 46 35 33.5" fill="none" stroke="${SUN}" stroke-width="3.4" stroke-linecap="round" stroke-dasharray="0.5 4.6"/>` +
    `<circle cx="24" cy="41.5" r="4" fill="${SUN}" stroke="${SUN_D}" stroke-width="1.6"/><circle cx="24" cy="18.5" r="11.5" fill="${SKIN}"/>` +
    '<path d="M12 18 Q12.5 5 24 5 Q35.5 5 36 18 Q31 10.5 24 11.5 Q17 10.5 12 18Z" fill="#c9cdd2"/>' +
    `<circle cx="19.5" cy="18" r="1.8" fill="${INK}"/><circle cx="28.5" cy="18" r="1.8" fill="${INK}"/><path d="M17 23 Q20.5 20.5 24 22.5 Q27.5 20.5 31 23 Q27.5 25 24 23.8 Q20.5 25 17 23Z" fill="#c9cdd2"/>` +
    `<path d="M20.5 26 Q24 28.5 27.5 26" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>`,
  celeb:
    `<path d="${STAR_PATH}" fill="${SUN}" stroke="${SUN_D}" stroke-width="2.5" stroke-linejoin="round"/>` +
    `<path d="M10 20.5 H38" stroke="${INK}" stroke-width="2"/><rect x="14" y="19.5" width="9" height="7.5" rx="3" fill="${INK}"/><rect x="25" y="19.5" width="9" height="7.5" rx="3" fill="${INK}"/>` +
    `<path d="M16.5 24.5 l2.5 -2.5 M27.5 24.5 l2.5 -2.5" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/><path d="M20 31 Q24 34.5 28 31" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`,
  wide:
    '<g fill="#d8c7ab" stroke="#b9a686" stroke-width="1.6" stroke-linejoin="round"><path d="M13 23 L24 31.5 L13 40 L2 31.5Z"/><path d="M35 23 L46 31.5 L35 40 L24 31.5Z"/></g>' +
    '<g fill="#b9a686"><ellipse cx="11" cy="31" rx="3" ry="1.7"/><ellipse cx="16" cy="34.5" rx="2.4" ry="1.4"/><ellipse cx="33" cy="31" rx="3" ry="1.7"/><ellipse cx="38" cy="34.5" rx="2.4" ry="1.4"/></g>' +
    '<path d="M6 11 H42 M6 11 l6 -6 M6 11 l6 6 M42 11 l-6 -6 M42 11 l-6 6" fill="none" stroke="#2f8f3a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>',
  train:
    '<circle cx="20" cy="5" r="3.4" fill="#dfe8f0"/><circle cx="26" cy="3.5" r="2.4" fill="#dfe8f0"/>' +
    `<path d="M9 21 V11 H7 V8 H17 V11 H15 V21Z" fill="#3d4f5a"/><rect x="4" y="19" width="26" height="15" rx="5" fill="${RED}"/><rect x="26" y="10" width="17" height="24" rx="2" fill="#4a90e2"/>` +
    `<rect x="24" y="7" width="21" height="4.5" rx="2" fill="#3572b8"/><rect x="30" y="15" width="9" height="8" rx="1.5" fill="#cfeaff"/><circle cx="8" cy="25" r="2.6" fill="${SUN}"/>` +
    '<rect x="3" y="32" width="42" height="4" rx="2" fill="#3d4f5a"/><path d="M4 36 L1 43 H9Z" fill="#3d4f5a"/>' +
    `<g fill="#3d4f5a"><circle cx="15" cy="39" r="5.5"/><circle cx="27" cy="39" r="5.5"/><circle cx="39" cy="39" r="5.5"/></g><g fill="${SUN}"><circle cx="15" cy="39" r="2"/><circle cx="27" cy="39" r="2"/><circle cx="39" cy="39" r="2"/></g>`,
  petting:
    '<ellipse cx="20" cy="37" rx="14" ry="9" fill="#e3bf94"/><ellipse cx="29" cy="19" rx="2.8" ry="7" fill="#e3bf94" transform="rotate(-10 29 19)"/><ellipse cx="35.5" cy="19.5" rx="2.8" ry="7" fill="#d3a876" transform="rotate(14 35.5 19.5)"/><circle cx="32" cy="31" r="8.5" fill="#e3bf94"/>' +
    `<circle cx="34.5" cy="29.5" r="1.6" fill="${INK}"/><circle cx="39.5" cy="33" r="1.5" fill="${PINK_D}"/><circle cx="7" cy="36" r="3.5" fill="#fff7e0"/>` +
    `<g transform="translate(25 31) rotate(180) scale(.55)">${HAND}</g><g transform="translate(34 1) scale(.26)">${HEART}</g>`,
  // over de dieren: zeldzaam, karakter, vriendjes, een weetje en een vieze kraam
  rare:
    '<path d="M12 9 H36 L45 20 L24 44 L3 20Z" fill="#7fd6f5"/><path d="M12 9 L18 20 H3Z M24 9 L30 20 H18Z M36 9 L45 20 H30Z" fill="#b6e8fa"/><path d="M30 20 H45 L24 44Z" fill="#4aa8d8"/>' +
    '<path d="M3 20 H45 M18 20 L24 44 L30 20" fill="none" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 9 H36 L45 20 L24 44 L3 20Z" fill="none" stroke="#3a9ccc" stroke-width="2" stroke-linejoin="round"/>' +
    `<g fill="${SUN}" stroke="#fff" stroke-width="1"><path d="M41 1 Q42 6 47 7 Q42 8 41 13 Q40 8 35 7 Q40 6 41 1Z"/><path d="M7 30 Q7.8 34.2 12 35 Q7.8 35.8 7 40 Q6.2 35.8 2 35 Q6.2 34.2 7 30Z"/></g>`,
  nature_shy:
    '<circle cx="11" cy="12" r="6" fill="#c99a66"/><circle cx="37" cy="12" r="6" fill="#c99a66"/><circle cx="24" cy="24" r="16" fill="#e3bf94"/>' +
    `<circle cx="18" cy="22" r="4.2" fill="#fff"/><circle cx="30" cy="22" r="4.2" fill="#fff"/><circle cx="19.5" cy="23" r="2.2" fill="${INK}"/><circle cx="31.5" cy="23" r="2.2" fill="${INK}"/><circle cx="11.5" cy="29" r="3.2" fill="${PINK}"/><circle cx="36.5" cy="29" r="3.2" fill="${PINK}"/>` +
    `<path d="M1 46 V39 Q5 30 12 36 Q17 29 24 35 Q31 29 36 36 Q43 30 47 39 V46Z" fill="${GRASS_D}"/><path d="M12 36 Q17 29 24 35 Q31 29 36 36" fill="none" stroke="${GRASS}" stroke-width="2" stroke-linecap="round"/>`,
  nature_playful:
    `<path d="M3 38 Q8 10 14 30" fill="none" stroke="${GREY}" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="1 5"/><ellipse cx="29" cy="43.5" rx="10" ry="2.5" fill="${INK}" opacity=".22"/>` +
    `<circle cx="29" cy="19" r="13" fill="${RED}"/><path d="M17 15.5 Q29 23.5 41 15.5 L41.8 21 Q29 29 16.2 21Z" fill="#fff7e0"/><circle cx="23.5" cy="12" r="3.2" fill="#fff" opacity=".6"/>` +
    `<path d="M21 35 v4 M29 36 v5 M37 35 v4" stroke="${GREY}" stroke-width="2.5" stroke-linecap="round"/>`,
  nature_sleepy:
    '<circle cx="8" cy="18" r="5.5" fill="#c99a66"/><circle cx="30" cy="18" r="5.5" fill="#c99a66"/><circle cx="19" cy="30" r="15" fill="#e3bf94"/>' +
    `<path d="M10.5 29 q3 3 6 0 M21.5 29 q3 3 6 0" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/><ellipse cx="19" cy="36.5" rx="2.2" ry="2.6" fill="${INK}"/>` +
    '<path d="M32 3 H41 L32 11.5 H41 M39 17 H45 L39 24 H45" fill="none" stroke="#6f8fe0" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
  nature_brave:
    '<path d="M24 3 L42 9 V23 Q42 37 24 45 Q6 37 6 23 V9Z" fill="#4a90e2" stroke="#3572b8" stroke-width="2.5" stroke-linejoin="round"/>' +
    `<path d="M24 11 L27.4 18.3 L35.3 19.5 L29.7 25.1 L31.1 33 L24 29.4 L16.9 33 L18.3 25.1 L12.7 19.5 L20.6 18.3Z" fill="${SUN}" stroke="${SUN_D}" stroke-width="1.5" stroke-linejoin="round"/>`,
  pals:
    `<g transform="translate(-1 3) scale(.7)">${HEART}</g><g transform="translate(15.5 11) scale(.7)"><path d="${HEART_PATH}" fill="${PINK_D}" stroke="#fff" stroke-width="3"/></g>`,
  fact:
    `<path d="M24 1.5 V4.5 M9 6 l2.3 2.3 M39 6 l-2.3 2.3 M3 21 h3.5 M41.5 21 h3.5" stroke="${SUN_D}" stroke-width="3" stroke-linecap="round"/>` +
    `<path d="M24 8 Q37 8 37 21 Q37 27 32 31.5 V36 H16 V31.5 Q11 27 11 21 Q11 8 24 8Z" fill="${SUN}" stroke="${SUN_D}" stroke-width="2"/><path d="M20 35 L21.5 24 L24 28 L26.5 24 L28 35" fill="none" stroke="${SUN_D}" stroke-width="2" stroke-linejoin="round"/>` +
    `<ellipse cx="18.5" cy="16" rx="2.6" ry="4" fill="#fff" opacity=".7"/><rect x="16.5" y="36" width="15" height="4.5" rx="1.5" fill="${GREY}"/><rect x="19.5" y="40.5" width="9" height="4" rx="2" fill="#6c7078"/>`,
  dirty:
    '<path d="M5 37 Q3 29 12 29 Q14 23 22 26 Q30 22 34 29 Q44 29 43 37 Q43 44 32 43 Q24 47 16 43 Q6 44 5 37Z" fill="#8a6a3a"/><ellipse cx="16" cy="35" rx="4" ry="2" fill="#a6844f"/><ellipse cx="30" cy="38" rx="3" ry="1.6" fill="#6f5228"/>' +
    '<path d="M12 23 q-3 -3.5 0 -7 t0 -7 M22 20 q-3 -3.5 0 -7 t0 -7" fill="none" stroke="#8fae3a" stroke-width="2.6" stroke-linecap="round"/>' +
    `<path d="M29 22 q2 4 5 -2" fill="none" stroke="${GREY}" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="1.5 2.5"/>` +
    `<ellipse cx="35" cy="10.5" rx="3.4" ry="2.6" fill="#cfeaff" stroke="${GREY}" stroke-width="1" transform="rotate(-30 35 10.5)"/><ellipse cx="41" cy="10.5" rx="3.4" ry="2.6" fill="#cfeaff" stroke="${GREY}" stroke-width="1" transform="rotate(30 41 10.5)"/><ellipse cx="38" cy="15" rx="4" ry="3" fill="${INK}"/>`,
} satisfies Record<string, string>;

// Slaapplekken krijgen een zzz in de hoek: zo zie je dat de rots bij de slaapplekken iets anders is dan de rotsen
// bij het speelgoed of de steen bij de natuur. Eerst een witte rand, dan de blauwe letters eroverheen.
const ZZZ_PATH = 'M27 4 H35 L27 13 H35 M38 12 H44 L38 19 H44';
const ZZZ =
  `<path d="${ZZZ_PATH}" fill="none" stroke="#fff" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>` +
  `<path d="${ZZZ_PATH}" fill="none" stroke="#3d6fd6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
for (const bed of ['straw', 'shed', 'rock', 'shade', 'nest', 'cave', 'climb', 'coral'] as const) ICONS[bed] += ZZZ;

export type IconId = keyof typeof ICONS;
export const ICON_IDS = Object.keys(ICONS) as IconId[];

/** Het plaatje als SVG-tekst, om in HTML te zetten. */
export function icon(name: IconId, cls = ''): string {
  return `<svg class="ic ${cls}" viewBox="0 0 48 48" aria-hidden="true">${ICONS[name]}</svg>`;
}

/** Het plaatje als muiscursor. (hx, hy) is het punt waarmee je aanwijst. */
const CURSOR_PX = 48;
export function cursor(name: IconId, hx = 16, hy = 16, fallback = 'pointer'): string {
  // anderhalf keer zo groot als een gewone cursor, zodat een kind goed ziet wat een tik gaat doen
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CURSOR_PX}" height="${CURSOR_PX}" viewBox="0 0 48 48">${ICONS[name]}</svg>`;
  const k = CURSOR_PX / 32;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${Math.round(hx * k)} ${Math.round(hy * k)}, ${fallback}`;
}
