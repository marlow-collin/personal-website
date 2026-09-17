const ACCESS_EMAIL_HEADER = "cf-access-authenticated-user-email";

function securityHeaders() {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet"
  };
}

export function getAdminAccessIdentity(request) {
  const email = String(request.headers.get(ACCESS_EMAIL_HEADER) || "").trim();
  return email || null;
}

export function requireAdminApiAccess(request) {
  const path = new URL(request.url).pathname;
  const isAdminApi = path === "/x/admin/api" || path.startsWith("/x/admin/api/");
  if (!isAdminApi) return null;
  if (getAdminAccessIdentity(request)) return null;

  return new Response(
    JSON.stringify({ error: "Cloudflare Access authentication required" }),
    { status: 403, headers: securityHeaders() }
  );
}
