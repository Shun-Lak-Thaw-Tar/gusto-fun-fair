export const API_BASE = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api"
).replace(/\/$/, "");

export type Session = { token: string; user: any; role: string };
export type ApiResult = { data: any; status: number; url: string };

export class ApiFailure extends Error {
  status: number;
  method: string;
  url: string;
  payload: any;
  constructor(
    message: string,
    status: number,
    method: string,
    url: string,
    payload: any,
  ) {
    super(message);
    this.name = "ApiFailure";
    this.status = status;
    this.method = method;
    this.url = url;
    this.payload = payload;
  }
}

export const session = {
  read: (): Session | null => {
    try {
      return JSON.parse(localStorage.getItem("gusto-session") || "null");
    } catch {
      return null;
    }
  },
  write: (value: Session) =>
    localStorage.setItem("gusto-session", JSON.stringify(value)),
  clear: () => localStorage.removeItem("gusto-session"),
};

async function request(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<ApiResult> {
  const url = `${API_BASE}${path}`;
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let response: Response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch (error) {
    throw new ApiFailure(
      error instanceof Error ? error.message : "Network request failed",
      0,
      options.method || "GET",
      url,
      null,
    );
  }
  const text = await response.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.message ||
      response.statusText ||
      "Request failed";
    throw new ApiFailure(
      message,
      response.status,
      options.method || "GET",
      url,
      data,
    );
  }
  return { data, status: response.status, url };
}

const json = (method: string, path: string, body?: any, token?: string) =>
  request(
    path,
    { method, body: body === undefined ? undefined : JSON.stringify(body) },
    token,
  );
export const api = {
  request,
  health: () => request("/health"),
  event: () => request("/event"),
  register: (body: any) => json("POST", "/auth/register", body),
  login: (body: any) => json("POST", "/auth/login", body),
  me: (token: string) => request("/auth/me", {}, token),
  stalls: () => request("/stalls"),
  stall: (id: string) => request(`/stalls/${id}`),
  stallSlug: (slug: string) =>
    request(`/stalls/by-slug/${encodeURIComponent(slug)}`),
  foods: (query = "") => request(`/foods${query}`),
  food: (id: string) => request(`/foods/${id}`),
  orders: (token: string) => request("/orders", {}, token),
  createOrder: (body: any, token: string) =>
    json("POST", "/orders", body, token),
  order: (id: string, token: string) => request(`/orders/${id}`, {}, token),
  declare: (id: string, token: string) =>
    json("POST", `/orders/${id}/payment-declare`, undefined, token),
  cancel: (id: string, token: string) =>
    json("POST", `/orders/${id}/cancel`, undefined, token),
  payment: (orderId: string, token: string) =>
    request(`/payments/orders/${orderId}`, {}, token),
  uploadPayment: (orderId: string, file: File, token: string) => {
    const form = new FormData();
    form.append("image", file);
    return request(
      `/payments/orders/${orderId}`,
      { method: "POST", body: form },
      token,
    );
  },
  proof: (paymentId: string, version: number, token: string) =>
    request(`/payments/${paymentId}/proofs/${version}`, {}, token),
  tickets: (token: string) => request("/tickets/mine", {}, token),
  memories: (query = "") => request(`/memories${query}`, {}, undefined),
  memoryWindow: () => request("/memories/window"),
  allowance: (token: string) => request("/memories/allowance", {}, token),
  myMemories: (token: string) => request("/memories/mine", {}, token),
  uploadMemory: (file: File, caption: string, token: string) => {
    const form = new FormData();
    form.append("image", file);
    form.append("caption", caption);
    return request("/memories", { method: "POST", body: form }, token);
  },
  memoryImage: (id: string) => `${API_BASE}/memories/${id}/image`,
  deleteMemory: (id: string, token: string) =>
    request(`/memories/${id}`, { method: "DELETE" }, token),
  reaction: (id: string, token: string) =>
    request(`/memories/${id}/reaction`, {}, token),
  setReaction: (id: string, value: string | null, token: string) =>
    json("PUT", `/memories/${id}/reaction`, { reaction: value }, token),
  crushLetters: (query = "") => request(`/crush-letters${query}`),
  submitCrush: (body: any) => json("POST", "/crush-letters", body),
  admin: {
    dashboard: (t: string) => request("/admin/dashboard", {}, t),
    event: (t: string) => request("/admin/event", {}, t),
    updateEvent: (b: any, t: string) => json("PATCH", "/admin/event", b, t),
    payments: (t: string) => request("/admin/payments", {}, t),
    reviewPayment: (id: string, b: any, t: string) =>
      json("PATCH", `/admin/payments/${id}/review`, b, t),
    stats: (part: string, t: string) =>
      request(`/admin/statistics/${part}`, {}, t),
    orders: (q: string, t: string) => request(`/admin/orders${q}`, {}, t),
    order: (id: string, t: string) => request(`/admin/orders/${id}`, {}, t),
    stalls: (t: string) => request("/admin/stalls", {}, t),
    stall: (id: string, t: string) => request(`/admin/stalls/${id}`, {}, t),
    createStall: (b: any, t: string) => json("POST", "/admin/stalls", b, t),
    updateStall: (id: string, b: any, t: string) =>
      json("PATCH", `/admin/stalls/${id}`, b, t),
    stallStatus: (id: string, b: any, t: string) =>
      json("PATCH", `/admin/stalls/${id}/status`, b, t),
    foods: (t: string) => request("/admin/foods", {}, t),
    food: (id: string, t: string) => request(`/admin/foods/${id}`, {}, t),
    createFood: (b: any, t: string) => json("POST", "/admin/foods", b, t),
    updateFood: (id: string, b: any, t: string) =>
      json("PATCH", `/admin/foods/${id}`, b, t),
    stallFoods: (q: string, t: string) =>
      request(`/admin/stall-foods${q}`, {}, t),
    stallFood: (id: string, t: string) =>
      request(`/admin/stall-foods/${id}`, {}, t),
    createStallFood: (b: any, t: string) =>
      json("POST", "/admin/stall-foods", b, t),
    updateStallFood: (id: string, b: any, t: string) =>
      json("PATCH", `/admin/stall-foods/${id}`, b, t),
    ticket: (code: string, t: string) =>
      request(`/admin/tickets/${encodeURIComponent(code)}`, {}, t),
    redeem: (code: string, t: string) =>
      json(
        "POST",
        `/admin/tickets/${encodeURIComponent(code)}/redeem`,
        undefined,
        t,
      ),
    adminLetters: (q: string, t: string) =>
      request(`/admin/crush-letters${q}`, {}, t),
    letter: (id: string, t: string) =>
      request(`/admin/crush-letters/${id}`, {}, t),
    reviewLetter: (id: string, b: any, t: string) =>
      json("PATCH", `/admin/crush-letters/${id}/review`, b, t),
    visibilityLetter: (id: string, b: any, t: string) =>
      json("PATCH", `/admin/crush-letters/${id}/visibility`, b, t),
    adminWindow: (t: string) => request("/admin/memories/window", {}, t),
    updateWindow: (b: any, t: string) =>
      json("PUT", "/admin/memories/window", b, t),
    removeMemory: (id: string, t: string) =>
      request(`/admin/memories/${id}`, { method: "DELETE" }, t),
    createOwner: (stallId: string, b: any, t: string) =>
      json("POST", `/admin/stalls/${stallId}/owner`, b, t),
    owner: (stallId: string, t: string) =>
      request(`/admin/stalls/${stallId}/owner`, {}, t),
  },
  owner: {
    dashboard: (t: string) => request("/stall-owner/dashboard", {}, t),
    stall: (t: string) => request("/stall-owner/stall", {}, t),
    foods: (t: string) => request("/stall-owner/foods", {}, t),
    sales: (t: string) => request("/stall-owner/sales", {}, t),
    share: (t: string) => request("/stall-owner/share", {}, t),
  },
};
