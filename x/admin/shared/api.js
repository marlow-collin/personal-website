export async function adminApi(path, options = {}) {
  const response = await fetch(`/x/admin/api${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `HTTP ${response.status}`);
  }

  return response.status === 204 ? null : response.json();
}
