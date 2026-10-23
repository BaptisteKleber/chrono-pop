# Chrono Pop in Dubaï

Appli du jeu des ateliers du séminaire (lundi 2 novembre, 15h15 – 18h) : chrono commun aux 8 ateliers, saisie des
points, bonus transverses et classement de la tour Burj Khalifa. Interface et sons repris de l'appli de Claire
(`oia-dubai.netlify.app`), branchés sur une vraie base.

- Front : Vite + React + TypeScript, hébergé sur Netlify.
- API : binaire Go `chrono-pop` du monorepo buhtech (`cmd/chrono-pop`, `pkg/chrono-pop`), sur docker-2.
- Base : `ws_chrono_pop` sur mysql-3 (scripts dans `buhtech/pkg/chrono-pop/sql/`).

## Les écrans

| URL | Écran | Appareil |
|---|---|---|
| `/` | Menu principal | — |
| `/admin` | Arbitre : lancer les rotations, suivre les saisies et les écrans connectés, bonus, télé | Téléphone de l'arbitre (PIN admin) |
| `/animateur/1` à `/animateur/8` | Chrono de l'atelier et saisie des points | Ordinateur de l'atelier (PIN animateur) |
| `/score` | Classement : masqué, en direct ou révélation, au choix de l'arbitre | Télé (un PC en HDMI de préférence) |
| `/test` | Essai du chrono et des sons, sur l'appareil seulement | N'importe lequel |

Chaque écran interroge l'API (`/api/sync`) toutes les secondes (arbitre, ateliers) ou toutes les 2 s (télé). Le chrono
n'est pas transmis seconde par seconde : chaque écran reçoit l'heure de départ et compte avec l'horloge du serveur.

## Développement

```bash
bun install
bun run dev
```

Vite relaie `/api/*` vers l'API Go locale (`go run .` dans `buhtech/cmd/chrono-pop`, port 8095). Variable `CHRONO_API`
pour viser une autre API.

## Mise en ligne (Netlify)

1. Variables d'environnement du site (Site configuration > Environment variables) :
   - `CHRONO_API_URL` = `https://public.api.service.buhte.ch:8100/chrono-pop/v1/chrono`
   - `CHRONO_API_KEY` = la clé `x-api-key` du proxy
2. Déploiement : `bun run build`, puis `npx netlify-cli deploy --prod` (l'Edge Function `netlify/edge-functions/api.ts`
   est déployée avec le site). Ou un site Netlify relié au dépôt git (build `npm run build`, dossier `dist`).

La clé n'est jamais dans le JS du site : l'Edge Function l'ajoute côté Netlify et ne relaie que les actions de
chrono-pop.

## Le jour J

- Brancher tous les écrans, couper la mise en veille, garder l'onglet au premier plan.
- Cliquer « Activer le son » sur chaque écran (à refaire après un rechargement).
- Pas de déploiement le jour même.
- Remise à zéro après la répétition : `reset.sql` (scores, bonus et journal archivés avant).

# CHANGE LOGS

## V0.1.0 - `23/10/2026`

- 🆕 CHRONO POP : l'appli de Claire branchée sur une vraie base, pour le séminaire « Pop in Dubaï » (2 novembre).
  - Les écrans de Claire à l'identique (charte, chrono façon tableau des départs, sons), une URL par écran.
  - Chrono commun aux 8 ateliers, lancé par l'arbitre, synchronisé sur l'horloge du serveur.
  - Saisie des points par les animateurs, gardée sur l'appareil et renvoyée toute seule si le réseau tombe.
  - Vue arbitre : suivi des saisies, écrans connectés, bonus transverses, mode de la télé, export CSV.
  - Télé du classement : masquée, en direct, ou révélation de la dernière à la première équipe.
  - Codes PIN arbitre et animateurs.
- Nécessite l'API chrono-pop 0.1.0.
- MEP : site Netlify avec les variables `CHRONO_API_URL` et `CHRONO_API_KEY`, puis `bun run build` et
  `npx netlify-cli deploy --prod --dir dist`.
