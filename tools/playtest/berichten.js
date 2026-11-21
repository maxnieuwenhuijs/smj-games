// Telt hoeveel berichten de figuren in vijf minuten speltijd geven, in een druk park zonder verzorgers
// waar de speler niets doet. Wordt in de pagina geladen via /@fs/.
export async function measure(slotIndex = 1, minutes = 5) {
  localStorage.setItem('zoo-muted', '1');
  await new Promise(r => setTimeout(r, 1500));
  document.querySelectorAll('#start .slot')[slotIndex].click();
  await new Promise(r => setTimeout(r, 6000));
  const g = window.__zoo;
  for (const pen of g.pens) {
    if (pen.keeper) g.view.scene.remove(pen.keeper.mesh);
    pen.keeper = null;
  }
  const log = [];
  g.hud.say = (who, mood, text) => { log.push({ at: Math.round(g.clock), who, mood, text }); };
  g.save = async () => {};
  const start = g.clock;
  const lost0 = g.animals.length;
  for (let i = 0; i < minutes * 600; i++) g.update(0.1);
  const perMin = [];
  for (let m = 0; m < minutes; m++) perMin.push(log.filter(l => l.at - start >= m * 60 && l.at - start < (m + 1) * 60).length);
  return {
    level: g.level, animals: lost0, animalsAfter: g.animals.length, guests: g.guests.guests.length,
    total: log.length, perMin, urgent: log.filter(l => l.mood === 'urgent').length,
    by: log.reduce((o, l) => ((o[l.who] = (o[l.who] ?? 0) + 1), o), {}),
    first: log.slice(0, 6).map(l => `${l.at - Math.round(start)}s ${l.who}: ${l.text.slice(0, 40)}`),
  };
}
