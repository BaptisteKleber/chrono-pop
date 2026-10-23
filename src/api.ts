import { useSyncExternalStore } from "react"
import type { Role, ScoreInput, Sync } from "./types"

/**
 * Accès à l'API chrono-pop et polling de l'état du jeu.
 *
 * Le chrono n'est jamais transmis seconde par seconde : chaque écran reçoit l'heure de départ et la durée, puis compte
 * en local avec l'horloge du serveur. L'écart entre l'horloge de l'appareil et celle du serveur (offset) est mesuré à
 * chaque réponse, en gardant la mesure du plus court aller-retour (méthode de l'appli de Claire).
 */

export class ApiError extends Error {
  /** true : réseau ou serveur injoignable (la saisie peut être rejouée), false : refus de l'API */
  network: boolean
  constructor(message: string, network: boolean) {
    super(message)
    this.network = network
  }
  get pinRefused() {
    return !this.network && /PIN/i.test(this.message)
  }
}

// ---------- Stockage local (peut être indisponible : navigation privée, stockage bloqué) ----------

function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function lsSet(key: string, value: string | null) {
  try {
    if (value === null) {
      localStorage.removeItem(key)
    } else {
      localStorage.setItem(key, value)
    }
  } catch {
    // tant pis : la valeur ne survivra pas au rechargement
  }
}

export const getPin = (role: Role) => lsGet(`chrono-pop-pin-${role}`) ?? ""
export const setPin = (role: Role, pin: string | null) => lsSet(`chrono-pop-pin-${role}`, pin)

// ---------- Horloge du serveur ----------

let offset = 0
let bestRtt = 1e9

/** Heure du serveur, en ms epoch : la référence commune de tous les chronos */
export const serverNow = () => Date.now() + offset

function measureOffset(serverMs: number, t0: number, t1: number) {
  const rtt = t1 - t0
  // La meilleure mesure vieillit : une mesure récente un peu moins bonne finit par la remplacer (dérive de l'horloge)
  bestRtt += 20
  if (rtt <= bestRtt) {
    bestRtt = rtt
    offset = serverMs - (t0 + t1) / 2
  }
}

// ---------- Appels ----------

let ecranCourant = "menu"

async function call<T>(action: string, body?: unknown, pin?: string): Promise<T> {
  const headers: Record<string, string> = { "X-Chrono-Ecran": ecranCourant }
  if (pin) {
    headers["X-Chrono-Pin"] = pin
  }
  if (body !== undefined) {
    headers["Content-Type"] = "application/json"
  }
  const t0 = Date.now()
  let res: Response
  try {
    res = await fetch(`/api/${action}${action === "sync" ? `?ecran=${encodeURIComponent(ecranCourant)}` : ""}`, {
      method: body === undefined ? "GET" : "POST",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    })
  } catch {
    throw new ApiError("Connexion impossible : vérifiez le wifi de cet appareil.", true)
  }
  const t1 = Date.now()
  const json = (await res.json().catch(() => null)) as { error: boolean; messages?: string[]; data: T } | null
  if (!json) {
    throw new ApiError(`Serveur injoignable (HTTP ${res.status}).`, true)
  }
  if (json.error) {
    // L'Edge Function renvoie un statut HTTP d'erreur quand c'est l'API derrière qui ne répond pas
    throw new ApiError(json.messages?.join(" ") || "Erreur inconnue", res.status >= 500)
  }
  const data = json.data as T & { now?: number }
  if (data && typeof data === "object" && Number.isFinite(data.now)) {
    measureOffset(data.now as number, t0, t1)
  }
  return json.data
}

// ---------- État partagé par toute l'appli ----------

interface Store {
  sync: Sync | null
  /** Date.now() de la dernière réponse du serveur */
  lastOk: number
  /** Saisies de points en attente d'envoi (réseau coupé) */
  pending: number
  /** Dernière saisie en attente refusée par le serveur au moment du renvoi */
  queueError: string
}

let store: Store = { sync: null, lastOk: 0, pending: readQueue().length, queueError: "" }
const listeners = new Set<() => void>()

function setStore(patch: Partial<Store>) {
  store = { ...store, ...patch }
  listeners.forEach((l) => l())
}

/** Fait rafraîchir les écrans abonnés (le badge « connexion perdue » dépend du temps qui passe) */
setInterval(() => listeners.forEach((l) => l()), 2000)

export function useStore(): Store {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => store,
  )
}

export const isConnected = (s: Store) => s.lastOk > 0 && Date.now() - s.lastOk < 8000

function applySync(sync: Sync) {
  setStore({ sync, lastOk: Date.now() })
}

// ---------- Polling ----------

let pollTimer: number | undefined
let pollEvery = 2000
let polling = false

async function pollOnce() {
  if (polling) {
    return
  }
  polling = true
  try {
    applySync(await call<Sync>("sync"))
    await flushQueue()
  } catch {
    setStore({})
  } finally {
    polling = false
  }
}

function schedule() {
  window.clearTimeout(pollTimer)
  pollTimer = window.setTimeout(async () => {
    await pollOnce()
    schedule()
  }, pollEvery)
}

/** Démarre (ou règle) le polling pour l'écran affiché : son nom sert au suivi des écrans connectés de l'arbitre */
export function startPolling(ecran: string, everyMs: number) {
  ecranCourant = ecran
  pollEvery = everyMs
  pollOnce().then(schedule)
}

// Un onglet en arrière-plan voit ses timers ralentis par le navigateur : on se resynchronise dès qu'il revient
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    pollOnce()
  }
})

// ---------- Écritures ----------

async function write(action: string, body: unknown, role: Role): Promise<Sync> {
  const sync = await call<Sync>(action, body, getPin(role))
  applySync(sync)
  return sync
}

export const api = {
  login: (role: Role, pin: string) => call<Role>("login", { role }, pin),
  launch: (rotation: number, dureeMs: number) => write("launch", { rotation, duree_ms: dureeMs }, "admin"),
  stop: () => write("stop", {}, "admin"),
  bonus: (b: {
    equipe: string
    points_communs: boolean
    photo_grimace: boolean
    photo_accessoire: boolean
    photo_libre: boolean
  }) => write("bonus", b, "admin"),
  tv: (mode: string, revele: number) => write("tv", { mode, revele }, "admin"),
}

// ---------- Saisies des animateurs, avec file d'attente hors ligne ----------

const QUEUE_KEY = "chrono-pop-file-scores"

function readQueue(): ScoreInput[] {
  try {
    return JSON.parse(lsGet(QUEUE_KEY) ?? "[]") as ScoreInput[]
  } catch {
    return []
  }
}

function writeQueue(q: ScoreInput[]) {
  lsSet(QUEUE_KEY, q.length ? JSON.stringify(q) : null)
  setStore({ pending: q.length })
}

/** Le PIN de saisie : celui de l'animateur, ou celui de l'arbitre s'il saisit lui-même */
const scorePin = () => getPin("animateur") || getPin("admin")

/**
 * Enregistre des points. Réseau coupé : la saisie part dans la file locale (renvoyée au prochain sync réussi) et la
 * fonction renvoie "queued". Le serveur garde toujours la saisie la plus récente (saisi_client), un renvoi tardif
 * n'écrase donc pas une correction.
 */
export async function saveScore(s: ScoreInput): Promise<"saved" | "queued"> {
  try {
    applySync(await call<Sync>("score", s, scorePin()))
    return "saved"
  } catch (e) {
    if (e instanceof ApiError && e.network) {
      // Une seule saisie en attente par atelier et rotation : la dernière
      writeQueue([...readQueue().filter((q) => q.atelier !== s.atelier || q.rotation !== s.rotation), s])
      return "queued"
    }
    throw e
  }
}

let flushing = false

async function flushQueue() {
  if (flushing) {
    return
  }
  flushing = true
  try {
    for (const s of readQueue()) {
      try {
        applySync(await call<Sync>("score", s, scorePin()))
      } catch (e) {
        if (e instanceof ApiError && e.network) {
          return
        }
        // Refusée (PIN, barème) : on l'enlève pour ne pas bloquer la file, et on le dit
        setStore({ queueError: `Saisie atelier ${s.atelier} / rotation ${s.rotation} refusée : ${(e as Error).message}` })
      }
      // Retire cette saisie (pas une plus récente du même atelier, ajoutée pendant l'envoi)
      writeQueue(
        readQueue().filter(
          (q) => q.atelier !== s.atelier || q.rotation !== s.rotation || q.saisi_client !== s.saisi_client,
        ),
      )
    }
  } finally {
    flushing = false
  }
}
