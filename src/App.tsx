import { useEffect } from "react"
import { startPolling } from "./api"
import { usePath } from "./router"
import { Admin } from "./views/admin"
import { Animateur } from "./views/animateur"
import { Home } from "./views/home"
import { Score } from "./views/score"
import { Test } from "./views/test"

/**
 * Une URL par écran : / (menu), /admin (arbitre), /animateur/1 à 8, /score (télé), /test (essai local).
 * Chaque écran polle l'état du jeu à son rythme et s'annonce sous son nom (suivi des écrans de l'arbitre).
 */
function route(path: string) {
  const anim = /^\/animateur\/(\d+)$/.exec(path)
  if (anim) {
    const n = Number(anim[1])
    return { ecran: `atelier-${n}`, every: 1000, view: <Animateur n={n} key={n} /> }
  }
  switch (path) {
    case "/admin":
      return { ecran: "admin", every: 1000, view: <Admin /> }
    case "/score":
      return { ecran: "tv", every: 2000, view: <Score /> }
    case "/test":
      return { ecran: "test", every: 5000, view: <Test /> }
    default:
      return { ecran: "menu", every: 3000, view: <Home /> }
  }
}

export function App() {
  const path = usePath()
  const r = route(path)
  useEffect(() => {
    startPolling(r.ecran, r.every)
  }, [r.ecran, r.every])
  return r.view
}
