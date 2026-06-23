import { teamLabel, teamFlag, esc } from './venues.js';

// Official knockout tree (from the published FIFA schedule): which match
// winners feed each tie. [home feeder, away feeder] by match number.
const FEEDERS = {
  89: [74, 77], 90: [73, 75], 91: [76, 78], 92: [79, 80],
  93: [83, 84], 94: [81, 82], 95: [86, 88], 96: [85, 87],
  97: [89, 90], 98: [93, 94], 99: [91, 92], 100: [95, 96],
  101: [97, 98], 102: [99, 100], 104: [101, 102],
};
const FINAL = 104;
const THIRD_PLACE = 103;

// Column order derived from the tree so feeder pairs sit next to each other.
const ROUNDS = (() => {
  const cols = [[FINAL]];
  while (FEEDERS[cols[0][0]]) {
    cols.unshift(cols[0].flatMap((mn) => FEEDERS[mn]));
  }
  return cols;
})();
const ROUND_NAMES = ['Round of 32', 'Round of 16', 'Quarter-finals', 'Semi-finals', 'Final'];

const LS_KEY = 'wc26-picks';
let picks = {};
try { picks = JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { picks = {}; }

let byNum = new Map();

export function setBracketMatches(matches) {
  byNum = new Map(matches.map((m) => [m.MatchNumber, m]));
}

const matchDate = (m) => new Date(m.DateUtc.replace(' ', 'T'));

// Winner per the actual result feed (null while undecided).
function realWinner(mn) {
  const m = byNum.get(mn);
  if (!m) return null;
  if (m.Winner && m.Winner !== 'To be announced' && m.Winner !== 'Draw') return m.Winner;
  if (m.HomeTeamScore != null && m.AwayTeamScore != null
      && m.HomeTeamScore !== m.AwayTeamScore) {
    return m.HomeTeamScore > m.AwayTeamScore ? m.HomeTeam : m.AwayTeam;
  }
  return null;
}

// The two slots of a tie. Real feed data wins; in prediction mode unresolved
// slots are filled from the user's picks, propagated up the tree.
function slotTeams(mn, usePicks) {
  const m = byNum.get(mn);
  if (!m) return [null, null];
  const feed = [m.HomeTeam, m.AwayTeam]
    .map((t) => (t === 'To be announced' ? null : t));
  if (!FEEDERS[mn]) return feed;
  const [f1, f2] = FEEDERS[mn];
  return [feed[0] ?? winnerOf(f1, usePicks), feed[1] ?? winnerOf(f2, usePicks)];
}

function winnerOf(mn, usePicks) {
  const real = realWinner(mn);
  if (real) return real;
  if (!usePicks) return null;
  const p = picks[mn];
  const [h, a] = slotTeams(mn, true);
  // a stale pick (slot resolved differently in the meantime) is ignored
  return p && (p === h || p === a) ? p : null;
}

function loserOf(mn, usePicks) {
  const [h, a] = slotTeams(mn, usePicks);
  const w = winnerOf(mn, usePicks);
  return w && h && a ? (w === h ? a : h) : null;
}

function pickTeam(mn, team) {
  picks[mn] = team;
  localStorage.setItem(LS_KEY, JSON.stringify(picks));
}

export function resetPicks() {
  picks = {};
  localStorage.setItem(LS_KEY, '{}');
}

// Compact label for bracket cards (full name via tooltip).
function shortLabel(name) {
  if (!name) return '—';
  let m;
  if ((m = name.match(/^1([A-L])$/))) return `Grp ${m[1]} winner`;
  if ((m = name.match(/^2([A-L])$/))) return `Grp ${m[1]} 2nd`;
  if ((m = name.match(/^3([A-L]+)$/))) return `3rd ${m[1]}`;
  return name;
}

// ---------- DOM bracket (knockout tab + prediction overlay) ----------

function matchCard(mn, interactive, onChange) {
  const m = byNum.get(mn);
  const [h, a] = slotTeams(mn, interactive);
  const w = winnerOf(mn, interactive);
  const decided = realWinner(mn) != null;
  const card = document.createElement('div');
  card.className = 'bMatch';
  const meta = document.createElement('div');
  meta.className = 'bMeta';
  meta.textContent = m
    ? `M${mn} · ${matchDate(m).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
    : `M${mn}`;
  card.appendChild(meta);

  [h, a].forEach((team, i) => {
    const row = document.createElement('button');
    row.className = 'bTeam' + (w && team === w ? ' picked' : '');
    row.disabled = !interactive || !team || decided;
    const score = m && (i === 0 ? m.HomeTeamScore : m.AwayTeamScore);
    row.innerHTML = `
      <span class="bFlag">${team ? teamFlag(team) : ''}</span>
      <span class="bName">${esc(shortLabel(team))}</span>
      <span class="bScore">${esc(score ?? '')}</span>`;
    if (team) row.title = teamLabel(team);
    if (interactive && team && !decided) {
      row.addEventListener('click', () => {
        pickTeam(mn, team);
        if (onChange) onChange();
      });
    }
    card.appendChild(row);
  });
  return card;
}

export function renderBracket(container, { interactive = false, onChange } = {}) {
  container.innerHTML = '';
  const scroll = document.createElement('div');
  scroll.className = 'bracketScroll';

  ROUNDS.forEach((round, ci) => {
    const col = document.createElement('div');
    col.className = 'bracketCol';
    col.innerHTML = `<div class="bracketColName">${ROUND_NAMES[ci]}</div>`;
    const body = document.createElement('div');
    body.className = 'bracketColBody';
    round.forEach((mn) => body.appendChild(matchCard(mn, interactive, onChange)));
    col.appendChild(body);
    scroll.appendChild(col);
  });

  // champion + third place
  const col = document.createElement('div');
  col.className = 'bracketCol';
  col.innerHTML = '<div class="bracketColName">Champion</div>';
  const body = document.createElement('div');
  body.className = 'bracketColBody';
  const champ = winnerOf(FINAL, interactive);
  const champCard = document.createElement('div');
  champCard.className = 'bMatch champCard';
  champCard.innerHTML = `<div class="champFlag">${champ ? teamFlag(champ) : '🏆'}</div>
    <div class="champName">${champ ? esc(champ) : 'TBD'}</div>`;
  body.appendChild(champCard);
  body.appendChild(matchCard(THIRD_PLACE, interactive, onChange));
  const thirdLabel = document.createElement('div');
  thirdLabel.className = 'bMeta';
  thirdLabel.style.textAlign = 'center';
  thirdLabel.textContent = '↑ third place play-off';
  body.appendChild(thirdLabel);
  col.appendChild(body);
  scroll.appendChild(col);

  container.appendChild(scroll);
}

// ---------- prediction overlay ----------

const $ = (id) => document.getElementById(id);

function rerenderOverlay() {
  renderBracket($('bracketBody'), { interactive: true, onChange: rerenderOverlay });
}

export function openPredictions() {
  $('bracketOverlay').classList.remove('hidden');
  rerenderOverlay();
}

export function initBracketUI() {
  $('bracketClose').addEventListener('click', () =>
    $('bracketOverlay').classList.add('hidden'));
  $('bracketReset').addEventListener('click', () => {
    resetPicks();
    rerenderOverlay();
  });
  $('bracketDownload').addEventListener('click', downloadBracketPNG);
  window.__bracket = { draw: drawBracketCanvas }; // debug/test hook
}

// ---------- PNG export ----------

const PNG = {
  cardW: 215, cardH: 54, colGap: 42, top: 96, bottom: 30, side: 36,
  colH: 16 * 66,
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function cardPos(ci, j, n) {
  const x = PNG.side + ci * (PNG.cardW + PNG.colGap);
  const slot = PNG.colH / n;
  const y = PNG.top + slot * (j + 0.5) - PNG.cardH / 2;
  return { x, y };
}

function drawBracketCanvas() {
  const cols = ROUNDS.length + 1; // + champion column
  const W = PNG.side * 2 + cols * PNG.cardW + (cols - 1) * PNG.colGap;
  const H = PNG.top + PNG.colH + PNG.bottom;
  const canvas = document.createElement('canvas');
  const scale = 2;
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  // background
  ctx.fillStyle = '#0b1020';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#e8ecf6';
  ctx.font = '800 26px -apple-system, "Segoe UI", sans-serif';
  ctx.fillText('🏆 FIFA World Cup 2026 — My Prediction Bracket', PNG.side, 44);
  ctx.fillStyle = '#93a0bd';
  ctx.font = '500 13px -apple-system, "Segoe UI", sans-serif';
  ctx.fillText(`Made ${new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })} · worldcup globe dashboard`, PNG.side, 66);

  // connectors first (under cards)
  ctx.strokeStyle = 'rgba(120,150,255,0.28)';
  ctx.lineWidth = 1.5;
  ROUNDS.forEach((round, ci) => {
    if (ci === 0) return;
    round.forEach((mn, j) => {
      const child = cardPos(ci, j, round.length);
      [0, 1].forEach((k) => {
        const parent = cardPos(ci - 1, j * 2 + k, ROUNDS[ci - 1].length);
        const x0 = parent.x + PNG.cardW, y0 = parent.y + PNG.cardH / 2;
        const x1 = child.x, y1 = child.y + PNG.cardH / 2;
        const mx = x0 + PNG.colGap / 2;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(mx, y0);
        ctx.lineTo(mx, y1);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      });
    });
  });

  // round titles + cards
  ROUNDS.forEach((round, ci) => {
    ctx.fillStyle = '#4f8cff';
    ctx.font = '800 12px -apple-system, "Segoe UI", sans-serif';
    const cx = PNG.side + ci * (PNG.cardW + PNG.colGap);
    ctx.fillText(ROUND_NAMES[ci].toUpperCase(), cx, PNG.top - 14);

    round.forEach((mn, j) => {
      const { x, y } = cardPos(ci, j, round.length);
      const [h, a] = slotTeams(mn, true);
      const w = winnerOf(mn, true);
      ctx.fillStyle = '#1a2236';
      ctx.strokeStyle = 'rgba(120,150,255,0.25)';
      roundRect(ctx, x, y, PNG.cardW, PNG.cardH, 8);
      ctx.fill();
      ctx.stroke();
      [h, a].forEach((team, i) => {
        const ty = y + 21 + i * 24;
        const isPick = w && team === w;
        ctx.fillStyle = isPick ? '#7ee2a8' : (team ? '#e8ecf6' : '#5d6880');
        ctx.font = `${isPick ? 800 : 500} 13px -apple-system, "Segoe UI", sans-serif`;
        const label = team ? `${teamFlag(team)} ${shortLabel(team)}` : '—';
        ctx.fillText(label.length > 24 ? label.slice(0, 23) + '…' : label, x + 10, ty);
        const m = byNum.get(mn);
        const score = m && (i === 0 ? m.HomeTeamScore : m.AwayTeamScore);
        if (score != null) {
          ctx.textAlign = 'right';
          ctx.fillText(String(score), x + PNG.cardW - 10, ty);
          ctx.textAlign = 'left';
        }
      });
    });
  });

  // champion box
  const champ = winnerOf(FINAL, true);
  const cx = PNG.side + ROUNDS.length * (PNG.cardW + PNG.colGap);
  const cy = PNG.top + PNG.colH / 2 - 60;
  ctx.fillStyle = '#1a2236';
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = 2;
  roundRect(ctx, cx, cy, PNG.cardW, 120, 12);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffd166';
  ctx.font = '800 12px -apple-system, "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CHAMPION', cx + PNG.cardW / 2, cy + 26);
  ctx.font = '400 34px -apple-system, "Segoe UI", sans-serif';
  ctx.fillText(champ ? teamFlag(champ) : '🏆', cx + PNG.cardW / 2, cy + 68);
  ctx.fillStyle = '#e8ecf6';
  ctx.font = '800 16px -apple-system, "Segoe UI", sans-serif';
  ctx.fillText(champ || 'Make your picks!', cx + PNG.cardW / 2, cy + 98);

  // third place
  const tw = loserOf(101, true), tl = loserOf(102, true);
  const tWinner = winnerOf(THIRD_PLACE, true) || (picks[THIRD_PLACE] && [tw, tl].includes(picks[THIRD_PLACE]) ? picks[THIRD_PLACE] : null);
  ctx.fillStyle = '#93a0bd';
  ctx.font = '600 12px -apple-system, "Segoe UI", sans-serif';
  ctx.fillText(`Third place: ${tWinner ? `${teamFlag(tWinner)} ${tWinner}` : 'TBD'}`, cx + PNG.cardW / 2, cy + 150);
  ctx.textAlign = 'left';

  return canvas;
}

export function downloadBracketPNG() {
  const canvas = drawBracketCanvas();
  canvas.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'world-cup-2026-my-bracket.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }, 'image/png');
}
