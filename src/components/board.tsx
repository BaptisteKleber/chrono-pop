import type { ReactNode } from "react"
import { type Chrono, fmt, phase, useTick } from "../clock"
import { useChronoSounds } from "../sound"

type Props = {
  chrono: Chrono | undefined
  /** Horloge de référence : celle du serveur, ou Date.now pour l'essai local */
  now: () => number
  /** Texte d'attente (pas de rotation lancée) et de fin */
  idleText: string
  doneText: string
  /** Sons du chrono (pas sur la télé) */
  sound?: boolean
  /** Petite version (téléphone de l'arbitre) */
  mini?: boolean
  head?: ReactNode
  foot?: ReactNode
}

/** Le grand chrono façon tableau des départs : décompte en vert, dernière minute en rouge qui clignote, fin en or */
export function ChronoBoard({ chrono, now, idleText, doneText, sound = true, mini, head, foot }: Props) {
  useTick(200)
  useChronoSounds(sound ? chrono : undefined, now)
  const p = phase(chrono, now())
  const dur = chrono?.duree_ms ?? 15 * 60_000

  let clock = fmt(dur)
  let status = idleText
  if (p.k === "pre") {
    clock = fmt((p.pre ?? 0) * 1000)
    status = `Départ dans ${p.pre}…`
  } else if (p.k === "run") {
    clock = fmt(p.rem)
    status = "Atelier en cours"
  } else if (p.k === "last") {
    clock = fmt(p.rem)
    status = "Dernière minute !"
  } else if (p.k === "done") {
    clock = "00:00"
    status = doneText
  }
  const width = p.k === "run" || p.k === "last" ? (1 - p.rem / dur) * 100 : p.k === "done" ? 100 : 0
  const cls = `${mini ? "card" : "board"}${p.k === "last" ? " last" : ""}${p.k === "done" ? " done" : ""}${p.k === "pre" ? " pre" : ""}`

  return (
    <section className={cls}>
      {head}
      <div className={mini ? "mini-clock" : "clock"}>{clock}</div>
      <div className="bar">
        <i style={{ width: `${width}%` }} />
      </div>
      <div className="status">{status}</div>
      {foot}
    </section>
  )
}
