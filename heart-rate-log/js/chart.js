const CHART_STATE_KEY = 'hrlog_chart_v1';

const CHART_METRICS = [
  { id: 'intensity', label: 'Intensity', field: FIELDS.INTENSITY, fixedDomain: [1, 5] },
  { id: 'duration', label: 'Duration (min)', field: FIELDS.DURATION, fixedDomain: null },
  { id: 'heartRate', label: 'Heart Rate (bpm)', field: FIELDS.HEART_RATE, fixedDomain: null },
  { id: 'spo2', label: 'SpO2 (%)', field: FIELDS.SPO2, fixedDomain: null },
];

function getChartMetric(id) {
  return CHART_METRICS.find((m) => m.id === id) || CHART_METRICS[0];
}

function loadChartState() {
  try {
    return JSON.parse(localStorage.getItem(CHART_STATE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveChartState(s) {
  localStorage.setItem(CHART_STATE_KEY, JSON.stringify(s));
}

function renderChartLoading() {
  return el(`<div class="spinner-line">Loading…</div>`);
}

async function loadChart() {
  try {
    const records = await listAllRecords({ sortField: FIELDS.OCCURRED_AT, sortDirection: 'asc' });
    if (state.tab === 'chart') {
      view.replaceChildren(renderChartView(records));
    }
  } catch (e) {
    view.replaceChildren(el(`<div class="error-box">${escapeHtml(e.message)}</div>`));
  }
}

function renderChartView(records) {
  const wrap = el(`<div></div>`);
  const cfg = loadChartState();
  const yId = getChartMetric(cfg.yMetricId).id;
  const colorId = cfg.colorMetricId && (cfg.colorMetricId === 'none' || getChartMetric(cfg.colorMetricId)) ? cfg.colorMetricId : 'duration';

  const controls = el(`
    <div class="filter-row">
      <label class="field" style="margin-bottom:0">
        <span class="label-text">Y-axis</span>
        <select id="chartY">
          ${CHART_METRICS.map((m) => `<option value="${m.id}" ${m.id === yId ? 'selected' : ''}>${escapeHtml(m.label)}</option>`).join('')}
        </select>
      </label>
      <label class="field" style="margin-bottom:0">
        <span class="label-text">Color by</span>
        <select id="chartColor">
          <option value="none" ${colorId === 'none' ? 'selected' : ''}>None</option>
          ${CHART_METRICS.map((m) => `<option value="${m.id}" ${m.id === colorId ? 'selected' : ''}>${escapeHtml(m.label)}</option>`).join('')}
        </select>
      </label>
    </div>
  `);
  wrap.appendChild(controls);

  const chartHolder = el(`<div></div>`);
  wrap.appendChild(chartHolder);

  function rerender() {
    const yMetric = getChartMetric(controls.querySelector('#chartY').value);
    const colorSel = controls.querySelector('#chartColor').value;
    const colorMetric = colorSel === 'none' ? null : getChartMetric(colorSel);
    saveChartState({ yMetricId: yMetric.id, colorMetricId: colorSel });
    chartHolder.replaceChildren(buildScatterChart(records, yMetric, colorMetric));
  }
  controls.querySelectorAll('select').forEach((s) => s.addEventListener('change', rerender));
  rerender();

  return wrap;
}

function niceTicks(min, max, count) {
  if (min === max) return [min];
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => min + step * i);
}

function buildScatterChart(records, yMetric, colorMetric) {
  const points = records
    .map((r) => {
      const t = r.fields[FIELDS.OCCURRED_AT];
      const yRaw = r.fields[yMetric.field];
      if (!t || yRaw == null) return null;
      const y = Number(yRaw);
      if (Number.isNaN(y)) return null;
      let colorVal = null;
      if (colorMetric) {
        const cRaw = r.fields[colorMetric.field];
        if (cRaw != null && !Number.isNaN(Number(cRaw))) colorVal = Number(cRaw);
      }
      return { time: new Date(t).getTime(), y, colorVal, record: r };
    })
    .filter(Boolean);

  if (points.length === 0) {
    return el(`<div class="empty-state">No entries with ${escapeHtml(yMetric.label)} data yet.</div>`);
  }

  const card = el(`<div class="card"></div>`);

  // --- domains ---
  const xMin = Math.min(...points.map((p) => p.time));
  const xMax = Math.max(...points.map((p) => p.time));
  const xPad = xMax === xMin ? 1000 * 60 * 60 * 24 : (xMax - xMin) * 0.05;
  const xDomain = [xMin - xPad, xMax + xPad];

  const [yMinRaw, yMaxRaw] = yMetric.fixedDomain || [Math.min(...points.map((p) => p.y)), Math.max(...points.map((p) => p.y))];
  const yPad = yMaxRaw === yMinRaw ? 1 : (yMaxRaw - yMinRaw) * 0.12;
  const yDomain = [yMinRaw - yPad, yMaxRaw + yPad];

  let colorDomain = null;
  if (colorMetric) {
    const vals = points.filter((p) => p.colorVal != null).map((p) => p.colorVal);
    if (vals.length) {
      colorDomain = colorMetric.fixedDomain || [Math.min(...vals), Math.max(...vals)];
      if (colorDomain[0] === colorDomain[1]) colorDomain = [colorDomain[0] - 1, colorDomain[1] + 1];
    }
  }

  // --- layout (internal SVG coordinate space) ---
  const W = 320, H = 220;
  const marginLeft = 36, marginRight = 12, marginTop = 12, marginBottom = 28;
  const plotW = W - marginLeft - marginRight;
  const plotH = H - marginTop - marginBottom;

  const scaleX = (t) => marginLeft + ((t - xDomain[0]) / (xDomain[1] - xDomain[0])) * plotW;
  const scaleY = (v) => marginTop + plotH - ((v - yDomain[0]) / (yDomain[1] - yDomain[0])) * plotH;
  const scaleColor = (v) => {
    if (v == null || !colorDomain) return 0;
    const pct = (v - colorDomain[0]) / (colorDomain[1] - colorDomain[0]);
    return Math.max(0, Math.min(1, pct));
  };

  const svgParts = [];

  // gridlines + y ticks
  const yTickValues = yMetric.fixedDomain ? [1, 2, 3, 4, 5] : niceTicks(yMinRaw, yMaxRaw, 4);
  yTickValues.forEach((tv) => {
    const y = scaleY(tv);
    svgParts.push(`<line x1="${marginLeft}" y1="${y}" x2="${W - marginRight}" y2="${y}" stroke="var(--border)" stroke-width="1" />`);
    svgParts.push(`<text x="${marginLeft - 6}" y="${y + 3}" text-anchor="end" font-size="9" fill="var(--text-dim)">${tv}</text>`);
  });

  // x ticks (dates)
  const xTickValues = niceTicks(xMin, xMax, 4);
  xTickValues.forEach((tv) => {
    const x = scaleX(tv);
    const label = new Date(tv).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    svgParts.push(`<text x="${x}" y="${H - marginBottom + 16}" text-anchor="middle" font-size="9" fill="var(--text-dim)">${label}</text>`);
  });

  // axis lines
  svgParts.push(`<line x1="${marginLeft}" y1="${marginTop}" x2="${marginLeft}" y2="${H - marginBottom}" stroke="var(--border)" stroke-width="1" />`);
  svgParts.push(`<line x1="${marginLeft}" y1="${H - marginBottom}" x2="${W - marginRight}" y2="${H - marginBottom}" stroke="var(--border)" stroke-width="1" />`);

  const svg = el(`
    <svg viewBox="0 0 ${W} ${H}" class="chart-svg" role="img" aria-label="${escapeHtml(yMetric.label)} over time">
      ${svgParts.join('')}
    </svg>
  `);

  // points + hit targets (appended via DOM so we can attach listeners cleanly)
  const tooltip = el(`<div class="chart-tooltip" hidden></div>`);

  points.forEach((p) => {
    const cx = scaleX(p.time);
    const cy = scaleY(p.y);
    const fill = colorMetric && p.colorVal != null
      ? `color-mix(in srgb, var(--accent) ${Math.round(15 + scaleColor(p.colorVal) * 85)}%, var(--surface-2))`
      : 'var(--accent)';

    const hit = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    hit.setAttribute('cx', cx);
    hit.setAttribute('cy', cy);
    hit.setAttribute('r', 12);
    hit.setAttribute('fill', 'transparent');
    hit.style.pointerEvents = 'all';
    hit.style.cursor = 'pointer';

    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', cx);
    dot.setAttribute('cy', cy);
    dot.setAttribute('r', 5);
    dot.style.fill = fill;
    dot.setAttribute('stroke', 'var(--surface)');
    dot.setAttribute('stroke-width', '2');

    hit.addEventListener('click', (e) => {
      e.stopPropagation();
      showChartTooltip(tooltip, card, e, p, yMetric, colorMetric);
    });

    svg.appendChild(dot);
    svg.appendChild(hit);
  });

  card.addEventListener('click', () => { tooltip.hidden = true; });

  card.style.position = 'relative';
  card.appendChild(svg);
  card.appendChild(tooltip);

  // sequential color legend
  if (colorMetric && colorDomain) {
    const lowColor = `color-mix(in srgb, var(--accent) 15%, var(--surface-2))`;
    const highColor = `color-mix(in srgb, var(--accent) 100%, var(--surface-2))`;
    card.appendChild(el(`
      <div class="chart-legend">
        <span class="chart-legend-label">${escapeHtml(colorMetric.label)}</span>
        <span class="chart-legend-value">${Math.round(colorDomain[0])}</span>
        <div class="chart-gradient" style="background: linear-gradient(to right, ${lowColor}, ${highColor})"></div>
        <span class="chart-legend-value">${Math.round(colorDomain[1])}</span>
      </div>
    `));
  }

  return card;
}

function showChartTooltip(tooltip, container, event, point, yMetric, colorMetric) {
  const containerBox = container.getBoundingClientRect();
  const x = event.clientX - containerBox.left;
  const y = event.clientY - containerBox.top;

  tooltip.replaceChildren();
  const dateLine = document.createElement('div');
  dateLine.className = 'chart-tooltip-date';
  dateLine.textContent = friendlyDateTime(new Date(point.time).toISOString());
  tooltip.appendChild(dateLine);

  const yLine = document.createElement('div');
  yLine.className = 'chart-tooltip-value';
  yLine.textContent = `${yMetric.label}: ${point.y}`;
  tooltip.appendChild(yLine);

  if (colorMetric && point.colorVal != null && colorMetric.id !== yMetric.id) {
    const cLine = document.createElement('div');
    cLine.className = 'chart-tooltip-value';
    cLine.textContent = `${colorMetric.label}: ${point.colorVal}`;
    tooltip.appendChild(cLine);
  }

  const symptoms = point.record.fields[FIELDS.SYMPTOMS];
  if (symptoms && symptoms.length) {
    const sLine = document.createElement('div');
    sLine.className = 'chart-tooltip-symptoms';
    sLine.textContent = symptoms.join(', ');
    tooltip.appendChild(sLine);
  }

  tooltip.hidden = false;
  // Clamp so it doesn't run off the card edge.
  const left = Math.min(Math.max(x - 60, 4), container.clientWidth - 124);
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${Math.max(y - 78, 4)}px`;
}
