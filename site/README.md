# Takt Health site

Static pages, no build step. Replace every `[[PLACEHOLDER]]` (highlighted yellow on the pages) before publishing.

- **GitHub Pages:** push this folder to a repo, Settings → Pages → deploy from branch, folder `/site` (or repo root). **Netlify:** drag the `site/` folder onto app.netlify.com/drop.
- App Store Connect → App Information → **Privacy Policy URL**: `https://<host>/privacy.html` (DE localisation: `https://<host>/de/datenschutz.html`).
- Version page → **Support URL**: `https://<host>/support.html` (DE: `/de/hilfe.html`); **Marketing URL**: `https://<host>/` (DE: `/de/`).
- Terms (`terms.html`) and Imprint (`imprint.html`) can go into the description footer or a custom EULA field; link the Imprint from the app too (§ 5 DDG).
