import { useEffect, useState } from "react"

/** Ce qu'il faut d'un chrono pour l'afficher : l'état du serveur, ou l'essai local de la vue test */
export interface Chrono {
  statut: "idle" | "running"
  start_at: number
  duree_ms: number
  epoch: number
}

export type PhaseKind = "idle" | "pre" | "run" | "last" | "done"

export interface Phase {
  k: PhaseKind
  /** Temps restant (ms) */
  rem: number
  /** Secondes avant le départ, pendant le décompte */
  pre?: number
}

/** Dernière minute : 1 min avant la fin (mi-parcours pour un essai de moins de 2 min) */
export const warnMs = (c: Chrono) => Math.min(60_000, c.duree_ms / 2)

export function phase(c: Chrono | undefined, t: number): Phase {
  if (!c || c.statut !== "running") {
    return { k: "idle", rem: c?.duree_ms ?? 15 * 60_000 }
  }
  const end = c.start_at + c.duree_ms
  if (t < c.start_at) {
    return { k: "pre", rem: c.duree_ms, pre: Math.ceil((c.start_at - t) / 1000) }
  }
  if (t >= end) {
    return { k: "done", rem: 0 }
  }
  return { k: t >= end - warnMs(c) ? "last" : "run", rem: end - t }
}

/** Une rotation en cours (décompte compris) : la relancer demande une confirmation */
export const isRunning = (c: Chrono | undefined, t: number) => ["pre", "run", "last"].includes(phase(c, t).k)

export function fmt(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`
}

/** Re-rend le composant toutes les `everyMs` : l'aiguille des chronos */
export function useTick(everyMs = 200) {
  const [, setT] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setT((t) => t + 1), everyMs)
    return () => window.clearInterval(id)
  }, [everyMs])
}
