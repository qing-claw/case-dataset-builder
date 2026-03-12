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
  addDimensionSelectBtn: document.getElementById('add-dimension-select-btn'),
  addSubDimensionSelectBtn: document.getElementById('add-sub-dimension-select-btn'),
  showDimensionCustomBtn: document.getElementById('show-dimension-custom-btn'),
  showSubDimensionCustomBtn: document.getElementById('show-sub-dimension-custom-btn'),
  dimensionCustomWrap: document.getElementById('dimension-custom-wrap'),
  subDimensionCustomWrap: document.getElementById('sub-dimension-custom-wrap'),
  dimensionCustomInput: document.getElementById('dimension-custom-input'),
  subDimensionCustomInput: document.getElementById('sub-dimension-custom-input'),
  confirmDimensionCustomBtn: document.getElementById('confirm-dimension-custom-btn'),
  confirmSubDimensionCustomBtn: document.getElementById('confirm-sub-dimension-custom-btn'),
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

function serializableCase(c) {
  return {
    id: c.id,
    folderName: c.folderName,
    dimension: c.dimension,
    sub_dimension: c.sub_dimension,
    prompt: c.prompt,
    ref: c.ref.map((r) => ({
      id: r.id,
      name: r.file.name,
      type: r.file.type,
      relativePath: r.relativePath,
      dataUrl: r.dataUrl,
    })),
    check_points: c.check_points,
    pass_rule: c.pass_rule,
  };
}

function persistState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    selectedId: state.selectedId,
    cases: state.cases.map(serializableCase),
    dimensionOptions: state.dimensionOptions,
    subDimensionOptions: state.subDimensionOptions,
  }));
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
        const file = dataUrlToFile(r.dataUrl, r.name, r.type);
        return {
          id: r.id || uid(),
          file,
          url: URL.createObjectURL(file),
          relativePath: r.relativePath,
          dataUrl: r.dataUrl,
        };
      }),
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

function validateCase(c) {
  const errors = [];
  if (!c.folderName.trim()) errors.push('文件夹名不能为空');
  if (c.dimension.length === 0) errors.push('至少添加一个 dimension');
  if (c.sub_dimension.length === 0) errors.push('至少添加一个 sub_dimension');
  if (c.prompt.filter((x) => x.trim()).length === 0) errors.push('至少填写一个 prompt');
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
  populateSelect(els.dimensionSelect, state.dimensionOptions, '选择一个维度');
  populateSelect(els.subDimensionSelect, state.subDimensionOptions, '选择一个子项');
}

function renderCaseList() {
  const search = els.searchInput.value.trim().toLowerCase();
  const dim = els.dimensionFilter.value;
  const filtered = state.cases.filter((c) => {
    const haystack = [c.folderName, ...c.dimension, ...c.sub_dimension, ...c.prompt].join(' ').toLowerCase();
    return (!search || haystack.includes(search)) && (!dim || c.dimension.includes(dim));
  });

  if (filtered.length === 0) {
    els.caseList.innerHTML = '<div class="case-item"><p>没有匹配的 case。空空如也，倒也诚实。</p></div>';
    return;
  }

  els.caseList.innerHTML = filtered.map((c) => {
    const errors = validateCase(c).length;
    return `
      <div class="case-item ${c.id === state.selectedId ? 'active' : ''}" data-case-id="${c.id}">
        <h4>${escapeHtml(c.folderName)}</h4>
        <p>${escapeHtml(c.sub_dimension.join(' / ') || '未填写子项')}</p>
        <div class="meta">
          ${(c.dimension.length ? c.dimension : ['未填维度']).map((d) => `<span class="chip">${escapeHtml(d)}</span>`).join('')}
          <span class="chip">prompt ${c.prompt.filter((x) => x.trim()).length}</span>
          <span class="chip">ref ${c.ref.length}</span>
          ${errors ? `<span class="chip">缺 ${errors} 项</span>` : '<span class="chip">可导出</span>'}
        </div>
      </div>`;
  }).join('');

  document.querySelectorAll('[data-case-id]').forEach((node) => node.addEventListener('click', () => selectCase(node.dataset.caseId)));
}

function renderTokenList(container, values, onRemove) {
  if (!values.length) {
    container.innerHTML = '<span class="muted">暂无</span>';
    return;
  }
  container.innerHTML = values.map((value, index) => `
    <span class="token">
      <span>${escapeHtml(value)}</span>
      <button class="mini-btn" data-remove-index="${index}">×</button>
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
      <textarea data-prompt-index="${index}" rows="4" placeholder="输入这一条 prompt 变体">${escapeHtml(value)}</textarea>
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
    els.refGrid.textContent = '暂无参考图';
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
    return;
  }

  els.editorTitle.textContent = c.folderName;
  els.editorSubtitle.textContent = c.dimension.join(' / ') || '先补维度';
  els.folderName.value = c.folderName;
  els.passRule.value = c.pass_rule;
  els.dimensionCustomWrap.classList.add('hidden');
  els.subDimensionCustomWrap.classList.add('hidden');
  els.dimensionSelect.value = '';
  els.subDimensionSelect.value = '';

  renderTokenList(els.dimensionList, c.dimension, (index) => { c.dimension.splice(index, 1); syncSelectedCase(); });
  renderTokenList(els.subDimensionList, c.sub_dimension, (index) => { c.sub_dimension.splice(index, 1); syncSelectedCase(); });
  renderTokenList(els.checkPointList, c.check_points, (index) => { c.check_points.splice(index, 1); syncSelectedCase(); });
  renderPrompts(c);
  renderRefs(c);

  const errors = validateCase(c);
  els.validationBox.className = 'validation-box' + (errors.length ? ' error' : '');
  els.validationBox.innerHTML = errors.length
    ? `<strong>还差这几项：</strong><ul>${errors.map((e) => `<li>${escapeHtml(e)}</li>`).join('')}</ul>`
    : '当前 case 已可导出。';
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
  if (!c) return;
  const trimmed = value.trim();
  if (!trimmed) return;
  if (!c[field].includes(trimmed)) c[field].push(trimmed);
  syncSelectedCase();
}

function addOptionAndAttach(kind, value) {
  const trimmed = value.trim();
  if (!trimmed) return;
  if (kind === 'dimension') state.dimensionOptions = dedupe([...state.dimensionOptions, trimmed]);
  if (kind === 'sub_dimension') state.subDimensionOptions = dedupe([...state.subDimensionOptions, trimmed]);
  addUniqueItem(kind, trimmed);
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
  if (invalid.length) return alert(`还有 ${invalid.length} 条 case 不可导出。先补齐必填项。`);
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

async function addRefFiles(files) {
  const c = getSelectedCase();
  if (!c || !files.length) return;
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const ext = file.name.split('.').pop() || 'png';
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
  syncSelectedCase();
}

async function importDatasetZip(file) {
  if (!window.JSZip) return alert('JSZip 未加载，导入功能暂时不可用。');
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

  els.addDimensionSelectBtn.addEventListener('click', () => addUniqueItem('dimension', els.dimensionSelect.value));
  els.addSubDimensionSelectBtn.addEventListener('click', () => addUniqueItem('sub_dimension', els.subDimensionSelect.value));
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
      els.refDropzone.classList.add('dragover');
    });
  });
  ['dragleave', 'drop'].forEach((eventName) => {
    els.refDropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      if (eventName === 'drop') addRefFiles(Array.from(e.dataTransfer.files || []));
      els.refDropzone.classList.remove('dragover');
    });
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
