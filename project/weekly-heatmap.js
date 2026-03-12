// ─────────────────────────────────────────────────────────────
//  createWeeklyHeatmap
//  Replaces createBarChart for the weekly viewing pattern.
//
//  data: array of [dayName, totalHours] e.g. [["Sunday", 914], ...]
//  selector: CSS selector string e.g. '#daily-chart'
// ─────────────────────────────────────────────────────────────
function createWeeklyHeatmap(data, selector) {
  const container = document.querySelector(selector);
  if (!container) return;

  // Clear previous render
  container.innerHTML = '';

  const dayOrder = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const dayAbbr  = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
  const daySingle = ['S','M','T','W','T','F','S'];

  // Ensure days are in correct order (Sunday → Saturday)
  const sorted = dayOrder.map(name => {
    const found = data.find(d => d[0] === name);
    return [name, found ? found[1] : 0];
  });

  const values  = sorted.map(d => d[1]);
  const minVal  = Math.min(...values);
  const maxVal  = Math.max(...values);

  // Color scale: near-black → vivid Netflix red
  // Power curve (t^2.5) compresses low values into darkness and
  // makes the jump to full red much more dramatic at the top end
  function intensityColor(val) {
    if (maxVal === minVal) return '#E50914';
    const t = Math.pow((val - minVal) / (maxVal - minVal), 2.5);
    const r = Math.round(18  + t * (229 - 18));
    const g = Math.round(0   + t * (9   - 0));
    const b = Math.round(2   + t * (20  - 2));
    return `rgb(${r},${g},${b})`;
  }

  const totalVal = values.reduce((a, b) => a + b, 0);

  // ── Outer wrapper ──
  const wrapper = document.createElement('div');
  wrapper.className = 'weekly-heatmap';
  container.appendChild(wrapper);

  // Track currently expanded cell for mobile tap toggle
  sorted.forEach(([dayName, hours], i) => {
    const col = document.createElement('div');
    col.className = 'wh-col';

    // ── Day label ──
    const label = document.createElement('div');
    label.className = 'wh-label';
    label.setAttribute('data-full', dayAbbr[i]);
    label.setAttribute('data-short', daySingle[i]);
    label.textContent = dayAbbr[i];
    col.appendChild(label);

    // ── Square cell ──
    const cell = document.createElement('div');
    cell.className = 'wh-cell';
    cell.style.backgroundColor = intensityColor(hours);

    // ── Percentage label ──
    const pctLabel = document.createElement('div');
    pctLabel.className = 'wh-pct';
    pctLabel.textContent = `${((hours / totalVal) * 100).toFixed(1)}%`;
    cell.appendChild(pctLabel);

    // ── Hours label inside cell (desktop) ──
    const hoursLabel = document.createElement('div');
    hoursLabel.className = 'wh-hours';
    hoursLabel.textContent = formatHours(hours);
    cell.appendChild(hoursLabel);

    cell.title = `${dayName}: ${formatHours(hours)}`;
    col.appendChild(cell);

    // ── Outside stats block (visible on mobile) ──
    const stats = document.createElement('div');
    stats.className = 'wh-stats';

    const statsHours = document.createElement('div');
    statsHours.className = 'wh-stats-hours';
    statsHours.textContent = formatHours(hours);

    const statsPct = document.createElement('div');
    statsPct.className = 'wh-stats-pct';
    statsPct.textContent = `${((hours / totalVal) * 100).toFixed(1)}% of total`;

    stats.appendChild(statsHours);
    stats.appendChild(statsPct);
    col.appendChild(stats);
    wrapper.appendChild(col);
  });
}