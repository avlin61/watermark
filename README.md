# 水印框（Watermark）

给照片加上边框与拍摄信息水印：EXIF 读取、合成、导出**全部在本机完成**，不上传服务器。

同一套前端既能当网页用，也能打包成桌面 App（Tauri 2）：网页版走浏览器下载，
桌面版走系统原生「另存为」对话框。

## 目录结构

```
web/                前端本体（纯静态，没有构建步骤）
  index.html        页面结构
  app.js            全部逻辑：EXIF → 布局 → 合成 → 导出
  style.css         样式
  logos.js          机身/镜头品牌 SVG 标志
  vendor/           本地依赖（exifr，读 EXIF），随仓库附带，离线可用
src-tauri/          桌面壳（Rust + Tauri 2）：开窗口、加载 web/、提供系统「另存为」
scripts/            图标生成脚本（make-icons.sh / png2ico.py）
```

## 网页版怎么跑

用本机静态服务器打开，**不要**直接双击 `file://`（浏览器会拦住 fetch / Canvas 的部分能力）：

```bash
cd <仓库根目录>
python3 -m http.server 8943
# 然后打开 http://127.0.0.1:8943/web/index.html
```

导出走浏览器下载；「导出全部」在 `打包 ZIP` 模式下会用 `showSaveFilePicker`
（支持的浏览器）流式写盘，不支持时退回内存打包。

## 桌面版：开发 / 打包

前置：Rust 工具链与 tauri-cli。

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
cargo install tauri-cli --locked          # 提供 `cargo tauri` 命令
```

国内网络慢的话，可在 `~/.cargo/config.toml` 里换源（本地开发用，不随仓库提交）：

```toml
[source.crates-io]
replace-with = 'rsproxy-sparse'

[source.rsproxy-sparse]
registry = "sparse+https://rsproxy.cn/index/"
```

开发（改 `web/` 里的前端后，窗口里直接刷新即可）：

```bash
cd src-tauri
cargo tauri dev
```

打包（先把 `web/` 烤进二进制，再生成安装包）：

```bash
cd src-tauri
cargo tauri build
```

产物：

| 平台 | 路径 |
| --- | --- |
| macOS | `src-tauri/target/release/bundle/macos/Watermark.app`、`bundle/dmg/Watermark_1.0.0_aarch64.dmg` |
| Windows | `src-tauri/target/release/bundle/msi/*.msi`、`bundle/nsis/*-setup.exe` |
| Linux | `src-tauri/target/release/bundle/deb/*.deb`、`bundle/rpm/*.rpm`、`bundle/appimage/*.AppImage` |

> `web/` 是**构建期**烤进二进制的：改完前端要重新 `cargo tauri build` 才会生效。
> 桌面壳不做代码签名，macOS/Windows 首次打开需要手动放行（macOS：右键 →「打开」）。

## 桌面版与网页版的差别

| | 网页版 | 桌面版 |
| --- | --- | --- |
| 导出单张 | 浏览器下载 | 系统「另存为」对话框，可改路径、可取消 |
| 导出全部（打包 ZIP） | `showSaveFilePicker` 流式写盘 / 内存打包 | 弹一次对话框，整包直接写盘 |
| 导出全部（逐张） | 逐张下载，浏览器可能拦截 | 逐张弹「另存为」（记着上次目录） |
| 取消保存 | — | 不算导出成功，队列状态回退，可重试 |

实现说明：

- `src-tauri/src/lib.rs` 的 `save_native(name, b64)` 负责弹对话框并写文件；
  `src-tauri/capabilities/default.json` 只放开了 `core:default` 与 `dialog:default`。
- 前端 `web/app.js` 里的 `saveBlob(blob, name)` 统一入口：有 `window.__TAURI__`
  （`withGlobalTauri: true` 注入）就调 `save_native`，没有就回落到浏览器下载；
  原生对话框异常时也会自动回落，不影响导出。
- 图标：`bash scripts/make-icons.sh` 从 `src-tauri/icons/icon.svg` 生成
  32/128/128@2x/512/1024 PNG 与 `icon.icns`、`icon.ico`（需要 macOS 的 sips/iconutil）。

## 已知限制

- 水印里的品牌 LOGO 与字体依赖本机资源，缺字体时用系统兜底字体。
- 「地名反查」用 Nominatim，需要联网；失败/被限流时退化为显示经纬度，也可手填地点。
- 批量导出是逐张渲染 + 压缩，几百张的大队列会比较慢（进度条与「取消导出」可用）。

## 持续集成

`.github/workflows/build.yml` 在 push / tag 时于 macOS、Windows、Linux 三平台各自
`cargo tauri build`，并把安装包作为 artifacts 上传，便于出全平台安装包。
