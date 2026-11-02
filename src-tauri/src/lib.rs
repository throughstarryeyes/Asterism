mod hosting;
mod oauth;
mod relay;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(hosting::Hosting::default())
        .invoke_handler(tauri::generate_handler![
            oauth::oauth_loopback,
            hosting::relay_start,
            hosting::relay_stop,
            hosting::relay_status,
            hosting::tunnel_start,
            hosting::tunnel_stop,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            #[cfg(desktop)]
            {
                app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
                app.handle().plugin(tauri_plugin_process::init())?;
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            // closing the app stops anything it started for a live session
            if let tauri::RunEvent::Exit = event {
                if let Some(hosting) = app.try_state::<hosting::Hosting>() {
                    hosting.shut_down();
                }
            }
        });
}
