const view = document.getElementById('view');
const pageTitle = document.getElementById('pageTitle');
const toastEl = document.getElementById('toast');

const state = {
  tab: 'entry',
  editingId: null,   // Airtable record id when editing an existing entry
  cache: [],         // last-fetched records, used by history view + edit lookups
};

// ---------- utils ----------

function pad(n) { return String(n).padStart(2, '0'); }

function toLocalInputValue(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function isoToLocalInputValue(iso) {
  return toLocalInputValue(new Date(iso));
}

function localInputValueToIso(value) {
  return new Date(value).toISOString();
}

function friendlyDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function showToast(message, isError = false) {
  toastEl.textContent = message;
  toastEl.hidden = false;
  toastEl.className = 'toast' + (isError ? ' error' : '');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { toastEl.hidden = true; }, 3200);
}

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// ---------- router / shell ----------

function setTab(tab, { resetEditing = true } = {}) {
  state.tab = tab;
  if (resetEditing) state.editingId = null;
  document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  render();
}

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => setTab(btn.dataset.tab));
});

function render() {
  if (!isConfigured() && state.tab !== 'settings') {
    setTab('settings');
    return;
  }
  if (state.tab === 'entry') {
    pageTitle.textContent = state.editingId ? 'Edit Entry' : 'New Entry';
    view.replaceChildren(renderEntryView());
  } else if (state.tab === 'history') {
    pageTitle.textContent = 'History';
    view.replaceChildren(renderHistoryLoading());
    loadHistory();
  } else {
    pageTitle.textContent = 'Settings';
    view.replaceChildren(renderSettingsView());
  }
}

// ---------- Entry (New / Edit) view ----------

function renderEntryView() {
  const editing = state.editingId ? state.cache.find((r) => r.id === state.editingId) : null;
  const f = editing ? editing.fields : {};

  const initialDateVal = f[FIELDS.OCCURRED_AT] ? isoToLocalInputValue(f[FIELDS.OCCURRED_AT]) : toLocalInputValue(new Date());

  const wrap = el(`<div></div>`);

  const card = el(`<div class="card"></div>`);

  // date/time chips + input
  // The visible box is a plain styled <div> we fully control; the real
  // datetime-local input sits invisibly on top of it to catch the tap and
  // open iOS's native picker. iOS Safari doesn't reliably respect CSS width
  // on datetime-local, which was causing the control to overflow its card.
  card.appendChild(el(`
    <label class="field">
      <span class="label-text">When did it happen?</span>
      <div class="chip-row">
        <button type="button" class="chip" data-chip="now">Now</button>
        <button type="button" class="chip" data-chip="today">Today</button>
        <button type="button" class="chip" data-chip="yesterday">Yesterday</button>
      </div>
      <div class="datetime-shell">
        <div class="datetime-display" id="occurredAtDisplay"></div>
        <input type="datetime-local" id="occurredAt" class="datetime-native" value="${initialDateVal}" />
      </div>
    </label>
  `));

  card.appendChild(el(`
    <label class="field">
      <span class="label-text">Duration (minutes)</span>
      <input type="number" id="duration" min="0" step="1" placeholder="e.g. 10" value="${f[FIELDS.DURATION] ?? ''}" />
    </label>
  `));

  const intensityWrap = el(`
    <div class="field">
      <span class="label-text">Intensity</span>
      <div class="segmented" id="intensityGroup"></div>
    </div>
  `);
  const seg = intensityWrap.querySelector('#intensityGroup');
  INTENSITY_OPTIONS.forEach((opt, idx) => {
    const b = el(`<button type="button" data-value="${opt.value}">${opt.value}</button>`);
    b.title = opt.label;
    // Resting tint ramps light-to-saturated across the 5 buttons (1=15% accent, 5=95%),
    // so the scale reads as increasing severity even before one is picked.
    b.style.setProperty('--seg-mix', `${15 + idx * 20}%`);
    if (String(f[FIELDS.INTENSITY]) === opt.value) b.classList.add('selected');
    b.addEventListener('click', () => {
      const wasSelected = b.classList.contains('selected');
      seg.querySelectorAll('button').forEach((x) => x.classList.remove('selected'));
      if (!wasSelected) b.classList.add('selected'); // click again to deselect (field is optional)
    });
    seg.appendChild(b);
  });
  card.appendChild(intensityWrap);

  const symptomsWrap = el(`
    <div class="field">
      <span class="label-text">Symptoms</span>
      <div class="check-grid" id="symptomGrid"></div>
    </div>
  `);
  const grid = symptomsWrap.querySelector('#symptomGrid');
  const selectedSymptoms = new Set(f[FIELDS.SYMPTOMS] || []);
  SYMPTOM_OPTIONS.forEach((s) => {
    const chip = el(`
      <label class="check-chip ${selectedSymptoms.has(s) ? 'checked' : ''}">
        <input type="checkbox" value="${s}" ${selectedSymptoms.has(s) ? 'checked' : ''} />
        <span>${s}</span>
      </label>
    `);
    chip.querySelector('input').addEventListener('change', (e) => {
      chip.classList.toggle('checked', e.target.checked);
    });
    grid.appendChild(chip);
  });
  card.appendChild(symptomsWrap);

  card.appendChild(el(`
    <label class="field">
      <span class="label-text">Activity / context</span>
      <input type="text" id="activity" list="activitySuggestions" placeholder="e.g. resting, standing up, exercising" value="${escapeHtml(f[FIELDS.ACTIVITY])}" />
      <datalist id="activitySuggestions">
        <option value="Resting">
        <option value="Standing up">
        <option value="Exercising">
        <option value="Sleeping">
        <option value="Stressed">
      </datalist>
    </label>
  `));

  card.appendChild(el(`
    <div class="field-row">
      <label class="field">
        <span class="label-text">Heart rate (bpm)</span>
        <input type="number" id="heartRate" min="0" step="1" placeholder="e.g. 145" value="${f[FIELDS.HEART_RATE] ?? ''}" />
      </label>
      <label class="field">
        <span class="label-text">SpO2 (%)</span>
        <input type="number" id="spo2" min="0" max="100" step="1" placeholder="e.g. 97" value="${f[FIELDS.SPO2] ?? ''}" />
      </label>
    </div>
  `));

  card.appendChild(el(`
    <label class="field">
      <span class="label-text">Notes</span>
      <textarea id="notes" placeholder="Anything else worth noting">${escapeHtml(f[FIELDS.NOTES])}</textarea>
    </label>
  `));

  wrap.appendChild(card);

  wrap.appendChild(renderAttachmentsSection(editing));

  const errBox = el(`<div class="error-box" hidden></div>`);
  wrap.appendChild(errBox);

  const saveBtn = el(`<button type="button" class="primary">${editing ? 'Save Changes' : 'Log Entry'}</button>`);
  wrap.appendChild(saveBtn);

  if (editing) {
    const cancelBtn = el(`<button type="button" class="secondary">Cancel</button>`);
    cancelBtn.addEventListener('click', () => { state.editingId = null; render(); });
    wrap.appendChild(cancelBtn);

    const delBtn = el(`<button type="button" class="danger">Delete Entry</button>`);
    delBtn.addEventListener('click', async () => {
      if (!confirm('Delete this entry? This cannot be undone.')) return;
      try {
        await deleteRecord(editing.id);
        showToast('Entry deleted');
        state.editingId = null;
        setTab('history');
      } catch (e) {
        showToast(e.message, true);
      }
    });
    wrap.appendChild(delBtn);
  }

  // date/time display sync — the native input drives the value, this div is
  // purely what's shown, so its width/layout is fully ours to control
  const occurredAtInput = wrap.querySelector('#occurredAt');
  const occurredAtDisplay = wrap.querySelector('#occurredAtDisplay');
  function refreshDateDisplay() {
    occurredAtDisplay.textContent = occurredAtInput.value
      ? friendlyDateTime(localInputValueToIso(occurredAtInput.value))
      : 'Select date & time';
  }
  occurredAtInput.addEventListener('input', refreshDateDisplay);
  occurredAtInput.addEventListener('change', refreshDateDisplay);
  refreshDateDisplay();

  // chip behavior
  wrap.querySelectorAll('[data-chip]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const input = occurredAtInput;
      const current = input.value ? new Date(input.value) : new Date();
      const now = new Date();
      if (chip.dataset.chip === 'now') {
        input.value = toLocalInputValue(now);
      } else if (chip.dataset.chip === 'today') {
        current.setFullYear(now.getFullYear(), now.getMonth(), now.getDate());
        input.value = toLocalInputValue(current);
      } else if (chip.dataset.chip === 'yesterday') {
        const y = new Date(now);
        y.setDate(now.getDate() - 1);
        current.setFullYear(y.getFullYear(), y.getMonth(), y.getDate());
        input.value = toLocalInputValue(current);
      }
      refreshDateDisplay();
    });
  });

  saveBtn.addEventListener('click', async () => {
    errBox.hidden = true;
    const occurredAtVal = wrap.querySelector('#occurredAt').value;
    if (!occurredAtVal) {
      errBox.textContent = 'Please set a date/time.';
      errBox.hidden = false;
      return;
    }

    const durationVal = wrap.querySelector('#duration').value;
    const hrVal = wrap.querySelector('#heartRate').value;
    const spo2Val = wrap.querySelector('#spo2').value;
    const intensityBtn = seg.querySelector('button.selected');
    const symptoms = Array.from(grid.querySelectorAll('input:checked')).map((i) => i.value);

    const fields = {
      [FIELDS.OCCURRED_AT]: localInputValueToIso(occurredAtVal),
      [FIELDS.DURATION]: durationVal === '' ? null : Number(durationVal),
      [FIELDS.INTENSITY]: intensityBtn ? intensityBtn.dataset.value : null,
      [FIELDS.SYMPTOMS]: symptoms,
      [FIELDS.ACTIVITY]: wrap.querySelector('#activity').value || null,
      [FIELDS.HEART_RATE]: hrVal === '' ? null : Number(hrVal),
      [FIELDS.SPO2]: spo2Val === '' ? null : Number(spo2Val),
      [FIELDS.NOTES]: wrap.querySelector('#notes').value || null,
    };

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    try {
      if (editing) {
        await updateRecord(editing.id, fields);
        showToast('Entry updated');
      } else {
        await createRecord(fields);
        showToast('Entry logged');
      }
      state.editingId = null;
      setTab('history');
    } catch (e) {
      errBox.textContent = e.message;
      errBox.hidden = false;
      saveBtn.disabled = false;
      saveBtn.textContent = editing ? 'Save Changes' : 'Log Entry';
    }
  });

  return wrap;
}

function formatFileSize(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function renderAttachmentsSection(editing) {
  const card = el(`<div class="card"></div>`);
  card.appendChild(el(`<span class="label-text">Photos &amp; Files</span>`));

  if (!editing) {
    card.appendChild(el(`<p class="hint">Save this entry first — then you can attach photos or files to it (like an EKG PDF export).</p>`));
    return card;
  }

  const list = el(`<div class="attachment-list"></div>`);
  card.appendChild(list);

  function renderList(attachments) {
    list.replaceChildren();
    (attachments || []).forEach((att) => {
      const isImage = (att.type || '').startsWith('image/');
      const thumbUrl = att.thumbnails?.small?.url;
      const row = el(`
        <div class="attachment-row">
          ${isImage && thumbUrl
            ? `<img class="attachment-thumb" src="${thumbUrl}" alt="" />`
            : `<span class="attachment-thumb attachment-thumb-file">📄</span>`}
          <a class="attachment-info" href="${escapeHtml(att.url)}" target="_blank" rel="noopener">
            <span class="attachment-name">${escapeHtml(att.filename)}</span>
            <span class="attachment-size">${formatFileSize(att.size)}</span>
          </a>
          <button type="button" class="attachment-remove" aria-label="Remove">✕</button>
        </div>
      `);
      row.querySelector('.attachment-remove').addEventListener('click', async () => {
        if (!confirm(`Remove "${att.filename}"?`)) return;
        try {
          const keep = (attachments || []).filter((a) => a.id !== att.id);
          const result = await removeAttachment(editing.id, FIELDS.ATTACHMENTS, keep);
          editing.fields[FIELDS.ATTACHMENTS] = result.fields[FIELDS.ATTACHMENTS] || [];
          renderList(editing.fields[FIELDS.ATTACHMENTS]);
          showToast('Removed');
        } catch (e) {
          showToast(e.message, true);
        }
      });
      list.appendChild(row);
    });
  }
  renderList(editing.fields[FIELDS.ATTACHMENTS]);

  const fileInput = el(`<input type="file" multiple hidden />`);
  const addBtn = el(`<button type="button" class="secondary">Add Photo or File</button>`);
  addBtn.style.marginTop = '4px';
  addBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', async () => {
    const files = Array.from(fileInput.files || []);
    if (files.length === 0) return;
    addBtn.disabled = true;
    for (const file of files) {
      addBtn.textContent = `Uploading ${file.name}…`;
      try {
        const result = await uploadAttachment(editing.id, FIELDS.ATTACHMENTS, file);
        editing.fields[FIELDS.ATTACHMENTS] = result.fields[FIELDS.ATTACHMENTS] || [];
        renderList(editing.fields[FIELDS.ATTACHMENTS]);
      } catch (e) {
        showToast(e.message, true);
      }
    }
    addBtn.disabled = false;
    addBtn.textContent = 'Add Photo or File';
    fileInput.value = '';
  });

  card.appendChild(fileInput);
  card.appendChild(addBtn);

  return card;
}

// ---------- History view ----------

function renderHistoryLoading() {
  return el(`<div class="spinner-line">Loading…</div>`);
}

async function loadHistory() {
  try {
    const records = await listAllRecords({ sortField: FIELDS.OCCURRED_AT, sortDirection: 'desc' });
    state.cache = records;
    if (state.tab === 'history') {
      view.replaceChildren(renderHistoryView(records));
    }
  } catch (e) {
    view.replaceChildren(el(`<div class="error-box">${e.message}</div>`));
  }
}

function renderHistoryView(records) {
  const wrap = el(`<div></div>`);

  const filterRow = el(`
    <div class="filter-row">
      <select id="symptomFilter">
        <option value="">All symptoms</option>
        ${SYMPTOM_OPTIONS.map((s) => `<option value="${s}">${s}</option>`).join('')}
      </select>
      <input type="date" id="fromDate" />
      <input type="date" id="toDate" />
    </div>
  `);
  wrap.appendChild(filterRow);

  const gridWrap = el(`<div class="grid-wrap"></div>`);
  wrap.appendChild(gridWrap);

  function applyFilters() {
    const symptom = filterRow.querySelector('#symptomFilter').value;
    const from = filterRow.querySelector('#fromDate').value;
    const to = filterRow.querySelector('#toDate').value;

    let filtered = records;
    if (symptom) {
      filtered = filtered.filter((r) => (r.fields[FIELDS.SYMPTOMS] || []).includes(symptom));
    }
    if (from) {
      const fromDate = new Date(from + 'T00:00:00');
      filtered = filtered.filter((r) => r.fields[FIELDS.OCCURRED_AT] && new Date(r.fields[FIELDS.OCCURRED_AT]) >= fromDate);
    }
    if (to) {
      const toDate = new Date(to + 'T23:59:59');
      filtered = filtered.filter((r) => r.fields[FIELDS.OCCURRED_AT] && new Date(r.fields[FIELDS.OCCURRED_AT]) <= toDate);
    }
    gridWrap.replaceChildren(buildGrid(filtered));
  }

  filterRow.querySelectorAll('select, input').forEach((elm) => elm.addEventListener('change', applyFilters));

  applyFilters();
  return wrap;
}

function buildGrid(records) {
  if (records.length === 0) {
    return el(`<div class="empty-state">No entries yet. Log one from the "Log" tab.</div>`);
  }

  const table = el(`
    <table class="grid">
      <thead>
        <tr>
          <th>When</th>
          <th>Duration</th>
          <th>Intensity</th>
          <th>Symptoms</th>
          <th>HR</th>
          <th>SpO2</th>
          <th>Activity</th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>
  `);
  const tbody = table.querySelector('tbody');

  records.forEach((r) => {
    const f = r.fields;
    const symptoms = (f[FIELDS.SYMPTOMS] || []).map((s) => `<span class="pill">${escapeHtml(s)}</span>`).join(' ');
    const row = el(`
      <tr class="row">
        <td>${f[FIELDS.OCCURRED_AT] ? friendlyDateTime(f[FIELDS.OCCURRED_AT]) : '—'}</td>
        <td>${f[FIELDS.DURATION] ?? '—'}${f[FIELDS.DURATION] != null ? ' min' : ''}</td>
        <td>${f[FIELDS.INTENSITY] ?? '—'}</td>
        <td>${symptoms || '—'}</td>
        <td>${f[FIELDS.HEART_RATE] ?? '—'}</td>
        <td>${f[FIELDS.SPO2] != null ? f[FIELDS.SPO2] + '%' : '—'}</td>
        <td>${escapeHtml(f[FIELDS.ACTIVITY]) || '—'}</td>
      </tr>
    `);
    row.addEventListener('click', () => {
      state.editingId = r.id;
      setTab('entry', { resetEditing: false });
    });
    tbody.appendChild(row);
  });

  return table;
}

// ---------- Settings view ----------

function renderSettingsView() {
  const cfg = getConfig();
  const wrap = el(`<div></div>`);

  wrap.appendChild(el(`
    <div class="card">
      <p class="hint">
        Connect your Airtable base. Create a base called <strong>Heart Rate Log</strong> with a table
        called <strong>Episodes</strong> and the fields described in the setup README, then generate a
        Personal Access Token at
        <span style="color:var(--text)">airtable.com/create/tokens</span> scoped to just that base
        (<code>data.records:read</code> and <code>data.records:write</code>).
      </p>
    </div>
  `));

  const card = el(`<div class="card"></div>`);
  card.appendChild(el(`
    <label class="field">
      <span class="label-text">Personal Access Token</span>
      <input type="text" id="cfgToken" placeholder="patXXXXXXXX..." value="${escapeHtml(cfg.token)}" />
    </label>
  `));
  card.appendChild(el(`
    <label class="field">
      <span class="label-text">Base ID</span>
      <input type="text" id="cfgBase" placeholder="appXXXXXXXX..." value="${escapeHtml(cfg.baseId)}" />
    </label>
  `));
  card.appendChild(el(`
    <label class="field">
      <span class="label-text">Table name</span>
      <input type="text" id="cfgTable" placeholder="Episodes" value="${escapeHtml(cfg.tableName || 'Episodes')}" />
    </label>
  `));
  wrap.appendChild(card);

  const errBox = el(`<div class="error-box" hidden></div>`);
  wrap.appendChild(errBox);

  const saveBtn = el(`<button type="button" class="primary">Save &amp; Test Connection</button>`);
  saveBtn.addEventListener('click', async () => {
    errBox.hidden = true;
    const token = card.querySelector('#cfgToken').value.trim();
    const baseId = card.querySelector('#cfgBase').value.trim();
    const tableName = card.querySelector('#cfgTable').value.trim() || 'Episodes';

    if (!token || !baseId) {
      errBox.textContent = 'Token and Base ID are both required.';
      errBox.hidden = false;
      return;
    }

    saveConfig({ token, baseId, tableName });
    saveBtn.disabled = true;
    saveBtn.textContent = 'Testing…';
    try {
      await testConnection();
      showToast('Connected!');
      setTab('entry');
    } catch (e) {
      errBox.textContent = e.message;
      errBox.hidden = false;
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save & Test Connection';
    }
  });
  wrap.appendChild(saveBtn);

  wrap.appendChild(renderAppearanceCard());

  return wrap;
}

function renderAppearanceCard() {
  const card = el(`<div class="card"></div>`);
  card.appendChild(el(`<span class="label-text">Appearance</span>`));

  const activeId = getSavedThemeId();
  THEMES.forEach((theme) => {
    const row = el(`
      <button type="button" class="theme-row ${theme.id === activeId ? 'active' : ''}">
        <span class="theme-dot" style="background:${theme.accent}"></span>
        <span class="theme-info">
          <span class="theme-name">${escapeHtml(theme.name)}</span>
          <span class="theme-note">${escapeHtml(theme.note)}</span>
        </span>
        <span class="theme-check">${theme.id === activeId ? '✓' : ''}</span>
      </button>
    `);
    row.addEventListener('click', () => {
      applyTheme(theme.id);
      card.querySelectorAll('.theme-row').forEach((r) => r.classList.remove('active'));
      card.querySelectorAll('.theme-check').forEach((c) => { c.textContent = ''; });
      row.classList.add('active');
      row.querySelector('.theme-check').textContent = '✓';
    });
    card.appendChild(row);
  });

  return card;
}

// ---------- init ----------

applyTheme(getSavedThemeId());

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

setTab(isConfigured() ? 'entry' : 'settings');
