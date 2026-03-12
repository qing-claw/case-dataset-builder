const PRESET_DIMENSIONS = [
  '风格表现',
  '角色表现',
  '复杂构图能力',
  '指令遵循',
  '提示词适配能力',
  '边界案例'
];

const STORAGE_KEY = 'case-dataset-builder:v1';

const state = {
  cases: [],
  selectedId: null,
};

const els = {
  caseList: document.getElementById('case-list'),
  addCaseBtn: document.getElementById('add-case-btn'),
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
  dimensionInput: document.getElementById('dimension-input'),
  subDimensionInput: document.getElementById('sub-dimension-input'),
  checkPointInput: document.getElementById('check-point-input'),
  addPromptBtn: document.getElementById('add-prompt-btn'),
  passRule: document.getElementById('pass-rule'),
  refUpload: document.getElementById('ref-upload'),
  refGrid: document.getElementById('ref-grid'),
  jsonPreview: document.getElementById('json-preview'),
  structurePreview: document.getElementById('structure-preview'),
  validationBox: document.getElementById('validation-box'),
};

function uid() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2, 10);
}

function slugify(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48) || `case_${Date.now()}`;
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
  const payload = {
    selectedId: state.selectedId,
    cases: state.cases.map(serializableCase),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
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

function getSelectedCase() {
  return state.cases.find((c) => c.id === state.selectedId) || null;
}

function caseToExportPayload(c) {
  return {
    dimension: c.dimension,
    sub_dimension: c.sub_dimension,
    prompt: c.prompt.filter(Boolean),
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

function renderFilters() {
  const values = new Set(PRESET_DIMENSIONS);
  state.cases.forEach((c) => c.dimension.forEach((d) => values.add(d)));
  const current = els.dimensionFilter.value;
  els.dimensionFilter.innerHTML = '<option value="">全部维度</option>' +
    [...values].map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
  els.dimensionFilter.value = current;
}

function renderCaseList() {
  const search = els.searchInput.value.trim().toLowerCase();
  const dim = els.dimensionFilter.value;
  const filtered = state.cases.filter((c) => {
    const haystack = [c.folderName, ...c.dimension, ...c.sub_dimension, ...c.prompt].join(' ').toLowerCase();
    const matchSearch = !search || haystack.includes(search);
    const matchDim = !dim || c.dimension.includes(dim);
    return matchSearch && matchDim;
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

  document.querySelectorAll('[data-case-id]').forEach((node) => {
    node.addEventListener('click', () => selectCase(node.dataset.caseId));
  });
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
  container.querySelectorAll('[data-remove-index]').forEach((btn) => {
    btn.addEventListener('click', () => onRemove(Number(btn.dataset.removeIndex)));
  });
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
      const current = getSelectedCase();
      current.prompt[Number(textarea.dataset.promptIndex)] = textarea.value;
      syncSelectedCase();
    });
  });

  els.promptList.querySelectorAll('[data-remove-prompt]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const current = getSelectedCase();
      if (current.prompt.length === 1) {
        current.prompt[0] = '';
      } else {
        current.prompt.splice(Number(btn.dataset.removePrompt), 1);
      }
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
  els.refGrid.querySelectorAll('[data-remove-ref]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const current = getSelectedCase();
      const idx = Number(btn.dataset.removeRef);
      URL.revokeObjectURL(current.ref[idx].url);
      current.ref.splice(idx, 1);
      syncSelectedCase();
    });
  });
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
  els.editorSubtitle.textContent = c.dimension.join(' / ') || '先补维度，不然导出的时候会很诚实地报错';
  els.folderName.value = c.folderName;
  els.passRule.value = c.pass_rule;

  renderTokenList(els.dimensionList, c.dimension, (index) => {
    c.dimension.splice(index, 1);
    syncSelectedCase();
  });
  renderTokenList(els.subDimensionList, c.sub_dimension, (index) => {
    c.sub_dimension.splice(index, 1);
    syncSelectedCase();
  });
  renderTokenList(els.checkPointList, c.check_points, (index) => {
    c.check_points.splice(index, 1);
    syncSelectedCase();
  });
  renderPrompts(c);
  renderRefs(c);

  const payload = caseToExportPayload(c);
  els.jsonPreview.textContent = JSON.stringify(payload, null, 2);
  els.structurePreview.textContent = [
    `${c.folderName}/`,
    '  case.json',
    ...(c.ref.length ? ['  ref/', ...c.ref.map((r) => `    ${r.relativePath.replace(/^ref\//, '')}`)] : []),
  ].join('\n');

  const errors = validateCase(c);
  els.validationBox.className = 'validation-box' + (errors.length ? ' error' : '');
  els.validationBox.innerHTML = errors.length
    ? `<strong>当前不可导出：</strong><ul>${errors.map((e) => `<li>${escapeHtml(e)}</li>`).join('')}</ul>`
    : '校验通过。至少结构上，它现在像个能交给别人的 case 了。';
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

function addItem(field, input) {
  const c = getSelectedCase();
  if (!c) return;
  const value = input.value.trim();
  if (!value) return;
  c[field].push(value);
  input.value = '';
  syncSelectedCase();
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
  if (errors.length) {
    alert(errors.join('\n'));
    return;
  }
  const zip = new JSZip();
  const folder = zip.folder(c.folderName);
  folder.file('case.json', JSON.stringify(caseToExportPayload(c), null, 2));
  if (c.ref.length) {
    const refFolder = folder.folder('ref');
    c.ref.forEach((ref) => {
      refFolder.file(ref.relativePath.replace(/^ref\//, ''), ref.file);
    });
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, `${c.folderName}.zip`);
}

async function exportDataset() {
  const invalid = state.cases.map((c) => ({ c, errors: validateCase(c) })).filter((x) => x.errors.length);
  if (invalid.length) {
    alert(`还有 ${invalid.length} 条 case 不可导出。先补齐必填项。`);
    return;
  }
  const zip = new JSZip();
  const root = zip.folder('dataset');
  const casesRoot = root.folder('cases');

  state.cases.forEach((c) => {
    const folder = casesRoot.folder(c.folderName);
    folder.file('case.json', JSON.stringify(caseToExportPayload(c), null, 2));
    if (c.ref.length) {
      const refFolder = folder.folder('ref');
      c.ref.forEach((ref) => {
        refFolder.file(ref.relativePath.replace(/^ref\//, ''), ref.file);
      });
    }
  });

  root.file('dataset_summary.json', JSON.stringify({
    total_cases: state.cases.length,
    exported_at: new Date().toISOString(),
    cases: state.cases.map((c) => ({
      folder: c.folderName,
      dimension: c.dimension,
      sub_dimension: c.sub_dimension,
      ref_count: c.ref.length,
      prompt_count: c.prompt.filter(Boolean).length,
    })),
  }, null, 2));

  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, `case_dataset_${Date.now()}.zip`);
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

async function importDatasetZip(file) {
  if (!window.JSZip) {
    alert('JSZip 未加载，导入功能暂时不可用。');
    return;
  }

  const zip = await window.JSZip.loadAsync(file);
  const caseJsonPaths = Object.keys(zip.files)
    .filter((path) => /(^|\/)case\.json$/.test(path) && !path.includes('__MACOSX') && !path.split('/').pop().startsWith('._'))
    .sort();

  if (!caseJsonPaths.length) {
    alert('没有在 ZIP 里找到 case.json。');
    return;
  }

  const importedCases = [];
  for (const caseJsonPath of caseJsonPaths) {
    const jsonText = await zip.file(caseJsonPath).async('string');
    const data = JSON.parse(jsonText);
    const folderPath = caseJsonPath.slice(0, -'case.json'.length);
    const folderName = folderPath.split('/').filter(Boolean).pop() || `case_${importedCases.length + 1}`;

    const refs = [];
    for (const relativePath of data.ref || []) {
      const zipPath = `${folderPath}${relativePath}`;
      const entry = zip.file(zipPath);
      if (!entry) continue;
      const blob = await entry.async('blob');
      const fileObj = new File([blob], relativePath.split('/').pop(), { type: blob.type || 'image/png' });
      const dataUrl = await fileToDataUrl(fileObj);
      refs.push({
        id: uid(),
        file: fileObj,
        url: URL.createObjectURL(fileObj),
        relativePath,
        dataUrl,
      });
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
  }

  state.cases.forEach((c) => c.ref.forEach((r) => URL.revokeObjectURL(r.url)));
  state.cases = importedCases;
  state.selectedId = importedCases[0]?.id || null;
  syncSelectedCase();
}

function bindEvents() {
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
      folderName: `${slugify(c.folderName)}_copy`,
      ref: c.ref.map((ref, idx) => ({
        id: uid(),
        file: ref.file,
        url: URL.createObjectURL(ref.file),
        relativePath: `ref/ref_${String(idx + 1).padStart(2, '0')}.${ref.file.name.split('.').pop() || 'png'}`,
        dataUrl: ref.dataUrl,
      })),
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

  els.folderName.addEventListener('input', () => {
    const c = getSelectedCase();
    if (!c) return;
    c.folderName = els.folderName.value;
    syncSelectedCase();
  });

  els.passRule.addEventListener('input', () => {
    const c = getSelectedCase();
    if (!c) return;
    c.pass_rule = els.passRule.value;
    syncSelectedCase();
  });

  document.querySelectorAll('[data-add]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const field = btn.dataset.add;
      if (field === 'dimension') addItem('dimension', els.dimensionInput);
      if (field === 'sub_dimension') addItem('sub_dimension', els.subDimensionInput);
      if (field === 'check_points') addItem('check_points', els.checkPointInput);
    });
  });

  [
    [els.dimensionInput, 'dimension'],
    [els.subDimensionInput, 'sub_dimension'],
    [els.checkPointInput, 'check_points'],
  ].forEach(([input, field]) => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addItem(field, input);
      }
    });
  });

  els.addPromptBtn.addEventListener('click', () => {
    const c = getSelectedCase();
    if (!c) return;
    c.prompt.push('');
    syncSelectedCase();
  });

  els.refUpload.addEventListener('change', async () => {
    const c = getSelectedCase();
    if (!c) return;
    const files = Array.from(els.refUpload.files || []);
    for (let idx = 0; idx < files.length; idx += 1) {
      const file = files[idx];
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
    els.refUpload.value = '';
    syncSelectedCase();
  });

  els.importZipInput.addEventListener('change', async () => {
    const file = els.importZipInput.files?.[0];
    if (!file) return;
    await importDatasetZip(file);
    els.importZipInput.value = '';
  });
}

function init() {
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
