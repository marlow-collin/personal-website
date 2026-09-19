import { buildAdminOverview } from "./overview.js";

const ADMIN_API_PREFIX = "/x/admin/api/";
const OVERVIEW_PATH = "/x/admin/api/overview";

function securityHeaders() {
  return {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet"
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...securityHeaders()
    }
  });
}


async function pokerRegistryList(env) {
  const id = env.POKER_LIVE_REGISTRY.idFromName("poker-sessions");
  const stub = env.POKER_LIVE_REGISTRY.get(id);
  const response = await stub.fetch(new Request("https://registry/list"));
  if (!response.ok) throw new Error("Poker session registry unavailable.");
  return response.json();
}

function pokerToken(){const a=new Uint8Array(24);crypto.getRandomValues(a);return btoa(String.fromCharCode(...a)).replace(/[+/=]/g,"").slice(0,32);}
async function registryFetch(env,path,options={}){const id=env.POKER_LIVE_REGISTRY.idFromName("poker-sessions"),stub=env.POKER_LIVE_REGISTRY.get(id);return stub.fetch(new Request(`https://registry${path}`,options));}
async function recoverPokerController(env,code,origin){const controllerToken=pokerToken(),id=env.POKER_LIVE.idFromName(code),stub=env.POKER_LIVE.get(id);const response=await stub.fetch(new Request("https://session/admin-recover",{method:"POST",headers:{"Content-Type":"application/json","X-Poker-Admin-Internal":"1"},body:JSON.stringify({controllerToken})}));if(!response.ok)throw new Error("Session konnte nicht wiederhergestellt werden.");return {code,controllerUrl:`${origin}/x/poker/live/?code=${code}#token=${controllerToken}`};}

function methodNotAllowed(allow) {
  return new Response(null, {
    status: 405,
    headers: {
      Allow: allow,
      ...securityHeaders()
    }
  });
}

export async function handleAdminRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (!path.startsWith(ADMIN_API_PREFIX)) return null;

  if (path === OVERVIEW_PATH) {
    if (request.method !== "GET") return methodNotAllowed("GET");
    return json(await buildAdminOverview(request, env));
  }

  if (path === "/x/admin/api/poker/sessions") {
    if (request.method === "GET") return json(await pokerRegistryList(env));
    if (request.method === "DELETE") { const r=await registryFetch(env,"/sessions",{method:"DELETE"}); return json(await r.json(),r.status); }
    return methodNotAllowed("GET, DELETE");
  }

  if (path === "/x/admin/api/poker/settings") {
    if (request.method === "GET") { const r=await registryFetch(env,"/settings"); return json(await r.json(),r.status); }
    if (request.method === "PUT") { const body=await request.text(); const r=await registryFetch(env,"/settings",{method:"PUT",headers:{"Content-Type":"application/json"},body}); return json(await r.json(),r.status); }
    return methodNotAllowed("GET, PUT");
  }

  const pokerSessionMatch=path.match(/^\/x\/admin\/api\/poker\/sessions\/([A-Z0-9]{6})(?:\/(recover))?$/);
  if (pokerSessionMatch) {
    const code=pokerSessionMatch[1],action=pokerSessionMatch[2];
    if (action==="recover") { if(request.method!=="POST")return methodNotAllowed("POST"); return json(await recoverPokerController(env,code,url.origin)); }
    if(request.method!=="DELETE")return methodNotAllowed("DELETE"); const r=await registryFetch(env,`/sessions/${code}`,{method:"DELETE"}); return json(await r.json(),r.status);
  }

  // Date, Daily, Check-in and Conversation admin endpoints are migrated in
  // later patches. Returning null keeps their current handlers reachable.
  return null;
}
