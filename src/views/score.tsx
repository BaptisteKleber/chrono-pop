import { useEffect } from "react"
import { serverNow, useStore } from "../api"
import { ChronoBoard } from "../components/board"
import { Band, Sticker, equipeOf } from "../components/common"
import { requestWake } from "../sound"
import type { ClassementLigne, Sync } from "../types"

/**
 * Télé du classement, pilotée depuis la vue arbitre :
 * - masqué : le chrono de la rotation et les équipes, aucun score (le classement ne doit pas être vu pendant le jeu) ;
 * - en direct : la tour complète et le détail par atelier ;
 * - révélation : les équipes sont dévoilées une à une, de la dernière à la première.
 */
export function Score() {
  const { sync } = useStore()
  useEffect(() => {
    requestWake()
  }, [])

  if (!sync) {
    return (
      <div className="wrap tv">
        <Band withSound={false} />
        <p className="mute">Connexion au serveur…</p>
      </div>
    )
  }
  const mode = sync.etat.tv_mode
  return (
    <div className="wrap tv">
      <Band withSound={false} />
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div className="eyebrow">
          {mode === "masque" ? "Classement dévoilé à la fin du jeu" : `${sync.config.points_max} points maximum · 1 étage = ${sync.config.points_par_etage} points`}
        </div>
        <h1>
          La tour <span className="script">Burj Khalifa</span>
        </h1>
      </div>
      {mode === "masque" ? <Masque sync={sync} /> : <Tour sync={sync} revelation={mode === "revelation"} />}
      {mode === "live" && <Detail sync={sync} />}
    </div>
  )
}

function Masque({ sync }: { sync: Sync }) {
  const etat = sync.etat
  return (
    <>
      <ChronoBoard
        chrono={etat}
        now={serverNow}
        sound={false}
        idleText={etat.epoch ? `Rotation ${etat.rotation} terminée` : "Le jeu va commencer"}
        doneText={`Rotation ${etat.rotation} terminée`}
        head={
          <div className="rotline">
            <span>
              Rotation {etat.epoch ? etat.rotation : 1} / {sync.rotations.length}
            </span>
          </div>
        }
      />
      <div className="tv-teams">
        {sync.equipes.map((e) => (
          <span key={e.code} className="tn">
            <Sticker equipe={e} size={64} />
          </span>
        ))}
      </div>
    </>
  )
}

function Tour({ sync, revelation }: { sync: Sync; revelation: boolean }) {
  const n = sync.classement.length
  const revele = sync.etat.tv_revele
  const etagesMax = Math.floor(sync.config.points_max / sync.config.points_par_etage)
  // Révélation : seuls les `revele` derniers rangs sont visibles, la dernière dévoilée est mise en avant
  const visible = (l: ClassementLigne) => !revelation || l.rang > n - revele
  const derniere = revelation && revele > 0 ? n - revele + 1 : 0

  return (
    <div className="tower">
      {sync.classement.map((l) => {
        if (!visible(l)) {
          return (
            <div key={l.equipe} className="lane is-hidden">
              <div className="rk">{l.rang}</div>
              <Sticker size={52} />
              <div className="nm">?</div>
              <div className="pts">
                <b>···</b>
              </div>
            </div>
          )
        }
        const e = equipeOf(sync, l.equipe)
        return (
          <div
            key={l.equipe}
            className={`lane${l.rang === 1 && l.total > 0 ? " p1" : ""}${l.rang === derniere ? " is-revealed" : ""}`}
          >
            <div className="rk">{l.rang}</div>
            <Sticker equipe={e} size={52} />
            <div style={{ minWidth: 0 }}>
              <div className="nm">{e?.nom ?? l.equipe}</div>
              <div className="floors" aria-label={`${l.etages} étages sur ${etagesMax}`}>
                {Array.from({ length: etagesMax }, (_, k) => (
                  <i key={k} className={k < l.etages ? "on" : ""} />
                ))}
              </div>
            </div>
            <div className="pts">
              <b>{l.total}</b>
              <span>
                {l.etages} étage{l.etages > 1 ? "s" : ""} · {l.ateliers_faits}/{sync.ateliers.length} ateliers
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Detail({ sync }: { sync: Sync }) {
  return (
    <section className="card">
      <h3>Détail par atelier</h3>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>Équipe</th>
              {sync.ateliers.map((a) => (
                <th key={a.n} className="r" title={a.service}>
                  {a.n}
                </th>
              ))}
              <th className="r">Bonus</th>
              <th className="r">Total</th>
            </tr>
          </thead>
          <tbody>
            {sync.classement.map((l) => {
              const e = equipeOf(sync, l.equipe)
              return (
                <tr key={l.equipe}>
                  <td>
                    <b className="tn">
                      <Sticker equipe={e} size={16} />
                      {e?.nom}
                    </b>
                  </td>
                  {l.points.map((p, i) => (
                    <td key={i} className="r">
                      {p === null ? "·" : p}
                    </td>
                  ))}
                  <td className="r">{l.bonus}</td>
                  <td className="r">
                    <b>{l.total}</b>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="mute" style={{ margin: 0, fontSize: ".78rem" }}>
        {sync.ateliers.map((a) => `${a.n} ${a.service}`).join(" · ")} · égalité départagée par l'atelier{" "}
        {sync.ateliers.find((a) => a.n === sync.config.atelier_departage)?.service}
      </p>
    </section>
  )
}
