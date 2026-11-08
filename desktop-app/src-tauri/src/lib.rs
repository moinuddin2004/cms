//! Tauri shell for the Clinic Management web app.
//!
//! There is no desktop-specific frontend: the window loads the exact static
//! SPA bundle the web deployment serves (`web-app/.output/public`, built by
//! `beforeBuildCommand`). All business logic, routing and API calls stay in
//! `web-app/`.
//!
//! Client-side routing (history mode, no hash) needs one thing from the shell:
//! reloading a nested path such as `/patients/123` must boot the SPA instead
//! of 404ing. Tauri's asset protocol resolves an unknown path through
//! `index.html` (tauri 2.12+, see `Manager::get_asset`), so no custom
//! protocol handler is needed. `Cargo.toml` pins `2.12` for that reason.
//!
//! The store plugin backs the desktop refresh token in `session.json`; the
//! frontend side lives in `web-app/src/lib/desktop-session.ts`.
//!
//! Google sign-in runs in the system browser (Google refuses its popup inside
//! an embedded webview) and comes back through `clinic://auth/callback`:
//! `tauri-plugin-deep-link` delivers the URL, and `tauri-plugin-single-instance`
//! (registered first) forwards a second launch to the running window on
//! Windows/Linux instead of opening a second app.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    // Must be the first plugin: a second launch has to be detected before the
    // rest of the setup runs. The `deep-link` feature forwards its URL to the
    // running instance.
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|_app, _argv, _cwd| {}));
    }

    builder
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            // In dev (and on Linux AppImages) the scheme is not registered by
            // an installer yet; register the configured `clinic` scheme so
            // `clinic://` links find this executable.
            #[cfg(any(target_os = "linux", all(debug_assertions, windows)))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                app.deep_link().register_all()?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running the desktop app");
}
