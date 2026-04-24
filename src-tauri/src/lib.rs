use notify::{RecursiveMode, Watcher};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

struct WatcherState(Mutex<Option<notify::RecommendedWatcher>>);

#[tauri::command]
async fn save_node_pos(path: String, table_name: String, x: f64, y: f64) -> Result<(), String> {
    let content =
        std::fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))?;

    let re_str = format!(
        r#"(?s)(/\*\*.*?)@strata\s+{{.*?}}(.*?\*/\s*export\s+const\s+{}\s*=)"#,
        table_name
    );
    let re = regex::Regex::new(&re_str).map_err(|e| e.to_string())?;

    let new_metadata = format!("@strata {{ \"x\": {:.0}, \"y\": {:.0} }}", x, y);
    let mut replaced = false;
    let new_content = re.replace(&content, |caps: &regex::Captures| {
        replaced = true;
        format!("{}{}{}", &caps[1], new_metadata, &caps[2])
    });

    let final_content = if !replaced {
        let re_no_tag = format!(
            r#"(?s)(/\*\*.*?)(\*/\s*export\s+const\s+{}\s*=)"#,
            table_name
        );
        let re2 = regex::Regex::new(&re_no_tag).map_err(|e| e.to_string())?;
        re2.replace(&content, |caps: &regex::Captures| {
            format!("{} * {}\n {}", &caps[1], new_metadata, &caps[2])
        })
        .to_string()
    } else {
        new_content.to_string()
    };

    std::fs::write(&path, final_content).map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(())
}

#[tauri::command]
async fn save_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content).map_err(|e| format!("Failed to write file: {}", e))?;
    Ok(())
}

#[tauri::command]
async fn watch_file(
    handle: AppHandle,
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
        .invoke_handler(tauri::generate_handler![
            save_node_pos,
            save_file,
            watch_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
