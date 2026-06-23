import { VENUES, ROOF_LABELS, teamLabel, teamFlag, roundLabel } from './venues.js';
import { getMatchWeather, cToF, kmhToMph } from './weather.js';
import { renderBracket, setBracketMatches, openPredictions, initBracketUI } from './bracket.js';

let MATCHES = [];
let PHOTOS = {};
let HANDLERS = {};
let activeTab = 'schedule';
let schedFilter = 'all';

const $ = (id) => document.getElementById(id);
const isMobile = () => window.matchMedia('(max-width: 768px)').matches;

export function matchDate(m) {
  return new Date(m.DateUtc.replace(' ', 'T'));
}

function isLive(m) {
  const t = matchDate(m).getTime();
  return Date.now() >= t && Date.now() <= t + 2.2 * 3600000;
}

// Approximate match clock from elapsed wall time (no event feed for stoppage).
function liveMinuteLabel(m) {
  const el = (Date.now() - matchDate(m).getTime()) / 60000;
  if (el < 1) return "1'";
  if (el <= 45) return `${Math.ceil(el)}'`;
  if (el <= 62) return 'HT';
  if (el <= 107) return `${Math.min(90, Math.ceil(el - 17))}'`;
  return "90'+";
}

function liveCenterHTML(m) {
  const score = m.HomeTeamScore != null
    ? `<span class="score">${m.HomeTeamScore}–${m.AwayTeamScore}</span>` : '';
  return `<span class="liveWrap">${score}<span class="liveBadge" data-mn="${m.MatchNumber}">● ${liveMinuteLabel(m)}</span></span>`;
}

// Tick the on-screen match clocks; fully re-render only when a match starts
// or ends (so scroll position isn't disturbed mid-browse).
let lastLiveSet = null;
function liveTick() {
  const nowLive = MATCHES.filter(isLive).map((m) => m.MatchNumber).join(',');
  if (nowLive !== lastLiveSet) {
    lastLiveSet = nowLive;
    renderActiveTab();
    if (currentVenueKey) showVenuePanel(currentVenueKey);
    return;
  }
  document.querySelectorAll('.liveBadge[data-mn]').forEach((el) => {
    const m = MATCHES.find((x) => x.MatchNumber === Number(el.dataset.mn));
    if (m) el.textContent = `● ${liveMinuteLabel(m)}`;
  });
}

const sameDay = (d, ref) => d.toDateString() === ref.toDateString();
const isToday = (d) => sameDay(d, new Date());
const isTomorrow = (d) => sameDay(d, new Date(Date.now() + 864e5));

function userTime(d, opts) {
  return d.toLocaleString(undefined, opts);
}

function venueTime(d, tz, opts) {
  return d.toLocaleString(undefined, { timeZone: tz, ...opts });
}

function teamHTML(name, alignRight = false) {
  const label = teamLabel(name);
  const flag = teamFlag(name);
  const known = label === name; // real team vs placeholder
  return alignRight
    ? `<span class="team ${known ? '' : 'tbd'}">${label} <span class="flag">${flag}</span></span>`
    : `<span class="team ${known ? '' : 'tbd'}"><span class="flag">${flag}</span> ${label}</span>`;
}

function scoreHTML(m) {
  if (m.HomeTeamScore != null && m.AwayTeamScore != null) {
    return `<span class="score">${m.HomeTeamScore}–${m.AwayTeamScore}</span>`;
  }
  return `<span class="vs">${userTime(matchDate(m), { hour: 'numeric', minute: '2-digit' })}</span>`;
}

function matchRow(m, metaText) {
  const el = document.createElement('div');
  el.className = 'matchRow' + (isLive(m) ? ' live' : '');
  el.innerHTML = `
    <div class="matchTeams">
      ${teamHTML(m.HomeTeam)}
      ${isLive(m) ? liveCenterHTML(m) : scoreHTML(m)}
      ${teamHTML(m.AwayTeam, true)}
    </div>
    <div class="matchMeta">${metaText}</div>`;
  el.addEventListener('click', () => HANDLERS.onVenueClick && HANDLERS.onVenueClick(m.Location));
  return el;
}

// ---------- left panel: tabbed views ----------

function renderActiveTab() {
  $('filterBar').style.display = activeTab === 'schedule' ? '' : 'none';
  const list = $('matchList');
  list.innerHTML = '';
  if (activeTab === 'schedule') buildMatchList(list);
  else if (activeTab === 'groups') buildGroups(list);
  else buildKnockout(list);
}

function buildMatchList(list) {
  let matches = [...MATCHES].sort((a, b) => matchDate(a) - matchDate(b));
  if (schedFilter === 'today') matches = matches.filter((m) => isToday(matchDate(m)));
  if (schedFilter === 'tomorrow') matches = matches.filter((m) => isTomorrow(matchDate(m)));

  if (!matches.length) {
    list.innerHTML = `<div class="emptyState">No matches ${schedFilter === 'today' ? 'today' : 'tomorrow'}.</div>`;
    return;
  }

  const byDay = new Map();
  for (const m of matches) {
    const day = matchDate(m).toLocaleDateString(undefined, {
      weekday: 'long', month: 'long', day: 'numeric',
    });
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(m);
  }

  const todayKey = new Date().toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  });
  let firstUpcomingEl = null;

  for (const [day, dayMatches] of byDay) {
    const h = document.createElement('div');
    h.className = 'dayHeader' + (day === todayKey ? ' today' : '');
    h.textContent = day === todayKey ? `${day} — TODAY` : day;
    list.appendChild(h);

    for (const m of dayMatches) {
      const v = VENUES[m.Location];
      const el = matchRow(m, `${roundLabel(m)} · ${v ? v.city : m.Location}`);
      list.appendChild(el);
      if (!firstUpcomingEl && matchDate(m) > new Date(Date.now() - 2.2 * 3600000)) {
        firstUpcomingEl = el;
      }
    }
  }
  if (firstUpcomingEl && schedFilter === 'all') {
    requestAnimationFrame(() => firstUpcomingEl.scrollIntoView({ block: 'start' }));
  }
}

function buildGroups(list) {
  const groups = new Map();
  for (const m of MATCHES) {
    if (!m.Group) continue;
    if (!groups.has(m.Group)) groups.set(m.Group, { matches: [], teams: new Map() });
    const g = groups.get(m.Group);
    g.matches.push(m);
    for (const name of [m.HomeTeam, m.AwayTeam]) {
      if (!g.teams.has(name)) {
        g.teams.set(name, { name, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 });
      }
    }
    if (m.HomeTeamScore != null && m.AwayTeamScore != null) {
      const h = g.teams.get(m.HomeTeam);
      const a = g.teams.get(m.AwayTeam);
      h.p++; a.p++;
      h.gf += m.HomeTeamScore; h.ga += m.AwayTeamScore;
      a.gf += m.AwayTeamScore; a.ga += m.HomeTeamScore;
      if (m.HomeTeamScore > m.AwayTeamScore) { h.w++; h.pts += 3; a.l++; }
      else if (m.HomeTeamScore < m.AwayTeamScore) { a.w++; a.pts += 3; h.l++; }
      else { h.d++; a.d++; h.pts++; a.pts++; }
    }
  }

  for (const [name, g] of [...groups.entries()].sort((x, y) => x[0].localeCompare(y[0]))) {
    const teams = [...g.teams.values()].sort((a, b) =>
      b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || a.name.localeCompare(b.name));

    const card = document.createElement('div');
    card.className = 'groupCard';
    card.innerHTML = `
      <div class="groupName">${name}</div>
      <table class="standings">
        <thead><tr><th></th><th>P</th><th>GD</th><th>Pts</th></tr></thead>
        <tbody>${teams.map((t) => {
          const gd = t.gf - t.ga;
          return `<tr><td>${teamFlag(t.name)} ${t.name}</td><td>${t.p}</td>
            <td>${gd > 0 ? '+' : ''}${gd}</td><td class="ptsCol">${t.pts}</td></tr>`;
        }).join('')}</tbody>
      </table>
      <button class="groupToggle">Matches ▾</button>
      <div class="groupMatches" hidden></div>`;

    const gmDiv = card.querySelector('.groupMatches');
    for (const m of g.matches.sort((a, b) => matchDate(a) - matchDate(b))) {
      const v = VENUES[m.Location];
      const d = matchDate(m);
      const row = document.createElement('div');
      row.className = 'miniMatch clickable';
      const mid = m.HomeTeamScore != null ? `<b>${m.HomeTeamScore}–${m.AwayTeamScore}</b>` : 'v';
      row.innerHTML = `
        <span>${teamFlag(m.HomeTeam)} ${m.HomeTeam} ${mid} ${m.AwayTeam} ${teamFlag(m.AwayTeam)}</span>
        <span class="miniMeta">${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ${v ? v.city : ''}</span>`;
      row.addEventListener('click', () => HANDLERS.onVenueClick && HANDLERS.onVenueClick(m.Location));
      gmDiv.appendChild(row);
    }
    card.querySelector('.groupToggle').addEventListener('click', (e) => {
      gmDiv.hidden = !gmDiv.hidden;
      e.target.textContent = gmDiv.hidden ? 'Matches ▾' : 'Matches ▴';
    });
    list.appendChild(card);
  }
}

function buildKnockout(list) {
  setBracketMatches(MATCHES);

  const btn = document.createElement('button');
  btn.id = 'predictBtn';
  btn.textContent = '🔮 Create your prediction bracket';
  btn.addEventListener('click', () => {
    setBracketMatches(MATCHES);
    openPredictions();
  });
  list.appendChild(btn);

  const wrap = document.createElement('div');
  wrap.className = 'bracketPanelWrap';
  renderBracket(wrap, { interactive: false });
  list.appendChild(wrap);
}

function updatePillCounts() {
  const today = MATCHES.filter((m) => isToday(matchDate(m))).length;
  const tomorrow = MATCHES.filter((m) => isTomorrow(matchDate(m))).length;
  const pills = document.querySelectorAll('.pill');
  for (const p of pills) {
    if (p.dataset.filter === 'today') p.textContent = `Today (${today})`;
    if (p.dataset.filter === 'tomorrow') p.textContent = `Tomorrow (${tomorrow})`;
  }
}

// ---------- right panel: selected stadium ----------

function upcomingAt(locationKey, n = 4) {
  const cutoff = Date.now() - 2.2 * 3600000;
  return MATCHES
    .filter((m) => m.Location === locationKey && matchDate(m).getTime() > cutoff)
    .sort((a, b) => matchDate(a) - matchDate(b))
    .slice(0, n);
}

function weatherHTML(w) {
  if (w.status === 'too_far') {
    return `<div class="wxSoon">🗓️ Live forecast opens in ~${w.opensInDays}
      day${w.opensInDays === 1 ? '' : 's'} (16-day horizon)</div>`;
  }
  if (w.status === 'error') {
    return `<div class="wxSoon">⚠️ Weather unavailable (${w.message})</div>`;
  }
  return `
    <div class="wxMain">
      <span class="wxIcon">${w.icon}</span>
      <span class="wxTemp">${Math.round(w.tempC)}°C <small>/ ${cToF(w.tempC)}°F</small></span>
      <span class="wxLabel">${w.label}</span>
    </div>
    <div class="wxDetails">
      <span>Feels like ${Math.round(w.feelsC)}°C</span>
      <span>💧 ${w.precipProb ?? 0}% rain</span>
      <span>💨 ${Math.round(w.windKmh)} km/h (${kmhToMph(w.windKmh)} mph)</span>
    </div>
    <div class="wxNote">Open-Meteo · kickoff hour · animated over the stadium${w.isPast ? ' (kickoff has passed)' : ''}</div>`;
}

let currentVenueKey = null;

export async function showVenuePanel(locationKey) {
  const v = VENUES[locationKey];
  if (!v) return;
  currentVenueKey = locationKey;
  if (isMobile()) document.body.classList.add('listCollapsed');
  const panel = $('venuePanel');
  panel.classList.remove('hidden');

  const next = upcomingAt(locationKey);
  const nm = next[0];

  let nextHTML;
  if (nm) {
    const d = matchDate(nm);
    nextHTML = `
      <div class="nextLabel">${isLive(nm)
        ? `<span class="liveBadge" data-mn="${nm.MatchNumber}">● ${liveMinuteLabel(nm)}</span> <span class="liveBadge">LIVE NOW</span>`
        : 'Next match here'}</div>
      <div class="bigMatch">
        <div class="bigTeams">
          ${teamHTML(nm.HomeTeam)}
          <span class="bigVs">${nm.HomeTeamScore != null ? `${nm.HomeTeamScore}–${nm.AwayTeamScore}` : 'vs'}</span>
          ${teamHTML(nm.AwayTeam, true)}
        </div>
        <div class="bigMeta">Match ${nm.MatchNumber} · ${roundLabel(nm)}</div>
        <div class="bigTime">
          ${venueTime(d, v.tz, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} local
          · ${userTime(d, { hour: 'numeric', minute: '2-digit' })} your time
        </div>
      </div>
      <div class="wxBox" id="wxBox"><div class="wxSoon">⏳ Fetching game-day weather…</div></div>`;
  } else {
    nextHTML = `<div class="nextLabel">No remaining matches at this stadium</div>`;
  }

  const moreHTML = next.slice(1).map((m) => {
    const d = matchDate(m);
    return `<div class="miniMatch">
      <span>${teamFlag(m.HomeTeam)} ${teamLabel(m.HomeTeam)} v ${teamLabel(m.AwayTeam)} ${teamFlag(m.AwayTeam)}</span>
      <span class="miniMeta">${venueTime(d, v.tz, { month: 'short', day: 'numeric' })} · ${roundLabel(m)}</span>
    </div>`;
  }).join('');

  const photo = PHOTOS[locationKey];
  panel.innerHTML = `
    <button id="backBtn" class="backBtn">← Back to globe</button>
    <div class="venueName">${v.stadium}</div>
    <div class="venueCity">${v.city}, ${v.country} ${teamFlag(v.country)}</div>
    ${photo ? `<img class="venuePhoto" src="${photo}" alt="${v.stadium}" loading="lazy">` : ''}
    <div class="venueFacts">
      <span>👥 ${v.capacity.toLocaleString()} capacity</span>
      <span>🏟️ ${ROOF_LABELS[v.roof]}</span>
    </div>
    ${nextHTML}
    ${moreHTML ? `<div class="moreLabel">Also at this stadium</div>${moreHTML}` : ''}
  `;
  $('backBtn').addEventListener('click', () => panel.dispatchEvent(new CustomEvent('back', { bubbles: true })));

  if (HANDLERS.onNextMatch) HANDLERS.onNextMatch(locationKey, nm || null);

  if (nm) {
    const w = await getMatchWeather(v, matchDate(nm));
    const box = $('wxBox');
    if (box) box.innerHTML = weatherHTML(w);
    if (HANDLERS.onWeather) HANDLERS.onWeather(locationKey, w);
  } else if (HANDLERS.onWeather) {
    HANDLERS.onWeather(locationKey, null);
  }
}

export function hideVenuePanel() {
  currentVenueKey = null;
  $('venuePanel').classList.add('hidden');
}

// ---------- live data refresh ----------

const sigOf = (matches) => JSON.stringify(matches.map((m) =>
  [m.MatchNumber, m.HomeTeam, m.AwayTeam, m.HomeTeamScore, m.AwayTeamScore]));
let liveSig = '';

// Swap in a fresh copy of the schedule; re-render only if something changed.
export function applyLiveMatches(matches) {
  const sig = sigOf(matches);
  MATCHES = matches;
  setBracketMatches(matches);
  if (sig === liveSig) return;
  liveSig = sig;
  updatePillCounts();
  renderActiveTab();
  if (currentVenueKey) showVenuePanel(currentVenueKey);
}

// ---------- tooltip ----------

export function setTooltip(x, y, locationKey) {
  const tip = $('tooltip');
  if (!locationKey) {
    tip.classList.add('hidden');
    return;
  }
  const v = VENUES[locationKey];
  const nm = upcomingAt(locationKey, 1)[0];
  tip.innerHTML = `<b>${v.stadium}</b> · ${v.city}` + (nm
    ? `<br>${teamFlag(nm.HomeTeam)} ${teamLabel(nm.HomeTeam)} v ${teamLabel(nm.AwayTeam)} ${teamFlag(nm.AwayTeam)} · ${matchDate(nm).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
    : '<br>Tournament complete here');
  tip.style.left = `${x + 14}px`;
  tip.style.top = `${y + 14}px`;
  tip.classList.remove('hidden');
}

export function initUI(matches, photos, handlers) {
  MATCHES = matches;
  liveSig = sigOf(matches);
  PHOTOS = photos || {};
  HANDLERS = handlers;
  setBracketMatches(matches);
  initBracketUI();
  document.addEventListener('back', handlers.onBack);
  $('hideListBtn').addEventListener('click', () => {
    document.body.classList.toggle('listCollapsed');
  });
  $('schedFab').addEventListener('click', () => {
    document.body.classList.toggle('listCollapsed');
  });
  if (isMobile()) document.body.classList.add('listCollapsed');

  document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => {
    activeTab = b.dataset.tab;
    document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === b));
    renderActiveTab();
  }));
  document.querySelectorAll('.pill').forEach((b) => b.addEventListener('click', () => {
    schedFilter = b.dataset.filter;
    document.querySelectorAll('.pill').forEach((x) => x.classList.toggle('active', x === b));
    renderActiveTab();
  }));

  updatePillCounts();
  renderActiveTab();
  lastLiveSet = MATCHES.filter(isLive).map((m) => m.MatchNumber).join(',');
  setInterval(liveTick, 30000);
}
