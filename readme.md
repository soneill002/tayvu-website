# Tayvu Memorial Spaces

**Refactor Phase-1: “Monolith Split” ✅**\
*23 Jul 2025*

## 1 · What’s inside

| Before (Jul 21)       | After Phase-1 (today)                      |                                                       |
| --------------------- | ------------------------------------------ | ----------------------------------------------------- |
| **Build**             | no build, single `index.html`              | Vite 7 + ESModules + HMR                              |
| **CSS**               | \~9 000 lines inline                       | split into `src/styles/{base,layout,components}.css`  |
| **JavaScript**        | all inline & globals                       | fully modular under `src/js/…` with `@/` alias        |
| **Code quality**      | —                                          | ESLint · Prettier · Husky pre-commit                  |
| **Deployment**        | Netlify only                               | Vite build → `dist/`, Netlify Functions + PR previews |
| **Auth / API**        | Supabase CDN globals                       | `src/js/api/supabaseClient.js`                        |
| **Features migrated** | Nav, Auth, Profile, Create-Memorial wizard | ✅ + Pricing, Moments board, Guestbook modal           |

---

## 2 · Quick start

```bash
git clone https://github.com/soneill002/tayvu-website.git
cd tayvu-website
git checkout refactor/monolith-split
npm install
npm run dev   # → http://localhost:5173 with HMR
```

> **Full-stack preview:**
>
> ```bash
> npm run netlify   # vite build + netlify dev (functions + redirects)
> ```

Requires **Node ≥ 18** + npm.

---

## 3 · Scripts

| Command           | What it does                                             |
| ----------------- | -------------------------------------------------------- |
| `npm run dev`     | Vite dev server (ESM + HMR) – front-end only             |
| `npm run netlify` | Builds once, then starts `netlify dev` (Functions + env) |
| `npm run build`   | Production bundle → `dist/`                              |
| `npm run preview` | Serves the built `dist/`                                 |
| `npm run lint`    | ESLint over `src/js/`                                    |
| `npm run format`  | Prettier over all staged files                           |

Husky + lint-staged auto-fix on commit.

---

## 4 · File structure

```
tayvu-website/
├─ public/                    # static assets
│  └─ index.html              # <style>/<script> removed; loads Vite bundle
├─ src/
│  ├─ styles/
│  │   ├─ base.css            # resets, typography, variables, animations
│  │   ├─ layout.css          # grid / flex utilities, page-section rules
│  │   └─ components.css      # nav, hero, cards, modals, faq, forms…
│  ├─ js/
│  │   ├─ api/
│  │   │   └─ supabaseClient.js
│  │   ├─ auth/
│  │   │   └─ authUI.js
│  │   ├─ features/
│  │   │   ├─ memorials/
│  │   │   │   ├─ wizard.js
│  │   │   │   ├─ moments.js
│  │   │   │   └─ exampleMemorial.js
│  │   │   ├─ profile/
│  │   │   │   ├─ profileData.js
│  │   │   │   └─ profileUI.js
│  │   │   ├─ pricing/
│  │   │   │   └─ pricing.js
│  │   │   └─ guestbook.js
│  │   ├─ router.js            # client-side hash routing + FAQ toggle
│  │   ├─ utils/
│  │   │   ├─ ui.js            # toast, qs, showError, formatDate…
│  │   │   ├─ modal.js
│  │   │   └─ animations.js
│  │   └─ main.js              # bootstraps router + authUI + features
├─ netlify/
│  └─ functions/               # signup, signin, get-config
├─ vite.config.js              # `@/` → `/src/js` alias
└─ .eslintrc.cjs · .prettierrc · .husky/
```

---

## 5 · Environment variables

Set via Netlify Project → Environment Variables (also injected by `netlify dev`):

| Key                         | Example                   | Scope          |
| --------------------------- | ------------------------- | -------------- |
| `SUPABASE_URL`              | `https://xxx.supabase.co` | all            |
| `SUPABASE_ANON_KEY`         | `eyJhbGci…`               | all            |
| `SUPABASE_SERVICE_ROLE_KEY` | (service-role key)        | functions only |
| `JWT_SECRET`                | random string             | functions only |
| `SESSION_SECRET`            | random string             | functions only |

`supabaseClient.js` picks them up via the Netlify function’s get-config.

---

## 6 · Coding standards

- **Linting**: ESLint per `.eslintrc.cjs` (ES2022, modules).
- **Formatting**: Prettier (2‑space, single quotes, semis).
- **Pre‑commit**: Husky + lint-staged auto‑fix on commit.

---

## 7 · Feature initialization

| Feature                  | Module                                  | Init call                         |
| ------------------------ | --------------------------------------- | --------------------------------- |
| Routing & FAQ toggle     | `router.js`                             | `initRouter()` in `main.js`       |
| Supabase Auth UI         | `auth/authUI.js`                        | `initAuthUI()` in `main.js`       |
| Profile page             | `features/profile/...`                  | triggered on `#profile` by router |
| Create‑Memorial wizard   | `features/memorials/wizard.js`          | `window.goToCreateMemorial()`     |
| Moments board            | `features/memorials/moments.js`         | `initMomentsBoard()`              |
| Guest‑book modal         | `features/guestbook.js`                 | `initGuestbook()`                 |
| Pricing buttons          | `features/pricing/pricing.js`           | `initPricing()`                   |
| Example Memorial preview | `features/memorials/exampleMemorial.js` | `initExampleMemorial()`           |

All kick off from \`\`.

---

## 8 · Smoke‑test (✅ done 23 Jul)

- Sign‑up / email confirm
- Sign‑in / sign‑out (UI updates)
- Navigation + mobile menu
- Profile page loads data
- Create‑Memorial wizard (steps 1–2, preview)
- Pricing hook
- Moments board (add/remove/reorder)
- Guest‑book modal
- Chrome, Safari, Firefox ✅

