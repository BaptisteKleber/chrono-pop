import { useState } from "react"
import { ChronoBoard } from "../components/board"
import { Band, SoundOverlay, Sticker } from "../components/common"
import { type Chrono, isRunning } from "../clock"
import { play, unlockAudio } from "../sound"

const DUREES: [number, string][] = [
  [30_000, "30 s"],
  [60_000, "1 min"],
  [120_000, "2 min"],
  [900_000, "15 min"],
]

const now = () => Date.now()
const LATTAFA = { code: "lattafa", nom: "LATTAFA", couleur: "#ED1C24", ordre: 1 }
const AJWAD = { code: "ajwad", nom: "AJWAD", couleur: "#F033A3", ordre: 8 }

/** Essai du chrono et des sons sur cet appareil seulement : rien n'est envoyé au serveur */
export function Test() {
  const [chrono, setChrono] = useState<Chrono>({ statut: "idle", start_at: 0, duree_ms: 60_000, epoch: 0 })
  const running = isRunning(chrono, now())

  return (
    <div className="wrap">
      <Band />
      <div className="gatebar">
        <div className="meta">
          <span className="eyebrow">Essai · cet appareil uniquement</span>
          <span className="svc">Tester le chrono et le son</span>
          <span className="mute">Les autres écrans ne sont pas déclenchés. Montez le volume de l'appareil.</span>
        </div>
      </div>
      <div className="stage">
        <ChronoBoard
          chrono={chrono}
          now={now}
          idleText="Prêt pour l'essai"
          doneText="Test terminé"
          head={
            <>
              <div className="rotline">
                <span>Rotation d'essai</span>
              </div>
              <div className="teamrow">
                <Sticker equipe={LATTAFA} size={140} />
                <div className="team">LATTAFA</div>
              </div>
            </>
          }
          foot={
            <div className="next">
              <span className="tn">
                Ensuite : <Sticker equipe={AJWAD} size={18} />
                <b>AJWAD</b>
              </span>
              <span>Exemple de l'atelier 1</span>
            </div>
          }
        />
        <section className="card">
          <h3>Lancer un essai</h3>
          <span className="lbl">Durée de l'essai</span>
          <div className="seg" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
            {DUREES.map(([ms, l]) => (
              <button key={ms} type="button" aria-pressed={chrono.duree_ms === ms} onClick={() => setChrono({ ...chrono, statut: "idle", duree_ms: ms })}>
                {l}
              </button>
            ))}
          </div>
          <p className="seghelp" style={{ margin: 0 }}>
            Avec 2 min ou 15 min, le carillon sonne à 1 minute de la fin, comme le jour J. Avec 30 s ou 1 min, il sonne à
            mi-parcours pour aller plus vite.
          </p>
          <div className="rowbtns">
            <button
              className="btn big"
              onClick={() => {
                unlockAudio()
                const t = Date.now()
                setChrono({ statut: "running", start_at: t + 10_000, duree_ms: chrono.duree_ms, epoch: t })
              }}
            >
              {running ? "Relancer l'essai" : "Lancer l'essai"}
            </button>
            {running && (
              <button className="btn ghost" onClick={() => setChrono({ ...chrono, statut: "idle" })}>
                Arrêter
              </button>
            )}
          </div>
          <span className="lbl">Écouter chaque son</span>
          <div className="rowbtns">
            <button
              className="btn ghost"
              onClick={() => {
                unlockAudio()
                ;[5, 4, 3, 2, 1].forEach((n, i) => setTimeout(() => play("pip", n), i * 1000))
              }}
            >
              Décompte
            </button>
            <button className="btn ghost" onClick={() => (unlockAudio(), play("start"))}>
              Départ
            </button>
          </div>
          <div className="rowbtns">
            <button className="btn ghost" onClick={() => (unlockAudio(), play("warn"))}>
              Dernière minute
            </button>
            <button className="btn ghost" onClick={() => (unlockAudio(), play("end"))}>
              Fin
            </button>
          </div>
        </section>
      </div>
      <SoundOverlay />
    </div>
  )
}
