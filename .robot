# GridParser — briefing projet (pour agents / bots)

Document de contexte : ce que fait le projet, comment il fonctionne, et les règles produit importantes.

## Qu’est-ce que c’est

**GridParser** (aussi appelé Grid2icons) est une appli web **100 % navigateur** qui découpe une image contenant plusieurs tuiles (grille ChatGPT, planches, formes, etc.) en images séparées, téléchargeables en ZIP.

- Pas d’upload serveur : traitement local (canvas + JSZip).
- Entrées : `index.html` (parser), `styles.html` (galerie de prompts de styles).
- Déploiement typique : site statique (Vercel).

## Parcours utilisateur

1. (Optionnel) Sur **Styles** : choisir un style, éditer le sujet, copier le prompt → générer une grille dans un outil d’image.
2. Choisir un **mode d’éditeur** (Grid, Freeform, Lines, Black BG, Simple Grid).
3. Régler **Rows × Cols** pour préétablir la taille de découpe (surtout Grid / Freeform / Simple Grid).
4. Uploader une ou plusieurs images → auto-detect selon le mode.
5. Ajuster les guides (lignes bleues/rouges) ou les formes Freeform.
6. **Cut** → aperçu des tuiles.
7. Optionnel : **Run auto-name** (OCR) pour renommer les fichiers ; si **Remove label after auto-name** est coché (défaut), la bande label basse est ensuite recadrée.
8. Télécharger ZIP (raw / removebg / both).

## Galerie Styles (`styles.html`)

- ~24 styles (pomme par défaut, sujet éditable) en cartes **flip** + modal.
- Données : `js/stylePrompts.js` (`STYLE_CATALOG`, `buildPrompt`).
- Les prompts imposent une grille régulière (ex. 4×4), séparateurs noirs, labels OCR en bas de cellule — pour un parsing fiable dans G2I.

## Modes de découpage

| Mode UI | Id interne | Rôle |
|--------|------------|------|
| **Grid** | `uniform` | Grille régulière ; détecte lignes H/V. Rows×Cols verrouille la taille cible. |
| **Freeform** | `freeform` | Formes / panneaux d’abord. Rows×Cols seed ou oriente le nombre de cellules. |
| **Lines** | `lineform` | Bordures / traits noirs → cellules. |
| **Black BG** | `blackbg` | Formes isolées sur fond sombre ; séparateurs noirs minces exclus. |
| **Simple Grid** | `geometrical` | Découpe géométrique égale dans un rectangle (coins + format). |

Détail algorithmes : `PARSER_GUIDE.md`.

Registre runtime : `PARSER_MODE_REGISTRY` dans `index.html`.

## Auto-name (règle produit)

- Lit le texte (souvent bas de tuile, `%` réglable via `#label-region-pct`) via **Tesseract**.
- Applique le texte au **nom de fichier** (un seul meilleur mot, corrections OCR courantes, préfixes bruit `cc_`/`on_` retirés).
- Si `#remove-label-after-name` est coché (défaut **oui**) : augmente `trimBottom` de chaque `tileCropInfos` de la hauteur de la bande label, régénère les blobs, met à jour les previews. Flag `labelRemoved` évite un double crop.
- Décocher la case pour garder le label dans l’image exportée.

## Grid auto-detect

- `runAutoDetect()` appelle `getUniformCandidate(w,h,true)` : teste plusieurs tailles (3×3, 4×4, …), score couverture + régularité, met à jour Rows×Cols.
- Changement manuel Rows×Cols → détection **verrouillée** sur cette taille.
- Presets `allowDashed` pour séparateurs pointillés / gris.

## Rows × Cols

- Contrôles `#grid-format-rows` / `#grid-format-cols` (et select caché `#grid-format`).
- Changement → `applySelectedGridDimensions()` :
  - **Grid** : re-détecte à la taille choisie, sinon grille égale.
  - **Freeform** : seed de N cellules (détection grille à cette taille, sinon égale).
  - **Simple Grid** : régénère les cellules égales dans le rectangle.

## Architecture fichiers

| Chemin | Rôle |
|--------|------|
| `index.html` | UI parser + OCR, batch, export |
| `styles.html` | Galerie styles / prompts |
| `js/stylePrompts.js` | Catalogue styles + `buildPrompt` |
| `css/styles-gallery.css` | Flip cards + modal |
| `js/gridDetect.js` | Détection lignes de grille |
| `js/gridSplit.js` | Découpe par `xBounds` / `yBounds` |
| `js/segmentDetect.js` | Panneaux, gaps, lignes sombres, black BG |
| `js/segmentArrangement.js` | Segments → cellules |
| `js/segmentSplit.js` | Découpe par liste de cellules |
| `lib/` | Tesseract et deps locales |
| `Examples/` | Images de test |
| `scripts/test-grid-split.js` | Test Node (`npm run test:grid`) |
| `PARSER_GUIDE.md` | Doc parsers |
| `README.md` | Vue utilisateur / dev |

## Modèle de données

- **Bounds** : `xBounds[]`, `yBounds[]` (coupes grille).
- **Cells** : `{ x, y, w, h }` (Freeform / Lines / Black BG).
- Export uniforme/géométrique : `gridSplit.splitGridCustom`.
- Export formes : `segmentSplit.splitByCells`.

## Commandes

```bash
npm run dev        # serveur statique local
npm run test:grid  # tests découpe (Examples → test-output)
```

## Contraintes pour les agents

- Garder le traitement **côté client** (pas d’envoi d’images à un backend).
- Respecter la case Remove label (ne pas forcer un comportement contraire sans UI).
- Préférer réutiliser `PARSER_MODE_REGISTRY` et les helpers existants plutôt que dupliquer la détection.
- Respecter le style existant (JS vanilla, peu de frameworks).
- Les guides bleus/rouges ne doivent jamais apparaître dans les PNG exportés.

## Langue

UI actuelle surtout en anglais. Ce fichier `.robot` est en français pour le contexte agent ; le code / UI peuvent rester en anglais sauf demande contraire.
