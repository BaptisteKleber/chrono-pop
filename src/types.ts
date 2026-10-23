/** Contrat de l'API chrono-pop (buhtech pkg/chrono-pop/domain) */

export type Statut = "idle" | "running"
export type TvMode = "masque" | "live" | "revelation"
export type Role = "admin" | "animateur"

export interface Equipe {
  code: string
  nom: string
  couleur: string
  ordre: number
}

export interface Atelier {
  n: number
  porte: string
  service: string
  animateur: string
}

export interface Rotation {
  n: number
  debut: string
  fin: string
}

export interface Planning {
  atelier: number
  rotation: number
  equipe: string | null
}

export interface Etat {
  statut: Statut
  rotation: number
  start_at: number
  duree_ms: number
  epoch: number
  tv_mode: TvMode
  tv_revele: number
  version: number
}

export interface Score {
  atelier: number
  rotation: number
  equipe: string
  perf: number
  bonus: number
  esprit: number
  total: number
  saisi_client: number
}

export interface Bonus {
  equipe: string
  points_communs: boolean
  photo_grimace: boolean
  photo_accessoire: boolean
  photo_libre: boolean
  total: number
}

export interface ClassementLigne {
  rang: number
  equipe: string
  /** Points par atelier, dans l'ordre des ateliers (null = pas encore saisi) */
  points: (number | null)[]
  bonus: number
  total: number
  etages: number
  ateliers_faits: number
  departage: number
}

export interface Config {
  atelier_departage: number
  duree_defaut_min: number
  libelle_date: string
  points_max: number
  points_par_etage: number
  decompte_ms: number
}

export interface Ecran {
  ecran: string
  vu_il_y_a_ms: number
}

export interface Sync {
  now: number
  config: Config
  etat: Etat
  equipes: Equipe[]
  ateliers: Atelier[]
  rotations: Rotation[]
  planning: Planning[]
  scores: Score[]
  bonus: Bonus[]
  classement: ClassementLigne[]
  ecrans: Ecran[]
}

/** Saisie envoyée par un animateur (équipe et total recalculés par le serveur) */
export interface ScoreInput {
  atelier: number
  rotation: number
  perf: number
  bonus: number
  esprit: number
  saisi_client: number
}
