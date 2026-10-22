export const WAKE_TIMEOUT_MS = 120000;

export interface WakeResult {
  ok: boolean;
  duration: number;
}

export async function wake(url: string, signal?: AbortSignal): Promise<WakeResult> {
  const started = performance.now();
  const timeout = AbortSignal.timeout(WAKE_TIMEOUT_MS);
  try {
    await fetch(url, {
      method: "GET",
      mode: "no-cors",
      cache: "no-store",
      credentials: "omit",
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    return { ok: true, duration: Math.round(performance.now() - started) };
  } catch {
    return { ok: false, duration: Math.round(performance.now() - started) };
  }
}

export function formatDuration(ms: number) {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}
