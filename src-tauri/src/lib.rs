mod coordinator;

use coordinator::{CoordinatorError, SchemaCoordinator};
use notify::{RecursiveMode, Watcher};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{Manager, State};

struct CoordinatorState(Arc<SchemaCoordinator>);
struct WatcherState(Mutex<Option<notify::RecommendedWatcher>>);

#[tauri::command]
async fn watch_file(
    coordinator_state: State<'_, CoordinatorState>,
    watcher_state: State<'_, WatcherState>,
    path: String,
) -> Result<(), String> {
    let mut watcher_lock = watcher_state.0.lock().unwrap();

    // Drop old watcher if it exists
    *watcher_lock = None;

    let coordinator = coordinator_state.0.clone();
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
    state.0.read_file(PathBuf::from(path)).await
}

#[tauri::command]
async fn write_schema_file(
    state: State<'_, CoordinatorState>,
    path: String,
    content: String,
) -> Result<(), CoordinatorError> {
    state.0.write_file(PathBuf::from(path), content).await
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
    state.0
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Check if running on Linux and dynamically force the fix safely at runtime
    #[cfg(target_os = "linux")]
    {
        if std::env::var("WEBKIT_DISABLE_DMABUF_RENDERER").is_err() {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }
    }

    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        .setup(|app| {
            let coordinator = Arc::new(SchemaCoordinator::new(app.handle().clone()));
            app.manage(CoordinatorState(coordinator));
            app.manage(WatcherState(Mutex::new(None)));
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init());

    #[cfg(feature = "devtools")]
    {
        builder = builder
            .plugin(tauri_plugin_devtools::init())
            .plugin(tauri_plugin_devtools_app::init());
    }

    #[cfg(feature = "updater")]
    {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
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
        app.manage(CoordinatorState(coordinator));
        app.manage(WatcherState(Mutex::new(None)));

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
