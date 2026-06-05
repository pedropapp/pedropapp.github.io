// ── Config ───────────────────────────────────────────────
const PROXY = 'https://rejseplanen-proxy.pedropapp15.workers.dev';

// Rate limiting
const MONTHLY_LIMIT    = 45000;
const STORAGE_KEY_REQ  = 'rp_req_count';
const STORAGE_KEY_MONTH = 'rp_req_month';

// Tracker window
const TRACK_PAST_MINS   = 8;
const TRACK_FUTURE_MINS = 30;
const TRACK_TOTAL_MINS  = TRACK_PAST_MINS + TRACK_FUTURE_MINS;

// ── State ────────────────────────────────────────────────
let walkMinutes = 5;
let runMinutes  = 2;   // extra buffer — if you run you gain this many minutes
let allStops = [];
let selectedStopIds = new Set();
let currentDepartures = [];
let refreshTimer  = null;
let countdownTimer = null;
let alertFired = {};

let focusLine   = null;
let focusStopId = null;

// ── Request budget ───────────────────────────────────────
function getMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}`;
}
function getReqCount() {
  if (localStorage.getItem(STORAGE_KEY_MONTH) !== getMonthKey()) {
    localStorage.setItem(STORAGE_KEY_MONTH, getMonthKey());
    localStorage.setItem(STORAGE_KEY_REQ, '0');
    return 0;
  }
  return parseInt(localStorage.getItem(STORAGE_KEY_REQ) || '0');
}
function bumpReq(n = 1) {
  const c = getReqCount() + n;
  localStorage.setItem(STORAGE_KEY_REQ, String(c));
  const el = document.getElementById('req-badge');
  if (el) el.textContent = `${c.toLocaleString()} / ${MONTHLY_LIMIT.toLocaleString()}`;
  return c;
}
function overLimit() { return getReqCount() >= MONTHLY_LIMIT; }

// ── Departure status logic ───────────────────────────────
// minsToLeave  = how many minutes until you need to walk out the door
// minsToLeaveRun = same, but accounting for the run buffer (you can leave later)
//
// States in order of urgency:
//   too-late   — even running won't get you there
//   run-now    — walking window closed but run buffer still open  → alert
//   go-now     — minsToLeave exactly 0, time to walk out         → alert
//   leave-soon — 1–3 min until you need to leave (warning only, no alert)
//   normal     — plenty of time
//   left       — already departed
function departureStatus(minsToDepart) {
  const minsToLeave    = minsToDepart - walkMinutes;
  const minsToLeaveRun = minsToDepart - (walkMinutes - runMinutes);

  if (minsToDepart < 0) {
    return { label: 'left', cls: 'normal', alert: false };
  }
  if (minsToLeave <= 0) {
    if (minsToLeaveRun > 0) {
      return { label: 'run!', cls: 'run-now', alert: true };
    } else {
      return { label: 'too late', cls: 'too-late', alert: false };
    }
  }
  if (minsToLeave === 0) {
    // Exact boundary — leave this instant
    return { label: 'leave now', cls: 'go-now', alert: true };
  }
  if (minsToLeave <= 3) {
    return { label: `leave in ${minsToLeave}m`, cls: 'leave-soon', alert: false };
  }
  return { label: `${minsToDepart} min`, cls: 'normal', alert: false };
}

// ── Init ─────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  bumpReq(0);

  // Restore saved address
  const savedAddr = localStorage.getItem('rp_address');
  if (savedAddr) document.getElementById('address-input').value = savedAddr;

  // Restore walk minutes
  const savedWalk = localStorage.getItem('rp_walk');
  if (savedWalk) {
    walkMinutes = parseInt(savedWalk);
    document.getElementById('walk-slider').value = walkMinutes;
    document.getElementById('walk-val').textContent = walkMinutes + ' min';
  }

  // Restore run minutes
  const savedRun = localStorage.getItem('rp_run');
  if (savedRun) {
    runMinutes = parseInt(savedRun);
    document.getElementById('run-slider').value = runMinutes;
    document.getElementById('run-val').textContent = runMinutes + ' min';
  }

  document.getElementById('address-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleSearch();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearInterval(refreshTimer);
    } else if (allStops.length && selectedStopIds.size) {
      fetchAllDepartures();
      refreshTimer = setInterval(fetchAllDepartures, 30000);
    }
  });

  // ── Auto-restore stops + departures on reload ──
  // Cache the stop list so we skip geocoding on reload (saves 2 API calls).
  const savedStops = localStorage.getItem('rp_stops');
  const savedSelected = localStorage.getItem('rp_selected');
  if (savedAddr && savedStops) {
    try {
      allStops = JSON.parse(savedStops);
      selectedStopIds = savedSelected
        ? new Set(JSON.parse(savedSelected))
        : new Set(allStops.map(s => s.id));

      renderStopPicker();
      document.getElementById('stop-picker-section').style.display = 'block';
      document.getElementById('footer-bar').style.display = 'flex';
      setStatus('<span class="spinner"></span> restoring…');

      await fetchAllDepartures();

      // Restore focused departure — must happen after fetchAllDepartures
      // so currentDepartures is populated
      const savedFocusLine = localStorage.getItem('rp_focus_line');
      const savedFocusStop = localStorage.getItem('rp_focus_stop');
      if (savedFocusLine && savedFocusStop) {
        focusDep(savedFocusLine, savedFocusStop);
      }

      refreshTimer   = setInterval(fetchAllDepartures, 30000);
      countdownTimer = setInterval(tickCountdown, 10000);
    } catch (e) {
      localStorage.removeItem('rp_stops');
      localStorage.removeItem('rp_selected');
    }
  }
});

// ── Settings popover ─────────────────────────────────────
function toggleSettings() {
  document.getElementById('settings-wrap').classList.toggle('open');
}
function closeSettings() {
  document.getElementById('settings-wrap').classList.remove('open');
}

// ── Walk slider ──────────────────────────────────────────
function updateWalkLabel(v) {
  walkMinutes = parseInt(v);
  document.getElementById('walk-val').textContent = v + ' min';
  localStorage.setItem('rp_walk', v);
  // Make sure run can't exceed walk
  const runSlider = document.getElementById('run-slider');
  if (runSlider && runMinutes > walkMinutes) {
    runMinutes = walkMinutes;
    runSlider.value = walkMinutes;
    document.getElementById('run-val').textContent = walkMinutes + ' min';
    localStorage.setItem('rp_run', walkMinutes);
  }
  if (currentDepartures.length) { renderBoard(); if (focusLine) renderFocusPanel(); }
}

// ── Run slider ───────────────────────────────────────────
function updateRunLabel(v) {
  runMinutes = parseInt(v);
  document.getElementById('run-val').textContent = v + ' min';
  localStorage.setItem('rp_run', v);
  if (currentDepartures.length) { renderBoard(); if (focusLine) renderFocusPanel(); }
}

// ── Search ───────────────────────────────────────────────
async function handleSearch() {
  const addr = document.getElementById('address-input').value.trim();
  if (!addr) return;
  if (overLimit()) { setStatus('⚠ monthly limit reached'); return; }

  localStorage.setItem('rp_address', addr);
  document.getElementById('search-btn').disabled = true;
  setStatus('<span class="spinner"></span> geocoding…');
  document.getElementById('board').innerHTML = '';
  document.getElementById('footer-bar').style.display = 'none';
  document.getElementById('stop-picker-section').style.display = 'none';

  currentDepartures = [];
  alertFired = {};
  focusLine   = null;
  focusStopId = null;
  localStorage.removeItem('rp_focus_line');
  localStorage.removeItem('rp_focus_stop');
  clearInterval(refreshTimer);
  clearInterval(countdownTimer);
  showEmptyMain();

  try {
    const locData = await api('/location.name', { input: addr, type: 'A', maxNo: 1 });
    const locList = locData?.stopLocationOrCoordLocation;
    if (!locList?.length) throw new Error('Address not found — try adding the city name.');
    const loc = locList[0].StopLocation || locList[0].CoordLocation;
    if (!loc) throw new Error('Address not found.');

    const lat = parseFloat(loc.lat);
    const lon = parseFloat(loc.lon);
    setStatus('<span class="spinner"></span> finding stops…');

    const nearData = await api('/location.nearbystops', {
      originCoordLat: lat, originCoordLong: lon, maxNo: 5,
    });

    const nearList = nearData?.stopLocationOrCoordLocation || [];
    allStops = nearList.map(e => e.StopLocation).filter(Boolean);
    if (!allStops.length) throw new Error('No stops found nearby.');

    selectedStopIds = new Set(allStops.map(s => s.id));
    localStorage.setItem('rp_stops', JSON.stringify(allStops));
    localStorage.setItem('rp_selected', JSON.stringify([...selectedStopIds]));
    renderStopPicker();
    document.getElementById('stop-picker-section').style.display = 'block';
    setStatus(`${allStops.length} stops found`);

    await fetchAllDepartures();

    if (Notification.permission === 'default') {
      document.getElementById('notif-section').style.display = 'block';
    }

    refreshTimer   = setInterval(fetchAllDepartures, 30000);
    countdownTimer = setInterval(tickCountdown, 10000);
    document.getElementById('footer-bar').style.display = 'flex';

  } catch (e) {
    setStatus(`⚠ ${e.message}`);
  } finally {
    document.getElementById('search-btn').disabled = false;
  }
}

// ── Stop picker ──────────────────────────────────────────
function renderStopPicker() {
  document.getElementById('stop-picker').innerHTML = allStops.map(s => `
    <label class="stop-option ${selectedStopIds.has(s.id) ? 'selected' : ''}" data-id="${s.id}">
      <input type="checkbox" ${selectedStopIds.has(s.id) ? 'checked' : ''}
        onchange="toggleStop('${s.id}', this.checked)">
      <span class="so-name">${escHtml(s.name)}</span>
      <span class="so-dist">${s.dist ? Math.round(s.dist) + 'm' : ''}</span>
    </label>`).join('');
}

function toggleStop(id, checked) {
  checked ? selectedStopIds.add(id) : selectedStopIds.delete(id);
  document.querySelectorAll('.stop-option').forEach(el =>
    el.classList.toggle('selected', selectedStopIds.has(el.dataset.id)));
  localStorage.setItem('rp_selected', JSON.stringify([...selectedStopIds]));
  fetchAllDepartures();
}

// ── Fetch ────────────────────────────────────────────────
async function fetchAllDepartures() {
  if (overLimit()) {
    setStatus('⚠ monthly limit reached — pausing');
    clearInterval(refreshTimer);
    return;
  }

  const stops = allStops.filter(s => selectedStopIds.has(s.id));
  if (!stops.length) return;

  const results = await Promise.all(stops.map(async (stop) => {
    try {
      const data = await api('/departureBoard', { id: stop.id, maxJourneys: 20 });
      bumpReq(1);
      const deps = data?.Departure;
      const depArr = deps ? (Array.isArray(deps) ? deps : [deps]) : [];

      return {
        stopName: stop.name,
        dist: stop.dist ? Math.round(parseInt(stop.dist)) : '?',
        stopId: stop.id,
        departures: depArr.map(d => ({
          line:      d.ProductAtStop?.displayNumber || d.name,
          dir:       d.direction,
          planned:   parseRPTime(d.date, d.time),
          realtime:  (d.rtDate && d.rtTime)
                       ? parseRPTime(d.rtDate, d.rtTime)
                       : parseRPTime(d.date, d.time),
          cancelled: d.cancelled === true || d.JourneyStatus === 'C',
        })).filter(d => !d.cancelled),
      };
    } catch { return null; }
  }));

  currentDepartures = results.filter(Boolean);
  setStatus(`<span class="rt-dot"></span> ${new Date().toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}`);
  renderBoard();
  if (focusLine) renderFocusPanel();
}

// ── Tick countdown ───────────────────────────────────────
function tickCountdown() {
  renderBoard();
  if (focusLine) renderFocusPanel();
  maybeAutoDismissAlert();
}

// ── Render board ─────────────────────────────────────────
function renderBoard() {
  const now = new Date();
  const board = document.getElementById('board');

  if (!currentDepartures.length) {
    board.innerHTML = '<div style="font-size:9px;color:var(--ink4);padding:16px 0;text-align:center;letter-spacing:0.1em;text-transform:uppercase;">No departures.</div>';
    return;
  }

  let html = '';

  for (const stop of currentDepartures) {
    const upcoming = stop.departures.filter(d => {
      const rt = d.realtime || d.planned;
      return rt && Math.round((rt - now) / 60000) > -3;
    });
    if (!upcoming.length) continue;

    html += `<div class="board-stop-name">${escHtml(stop.stopName)}</div>`;

    for (const dep of upcoming.slice(0, 8)) {
      const rt = dep.realtime || dep.planned;
      const minsToDepart = Math.round((rt - now) / 60000);
      const isDelayed    = dep.realtime && dep.planned &&
                           dep.realtime.getTime() !== dep.planned.getTime();
      const timeStr      = rt.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });

      const isFocused = focusLine === dep.line && focusStopId === stop.stopId;
      const status = departureStatus(minsToDepart);
      const { label: statusLabel, cls: statusClass } = status;

      // Fire alert only when status says so, and only for the focused line
      if (status.alert && focusLine === dep.line && focusStopId === stop.stopId) {
        triggerAlert(stop, dep, minsToDepart, timeStr, rt);
      }

      const plannedStr = dep.planned
        ? dep.planned.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })
        : timeStr;

      html += `<div class="dep-chip ${isFocused ? 'focused' : ''}"
          onclick="focusDep('${escAttr(dep.line)}', '${stop.stopId}')">
        <div class="dc-line" style="${lineBadgeStyle(dep.line)}">${escHtml(dep.line)}</div>
        <div class="dc-time ${isDelayed ? 'delayed' : ''}">${timeStr}</div>
        <div class="dc-status ${statusClass}">${statusLabel}</div>
        <div class="dc-tooltip">→ ${escHtml(dep.dir)}<br>sched: ${plannedStr}${isDelayed ? ` · rt: ${timeStr} ⚡` : ''}</div>
      </div>`;
    }
  }

  board.innerHTML = html || '<div style="font-size:9px;color:var(--ink4);padding:16px 0;text-align:center;letter-spacing:0.1em;text-transform:uppercase;">No upcoming departures.</div>';
}

// ── Alert sound (Web Audio — no external file needed) ────
let audioCtx = null;
function playAlertSound() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const beeps = [
      { freq: 880, start: 0,    dur: 0.12 },
      { freq: 660, start: 0.15, dur: 0.18 },
    ];
    beeps.forEach(({ freq, start, dur }) => {
      const osc  = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'square';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, audioCtx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.18, audioCtx.currentTime + start + 0.01);
      gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + start + dur);
      osc.start(audioCtx.currentTime + start);
      osc.stop(audioCtx.currentTime + start + dur + 0.05);
    });
  } catch (e) { /* audio not available */ }
}

// ── Alert ────────────────────────────────────────────────
let activeAlertDepartsAt = null;  // Date of the departure the alert is for

function triggerAlert(stop, dep, minsToDepart, timeStr, departureTime) {
  const key = `${stop.stopId}-${dep.line}-${timeStr}`;
  if (alertFired[key]) return;
  alertFired[key] = true;

  activeAlertDepartsAt = departureTime;  // track when it departs so we can auto-dismiss

  const title = `Leave now for ${dep.line}`;
  const sub   = `${dep.dir} — departs in ${minsToDepart} min`;
  document.getElementById('alert-title').textContent = title;
  document.getElementById('alert-sub').textContent   = sub;
  document.getElementById('alert-overlay').classList.add('active');
  playAlertSound();
  sendNotification(title, sub);
}

function dismissAlert() {
  document.getElementById('alert-overlay').classList.remove('active');
  activeAlertDepartsAt = null;
}

function maybeAutoDismissAlert() {
  if (!activeAlertDepartsAt) return;
  if (new Date() > activeAlertDepartsAt) {
    dismissAlert();
  }
}

// ── Focus mode ───────────────────────────────────────────
function focusDep(line, stopId) {
  focusLine   = line;
  focusStopId = stopId;
  localStorage.setItem('rp_focus_line', line);
  localStorage.setItem('rp_focus_stop', stopId);
  document.getElementById('empty-main').style.display = 'none';
  document.getElementById('focus-panel').classList.add('active');
  renderBoard();
  renderFocusPanel();
}

function renderFocusPanel() {
  if (!focusLine || !focusStopId) return;

  const now = new Date();
  const stopData = currentDepartures.find(s => s.stopId === focusStopId);
  if (!stopData) return;

  const allDeps = stopData.departures.filter(d => d.line === focusLine);

  const futureDeps = allDeps.filter(d => {
    const rt = d.realtime || d.planned;
    return rt && (rt - now) / 60000 >= -1;
  });
  const nextDep = futureDeps[0] || null;

  // ── Countdown ──
  if (nextDep) {
    const rt = nextDep.realtime || nextDep.planned;
    const minsToDepart = Math.round((rt - now) / 60000);
    const { label, cls } = departureStatus(minsToDepart);

    let numText = minsToDepart <= 0 ? '0' : String(minsToDepart);
    let unitText = label.toUpperCase();

    const numEl  = document.getElementById('focus-num');
    const unitEl = document.getElementById('focus-unit');
    numEl.textContent  = numText;
    numEl.className    = 'focus-num ' + cls;
    unitEl.textContent = unitText;
    unitEl.className   = 'focus-unit ' + cls;

    document.getElementById('focus-dir').textContent = '→ ' + (nextDep.dir || '');
  } else {
    document.getElementById('focus-num').textContent  = '—';
    document.getElementById('focus-unit').textContent = 'no more today';
    document.getElementById('focus-num').className    = 'focus-num';
    document.getElementById('focus-unit').className   = 'focus-unit';
  }

  document.getElementById('focus-line-name').textContent = focusLine;

  renderTracker(allDeps, now);
  renderNextBusesList(futureDeps, now);
}

// ── Multi-bus tracker ────────────────────────────────────
// Buses flow LEFT → RIGHT: past on left, future on right
function renderTracker(allDeps, now) {
  const track = document.getElementById('tracker-track');
  const ticks = document.getElementById('tracker-ticks');
  if (!track) return;

  const windowStart = new Date(now.getTime() - TRACK_PAST_MINS  * 60000);
  const windowEnd   = new Date(now.getTime() + TRACK_FUTURE_MINS * 60000);

  // "You are here" sits at TRACK_PAST_MINS fraction from left
  const nowPct = (TRACK_PAST_MINS / TRACK_TOTAL_MINS) * 100;

  const nowLine  = document.getElementById('tracker-now-line');
  const pastZone = document.getElementById('tracker-past-zone');
  if (nowLine)  nowLine.style.left   = nowPct + '%';
  if (pastZone) pastZone.style.width = nowPct + '%';

  // Remove old bus dots
  track.querySelectorAll('.bus-dot').forEach(el => el.remove());

  const nextDep = allDeps.filter(d => {
    const rt = d.realtime || d.planned;
    return rt && rt >= now;
  }).sort((a,b) => (a.realtime||a.planned) - (b.realtime||b.planned))[0];

  allDeps.forEach(dep => {
    const rt = dep.realtime || dep.planned;
    if (!rt) return;
    if (rt < windowStart || rt > windowEnd) return;

    // Position: fraction of total window from left (past → future = left → right)
    const minutesFromWindowStart = (rt - windowStart) / 60000;
    const pct = (minutesFromWindowStart / TRACK_TOTAL_MINS) * 100;

    const isPassed = rt < now;
    const isNext   = nextDep &&
      (dep.realtime || dep.planned)?.getTime() === (nextDep.realtime || nextDep.planned)?.getTime();

    const dot = document.createElement('div');
    dot.className = `bus-dot${isNext ? ' is-next' : ''}${isPassed ? ' passed' : ''}`;
    dot.style.left = pct + '%';

    const timeStr = rt.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
    const minsFromNow = Math.round((rt - now) / 60000);
    const minsLabel = minsFromNow < 0
      ? `${Math.abs(minsFromNow)}m ago`
      : minsFromNow === 0 ? 'now' : `in ${minsFromNow}m`;

    const label = document.createElement('div');
    label.className = 'bus-dot-label';
    label.textContent = `${timeStr} (${minsLabel})`;
    dot.appendChild(label);
    track.appendChild(dot);
  });

  // Time ticks every 10 min
  ticks.innerHTML = '';
  for (let m = 0; m <= TRACK_TOTAL_MINS; m += 10) {
    const pct = (m / TRACK_TOTAL_MINS) * 100;
    const tickTime = new Date(windowStart.getTime() + m * 60000);
    const tickStr  = tickTime.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
    ticks.innerHTML += `<div class="tracker-tick" style="left:${pct}%">${tickStr}</div>`;
  }
}

// ── Next buses list ──────────────────────────────────────
function renderNextBusesList(futureDeps, now) {
  const wrap = document.getElementById('next-buses');
  if (!wrap) return;

  const rest = futureDeps.slice(1, 4);
  if (!rest.length) { wrap.innerHTML = ''; return; }

  let html = '<div class="next-title">coming up</div>';
  rest.forEach(dep => {
    const rt = dep.realtime || dep.planned;
    const mins = Math.round((rt - now) / 60000);
    const timeStr = rt.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
    html += `<div class="next-row">
      <div class="nr-dir">${escHtml(dep.dir)}</div>
      <div class="nr-time">${timeStr}</div>
      <div class="nr-in">+${mins}m</div>
    </div>`;
  });
  wrap.innerHTML = html;
}

// ── Show/hide ────────────────────────────────────────────
function showEmptyMain() {
  document.getElementById('empty-main').style.display = 'flex';
  document.getElementById('focus-panel').classList.remove('active');
  focusLine   = null;
  focusStopId = null;
  localStorage.removeItem('rp_focus_line');
  localStorage.removeItem('rp_focus_stop');
}

// ── Helpers ──────────────────────────────────────────────
async function api(path, params = {}) {
  const url = new URL(PROXY + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

function parseRPTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;

  // Normalise to YYYY-MM-DDTHH:MM regardless of API date format
  let isoNaive;
  if (dateStr.includes('-')) {
    isoNaive = `${dateStr}T${timeStr}`;
  } else {
    const [d, m, y] = dateStr.split('.');
    const year = +y < 50 ? 2000 + +y : 1900 + +y;
    isoNaive = `${year}-${m.padStart(2,'0')}-${d.padStart(2,'0')}T${timeStr}`;
  }

  // The API always returns Copenhagen wall-clock time (CET/CEST).
  // We need a real UTC Date regardless of the viewer's browser timezone.
  //
  // Strategy: treat the naive string as UTC to get a reference instant,
  // ask the browser what Copenhagen's wall clock reads at that instant
  // (the browser's IANA database handles CET/CEST automatically),
  // compute the offset, then subtract it to get the true UTC instant.
  const asUtc = new Date(isoNaive + 'Z');
  const cphString = asUtc.toLocaleString('en-CA', {
    timeZone: 'Europe/Copenhagen',
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }); // e.g. "2026-05-13, 14:35:00"
  const cphAsIfUtc = new Date(cphString.replace(', ', 'T') + 'Z');
  const offsetMs = cphAsIfUtc - asUtc; // Copenhagen's offset from UTC at this moment
  return new Date(asUtc.getTime() - offsetMs);
}

function lineBadgeStyle(name) {
  const n = (name || '').toLowerCase().trim();
  if (/^\d+[a-z]?$/.test(n.replace('bus','').trim()))
    return 'background:#0d2033;color:#4ab3e8;border-color:#1a3a50;';
  if (n.includes('s-tog') || /^[a-h]$/.test(n) || /^s[a-h]?$/.test(n))
    return 'background:#0d2215;color:#38c06a;border-color:#1a3d28;';
  if (/^m[1-4]?$/.test(n))
    return 'background:#1a0d2e;color:#a855f7;border-color:#3a1a5e;';
  if (n.includes('ic') || n.includes('lyn') || n.startsWith('re') || n.includes('tog'))
    return 'background:#2e0d0d;color:#f07070;border-color:#5e1a1a;';
  return 'background:var(--surface2);color:var(--ink2);border-color:var(--rule);';
}

function setStatus(msg) {
  document.getElementById('sidebar-status').innerHTML = msg;
}

function escHtml(s) {
  return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function escAttr(s) {
  return (s||'').replace(/'/g,'&#39;').replace(/"/g,'&quot;');
}

async function requestNotifPermission() {
  const p = await Notification.requestPermission();
  if (p === 'granted') document.getElementById('notif-section').style.display = 'none';
}

function sendNotification(title, body) {
  if (Notification.permission === 'granted') new Notification(title, { body });
}

function refresh() {
  if (allStops.length) fetchAllDepartures();
  else handleSearch();
}