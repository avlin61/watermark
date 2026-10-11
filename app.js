/* ============================================================
   水印框 · 图片信息水印工具
   第二阶段：虚化背景 / 文字样式 / 字段开关 / 地理位置反查 / 自定义文案
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

    const title = [];
    if (v.brand) title.push(cleanStr(m.brand));
    if (v.model) title.push(cleanStr(m.model));
    const titleText = title.filter(Boolean).join(' ');
    if (titleText) rows.push({ kind: 'title', text: titleText });

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
    const out = { sizes: [], widths: [], rowH: [], gaps: [], items: [], sepW: [], blockH: 0, maxW: 0 };

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
        w = ctx.measureText(row.text).width;
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
        ctx.fillText(row.text, x, y);
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
      state.fontScale = Number(sizeRange.value);
      sizeValEl.textContent = Math.round(state.fontScale * 100) + '%';
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
  }

  init();
})();
