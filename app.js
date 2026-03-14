const PRESET_DIMENSIONS = [
  '风格表现',
  '角色表现',
  '复杂构图能力',
  '指令遵循',
  '提示词适配能力',
  '边界案例'
];

const PRESET_SUB_DIMENSIONS = [
  '指定画风还原',
  '角色换装遵循',
  '多人物互动',
  '数量约束遵循',
  '中英文 prompt 适配',
  '风格混合',
  '极端姿势稳定性'
];

const STORAGE_KEY = 'case-dataset-builder:v1';
const THEME_KEY = 'case-dataset-builder:theme';
const INVALID_FOLDER_NAME_CHARS = /[<>:"/\\|?*\u0000-\u001F]/;
const RESERVED_WINDOWS_NAMES = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
]);

let hasShownStorageWarning = false;

const state = {
  cases: [],
  selectedId: null,
  theme: 'light',
  dimensionOptions: [...PRESET_DIMENSIONS],
  subDimensionOptions: [...PRESET_SUB_DIMENSIONS],
};

const els = {
  caseList: document.getElementById('case-list'),
  addCaseBtn: document.getElementById('add-case-btn'),
  themeToggleBtn: document.getElementById('theme-toggle-btn'),
  duplicateCaseBtn: document.getElementById('duplicate-case-btn'),
  deleteCaseBtn: document.getElementById('delete-case-btn'),
  importZipInput: document.getElementById('import-zip-input'),
  exportCaseBtn: document.getElementById('export-case-btn'),
  exportDatasetBtn: document.getElementById('export-dataset-btn'),
  searchInput: document.getElementById('search-input'),
  dimensionFilter: document.getElementById('dimension-filter'),
  editorTitle: document.getElementById('editor-title'),
  editorSubtitle: document.getElementById('editor-subtitle'),
  emptyState: document.getElementById('empty-state'),
  editor: document.getElementById('editor'),
  folderName: document.getElementById('folder-name'),
  dimensionList: document.getElementById('dimension-list'),
  subDimensionList: document.getElementById('sub-dimension-list'),
  promptList: document.getElementById('prompt-list'),
  checkPointList: document.getElementById('check-point-list'),
  dimensionSelect: document.getElementById('dimension-select'),
  subDimensionSelect: document.getElementById('sub-dimension-select'),
  clearDimensionBtn: document.getElementById('clear-dimension-btn'),
  clearSubDimensionBtn: document.getElementById('clear-sub-dimension-btn'),
  showDimensionCustomBtn: document.getElementById('show-dimension-custom-btn'),
  showSubDimensionCustomBtn: document.getElementById('show-sub-dimension-custom-btn'),
  dimensionCustomWrap: document.getElementById('dimension-custom-wrap'),
  subDimensionCustomWrap: document.getElementById('sub-dimension-custom-wrap'),
  dimensionCustomInput: document.getElementById('dimension-custom-input'),
  subDimensionCustomInput: document.getElementById('sub-dimension-custom-input'),
  confirmDimensionCustomBtn: document.getElementById('confirm-dimension-custom-btn'),
  confirmSubDimensionCustomBtn: document.getElementById('confirm-sub-dimension-custom-btn'),
  previewJsonBtn: document.getElementById('preview-json-btn'),
  jsonPreviewPanel: document.getElementById('json-preview-panel'),
  jsonPreviewContent: document.getElementById('json-preview-content'),
  closeJsonPreviewBtn: document.getElementById('close-json-preview-btn'),
  checkPointInput: document.getElementById('check-point-input'),
  addPromptBtn: document.getElementById('add-prompt-btn'),
  passRule: document.getElementById('pass-rule'),
  refUpload: document.getElementById('ref-upload'),
  refGrid: document.getElementById('ref-grid'),
  refDropzone: document.getElementById('ref-dropzone'),
  validationBox: document.getElementById('validation-box'),
};

function uid() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2, 10);
}

function createEmptyCase() {
  const index = state.cases.length + 1;
  return {
    id: uid(),
    folderName: `case_${String(index).padStart(3, '0')}`,
    dimension: [],
    sub_dimension: [],
    prompt: [''],
    ref: [],
    check_points: [],
    pass_rule: '',
  };
}

function serializableCase(c, includeRefData = true) {
  return {
    id: c.id,
    folderName: c.folderName,
    dimension: c.dimension,
    sub_dimension: c.sub_dimension,
    prompt: c.prompt,
    ref: includeRefData ? c.ref.map((r) => ({
      id: r.id,
      name: r.file.name,
      type: r.file.type,
      relativePath: r.relativePath,
      dataUrl: r.dataUrl,
    })) : [],
    check_points: c.check_points,
    pass_rule: c.pass_rule,
  };
}

function persistPayload(includeRefData = true) {
  return {
    selectedId: state.selectedId,
    cases: state.cases.map((c) => serializableCase(c, includeRefData)),
    dimensionOptions: state.dimensionOptions,
    subDimensionOptions: state.subDimensionOptions,
  };
}

function isQuotaExceededError(error) {
  return error instanceof DOMException && (
    error.code === 22 ||
    error.code === 1014 ||
    error.name === 'QuotaExceededError' ||
    error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
  );
}

function persistState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistPayload(true)));
    hasShownStorageWarning = false;
  } catch (error) {
    if (!isQuotaExceededError(error)) {
      console.error('persistState failed', error);
      return;
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persistPayload(false)));
      if (!hasShownStorageWarning) {
        hasShownStorageWarning = true;
        alert('本地空间不足，已仅保存文本。请导出 ZIP。');
      }
    } catch (fallbackError) {
      console.error('persistState fallback failed', fallbackError);
    }
  }
}

function applyTheme(theme) {
  state.theme = theme;
  document.body.classList.toggle('dark', theme === 'dark');
  els.themeToggleBtn.textContent = theme === 'dark' ? '☀' : '☾';
  els.themeToggleBtn.title = theme === 'dark' ? '切换到浅色模式' : '切换到深色模式';
  localStorage.setItem(THEME_KEY, theme);
}

function dataUrlToFile(dataUrl, name, type) {
  const [meta, data] = dataUrl.split(',');
  const mime = type || meta.match(/data:(.*?);base64/)?.[1] || 'application/octet-stream';
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], name, { type: mime });
}

function restoreState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    state.dimensionOptions = dedupe([...(parsed.dimensionOptions || []), ...PRESET_DIMENSIONS]);
    state.subDimensionOptions = dedupe([...(parsed.subDimensionOptions || []), ...PRESET_SUB_DIMENSIONS]);
    state.cases = (parsed.cases || []).map((c) => ({
      id: c.id || uid(),
      folderName: c.folderName || `case_${Date.now()}`,
      dimension: c.dimension || [],
      sub_dimension: c.sub_dimension || [],
      prompt: c.prompt?.length ? c.prompt : [''],
      ref: (c.ref || []).map((r) => {
        if (!r?.dataUrl || !r?.name) return null;
        const file = dataUrlToFile(r.dataUrl, r.name, r.type);
        return {
          id: r.id || uid(),
          file,
          url: URL.createObjectURL(file),
          relativePath: r.relativePath,
          dataUrl: r.dataUrl,
        };
      }).filter(Boolean),
      check_points: c.check_points || [],
      pass_rule: c.pass_rule || '',
    }));
    state.selectedId = parsed.selectedId && state.cases.some((c) => c.id === parsed.selectedId)
      ? parsed.selectedId
      : state.cases[0]?.id || null;
    return state.cases.length > 0;
  } catch (error) {
    console.error('restoreState failed', error);
    return false;
  }
}

function dedupe(list) {
  return [...new Set(list.map((x) => x.trim()).filter(Boolean))];
}

function getSelectedCase() {
  return state.cases.find((c) => c.id === state.selectedId) || null;
}

function caseToExportPayload(c) {
  return {
    dimension: c.dimension,
    sub_dimension: c.sub_dimension,
    prompt: c.prompt.filter((x) => x.trim()),
    ref: c.ref.map((r) => r.relativePath),
    check_points: c.check_points,
    pass_rule: c.pass_rule || '',
  };
}

function normalizedFolderName(value) {
  return value.trim().toLowerCase();
}

function validateFolderName(folderName, caseId) {
  const errors = [];
  const trimmed = folderName.trim();
  if (!trimmed) {
    errors.push('文件夹名不能为空');
    return errors;
  }

  if (trimmed === '.' || trimmed === '..') {
    errors.push('文件夹名无效');
  }
  if (INVALID_FOLDER_NAME_CHARS.test(trimmed)) {
    errors.push('文件夹名含非法字符');
  }
  if (trimmed.endsWith('.')) {
    errors.push('文件夹名无效');
  }

  const baseName = trimmed.split('.')[0]?.toUpperCase();
  if (RESERVED_WINDOWS_NAMES.has(baseName)) {
    errors.push('文件夹名保留');
  }

  const hasDuplicate = state.cases.some(
    (item) => item.id !== caseId && normalizedFolderName(item.folderName) === normalizedFolderName(trimmed)
  );
  if (hasDuplicate) errors.push('文件夹名重复');

  return errors;
}

function validateCase(c) {
  const errors = [];
  errors.push(...validateFolderName(c.folderName, c.id));
  if (c.dimension.length === 0) errors.push('dimension 必填');
  if (c.sub_dimension.length === 0) errors.push('sub_dimension 必填');
  if (c.prompt.filter((x) => x.trim()).length === 0) errors.push('prompt 必填');
  return errors;
}

function populateSelect(selectEl, values, placeholder) {
  selectEl.innerHTML = [`<option value="">${placeholder}</option>`, ...values.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`)].join('');
}

function renderFilters() {
  const filterValues = new Set(state.dimensionOptions);
  state.cases.forEach((c) => c.dimension.forEach((d) => filterValues.add(d)));
  const current = els.dimensionFilter.value;
  els.dimensionFilter.innerHTML = '<option value="">全部维度</option>' + [...filterValues].map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
  els.dimensionFilter.value = current;
  populateSelect(els.dimensionSelect, state.dimensionOptions, '选择');
  populateSelect(els.subDimensionSelect, state.subDimensionOptions, '选择');
}

function renderCaseList() {
  const search = els.searchInput.value.trim().toLowerCase();
  const dim = els.dimensionFilter.value;
  const filtered = state.cases.filter((c) => {
    const haystack = [c.folderName, ...c.dimension, ...c.sub_dimension, ...c.prompt].join(' ').toLowerCase();
    return (!search || haystack.includes(search)) && (!dim || c.dimension.includes(dim));
  });

  if (filtered.length === 0) {
    els.caseList.innerHTML = '<div class="case-item"><p>无匹配 case</p></div>';
    return;
  }

  els.caseList.innerHTML = filtered.map((c) => {
    const errors = validateCase(c).length;
    return `
      <div class="case-item ${c.id === state.selectedId ? 'active' : ''}" data-case-id="${c.id}">
        <h4>${escapeHtml(c.folderName)}</h4>
        <p>${escapeHtml(c.sub_dimension.join(' / ') || '未填')}</p>
        <div class="meta">
          ${(c.dimension.length ? c.dimension : ['未填']).map((d) => `<span class="chip">${escapeHtml(d)}</span>`).join('')}
          <span class="chip">prompt ${c.prompt.filter((x) => x.trim()).length}</span>
          <span class="chip">ref ${c.ref.length}</span>
          ${errors ? `<span class="chip">缺 ${errors} 项</span>` : '<span class="chip">可导出</span>'}
        </div>
      </div>`;
  }).join('');

  document.querySelectorAll('[data-case-id]').forEach((node) => node.addEventListener('click', () => selectCase(node.dataset.caseId)));
}

function renderTokenList(container, values, onRemove, options = {}) {
  const { emptyText = '无', minLength = 0 } = options;
  if (!values.length) {
    container.innerHTML = `<span class="muted">${escapeHtml(emptyText)}</span>`;
    return;
  }
  container.innerHTML = values.map((value, index) => `
    <span class="token">
      <span>${escapeHtml(value)}</span>
      <button class="mini-btn" data-remove-index="${index}" ${values.length <= minLength ? 'disabled' : ''}>删除</button>
    </span>
  `).join('');
  container.querySelectorAll('[data-remove-index]').forEach((btn) => btn.addEventListener('click', () => onRemove(Number(btn.dataset.removeIndex))));
}

function renderPrompts(c) {
  els.promptList.innerHTML = c.prompt.map((value, index) => `
    <div class="prompt-item">
      <div class="prompt-item-header">
        <strong>Prompt ${index + 1}</strong>
        <button class="mini-btn" data-remove-prompt="${index}">删除</button>
      </div>
      <textarea data-prompt-index="${index}" rows="4" placeholder="prompt">${escapeHtml(value)}</textarea>
    </div>
  `).join('');

  els.promptList.querySelectorAll('[data-prompt-index]').forEach((textarea) => {
    textarea.addEventListener('input', () => {
      getSelectedCase().prompt[Number(textarea.dataset.promptIndex)] = textarea.value;
      syncSelectedCase();
    });
  });

  els.promptList.querySelectorAll('[data-remove-prompt]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const current = getSelectedCase();
      const idx = Number(btn.dataset.removePrompt);
      if (current.prompt.length === 1) current.prompt[0] = '';
      else current.prompt.splice(idx, 1);
      syncSelectedCase();
    });
  });
}

function renderRefs(c) {
  if (!c.ref.length) {
    els.refGrid.className = 'ref-grid empty';
    els.refGrid.textContent = '无参考图';
    return;
  }
  els.refGrid.className = 'ref-grid';
  els.refGrid.innerHTML = c.ref.map((ref, index) => `
    <div class="ref-item">
      <img src="${ref.url}" alt="${escapeHtml(ref.file.name)}" />
      <div class="ref-item-footer">
        <div>
          <div>${escapeHtml(ref.relativePath)}</div>
          <small>${escapeHtml(ref.file.name)}</small>
        </div>
        <button class="danger mini-btn" data-remove-ref="${index}">删除</button>
      </div>
    </div>
  `).join('');
  els.refGrid.querySelectorAll('[data-remove-ref]').forEach((btn) => btn.addEventListener('click', () => {
    const current = getSelectedCase();
    const idx = Number(btn.dataset.removeRef);
    URL.revokeObjectURL(current.ref[idx].url);
    current.ref.splice(idx, 1);
    syncSelectedCase();
  }));
}

function renderSelectedCase() {
  const c = getSelectedCase();
  const hasCase = Boolean(c);
  els.emptyState.classList.toggle('hidden', hasCase);
  els.editor.classList.toggle('hidden', !hasCase);
  if (!c) {
    els.editorTitle.textContent = '未选择 case';
    els.editorSubtitle.textContent = '';
    return;
  }

  els.editorTitle.textContent = c.folderName;
  els.editorSubtitle.textContent = c.dimension.join(' / ');
  els.folderName.value = c.folderName;
  els.passRule.value = c.pass_rule;
  els.dimensionCustomWrap.classList.add('hidden');
  els.subDimensionCustomWrap.classList.add('hidden');
  els.dimensionSelect.value = '';
  els.subDimensionSelect.value = '';

  renderTokenList(els.dimensionList, c.dimension, (index) => {
    if (c.dimension.length <= 1) return;
    c.dimension.splice(index, 1);
    syncSelectedCase();
  }, { emptyText: '未选', minLength: 1 });
  renderTokenList(els.subDimensionList, c.sub_dimension, (index) => {
    if (c.sub_dimension.length <= 1) return;
    c.sub_dimension.splice(index, 1);
    syncSelectedCase();
  }, { emptyText: '未选', minLength: 1 });
  renderTokenList(els.checkPointList, c.check_points, (index) => { c.check_points.splice(index, 1); syncSelectedCase(); });
  renderPrompts(c);
  renderRefs(c);
  if (!els.jsonPreviewPanel.classList.contains('hidden')) renderJsonPreview();

  const errors = validateCase(c);
  els.validationBox.className = 'validation-box' + (errors.length ? ' error' : ' hidden');
  els.validationBox.innerHTML = errors.length
    ? `<ul>${errors.map((e) => `<li>${escapeHtml(e)}</li>`).join('')}</ul>`
    : '';
}

function syncSelectedCase() {
  persistState();
  renderFilters();
  renderCaseList();
  renderSelectedCase();
}

function selectCase(id) {
  state.selectedId = id;
  renderCaseList();
  renderSelectedCase();
}

function addUniqueItem(field, value) {
  const c = getSelectedCase();
  if (!c) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (!c[field].includes(trimmed)) {
    c[field].push(trimmed);
    syncSelectedCase();
    return true;
  }
  return false;
}

function addOptionAndAttach(kind, value) {
  const trimmed = value.trim();
  if (!trimmed) return;
  if (kind === 'dimension') state.dimensionOptions = dedupe([...state.dimensionOptions, trimmed]);
  if (kind === 'sub_dimension') state.subDimensionOptions = dedupe([...state.subDimensionOptions, trimmed]);
  addUniqueItem(kind, trimmed);
}

function clearFieldList(field) {
  const c = getSelectedCase();
  if (!c) return;
  c[field] = [];
  syncSelectedCase();
}

function renderJsonPreview() {
  const c = getSelectedCase();
  if (!c) {
    els.jsonPreviewContent.textContent = '当前没有选中的 case。';
    return;
  }
  els.jsonPreviewContent.textContent = JSON.stringify(caseToExportPayload(c), null, 2);
}

function toggleJsonPreview(show) {
  els.jsonPreviewPanel.classList.toggle('hidden', !show);
  if (show) renderJsonPreview();
}

function addCheckPoint() {
  const value = els.checkPointInput.value.trim();
  if (!value) return;
  addUniqueItem('check_points', value);
  els.checkPointInput.value = '';
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

async function exportCurrentCase() {
  const c = getSelectedCase();
  if (!c) return;
  const errors = validateCase(c);
  if (errors.length) return alert(errors.join('\n'));
  const zip = new JSZip();
  const folder = zip.folder(c.folderName);
  folder.file('case.json', JSON.stringify(caseToExportPayload(c), null, 2));
  if (c.ref.length) {
    const refFolder = folder.folder('ref');
    c.ref.forEach((ref) => refFolder.file(ref.relativePath.replace(/^ref\//, ''), ref.file));
  }
  downloadBlob(await zip.generateAsync({ type: 'blob' }), `${c.folderName}.zip`);
}

async function exportDataset() {
  const invalid = state.cases.map((c) => ({ c, errors: validateCase(c) })).filter((x) => x.errors.length);
  if (invalid.length) return alert(`有 ${invalid.length} 条 case 未完成，无法导出。`);
  const zip = new JSZip();
  const root = zip.folder('dataset');
  const casesRoot = root.folder('cases');
  state.cases.forEach((c) => {
    const folder = casesRoot.folder(c.folderName);
    folder.file('case.json', JSON.stringify(caseToExportPayload(c), null, 2));
    if (c.ref.length) {
      const refFolder = folder.folder('ref');
      c.ref.forEach((ref) => refFolder.file(ref.relativePath.replace(/^ref\//, ''), ref.file));
    }
  });
  root.file('dataset_summary.json', JSON.stringify({
    total_cases: state.cases.length,
    exported_at: new Date().toISOString(),
    cases: state.cases.map((c) => ({ folder: c.folderName, dimension: c.dimension, sub_dimension: c.sub_dimension, ref_count: c.ref.length, prompt_count: c.prompt.filter((x) => x.trim()).length })),
  }, null, 2));
  downloadBlob(await zip.generateAsync({ type: 'blob' }), `case_dataset_${Date.now()}.zip`);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function extensionFromMimeType(mimeType) {
  const mime = (mimeType || '').toLowerCase();
  if (!mime.startsWith('image/')) return '';
  const raw = mime.split('/')[1]?.split(';')[0] || '';
  if (!raw) return '';
  if (raw === 'jpeg') return 'jpg';
  if (raw === 'svg+xml') return 'svg';
  return raw.split('+')[0];
}

function extensionFromName(name) {
  const match = String(name || '').match(/\.([a-zA-Z0-9]+)(?:[?#].*)?$/);
  return match?.[1]?.toLowerCase() || '';
}

function isImageFile(file) {
  if (!file) return false;
  if ((file.type || '').startsWith('image/')) return true;
  return Boolean((file.name || '').match(/\.(png|jpe?g|webp|gif|bmp|svg|avif)$/i));
}

function isZipFile(file) {
  if (!file) return false;
  if ((file.name || '').toLowerCase().endsWith('.zip')) return true;
  const type = (file.type || '').toLowerCase();
  return type.includes('zip');
}

function getZipFileFromDataTransfer(dataTransfer) {
  const files = Array.from(dataTransfer?.files || []);
  return files.find((file) => isZipFile(file)) || null;
}

function extractImageUrlsFromDataTransfer(dataTransfer) {
  if (!dataTransfer) return [];
  const urls = [];
  const uriList = dataTransfer.getData('text/uri-list');
  if (uriList) {
    uriList
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .forEach((line) => urls.push(line));
  }

  const plainText = dataTransfer.getData('text/plain')?.trim();
  if (plainText) urls.push(plainText);

  const html = dataTransfer.getData('text/html');
  if (html) {
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      doc.querySelectorAll('img[src]').forEach((img) => urls.push(img.src));
      doc.querySelectorAll('a[href]').forEach((a) => {
        const href = a.getAttribute('href') || '';
        if (href.match(/\.(png|jpe?g|webp|gif|bmp|svg|avif)(\?|#|$)/i)) urls.push(href);
      });
    } catch (error) {
      console.warn('Failed to parse dropped HTML', error);
    }
  }

  return dedupe(urls).filter((url) => /^https?:\/\//i.test(url) || /^data:image\//i.test(url));
}

function buildFileNameFromUrl(url, index, mimeType) {
  let rawName = '';
  try {
    const parsed = new URL(url);
    rawName = decodeURIComponent(parsed.pathname.split('/').pop() || '');
  } catch (error) {
    rawName = '';
  }

  const ext = extensionFromName(rawName) || extensionFromMimeType(mimeType) || 'png';
  const base = rawName && rawName.includes('.') ? rawName.slice(0, rawName.lastIndexOf('.')) : `remote_${String(index).padStart(2, '0')}`;
  const safeBase = base.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '') || `remote_${String(index).padStart(2, '0')}`;
  return `${safeBase}.${ext}`;
}

async function appendRefFile(c, file) {
  const ext = extensionFromName(file.name) || extensionFromMimeType(file.type) || 'png';
  const n = c.ref.length + 1;
  const dataUrl = await fileToDataUrl(file);
  c.ref.push({
    id: uid(),
    file,
    url: URL.createObjectURL(file),
    relativePath: `ref/ref_${String(n).padStart(2, '0')}.${ext}`,
    dataUrl,
  });
}

async function addRefFiles(files) {
  const c = getSelectedCase();
  if (!c || !files.length) return;
  let added = 0;
  for (const file of files) {
    if (!isImageFile(file)) continue;
    await appendRefFile(c, file);
    added += 1;
  }
  if (added) syncSelectedCase();
}

async function addRefUrls(urls) {
  const c = getSelectedCase();
  if (!c || !urls.length) return;

  let added = 0;
  let failed = 0;
  for (const [index, url] of urls.entries()) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const fileName = buildFileNameFromUrl(url, index + 1, blob.type);
      const file = new File([blob], fileName, { type: blob.type || `image/${extensionFromName(fileName) || 'png'}` });
      if (!isImageFile(file)) throw new Error('Not an image');
      await appendRefFile(c, file);
      added += 1;
    } catch (error) {
      failed += 1;
      console.warn('Failed to import dropped image URL', url, error);
    }
  }

  if (added) syncSelectedCase();
  if (failed) alert(`有 ${failed} 张图片导入失败。`);
}

async function addRefsFromDrop(dataTransfer) {
  if (!dataTransfer) return;
  const files = Array.from(dataTransfer.files || []);
  const imageFiles = files.filter((file) => isImageFile(file));
  if (imageFiles.length) {
    await addRefFiles(imageFiles);
    return;
  }

  const imageUrls = extractImageUrlsFromDataTransfer(dataTransfer);
  if (imageUrls.length) await addRefUrls(imageUrls);
}

function isTargetInsideRefDropzone(target) {
  return target instanceof Element && els.refDropzone.contains(target);
}

function hasFilePayload(dataTransfer) {
  if (!dataTransfer) return false;
  if (dataTransfer.files?.length) return true;
  return Array.from(dataTransfer.types || []).includes('Files');
}

async function importDatasetZip(file) {
  if (!window.JSZip) return alert('JSZip 未加载，导入功能暂时不可用。');
  if (state.cases.length && !confirm('导入会替换当前全部 case，继续？')) return;
  const zip = await window.JSZip.loadAsync(file);
  const caseJsonPaths = Object.keys(zip.files).filter((path) => /(^|\/)case\.json$/.test(path) && !path.includes('__MACOSX') && !path.split('/').pop().startsWith('._')).sort();
  if (!caseJsonPaths.length) return alert('没有在 ZIP 里找到 case.json。');

  const importedCases = [];
  for (const caseJsonPath of caseJsonPaths) {
    const data = JSON.parse(await zip.file(caseJsonPath).async('string'));
    const folderPath = caseJsonPath.slice(0, -'case.json'.length);
    const folderName = folderPath.split('/').filter(Boolean).pop() || `case_${importedCases.length + 1}`;
    const refs = [];
    for (const relativePath of data.ref || []) {
      const entry = zip.file(`${folderPath}${relativePath}`);
      if (!entry) continue;
      const blob = await entry.async('blob');
      const fileObj = new File([blob], relativePath.split('/').pop(), { type: blob.type || 'image/png' });
      refs.push({ id: uid(), file: fileObj, url: URL.createObjectURL(fileObj), relativePath, dataUrl: await fileToDataUrl(fileObj) });
    }
    importedCases.push({
      id: uid(),
      folderName,
      dimension: data.dimension || [],
      sub_dimension: data.sub_dimension || [],
      prompt: data.prompt?.length ? data.prompt : [''],
      ref: refs,
      check_points: data.check_points || [],
      pass_rule: data.pass_rule || '',
    });
    state.dimensionOptions = dedupe([...state.dimensionOptions, ...(data.dimension || [])]);
    state.subDimensionOptions = dedupe([...state.subDimensionOptions, ...(data.sub_dimension || [])]);
  }

  state.cases.forEach((c) => c.ref.forEach((r) => URL.revokeObjectURL(r.url)));
  state.cases = importedCases;
  state.selectedId = importedCases[0]?.id || null;
  syncSelectedCase();
}

function toggleCustomWrap(kind, show) {
  const wrap = kind === 'dimension' ? els.dimensionCustomWrap : els.subDimensionCustomWrap;
  const input = kind === 'dimension' ? els.dimensionCustomInput : els.subDimensionCustomInput;
  wrap.classList.toggle('hidden', !show);
  if (show) input.focus();
}

function bindEvents() {
  els.themeToggleBtn.addEventListener('click', () => applyTheme(state.theme === 'dark' ? 'light' : 'dark'));
  els.addCaseBtn.addEventListener('click', () => {
    const newCase = createEmptyCase();
    state.cases.unshift(newCase);
    state.selectedId = newCase.id;
    syncSelectedCase();
  });
  els.duplicateCaseBtn.addEventListener('click', () => {
    const c = getSelectedCase();
    if (!c) return;
    const cloned = {
      ...structuredClone({ ...c, ref: [], id: undefined }),
      id: uid(),
      folderName: `${c.folderName}_copy`,
      ref: c.ref.map((ref, idx) => ({ id: uid(), file: ref.file, url: URL.createObjectURL(ref.file), relativePath: `ref/ref_${String(idx + 1).padStart(2, '0')}.${ref.file.name.split('.').pop() || 'png'}`, dataUrl: ref.dataUrl })),
    };
    state.cases.unshift(cloned);
    state.selectedId = cloned.id;
    syncSelectedCase();
  });
  els.deleteCaseBtn.addEventListener('click', () => {
    const c = getSelectedCase();
    if (!c) return;
    if (!confirm(`删除 case：${c.folderName}？`)) return;
    c.ref.forEach((ref) => URL.revokeObjectURL(ref.url));
    state.cases = state.cases.filter((item) => item.id !== c.id);
    state.selectedId = state.cases[0]?.id || null;
    syncSelectedCase();
  });
  els.exportCaseBtn.addEventListener('click', exportCurrentCase);
  els.exportDatasetBtn.addEventListener('click', exportDataset);
  els.searchInput.addEventListener('input', renderCaseList);
  els.dimensionFilter.addEventListener('change', renderCaseList);
  els.folderName.addEventListener('input', () => { const c = getSelectedCase(); if (!c) return; c.folderName = els.folderName.value; syncSelectedCase(); });
  els.passRule.addEventListener('input', () => { const c = getSelectedCase(); if (!c) return; c.pass_rule = els.passRule.value; syncSelectedCase(); });
  els.checkPointInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addCheckPoint(); } });
  document.querySelector('[data-add="check_points"]').addEventListener('click', addCheckPoint);

  els.dimensionSelect.addEventListener('change', () => {
    addUniqueItem('dimension', els.dimensionSelect.value);
    els.dimensionSelect.value = '';
  });
  els.subDimensionSelect.addEventListener('change', () => {
    addUniqueItem('sub_dimension', els.subDimensionSelect.value);
    els.subDimensionSelect.value = '';
  });
  els.clearDimensionBtn.addEventListener('click', () => clearFieldList('dimension'));
  els.clearSubDimensionBtn.addEventListener('click', () => clearFieldList('sub_dimension'));
  els.showDimensionCustomBtn.addEventListener('click', () => toggleCustomWrap('dimension', true));
  els.showSubDimensionCustomBtn.addEventListener('click', () => toggleCustomWrap('sub_dimension', true));
  els.confirmDimensionCustomBtn.addEventListener('click', () => {
    addOptionAndAttach('dimension', els.dimensionCustomInput.value);
    els.dimensionCustomInput.value = '';
    toggleCustomWrap('dimension', false);
  });
  els.confirmSubDimensionCustomBtn.addEventListener('click', () => {
    addOptionAndAttach('sub_dimension', els.subDimensionCustomInput.value);
    els.subDimensionCustomInput.value = '';
    toggleCustomWrap('sub_dimension', false);
  });
  els.previewJsonBtn.addEventListener('click', () => toggleJsonPreview(true));
  els.closeJsonPreviewBtn.addEventListener('click', () => toggleJsonPreview(false));
  els.dimensionCustomInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); els.confirmDimensionCustomBtn.click(); } });
  els.subDimensionCustomInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); els.confirmSubDimensionCustomBtn.click(); } });

  els.addPromptBtn.addEventListener('click', () => {
    const c = getSelectedCase();
    if (!c) return;
    c.prompt.push('');
    syncSelectedCase();
  });

  els.refUpload.addEventListener('change', async () => {
    await addRefFiles(Array.from(els.refUpload.files || []));
    els.refUpload.value = '';
  });

  ['dragenter', 'dragover'].forEach((eventName) => {
    els.refDropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      els.refDropzone.classList.add('dragover');
    });
  });
  els.refDropzone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isTargetInsideRefDropzone(e.relatedTarget)) {
      els.refDropzone.classList.remove('dragover');
    }
  });
  els.refDropzone.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const zipFile = getZipFileFromDataTransfer(e.dataTransfer);
      if (zipFile) await importDatasetZip(zipFile);
      else await addRefsFromDrop(e.dataTransfer);
    } finally {
      els.refDropzone.classList.remove('dragover');
    }
  });

  document.addEventListener('dragover', (e) => {
    if (!hasFilePayload(e.dataTransfer)) return;
    if (isTargetInsideRefDropzone(e.target)) return;
    e.preventDefault();
  });

  document.addEventListener('drop', async (e) => {
    if (!hasFilePayload(e.dataTransfer)) return;
    if (isTargetInsideRefDropzone(e.target)) return;
    e.preventDefault();
    const zipFile = getZipFileFromDataTransfer(e.dataTransfer);
    if (!zipFile) return;
    await importDatasetZip(zipFile);
  });

  els.importZipInput.addEventListener('change', async () => {
    const file = els.importZipInput.files?.[0];
    if (!file) return;
    await importDatasetZip(file);
    els.importZipInput.value = '';
  });
}

function init() {
  applyTheme(localStorage.getItem(THEME_KEY) || 'light');
  renderFilters();
  bindEvents();
  const restored = restoreState();
  if (!restored) {
    const first = createEmptyCase();
    state.cases.push(first);
    state.selectedId = first.id;
  }
  syncSelectedCase();
}

init();
