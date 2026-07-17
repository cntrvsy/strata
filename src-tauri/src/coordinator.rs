use anyhow::Result;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Runtime};
use tokio::sync::{mpsc, oneshot};

#[derive(Debug, thiserror::Error, serde::Serialize)]
pub enum CoordinatorError {
    #[error("I/O error: {0}")]
    Io(String),

    #[error("File not found: {0}")]
    FileNotFound(String),

    #[error("Wrangler config mutation failed: {0}")]
    WranglerConfig(String),

    #[error("Coordinator channel closed")]
    ChannelClosed,
}

pub enum CoordinatorOp {
    Read {
        path: PathBuf,
        resp: oneshot::Sender<Result<String, CoordinatorError>>,
    },
    Write {
        path: PathBuf,
        content: String,
        resp: oneshot::Sender<Result<(), CoordinatorError>>,
    },
    MutateWrangler {
        config_path: PathBuf,
        action: String,       // "add" or "remove"
        binding_type: String, // "kv", "do", "r2"
        binding_name: String,
        extra: serde_json::Value,
        resp: oneshot::Sender<Result<(), CoordinatorError>>,
    },
    FileWatchEvent {
        path: PathBuf,
    },
}

pub struct SchemaCoordinator {
    sender: mpsc::Sender<CoordinatorOp>,
}

impl SchemaCoordinator {
    pub fn new<R: Runtime>(app_handle: AppHandle<R>) -> Self {
        let (tx, rx) = mpsc::channel(100);
        let coordinator = SchemaCoordinator {
            sender: tx,
        };

        // Start background actor task
        tauri::async_runtime::spawn(async move {
            run_coordinator_actor(rx, app_handle).await;
        });

        coordinator
    }

    pub async fn read_file(&self, path: PathBuf) -> Result<String, CoordinatorError> {
        let (tx, rx) = oneshot::channel();
        self.sender
            .send(CoordinatorOp::Read { path, resp: tx })
            .await
            .map_err(|_| CoordinatorError::ChannelClosed)?;

        rx.await.map_err(|_| CoordinatorError::ChannelClosed)?
    }

    pub async fn write_file(&self, path: PathBuf, content: String) -> Result<(), CoordinatorError> {
        let (tx, rx) = oneshot::channel();
        self.sender
            .send(CoordinatorOp::Write {
                path,
                content,
                resp: tx,
            })
            .await
            .map_err(|_| CoordinatorError::ChannelClosed)?;

        rx.await.map_err(|_| CoordinatorError::ChannelClosed)?
    }

    pub async fn mutate_wrangler(
        &self,
        config_path: PathBuf,
        action: String,
        binding_type: String,
        binding_name: String,
        extra: serde_json::Value,
    ) -> Result<(), CoordinatorError> {
        let (tx, rx) = oneshot::channel();
        self.sender
            .send(CoordinatorOp::MutateWrangler {
                config_path,
                action,
                binding_type,
                binding_name,
                extra,
                resp: tx,
            })
            .await
            .map_err(|_| CoordinatorError::ChannelClosed)?;

        rx.await.map_err(|_| CoordinatorError::ChannelClosed)?
    }

    pub fn handle_watch_event(&self, path: PathBuf) {
        let sender = self.sender.clone();
        tauri::async_runtime::spawn(async move {
            let _ = sender.send(CoordinatorOp::FileWatchEvent { path }).await;
        });
    }
}

// Struct to hold state inside the actor task
struct ActorState {
    last_write_time: Instant,
    last_written_path: Option<PathBuf>,
    ignore_next_watch: bool,
}

async fn run_coordinator_actor<R: Runtime>(mut rx: mpsc::Receiver<CoordinatorOp>, app: AppHandle<R>) {
    let mut state = ActorState {
        last_write_time: Instant::now() - Duration::from_secs(10),
        last_written_path: None,
        ignore_next_watch: false,
    };

    while let Some(op) = rx.recv().await {
        match op {
            CoordinatorOp::Read { path, resp } => {
                let res = std::fs::read_to_string(&path)
                    .map_err(|e| {
                        if e.kind() == std::io::ErrorKind::NotFound {
                            CoordinatorError::FileNotFound(path.to_string_lossy().into_owned())
                        } else {
                            CoordinatorError::Io(e.to_string())
                        }
                    });
                let _ = resp.send(res);
            }
            CoordinatorOp::Write { path, content, resp } => {
                state.ignore_next_watch = true;
                state.last_write_time = Instant::now();
                state.last_written_path = Some(path.clone());

                let res = std::fs::write(&path, content)
                    .map_err(|e| CoordinatorError::Io(e.to_string()));
                let _ = resp.send(res);
            }
            CoordinatorOp::MutateWrangler {
                config_path,
                action,
                binding_type,
                binding_name,
                extra,
                resp,
            } => {
                let res = mutate_wrangler_config_file(&config_path, &action, &binding_type, &binding_name, &extra);
                let _ = resp.send(res);
            }
            CoordinatorOp::FileWatchEvent { path } => {
                let now = Instant::now();
                let is_recent_write_to_same_file = state.last_written_path.as_ref() == Some(&path)
                    && now.duration_since(state.last_write_time) < Duration::from_millis(500);

                if state.ignore_next_watch || is_recent_write_to_same_file {
                    state.ignore_next_watch = false;
                } else {
                    let _ = app.emit("file-changed", ());
                }
            }
        }
    }
}

fn mutate_wrangler_config_file(
    path: &Path,
    action: &str,
    binding_type: &str,
    binding_name: &str,
    extra: &serde_json::Value,
) -> Result<(), CoordinatorError> {
    let content = std::fs::read_to_string(path)
        .map_err(|e| CoordinatorError::Io(format!("Failed to read config: {}", e)))?;

    let updated = if path.to_string_lossy().ends_with(".toml") {
        mutate_toml(&content, action, binding_type, binding_name, extra)?
    } else {
        mutate_jsonc(&content, action, binding_type, binding_name, extra)?
    };

    if updated != content {
        std::fs::write(path, updated)
            .map_err(|e| CoordinatorError::Io(format!("Failed to write config: {}", e)))?;
    }

    Ok(())
}

fn mutate_toml(
    content: &str,
    action: &str,
    binding_type: &str,
    binding_name: &str,
    extra: &serde_json::Value,
) -> Result<String, CoordinatorError> {
    // Process TOML block-by-block while preserving formatting and comments
    let mut blocks = Vec::new();
    let mut indices = Vec::new();
    let mut cursor = 0;
    while let Some(pos) = content[cursor..].find("[[") {
        let abs_pos = cursor + pos;
        indices.push(abs_pos);
        cursor = abs_pos + 2;
    }

    if indices.is_empty() {
        blocks.push(content);
    } else {
        if indices[0] > 0 {
            blocks.push(&content[0..indices[0]]);
        }
        for i in 0..indices.len() {
            let start = indices[i];
            let end = if i + 1 < indices.len() {
                indices[i + 1]
            } else {
                content.len()
            };
            blocks.push(&content[start..end]);
        }
    }

    if action == "remove" {
        let mut filtered_blocks = Vec::new();
        for block in blocks {
            let trimmed = block.trim_start();
            if !trimmed.starts_with("[[") {
                filtered_blocks.push(block);
                continue;
            }

            let lines: Vec<&str> = trimmed.lines().collect();
            if lines.is_empty() {
                filtered_blocks.push(block);
                continue;
            }

            let header = lines[0].trim();
            let mut is_match = false;

            if binding_type == "kv" && header.starts_with("[[kv_namespaces]]") {
                is_match = lines.iter().any(|line| {
                    line.contains(&format!("binding = \"{}\"", binding_name))
                        || line.contains(&format!("binding = '{}'", binding_name))
                });
            } else if binding_type == "r2" && header.starts_with("[[r2_buckets]]") {
                is_match = lines.iter().any(|line| {
                    line.contains(&format!("binding = \"{}\"", binding_name))
                        || line.contains(&format!("binding = '{}'", binding_name))
                });
            } else if binding_type == "do" && header.starts_with("[[durable_objects.bindings]]") {
                is_match = lines.iter().any(|line| {
                    line.contains(&format!("name = \"{}\"", binding_name))
                        || line.contains(&format!("name = '{}'", binding_name))
                });
            }

            if !is_match {
                filtered_blocks.push(block);
            }
        }
        Ok(filtered_blocks.join(""))
    } else {
        let mut exists = false;
        for block in &blocks {
            let trimmed = block.trim_start();
            if !trimmed.starts_with("[[") {
                continue;
            }

            let lines: Vec<&str> = trimmed.lines().collect();
            if lines.is_empty() {
                continue;
            }

            let header = lines[0].trim();
            if binding_type == "kv" && header.starts_with("[[kv_namespaces]]") {
                exists = lines.iter().any(|line| {
                    line.contains(&format!("binding = \"{}\"", binding_name))
                        || line.contains(&format!("binding = '{}'", binding_name))
                });
            } else if binding_type == "r2" && header.starts_with("[[r2_buckets]]") {
                exists = lines.iter().any(|line| {
                    line.contains(&format!("binding = \"{}\"", binding_name))
                        || line.contains(&format!("binding = '{}'", binding_name))
                });
            } else if binding_type == "do" && header.starts_with("[[durable_objects.bindings]]") {
                exists = lines.iter().any(|line| {
                    line.contains(&format!("name = \"{}\"", binding_name))
                        || line.contains(&format!("name = '{}'", binding_name))
                });
            }

            if exists {
                break;
            }
        }

        if exists {
            return Ok(content.to_string());
        }

        let mut append_text = String::new();
        if binding_type == "kv" {
            append_text = format!(
                "\n\n[[kv_namespaces]]\nbinding = \"{}\"\nid = \"placeholder-id\"",
                binding_name
            );
        } else if binding_type == "r2" {
            append_text = format!(
                "\n\n[[r2_buckets]]\nbinding = \"{}\"\nbucket_name = \"{}\"",
                binding_name, binding_name
            );
        } else if binding_type == "do" {
            let class_name = extra
                .get("class")
                .and_then(|c| c.as_str())
                .unwrap_or(binding_name);
            append_text = format!(
                "\n\n[[durable_objects.bindings]]\nname = \"{}\"\nclass_name = \"{}\"",
                binding_name, class_name
            );
        }

        let mut result = content.trim_end().to_string();
        result.push_str(&append_text);
        result.push('\n');
        Ok(result)
    }
}

fn mutate_jsonc(
    content: &str,
    action: &str,
    binding_type: &str,
    binding_name: &str,
    extra: &serde_json::Value,
) -> Result<String, CoordinatorError> {
    // Strip comments to parse JSON, find modification targets, and safely rewrite
    let re_block = regex::Regex::new(r"(?s)/\*.*?\*/").unwrap();
    let re_line = regex::Regex::new(r"(?m)(?:^|[^\\:])//.*$").unwrap();
    let cleaned = re_block.replace_all(content, "");
    let cleaned = re_line.replace_all(&cleaned, "");

    let mut data: serde_json::Value = serde_json::from_str(&cleaned)
        .map_err(|e| CoordinatorError::WranglerConfig(format!("Invalid JSON format: {}", e)))?;

    let data_obj = data.as_object_mut().ok_or_else(|| {
        CoordinatorError::WranglerConfig("Root configuration is not a JSON object".into())
    })?;

    if action == "remove" {
        if binding_type == "kv" {
            if let Some(arr) = data_obj.get_mut("kv_namespaces").and_then(|v| v.as_array_mut()) {
                arr.retain(|kv| kv.get("binding").and_then(|b| b.as_str()) != Some(binding_name));
            }
        } else if binding_type == "r2" {
            if let Some(arr) = data_obj.get_mut("r2_buckets").and_then(|v| v.as_array_mut()) {
                arr.retain(|r2| r2.get("binding").and_then(|b| b.as_str()) != Some(binding_name));
            }
        } else if binding_type == "do" {
            if let Some(arr) = data_obj
                .get_mut("durable_objects")
                .and_then(|do_obj| do_obj.get_mut("bindings"))
                .and_then(|v| v.as_array_mut())
            {
                arr.retain(|dobj| dobj.get("name").and_then(|n| n.as_str()) != Some(binding_name));
            }
        }
    } else {
        if binding_type == "kv" {
            let arr = data_obj
                .entry("kv_namespaces")
                .or_insert_with(|| serde_json::Value::Array(Vec::new()))
                .as_array_mut()
                .ok_or_else(|| {
                    CoordinatorError::WranglerConfig("kv_namespaces is not an array".into())
                })?;

            if !arr.iter().any(|kv| kv.get("binding").and_then(|b| b.as_str()) == Some(binding_name)) {
                let mut kv_obj = serde_json::Map::new();
                kv_obj.insert("binding".into(), binding_name.into());
                kv_obj.insert("id".into(), "placeholder-id".into());
                arr.push(serde_json::Value::Object(kv_obj));
            }
        } else if binding_type == "r2" {
            let arr = data_obj
                .entry("r2_buckets")
                .or_insert_with(|| serde_json::Value::Array(Vec::new()))
                .as_array_mut()
                .ok_or_else(|| {
                    CoordinatorError::WranglerConfig("r2_buckets is not an array".into())
                })?;

            if !arr.iter().any(|r2| r2.get("binding").and_then(|b| b.as_str()) == Some(binding_name)) {
                let mut r2_obj = serde_json::Map::new();
                r2_obj.insert("binding".into(), binding_name.into());
                r2_obj.insert("bucket_name".into(), binding_name.into());
                arr.push(serde_json::Value::Object(r2_obj));
            }
        } else if binding_type == "do" {
            let do_obj = data_obj
                .entry("durable_objects")
                .or_insert_with(|| serde_json::Value::Object(serde_json::Map::new()))
                .as_object_mut()
                .ok_or_else(|| {
                    CoordinatorError::WranglerConfig("durable_objects is not an object".into())
                })?;

            let arr = do_obj
                .entry("bindings")
                .or_insert_with(|| serde_json::Value::Array(Vec::new()))
                .as_array_mut()
                .ok_or_else(|| {
                    CoordinatorError::WranglerConfig(
                        "durable_objects.bindings is not an array".into(),
                    )
                })?;

            if !arr.iter().any(|dobj| dobj.get("name").and_then(|n| n.as_str()) == Some(binding_name)) {
                let mut dobj_obj = serde_json::Map::new();
                dobj_obj.insert("name".into(), binding_name.into());
                let class_name = extra
                    .get("class")
                    .and_then(|c| c.as_str())
                    .unwrap_or(binding_name);
                dobj_obj.insert("class_name".into(), class_name.into());
                arr.push(serde_json::Value::Object(dobj_obj));
            }
        }
    }

    // Fallback block to serialize mutated JSON format back nicely
    let pretty = serde_json::to_string_pretty(&data)
        .map_err(|e| CoordinatorError::WranglerConfig(e.to_string()))?;
    Ok(pretty)
}
