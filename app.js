/* ============================================================
   水印框 · 图片信息水印工具
   第二阶段：虚化背景 / 文字样式 / 字段开关 / 地理位置反查 / 自定义文案
   第三阶段：内置矢量 LOGO（文字 or LOGO）/ 像素级文字高度
   全部逻辑在浏览器本地执行，照片不会被上传。
   ============================================================ */

(function () {
  'use strict';

  /* ---------------- DOM ---------------- */
  const $ = (id) => document.getElementById(id);

  const previewPane    = $('previewPane');
  const dropzone       = $('dropzone');
  const fileInput      = $('fileInput');
  const viewer         = $('viewer');
  const fileNameEl     = $('fileName');
  const changeBtn      = $('changeBtn');
  const previewCanvas  = $('previewCanvas');
  const noticeEl       = $('notice');

  const fieldsWrap     = $('fields');
  const exifBadge      = $('exifBadge');

  const geoInput       = $('geoInput');
  const geoStatus      = $('geoStatus');
  const geoRetry       = $('geoRetry');
  const hideLocChk     = $('hideLocChk');

  const bgModeRadios   = arr(document.querySelectorAll('input[name="bgMode"]'));
  const borderLabel    = $('borderLabel');
  const borderRange    = $('borderRange');
  const borderNum      = $('borderNum');
  const bottomRange    = $('bottomRange');
  const bottomNum      = $('bottomNum');
  const borderColorInp = $('borderColor');
  const blurRange      = $('blurRange');
  const blurValEl      = $('blurVal');
  const darkRange      = $('darkRange');
  const darkValEl      = $('darkVal');
  const shadowChk      = $('shadowChk');
  const fitBtn         = $('fitBtn');
  const solidOnly      = $('solidOnly');
  const blurOnly       = $('blurOnly');

  const chipsWrap      = $('contentChips');
  const customInput    = $('customText');
  const customPosRadios = arr(document.querySelectorAll('input[name="customPos"]'));
  const customPosCtl   = $('customPosControl');

  const fontSelect     = $('fontSelect');
  const sizeRange      = $('sizeRange');
  const sizeValEl      = $('sizeVal');
  const gapRange       = $('gapRange');
  const gapValEl       = $('gapVal');
  const autoColorChk   = $('autoColorChk');
  const textColorInp   = $('textColor');
  const alignRadios    = arr(document.querySelectorAll('input[name="align"]'));
  const valignRadios   = arr(document.querySelectorAll('input[name="valign"]'));
  const iconChk        = $('iconChk');

  const brandStyleRadios = arr(document.querySelectorAll('input[name="brandStyle"]'));
  const logoStatusEl   = $('logoStatus');
  const logoGridWrap   = $('logoGrid');
  const logoPickCtl    = $('logoPickControl');
  const logoNameEl     = $('logoName');
  const logoSizeCtl    = $('logoSizeControl');
  const logoSizeRange  = $('logoSizeRange');
  const logoSizeValEl  = $('logoSizeVal');
  const sizeHintEl     = $('sizeHint');

  const formatRadios   = arr(document.querySelectorAll('input[name="format"]'));
  const qualityRow     = $('qualityRow');
  const qualityRange   = $('qualityRange');
  const qualityValEl   = $('qualityVal');
  const exportBtn      = $('exportBtn');

  /* ---------------- 常量 ---------------- */
  const PREVIEW_MAX    = 1600;    // 预览最大边长
  const MAX_CANVAS_DIM = 16384;   // 浏览器画布边长上限（保守值）
  const MAX_CANVAS_PX  = 1.0e8;   // 浏览器画布面积上限（保守值）
  const SEP            = ' · ';

  const FONT_PRESETS = {
    system: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", sans-serif',
    sans: '"Helvetica Neue", Helvetica, Arial, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
    serif: 'Georgia, "Times New Roman", "Songti SC", SimSun, serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Courier New", monospace',
    rounded: '"Avenir Next", "Segoe UI Variable", "Segoe UI", "PingFang SC", system-ui, sans-serif'
  };

  // 内嵌 SVG 图标（24×24 视图框，描边式），用 Path2D 直接绘制，无需异步加载
  const ICONS = {
    pin: [
      'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z',
      'M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0z'
    ],
    calendar: [
      'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
      'M8 2v4',
      'M16 2v4',
      'M3 10h18'
    ]
  };

  /* ---------------- 内置 LOGO 库 ---------------- */
  // 资源由同目录的 logos.js 提供（本地矢量路径，无需联网、无需用户上传）
  const LOGO_SRC = (window.WM_LOGOS && window.WM_LOGOS.brands && window.WM_LOGOS.marks)
    ? window.WM_LOGOS
    : { brands: [], marks: [] };

  const LOGO_ITEMS = Object.create(null);   // key → { key, name, d, stroke }
  const LOGO_BRAND_KEYS = [];               // 品牌 LOGO 顺序（选择器用）
  const LOGO_MARK_KEYS = [];                // 通用标记顺序
  const BRAND_LOGO_RULES = [];              // [RegExp, key]
  const LOGO_CAP = 0.72;                    // LOGO 字形高度 / 文字高度 的默认比值
  const LOGO_FALLBACK = 'aperture';         // 无匹配品牌时的通用标记

  (function initLogoLib() {
    LOGO_SRC.brands.forEach(function (b) {
      LOGO_ITEMS[b.key] = { key: b.key, name: b.name, d: b.d, stroke: 0 };
      LOGO_BRAND_KEYS.push(b.key);
      (b.match || []).forEach(function (p) {
        try { BRAND_LOGO_RULES.push([new RegExp(p, 'i'), b.key]); } catch (e) { /* 忽略非法正则 */ }
      });
    });
    LOGO_SRC.marks.forEach(function (m) {
      LOGO_ITEMS[m.key] = { key: m.key, name: m.name, d: m.d, stroke: Number(m.stroke) || 0 };
      LOGO_MARK_KEYS.push(m.key);
    });
  }());

  // 各行的自动字号（相对照片短边）与字重
  const KIND_STYLE = {
    title:  { size: 0.0300, weight: 650, alpha: 1.00 },
    specs:  { size: 0.0175, weight: 400, alpha: 0.82 },
    meta:   { size: 0.0165, weight: 400, alpha: 0.80 },
    custom: { size: 0.0210, weight: 500, alpha: 0.90 }
  };

  const FIELD_DEFS = [
    { key: 'brand',    label: '品牌',     ph: '如 FUJIFILM' },
    { key: 'model',    label: '型号',     ph: '如 X-T5' },
    { key: 'lens',     label: '镜头',     ph: '如 XF 35mm F1.4', wide: true },
    { key: 'focal',    label: '焦距',     ph: '如 35mm' },
    { key: 'aperture', label: '光圈',     ph: '如 f/1.4' },
    { key: 'shutter',  label: '快门',     ph: '如 1/250s' },
    { key: 'iso',      label: 'ISO',      ph: '如 ISO 640' },
    { key: 'date',     label: '拍摄日期', ph: '如 2024-05-01 18:30', wide: true }
  ];

  const CONTENT_ITEMS = [
    { key: 'brand',    label: '品牌' },
    { key: 'model',    label: '型号' },
    { key: 'lens',     label: '镜头' },
    { key: 'focal',    label: '焦距' },
    { key: 'aperture', label: '光圈' },
    { key: 'shutter',  label: '快门' },
    { key: 'iso',      label: 'ISO' },
    { key: 'date',     label: '拍摄日期' },
    { key: 'location', label: '地理位置' },
    { key: 'custom',   label: '自定义文案' }
  ];

  /* ---------------- 状态 ---------------- */
  const state = {
    fileName: '',
    img: null,
    previewSource: null,
    meta: {},            // 各字段当前显示的值
    visible: {},         // 各字段是否显示
    hasExif: false,
    gps: null,
    locationSource: 'none', // none | auto | manual
    hideLocation: false,
    geoToken: 0,
    customText: '',
    customPos: 'top',
    bgMode: 'solid',
    borderWidth: 80,
    bottomExtra: 240,
    borderColor: '#ffffff',
    blur: 40,
    darken: 20,
    shadow: false,
    fontKey: 'system',
    fontScale: 1,
    gap: 0.8,
    autoColor: true,
    textColor: '#141414',
    align: 'left',
    valign: 'middle',
    icons: true,
    brandStyle: 'text',   // text | logo | both
    logoKey: 'auto',      // auto（按品牌匹配）或具体 LOGO key
    logoScale: 1,         // LOGO 高度相对文字高度的比例
    format: 'png',
    quality: 0.92
  };

  const fieldInputs = {};
  const chipInputs = {};
  let shadowTouched = false;
  let rafId = 0;
  let previewTimer = 0;

  /* ---------------- 基础工具 ---------------- */
  function arr(list) { return Array.prototype.slice.call(list); }

  function cleanStr(v) {
    if (v === null || v === undefined) return '';
    return String(v).replace(/\0/g, '').replace(/\s+/g, ' ').trim();
  }

  function trimNum(n) {
    if (typeof n !== 'number' || !isFinite(n)) return cleanStr(n);
    const r = Math.round(n * 10) / 10;
    return String(r);
  }

  function formatFocal(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'number') return trimNum(v) + 'mm';
    const s = cleanStr(v);
    if (!s) return '';
    return /mm$/i.test(s) ? s : s + 'mm';
  }

  // 曝光时间（秒）→ "1/250s" / "2s"
  function formatShutter(sec) {
    if (typeof sec !== 'number' || !isFinite(sec) || sec <= 0) return '';
    if (sec >= 1) return trimNum(sec) + 's';
    return '1/' + Math.round(1 / sec) + 's';
  }

  function formatDate(dt) {
    const d = dt instanceof Date ? dt : new Date(dt);
    if (isNaN(d.getTime())) return '';
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
      ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function coordText(lat, lon) {
    const ns = lat >= 0 ? 'N' : 'S';
    const ew = lon >= 0 ? 'E' : 'W';
    return Math.abs(lat).toFixed(4) + '°' + ns + ', ' + Math.abs(lon).toFixed(4) + '°' + ew;
  }

  function hexToRgb(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || ''));
    return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
  }

  // 根据底色明暗返回可读的文字颜色
  function contrastColor(hex) {
    const c = hexToRgb(hex) || { r: 255, g: 255, b: 255 };
    const lum = (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255;
    return lum > 0.6 ? '#141414' : '#f4f4f5';
  }

  function effectiveTextColor() {
    if (!state.autoColor) return state.textColor;
    if (state.bgMode === 'blur') return '#ffffff';
    return contrastColor(state.borderColor);
  }

  function buildOutName(name, ext) {
    const base = cleanStr(name || 'image').replace(/\.[^.]+$/, '') || 'image';
    return base + '_framed.' + ext;
  }

  function hasPath2D() { return typeof Path2D === 'function'; }

  // 用 Path2D 绘制内嵌 SVG 图标（尺寸为 size×size 像素）
  function drawIcon(ctx, name, x, y, size, color) {
    const paths = ICONS[name];
    if (!paths || !hasPath2D()) return;
    const s = size / 24;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.1;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < paths.length; i++) ctx.stroke(new Path2D(paths[i]));
    ctx.restore();
  }

  /* ---------------- 内置 LOGO：度量与绘制 ---------------- */
  const logoBoxCache = Object.create(null);   // key → 字形外框（24 单位坐标系）

  // 在 24 单位坐标系里绘制一个 LOGO（度量与正式绘制共用同一套画笔）
  function paintLogo(ctx, item, x, y, scale, color) {
    const p = new Path2D(item.d);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    if (item.stroke) {
      ctx.lineWidth = item.stroke;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = color;
      ctx.stroke(p);
    } else {
      ctx.fillStyle = color;
      ctx.fill(p);
    }
    ctx.restore();
  }

  // 量出 LOGO 的真实字形外框（含描边），让不同 LOGO 的视觉高度保持一致
  function logoBox(key) {
    if (logoBoxCache[key]) return logoBoxCache[key];

    const item = LOGO_ITEMS[key];
    let box = { x0: 0, y0: 0, x1: 24, y1: 24 };   // 兜底：整块 24 单位框
    if (item && hasPath2D()) {
      const S = 240;            // 离屏画布边长
      const M = 8;              // 四周留白（24 单位之外的余量，避免描边被裁）
      const scale = S / (24 + M * 2);
      try {
        const c = document.createElement('canvas');
        c.width = c.height = S;
        const ctx = c.getContext('2d');
        paintLogo(ctx, item, M * scale, M * scale, scale, '#fff');
        const data = ctx.getImageData(0, 0, S, S).data;
        let x0 = S, y0 = S, x1 = -1, y1 = -1;
        for (let y = 0; y < S; y++) {
          for (let x = 0; x < S; x++) {
            if (data[(y * S + x) * 4 + 3] > 16) {
              if (x < x0) x0 = x;
              if (x > x1) x1 = x;
              if (y < y0) y0 = y;
              if (y > y1) y1 = y;
            }
          }
        }
        if (x1 >= x0 && y1 >= y0) {
          box = {
            x0: x0 / scale - M,
            y0: y0 / scale - M,
            x1: (x1 + 1) / scale - M,
            y1: (y1 + 1) / scale - M
          };
        }
      } catch (e) { /* 无法读取像素时退回整块框 */ }
    }
    box.aspect = (box.x1 - box.x0) / Math.max(1e-6, box.y1 - box.y0);
    logoBoxCache[key] = box;
    return box;
  }

  // 以“字形高度 = h 像素”绘制 LOGO，(x, y) 为字形左上角，返回实际宽度
  function drawLogo(ctx, key, x, y, h, color) {
    const item = LOGO_ITEMS[key];
    if (!item || !hasPath2D() || !(h > 0)) return 0;
    const box = logoBox(key);
    const s = h / Math.max(1e-6, box.y1 - box.y0);
    paintLogo(ctx, item, x - box.x0 * s, y - box.y0 * s, s, color);
    return (box.x1 - box.x0) * s;
  }

  function logoWidth(key, h) {
    return logoBox(key).aspect * h;
  }

  // 按 EXIF 品牌名匹配内置 LOGO
  function matchBrandLogo() {
    const brand = cleanStr(state.meta.brand);
    if (!brand) return null;
    for (let i = 0; i < BRAND_LOGO_RULES.length; i++) {
      if (BRAND_LOGO_RULES[i][0].test(brand)) return BRAND_LOGO_RULES[i][1];
    }
    return null;
  }

  // 当前实际使用的 LOGO（自动匹配 / 手动指定 / 通用兜底）
  function resolveLogoKey() {
    if (state.logoKey !== 'auto' && LOGO_ITEMS[state.logoKey]) return state.logoKey;
    return matchBrandLogo() || LOGO_FALLBACK;
  }

  function showLogoMark() {
    if (state.brandStyle === 'text' || !hasPath2D() || !state.visible.brand) return false;
    return !!LOGO_ITEMS[resolveLogoKey()];   // 资源缺失（logos.js 未加载）时退回文字
  }

  function showBrandText() {
    return state.brandStyle === 'text' || state.brandStyle === 'both';
  }

  /* ---------------- 品牌标识 UI（文字 / LOGO 选择器） ---------------- */
  function svgForLogo(item) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', item.d);
    if (item.stroke) {
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', String(item.stroke));
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
    } else {
      path.setAttribute('fill', 'currentColor');
    }
    svg.appendChild(path);
    return svg;
  }

  function buildLogoPicker() {
    if (!logoGridWrap) return;
    logoGridWrap.innerHTML = '';

    const list = [{ key: 'auto', name: '自动（按品牌匹配）' }];
    LOGO_BRAND_KEYS.forEach(function (k) {
      list.push({ key: k, name: '品牌 · ' + LOGO_ITEMS[k].name, item: LOGO_ITEMS[k] });
    });
    LOGO_MARK_KEYS.forEach(function (k) {
      list.push({ key: k, name: '通用标记 · ' + LOGO_ITEMS[k].name, item: LOGO_ITEMS[k] });
    });

    if (list.length === 1) {
      const tip = document.createElement('p');
      tip.className = 'hint';
      tip.textContent = 'LOGO 资源未加载（缺少 logos.js），请改用文字模式或检查文件是否完整。';
      logoGridWrap.appendChild(tip);
      return;
    }

    list.forEach(function (opt) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'logo-opt' + (state.logoKey === opt.key ? ' on' : '');
      btn.title = opt.name;
      btn.setAttribute('aria-label', opt.name);
      btn.dataset.logoKey = opt.key;
      if (opt.item) btn.appendChild(svgForLogo(opt.item));
      else btn.textContent = '自动';
      btn.addEventListener('click', function () {
        state.logoKey = opt.key;
        buildLogoPicker();
        syncLogoStatus();
        schedulePreview();
      });
      logoGridWrap.appendChild(btn);
    });
  }

  function syncLogoStatus() {
    if (!logoStatusEl) return;
    const brand = cleanStr(state.meta.brand);
    const matched = matchBrandLogo();
    let text;
    let kind;

    if (state.logoKey !== 'auto') {
      const it = LOGO_ITEMS[state.logoKey];
      text = '手动选择 · ' + (it ? it.name : '—');
      kind = 'ok';
    } else if (!brand) {
      text = '品牌为空 · 用通用标记';
      kind = 'warn';
    } else if (matched) {
      text = '已匹配 ' + LOGO_ITEMS[matched].name;
      kind = 'ok';
    } else {
      text = '未内置 ' + brand + ' · 用通用标记';
      kind = 'warn';
    }

    logoStatusEl.textContent = text;
    logoStatusEl.title = text;
    logoStatusEl.className = 'mini-status ' + kind;

    if (logoNameEl) {
      const cur = LOGO_ITEMS[resolveLogoKey()];
      logoNameEl.textContent = (cur ? cur.name : '—') + (state.logoKey === 'auto' ? ' · 自动' : '');
    }
  }

  function applyBrandStyle() {
    const noLib = !LOGO_BRAND_KEYS.length && !LOGO_MARK_KEYS.length;
    const needLogo = state.brandStyle !== 'text';

    if (needLogo && (!hasPath2D() || noLib)) {
      state.brandStyle = 'text';
      brandStyleRadios.forEach(function (r) { r.checked = r.value === 'text'; });
      showNotice(noLib
        ? 'LOGO 资源（logos.js）未加载，已改用文字模式。'
        : '当前浏览器不支持矢量 LOGO 绘制（Path2D），已改用文字模式。', 'warn');
    }

    // LOGO 跟随「品牌」勾选显示，切换到 LOGO 模式时自动补勾，避免什么都看不到
    if (state.brandStyle !== 'text' && chipInputs.brand && !chipInputs.brand.checked) {
      chipInputs.brand.checked = true;
      state.visible.brand = true;
    }

    const showCtl = state.brandStyle !== 'text';
    logoPickCtl.classList.toggle('hidden', !showCtl);
    logoSizeCtl.classList.toggle('hidden', !showCtl);

    buildLogoPicker();
    syncLogoSizeLabel();
    syncLogoStatus();
    schedulePreview();
  }

  /* ---------------- 通知 / 徽标 ---------------- */
  function showNotice(msg, kind) {
    noticeEl.textContent = msg;
    noticeEl.className = 'notice ' + (kind || 'info');
    noticeEl.classList.remove('hidden');
  }
  function clearNotice() {
    noticeEl.textContent = '';
    noticeEl.classList.add('hidden');
  }
  function setExifBadge(has) {
    exifBadge.textContent = has ? '已读取 EXIF' : '手动填写';
    exifBadge.className = 'badge ' + (has ? 'badge-ok' : 'badge-warn');
  }
  function setGeoStatus(text, kind) {
    geoStatus.textContent = text;
    geoStatus.className = 'mini-status' + (kind ? ' ' + kind : '');
  }

  /* ---------------- 图片加载 ---------------- */
  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('无法读取图片'));
      };
      img.src = url;
    });
  }

  // 预览用降采样源；图片不大时直接复用原图
  function makePreviewSource(img) {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const scale = Math.min(1, PREVIEW_MAX / Math.max(w, h));
    if (scale >= 1) return img;

    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * scale));
    c.height = Math.max(1, Math.round(h * scale));
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c;
  }

  function sourceSize(src) {
    return {
      w: src.naturalWidth || src.width || 1,
      h: src.naturalHeight || src.height || 1
    };
  }

  /* ---------------- EXIF 解析 ---------------- */
  async function parseExif(file) {
    const values = {};
    let hasExif = false;
    let gps = null;
    let data = null;

    try {
      if (window.exifr && typeof window.exifr.parse === 'function') {
        data = await window.exifr.parse(file);
      }
    } catch (e) {
      data = null;
    }

    if (data) {
      const isoRaw = (data.ISO !== undefined && data.ISO !== null)
        ? data.ISO
        : ((data.ISOSpeedRatings !== undefined && data.ISOSpeedRatings !== null) ? data.ISOSpeedRatings : null);

      values.brand    = cleanStr(data.Make);
      values.model    = cleanStr(data.Model);
      values.lens     = cleanStr(data.LensModel) || cleanStr(data.Lens) || cleanStr(data.LensInfo);
      values.focal    = formatFocal(data.FocalLength);
      values.aperture = (data.FNumber !== undefined && data.FNumber !== null)
        ? 'f/' + trimNum(Number(data.FNumber)) : '';
      values.shutter  = formatShutter(Number(data.ExposureTime));
      values.iso      = (isoRaw !== null && isoRaw !== '') ? 'ISO ' + cleanStr(isoRaw) : '';

      const dt = data.DateTimeOriginal || data.CreateDate || data.ModifyDate || null;
      if (dt) values.date = formatDate(dt);

      hasExif = Object.keys(values).some(function (k) { return values[k]; });
    }

    try {
      if (window.exifr && typeof window.exifr.gps === 'function') {
        const g = await window.exifr.gps(file);
        if (g && isFinite(g.latitude) && isFinite(g.longitude)) {
          gps = { latitude: g.latitude, longitude: g.longitude };
        }
      }
    } catch (e) {
      gps = null;
    }

    return { values: values, hasExif: hasExif, gps: gps };
  }

  /* ---------------- 地名反查（Nominatim） ---------------- */
  const geoCache = Object.create(null);

  function pickPlaceName(json) {
    const a = (json && json.address) || {};
    const prov = a.state || a.province || a.region || a.state_district;
    const city = a.city || a.town || a.village || a.municipality || a.county || a.city_district;
    const country = a.country;
    const parts = [];
    if (prov && prov !== city) parts.push(prov);
    if (city && city !== prov) parts.push(city);
    if (country) parts.push(country);
    let name = parts.filter(Boolean).join(' · ');
    if (!name && json) {
      const dn = cleanStr(json.display_name);
      if (dn) name = dn.split(',').slice(0, 2).join(' · ').trim();
    }
    return name;
  }

  async function reverseGeocode(lat, lon) {
    const key = lat.toFixed(4) + ',' + lon.toFixed(4);
    if (geoCache[key]) return geoCache[key];

    const url = 'https://nominatim.openstreetmap.org/reverse?format=jsonv2' +
      '&lat=' + encodeURIComponent(lat.toFixed(6)) +
      '&lon=' + encodeURIComponent(lon.toFixed(6)) +
      '&zoom=14&addressdetails=1&accept-language=zh-CN%2Czh';

    const ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
    const timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 9000) : null;

    let res;
    try {
      res = await fetch(url, {
        method: 'GET',
        signal: ctrl ? ctrl.signal : undefined,
        headers: { Accept: 'application/json' }
      });
    } finally {
      if (timer) clearTimeout(timer);
    }

    if (!res || !res.ok) throw new Error('HTTP ' + (res ? res.status : 'failed'));
    const json = await res.json();
    const name = pickPlaceName(json);
    if (!name) throw new Error('empty');
    geoCache[key] = name;
    return name;
  }

  async function queryPlaceName(force) {
    if (!state.gps) { setGeoStatus('无 GPS 信息', 'warn'); return; }
    if (state.hideLocation) { setGeoStatus('已隐藏位置', 'warn'); return; }
    if (!force && state.locationSource === 'manual') return;

    const lat = state.gps.latitude;
    const lon = state.gps.longitude;
    const token = ++state.geoToken;
    setGeoStatus('正在反查地名…', 'busy');

    try {
      const name = await reverseGeocode(lat, lon);
      if (token !== state.geoToken) return;
      state.meta.location = name;
      state.locationSource = 'auto';
      geoInput.value = name;
      setGeoStatus('已获取地名', 'ok');
    } catch (e) {
      if (token !== state.geoToken) return;
      state.meta.location = coordText(lat, lon);
      state.locationSource = 'auto';
      geoInput.value = state.meta.location;
      setGeoStatus('反查失败，已显示坐标', 'warn');
      showNotice('地名反查失败（可能无网络或被限流），已改为显示经纬度；你也可以手动填写地点。', 'warn');
    }
    updatePreview();
  }

  /* ---------------- 拍摄信息字段 ---------------- */
  function buildFields() {
    fieldsWrap.innerHTML = '';
    FIELD_DEFS.forEach(function (def) {
      const row = document.createElement('label');
      row.className = 'field' + (def.wide ? ' wide' : '');

      const label = document.createElement('span');
      label.className = 'field-label';
      label.textContent = def.label;

      const input = document.createElement('input');
      input.type = 'text';
      input.id = 'field-' + def.key;
      input.placeholder = def.ph;
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.addEventListener('input', function () {
        state.meta[def.key] = input.value;
        if (def.key === 'brand') syncLogoStatus();   // 品牌变化会改变 LOGO 的自动匹配
        updatePreview();
      });

      row.appendChild(label);
      row.appendChild(input);
      fieldsWrap.appendChild(row);
      fieldInputs[def.key] = input;
    });
  }

  function setMeta(values) {
    FIELD_DEFS.forEach(function (def) {
      const v = values[def.key] || '';
      state.meta[def.key] = v;
      if (fieldInputs[def.key]) fieldInputs[def.key].value = v;
    });
    syncLogoStatus();
  }

  /* ---------------- 内容勾选 ---------------- */
  function buildChips() {
    chipsWrap.innerHTML = '';
    CONTENT_ITEMS.forEach(function (item) {
      const label = document.createElement('label');
      label.className = 'chip';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.id = 'chip-' + item.key;
      cb.checked = true;
      cb.addEventListener('change', function () {
        state.visible[item.key] = cb.checked;
        if (item.key === 'location' && cb.checked && !state.hideLocation && !state.gps) {
          setGeoStatus(cleanStr(state.meta.location) ? '手动填写' : '无 GPS 信息');
        }
        updatePreview();
      });

      const span = document.createElement('span');
      span.textContent = item.label;

      label.appendChild(cb);
      label.appendChild(span);
      chipsWrap.appendChild(label);

      chipInputs[item.key] = cb;
      state.visible[item.key] = true;
    });
  }

  /* ---------------- 文字高度（像素级滑块） ---------------- */
  // 标题行（品牌 / 型号）的自动高度 = 照片短边 × 3%，滑块以“输出像素”为单位微调
  const TITLE_SIZE = KIND_STYLE.title.size;

  function shortSide() {
    return state.img ? Math.min(state.img.naturalWidth, state.img.naturalHeight) : 0;
  }

  function titleAutoPx() {
    return shortSide() * TITLE_SIZE;
  }

  function currentTitlePx() {
    return titleAutoPx() * state.fontScale;
  }

  function syncSizeControl() {
    const auto = titleAutoPx();

    if (!(auto > 0)) {
      sizeRange.disabled = true;
      sizeValEl.textContent = '—';
      sizeHintEl.textContent = '载入图片后可按像素精确调整（步进 1px）。';
      syncLogoSizeLabel();
      return;
    }

    const px = Math.max(1, Math.round(auto * state.fontScale));
    const min = Math.max(4, Math.round(auto * 0.35));
    const max = Math.max(min + 4, Math.round(auto * 3.2));

    sizeRange.disabled = false;
    sizeRange.min = String(min);
    sizeRange.max = String(max);
    sizeRange.value = String(Math.min(Math.max(px, min), max));
    sizeValEl.textContent = px + ' px';
    sizeHintEl.textContent = '自动 ' + Math.round(auto) + 'px（短边 ' + (TITLE_SIZE * 100).toFixed(1) +
      '%） · 当前为短边 ' + (px / Math.max(1, shortSide()) * 100).toFixed(2) + '% · 步进 1px';

    syncLogoSizeLabel();
  }

  function syncLogoSizeLabel() {
    const pct = Math.round(state.logoScale * 100);
    const px = Math.round(currentTitlePx() * LOGO_CAP * state.logoScale);
    logoSizeValEl.textContent = px > 0 ? pct + '% · ' + px + 'px' : pct + '%';
  }

  /* ---------------- 尺寸范围 ---------------- */
  function setupRangesForImage(w, h) {
    const base = Math.min(w, h);

    const bMax = Math.max(50, Math.round(base * 0.2));
    const eMax = Math.max(80, Math.round(base * 0.6));
    borderRange.max = borderNum.max = String(bMax);
    bottomRange.max = bottomNum.max = String(eMax);

    const bDef = Math.max(1, Math.round(base * 0.035));
    const eDef = Math.max(1, Math.round(base * 0.14));

    state.borderWidth = bDef;
    state.bottomExtra = eDef;

    borderRange.value = borderNum.value = String(bDef);
    bottomRange.value = bottomNum.value = String(eDef);

    syncSizeControl();
    syncLogoSizeLabel();
  }

  function bindPair(rangeEl, numEl, onChange) {
    rangeEl.addEventListener('input', function () {
      numEl.value = rangeEl.value;
      onChange(Number(rangeEl.value));
    });
    numEl.addEventListener('input', function () {
      const v = Number(numEl.value);
      if (!isFinite(v)) return;
      const min = Number(rangeEl.min) || 0;
      const max = Number(rangeEl.max) || v;
      const clamped = Math.min(Math.max(v, min), max);
      rangeEl.value = String(clamped);
      onChange(clamped);
    });
    numEl.addEventListener('blur', function () {
      numEl.value = rangeEl.value;
    });
  }

  function setBottomExtra(v) {
    const max = Math.max(Number(bottomRange.max) || 800, Math.ceil(v) + 1);
    bottomRange.max = bottomNum.max = String(max);
    const clamped = Math.max(0, Math.round(v));
    state.bottomExtra = clamped;
    bottomRange.value = bottomNum.value = String(clamped);
    updatePreview();
  }

  // 按当前文字内容计算所需文字区高度
  function autoFitBottom() {
    if (!state.img) return;
    const rows = buildRows();
    if (!rows.length) {
      showNotice('当前没有可排版的文字内容，请先勾选字段或填写信息。', 'info');
      return;
    }
    const fullW = state.img.naturalWidth;
    const fullH = state.img.naturalHeight;
    const scratch = document.createElement('canvas');
    scratch.width = 1;
    scratch.height = 1;
    const ctx = scratch.getContext('2d');
    const box = { x: 0, y: 0, w: fullW, h: 0, scale: 1, base: Math.min(fullW, fullH) };
    const metrics = measureRows(ctx, rows, box, FONT_PRESETS[state.fontKey] || FONT_PRESETS.system, 1);
    setBottomExtra(Math.max(1, metrics.blockH * 1.5));
  }

  /* ---------------- 模式 / 颜色联动 ---------------- */
  function syncTextColorInput() {
    const color = effectiveTextColor();
    if (state.autoColor) {
      textColorInp.value = color;
      textColorInp.disabled = true;
    } else {
      textColorInp.disabled = false;
    }
  }

  function applyMode() {
    const blur = state.bgMode === 'blur';
    solidOnly.classList.toggle('hidden', blur);
    blurOnly.classList.toggle('hidden', !blur);
    borderLabel.textContent = blur ? '四周留白' : '边框宽度';

    if (!shadowTouched) {
      state.shadow = blur;
      shadowChk.checked = blur;
    }
    syncTextColorInput();
    updatePreview();
  }

  /* ---------------- 文字内容 ---------------- */
  function buildRows() {
    const m = state.meta;
    const v = state.visible;
    const rows = [];
    const custom = cleanStr(state.customText);

    if (v.custom && custom && state.customPos === 'top') {
      rows.push({ kind: 'custom', text: custom });
    }

    const logoKey = showLogoMark() ? resolveLogoKey() : null;
    const title = [];
    if (v.brand && showBrandText()) title.push(cleanStr(m.brand));
    if (v.model) title.push(cleanStr(m.model));
    const titleText = title.filter(Boolean).join(' ');
    if (titleText || logoKey) rows.push({ kind: 'title', text: titleText, logo: logoKey });

    const specs = [];
    if (v.lens)     specs.push(cleanStr(m.lens));
    if (v.focal)    specs.push(cleanStr(m.focal));
    if (v.aperture) specs.push(cleanStr(m.aperture));
    if (v.shutter)  specs.push(cleanStr(m.shutter));
    if (v.iso)      specs.push(cleanStr(m.iso));
    const specText = specs.filter(Boolean).join(SEP);
    if (specText) rows.push({ kind: 'specs', text: specText });

    const items = [];
    if (v.location && !state.hideLocation) {
      const loc = cleanStr(m.location);
      if (loc) items.push({ icon: 'pin', text: loc });
    }
    if (v.date) {
      const d = cleanStr(m.date);
      if (d) items.push({ icon: 'calendar', text: d });
    }
    if (items.length) {
      rows.push({
        kind: 'meta',
        items: items,
        text: items.map(function (x) { return x.text; }).join(SEP)
      });
    }

    if (v.custom && custom && state.customPos === 'bottom') {
      rows.push({ kind: 'custom', text: custom });
    }

    return rows;
  }

  /* ---------------- 排版测量 ---------------- */
  function measureRows(ctx, rows, box, stack, f) {
    const base = box.base;
    const iconsOn = state.icons && hasPath2D();
    const out = { sizes: [], widths: [], rowH: [], gaps: [], items: [], sepW: [],
                  logoH: [], logoW: [], logoGap: [], blockH: 0, maxW: 0 };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const st = KIND_STYLE[row.kind];
      const size = Math.max(1, base * st.size * state.fontScale * f * box.scale);
      ctx.font = st.weight + ' ' + Math.round(size) + 'px ' + stack;

      out.sizes[i] = size;
      out.rowH[i] = size;
      out.gaps[i] = 0;
      out.items[i] = [];

      let w;
      if (row.kind === 'meta') {
        const iconSize = size * 1.05;
        const iconGap = size * 0.42;
        const sepW = ctx.measureText(SEP).width;
        out.sepW[i] = sepW;
        let total = 0;
        for (let k = 0; k < row.items.length; k++) {
          const it = row.items[k];
          const textW = ctx.measureText(it.text).width;
          out.items[i].push({
            icon: it.icon, text: it.text, textW: textW,
            iconSize: iconSize, iconGap: iconGap
          });
          if (k > 0) total += sepW;
          if (iconsOn) total += iconSize + iconGap;
          total += textW;
        }
        w = total;
      } else {
        w = row.text ? ctx.measureText(row.text).width : 0;
        // 标题行前面可能有内置 LOGO：生成高度按文字高度比例算，宽度按字形比例算
        if (row.logo) {
          const lh = size * LOGO_CAP * state.logoScale;
          const lw = logoWidth(row.logo, lh);
          const gap = row.text ? size * 0.34 : 0;
          out.logoH[i] = lh;
          out.logoW[i] = lw;
          out.logoGap[i] = gap;
          w += lw + gap;
        }
      }

      out.widths[i] = w;
      if (w > out.maxW) out.maxW = w;
    }

    let blockH = 0;
    for (let i = 0; i < rows.length; i++) {
      blockH += out.sizes[i];
      if (i > 0) {
        const g = state.gap * out.sizes[i];
        out.gaps[i - 1] = g;
        blockH += g;
      }
    }
    out.blockH = blockH;
    return out;
  }

  /* ---------------- 绘制文字区 ---------------- */
  function drawTextArea(ctx, box) {
    const rows = buildRows();
    if (!rows.length || box.h <= 1) return;

    const stack = FONT_PRESETS[state.fontKey] || FONT_PRESETS.system;
    const color = effectiveTextColor();
    const iconsOn = state.icons && hasPath2D();

    // 先按原始字号测量，必要时整体等比缩小以适配边框区域
    let f = 1;
    let metrics = measureRows(ctx, rows, box, stack, f);
    const availH = Math.max(1, box.h * 0.86);
    if (metrics.maxW > box.w || metrics.blockH > availH) {
      const fitW = metrics.maxW > box.w ? box.w / metrics.maxW : 1;
      const fitH = metrics.blockH > availH ? availH / metrics.blockH : 1;
      f = Math.max(0.25, Math.min(fitW, fitH));
      metrics = measureRows(ctx, rows, box, stack, f);
    }

    // 垂直定位
    const slack = Math.max(0, box.h - metrics.blockH);
    const padY = Math.min(Math.max(1, box.h * 0.08), slack / 2);
    let y = box.y + padY;
    if (state.valign === 'middle') y = box.y + slack / 2;
    else if (state.valign === 'bottom') y = box.y + box.h - padY - metrics.blockH;
    y = Math.max(box.y, Math.min(y, box.y + box.h - metrics.blockH));

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    rows.forEach(function (row, i) {
      const st = KIND_STYLE[row.kind];
      const size = metrics.sizes[i];
      const rowW = metrics.widths[i];

      let x;
      if (state.align === 'center') x = box.x + (box.w - rowW) / 2;
      else if (state.align === 'right') x = box.x + box.w - rowW;
      else x = box.x;

      ctx.save();
      ctx.globalAlpha = st.alpha;
      ctx.fillStyle = color;
      ctx.font = st.weight + ' ' + Math.round(size) + 'px ' + stack;

      if (row.kind === 'meta') {
        const sepW = metrics.sepW[i];
        let cx = x;
        metrics.items[i].forEach(function (it, k) {
          if (k > 0) {
            ctx.fillText(SEP, cx, y);
            cx += sepW;
          }
          if (iconsOn) {
            drawIcon(ctx, it.icon, cx, y + (size - it.iconSize) / 2, it.iconSize, color);
            cx += it.iconSize + it.iconGap;
          }
          ctx.fillText(it.text, cx, y);
          cx += it.textW;
        });
      } else {
        let tx = x;
        if (row.logo) {
          const lh = metrics.logoH[i] || 0;
          drawLogo(ctx, row.logo, x, y + (size - lh) / 2, lh, color);
          tx = x + (metrics.logoW[i] || 0) + (row.text ? (metrics.logoGap[i] || 0) : 0);
        }
        if (row.text) ctx.fillText(row.text, tx, y);
      }
      ctx.restore();

      y += metrics.rowH[i] + metrics.gaps[i];
    });
  }

  /* ---------------- 背景 ---------------- */
  function blurPixels(cw, ch) {
    const dim = Math.min(cw, ch);
    return Math.max(0, (state.blur / 100) * dim * 0.10);
  }

  // 原图 cover 铺满画布 + 高斯模糊（先小画布再放大，性能更好）
  function drawBlurBg(ctx, source, cw, ch) {
    const src = sourceSize(source);
    const tmpW = Math.max(8, Math.min(cw, 1024));
    const tmpH = Math.max(8, Math.round(ch * tmpW / cw));

    const tmp = document.createElement('canvas');
    tmp.width = tmpW;
    tmp.height = tmpH;
    const tctx = tmp.getContext('2d');
    const cover = Math.max(tmpW / src.w, tmpH / src.h);
    const dw = src.w * cover;
    const dh = src.h * cover;
    tctx.imageSmoothingEnabled = true;
    tctx.imageSmoothingQuality = 'high';
    tctx.drawImage(source, (tmpW - dw) / 2, (tmpH - dh) / 2, dw, dh);

    const blurPx = blurPixels(cw, ch);
    const canFilter = ('filter' in ctx);
    // 高斯核有效支持半径约 3σ，出血量取 3.5 倍以避免画布边缘出现透明度
    const bleed = Math.ceil(blurPx * 3.5) + 4;

    ctx.save();
    if (canFilter) ctx.filter = 'blur(' + blurPx.toFixed(2) + 'px)';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(tmp, -bleed, -bleed, cw + bleed * 2, ch + bleed * 2);
    if (canFilter) ctx.filter = 'none';
    ctx.restore();
  }

  /* ---------------- 合成画布 ---------------- */
  // source：待绘制图片（原图或缩略图）
  // scale：相对原始分辨率的缩放系数（预览 < 1，导出 = 1）
  function compose(source, scale, fullW, fullH, targetCanvas) {
    const b  = Math.round(state.borderWidth * scale);
    const be = Math.round(state.bottomExtra * scale);
    const drawW = Math.max(1, Math.round(fullW * scale));
    const drawH = Math.max(1, Math.round(fullH * scale));
    const cw = drawW + b * 2;
    const ch = drawH + b * 2 + be;

    const canvas = targetCanvas || document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    ctx.clearRect(0, 0, cw, ch);

    if (state.bgMode === 'blur') {
      drawBlurBg(ctx, source, cw, ch);
      if (state.darken > 0) {
        ctx.fillStyle = 'rgba(0, 0, 0, ' + (state.darken / 100) + ')';
        ctx.fillRect(0, 0, cw, ch);
      }
    } else {
      ctx.fillStyle = state.borderColor;
      ctx.fillRect(0, 0, cw, ch);
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 照片投影
    if (state.shadow) {
      const blurPx = Math.max(2, Math.min(cw, ch) * 0.012);
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = blurPx;
      ctx.shadowOffsetY = blurPx * 0.35;
      ctx.fillStyle = '#000';
      ctx.fillRect(b, b, drawW, drawH);
      ctx.restore();
    }

    // 原图：保持原始比例与分辨率（导出 scale = 1 时不缩放）
    ctx.drawImage(source, b, b, drawW, drawH);

    drawTextArea(ctx, {
      x: b,
      y: b + drawH,
      w: drawW,
      h: be,
      scale: scale,
      base: Math.min(fullW, fullH)
    });

    return canvas;
  }

  /* ---------------- 预览 ---------------- */
  // 合并多次输入；rAF 优先，若 rAF 不触发（隐藏标签页 / 无头环境）则由定时器兜底
  function schedulePreview() {
    if (rafId || previewTimer) return;
    const run = function () {
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      if (previewTimer) { clearTimeout(previewTimer); previewTimer = 0; }
      updatePreview();
    };
    rafId = requestAnimationFrame(run);
    previewTimer = setTimeout(run, 40);
  }

  function updatePreview() {
    if (!state.img) return;
    const fullW = state.img.naturalWidth;
    const fullH = state.img.naturalHeight;
    const psrc = state.previewSource || state.img;
    const scale = (psrc === state.img) ? 1 : (psrc.width / fullW);
    compose(psrc, scale, fullW, fullH, previewCanvas);
  }

  /* ---------------- 导出 ---------------- */
  function doExport() {
    if (!state.img || exportBtn.disabled) return;

    const fullW = state.img.naturalWidth;
    const fullH = state.img.naturalHeight;
    const b = Math.round(state.borderWidth);
    const be = Math.round(state.bottomExtra);
    const cw = fullW + b * 2;
    const ch = fullH + b * 2 + be;

    if (cw > MAX_CANVAS_DIM || ch > MAX_CANVAS_DIM || cw * ch > MAX_CANVAS_PX) {
      showNotice('成品尺寸 ' + cw + ' × ' + ch +
        ' 超出浏览器画布上限，请减小边框宽度或底部文字区高度后重试。', 'warn');
      return;
    }

    exportBtn.disabled = true;
    const oldLabel = exportBtn.textContent;
    exportBtn.textContent = '正在导出…';

    const done = function () {
      exportBtn.disabled = false;
      exportBtn.textContent = oldLabel;
    };

    try {
      // 导出始终使用原始分辨率原图，不做任何缩放与压缩
      const canvas = compose(state.img, 1, fullW, fullH);

      const isJpeg = state.format === 'jpeg';
      const type = isJpeg ? 'image/jpeg' : 'image/png';
      const quality = isJpeg ? state.quality : undefined;

      canvas.toBlob(function (blob) {
        if (!blob) {
          showNotice('导出失败：无法生成图片数据。', 'warn');
          done();
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = buildOutName(state.fileName, isJpeg ? 'jpg' : 'png');
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);

        showNotice('已导出 ' + canvas.width + ' × ' + canvas.height +
          ' 的成品图（原图保持原始分辨率）。', 'ok');
        done();
      }, type, quality);
    } catch (err) {
      showNotice('导出失败：图片尺寸可能超出浏览器画布上限，请尝试减小边框或更换较小的图片。', 'warn');
      done();
    }
  }

  /* ---------------- 处理文件 ---------------- */
  async function handleFile(file) {
    if (!file) return;

    const name = String(file.name || '');
    const lower = name.toLowerCase();

    // HEIC 检测
    if (/\.(heic|heif)$/.test(lower) || /image\/hei[cf]/i.test(file.type || '')) {
      showNotice('HEIC / HEIF 格式暂不支持，请先转换为 JPG 或 PNG 后再试。', 'warn');
      return;
    }
    if (!/^image\//i.test(file.type || '') &&
        !/\.(jpe?g|png|webp|bmp|gif|avif|tiff?)$/.test(lower)) {
      showNotice('请选择图片文件（JPG / PNG 等）。', 'warn');
      return;
    }

    clearNotice();
    state.fileName = name || 'image';

    let img;
    try {
      img = await loadImage(file);
    } catch (err) {
      showNotice('无法读取该图片，格式可能不受支持。', 'warn');
      return;
    }

    state.img = img;

    const libOk = !!(window.exifr && typeof window.exifr.parse === 'function');
    const parsed = libOk
      ? await parseExif(file)
      : { values: {}, hasExif: false, gps: null };

    setMeta(parsed.values);
    state.hasExif = parsed.hasExif;
    state.gps = parsed.gps;
    state.locationSource = 'none';
    state.geoToken++;               // 作废上一张图未完成的反查请求
    setExifBadge(parsed.hasExif);

    // 位置：先落坐标为兜底值，再异步反查地名
    if (state.gps && !state.hideLocation) {
      state.meta.location = coordText(state.gps.latitude, state.gps.longitude);
      state.locationSource = 'auto';
      geoInput.value = state.meta.location;
      queryPlaceName(false);
    } else {
      state.meta.location = '';
      geoInput.value = '';
      if (state.hideLocation) setGeoStatus('已隐藏位置', 'warn');
      else setGeoStatus(state.gps ? '未获取' : '无 GPS 信息');
    }

    setupRangesForImage(img.naturalWidth, img.naturalHeight);
    state.previewSource = makePreviewSource(img);

    dropzone.classList.add('hidden');
    viewer.classList.remove('hidden');
    fileNameEl.textContent = state.fileName;
    fileNameEl.title = state.fileName;
    exportBtn.disabled = false;

    updatePreview();

    if (!libOk) {
      showNotice('EXIF 解析库未加载（请检查网络连接），请在右侧手动填写拍摄信息。', 'warn');
    } else if (!parsed.hasExif) {
      showNotice('未检测到拍摄信息，请在右侧手动填写相关字段。', 'info');
    }
  }

  /* ---------------- 拖拽 ---------------- */
  function attachDrop(el) {
    ['dragenter', 'dragover'].forEach(function (ev) {
      el.addEventListener(ev, function (e) {
        e.preventDefault();
        e.stopPropagation();
        previewPane.classList.add('drag');
      });
    });
    ['dragleave', 'dragend'].forEach(function (ev) {
      el.addEventListener(ev, function (e) {
        e.preventDefault();
        previewPane.classList.remove('drag');
      });
    });
    el.addEventListener('drop', function (e) {
      e.preventDefault();
      e.stopPropagation();
      previewPane.classList.remove('drag');
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) handleFile(f);
    });
  }

  /* ---------------- 初始化 ---------------- */
  function init() {
    buildFields();
    buildChips();
    buildLogoPicker();

    bindPair(borderRange, borderNum, function (v) {
      state.borderWidth = v;
      schedulePreview();
    });
    bindPair(bottomRange, bottomNum, function (v) {
      state.bottomExtra = v;
      schedulePreview();
    });

    borderColorInp.addEventListener('input', function () {
      state.borderColor = borderColorInp.value;
      syncTextColorInput();
      schedulePreview();
    });

    blurRange.addEventListener('input', function () {
      state.blur = Number(blurRange.value);
      blurValEl.textContent = Math.round(state.blur) + '%';
      schedulePreview();
    });

    darkRange.addEventListener('input', function () {
      state.darken = Number(darkRange.value);
      darkValEl.textContent = Math.round(state.darken) + '%';
      schedulePreview();
    });

    shadowChk.addEventListener('change', function () {
      shadowTouched = true;
      state.shadow = shadowChk.checked;
      schedulePreview();
    });

    fitBtn.addEventListener('click', autoFitBottom);

    bgModeRadios.forEach(function (r) {
      r.addEventListener('change', function () {
        if (!r.checked) return;
        state.bgMode = r.value;
        applyMode();
      });
    });

    customInput.addEventListener('input', function () {
      state.customText = customInput.value;
      schedulePreview();
    });

    customPosRadios.forEach(function (r) {
      r.addEventListener('change', function () {
        if (!r.checked) return;
        state.customPos = r.value;
        schedulePreview();
      });
    });

    geoInput.addEventListener('input', function () {
      state.meta.location = geoInput.value;
      state.locationSource = 'manual';
      setGeoStatus(cleanStr(geoInput.value) ? '手动填写' : '未获取');
      schedulePreview();
    });

    geoRetry.addEventListener('click', function () { queryPlaceName(true); });

    hideLocChk.addEventListener('change', function () {
      state.hideLocation = hideLocChk.checked;
      geoInput.disabled = state.hideLocation;
      geoRetry.disabled = state.hideLocation;
      if (state.hideLocation) {
        setGeoStatus('已隐藏位置', 'warn');
      } else if (state.gps && state.locationSource !== 'manual') {
        queryPlaceName(true);
        return;
      } else if (cleanStr(state.meta.location)) {
        setGeoStatus('手动填写');
      } else {
        setGeoStatus(state.gps ? '未获取' : '无 GPS 信息');
      }
      updatePreview();
    });

    fontSelect.addEventListener('change', function () {
      state.fontKey = fontSelect.value;
      schedulePreview();
    });

    sizeRange.addEventListener('input', function () {
      const auto = titleAutoPx();
      if (!(auto > 0)) return;
      const px = Number(sizeRange.value);
      state.fontScale = px / auto;         // 内部仍以比例存储，保证预览/导出与不同分辨率一致
      sizeValEl.textContent = px + ' px';
      syncSizeControl();                   // 刷新提示与 LOGO 高度换算
      schedulePreview();
    });

    brandStyleRadios.forEach(function (r) {
      r.addEventListener('change', function () {
        if (!r.checked) return;
        state.brandStyle = r.value;
        applyBrandStyle();
      });
    });

    logoSizeRange.addEventListener('input', function () {
      state.logoScale = Number(logoSizeRange.value);
      syncLogoSizeLabel();
      schedulePreview();
    });

    gapRange.addEventListener('input', function () {
      state.gap = Number(gapRange.value);
      gapValEl.textContent = state.gap.toFixed(2);
      schedulePreview();
    });

    autoColorChk.addEventListener('change', function () {
      state.autoColor = autoColorChk.checked;
      syncTextColorInput();
      schedulePreview();
    });

    textColorInp.addEventListener('input', function () {
      state.textColor = textColorInp.value;
      state.autoColor = false;
      autoColorChk.checked = false;
      textColorInp.disabled = false;
      schedulePreview();
    });

    alignRadios.forEach(function (r) {
      r.addEventListener('change', function () {
        if (!r.checked) return;
        state.align = r.value;
        schedulePreview();
      });
    });

    valignRadios.forEach(function (r) {
      r.addEventListener('change', function () {
        if (!r.checked) return;
        state.valign = r.value;
        schedulePreview();
      });
    });

    iconChk.addEventListener('change', function () {
      state.icons = iconChk.checked;
      schedulePreview();
    });

    formatRadios.forEach(function (r) {
      r.addEventListener('change', function () {
        if (!r.checked) return;
        state.format = r.value;
        qualityRow.classList.toggle('hidden', r.value !== 'jpeg');
      });
    });

    qualityRange.addEventListener('input', function () {
      state.quality = Number(qualityRange.value);
      qualityValEl.textContent = Math.round(state.quality * 100) + '%';
    });

    exportBtn.addEventListener('click', doExport);

    dropzone.addEventListener('click', function () { fileInput.click(); });
    changeBtn.addEventListener('click', function () { fileInput.click(); });

    fileInput.addEventListener('change', function () {
      const f = fileInput.files && fileInput.files[0];
      if (f) handleFile(f);
      fileInput.value = '';
    });

    attachDrop(previewPane);
    window.addEventListener('dragover', function (e) { e.preventDefault(); });
    window.addEventListener('drop', function (e) { e.preventDefault(); });

    setExifBadge(false);
    qualityRow.classList.add('hidden');
    syncTextColorInput();
    applyMode();
    syncSizeControl();
    applyBrandStyle();
  }

  init();
})();
