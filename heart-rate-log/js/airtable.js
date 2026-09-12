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

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]); // strip "data:...;base64," prefix
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}

// Uploads one file's raw bytes straight to Airtable — a different host/endpoint
// (content.airtable.com) than the rest of this file, made specifically for apps
// with no server of their own to host the file at a URL first.
async function uploadAttachment(recordId, fieldName, file) {
  const { token, baseId } = getConfig();
  if (!token) throw new Error('Not configured yet — open Settings first.');

  const base64 = await fileToBase64(file);
  const url = `https://content.airtable.com/v0/${encodeURIComponent(baseId)}/${encodeURIComponent(recordId)}/${encodeURIComponent(fieldName)}/uploadAttachment`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contentType: file.type || 'application/octet-stream',
      file: base64,
      filename: file.name || 'upload',
    }),
  });

  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body?.error?.message || JSON.stringify(body);
    } catch {
      detail = res.statusText;
    }
    throw new Error(`Upload failed (${res.status}): ${detail}`);
  }

  return res.json(); // { id, createdTime, fields: { [fieldName]: [...attachments] } }
}

// Removes one attachment by re-saving the field with everything except it —
// referencing an existing attachment by {id} alone keeps it; leaving one out drops it.
function removeAttachment(recordId, fieldName, keepAttachments) {
  return updateRecord(recordId, { [fieldName]: keepAttachments.map((a) => ({ id: a.id })) });
}
