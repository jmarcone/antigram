// Antigram desktop shell. The heavy lifting (parsing, EXIF, organizing)
// lives in the Node sidecar (packages/cli/dist/sidecar.cjs); this Rust
// process is just a thin window manager + sidecar orchestrator.

use serde::Serialize;
use std::path::PathBuf;
use std::process::Stdio;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

const WORKSPACE_ROOT: &str = env!("ANTIGRAM_WORKSPACE_ROOT");

fn sidecar_script_path() -> PathBuf {
    PathBuf::from(WORKSPACE_ROOT).join("packages/cli/dist/sidecar.cjs")
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ParseSummary {
    posts: serde_json::Value,
    warnings: Vec<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ReclaimSummary {
    output_root: String,
    media_written: usize,
    warnings: Vec<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct DoctorInfo {
    workspace_root: String,
    sidecar_path: String,
    sidecar_exists: bool,
    node_version: Option<String>,
}

/// Parse the Meta export ZIP and return the typed Post[] for the gallery.
#[tauri::command(rename_all = "camelCase")]
async fn parse_export(app: AppHandle, zip_path: String) -> Result<ParseSummary, String> {
    let script = sidecar_script_path();

    let mut child = Command::new("node")
        .arg(&script)
        .arg("parse")
        .arg(&zip_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn node sidecar: {e}"))?;

    let stdout = child.stdout.take().ok_or_else(|| "no stdout".to_string())?;
    let mut lines = BufReader::new(stdout).lines();

    let mut posts: serde_json::Value = serde_json::Value::Null;
    let mut warnings: Vec<String> = vec![];

    while let Some(line) = lines.next_line().await.map_err(|e| e.to_string())? {
        if line.is_empty() {
            continue;
        }
        let envelope: serde_json::Value = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(e) => return Err(format!("bad envelope from sidecar: {e}\n{}", line)),
        };
        let kind = envelope.get("k").and_then(|v| v.as_str()).unwrap_or("");
        match kind {
            "discovery" => {
                let _ = app.emit("antigram:discovery", &envelope);
            }
            "parsed" => {
                if let Some(p) = envelope.get("posts") {
                    posts = p.clone();
                }
                if let Some(arr) = envelope.get("warnings").and_then(|v| v.as_array()) {
                    warnings = arr
                        .iter()
                        .filter_map(|v| v.as_str().map(String::from))
                        .collect();
                }
            }
            "error" => {
                let msg = envelope
                    .get("message")
                    .and_then(|v| v.as_str())
                    .unwrap_or("(no message)")
                    .to_string();
                return Err(msg);
            }
            _ => {}
        }
    }

    let status = child.wait().await.map_err(|e| e.to_string())?;
    if !status.success() {
        return Err(format!("sidecar exited with status {:?}", status.code()));
    }

    Ok(ParseSummary { posts, warnings })
}

/// Run the full pipeline against an export ZIP, writing reclaimed photos to
/// `output_root`. `post_ids` filters which posts to reclaim (empty = all).
#[tauri::command(rename_all = "camelCase")]
async fn reclaim(
    app: AppHandle,
    zip_path: String,
    output_root: String,
    post_ids: Vec<String>,
) -> Result<ReclaimSummary, String> {
    let script = sidecar_script_path();

    let mut cmd = Command::new("node");
    cmd.arg(&script).arg("reclaim").arg(&zip_path).arg(&output_root);
    for id in &post_ids {
        cmd.arg("--post-id").arg(id);
    }

    let mut child = cmd
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn node sidecar: {e}"))?;

    let stdout = child.stdout.take().ok_or_else(|| "no stdout".to_string())?;
    let mut lines = BufReader::new(stdout).lines();

    let mut output: Option<String> = None;
    let mut media_written: usize = 0;
    let mut warnings: Vec<String> = vec![];

    while let Some(line) = lines.next_line().await.map_err(|e| e.to_string())? {
        if line.is_empty() {
            continue;
        }
        let envelope: serde_json::Value = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(e) => return Err(format!("bad envelope from sidecar: {e}\n{}", line)),
        };
        let kind = envelope.get("k").and_then(|v| v.as_str()).unwrap_or("");
        match kind {
            "reclaim_start" | "post_start" | "media_written" | "post_done" => {
                let _ = app.emit("antigram:progress", &envelope);
            }
            "done" => {
                output = envelope
                    .get("outputRoot")
                    .and_then(|v| v.as_str())
                    .map(String::from);
                media_written = envelope
                    .get("mediaWritten")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(0) as usize;
                if let Some(arr) = envelope.get("warnings").and_then(|v| v.as_array()) {
                    warnings = arr
                        .iter()
                        .filter_map(|v| v.as_str().map(String::from))
                        .collect();
                }
            }
            "error" => {
                let msg = envelope
                    .get("message")
                    .and_then(|v| v.as_str())
                    .unwrap_or("(no message)")
                    .to_string();
                return Err(msg);
            }
            _ => {}
        }
    }

    let status = child.wait().await.map_err(|e| e.to_string())?;
    if !status.success() {
        return Err(format!("sidecar exited with status {:?}", status.code()));
    }

    Ok(ReclaimSummary {
        output_root: output.unwrap_or(output_root),
        media_written,
        warnings,
    })
}

/// Sanity-check command surfaced in the UI's About / debug panel.
#[tauri::command]
async fn doctor() -> Result<DoctorInfo, String> {
    let script = sidecar_script_path();
    let sidecar_exists = tokio::fs::try_exists(&script).await.unwrap_or(false);

    let node_version = Command::new("node")
        .arg("--version")
        .output()
        .await
        .ok()
        .and_then(|o| {
            if o.status.success() {
                Some(String::from_utf8_lossy(&o.stdout).trim().to_string())
            } else {
                None
            }
        });

    Ok(DoctorInfo {
        workspace_root: WORKSPACE_ROOT.to_string(),
        sidecar_path: script.display().to_string(),
        sidecar_exists,
        node_version,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![parse_export, reclaim, doctor])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
