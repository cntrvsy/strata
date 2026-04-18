use std::process::Command;

#[tauri::command]
async fn git_status(path: String) -> Result<String, String> {
    let output = Command::new("git")
        .args(["status", "--short", &path])
        .output()
        .map_err(|e| e.to_string())?;
    
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
async fn git_create_branch(name: String) -> Result<(), String> {
    let output = Command::new("git")
        .args(["checkout", "-b", &name])
        .output()
        .map_err(|e| e.to_string())?;
    
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok(())
}

#[tauri::command]
async fn git_commit(path: String, message: String) -> Result<(), String> {
    // Stage the file
    Command::new("git")
        .args(["add", &path])
        .output()
        .map_err(|e| e.to_string())?;
    
    // Commit
    let output = Command::new("git")
        .args(["commit", "-m", &message])
        .output()
        .map_err(|e| e.to_string())?;
    
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok(())
}

#[tauri::command]
async fn save_node_pos(path: String, table_name: String, x: f64, y: f64) -> Result<(), String> {
    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    
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
        }).to_string()
    } else {
        new_content.to_string()
    };

    std::fs::write(&path, final_content)
        .map_err(|e| format!("Failed to write file: {}", e))?;
    
    Ok(())
}

#[tauri::command]
async fn save_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content)
        .map_err(|e| format!("Failed to write file: {}", e))?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            save_node_pos,
            save_file,
            git_status,
            git_commit,
            git_create_branch
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
