import { type CSSProperties, useEffect, useRef, useState } from "react"
import { ApiError, api, serverNow, useStore } from "../api"
import { ChronoBoard } from "../components/board"
import { Band, PinGate, SoundOverlay, Sticker, equipeAt, equipeOf, forgetPinIfRefused, scoreAt, slotOf } from "../components/common"
import { isRunning, phase, useTick } from "../clock"
import { Link } from "../router"
import type { Bonus, Sync, TvMode } from "../types"

export function Admin() {
  return (
    <PinGate role="admin">
      <AdminView />
      <SoundOverlay />
    </PinGate>
  )
}

/** Exécute une action de l'arbitre et affiche son résultat (PIN refusé : on le redemande) */
function useAction() {
  const [msg, setMsg] = useState<{ text: string; err?: boolean }>({ text: "" })
  async function run(fn: () => Promise<unknown>, ok?: string) {
    try {
      await fn()
      setMsg({ text: ok ?? "" })
    } catch (e) {
      if (forgetPinIfRefused(e, "admin")) {
        window.location.reload()
        return
      }
      setMsg({ text: e instanceof ApiError ? e.message : String(e), err: true })
    }
  }
  return { msg, run }
}

function AdminView() {
  useTick(500)
  const { sync } = useStore()
  const { msg, run } = useAction()
  const [arbRot, setArbRot] = useState<number | null>(null)
  const [duree, setDuree] = useState("")
  const [confirm, setConfirm] = useState(false)
  const lastPhase = useRef("")

  const etat = sync?.etat
  const nbRot = sync?.rotations.length ?? 8
  const k = phase(etat, serverNow()).k

  // Rotation proposée : celle en cours, puis la suivante dès que la rotation est terminée
  useEffect(() => {
    if (!etat) return
    if (arbRot === null) {
      setArbRot(etat.statut === "running" ? Math.min(nbRot, etat.rotation + (k === "done" ? 1 : 0)) : etat.epoch ? etat.rotation : 1)
    } else if (k !== lastPhase.current && k === "done" && arbRot === etat.rotation && arbRot < nbRot) {
      setArbRot(arbRot + 1)
    }
    lastPhase.current = k
  }, [k, etat?.rotation, etat?.statut])

  useEffect(() => {
    if (sync && duree === "") {
      setDuree(String(Math.round(sync.etat.duree_ms / 60_000) || sync.config.duree_defaut_min))
    }
  }, [sync === null])

  if (!sync || !etat || arbRot === null) {
    return (
      <div className="wrap narrow">
        <Band />
        <p className="mute">Connexion au serveur…</p>
      </div>
    )
  }

  const running = isRunning(etat, serverNow())
  const complete = (r: number) => sync.ateliers.every((a) => scoreAt(sync, a.n, r) || !equipeAt(sync, a.n, r))
  const launch = () => {
    const min = Math.max(1, Math.min(60, Math.round(Number(duree) || sync.config.duree_defaut_min)))
    setConfirm(false)
    run(() => api.launch(arbRot, min * 60_000), `Rotation ${arbRot} lancée : départ dans 10 secondes.`)
  }

  return (
    <div className="wrap narrow">
      <Band />
      <div>
        <div className="eyebrow">Vue arbitre</div>
        <h1>
          Tour de <span className="script">contrôle</span>
        </h1>
      </div>

      <ChronoBoard
        mini
        chrono={etat}
        now={serverNow}
        idleText="Prêt"
        doneText={`Rotation ${etat.rotation} terminée`}
        head={
          <div className="rotline">
            <span>Rotation en cours : {etat.epoch ? etat.rotation : "—"}</span>
            <span className="num">{etat.epoch ? slotOf(sync, etat.rotation) : ""}</span>
          </div>
        }
      />

      <section className="card">
        <span className="lbl">Rotation à lancer</span>
        <div className="rots" style={{ gridTemplateColumns: `repeat(${nbRot},1fr)` }}>
          {sync.rotations.map((r) => (
            <button
              key={r.n}
              aria-pressed={r.n === arbRot}
              className={complete(r.n) ? "complete" : ""}
              onClick={() => {
                setArbRot(r.n)
                setConfirm(false)
              }}
            >
              {r.n}
            </button>
          ))}
        </div>
        <div className="field">
          <label htmlFor="dur">Durée de l'atelier (minutes)</label>
          <input id="dur" type="number" min={1} max={60} value={duree} onChange={(e) => setDuree(e.target.value)} />
        </div>
        {confirm ? (
          <div className="confirm">
            <span>Une rotation est en cours. La relancer remet tous les chronos à zéro.</span>
            <div className="rowbtns">
              <button className="btn" onClick={launch}>
                Relancer la rotation {arbRot}
              </button>
              <button className="btn ghost" onClick={() => setConfirm(false)}>
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <div className="rowbtns">
            <button className="btn big" onClick={() => (running ? setConfirm(true) : launch())}>
              Lancer la rotation {arbRot}
            </button>
            {running && (
              <button className="btn ghost" onClick={() => run(api.stop, "Rotation arrêtée.")}>
                Arrêter
              </button>
            )}
          </div>
        )}
        <p className="mute" style={{ margin: 0, fontSize: ".8rem" }}>
          Décompte sonore de 10 secondes, puis départ sur tous les écrans en même temps. Dernière minute et fin sonnent
          automatiquement.
        </p>
        <div className={`msg${msg.err ? " err" : ""}`} role="status">
          {msg.text}
        </div>
      </section>

      <section className="card">
        <h3>Saisies — rotation {arbRot}</h3>
        <div className="list">
          {sync.ateliers.map((a) => {
            const s = scoreAt(sync, a.n, arbRot)
            const team = equipeAt(sync, a.n, arbRot)
            return (
              <div className="it" key={a.n}>
                <span className="g">{a.n}</span>
                <span className="tn" style={{ minWidth: 0, flexWrap: "wrap" }}>
                  {a.service} · <Sticker equipe={team} size={18} />
                  <b>{team?.nom ?? "—"}</b>
                </span>
                {s ? <span className="pill ok">{s.total} pts</span> : <span className="pill wait">en attente</span>}
              </div>
            )
          })}
        </div>
      </section>

      <Ecrans sync={sync} />
      <Tele sync={sync} run={run} />
      <BonusCard sync={sync} run={run} />

      <div className="rowbtns">
        <Link className="btn ghost" to="/score" style={{ textAlign: "center", textDecoration: "none" }}>
          Voir le classement
        </Link>
      </div>

      <section className="card">
        <h3>Avant le jour J</h3>
        <p className="mute" style={{ margin: 0, fontSize: ".85rem" }}>
          Pour une répétition, mettez 1 minute et lancez une rotation. La remise à zéro (scores, bonus, chrono) se fait
          par l'informatique avec le script <b>reset.sql</b>, qui archive la partie avant de l'effacer.
        </p>
        <button className="btn ghost" onClick={() => exportCsv(sync)}>
          Exporter les scores (CSV)
        </button>
      </section>
    </div>
  )
}

/** Écrans connectés : chaque écran se signale à chaque sync. Vert < 5 s, orange < 30 s, rouge au-delà ou jamais vu */
function Ecrans({ sync }: { sync: Sync }) {
  const attendus = [...sync.ateliers.map((a) => `atelier-${a.n}`), "tv"]
  const vu = (e: string) => sync.ecrans.find((x) => x.ecran === e)?.vu_il_y_a_ms
  const etat = (ms?: number) => (ms === undefined ? "off" : ms < 5000 ? "ok" : ms < 30_000 ? "slow" : "off")
  return (
    <section className="card">
      <h3>Écrans connectés</h3>
      <div className="ecrans">
        {attendus.map((e) => {
          const ms = vu(e)
          return (
            <span key={e} className={`ecran is-${etat(ms)}`} title={ms === undefined ? "Jamais vu" : `Vu il y a ${Math.round(ms / 1000)} s`}>
              <i />
              {e === "tv" ? "Télé" : `Atelier ${e.replace("atelier-", "")}`}
            </span>
          )
        })}
      </div>
      <p className="seghelp" style={{ margin: 0 }}>
        Vert : à jour · orange : en retard (onglet en arrière-plan, wifi faible) · rouge : écran fermé ou hors réseau
      </p>
    </section>
  )
}

/** Télé du classement : masquée pendant le jeu, en direct, ou révélation de la dernière à la première équipe */
function Tele({ sync, run }: { sync: Sync; run: (fn: () => Promise<unknown>, ok?: string) => Promise<void> }) {
  const { tv_mode: mode, tv_revele: revele } = sync.etat
  const n = sync.classement.length
  const prochaine = n - revele >= 1 ? sync.classement[n - revele - 1] : undefined
  const modes: [TvMode, string][] = [
    ["masque", "Masqué"],
    ["live", "En direct"],
    ["revelation", "Révélation"],
  ]
  return (
    <section className="card">
      <h3>Télé du classement</h3>
      <div className="seg">
        {modes.map(([m, l]) => (
          <button key={m} type="button" aria-pressed={mode === m} onClick={() => run(() => api.tv(m, m === "revelation" ? revele : 0))}>
            {l}
          </button>
        ))}
      </div>
      {mode === "revelation" ? (
        <>
          <p className="mute" style={{ margin: 0, fontSize: ".85rem" }}>
            {revele} équipe{revele > 1 ? "s" : ""} dévoilée{revele > 1 ? "s" : ""} sur {n}, de la dernière à la première.
            {prochaine && (
              <>
                {" "}
                Prochaine : <b>{prochaine.rang}e</b> ({equipeOf(sync, prochaine.equipe)?.nom}, {prochaine.total} pts).
              </>
            )}
          </p>
          <div className="rowbtns">
            <button className="btn" disabled={revele >= n} onClick={() => run(() => api.tv("revelation", revele + 1))}>
              {revele >= n - 1 ? "Révéler le vainqueur" : "Révéler l'équipe suivante"}
            </button>
            <button className="btn ghost" disabled={revele === 0} onClick={() => run(() => api.tv("revelation", 0))}>
              Tout recacher
            </button>
          </div>
        </>
      ) : (
        <p className="mute" style={{ margin: 0, fontSize: ".85rem" }}>
          {mode === "masque"
            ? "La télé affiche le chrono de la rotation, sans aucun score."
            : "La télé affiche le classement complet, mis à jour à chaque saisie."}
        </p>
      )}
    </section>
  )
}

function BonusCard({ sync, run }: { sync: Sync; run: (fn: () => Promise<unknown>, ok?: string) => Promise<void> }) {
  const toggle = (b: Bonus, key: keyof Omit<Bonus, "equipe" | "total">) =>
    run(() => api.bonus({ ...b, [key]: !b[key] }))
  return (
    <section className="card">
      <h3>Bonus transverses</h3>
      <p className="mute" style={{ margin: 0, fontSize: ".8rem" }}>
        <b>Bonus 1 : Points communs</b> — 10 pts si l'équipe trouve ses 3 points communs au déjeuner.
        <br />
        <b>Bonus 2 : Photos photobooth</b> — 5 pts par photo imposée : grimace, accessoire, libre (15 pts).
      </p>
      <div className="list bonus">
        {sync.equipes.map((e) => {
          const b: Bonus = sync.bonus.find((x) => x.equipe === e.code) ?? {
            equipe: e.code,
            points_communs: false,
            photo_grimace: false,
            photo_accessoire: false,
            photo_libre: false,
            total: 0,
          }
          const photos: [keyof Bonus, string][] = [
            ["photo_grimace", "Grimace"],
            ["photo_accessoire", "Accessoire"],
            ["photo_libre", "Libre"],
          ]
          return (
            <div className="it" key={e.code}>
              <b className="tn">
                <Sticker equipe={e} size={18} />
                {e.nom}
              </b>
              <span className={`pill ${b.total ? "ok" : "wait"}`}>{b.total} / 25</span>
              <div className="bchips">
                <div className="bgrp">
                  <span className="bh">Bonus 1</span>
                  <div className="bopts" style={{ "--n": 1 } as CSSProperties}>
                    <label>
                      <input type="checkbox" checked={b.points_communs} onChange={() => toggle(b, "points_communs")} />
                      Points communs<small>10 pts</small>
                    </label>
                  </div>
                </div>
                <div className="bgrp">
                  <span className="bh">Bonus 2 · Photos photobooth</span>
                  <div className="bopts" style={{ "--n": 3 } as CSSProperties}>
                    {photos.map(([k, l]) => (
                      <label key={k}>
                        <input type="checkbox" checked={!!b[k]} onChange={() => toggle(b, k as "photo_grimace")} />
                        {l}
                        <small>5 pts</small>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

/** Scores et classement en CSV (séparateur ; pour Excel), pour la trace et le discours de fin */
function exportCsv(sync: Sync) {
  const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
  const head = ["Rang", "Équipe", ...sync.ateliers.map((a) => `${a.n} ${a.service}`), "Bonus", "Total", "Étages"]
  const rows = sync.classement.map((l) => [
    l.rang,
    equipeOf(sync, l.equipe)?.nom ?? l.equipe,
    ...l.points.map((p) => (p === null ? "" : p)),
    l.bonus,
    l.total,
    l.etages,
  ])
  const csv = "﻿" + [head, ...rows].map((r) => r.map(cell).join(";")).join("\r\n")
  const a = document.createElement("a")
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
  a.download = `classement-pop-in-dubai-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
