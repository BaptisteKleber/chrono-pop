import { useEffect, useState } from "react"
import { ApiError, saveScore, serverNow, useStore } from "../api"
import { ChronoBoard } from "../components/board"
import { Band, PinGate, SoundOverlay, Sticker, equipeAt, forgetPinIfRefused, scoreAt, slotOf } from "../components/common"
import { phase, useTick } from "../clock"

const clamp = (x: string | number, max: number) => Math.max(0, Math.min(max, Math.round(Number(x) || 0)))

export function Animateur({ n }: { n: number }) {
  return (
    <PinGate role="animateur">
      <AnimateurView n={n} />
      <SoundOverlay />
    </PinGate>
  )
}

function AnimateurView({ n }: { n: number }) {
  const { sync } = useStore()
  const atelier = sync?.ateliers.find((a) => a.n === n)
  if (!sync) {
    return (
      <div className="wrap">
        <Band />
        <p className="mute">Connexion au serveur…</p>
      </div>
    )
  }
  if (!atelier) {
    return (
      <div className="wrap">
        <Band />
        <p className="mute">Atelier {n} inconnu.</p>
      </div>
    )
  }
  const r = sync.etat.rotation
  const team = equipeAt(sync, n, r)
  const next = r < sync.rotations.length ? equipeAt(sync, n, r + 1) : undefined

  return (
    <div className="wrap">
      <Band />
      <div className="gatebar">
        <div className="meta">
          <span className="eyebrow">Vue animateur · Atelier {n}</span>
          <span className="svc">{atelier.service}</span>
          <span className="mute">Animation : {atelier.animateur}</span>
        </div>
      </div>
      <div className="stage">
        <ChronoBoard
          chrono={sync.etat}
          now={serverNow}
          idleText="En attente du signal de l'arbitre"
          doneText="Temps écoulé — saisissez les points"
          head={
            <>
              <div className="rotline">
                <span>
                  Rotation {r} / {sync.rotations.length}
                </span>
                <span className="num">{slotOf(sync, r)}</span>
              </div>
              <div className="teamrow">
                <Sticker equipe={team} size={140} />
                <div className="team">{team?.nom ?? "Pas d'équipe"}</div>
              </div>
            </>
          }
          foot={
            <div className="next">
              <span className="tn">
                Ensuite : {next && <Sticker equipe={next} size={18} />}
                <b>{next?.nom ?? "fin du jeu"}</b>
              </span>
              <span>Durée {Math.round(sync.etat.duree_ms / 60_000)} min</span>
            </div>
          }
        />
        <ScoreCard n={n} />
      </div>
    </div>
  )
}

function ScoreCard({ n }: { n: number }) {
  useTick(500)
  const { sync } = useStore()
  const current = sync?.etat.rotation ?? 1
  const [formRot, setFormRot] = useState(current)
  const [dirty, setDirty] = useState(false)
  const [perf, setPerf] = useState("")
  const [bonus, setBonus] = useState("")
  const [esprit, setEsprit] = useState<number | null>(null)
  const [msg, setMsg] = useState<{ text: string; err?: boolean }>({ text: "" })
  const [busy, setBusy] = useState(false)

  // Nouvelle rotation lancée : le formulaire la suit, sauf saisie en cours
  useEffect(() => {
    if (!dirty) {
      setFormRot(current)
    }
  }, [current])

  // Points déjà enregistrés pour la rotation choisie (ou saisis depuis un autre écran)
  const saved = scoreAt(sync, n, formRot)
  useEffect(() => {
    if (!dirty) {
      setPerf(saved ? String(saved.perf) : "")
      setBonus(saved ? String(saved.bonus) : "")
      setEsprit(saved ? saved.esprit : null)
    }
  }, [formRot, saved?.saisi_client, dirty])

  if (!sync) return null
  const team = equipeAt(sync, n, formRot)
  const total = clamp(perf, 60) + clamp(bonus, 20) + (esprit ?? 0)
  const done = phase(sync.etat, serverNow()).k === "done"

  const edit = (fn: () => void) => {
    fn()
    setDirty(true)
    setMsg({ text: "" })
  }

  async function save() {
    if (perf === "" || esprit === null) {
      setMsg({ text: "Renseignez la performance et l'esprit d'équipe.", err: true })
      return
    }
    setBusy(true)
    try {
      const res = await saveScore({
        atelier: n,
        rotation: formRot,
        perf: clamp(perf, 60),
        bonus: clamp(bonus, 20),
        esprit,
        saisi_client: serverNow(),
      })
      setDirty(false)
      setMsg(
        res === "saved"
          ? { text: `${team?.nom ?? "Équipe"} : ${total} points enregistrés.` }
          : { text: "Pas de réseau : points gardés sur cet appareil, ils partiront tout seuls au retour du réseau.", err: true },
      )
    } catch (e) {
      if (forgetPinIfRefused(e, "animateur")) {
        window.location.reload()
        return
      }
      setMsg({ text: `Enregistrement refusé : ${e instanceof ApiError ? e.message : e}`, err: true })
    } finally {
      setBusy(false)
    }
  }

  const step = (set: (v: string) => void, v: string, d: number, max: number) => edit(() => set(String(clamp(clamp(v, max) + d, max))))

  return (
    <section className={`card${done ? " focus" : ""}`}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
        <h3>Points de l'équipe</h3>
        <span className="mute" style={{ fontSize: ".8rem" }}>
          barème 60 · 20 · 20
        </span>
      </div>
      <div className="field">
        <label htmlFor="f-rot">Rotation</label>
        <select
          id="f-rot"
          value={formRot}
          onChange={(e) => {
            setFormRot(Number(e.target.value))
            setDirty(false)
            setMsg({ text: "" })
          }}
        >
          {sync.rotations.map((r) => (
            <option key={r.n} value={r.n}>
              Rotation {r.n} — {equipeAt(sync, n, r.n)?.nom ?? "pas d'équipe"}
              {scoreAt(sync, n, r.n) ? " ✓" : ""}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="f-perf">Performance</label>
        <div className="row">
          <button className="step" aria-label="moins 5" onClick={() => step(setPerf, perf, -5, 60)}>
            −
          </button>
          <input id="f-perf" type="number" min={0} max={60} inputMode="numeric" value={perf} onChange={(e) => edit(() => setPerf(e.target.value))} />
          <button className="step" aria-label="plus 5" onClick={() => step(setPerf, perf, 5, 60)}>
            +
          </button>
          <span className="max">/ 60</span>
        </div>
      </div>
      <div className="field">
        <label htmlFor="f-bonus">Bonus (rapidité, créativité, audace)</label>
        <div className="row">
          <button className="step" aria-label="moins 5" onClick={() => step(setBonus, bonus, -5, 20)}>
            −
          </button>
          <input id="f-bonus" type="number" min={0} max={20} inputMode="numeric" value={bonus} onChange={(e) => edit(() => setBonus(e.target.value))} />
          <button className="step" aria-label="plus 5" onClick={() => step(setBonus, bonus, 5, 20)}>
            +
          </button>
          <span className="max">/ 20</span>
        </div>
      </div>
      <div className="field">
        <span className="lbl">Esprit d'équipe</span>
        <div className="seg" role="group" aria-label="Esprit d'équipe">
          {[0, 10, 20].map((x) => (
            <button key={x} type="button" aria-pressed={esprit === x} onClick={() => edit(() => setEsprit(x))}>
              {x}
            </button>
          ))}
        </div>
        <div className="seghelp">
          20 : tout le monde participe · 10 : deux ou trois portent l'atelier · 0 : une seule personne ou l'équipe
          abandonne
        </div>
      </div>
      <div className="total">
        <span className="lbl tn">
          <Sticker equipe={team} size={22} />
          Total {team?.nom ?? ""}
        </span>
        <b>{total}</b>
      </div>
      <button className="btn" disabled={busy || !team} onClick={save}>
        {saved && !dirty ? "Points enregistrés · modifier" : "Enregistrer les points"}
      </button>
      <div className={`msg${msg.err ? " err" : ""}`} role="status">
        {msg.text}
      </div>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>Rot.</th>
              <th>Équipe</th>
              <th className="r">Pts</th>
            </tr>
          </thead>
          <tbody>
            {sync.rotations.map((r) => {
              const s = scoreAt(sync, n, r.n)
              return (
                <tr key={r.n} className={r.n === current ? "cur" : ""}>
                  <td className="num">{r.n}</td>
                  <td>{equipeAt(sync, n, r.n)?.nom ?? "—"}</td>
                  <td className="r">{s ? s.total : "—"}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
