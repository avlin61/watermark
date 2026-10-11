// ============================================================
// 水印框 · 桌面壳（Tauri 2）
//   薄壳：开窗口 → 加载 ../web 静态页面 → 提供系统「另存为」。
//   所有图片处理逻辑仍在 web/app.js 里跑，本文件不碰图像。
// ============================================================
use std::path::PathBuf;
use std::sync::Mutex;

use base64::Engine as _;
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

/// 记住上一次的保存目录，下次「另存为」直接从同一目录开始。
#[derive(Default)]
struct LastDir(Mutex<Option<PathBuf>>);

/// 系统原生「另存为」。
/// 前端（web/app.js 的 saveBlob）把文件内容按 base64 传进来，这里弹系统对话框并写盘。
/// 返回 Some(路径) = 已保存；None = 用户取消。
#[tauri::command]
async fn save_native(
    app: tauri::AppHandle,
    state: tauri::State<'_, LastDir>,
    name: String,
    b64: String,
) -> Result<Option<String>, String> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(b64.as_bytes())
        .map_err(|e| format!("文件数据解码失败：{e}"))?;

    // 对话框是阻塞式 API，放到阻塞线程池里跑，别卡住异步运行时
    let start = state
        .0
        .lock()
        .ok()
        .and_then(|g| g.clone())
        .or_else(|| app.path().download_dir().ok());

    let handle = app.clone();
    let picked = tauri::async_runtime::spawn_blocking(move || {
        let mut dialog = handle.dialog().file().set_file_name(name.as_str());
        if let Some(dir) = start {
            dialog = dialog.set_directory(dir);
        }
        dialog.blocking_save_file()
    })
    .await
    .map_err(|e| format!("打开保存对话框失败：{e}"))?;

    let Some(file_path) = picked else { return Ok(None) };
    let path = file_path
        .into_path()
        .map_err(|e| format!("保存路径无效：{e}"))?;

    if let Some(parent) = path.parent() {
        if let Ok(mut guard) = state.0.lock() {
            *guard = Some(parent.to_path_buf());
        }
    }

    std::fs::write(&path, &bytes).map_err(|e| format!("写入文件失败：{e}"))?;
    Ok(Some(path.to_string_lossy().to_string()))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // 已经开着窗口时再次启动：把原窗口拉到前台，不重复开一个
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.unminimize();
                let _ = win.show();
                let _ = win.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .manage(LastDir::default())
        .invoke_handler(tauri::generate_handler![save_native])
        .run(tauri::generate_context!())
        .expect("水印框启动失败");
}
