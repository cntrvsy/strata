use notify::{RecursiveMode, Watcher};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

struct WatcherState(Mutex<Option<notify::RecommendedWatcher>>);



#[tauri::command]
async fn watch_file<R: tauri::Runtime>(
    handle: tauri::AppHandle<R>,
    state: State<'_, WatcherState>,
    path: String,
) -> Result<(), String> {
    let mut watcher_lock = state.0.lock().unwrap();

    // Drop old watcher if it exists
    *watcher_lock = None;

    let handle_clone = handle.clone();
    let mut watcher =
        notify::recommended_watcher(move |res: notify::Result<notify::Event>| match res {
            Ok(event) => {
                if event.kind.is_modify() {
                    let _ = handle_clone.emit("file-changed", ());
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(WatcherState(Mutex::new(None)))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![watch_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use tauri::Manager;
    use tauri::test::{mock_builder, mock_context};

    #[test]
    fn test_watcher_state_init() {
        let state = WatcherState(Mutex::new(None));
        let lock = state.0.lock().unwrap();
        assert!(lock.is_none());
    }

    #[test]
    fn test_watch_file_command() {
        let app = mock_builder()
            .manage(WatcherState(Mutex::new(None)))
            .build(mock_context(tauri::test::noop_assets()))
            .unwrap();

        // Create a temp file to watch
        let temp_dir = std::env::temp_dir();
        let temp_file = temp_dir.join("test_schema_rust_v2.ts");
        std::fs::write(&temp_file, "export const t = {}").unwrap();

        let path = temp_file.to_str().unwrap().to_string();
        
        let handle = app.handle().clone();
        tauri::async_runtime::block_on(async move {
            let state: State<'_, WatcherState> = handle.state();
            watch_file(handle.clone(), state, path).await.unwrap();
            
            let state_after: State<'_, WatcherState> = handle.state();
            let lock = state_after.0.lock().unwrap();
            assert!(lock.is_some(), "Watcher should be initialized in state");
        });

        // Cleanup
        let _ = std::fs::remove_file(temp_file);
    }
}
