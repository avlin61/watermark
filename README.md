## 须知

本项目由 AI 重度辅助开发，目前仍在持续测试和改进中，部分功能可能存在问题。欢迎试用，并通过 Issues 反馈 Bug 或改进建议。

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
  vendor/           本地依赖（exifr，读 EXIF）与第三方许可文本，随仓库附带，离线可用
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
| macOS | `src-tauri/target/release/bundle/macos/Watermark.app`、`bundle/dmg/Watermark_1.0.1_aarch64.dmg` |
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
- 「虚化背景」在网页版（Chrome/Edge）走 canvas 的原生 `ctx.filter`；macOS 桌面壳用的
  WKWebView 不支持该属性，会自动退化为 `web/app.js` 里自实现的三次方框模糊（近似高斯，
  视觉一致）。

## 持续集成

`.github/workflows/build.yml` 在 push / tag 时于 macOS、Windows、Linux 三平台各自
`cargo tauri build`，并把安装包作为 artifacts 上传，便于出全平台安装包。

## 许可

本项目采用 **BSD Zero Clause License（0BSD）**，全文见 [LICENSE](LICENSE)。

- ✅ 可以自由使用、修改、分发、**商业使用**、闭源集成
- ✅ **无需署名**，也无需随作品保留任何声明
- ⚠️ 软件按「原样」提供，作者不提供任何担保，不承担任何赔偿责任

### 第三方资源与许可

| 资源 | 用途 / 位置 | 许可 | 版权与声明 |
| --- | --- | --- | --- |
| [exifr](https://github.com/MikeKovarik/exifr) v7.1.3 | 读取照片 EXIF 元数据（`web/vendor/`） | MIT | © 2020 Mike Kovařík, Mutiny.cz → [LICENSE-exifr.txt](web/vendor/LICENSE-exifr.txt) |
| [simple-icons](https://simpleicons.org) | 品牌 LOGO 矢量路径（`web/logos.js`） | CC0 1.0 | simple-icons contributors |
| [Lucide](https://lucide.dev) | 通用界面图标（`web/logos.js`） | ISC；部分图标源自 Feather（MIT） | © Lucide Icons and Contributors / © 2013-present Cole Bemis → [LICENSE-lucide.txt](web/vendor/LICENSE-lucide.txt) |
| Nominatim / OpenStreetMap | 地名反查（联网） | ODbL | © OpenStreetMap contributors |

> 应用图标（`src-tauri/icons/`）由本项目自制。
>
> 品牌名称与商标（各相机、镜头厂商等）权利归各自所有者。本项目中的品牌 LOGO
> 取自 simple-icons，仅用于照片信息排版中的品牌标识，不代表任何隶属、赞助或
> 授权关系；**商标权不受上述 CC0 / ISC / MIT 许可覆盖**。使用者若将本项目用于
> 商业用途，需自行确认其使用方式不侵犯相关商标权。
>
> 使用 OSM/Nominatim 数据时，请遵守其 [使用政策](https://operations.osmfoundation.org/policies/nominatim/)（含署名与限流要求）。
