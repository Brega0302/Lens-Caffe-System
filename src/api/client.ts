export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = sessionStorage.getItem("lensos.token");
  const headers = new Headers(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`/api${path}`, { ...options, headers });
  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401)
      window.dispatchEvent(new Event("lensos:unauthorized"));
    throw new ApiError(
      payload.message || "Zahtjev nije uspio.",
      response.status,
    );
  }
  if (options.method && options.method.toUpperCase() !== "GET")
    window.dispatchEvent(new Event("lensos:stock-changed"));
  return payload as T;
}

// Keep the key through a lost response or reload. Clear it only after confirmation.
export async function write<T = unknown>(
  path: string,
  body: unknown,
): Promise<T> {
  const serialized = JSON.stringify(body);
  const storageKey = `lensos.pending:${path}:${serialized}`;
  let key = sessionStorage.getItem(storageKey);
  if (!key) {
    key = crypto.randomUUID();
    sessionStorage.setItem(storageKey, key);
  }
  try {
    const result = await api<T>(path, {
      method: "POST",
      body: serialized,
      headers: { "Idempotency-Key": key },
    });
    sessionStorage.removeItem(storageKey);
    return result;
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.status >= 400 &&
      error.status < 500 &&
      error.status !== 409
    )
      sessionStorage.removeItem(storageKey);
    throw error;
  }
}
export const asMoney = (value: string | number) => {
  const [whole, fraction = "00"] = (
    typeof value === "number" ? value.toFixed(2) : value || "0.00"
  ).split(".");
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${fraction.padEnd(2, "0")} KM`;
};
export const localToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Sarajevo" }).format(
    new Date(),
  );
export const minor = (value: string) => {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
};
export const decimal = (value: bigint) => {
  const absolute = value < 0n ? -value : value;
  return `${value < 0n ? "-" : ""}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
};
