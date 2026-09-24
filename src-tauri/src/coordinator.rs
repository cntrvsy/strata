use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Runtime};

#[derive(Debug, thiserror::Error, serde::Serialize)]
#[serde(tag = "type", content = "message")]
pub enum CoordinatorError {
    #[error("I/O error: {0}")]
    Io(String),

    #[error("File not found: {0}")]
    FileNotFound(String),
}

struct DebounceState {
    last_write_time: Instant,
    last_written_path: Option<PathBuf>,
    ignore_next_watch: bool,
}

pub struct SchemaCoordinator {
    on_file_changed: Box<dyn Fn() + Send + Sync>,
    debounce: Mutex<DebounceState>,
}

impl SchemaCoordinator {
    pub fn new<R: Runtime>(app_handle: AppHandle<R>) -> Self {
        let handle = app_handle.clone();
        SchemaCoordinator {
            on_file_changed: Box::new(move || {
                let _ = handle.emit("file-changed", ());
            }),
            debounce: Mutex::new(DebounceState {
                last_write_time: Instant::now() - Duration::from_secs(10),
                last_written_path: None,
                ignore_next_watch: false,
            }),
        }
    }

    pub fn read_file(&self, path: PathBuf) -> Result<String, CoordinatorError> {
        std::fs::read_to_string(&path).map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                CoordinatorError::FileNotFound(path.to_string_lossy().into_owned())
            } else {
                CoordinatorError::Io(e.to_string())
            }
        })
    }

    pub fn write_file(&self, path: PathBuf, content: String) -> Result<(), CoordinatorError> {
        if let Some(parent) = path.parent() {
            if !parent.as_os_str().is_empty() {
                let _ = std::fs::create_dir_all(parent);
            }
        }

        // Record debounce state before writing to disk
        let canonical_path = std::fs::canonicalize(&path).unwrap_or_else(|_| path.clone());
        {
            let mut state = self.debounce.lock().unwrap();
            state.ignore_next_watch = true;
            state.last_write_time = Instant::now();
            state.last_written_path = Some(canonical_path);
        }

        std::fs::write(&path, content).map_err(|e| CoordinatorError::Io(e.to_string()))
    }

    pub fn handle_watch_event(&self, path: PathBuf) {
        let canonical_path = std::fs::canonicalize(&path).unwrap_or_else(|_| path.clone());
        let now = Instant::now();

        let should_emit = {
            let mut state = self.debounce.lock().unwrap();
            let is_recent_write_to_same_file = state
                .last_written_path
                .as_ref()
                .map_or(false, |last| *last == canonical_path || *last == path)
                && now.duration_since(state.last_write_time) < Duration::from_millis(500);

            if state.ignore_next_watch || is_recent_write_to_same_file {
                state.ignore_next_watch = false;
                false
            } else {
                true
            }
        }; // Mutex lock is explicitly dropped here before emitting IPC event

        if should_emit {
            (self.on_file_changed)();
        }
    }
}
