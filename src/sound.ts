import { useEffect, useRef, useSyncExternalStore } from "react"
import { type Chrono, warnMs } from "./clock"

/**
 * Sons de synthèse de l'appli de Claire (aucun fichier) : décompte, départ en gamme Hijaz, carillon de la dernière
 * minute, bol chantant de fin. Le navigateur n'autorise le son qu'après un clic sur la page : d'où l'overlay
 * « Activer le son », à refaire à chaque rechargement de l'écran.
 */

let ac: AudioContext | null = null
let master: GainNode | null = null
let soundOn = false
const soundListeners = new Set<() => void>()

export function useSoundOn() {
  return useSyncExternalStore(
    (l) => {
      soundListeners.add(l)
      return () => soundListeners.delete(l)
    },
    () => soundOn,
  )
}

// ---------- Écran toujours allumé ----------

let wakeLock: { release(): Promise<void> } | null = null

export async function requestWake() {
  try {
    const nav = navigator as Navigator & { wakeLock?: { request(type: "screen"): Promise<{ release(): Promise<void> }> } }
    if (nav.wakeLock && document.visibilityState === "visible") {
      wakeLock = await nav.wakeLock.request("screen")
    }
  } catch {
    // Wake Lock refusé (HTTP, batterie faible, navigateur trop ancien) : couper la veille dans les réglages
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    requestWake()
  }
})

export const hasWakeLock = () => wakeLock !== null

export function unlockAudio() {
  try {
    if (!ac) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      ac = new Ctx()
      const comp = ac.createDynamicsCompressor()
      master = ac.createGain()
      master.gain.value = 0.9
      master.connect(comp).connect(ac.destination)
    }
    ac.resume()
    soundOn = true
  } catch {
    soundOn = false
  }
  soundListeners.forEach((l) => l())
  requestWake()
}

// ---------- Instruments ----------

function tone(f: number, t: number, d: number, type: OscillatorType = "sine", vol = 0.3) {
  if (!ac || !master) return
  const o = ac.createOscillator()
  const g = ac.createGain()
  o.type = type
  o.frequency.setValueAtTime(f, t)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.015)
  g.gain.setValueAtTime(vol, t + Math.max(0.02, d - 0.08))
  g.gain.exponentialRampToValueAtTime(0.0001, t + d)
  o.connect(g).connect(master)
  o.start(t)
  o.stop(t + d + 0.05)
}

let noiseBuf: AudioBuffer | null = null
function noise(ctx: AudioContext) {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  return noiseBuf
}

function burst(t: number, dur: number, vol: number, type: BiquadFilterType, freq: number, q = 1) {
  if (!ac || !master) return
  const src = ac.createBufferSource()
  src.buffer = noise(ac)
  const f = ac.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  f.Q.value = q
  const g = ac.createGain()
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(f).connect(g).connect(master)
  src.start(t)
  src.stop(t + dur + 0.02)
}

function zill(t: number, v = 1) {
  ;[2637, 3951, 5274].forEach((f, i) => tone(f, t, 1.2 - i * 0.3, "sine", 0.07 * v))
  burst(t, 0.03, 0.2 * v, "highpass", 6000)
}

// Gamme Hijaz sur ré : ré mi♭ fa♯ sol la si♭ do ré
const H = { D4: 293.66, Eb4: 311.13, Fs4: 369.99, G4: 392, A4: 440, D5: 587.33, A3: 220, D3: 146.83 }

/** Corde pincée douce (harpe / oud feutré) */
function soft(f: number, t: number, dur: number, vol = 0.2) {
  if (!ac || !master) return
  const o = ac.createOscillator()
  const o2 = ac.createOscillator()
  const lp = ac.createBiquadFilter()
  const g = ac.createGain()
  const g2 = ac.createGain()
  o.type = "triangle"
  o2.type = "sine"
  o.frequency.value = f
  o2.frequency.value = f * 2
  lp.type = "lowpass"
  lp.Q.value = 0.7
  lp.frequency.setValueAtTime(f * 5, t)
  lp.frequency.exponentialRampToValueAtTime(f * 1.5, t + dur * 0.7)
  g2.gain.value = 0.25
  o2.connect(g2).connect(lp)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.015)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(lp)
  lp.connect(g).connect(master)
  o.start(t)
  o2.start(t)
  o.stop(t + dur + 0.05)
  o2.stop(t + dur + 0.05)
}

/** Nappe chaude qui monte et s'éteint lentement */
function pad(fs: number[], t: number, dur: number, vol: number) {
  fs.forEach((f) => {
    if (!ac || !master) return
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.type = "sine"
    o.frequency.value = f
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + 0.6)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g).connect(master)
    o.start(t)
    o.stop(t + dur + 0.05)
  })
}

/** Bol chantant */
function bowl(t: number, f: number, v = 1) {
  ;[
    [1, 0.16],
    [2.71, 0.06],
    [5.1, 0.025],
  ].forEach(([m, a]) => {
    if (!ac || !master) return
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.type = "sine"
    o.frequency.value = f * (m as number)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime((a as number) * v, t + 0.05)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 4.5)
    o.connect(g).connect(master)
    o.start(t)
    o.stop(t + 4.6)
  })
}

export type SoundKind = "pip" | "start" | "warn" | "end"

export function play(kind: SoundKind, n = 0) {
  if (!ac || !soundOn) return
  const t = ac.currentTime + 0.03
  if (kind === "pip") {
    // Décompte classique : bip aigu sur les 3 dernières secondes
    tone(n <= 3 ? 1175 : 880, t, n <= 3 ? 0.18 : 0.12, "square", n <= 3 ? 0.24 : 0.16)
  }
  if (kind === "start") {
    // Arpège lumineux en gamme Hijaz, puis accord tenu
    ;(
      [
        ["D4", 0],
        ["Fs4", 0.16],
        ["A4", 0.32],
        ["D5", 0.48],
      ] as const
    ).forEach(([k, o]) => soft(H[k], t + o, 1.6, 0.2))
    pad([H.D4, H.A4, H.D5], t + 0.5, 3.2, 0.05)
    zill(t + 0.48, 0.35)
  }
  if (kind === "warn") {
    // Carillon doux : deux notes, une seule fois
    soft(H.A4, t, 1.6, 0.22)
    soft(H.Fs4, t + 0.55, 2, 0.22)
    zill(t, 0.25)
    pad([H.D4, H.A4], t + 0.4, 2.4, 0.035)
  }
  if (kind === "end") {
    // Bol chantant + phrase descendante qui se pose
    bowl(t, H.D4, 1.2)
    ;(
      [
        ["A4", 0.3],
        ["G4", 0.6],
        ["Fs4", 0.9],
        ["Eb4", 1.2],
        ["D4", 1.6],
      ] as const
    ).forEach(([k, o]) => soft(H[k], t + o, o > 1.5 ? 2.6 : 1.2, 0.2))
    pad([H.D3, H.A3, H.D4], t + 1.6, 3.5, 0.05)
  }
}

/**
 * Déclenche les sons d'un chrono au bon moment : décompte des 10 dernières secondes, départ, dernière minute, fin.
 * Chaque son ne sonne qu'une fois par lancement (epoch), et pas s'il est passé depuis trop longtemps (écran rechargé
 * en pleine rotation : pas de fanfare de départ en retard).
 */
export function useChronoSounds(chrono: Chrono | undefined, now: () => number) {
  const fired = useRef<Record<string, Record<string, boolean>>>({})
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!chrono || chrono.statut !== "running" || !chrono.epoch) return
      const f = (fired.current[chrono.epoch] ??= {})
      const t = now()
      const start = chrono.start_at
      const end = start + chrono.duree_ms
      const warn = end - warnMs(chrono)
      for (let n = 10; n >= 1; n--) {
        const at = start - n * 1000
        if (!f[`p${n}`] && t >= at) {
          f[`p${n}`] = true
          if (t - at < 900 && t < start) play("pip", n)
        }
      }
      if (!f.s && t >= start) {
        f.s = true
        if (t - start < 20_000) play("start")
      }
      if (!f.w && t >= warn) {
        f.w = true
        if (t - warn < 5000 && warn > start) play("warn")
      }
      if (!f.e && t >= end) {
        f.e = true
        if (t - end < 5000) play("end")
      }
    }, 100)
    return () => window.clearInterval(id)
  }, [chrono?.statut, chrono?.epoch, chrono?.start_at, chrono?.duree_ms, now])
}
