import { type CSSProperties, type FormEvent, type ReactNode, useState } from "react"
import { ApiError, api, getPin, isConnected, setPin, useStore } from "../api"
import { Link, usePath } from "../router"
import { unlockAudio, useSoundOn } from "../sound"
import type { Equipe, Role, Sync } from "../types"

/** Pastille ronde de l'équipe à sa couleur (avec son nom à partir de 48 px) */
export function Sticker({ equipe, size }: { equipe?: Equipe; size: number }) {
  const label = size >= 48 && equipe ? equipe.nom.replace("CLUB DE NUIT", "CLUB\nDE NUIT") : ""
  return (
    <span
      className="stk"
      style={{ "--c": equipe?.couleur ?? "#423c33", "--s": `${size}px`, whiteSpace: "pre-line" } as CSSProperties}
      aria-hidden="true"
    >
      {label && <span>{label}</span>}
    </span>
  )
}

/** Recherches dans l'état du jeu */
export const equipeOf = (sync: Sync | null, code: string | null | undefined) =>
  code ? sync?.equipes.find((e) => e.code === code) : undefined

export const equipeAt = (sync: Sync | null, atelier: number, rotation: number) =>
  equipeOf(sync, sync?.planning.find((p) => p.atelier === atelier && p.rotation === rotation)?.equipe)

export const scoreAt = (sync: Sync | null, atelier: number, rotation: number) =>
  sync?.scores.find((s) => s.atelier === atelier && s.rotation === rotation)

export const slotOf = (sync: Sync | null, rotation: number) => {
  const r = sync?.rotations.find((x) => x.n === rotation)
  return r ? `${r.debut} – ${r.fin}` : ""
}

/** Bandeau du haut : vol OB-0211, état de la connexion, son, changement d'écran */
export function Band({ withSound = true, extra }: { withSound?: boolean; extra?: ReactNode }) {
  const store = useStore()
  const soundOn = useSoundOn()
  const path = usePath()
  const ok = isConnected(store)
  const live = ok ? (
    <span className="chip live">Synchronisé</span>
  ) : store.lastOk ? (
    <span className="chip warn">Connexion perdue</span>
  ) : (
    <span className="chip">Connexion…</span>
  )
  return (
    <>
      <div className="band">
        <div className="flight">
          OIA BEAUTE · Oïa on air · vol <b>OB-0211</b> · destination Dubaï
        </div>
        <div className="band-r">
          {extra}
          {path !== "/test" && live}
          {store.pending > 0 && (
            <span className="chip warn">
              {store.pending} saisie{store.pending > 1 ? "s" : ""} en attente
            </span>
          )}
          {path !== "/test" && (
            <Link className="chip" to="/test">
              Tester chrono et son
            </Link>
          )}
          {withSound &&
            (soundOn ? (
              <span className="chip live">Son activé</span>
            ) : (
              <button className="chip" onClick={unlockAudio}>
                Activer le son
              </button>
            ))}
          {path !== "/" && (
            <Link className="chip" to="/">
              Changer d'écran
            </Link>
          )}
        </div>
      </div>
      {path !== "/test" && store.lastOk > 0 && !ok && (
        <div className="banner">
          Connexion au serveur perdue : vérifiez le wifi de cet appareil. Le chrono continue et se resynchronise tout
          seul dès le retour du réseau{store.pending > 0 ? ", les points en attente partiront aussi" : ""}.
        </div>
      )}
      {store.queueError && <div className="banner">{store.queueError}</div>}
    </>
  )
}

/** Overlay « Activer le son » : le navigateur exige un clic avant de jouer un son */
export function SoundOverlay() {
  const soundOn = useSoundOn()
  const [closed, setClosed] = useState(false)
  if (soundOn || closed) {
    return null
  }
  return (
    <div className="overlay">
      <div className="box">
        <div className="eyebrow">Avant l'embarquement</div>
        <h2>Activer le son de cet écran</h2>
        <p className="mute" style={{ margin: 0 }}>
          Le navigateur n'autorise le son qu'après un clic. Montez le volume : le décompte, le départ, la dernière
          minute et la fin sonneront ensuite automatiquement. À refaire si la page est rechargée.
        </p>
        <button className="btn big" onClick={unlockAudio}>
          Activer le son et continuer
        </button>
        <button className="btn ghost" onClick={() => setClosed(true)}>
          Continuer sans le son
        </button>
      </div>
    </div>
  )
}

/** Demande le code PIN du rôle une fois, le vérifie auprès du serveur et le garde sur l'appareil */
export function PinGate({ role, children }: { role: Role; children: ReactNode }) {
  const [ok, setOk] = useState(() => getPin(role) !== "" || (role === "animateur" && getPin("admin") !== ""))
  const [pin, setPinValue] = useState("")
  const [msg, setMsg] = useState("")
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg("")
    try {
      await api.login(role, pin)
      setPin(role, pin.trim())
      setOk(true)
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Vérification impossible")
    } finally {
      setBusy(false)
    }
  }

  if (ok) {
    return <>{children}</>
  }
  return (
    <div className="wrap narrow">
      <Band withSound={false} />
      <section className="card">
        <span className="eyebrow">{role === "admin" ? "Vue arbitre" : "Vue animateur"}</span>
        <h2>Code d'accès</h2>
        <p className="mute" style={{ margin: 0, fontSize: ".85rem" }}>
          {role === "admin"
            ? "Le code de l'arbitre, donné par l'organisation."
            : "Le code des animateurs, donné par l'organisation. Il reste enregistré sur cet appareil."}
        </p>
        <form className="field" onSubmit={submit}>
          <input
            className="pin-input"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            value={pin}
            onChange={(e) => setPinValue(e.target.value)}
          />
          <button className="btn" disabled={busy || pin.trim() === ""}>
            Entrer
          </button>
        </form>
        <div className={`msg${msg ? " err" : ""}`} role="status">
          {msg}
        </div>
      </section>
    </div>
  )
}

/** Oublie le PIN quand le serveur le refuse (changé en base) : l'écran le redemandera */
export function forgetPinIfRefused(err: unknown, role: Role) {
  if (err instanceof ApiError && err.pinRefused) {
    setPin(role, null)
    return true
  }
  return false
}
