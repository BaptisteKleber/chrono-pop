import { useStore } from "../api"
import { Band } from "../components/common"
import { Link } from "../router"

export function Home() {
  const { sync } = useStore()
  return (
    <div className="wrap">
      <Band withSound={false} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div className="eyebrow">{sync?.config.libelle_date ?? "Lundi 2 novembre · 15h15 – 18h"}</div>
        <h1>
          <span className="script">Pop in Dubaï</span>
          <br />
          Chrono des ateliers
        </h1>
        <p className="mute" style={{ maxWidth: "62ch", margin: 0 }}>
          Choisissez la vue de cet appareil. L'arbitre lance chaque rotation depuis son téléphone : les 8 ateliers
          démarrent après un décompte de 10 secondes, sonnent la dernière minute et s'arrêtent en même temps.
        </p>
      </div>
      <div className="pick">
        <Link className="feature" to="/test" style={{ borderColor: "var(--lime)" }}>
          <span className="eyebrow" style={{ color: "var(--lime)" }}>
            Avant le jour J
          </span>
          <h2>Tester le chrono et le son</h2>
          <span className="mute">Essai sur cet appareil seulement, sans déclencher les autres écrans</span>
        </Link>
        <Link className="feature" to="/admin">
          <span className="eyebrow">Téléphone de l'arbitre</span>
          <h2>Vue arbitre</h2>
          <span className="mute">Lancer les rotations, suivre les saisies des ateliers, bonus transverses, télé</span>
        </Link>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="eyebrow">Vue animateur · ordinateur de l'atelier</div>
        <div className="pick">
          {sync ? (
            sync.ateliers.map((a) => (
              <Link key={a.n} to={`/animateur/${a.n}`}>
                <span className="gate">Atelier {a.n}</span>
                <span>
                  <b>{a.service}</b>
                </span>
                <span className="mute">{a.animateur}</span>
              </Link>
            ))
          ) : (
            <p className="mute">Chargement des ateliers…</p>
          )}
        </div>
      </div>
      <div className="pick">
        <Link to="/score">
          <span className="gate">Tour</span>
          <span>
            <b>Classement Burj Khalifa</b>
          </span>
          <span className="mute">Écran de la télé, piloté par l'arbitre</span>
        </Link>
      </div>
      <p className="foot">Gardez chaque écran ouvert, au premier plan et branché pendant tout le jeu.</p>
    </div>
  )
}
