// Relais /api/<action> → API chrono-pop (docker-2, derrière le proxy). Il garde le site et l'API sur la même origine
// (pas de CORS, rien que du 443 côté wifi du lieu) et ajoute la clé du proxy, qui ne passe jamais par le navigateur.
// Seules les actions de chrono-pop sont relayées : la clé ne peut pas servir sur le reste de l'API.

declare const Netlify: { env: { get(name: string): string | undefined } }

const ACTIONS = new Set(["health", "sync", "login", "launch", "stop", "score", "bonus", "tv"])

const json = (status: number, message: string) =>
  new Response(JSON.stringify({ error: true, messages: [message], data: null }), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  })

export default async (request: Request) => {
  const base = Netlify.env.get("CHRONO_API_URL")
  const key = Netlify.env.get("CHRONO_API_KEY")
  if (!base || !key) {
    return json(500, "CHRONO_API_URL ou CHRONO_API_KEY non configurée sur Netlify")
  }
  const url = new URL(request.url)
  const action = url.pathname.replace(/^\/api\//, "")
  if (!ACTIONS.has(action)) {
    return json(404, `Action inconnue : ${action}`)
  }

  const headers = new Headers({ "x-api-key": key, accept: "application/json" })
  for (const h of ["content-type", "x-chrono-pin", "x-chrono-ecran"]) {
    const v = request.headers.get(h)
    if (v) {
      headers.set(h, v)
    }
  }
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/${action}${url.search}`, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.text(),
    })
    return new Response(res.body, {
      status: res.status,
      headers: { "content-type": res.headers.get("content-type") ?? "application/json", "cache-control": "no-store" },
    })
  } catch (e) {
    return json(502, `API chrono-pop injoignable : ${e instanceof Error ? e.message : e}`)
  }
}

export const config = { path: "/api/*" }
