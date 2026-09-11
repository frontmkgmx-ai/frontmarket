
const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0736685342';
const DATABASE_ID = process.env.VITE_FIREBASE_DATABASE_ID || 'ai-studio-f452ed5b-7861-4365-a109-42e00eede901';

const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;

function parseFirestoreValue(value: any): any {
  if (!value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return parseInt(value.integerValue, 10);
  if ('doubleValue' in value) return parseFloat(value.doubleValue);
  if ('booleanValue' in value) return value.booleanValue;
  if ('timestampValue' in value) return new Date(value.timestampValue);
  if ('mapValue' in value) {
    const res: any = {};
    const fields = value.mapValue.fields || {};
    for (const k in fields) {
      res[k] = parseFirestoreValue(fields[k]);
    }
    return res;
  }
  if ('arrayValue' in value) {
    return (value.arrayValue.values || []).map(parseFirestoreValue);
  }
  return null;
}

function parseFirestoreDocument(doc: any): any {
  if (!doc || !doc.fields) return null;
  const res: any = {};
  for (const k in doc.fields) {
    res[k] = parseFirestoreValue(doc.fields[k]);
  }
  res.id = doc.name.split('/').pop();
  return res;
}

function toFirestoreValue(value: any): any {
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: value.toString() } : { doubleValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirestoreValue) } };
  if (typeof value === 'object' && value !== null) {
    const fields: any = {};
    for (const k in value) {
      fields[k] = toFirestoreValue(value[k]);
    }
    return { mapValue: { fields } };
  }
  return { nullValue: null };
}

export async function restGetDocs(path: string, token: string) {
  const res = await fetch(`${BASE_URL}/${path}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`REST Error: ${res.statusText}`);
  const data = await res.json();
  if (!data.documents) return [];
  return data.documents.map(parseFirestoreDocument);
}

export async function restRunQuery(parentPath: string, collectionId: string, whereFilters: any[], token: string) {
  const body = {
    structuredQuery: {
      from: [{ collectionId }],
      where: whereFilters.length === 1 ? whereFilters[0] : {
        compositeFilter: {
          op: 'AND',
          filters: whereFilters
        }
      }
    }
  };
  
  const res = await fetch(`${BASE_URL}/${parentPath}:runQuery`, {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const errData = await res.text();
    throw new Error(`REST Error: ${res.statusText} - ${errData}`);
  }
  const data = await res.json();
  // runQuery returns an array of objects like { document: {...}, readTime: "..." }
  return data.map((d: any) => parseFirestoreDocument(d.document)).filter((d: any) => d !== null);
}

export async function restAddDoc(parentPath: string, collectionId: string, data: any, token: string) {
  const fields: any = {};
  for (const k in data) {
    fields[k] = toFirestoreValue(data[k]);
  }
  const res = await fetch(`${BASE_URL}/${parentPath}/${collectionId}`, {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fields })
  });
  if (!res.ok) {
    const errData = await res.text();
    throw new Error(`REST Error: ${res.statusText} - ${errData}`);
  }
  const resData = await res.json();
  return parseFirestoreDocument(resData);
}

export async function restUpdateDoc(docPath: string, data: any, token: string) {
  const fields: any = {};
  const updateMask = [];
  for (const k in data) {
    fields[k] = toFirestoreValue(data[k]);
    updateMask.push(`updateMask.fieldPaths=${k}`);
  }
  const res = await fetch(`${BASE_URL}/${docPath}?${updateMask.join('&')}`, {
    method: 'PATCH',
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fields })
  });
  if (!res.ok) throw new Error(`REST Error: ${res.statusText}`);
  const resData = await res.json();
  return parseFirestoreDocument(resData);
}


export async function restDeleteDoc(docPath: string, token: string) {
  const res = await fetch(`${BASE_URL}/${docPath}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`REST Error: ${res.statusText}`);
}
