const base = (import.meta.env?.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
export const session = { get: () => sessionStorage.getItem('monitor.token'), set: token => sessionStorage.setItem('monitor.token', token), clear: () => sessionStorage.removeItem('monitor.token') };
export async function api(path, { method = 'GET', body, signal, blob = false } = {}) {
  const token = session.get();
  const isForm = body instanceof FormData;
  const response = await fetch(`${base}${path}`, { method, signal, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}) }, ...(body !== undefined ? { body: isForm ? body : JSON.stringify(body) } : {}) });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 && path !== '/auth/login') { session.clear(); window.dispatchEvent(new Event('monitor:unauthorized')); }
    const error = new Error(data.error?.message || `Request failed (${response.status})`); error.status = response.status; throw error;
  }
  return response.status === 204 ? {} : blob ? response.blob() : response.json();
}
export const mediaUrl = path => path?.startsWith('/api/') ? `${base}${path.slice(4)}` : (/^https?:\/\//i.test(path || '') ? path : undefined);
export const id = row => row?._id || row?.id;
export const statuses = ['AWAITING_PAYMENT','PAYMENT_DECLARED','PAYMENT_SUBMITTED','PAYMENT_REUPLOAD_REQUESTED','PAYMENT_APPROVED','PAYMENT_REJECTED','PAYMENT_EVIDENCE_EXPIRED','CANCELLED','EXPIRED'];
export const money = value => value == null ? '—' : `${Number(value).toLocaleString()} MMK`;
export const date = value => value ? new Date(value).toLocaleString('en-GB', { timeZone: 'Asia/Yangon', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
export const toYangonInput = value => value ? new Date(new Date(value).getTime() + 390 * 60000).toISOString().slice(0,16) : '';
export const fromYangonInput = value => value ? new Date(`${value}:00+06:30`).toISOString() : '';
