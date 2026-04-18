// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn save_node_pos(path: String, table_name: String, x: f64, y: f64) -> Result<(), String> {
    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    
    // Naive replacement: find the table declaration and its preceding JSDoc
    // In a real app, we'd use a better parser, but for Milestone 1, regex replacement is okay.
    // We look for /** ... @strata { ... } */ export const <table_name>
    
    let re_str = format!(
        r#"(?s)(/\*\*.*?)@strata\s+{{.*?}}(.*?\*/\s*export\s+const\s+{}\s*=)"#,
        table_name
    );
    let re = regex::Regex::new(&re_str).map_err(|e| e.to_string())?;
    
    let new_metadata = format!("@strata {{ \"x\": {:.0}, \"y\": {:.0} }}", x, y);
    let new_content = re.replace(&content, |caps: &regex::Captures| {
        format!("{}{}{}", &caps[1], new_metadata, &caps[2])
    });

    // If no match was found, maybe the @strata tag is missing?
    let final_content = if new_content == content {
        // Try adding it if it doesn't exist
        let re_no_tag = format!(
            r#"(?s)(/\*\*.*?)(\*/\s*export\s+const\s+{}\s*=)"#,
            table_name
        );
        let re2 = regex::Regex::new(&re_no_tag).map_err(|e| e.to_string())?;
        re2.replace(&content, |caps: &regex::Captures| {
            format!("{} * {}\n {}", &caps[1], new_metadata, &caps[2])
        }).to_string()
    } else {
        new_content.to_string()
    };

    std::fs::write(&path, final_content)
        .map_err(|e| format!("Failed to write file: {}", e))?;
    
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![greet, save_node_pos])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
