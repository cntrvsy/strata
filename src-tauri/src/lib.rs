use notify::{RecursiveMode, Watcher};
use std::sync::Mutex;
use tauri::{Emitter, Manager, State};

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

#[tauri::command]
async fn read_schema_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
async fn write_schema_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content).map_err(|e| e.to_string())
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

    tauri::Builder::default()
        .manage(WatcherState(Mutex::new(None)))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            watch_file,
            read_schema_file,
            write_schema_file,
            close_splashscreen
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use tauri::Manager;
    use tauri::test::{mock_builder, mock_context};

    #[test]
    fn test_read_write_schema_file_commands() {
        let temp_dir = std::env::temp_dir();
        let temp_file = temp_dir.join("test_rw_schema.ts");
        let path = temp_file.to_str().unwrap().to_string();
        let test_content = "export const user = {}";

        // Write content using the command
        let write_res = tauri::async_runtime::block_on(write_schema_file(path.clone(), test_content.to_string()));
        assert!(write_res.is_ok());

        // Read content using the command
        let read_res = tauri::async_runtime::block_on(read_schema_file(path.clone()));
        assert!(read_res.is_ok());
        assert_eq!(read_res.unwrap(), test_content);

        // Cleanup
        let _ = std::fs::remove_file(temp_file);
    }

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

    #[test]
    fn test_watch_file_non_existent() {
        let app = mock_builder()
            .manage(WatcherState(Mutex::new(None)))
            .build(mock_context(tauri::test::noop_assets()))
            .unwrap();

        let handle = app.handle().clone();
        tauri::async_runtime::block_on(async move {
            let state: State<'_, WatcherState> = handle.state();
            let result = watch_file(handle.clone(), state, "/non/existent/path".to_string()).await;
            assert!(result.is_err(), "Should return error for non-existent path");
        });
    }

    #[test]
    fn test_watcher_replacement() {
        let app = mock_builder()
            .manage(WatcherState(Mutex::new(None)))
            .build(mock_context(tauri::test::noop_assets()))
            .unwrap();

        let temp_dir = std::env::temp_dir();
        let f1 = temp_dir.join("f1.ts");
        let f2 = temp_dir.join("f2.ts");
        std::fs::write(&f1, "").unwrap();
        std::fs::write(&f2, "").unwrap();

        let handle = app.handle().clone();
        tauri::async_runtime::block_on(async move {
            let state: State<'_, WatcherState> = handle.state();
            
            // Watch first file
            watch_file(handle.clone(), state.clone(), f1.to_str().unwrap().to_string()).await.unwrap();
            
            // Watch second file (should replace first)
            watch_file(handle.clone(), state, f2.to_str().unwrap().to_string()).await.unwrap();
        });

        let _ = std::fs::remove_file(f1);
        let _ = std::fs::remove_file(f2);
    }
}
