/**
 * Calls a server action from the browser and turns a thrown error (offline,
 * server restarted, timeout) into the same `{ ok: false, error }` shape the
 * actions already return, so every caller shows a message instead of hanging.
 */
export async function safeAction<T extends { ok: boolean }>(
  call: () => Promise<T>,
): Promise<T | { ok: false; error: string; field?: undefined }> {
  try {
    return await call();
  } catch (error) {
    console.error("action.failed", error);
    return { ok: false, error: "Could not reach the server. Check your connection and try again." };
  }
}
