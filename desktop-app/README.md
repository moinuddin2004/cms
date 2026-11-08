# Clinic Management — desktop shell

Tauri v2 wrapper around the **same** SPA bundle as the web deployment. There is
no desktop-specific frontend code: `web-app/` is the single source of truth and
is built by `beforeBuildCommand` into `web-app/.output/public`, which this shell
bundles as its static assets.

## What differs from the web build

Only the shell and the auth transport:

| Concern | Web | Desktop |
|---|---|---|
| Refresh token | httpOnly cookie | `session.json` in the app data dir, sent as `x-refresh-token` (`web-app/src/lib/desktop-session.ts`) |
| Client type | none | `x-client-type: desktop` header |
| Google sign-in | in-page popup (Google Identity Services) | system browser + `clinic://auth/callback` deep link |
| Deep-link reload | nginx `try_files … /index.html` | Tauri's asset fallback to `index.html` |

Everything else — routes, queries, validation, UI — is identical.

## Google sign-in on desktop

Google refuses to run its sign-in inside an embedded webview
(`disallowed_useragent`), so the desktop app never shows the Google popup:

1. The user clicks **Continue with Google** in the app. The app opens
   `GET {API}/auth/google/desktop/start?state=…` in the system browser.
2. The API redirects to `{FRONTEND_URL}/desktop-google?state=…` — a normal web
   page, so Google accepts it. That page verifies the Google account and calls
   `POST /auth/google/desktop/handoff`; the API stores a **hashed, single-use,
   2-minute** code and returns it to the page.
3. The page navigates to `clinic://auth/callback?code=…&state=…`. On Windows
   and Linux the OS starts a second instance; `tauri-plugin-single-instance`
   forwards the URL to the running window, and `tauri-plugin-deep-link` emits
   it to the frontend.
4. The app checks `state` against the attempt it started, redeems the code with
   `POST /auth/google/desktop/exchange`, and stores the session with the same
   `storeSession()` every other login uses. The Google token never enters the
   desktop webview.

`FRONTEND_URL` on the backend must be the deployed web app origin (the one
registered with Google), and the desktop user needs network access to it.
Desktop sign-up, clinic invites and account linking still happen on the web:
a Google-only account can sign in on the web, then set a password under
**Settings → Sign-in methods** to use email/password on the desktop.

In development `register_all()` registers the `clinic` scheme for the debug
executable on Windows/Linux, so no installer is needed. In a packaged build the
installer registers it (`plugins.deep-link.desktop.schemes` in
`tauri.conf.json`). macOS needs the scheme in the bundled app — runtime
registration is not supported there.

## Commands

```bash
npm install
npm run dev     # starts the web dev server, then the desktop window
npm run build   # builds web-app, then the installers
```

Artifacts land in `src-tauri/target/release/bundle/`.

## API URL

`VITE_API_BASE_URL` is baked into the frontend at build time and defaults to
`http://localhost:5000`. For a real deployment build the frontend with it set:

```bash
# PowerShell
$env:VITE_API_BASE_URL = "https://api.example.com"; npm run build
```

The backend must allow the shell's origin (`http://tauri.localhost`,
`https://tauri.localhost`, `tauri://localhost`) in `CORS_ORIGIN` / CORS — see
`backend/src/common/cors.ts`; it is allowed by default.

## Refresh token storage

The token lives in `<app-data>/session.json` via `tauri-plugin-store`. It is a
plain file: on a shared machine, swap `web-app/src/lib/desktop-session.ts` to
`tauri-plugin-stronghold` (or OS keychain) — that file is the only place that
touches storage.
