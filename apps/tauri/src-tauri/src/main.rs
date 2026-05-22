#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    io,
    net::{TcpListener, TcpStream},
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::Mutex,
    thread,
    time::{Duration, Instant},
};

use tauri::{AppHandle, Manager, RunEvent, State};

const SIDECAR_HOST: &str = "127.0.0.1";
const SIDECAR_READY_TIMEOUT: Duration = Duration::from_secs(15);
const SIDECAR_POLL_INTERVAL: Duration = Duration::from_millis(100);

#[derive(Debug)]
struct SidecarState {
    port: u16,
    child: Mutex<Option<Child>>,
}

impl Drop for SidecarState {
    fn drop(&mut self) {
        if let Some(mut child) = self.child.lock().expect("sidecar mutex poisoned").take() {
            if let Err(error) = child.kill() {
                if error.kind() != io::ErrorKind::InvalidInput {
                    log::warn!("Failed to kill sidecar process: {error}");
                }
            }

            if let Err(error) = child.wait() {
                log::warn!("Failed to reap sidecar process: {error}");
            }
        }
    }
}

#[tauri::command]
fn sidecar_port(state: State<'_, SidecarState>) -> u16 {
    state.port
}

#[tauri::command]
fn install_ollama(app: AppHandle) -> Result<(), String> {
    let installer_path = app
        .path()
        .resource_dir()
        .map_err(|error| format!("failed to resolve resource directory: {error}"))?
        .join("OllamaSetup.exe");

    if !installer_path.exists() {
        return Err(format!(
            "bundled Ollama installer not found: {}",
            installer_path.display()
        ));
    }

    let status = Command::new(&installer_path)
        .arg("/S")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map_err(|error| format!("failed to run Ollama installer: {error}"))?;

    if status.success() {
        Ok(())
    } else {
        Err(format!("Ollama installer exited with status: {status}"))
    }
}

fn main() {
    env_logger::init();
    log::info!("Starting GroundTruth Local application");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![sidecar_port, install_ollama])
        .setup(|app| {
            let sidecar = start_sidecar(app)?;
            log::info!(
                "Sidecar handshake complete: http://{}:{}",
                SIDECAR_HOST,
                sidecar.port
            );

            app.manage(sidecar);

            let window = app.get_webview_window("main").unwrap();
            window.set_title("GroundTruth Local").unwrap();
            log::info!("Application setup complete");
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if matches!(event, RunEvent::ExitRequested { .. } | RunEvent::Exit) {
                if let Some(state) = app_handle.try_state::<SidecarState>() {
                    cleanup_sidecar(&state);
                }
            }
        });
}

fn start_sidecar(app: &tauri::App) -> Result<SidecarState, Box<dyn std::error::Error>> {
    let port = reserve_localhost_port()?;
    let app_data_dir = app.path().app_data_dir()?;
    let repo_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .and_then(|path| path.parent())
        .and_then(|path| path.parent())
        .ok_or("failed to resolve repository root")?
        .to_path_buf();
    let sidecar_dir = repo_root.join("apps").join("sidecar");
    let storage_path = app_data_dir.join("sidecar-storage");
    let tesseract_path = bundled_tesseract_path(app)?;
    let ollama_installer_path = bundled_ollama_installer_path(app)?;

    std::fs::create_dir_all(&storage_path)?;

    let mut command = Command::new(sidecar_runner());
    command
        .arg("run")
        .arg("uvicorn")
        .arg("main:app")
        .arg("--host")
        .arg(SIDECAR_HOST)
        .arg("--port")
        .arg(port.to_string())
        .current_dir(sidecar_dir)
        .env("SIDECAR_HOST", SIDECAR_HOST)
        .env("SIDECAR_PORT", port.to_string())
        .env("SIDECAR_STORAGE_PATH", storage_path)
        .env("SIDECAR_TESSERACT_PATH", tesseract_path)
        .env("SIDECAR_OLLAMA_INSTALLER_PATH", ollama_installer_path)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = command.spawn()?;

    if let Err(error) = wait_for_sidecar(port) {
        let _ = child.kill();
        let _ = child.wait();
        return Err(error.into());
    }

    Ok(SidecarState {
        port,
        child: Mutex::new(Some(child)),
    })
}

fn bundled_tesseract_path(app: &tauri::App) -> Result<PathBuf, tauri::Error> {
    Ok(app.path().resource_dir()?.join("tesseract").join("tesseract.exe"))
}

fn bundled_ollama_installer_path(app: &tauri::App) -> Result<PathBuf, tauri::Error> {
    Ok(app.path().resource_dir()?.join("OllamaSetup.exe"))
}

fn reserve_localhost_port() -> io::Result<u16> {
    let listener = TcpListener::bind((SIDECAR_HOST, 0))?;
    listener.local_addr().map(|address| address.port())
}

fn wait_for_sidecar(port: u16) -> Result<(), String> {
    let address = format!("{SIDECAR_HOST}:{port}");
    let deadline = Instant::now() + SIDECAR_READY_TIMEOUT;

    while Instant::now() < deadline {
        if TcpStream::connect(&address).is_ok() {
            return Ok(());
        }
        thread::sleep(SIDECAR_POLL_INTERVAL);
    }

    Err(format!("sidecar did not bind {address} before timeout"))
}

fn cleanup_sidecar(state: &SidecarState) {
    if let Some(mut child) = state.child.lock().expect("sidecar mutex poisoned").take() {
        log::info!("Stopping sidecar on {}:{}", SIDECAR_HOST, state.port);

        if let Err(error) = child.kill() {
            if error.kind() != io::ErrorKind::InvalidInput {
                log::warn!("Failed to kill sidecar process: {error}");
            }
        }

        if let Err(error) = child.wait() {
            log::warn!("Failed to reap sidecar process: {error}");
        }
    }
}

fn sidecar_runner() -> &'static str {
    "uv"
}
