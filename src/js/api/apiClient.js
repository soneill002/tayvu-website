/*  src/js/api/apiClient.js
    The exact SecureAPIClient + APIError classes lifted from the monolith.
    Usage everywhere else:  import { apiClient } from '@/api/apiClient.js';
-------------------------------------------------------------------------- */

const BASE = '/.netlify/functions';

/* ---------- error class ---------- */
export class APIError extends Error {
  constructor(message, status, field = null) {
    super(message);
    this.status = status;
    this.field = field;
  }
}

/* ---------- SecureAPIClient class ---------- */
class SecureAPIClient {
  token = null;

  async request(endpoint, { method = 'GET', body, headers = {} } = {}) {
    const url = `${BASE}/${endpoint}`;

    const h = { 'Content-Type': 'application/json', ...headers };
    if (this.token) h.Authorization = `Bearer ${this.token}`;

    const res = await fetch(url, { method, headers: h, body, credentials: 'include' });
    const data = await res.json();

    if (!res.ok) throw new APIError(data.error || 'Request failed', res.status, data.field);
    return data;
  }

  setToken(t) {
    this.token = t;
  }
}

/* ---------- singleton export ---------- */
export const apiClient = new SecureAPIClient();
