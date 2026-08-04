mod coordinator;

use coordinator::{CoordinatorError, SchemaCoordinator};
use notify::{RecursiveMode, Watcher};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{Manager, State};

struct CoordinatorState {
    coordinator: Arc<SchemaCoordinator>,
}
struct WatcherState {
    watcher: Mutex<Option<notify::RecommendedWatcher>>,
}

#[tauri::command]
async fn watch_file(
    coordinator_state: State<'_, CoordinatorState>,
    watcher_state: State<'_, WatcherState>,
    path: String,
) -> Result<(), String> {
    let mut watcher_lock = watcher_state.watcher.lock().unwrap();

    // Drop old watcher if it exists
    *watcher_lock = None;

    let coordinator = coordinator_state.coordinator.clone();
    let mut watcher =
        notify::recommended_watcher(move |res: notify::Result<notify::Event>| match res {
            Ok(event) => {
                if event.kind.is_modify() {
                    for p in event.paths {
                        coordinator.handle_watch_event(p);
                    }
                }
            }
            Err(e) => println!("watch error: {:?}", e),
        })
        .map_err(|e| e.to_string())?;

    watcher
        .watch(std::path::Path::new(&path), RecursiveMode::NonRecursive)
        .map_err(|e| e.to_string())?;

    *watcher_lock = Some(watcher);
    Ok(())
}

#[tauri::command]
async fn read_schema_file(
    state: State<'_, CoordinatorState>,
    path: String,
) -> Result<String, CoordinatorError> {
    state.coordinator.read_file(PathBuf::from(path)).await
}

#[tauri::command]
async fn write_schema_file(
    state: State<'_, CoordinatorState>,
    path: String,
    content: String,
) -> Result<(), CoordinatorError> {
    state.coordinator.write_file(PathBuf::from(path), content).await
}

#[tauri::command]
async fn mutate_wrangler_config(
    state: State<'_, CoordinatorState>,
    config_path: String,
    action: String,
    binding_type: String,
    binding_name: String,
    extra: serde_json::Value,
) -> Result<(), CoordinatorError> {
    state
        .coordinator
        .mutate_wrangler(
            PathBuf::from(config_path),
            action,
            binding_type,
            binding_name,
            extra,
        )
        .await
}

#[tauri::command]
async fn close_splashscreen(app: tauri::AppHandle) {
    if let Some(splashscreen) = app.get_webview_window("splashscreen") {
        let _ = splashscreen.close();
    }
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.show();
    }
}

#[cfg(target_os = "linux")]
fn appimage_wayland_preload_fix() {
    use std::os::unix::process::CommandExt;

    // Only relevant when actually running from inside an AppImage on Wayland,
    // and only once (guard against re-exec looping).
    let in_appimage = std::env::var("APPIMAGE").is_ok();
    let on_wayland = std::env::var("WAYLAND_DISPLAY").is_ok();
    let already_reexeced = std::env::var("__STRATA_WAYLAND_PRELOAD_DONE").is_ok();

    if !in_appimage || !on_wayland || already_reexeced || std::env::var("LD_PRELOAD").is_ok() {
        return;
    }

    let candidates = [
        "/usr/lib64/libwayland-client.so.0",
        "/usr/lib/x86_64-linux-gnu/libwayland-client.so.0",
        "/usr/lib/libwayland-client.so.0",
    ];

    for path in candidates {
        let p = std::path::Path::new(path);
        if !p.exists() {
            continue;
        }
        // Skip if it's the wrong ELF class (e.g. a 32-bit lib on a 64-bit system)
        if let Ok(bytes) = std::fs::read(p) {
            if bytes.len() > 5 && bytes[4] != 2 {
                // ELF class byte: 1 = 32-bit, 2 = 64-bit — skip mismatches
                continue;
            }
        }

        let exe = match std::env::current_exe() {
            Ok(exe) => exe,
            Err(_) => return,
        };

        let _ = std::process::Command::new(exe)
            .args(std::env::args_os().skip(1))
            .env("LD_PRELOAD", path)
            .env("__STRATA_WAYLAND_PRELOAD_DONE", "1")
            .exec(); // replaces current process on success, never returns

        break;
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Check if running on Linux and dynamically force the fix safely at runtime
    #[cfg(target_os = "linux")]
    {
        appimage_wayland_preload_fix();

        if std::env::var("WEBKIT_DISABLE_DMABUF_RENDERER").is_err() {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }
    }

    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        .setup(|app| {
            let coordinator = Arc::new(SchemaCoordinator::new(app.handle().clone()));
            app.manage(CoordinatorState { coordinator });
            app.manage(WatcherState {
                watcher: Mutex::new(None),
            });

            use tauri_plugin_updater::UpdaterExt;
            use tauri::Emitter;
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Ok(updater) = handle.updater() {
                    if let Ok(Some(update)) = updater.check().await {
                        let _ = handle.emit("update-available", serde_json::json!({
                            "version": update.version,
                            "body": update.body,
                            "date": update.date.map(|d| d.to_string())
                        }));
                    }
                }
            });

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build());

    #[cfg(feature = "devtools")]
    {
        builder = builder
            .plugin(tauri_plugin_devtools::init())
            .plugin(tauri_plugin_devtools_app::init());
    }

    builder
        .invoke_handler(tauri::generate_handler![
            watch_file,
            read_schema_file,
            write_schema_file,
            mutate_wrangler_config,
            close_splashscreen
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use tauri::test::{mock_builder, mock_context};
    use tauri::Manager;

    #[test]
    fn test_read_write_schema_file_commands() {
        let app = mock_builder()
            .build(mock_context(tauri::test::noop_assets()))
            .unwrap();

        let coordinator = Arc::new(SchemaCoordinator::new(app.handle().clone()));
        app.manage(CoordinatorState { coordinator });
        app.manage(WatcherState {
            watcher: Mutex::new(None),
        });

        let temp_dir = std::env::temp_dir();
        let temp_file = temp_dir.join("test_rw_schema.ts");
        let path = temp_file.to_str().unwrap().to_string();
        let test_content = "export const user = {}";

        let state: State<'_, CoordinatorState> = app.state();

        // Write content using the command
        let write_res = tauri::async_runtime::block_on(write_schema_file(
            state.clone(),
            path.clone(),
            test_content.to_string(),
        ));
        assert!(write_res.is_ok());

        // Read content using the command
        let read_res = tauri::async_runtime::block_on(read_schema_file(state, path.clone()));
        assert!(read_res.is_ok());
        assert_eq!(read_res.unwrap(), test_content);

        // Cleanup
        let _ = std::fs::remove_file(temp_file);
    }
}
