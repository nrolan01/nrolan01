const CONFIG_KEY = 'hrlog_config_v1';

function getConfig() {
  try {
    return JSON.parse(localStorage.getItem(CONFIG_KEY)) || {};
  } catch {
    return {};
  }
}

function saveConfig(cfg) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
}

function isConfigured() {
  const c = getConfig();
  return Boolean(c.token && c.baseId && c.tableName);
}

function apiUrl(path = '') {
  const { baseId, tableName } = getConfig();
  return `https://api.airtable.com/v0/${encodeURIComponent(baseId)}/${encodeURIComponent(tableName)}${path}`;
}

async function airtableRequest(path, options = {}) {
  const { token } = getConfig();
  if (!token) throw new Error('Not configured yet — open Settings first.');

  const res = await fetch(apiUrl(path), {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body?.error?.message || JSON.stringify(body);
    } catch {
      detail = res.statusText;
    }
    throw new Error(`Airtable error ${res.status}: ${detail}`);
  }

  return res.json();
}

// Fetches all records, following pagination offsets.
async function listAllRecords({ sortField, sortDirection = 'desc' } = {}) {
  let records = [];
  let offset;
  do {
    const params = new URLSearchParams();
    params.set('pageSize', '100');
    if (sortField) {
      params.set('sort[0][field]', sortField);
      params.set('sort[0][direction]', sortDirection);
    }
    if (offset) params.set('offset', offset);

    const data = await airtableRequest(`?${params.toString()}`);
    records = records.concat(data.records);
    offset = data.offset;
  } while (offset);

  return records;
}

function createRecord(fields) {
  return airtableRequest('', {
    method: 'POST',
    body: JSON.stringify({ fields, typecast: true }),
  });
}

function updateRecord(id, fields) {
  return airtableRequest(`/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields, typecast: true }),
  });
}

function deleteRecord(id) {
  return airtableRequest(`/${id}`, { method: 'DELETE' });
}

async function testConnection() {
  await airtableRequest('?pageSize=1');
  return true;
}
