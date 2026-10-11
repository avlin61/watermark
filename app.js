/* ============================================================
   水印框 · 图片信息水印工具
   第二阶段：虚化背景 / 文字样式 / 字段开关 / 地理位置反查 / 自定义文案
   第三阶段：内置矢量 LOGO（文字 or LOGO）/ 像素级文字高度
   第四阶段：文字块垂直位置微调（1px）/ LOGO 与型号文字底部对齐
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
  const posRange       = $('posRange');
  const posValEl       = $('posVal');
  const posHintEl      = $('posHint');

  const formatRadios   = arr(document.querySelectorAll('input[name="format"]'));
  const qualityRow     = $('qualityRow');
  const qualityRange   = $('qualityRange');
  const qualityValEl   = $('qualityVal');
  const exportBtn      = $('exportBtn');

  // 批量队列
  const addBtn          = $('addBtn');
  const prevBtn         = $('prevBtn');
  const nextBtn         = $('nextBtn');
  const batchPosEl      = $('batchPos');
  const batchStrip      = $('batchStrip');
  const clearBtn        = $('clearBtn');
  const queueSummaryEl  = $('queueSummary');
  const batchBadgeEl    = $('batchBadge');
  const prepProgressEl  = $('prepProgress');
  const prepBarEl       = $('prepBar');
  const prepTextEl      = $('prepText');
  const geocodeChk      = $('geocodeChk');
  const geoProgressEl   = $('geoProgress');
  const geoBarEl        = $('geoBar');
  const geoTextEl       = $('geoText');
  const batchCountEl    = $('batchCount');
  const batchModeRadios = arr(document.querySelectorAll('input[name="batchMode"]'));
  const exportAllBtn    = $('exportAllBtn');
  const exportProgressEl = $('exportProgress');
  const exportBarEl     = $('exportBar');
  const exportTextEl    = $('exportText');
  const exportCancelBtn = $('exportCancelBtn');

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
    textOffset: 0,        // 文字块垂直微调（输出像素，正 = 向下）
    icons: true,
    brandStyle: 'text',   // text | logo | both
    logoKey: 'auto',      // auto（按品牌匹配）或具体 LOGO key
    logoScale: 1,         // LOGO 高度相对文字高度的比例
    format: 'png',
    quality: 0.92,
    batchMode: 'zip'      // 批量导出方式：zip（打包）/ each（逐张下载）
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

  /* ---------------- 字体度量（行顶 → 基线 / 大写字高） ---------------- */
  // 用像素采样量出“行顶到基线”的偏移与大写字高：
  //  · LOGO 据此与文字底部真正对齐（不是简单地垂直居中）
  //  · LOGO 高度 / 高度读数也换算成真实像素
  const fontMetricCache = Object.create(null);
  let scratchCanvas = null;

  function scratchCtx() {
    if (!scratchCanvas) {
      scratchCanvas = document.createElement('canvas');
      scratchCanvas.width = 1;
      scratchCanvas.height = 1;
    }
    return scratchCanvas.getContext('2d');
  }

  // textBaseline = 'top' 时绘制 'H'（下缘正好在基线上），像素范围即给出 ascent 与 cap
  function fontMetrics(stack, weight, px) {
    const size = Math.max(1, Math.round(px));
    const key = weight + '|' + size + '|' + stack;
    if (fontMetricCache[key]) return fontMetricCache[key];

    let res = { ascent: size * 0.90, cap: size * LOGO_CAP };   // 读不到像素时的估算值
    try {
      const w = Math.max(8, Math.ceil(size * 4));
      const h = Math.max(8, Math.ceil(size * 2.4));
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const g = c.getContext('2d');
      const y0 = Math.ceil(size * 0.7);
      g.font = weight + ' ' + size + 'px ' + stack;
      g.textAlign = 'left';
      g.textBaseline = 'top';
      g.fillStyle = '#fff';
      g.fillText('H', 1, y0);
      const data = g.getImageData(0, 0, w, h).data;
      let top = -1;
      let bot = -1;
      for (let y = 0; y < h; y++) {
        let ink = false;
        for (let x = 0; x < w; x++) {
          if (data[(y * w + x) * 4 + 3] > 16) { ink = true; break; }
        }
        if (!ink) continue;
        if (top < 0) top = y;
        bot = y;
      }
      if (top >= 0 && bot > top) res = { ascent: bot + 1 - y0, cap: bot + 1 - top };
    } catch (e) { /* 忽略：使用估算值 */ }

    fontMetricCache[key] = res;
    return res;
  }

  // 字符串在基线以下的可见深度（"X-T5" 这类无下降部的型号 ≈ 0）
  function inkDescent(ctx, str) {
    if (!str) return 0;
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    const m = ctx.measureText(str);
    ctx.restore();
    const d = m.actualBoundingBoxDescent;
    return (typeof d === 'number' && isFinite(d) && d > 0) ? d : 0;
  }

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

  // 地名反查结果回写到队列项，切换图片后不会丢失
  function syncActiveGeoItem(failed) {
    const item = activeItem();
    if (!item) return;
    item.values.location = state.meta.location;
    item.geoSource = state.locationSource;
    if (item.geoSource === 'auto') item.geoFailed = !!failed;
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
      syncActiveGeoItem(false);
    } catch (e) {
      if (token !== state.geoToken) return;
      state.meta.location = coordText(lat, lon);
      state.locationSource = 'auto';
      geoInput.value = state.meta.location;
      setGeoStatus('反查失败，已显示坐标', 'warn');
      showNotice('地名反查失败（可能无网络或被限流），已改为显示经纬度；你也可以手动填写地点。', 'warn');
      syncActiveGeoItem(true);
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
        markActiveEdited();                          // 手工填写优先，后台读取完成不再覆盖
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
      syncPosControl();
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
    syncPosControl();
  }

  function syncLogoSizeLabel() {
    const pct = Math.round(state.logoScale * 100);
    const stack = FONT_PRESETS[state.fontKey] || FONT_PRESETS.system;
    const titlePx = Math.round(currentTitlePx());
    const cap = titlePx > 0 ? fontMetrics(stack, KIND_STYLE.title.weight, titlePx).cap : 0;
    const px = Math.round(cap * state.logoScale);
    logoSizeValEl.textContent = px > 0 ? pct + '% · ' + px + 'px' : pct + '%';
  }

  /* ---------------- 垂直位置（像素微调） ---------------- */
  // 以「垂直对齐」为基准上下微调：滑块值 = 输出像素偏移（1px 步进）
  function outputBox() {
    const fullW = state.img.naturalWidth;
    const fullH = state.img.naturalHeight;
    const b = Math.round(state.borderWidth);
    const be = Math.round(state.bottomExtra);
    return {
      x: b,
      y: b + fullH,
      w: fullW,
      h: be,
      scale: 1,
      base: Math.min(fullW, fullH),
      canvasH: fullH + b * 2 + be
    };
  }

  function disablePosControl(hint) {
    posRange.disabled = true;
    posRange.min = '-1';
    posRange.max = '1';
    posRange.value = '0';
    state.textOffset = 0;
    posValEl.textContent = '—';
    posHintEl.textContent = hint;
  }

  function syncPosControl() {
    if (!posRange) return;

    if (!state.img) {
      disablePosControl('载入图片后可按像素上下微调（1px 步进）。');
      return;
    }

    const box = outputBox();
    const lay = textLayout(box);
    if (!lay.rows.length || box.h <= 1) {
      disablePosControl('当前没有可排版的文字内容。');
      return;
    }

    const lim = textBlockY(box, lay.metrics, 0);
    const lo = Math.min(Math.round(lim.minY - lim.base), Math.round(lim.maxY - lim.base));
    const hi = Math.max(Math.round(lim.minY - lim.base), Math.round(lim.maxY - lim.base));

    state.textOffset = Math.min(Math.max(state.textOffset, lo), hi);

    posRange.disabled = hi <= lo;
    posRange.min = String(lo);
    posRange.max = String(hi);
    posRange.value = String(state.textOffset);

    const gapPx = Math.round(box.canvasH - (lim.y + state.textOffset + lay.metrics.blockInkH));
    posValEl.textContent = (state.textOffset > 0 ? '+' : '') + state.textOffset + ' px';
    posHintEl.textContent = '文字下缘距画布底 ' + gapPx + 'px · 可在 ' + lo + ' ~ ' +
      (hi > 0 ? '+' : '') + hi + 'px 内微调（1px 步进）；改「垂直对齐」会归零。';
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
                  logoH: [], logoW: [], logoGap: [], asc: [], inkBottom: [], topOver: [],
                  blockH: 0, blockInkH: 0, topGuard: 0, maxW: 0 };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const st = KIND_STYLE[row.kind];
      const size = Math.max(1, base * st.size * state.fontScale * f * box.scale);
      ctx.font = st.weight + ' ' + Math.round(size) + 'px ' + stack;

      const fm = fontMetrics(stack, st.weight, Math.round(size));

      out.sizes[i] = size;
      out.rowH[i] = size;
      out.gaps[i] = 0;
      out.items[i] = [];
      out.asc[i] = fm.ascent;                                     // 行顶 → 文字基线
      out.inkBottom[i] = fm.ascent + (row.text ? inkDescent(ctx, row.text) : 0);  // 行顶 → 可见下缘
      out.topOver[i] = 0;

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
        if (iconsOn) out.inkBottom[i] = Math.max(out.inkBottom[i], (size + iconSize) / 2);
      } else {
        w = row.text ? ctx.measureText(row.text).width : 0;
        // 标题行前面可能有内置 LOGO：高度取文字的大写字高，底部与文字可见下缘对齐
        if (row.logo) {
          const lh = fm.cap * state.logoScale;
          const lw = logoWidth(row.logo, lh);
          const gap = row.text ? size * 0.34 : 0;
          out.logoH[i] = lh;
          out.logoW[i] = lw;
          out.logoGap[i] = gap;
          out.topOver[i] = Math.max(0, lh - out.inkBottom[i]);   // LOGO 顶高出文字下缘的部分
          w += lw + gap;
        }
      }

      out.widths[i] = w;
      if (w > out.maxW) out.maxW = w;
    }

    let blockH = 0;
    let topGuard = 0;
    let inkH = 0;
    for (let i = 0; i < rows.length; i++) {
      if (out.topOver[i] > 0) topGuard = Math.max(topGuard, out.topOver[i] - blockH);
      if (blockH + out.inkBottom[i] > inkH) inkH = blockH + out.inkBottom[i];
      blockH += out.sizes[i];
      if (i > 0) {
        const g = state.gap * out.sizes[i];
        out.gaps[i - 1] = g;
        blockH += g;
      }
    }
    out.blockH = blockH;
    out.topGuard = topGuard;     // 块顶之上还需留出的空间（LOGO 顶部高出时）
    out.blockInkH = inkH;        // 块顶 → 可见下缘
    return out;
  }

  /* ---------------- 排版求解（测量 → 适配 → 垂直定位） ---------------- */
  function textLayout(box) {
    const rows = buildRows();
    const stack = FONT_PRESETS[state.fontKey] || FONT_PRESETS.system;
    const ctx = scratchCtx();

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

    return { rows: rows, stack: stack, ctx: ctx, f: f, metrics: metrics };
  }

  // 文字块上边界：垂直对齐得到基准位置，再叠加像素微调，并保证不越出边框区域
  function textBlockY(box, metrics, offsetPx) {
    const slack = Math.max(0, box.h - metrics.blockH);
    const padY = Math.min(Math.max(1, box.h * 0.08), slack / 2);

    let y = box.y + padY;
    if (state.valign === 'middle') y = box.y + slack / 2;
    else if (state.valign === 'bottom') y = box.y + box.h - padY - metrics.blockH;

    const base = y;
    const minY = box.y + metrics.topGuard;
    const maxY = Math.max(minY, box.y + box.h - metrics.blockH);
    const off = (offsetPx || 0) * (box.scale || 1);

    y = Math.max(minY, Math.min(base + off, maxY));
    return { y: y, base: base, minY: minY, maxY: maxY };
  }

  /* ---------------- 绘制文字区 ---------------- */
  function drawTextArea(ctx, box) {
    const lay = textLayout(box);
    const rows = lay.rows;
    if (!rows.length || box.h <= 1) return;

    const stack = lay.stack;
    const metrics = lay.metrics;
    const color = effectiveTextColor();
    const iconsOn = state.icons && hasPath2D();

    // 垂直定位（含 1px 微调）
    let y = textBlockY(box, metrics, state.textOffset).y;

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
          // 底部对齐：LOGO 下缘 = 文字可见下缘（型号这类无下降部的文字即基线）
          const inkBottom = y + (metrics.inkBottom[i] || 0);
          drawLogo(ctx, row.logo, x, inkBottom - lh, lh, color);
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
    syncPosControl();
  }

  /* ---------------- 导出 ---------------- */
  function doExport() {
    if (!state.img || exportBtn.disabled) return;

    const fullW = state.img.naturalWidth;
    const fullH = state.img.naturalHeight;

    try {
      checkOutputSize(fullW, fullH);
    } catch (e) {
      showNotice(String((e && e.message) || e) + '，请减小边框宽度或底部文字区高度后重试。', 'warn');
      return;
    }

    exportBtn.disabled = true;
    const oldLabel = exportBtn.textContent;
    exportBtn.textContent = '正在导出…';

    const done = function () {
      exportBtn.textContent = oldLabel;
      updateBatchUI();          // 恢复按钮可用状态
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
        triggerDownload(url, buildOutName(state.fileName, isJpeg ? 'jpg' : 'png'));
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

  /* ---------------- 批量队列 ---------------- */
  // 一批照片共用右侧所有样式设置；每张只保留自己的拍摄信息与（按需解码的）大图。
  // 状态：pending（待读取）/ prep（读取中）/ ready（就绪）/ done（本次已导出）/ error（读取失败）
  const batch = {
    items: [],
    activeId: 0,
    seq: 0,
    rangesReady: false,   // 是否已按图片尺寸初始化过边框 / 文字区范围
    prepToken: 0,
    prepRunning: false,
    lastAdd: 0,
    exporting: false,
    exportCancel: false,
    geocoding: false,
    geoToken: 0,
    geoCancel: false
  };

  let exportCanvasEl = null;

  function itemById(id) {
    for (let i = 0; i < batch.items.length; i++) {
      if (batch.items[i].id === id) return batch.items[i];
    }
    return null;
  }

  function activeItem() {
    return itemById(batch.activeId) || batch.items[0] || null;
  }

  function activeIndex() {
    const cur = activeItem();
    return cur ? batch.items.indexOf(cur) : -1;
  }

  // 队列里的某张被用户手改过（避免后台读取完成时把手工输入覆盖掉）
  function markActiveEdited() {
    const item = activeItem();
    if (item) item.userEdited = true;
  }

  function fileKindError(file) {
    const name = String((file && file.name) || '');
    const lower = name.toLowerCase();
    if (/\.(heic|heif)$/.test(lower) || /image\/hei[cf]/i.test((file && file.type) || '')) {
      return 'HEIC / HEIF 格式暂不支持，请先转换为 JPG 或 PNG 后再试。';
    }
    if (!/^image\//i.test((file && file.type) || '') &&
        !/\.(jpe?g|png|webp|bmp|gif|avif|tiff?)$/.test(lower)) {
      return '请选择图片文件（JPG / PNG 等）。';
    }
    return '';
  }

  function newItem(file) {
    batch.seq++;
    return {
      id: batch.seq,
      file: file,
      name: String((file && file.name) || ('image' + batch.seq)),
      status: 'pending',
      values: {},          // 该张自己的拍摄信息（含 location 文案）
      hasExif: false,
      gps: null,
      geoSource: 'none',   // none | auto | manual
      geoFailed: false,
      geoAsked: false,
      img: null,           // 原始大图：只有当前预览的那张常驻内存
      previewSource: null,
      thumb: '',
      error: '',
      userEdited: false
    };
  }

  /* ---------------- 进度显示 ---------------- */
  function setProgress(barEl, textEl, wrapEl, done, total, name) {
    if (wrapEl) wrapEl.classList.remove('hidden');
    if (barEl) barEl.style.width = (total > 0 ? Math.round(done / total * 100) : 0) + '%';
    if (textEl) textEl.textContent = done + ' / ' + total + (name ? ' · ' + name : '');
  }

  function hideProgress(barEl, wrapEl) {
    if (wrapEl) wrapEl.classList.add('hidden');
    if (barEl) barEl.style.width = '0%';
  }

  function nextTick() {
    return new Promise(function (r) { setTimeout(r, 0); });
  }

  function syncPrepProgress() {
    const total = batch.items.length;
    let done = 0;
    let cur = null;
    batch.items.forEach(function (x) {
      if (x.status === 'prep') cur = x;
      else if (x.status !== 'pending') done++;
    });
    if (total - done > 0) setProgress(prepBarEl, prepTextEl, prepProgressEl, done, total, cur ? cur.name : '');
    else hideProgress(prepBarEl, prepProgressEl);
  }

  /* ---------------- 缩略图 ---------------- */
  // 优先让浏览器在解码阶段就缩小（不必解码整幅大图，内存占用与照片大小无关）
  async function makeThumb(file) {
    const MAX = 128;
    try {
      if (typeof createImageBitmap === 'function') {
        let bmp = null;
        try {
          bmp = await createImageBitmap(file, { resizeWidth: MAX, resizeQuality: 'medium' });
        } catch (e) {
          bmp = await createImageBitmap(file);
        }
        const c = document.createElement('canvas');
        const sc = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
        c.width = Math.max(1, Math.round(bmp.width * sc));
        c.height = Math.max(1, Math.round(bmp.height * sc));
        c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
        if (typeof bmp.close === 'function') bmp.close();
        return c.toDataURL('image/jpeg', 0.72);
      }
    } catch (e) { /* 退回 <img> 解码 */ }

    try {
      const img = await loadImage(file);
      const c = document.createElement('canvas');
      const sc = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
      c.width = Math.max(1, Math.round(img.naturalWidth * sc));
      c.height = Math.max(1, Math.round(img.naturalHeight * sc));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.72);
    } catch (e) {
      return '';
    }
  }

  /* ---------------- 后台读取（EXIF + 缩略图） ---------------- */
  async function prepareItem(item) {
    const parsed = await parseExif(item.file);
    item.values = parsed.values || {};
    item.hasExif = !!parsed.hasExif;
    item.gps = parsed.gps || null;
    item.geoFailed = false;
    if (item.gps) {
      item.values.location = coordText(item.gps.latitude, item.gps.longitude);   // 先落坐标兜底
      item.geoSource = 'auto';
    }
    item.thumb = await makeThumb(item.file);
    if (!item.thumb && !item.img) item.img = await loadImage(item.file);   // 缩略图失败也要确认能解码
  }

  // 顺序读取整队列：每张之间让出主线程，界面保持可用
  async function startPrep() {
    if (batch.prepRunning) return;
    batch.prepRunning = true;
    const token = batch.prepToken;
    updateBatchUI();

    for (;;) {
      if (token !== batch.prepToken) break;             // 队列已被清空 / 重建
      let item = null;
      for (let i = 0; i < batch.items.length; i++) {
        if (batch.items[i].status === 'pending') { item = batch.items[i]; break; }
      }
      if (!item) break;

      item.status = 'prep';
      updateBatchUI();
      try {
        await prepareItem(item);
        item.status = 'ready';
      } catch (e) {
        item.status = 'error';
        item.error = '无法解码该图片';
      }
      applyPreparedToState(item);
      updateBatchUI();
      await nextTick();
    }

    batch.prepRunning = false;
    syncPrepProgress();
    updateBatchUI();
    finishPrepNotice();
  }

  // 后台读取完成后，若这张正是当前预览的图，就把结果同步到界面（用户手改过则不覆盖）
  function applyPreparedToState(item) {
    if (!item || item !== activeItem() || item.userEdited) return;
    state.meta = item.values;
    state.gps = item.gps;
    state.hasExif = item.hasExif;
    state.locationSource = item.geoSource;
    setMeta(item.values);
    setExifBadge(item.hasExif);
    syncGeoStatus(item);
    geoInput.value = state.hideLocation ? '' : cleanStr(item.values.location);
    updatePreview();
    maybeQueryPlaceName(item);
    showExifNotice(item);
  }

  function syncGeoStatus(item) {
    if (state.hideLocation) { setGeoStatus('已隐藏位置', 'warn'); return; }
    const loc = cleanStr(item && item.values ? item.values.location : '');
    if (!item || !item.gps) { setGeoStatus(loc ? '手动填写' : '无 GPS 信息'); return; }
    if (item.geoSource === 'manual') { setGeoStatus('手动填写'); return; }
    if (item.geoFailed) { setGeoStatus('反查失败，已显示坐标', 'warn'); return; }
    if (loc && loc !== coordText(item.gps.latitude, item.gps.longitude)) setGeoStatus('已获取地名', 'ok');
    else setGeoStatus('未获取');
  }

  // 只有单张时保持原有体验：读到 GPS 就自动反查地名；批量交给「批量反查」开关
  function maybeQueryPlaceName(item) {
    if (!item || item !== activeItem()) return;
    if (!item.gps || state.hideLocation) return;
    if (batch.items.length > 1) return;
    if (item.geoSource === 'manual' || item.geoAsked) return;
    item.geoAsked = true;
    queryPlaceName(false);
  }

  function showExifNotice(item) {
    if (!item || item !== activeItem()) return;
    if (item.status === 'pending' || item.status === 'prep') return;   // 等读取完成再提示
    const libOk = !!(window.exifr && typeof window.exifr.parse === 'function');
    if (!libOk) {
      showNotice('EXIF 解析库未加载（请检查网络连接），请在右侧手动填写拍摄信息。', 'warn');
      return;
    }
    if (item.hasExif) return;
    if (batch.items.length === 1) showNotice('未检测到拍摄信息，请在右侧手动填写相关字段。', 'info');
    else showNotice('「' + item.name + '」未检测到拍摄信息，可手动填写，或改用其他图片。', 'info');
  }

  function finishPrepNotice() {
    if (batch.lastAdd > 1) {
      const total = batch.items.length;
      const noExif = batch.items.filter(function (x) { return !x.hasExif; }).length;
      showNotice('已添加 ' + total + ' 张图片' +
        (noExif ? '（其中 ' + noExif + ' 张没有 EXIF 信息，可逐张手动填写）' : '') +
        '，可点缩略图逐张检查，或直接「导出全部」。', 'ok');
    }
    batch.lastAdd = 0;
  }

  /* ---------------- 切换 / 移除队列项 ---------------- */
  // 只保留当前图片的原始数据，其余释放（再次切回时重新解码）
  function releaseOtherImages(keep) {
    batch.items.forEach(function (x) { if (x !== keep && x.img) x.img = null; });
  }

  // 激活序号：解码是异步的，连点缩略图 / 连续删除时只让最后一次生效
  let activateSeq = 0;

  async function activateItem(id, opts) {
    const item = itemById(id);
    if (!item) return;

    // 连点缩略图 / 连续删除时，只有最后一次激活生效（解码是异步的）
    const token = ++activateSeq;
    const prev = activeItem();          // 新图读不出来时退回这张

    batch.activeId = item.id;
    renderStrip();
    updateBatchUI();

    if (!item.img) {
      try {
        item.img = await loadImage(item.file);
      } catch (e) {
        if (token !== activateSeq) return;
        item.status = 'error';
        item.error = '无法解码该图片';
        // 读不出来就留在原来那张，保证「显示的照片 / 高亮项 / 导出对象」一致
        if (prev && itemById(prev.id)) batch.activeId = prev.id;
        showNotice('「' + item.name + '」无法读取，格式可能不受支持。', 'warn');
        updateBatchUI();
        return;
      }
      if (token !== activateSeq || !itemById(item.id)) return;   // 期间又切了别的图 / 该项已被移除
      item.previewSource = item.previewSource || makePreviewSource(item.img);
    }

    // 新图就绪后再释放其他大图（包括上一张）：内存里只留当前这张
    releaseOtherImages(item);

    // 当前这张的信息（队列里每张各自一份）
    state.img = item.img;
    state.previewSource = item.previewSource;
    state.fileName = item.name;
    state.meta = item.values;
    state.gps = item.gps;
    state.hasExif = item.hasExif;
    state.locationSource = item.geoSource;
    state.geoToken++;               // 作废上一张未完成的地名反查

    // 队列首次载入（或替换当前图）时按图片尺寸重算范围，其余时候保持同一套样式
    if (!batch.rangesReady || (opts && opts.resetRanges)) {
      batch.rangesReady = true;
      setupRangesForImage(item.img.naturalWidth, item.img.naturalHeight);
    }

    dropzone.classList.add('hidden');
    viewer.classList.remove('hidden');
    fileNameEl.textContent = item.name +
      (batch.items.length > 1 ? ' · 第 ' + (activeIndex() + 1) + ' 张' : '');
    fileNameEl.title = item.name;
    setMeta(item.values);
    setExifBadge(item.hasExif);
    const reading = item.status === 'pending' || item.status === 'prep';
    if (reading) setGeoStatus('正在读取拍摄信息…', 'busy');
    else syncGeoStatus(item);
    geoInput.value = state.hideLocation ? '' : cleanStr(item.values.location);
    geoInput.disabled = state.hideLocation;
    geoRetry.disabled = state.hideLocation;
    syncSizeControl();
    syncLogoSizeLabel();
    syncPosControl();
    updatePreview();
    renderStrip();
    updateBatchUI();
    maybeQueryPlaceName(item);
    showExifNotice(item);
  }

  function stepItem(dir) {
    const n = batch.items.length;
    if (n < 2 || batch.exporting) return;
    const i = activeIndex();
    if (i < 0) return;
    activateItem(batch.items[(i + dir + n) % n].id);
  }

  /* ---------------- 缩略图条 / 队列状态 ---------------- */
  function renderStrip() {
    if (!batchStrip) return;
    const many = batch.items.length > 1;
    batchStrip.classList.toggle('hidden', !many);
    if (!many) {
      batchStrip.innerHTML = '';
      return;
    }

    const old = {};
    arr(batchStrip.children).forEach(function (el) { if (el.dataset.id) old[el.dataset.id] = el; });
    const sameSet = Object.keys(old).length === batch.items.length &&
      batch.items.every(function (x) { return !!old[String(x.id)]; });
    if (!sameSet) batchStrip.innerHTML = '';

    batch.items.forEach(function (item, i) {
      let tile = sameSet ? old[String(item.id)] : null;
      if (!tile) {
        tile = document.createElement('div');
        tile.dataset.id = String(item.id);
        tile.addEventListener('click', function () { activateItem(item.id); });

        const ph = document.createElement('span');
        ph.className = 'idx';
        ph.textContent = String(i + 1);
        tile.appendChild(ph);

        const dot = document.createElement('span');
        dot.className = 'dot';
        tile.appendChild(dot);

        const x = document.createElement('button');
        x.type = 'button';
        x.className = 'x';
        x.textContent = '×';
        x.title = '从队列移除';
        x.addEventListener('click', function (e) {
          e.stopPropagation();
          removeItem(item.id);
        });
        tile.appendChild(x);

        batchStrip.appendChild(tile);
      }

      tile.className = 'thumb ' + item.status + (item.id === batch.activeId ? ' on' : '');
      tile.title = item.name +
        (item.status === 'pending' || item.status === 'prep' ? '（读取中）' : '') +
        (item.error ? '（' + item.error + '）' : '');
      tile.dataset.status = item.status;

      const img = tile.querySelector('img');
      if (item.thumb) {
        if (!img) {
          const el = document.createElement('img');
          el.src = item.thumb;
          el.alt = '';
          tile.insertBefore(el, tile.firstChild);
          const ph = tile.querySelector('.idx');
          if (ph) ph.remove();
        } else if (img.getAttribute('src') !== item.thumb) {
          img.src = item.thumb;
        }
      }
    });

    if (!sameSet) {
      const on = batchStrip.querySelector('.thumb.on');
      if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  function updateBatchUI() {
    const total = batch.items.length;
    let ready = 0;
    let failed = 0;
    let pending = 0;
    let exported = 0;
    batch.items.forEach(function (x) {
      if (x.status === 'error') failed++;
      else if (x.status === 'done') exported++;
      else if (x.status === 'pending' || x.status === 'prep') pending++;
      else ready++;
    });

    const idx = activeIndex();
    batchPosEl.textContent = total ? (idx + 1) + ' / ' + total : '0 / 0';
    prevBtn.disabled = nextBtn.disabled = total < 2 || batch.exporting;

    batchCountEl.textContent = total ? total + ' 张' : '—';
    queueSummaryEl.textContent = total
      ? '共 ' + total + ' 张 · 就绪 ' + ready + (exported ? ' · 已导出 ' + exported : '') +
        (failed ? ' · 失败 ' + failed : '') + (pending ? ' · 读取中 ' + pending : '')
      : '尚未添加图片';
    queueSummaryEl.className = 'mini-status' +
      (pending ? ' busy' : (failed ? ' warn' : (total ? ' ok' : '')));

    clearBtn.disabled = !total || batch.exporting;
    exportAllBtn.disabled = total < 2 || batch.exporting || pending > 0;
    exportAllBtn.textContent = batch.exporting
      ? '正在导出…'
      : (total > 1 ? '导出全部（' + total + ' 张）' : '导出全部');
    exportBtn.disabled = !total || !state.img || batch.exporting;
    exportCancelBtn.classList.toggle('hidden', !batch.exporting);

    batchBadgeEl.classList.toggle('hidden', !total);
    if (total) {
      batchBadgeEl.textContent = pending ? '读取中 ' + (total - pending) + '/' + total
        : '就绪 ' + (total - failed) + '/' + total;
      batchBadgeEl.className = 'badge ' + (failed ? 'badge-warn' : 'badge-ok');
    }

    syncPrepProgress();
    renderStrip();
  }

  function removeItem(id) {
    const i = batch.items.indexOf(itemById(id));
    if (i < 0) return;
    const item = batch.items[i];
    if (item !== activeItem() && item.img) item.img = null;
    batch.items.splice(i, 1);

    if (!batch.items.length) { resetQueue(); return; }

    if (item.id === batch.activeId) {
      const next = batch.items[Math.min(i, batch.items.length - 1)];
      batch.activeId = next.id;
      activateItem(next.id);
    }
    updateBatchUI();
  }

  // 清空队列 → 回到「拖入照片」的初始状态
  function resetQueue() {
    batch.items.forEach(function (x) { x.img = null; x.previewSource = null; });
    batch.items = [];
    batch.activeId = 0;
    batch.rangesReady = false;
    batch.prepToken++;              // 作废未完成的读取流程
    batch.geoToken++;
    batch.geoCancel = true;
    batch.geocoding = false;
    batch.lastAdd = 0;

    state.img = null;
    state.previewSource = null;
    state.fileName = '';
    state.meta = {};
    state.gps = null;
    state.hasExif = false;
    state.locationSource = 'none';

    dropzone.classList.remove('hidden');
    viewer.classList.add('hidden');
    fileNameEl.textContent = '';
    geoInput.value = '';
    geoInput.disabled = false;
    geoRetry.disabled = false;
    setExifBadge(false);
    setGeoStatus('未获取');
    hideProgress(prepBarEl, prepProgressEl);
    hideProgress(geoBarEl, geoProgressEl);
    hideProgress(exportBarEl, exportProgressEl);
    geocodeChk.checked = false;
    syncSizeControl();              // 会禁用字号滑块并复位「垂直位置」
    updateBatchUI();
    clearNotice();
  }

  /* ---------------- 处理文件 ---------------- */
  // 追加到队列（返回新加入的项）
  function addFiles(list) {
    const files = arr(list).filter(Boolean);
    const added = [];
    const skipped = [];

    files.forEach(function (file) {
      const err = fileKindError(file);
      if (err) { skipped.push(String((file && file.name) || '未命名')); return; }
      const item = newItem(file);
      batch.items.push(item);
      added.push(item);
    });

    if (skipped.length) {
      showNotice('已跳过 ' + skipped.length + ' 个不支持的文件：' +
        skipped.slice(0, 3).join('、') + (skipped.length > 3 ? ' 等' : '') + '。', 'warn');
    }
    if (!added.length) return [];

    batch.lastAdd = added.length;
    startPrep();
    return added;
  }

  // 更换当前项：只替换这一个文件，位置不变，其余队列项不受影响
  function replaceActiveFile(file) {
    const err = fileKindError(file);
    if (err) { showNotice(err, 'warn'); return; }

    const cur = activeItem();
    const at = cur ? batch.items.indexOf(cur) : batch.items.length;
    if (cur) batch.items.splice(at, 1);

    const item = newItem(file);
    batch.items.splice(at, 0, item);
    batch.activeId = item.id;
    if (batch.items.length <= 1) batch.rangesReady = false;   // 单张时换图按新尺寸重算范围（与旧版一致）
    batch.lastAdd = 1;
    startPrep();
    activateItem(item.id);
  }

  // 统一入口：mode = 'replace'（更换当前）| 'add'（追加）
  async function handleFiles(list, mode) {
    const files = arr(list).filter(Boolean);
    if (!files.length) return;

    if (mode === 'replace' && batch.items.length) { replaceActiveFile(files[0]); return; }

    const added = addFiles(files);
    if (!added.length) return;
    await activateItem(added[0].id);
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
      const files = (e.dataTransfer && e.dataTransfer.files) || null;
      if (files && files.length) handleFiles(files, batch.items.length ? 'add' : 'replace');
    });
  }

  /* ---------------- 导出：公共小工具 ---------------- */
  function canvasToBlob(canvas, type, quality) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (blob) resolve(blob);
        else reject(new Error('无法生成图片数据'));
      }, type, quality);
    });
  }

  function triggerDownload(url, name) {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function exportCanvas() {
    if (!exportCanvasEl) exportCanvasEl = document.createElement('canvas');
    return exportCanvasEl;
  }

  // 临时切到「这一张」的数据做同步合成；合成一结束立即还原，不影响当前预览
  function withItem(item, fn) {
    const saved = {
      img: state.img, previewSource: state.previewSource, fileName: state.fileName,
      meta: state.meta, gps: state.gps, hasExif: state.hasExif,
      locationSource: state.locationSource
    };
    state.img = item.img;
    state.previewSource = item.previewSource;
    state.fileName = item.name;
    state.meta = item.values;
    state.gps = item.gps;
    state.hasExif = item.hasExif;
    state.locationSource = item.geoSource;
    try {
      return fn();
    } finally {
      state.img = saved.img;
      state.previewSource = saved.previewSource;
      state.fileName = saved.fileName;
      state.meta = saved.meta;
      state.gps = saved.gps;
      state.hasExif = saved.hasExif;
      state.locationSource = saved.locationSource;
    }
  }

  // 成品尺寸；超出浏览器画布上限时提前抛错（不必等画布分配失败）
  function checkOutputSize(w, h) {
    const b = Math.round(state.borderWidth);
    const be = Math.round(state.bottomExtra);
    const cw = w + b * 2;
    const ch = h + b * 2 + be;
    if (cw > MAX_CANVAS_DIM || ch > MAX_CANVAS_DIM || cw * ch > MAX_CANVAS_PX) {
      throw new Error('成品 ' + cw + ' × ' + ch + ' 超出浏览器画布上限');
    }
    return { w: cw, h: ch };
  }

  async function renderItemBlob(item, type, quality) {
    if (!item.img) {
      item.img = await loadImage(item.file);
      item.previewSource = item.previewSource || makePreviewSource(item.img);
    }
    const img = item.img;
    const fullW = img.naturalWidth;
    const fullH = img.naturalHeight;
    checkOutputSize(fullW, fullH);
    const canvas = withItem(item, function () {
      return compose(img, 1, fullW, fullH, exportCanvas());
    });
    return await canvasToBlob(canvas, type, quality);
  }

  // 同名照片自动加序号，避免打包时相互覆盖
  function uniqueName(used, name, ext) {
    const base = buildOutName(name, ext);
    if (!used[base]) { used[base] = 1; return base; }
    const m = /^(.*?)(\.[^.]+)$/.exec(base);
    const stem = m ? m[1] : base;
    const tail = m ? m[2] : '';
    let n = used[base];
    let cand = '';
    do {
      n++;
      cand = stem + '-' + n + tail;
    } while (used[cand]);
    used[base] = n;
    used[cand] = 1;
    return cand;
  }

  function batchZipName() {
    const d = new Date();
    const p = function (n) { return String(n).padStart(2, '0'); };
    return 'framed_' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) +
      '_' + p(d.getHours()) + p(d.getMinutes()) + '.zip';
  }

  function stopExport(msg, kind) {
    batch.exporting = false;
    batch.exportCancel = false;
    hideProgress(exportBarEl, exportProgressEl);
    updateBatchUI();
    if (msg) showNotice(msg, kind || 'info');
  }

  /* ---------------- 批量导出 ---------------- */
  async function doExportAll() {
    if (batch.exporting) return;

    const items = batch.items.filter(function (x) { return x.status === 'ready' || x.status === 'done'; });
    if (!items.length) {
      showNotice('队列里还没有可以导出的图片。', 'info');
      return;
    }
    if (items.length === 1) { doExport(); return; }      // 只有一张就按单张导出

    const zipMode = state.batchMode === 'zip';
    const isJpeg = state.format === 'jpeg';
    const ext = isJpeg ? 'jpg' : 'png';
    const type = isJpeg ? 'image/jpeg' : 'image/png';
    const quality = isJpeg ? state.quality : undefined;

    batch.exporting = true;
    batch.exportCancel = false;
    updateBatchUI();
    setProgress(exportBarEl, exportTextEl, exportProgressEl, 0, items.length, '');

    const used = Object.create(null);
    const rows = [];          // 内存打包：{ name, blob }
    const failed = [];
    const done = [];          // 本次已写出的项

    // 打包模式优先「另存为」流式写盘：整包不占内存
    let sink = null;
    let zip = null;
    if (zipMode) {
      const picked = await pickZipSink(batchZipName());
      if (picked === 'abort') {
        stopExport('已取消批量导出（没有生成文件）。', 'info');
        return;
      }
      if (picked) {
        sink = picked;
        zip = makeZipWriter(sink);
      }
    }

    try {
      for (let i = 0; i < items.length; i++) {
        if (batch.exportCancel) break;
        const item = items[i];
        setProgress(exportBarEl, exportTextEl, exportProgressEl, i, items.length, item.name);
        await nextTick();

        try {
          const blob = await renderItemBlob(item, type, quality);
          const name = uniqueName(used, item.name, ext);
          if (zipMode) {
            if (zip) await zip.add(name, blob);
            else rows.push({ name: name, blob: blob });
          } else {
            const url = URL.createObjectURL(blob);
            triggerDownload(url, name);
            setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
          }
          item.status = 'done';
          item.error = '';
          done.push(item);
          releaseOtherImages(activeItem());      // 只留当前预览那张的大图
        } catch (e) {
          item.error = '导出失败：' + String((e && e.message) || e);
          failed.push(item.name);
        }
        setProgress(exportBarEl, exportTextEl, exportProgressEl, done.length, items.length, item.name);
        updateBatchUI();
      }

      const cancelled = batch.exportCancel;
      if (zipMode) {
        if (cancelled) {
          if (sink) await sink.abort();
          done.forEach(function (x) { x.status = 'ready'; });   // 压缩包被丢弃，状态回退
        } else if (sink) {
          await zip.finish();
          await sink.close();
        } else {
          const blob = await buildZipBlob(rows);
          const url = URL.createObjectURL(blob);
          triggerDownload(url, batchZipName());
          setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
        }
      }

      if (cancelled) {
        showNotice('已取消批量导出' +
          (zipMode ? '（没有生成文件）' : '（已下载 ' + done.length + ' 张）') + '。', 'info');
      } else if (failed.length) {
        showNotice('已导出 ' + done.length + '/' + items.length + ' 张' +
          (zipMode ? '（打包 ZIP）' : '（逐张下载）') + '，' + failed.length + ' 张失败：' +
          failed.slice(0, 3).join('、') + (failed.length > 3 ? ' 等' : '') + '。', 'warn');
      } else {
        showNotice('已导出全部 ' + done.length + ' 张' +
          (zipMode ? '，已打包为 ZIP' : '（逐张下载）') + '。', 'ok');
      }
    } catch (e) {
      if (sink) await sink.abort();
      showNotice('批量导出失败：' + String((e && e.message) || e) + '。', 'warn');
    } finally {
      batch.exporting = false;
      batch.exportCancel = false;
      hideProgress(exportBarEl, exportProgressEl);
      updateBatchUI();
    }
  }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* ---------------- 批量地名反查（顺序 + 限速） ---------------- */
  async function startGeocodeQueue() {
    if (batch.geocoding) return;

    const targets = batch.items.filter(function (x) { return !!x.gps && x.geoSource !== 'manual'; });
    if (!targets.length) {
      geocodeChk.checked = false;
      showNotice('队列里没有带 GPS 的照片，无需反查地名。', 'info');
      return;
    }

    batch.geocoding = true;
    batch.geoCancel = false;
    const token = ++batch.geoToken;
    let done = 0;

    for (let i = 0; i < targets.length; i++) {
      if (batch.geoCancel || token !== batch.geoToken) break;
      const item = targets[i];
      setProgress(geoBarEl, geoTextEl, geoProgressEl, i, targets.length, item.name);

      const key = item.gps.latitude.toFixed(4) + ',' + item.gps.longitude.toFixed(4);
      const cached = !!geoCache[key];
      try {
        const name = await reverseGeocode(item.gps.latitude, item.gps.longitude);
        item.values.location = name;
        item.geoFailed = false;
      } catch (e) {
        item.geoFailed = true;
        item.values.location = coordText(item.gps.latitude, item.gps.longitude);
      }
      item.geoSource = 'auto';
      done++;
      setProgress(geoBarEl, geoTextEl, geoProgressEl, done, targets.length, item.name);

      // 当前预览的正好是这张 → 同步界面
      if (item === activeItem()) {
        state.meta.location = item.values.location;
        state.locationSource = 'auto';
        geoInput.value = item.values.location;
        syncGeoStatus(item);
        updatePreview();
      }

      // 命中缓存无需等待；真实请求之间间隔 1.1s，遵守 Nominatim 使用条款
      if (i < targets.length - 1 && !cached) await sleep(1100);
    }

    batch.geocoding = false;
    hideProgress(geoBarEl, geoProgressEl);
    geocodeChk.checked = false;
    if (batch.geoCancel) showNotice('已停止批量反查地名（前 ' + done + ' 张已更新）。', 'info');
    else showNotice('批量地名反查完成（' + done + '/' + targets.length + ' 张）。', 'ok');
    batch.geoCancel = false;
  }

  /* ---------------- ZIP 打包（store 存储模式，零依赖、可离线） ---------------- */
  // JPEG / PNG 本身已压缩，直接存储即可；记录里带 ZIP64 扩展，整包超过 4GB 也能正常打开。
  const CRC_TABLE = (function () {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  }());

  function crc32(bytes, seed) {
    let c = (seed === undefined ? 0xFFFFFFFF : seed) >>> 0;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return c >>> 0;
  }

  // 分块读取 Blob 求校验和与长度：内存占用与文件大小无关
  async function blobCrc(blob) {
    let c = 0xFFFFFFFF;
    let size = 0;
    if (blob.stream && typeof blob.stream === 'function') {
      const reader = blob.stream().getReader();
      for (;;) {
        const step = await reader.read();
        if (step.done) break;
        c = crc32(step.value, c);
        size += step.value.length;
      }
    } else {
      const buf = new Uint8Array(await blob.arrayBuffer());
      c = crc32(buf, c);
      size = buf.length;
    }
    return { crc: (c ^ 0xFFFFFFFF) >>> 0, size: size };
  }

  const ZIP32_MAX = 0xFFFFFFFF;

  function zipCat(list) {
    let n = 0;
    for (let i = 0; i < list.length; i++) n += list[i].length;
    const out = new Uint8Array(n);
    let o = 0;
    for (let i = 0; i < list.length; i++) { out.set(list[i], o); o += list[i].length; }
    return out;
  }

  function zipU16(v) { const a = new Uint8Array(2); new DataView(a.buffer).setUint16(0, v & 0xFFFF, true); return a; }
  function zipU32(v) { const a = new Uint8Array(4); new DataView(a.buffer).setUint32(0, v >>> 0, true); return a; }
  function zipU64(v) {
    const a = new Uint8Array(8);
    const dv = new DataView(a.buffer);
    const n = Math.max(0, Math.floor(v));
    if (typeof dv.setBigUint64 === 'function') dv.setBigUint64(0, BigInt(n), true);
    else { dv.setUint32(0, n >>> 0, true); dv.setUint32(4, Math.floor(n / 4294967296) >>> 0, true); }
    return a;
  }

  // MS-DOS 日期时间（ZIP 头使用）
  function dosStamp(d) {
    const date = ((((d.getFullYear() - 1980) & 0x7F) << 9) |
      (((d.getMonth() + 1) & 0x0F) << 5) | (d.getDate() & 0x1F)) & 0xFFFF;
    const time = (((d.getHours() & 0x1F) << 11) |
      ((d.getMinutes() & 0x3F) << 5) | ((d.getSeconds() >> 1) & 0x1F)) & 0xFFFF;
    return { time: time, date: date };
  }

  function zipUtf8(str) { return new TextEncoder().encode(str); }

  function zipLocalHeader(e, st) {
    const big = e.size >= ZIP32_MAX;
    const name = zipUtf8(e.name);
    const extra = big ? zipCat([zipU16(0x0001), zipU16(16), zipU64(e.size), zipU64(e.size)]) : new Uint8Array(0);
    return zipCat([
      zipU32(0x04034b50), zipU16(big ? 45 : 20), zipU16(0x0800), zipU16(0),   // 0x0800：文件名为 UTF-8
      zipU16(st.time), zipU16(st.date), zipU32(e.crc),
      zipU32(big ? ZIP32_MAX : e.size), zipU32(big ? ZIP32_MAX : e.size),
      zipU16(name.length), zipU16(extra.length), name, extra
    ]);
  }

  function zipCentralRecord(e, st) {
    const bigSize = e.size >= ZIP32_MAX;
    const bigOff = e.offset >= ZIP32_MAX;
    const name = zipUtf8(e.name);
    const body = [];
    if (bigSize) body.push(zipU64(e.size), zipU64(e.size));
    if (bigOff) body.push(zipU64(e.offset));
    let extra = new Uint8Array(0);
    if (body.length) {
      let n = 0;
      for (let i = 0; i < body.length; i++) n += body[i].length;
      extra = zipCat([zipU16(0x0001), zipU16(n)].concat(body));
    }
    return zipCat([
      zipU32(0x02014b50), zipU16(20), zipU16((bigSize || bigOff) ? 45 : 20), zipU16(0x0800), zipU16(0),
      zipU16(st.time), zipU16(st.date), zipU32(e.crc),
      zipU32(bigSize ? ZIP32_MAX : e.size), zipU32(bigSize ? ZIP32_MAX : e.size),
      zipU16(name.length), zipU16(extra.length), zipU16(0), zipU16(0), zipU16(0), zipU32(0),
      zipU32(bigOff ? ZIP32_MAX : e.offset), name, extra
    ]);
  }

  function zipEndRecords(count, cdSize, cdOffset) {
    const need64 = count > 0xFFFF || cdSize >= ZIP32_MAX || cdOffset >= ZIP32_MAX;
    const out = [];
    if (need64) {
      out.push(zipCat([
        zipU32(0x06064b50), zipU64(44), zipU16(45), zipU16(45), zipU32(0), zipU32(0),
        zipU64(count), zipU64(count), zipU64(cdSize), zipU64(cdOffset)
      ]));
      out.push(zipCat([zipU32(0x07064b50), zipU32(0), zipU64(cdOffset + cdSize), zipU32(1)]));
    }
    out.push(zipCat([
      zipU32(0x06054b50), zipU16(0), zipU16(0),
      zipU16(Math.min(count, 0xFFFF)), zipU16(Math.min(count, 0xFFFF)),
      zipU32(Math.min(cdSize, ZIP32_MAX)), zipU32(Math.min(cdOffset, ZIP32_MAX)), zipU16(0)
    ]));
    return out;
  }

  // sink.write(part)：part 可以是 Uint8Array、Uint8Array[] 或 Blob
  function makeZipWriter(sink) {
    const dir = [];
    const st = dosStamp(new Date());
    let offset = 0;
    return {
      count: 0,
      async add(name, blob) {
        const info = await blobCrc(blob);
        const e = { name: name, crc: info.crc, size: info.size, offset: offset };
        const head = zipLocalHeader(e, st);
        await sink.write(head);
        await sink.write(blob);
        offset += head.length + info.size;
        dir.push(e);
        this.count = dir.length;
        return e;
      },
      async finish() {
        const recs = [];
        let cdSize = 0;
        dir.forEach(function (e) {
          const r = zipCentralRecord(e, st);
          recs.push(r);
          cdSize += r.length;
        });
        await sink.write(recs);
        await sink.write(zipEndRecords(dir.length, cdSize, offset));
        return { count: dir.length, size: offset };
      }
    };
  }

  function memorySink(parts) {
    return {
      write: function (p) {
        if (Array.isArray(p)) { for (let i = 0; i < p.length; i++) parts.push(p[i]); }
        else parts.push(p);
      }
    };
  }

  async function buildZipBlob(entries) {
    const parts = [];
    const zip = makeZipWriter(memorySink(parts));
    for (let i = 0; i < entries.length; i++) await zip.add(entries[i].name, entries[i].blob);
    await zip.finish();
    return new Blob(parts, { type: 'application/zip' });
  }

  // 「另存为」流式写盘（Chrome / Edge）：整包不占内存。
  // 返回 'abort'（用户取消）/ null（不支持 → 退回内存打包）/ sink。
  async function pickZipSink(name) {
    if (typeof window.showSaveFilePicker !== 'function') return null;

    let handle = null;
    try {
      handle = await window.showSaveFilePicker({
        suggestedName: name,
        types: [{ description: 'ZIP 压缩包', accept: { 'application/zip': ['.zip'] } }]
      });
    } catch (e) {
      return (e && e.name === 'AbortError') ? 'abort' : null;
    }

    let w = null;
    try {
      w = await handle.createWritable();
    } catch (e) {
      return null;
    }

    let closed = false;
    return {
      async write(p) {
        const list = Array.isArray(p) ? p : [p];
        for (let i = 0; i < list.length; i++) await w.write(list[i]);
      },
      async close() { if (!closed) { closed = true; await w.close(); } },
      async abort() {
        if (closed) return;
        closed = true;
        try { await w.abort(); } catch (e) { /* 忽略 */ }
      }
    };
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
      const item = activeItem();
      if (item) item.geoSource = 'manual';
      markActiveEdited();
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
        state.textOffset = 0;          // 换对齐方式即回到基准位置
        syncPosControl();
        schedulePreview();
      });
    });

    posRange.addEventListener('input', function () {
      state.textOffset = Number(posRange.value) || 0;
      syncPosControl();
      schedulePreview();
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
    exportAllBtn.addEventListener('click', doExportAll);
    exportCancelBtn.addEventListener('click', function () { batch.exportCancel = true; });

    batchModeRadios.forEach(function (r) {
      r.addEventListener('change', function () {
        if (!r.checked) return;
        state.batchMode = r.value;
      });
    });

    let pickMode = 'add';
    let picking = false;
    const openPicker = function (mode) {
      // fileInput.click() 派发的 click 会冒泡到 #dropzone，若不挡住就会把模式改回 add
      if (picking) return;
      picking = true;
      pickMode = mode;
      fileInput.multiple = (mode === 'add');   // 追加时可多选；「更换当前」只挑一张
      try { fileInput.click(); } finally { picking = false; }
    };

    clearBtn.addEventListener('click', resetQueue);
    prevBtn.addEventListener('click', function () { stepItem(-1); });
    nextBtn.addEventListener('click', function () { stepItem(1); });
    addBtn.addEventListener('click', function () { openPicker('add'); });

    geocodeChk.addEventListener('change', function () {
      if (geocodeChk.checked) startGeocodeQueue();
      else if (batch.geocoding) batch.geoCancel = true;
    });

    // ← → 切换队列里的上一张 / 下一张（输入框内不拦截）
    document.addEventListener('keydown', function (e) {
      if (batch.items.length < 2) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' ||
                t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'ArrowLeft') { stepItem(-1); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { stepItem(1); e.preventDefault(); }
    });

    dropzone.addEventListener('click', function (e) {
      if (e.target === fileInput) return;      // 忽略 input.click() 冒泡上来的那次
      openPicker('add');
    });
    changeBtn.addEventListener('click', function () { openPicker('replace'); });

    fileInput.addEventListener('change', function () {
      const files = fileInput.files;
      const mode = pickMode;
      if (files && files.length) handleFiles(files, mode);
      fileInput.value = '';
      pickMode = 'add';            // 恢复默认语义：点拖入区 / 添加图片 都是「追加」
      fileInput.multiple = true;
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
    updateBatchUI();
  }

  init();
})();
