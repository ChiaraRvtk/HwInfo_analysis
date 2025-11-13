const { Chart } = window;

if (!Chart) {
  throw new Error('Chart.js não foi carregado. Verifique se o script UMD está incluído.');
}

const DEFAULT_THEME = {
  name: 'midnight',
  customAccent: '#60a5fa',
  surfaceAlpha: 0.85
};

const CHART_LABEL_FONT_SIZE = 14;

const state = {
  selectedReports: [],
  hardwarePath: null,
  result: null,
  chartInstance: null,
  currentCategory: null,
  hiddenReports: new Set(),
  hiddenMetrics: new Set(),
  theme: { ...DEFAULT_THEME },
  chartPercMode: false
};

const THEME_PRESETS = {
  midnight: {
    id: 'midnight',
    label: 'Midnight',
    background: '#020617',
    gradient1: 'rgba(99, 102, 241, 0.25)',
    gradient2: 'rgba(14, 165, 233, 0.15)',
    surfaceBase: '#0f172a',
    surfaceAlt: '#020617',
    border: 'rgba(148, 163, 184, 0.25)',
    borderStrong: 'rgba(148, 163, 184, 0.35)',
    text: '#e2e8f0',
    muted: '#94a3b8',
    accent: '#60a5fa',
    accentStrong: '#2563eb',
    accentSoft: 'rgba(59, 130, 246, 0.2)',
    accentSoftBorder: 'rgba(99, 102, 241, 0.4)',
    surfaceAlpha: 0.85
  },
  sunrise: {
    id: 'sunrise',
    label: 'Sunrise',
    background: '#1f0a21',
    gradient1: 'rgba(251, 113, 133, 0.25)',
    gradient2: 'rgba(244, 114, 182, 0.2)',
    surfaceBase: '#2d0f2f',
    surfaceAlt: '#1a0524',
    border: 'rgba(248, 187, 208, 0.3)',
    borderStrong: 'rgba(248, 187, 208, 0.45)',
    text: '#ffe4ef',
    muted: '#fca5a5',
    eyebrow: '#f9a8d4',
    subtle: '#fcd6e8',
    pillText: '#fee2e2',
    accent: '#f472b6',
    accentStrong: '#ec4899',
    accentSoft: 'rgba(244, 114, 182, 0.25)',
    accentSoftBorder: 'rgba(244, 114, 182, 0.45)',
    surfaceAlpha: 0.8
  },
  emerald: {
    id: 'emerald',
    label: 'Emerald',
    background: '#011a17',
    gradient1: 'rgba(16, 185, 129, 0.25)',
    gradient2: 'rgba(5, 150, 105, 0.2)',
    surfaceBase: '#022c22',
    surfaceAlt: '#011611',
    border: 'rgba(16, 185, 129, 0.3)',
    borderStrong: 'rgba(16, 185, 129, 0.45)',
    text: '#d1fae5',
    muted: '#6ee7b7',
    eyebrow: '#a7f3d0',
    subtle: '#bbf7d0',
    pillText: '#ccfbf1',
    accent: '#34d399',
    accentStrong: '#059669',
    accentSoft: 'rgba(52, 211, 153, 0.25)',
    accentSoftBorder: 'rgba(52, 211, 153, 0.45)',
    surfaceAlpha: 0.8
  }
};

function hexToRgb(color) {
  const hex = color.replace('#', '');
  const normalized = hex.length === 3 ? hex.split('').map((char) => char + char).join('') : hex;
  const int = parseInt(normalized, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255
  };
}

function buildRgba(color, alpha) {
  if (!color) {
    return `rgba(15, 23, 42, ${alpha})`;
  }
  if (color.startsWith('#')) {
    const { r, g, b } = hexToRgb(color);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (color.startsWith('rgb')) {
    const values = color
      .replace(/rgba?\(/, '')
      .replace(')', '')
      .split(',')
      .map((entry) => Number(entry.trim()))
      .filter((entry, index) => index < 3);
    const [r = 15, g = 23, b = 42] = values;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}

function applyTheme(themeConfig = DEFAULT_THEME, options = {}) {
  const preset = THEME_PRESETS[themeConfig.name] || THEME_PRESETS.midnight;
  const merged = {
    name: themeConfig.name || preset.id,
    customAccent: themeConfig.customAccent || preset.accent,
    surfaceAlpha:
      typeof themeConfig.surfaceAlpha === 'number'
        ? themeConfig.surfaceAlpha
        : preset.surfaceAlpha ?? DEFAULT_THEME.surfaceAlpha
  };
  const accent = merged.customAccent || preset.accent;
  const surfaceAlpha = Math.min(0.95, Math.max(0.5, merged.surfaceAlpha));
  document.documentElement.style.setProperty('--bg-color', preset.background || DEFAULT_THEME.background || '#020617');
  document.documentElement.style.setProperty('--gradient-1', preset.gradient1 || 'rgba(99, 102, 241, 0.25)');
  document.documentElement.style.setProperty('--gradient-2', preset.gradient2 || 'rgba(14, 165, 233, 0.15)');
  document.documentElement.style.setProperty('--color-text', preset.text || DEFAULT_THEME.text || '#e2e8f0');
  document.documentElement.style.setProperty('--color-muted', preset.muted || DEFAULT_THEME.muted || '#94a3b8');
  document.documentElement.style.setProperty('--color-eyebrow', preset.eyebrow || '#a5b4fc');
  document.documentElement.style.setProperty('--color-subtle', preset.subtle || '#cbd5f5');
  document.documentElement.style.setProperty('--color-accent', accent);
  document.documentElement.style.setProperty(
    '--color-accent-strong',
    preset.accentStrong || accent
  );
  document.documentElement.style.setProperty(
    '--color-accent-soft',
    preset.accentSoft || 'rgba(59, 130, 246, 0.2)'
  );
  document.documentElement.style.setProperty(
    '--color-accent-soft-border',
    preset.accentSoftBorder || 'rgba(99, 102, 241, 0.4)'
  );
  document.documentElement.style.setProperty('--color-pill-text', preset.pillText || '#93c5fd');
  const baseSurface = preset.surfaceBase || '#0f172a';
  const altSurface = preset.surfaceAlt || '#020617';
  document.documentElement.style.setProperty('--surface-strong', buildRgba(baseSurface, Math.min(surfaceAlpha + 0.07, 0.98)));
  document.documentElement.style.setProperty('--surface-medium', buildRgba(baseSurface, surfaceAlpha));
  document.documentElement.style.setProperty('--surface-panel', buildRgba(altSurface, Math.max(surfaceAlpha - 0.05, 0.65)));
  document.documentElement.style.setProperty('--surface-soft', buildRgba(altSurface, Math.max(surfaceAlpha - 0.12, 0.55)));
  document.documentElement.style.setProperty('--surface-alt', buildRgba(altSurface, Math.max(surfaceAlpha - 0.2, 0.45)));
  document.documentElement.style.setProperty('--border-color', preset.border || 'rgba(148, 163, 184, 0.25)');
  document.documentElement.style.setProperty('--border-strong', preset.borderStrong || 'rgba(148, 163, 184, 0.35)');
  document.documentElement.style.setProperty('--border-dashed', preset.borderDashed || 'rgba(148, 163, 184, 0.4)');
  document.body.setAttribute('data-theme-ready', 'true');
  document.documentElement.setAttribute('data-theme', merged.name);
  if (options.persistState !== false) {
    state.theme = { ...merged };
  }
}

function syncThemeControls(source = state.theme) {
  if (elements.themeAccentInput && source?.customAccent) {
    elements.themeAccentInput.value = source.customAccent;
  }
  if (elements.themeSurfaceRange) {
    elements.themeSurfaceRange.value = (source.surfaceAlpha ?? DEFAULT_THEME.surfaceAlpha).toFixed(2);
  }
  themePresetRadios.forEach((radio) => {
    radio.checked = radio.value === (source.name || DEFAULT_THEME.name);
  });
}

function openThemePanel() {
  if (!elements.themePanel) {
    return;
  }
  themeDraft = { ...state.theme };
  syncThemeControls(themeDraft);
  elements.themePanel.hidden = false;
  elements.themeToggle?.setAttribute('aria-expanded', 'true');
  themePanelOpen = true;
  themePanelDirty = false;
}

function closeThemePanel(saveChanges = false) {
  if (!elements.themePanel) {
    return;
  }
  elements.themePanel.hidden = true;
  elements.themeToggle?.setAttribute('aria-expanded', 'false');
  if (!saveChanges && themePanelDirty) {
    applyTheme(state.theme);
  }
  themePanelOpen = false;
  themePanelDirty = false;
}

function toggleThemePanel(force) {
  if (force === true || !themePanelOpen) {
    openThemePanel();
  } else {
    closeThemePanel();
  }
}

function handleThemePresetChange(event) {
  if (!event.target?.checked) {
    return;
  }
  themeDraft.name = event.target.value;
  const preset = THEME_PRESETS[themeDraft.name] || THEME_PRESETS.midnight;
  themeDraft.customAccent = preset.accent;
  themeDraft.surfaceAlpha = preset.surfaceAlpha ?? themeDraft.surfaceAlpha;
  themePanelDirty = true;
  applyTheme(themeDraft, { persistState: false });
  syncThemeControls(themeDraft);
}

function handleThemeAccentChange(event) {
  if (!event.target?.value) {
    return;
  }
  themeDraft.customAccent = event.target.value;
  themePanelDirty = true;
  applyTheme(themeDraft, { persistState: false });
}

function handleThemeSurfaceChange(event) {
  const value = Number(event.target?.value);
  if (!Number.isFinite(value)) {
    return;
  }
  themeDraft.surfaceAlpha = value;
  themePanelDirty = true;
  applyTheme(themeDraft, { persistState: false });
}

function handleThemeSave() {
  themePanelDirty = false;
  applyTheme(themeDraft);
  window.api.setTheme(state.theme).catch(() => {});
  closeThemePanel(true);
}

applyTheme(state.theme);

const elements = {
  hardwareFileLabel: document.getElementById('hardwareFileLabel'),
  selectedReportsList: document.getElementById('selectedReportsList'),
  loadHardwareButton: document.getElementById('loadHardwareButton'),
  loadReportsButton: document.getElementById('loadReportsButton'),
  analyzeButton: document.getElementById('analyzeButton'),
  exportPdfButton: document.getElementById('exportPdfButton'),
  analysisStatus: document.getElementById('analysisStatus'),
  hardwareLines: document.getElementById('hardwareLines'),
  systemSummary: document.getElementById('systemSummary'),
  osSummary: document.getElementById('osSummary'),
  cpuSummary: document.getElementById('cpuSummary'),
  memorySummary: document.getElementById('memorySummary'),
  summaryContent: document.getElementById('summaryContent'),
  comparisonContent: document.getElementById('comparisonContent'),
  chartCategories: document.getElementById('chartCategories'),
  chartMessage: document.getElementById('chartMessage'),
  chartCanvas: document.getElementById('categoryChart'),
  chartMetricFilterRow: document.getElementById('chartMetricFilters'),
  chartReportFilterRow: document.getElementById('chartReportFilters'),
  tjmaxInput: document.getElementById('tjmaxInput'),
  themeToggle: document.getElementById('themeToggleButton'),
  themePanel: document.getElementById('themePanel'),
  themePanelClose: document.getElementById('themePanelClose'),
  themeAccentInput: document.getElementById('themeAccentInput'),
  themeSurfaceRange: document.getElementById('themeSurfaceRange'),
  themeApplyButton: document.getElementById('themeApplyButton')
};

const tabButtons = document.querySelectorAll('.tab-button');
const tabPanels = document.querySelectorAll('[data-tab-panel]');
const themePresetRadios = document.querySelectorAll('input[name="themePreset"]');
let themeDraft = { ...state.theme };
let themePanelOpen = false;
let themePanelDirty = false;

applyTheme(state.theme, { persistState: false });
syncThemeControls(state.theme);

const chartCtx = elements.chartCanvas.getContext('2d');
state.chartInstance = new Chart(chartCtx, {
  type: 'line',
  data: {
    labels: [],
    datasets: []
  },
  options: {
    spanGaps: true,
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false
    },
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          font: {
            size: CHART_LABEL_FONT_SIZE
          }
        }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: (context) => {
            const dataset = context.dataset || {};
            const label = dataset.metricLabel || dataset.label;
            const reportName = dataset.reportName ? ` (${dataset.reportName})` : '';
            const value = context.raw ?? context.formattedValue;
            return `${label}${reportName}: ${value ?? '--'}`;
          }
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Amostras',
          font: {
            size: CHART_LABEL_FONT_SIZE
          }
        },
        grid: {
          display: false
        },
        ticks: {
          callback: (value) => String(value),
          font: {
            size: CHART_LABEL_FONT_SIZE
          }
        }
      },
      y: {
        beginAtZero: false,
        title: {
          display: true,
          text: '',
          font: {
            size: CHART_LABEL_FONT_SIZE
          }
        },
        ticks: {
          callback: (value) => String(value),
          font: {
            size: CHART_LABEL_FONT_SIZE
          }
        }
      }
    }
  }
});

function setStatus(message, variant = 'neutral') {
  elements.analysisStatus.textContent = message;
  elements.analysisStatus.className = `status status-${variant}`;
}

function getDatasetReportKey(dataset) {
  return dataset.reportName || dataset.label || 'Série';
}

function toggleReportFilter(reportName) {
  if (!reportName) {
    return;
  }
  if (state.hiddenReports.has(reportName)) {
    state.hiddenReports.delete(reportName);
  } else {
    state.hiddenReports.add(reportName);
  }
  if (state.currentCategory) {
    updateChart(state.currentCategory);
  }
  persistFilterSettings();
}

function toggleMetricFilter(metricKey) {
  if (!metricKey) {
    return;
  }
  if (state.hiddenMetrics.has(metricKey)) {
    state.hiddenMetrics.delete(metricKey);
  } else {
    state.hiddenMetrics.add(metricKey);
  }
  if (state.currentCategory) {
    updateChart(state.currentCategory);
  }
  persistFilterSettings();
}

function renderFilterButtons(rowElement, items, hiddenSet, toggleFn) {
  if (!rowElement) {
    return;
  }
  rowElement.innerHTML = '';
  if (!items.length) {
    return;
  }
  const seen = new Set();
  items.forEach((item) => {
    if (!item) {
      return;
    }
    const entry =
      typeof item === 'object'
        ? {
            key: item.key || item.label || '',
            label: item.label || item.key || ''
          }
        : { key: item, label: item };
    if (!entry.key || seen.has(entry.key)) {
      return;
    }
    seen.add(entry.key);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chart-filter-button';
    const hidden = hiddenSet.has(entry.key);
    button.classList.toggle('active', !hidden);
    button.textContent = entry.label;
    button.addEventListener('click', () => toggleFn(entry.key, entry.label));
    rowElement.appendChild(button);
  });
}

function persistFilterSettings() {
  window.api.setFilterState({
    reports: Array.from(state.hiddenReports),
    metrics: Array.from(state.hiddenMetrics)
  }).catch(() => {});
}

function getMetricFilterKey(label, category) {
  if (!label) {
    return '';
  }
  return category ? `${category}::${label}` : label;
}

function renderReportFilters(chartData) {
  const labels = (chartData?.datasets ?? []).map((dataset) => getDatasetReportKey(dataset));
  renderFilterButtons(elements.chartReportFilterRow, labels, state.hiddenReports, toggleReportFilter);
}

function renderMetricFilters(chartData, category) {
  const items = (chartData?.datasets ?? []).map((dataset) => {
    const label = dataset.metricLabel || dataset.label || 'Métrica';
    return {
      key: getMetricFilterKey(label, category),
      label
    };
  });
  renderFilterButtons(elements.chartMetricFilterRow, items, state.hiddenMetrics, toggleMetricFilter);
}

function clearFilterRows() {
  [elements.chartMetricFilterRow, elements.chartReportFilterRow].forEach((row) => {
    if (row) {
      row.innerHTML = '';
    }
  });
}

function applyDatasetFilters(dataset, category) {
  const reportKey = getDatasetReportKey(dataset);
  const metricLabel = dataset.metricLabel || dataset.label || '';
  const metricKey = getMetricFilterKey(metricLabel, category);
  if (state.hiddenReports.has(reportKey)) {
    return false;
  }
  if (metricKey && state.hiddenMetrics.has(metricKey)) {
    return false;
  }
  return true;
}

function getFilteredDatasets(chartData, category) {
  return (chartData?.datasets ?? []).filter((dataset) => applyDatasetFilters(dataset, category));
}

function buildExportChartOptions(chartData) {
  const fontSize = CHART_LABEL_FONT_SIZE;
  const base = {
    spanGaps: true,
    responsive: false,
    maintainAspectRatio: false,
    animation: false,
    interaction: {
      mode: 'index',
      intersect: false
    },
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          font: {
            size: fontSize
          }
        }
      },
      tooltip: {
        mode: 'index',
        intersect: false
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Amostras',
          font: {
            size: fontSize
          }
        },
        grid: {
          display: false
        },
        ticks: {
          callback: (value) => String(value),
          font: {
            size: fontSize
          }
        }
      },
      y: {
        beginAtZero: false,
        ticks: {
          callback: (value) => String(value),
          font: {
            size: fontSize
          }
        },
        title: {
          display: true,
          text: '',
          font: {
            size: fontSize
          }
        }
      }
    }
  };
  if (chartData?.percMode) {
    base.scales.y.min = 0;
    base.scales.y.max = 100;
    base.scales.y.beginAtZero = true;
  } else {
    delete base.scales.y.min;
    delete base.scales.y.max;
    base.scales.y.beginAtZero = false;
  }
  base.scales.y.ticks.callback = (value) =>
    chartData?.percMode ? `${value}%` : `${value}`;
  return base;
}

function collectChartImages() {
  if (!state.result?.chartCategories?.length) {
    return [];
  }
  const images = [];
  state.result.chartCategories.forEach((category) => {
    const chartData = state.result.charts?.[category.name];
    if (!chartData) {
      return;
    }
    let filteredDatasets = getFilteredDatasets(chartData, category.name).map((dataset) => ({
      ...dataset,
      borderWidth: 2,
      pointRadius: 3,
      pointHoverRadius: 4,
      tension: dataset.tension ?? 0.2,
      spanGaps: dataset.spanGaps ?? true
    }));
    if (!filteredDatasets.length) {
      return;
    }
    const percDatasets =
      filteredDatasets.length &&
      filteredDatasets.every((dataset) => (dataset.unit || '').includes('%'));
    const exportData = { ...chartData, percMode: percDatasets || chartData.percMode };
    const canvas = document.createElement('canvas');
    canvas.width = 1100;
    canvas.height = 360;
    canvas.style.position = 'absolute';
    canvas.style.left = '-99999px';
    canvas.style.top = '0';
    canvas.style.pointerEvents = 'none';
    canvas.style.opacity = '0';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      canvas.remove();
      return;
    }
    let chart;
    try {
      chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: chartData.labels,
          datasets: filteredDatasets
        },
        options: buildExportChartOptions(exportData)
      });
      chart.update();
      const dataUrl = (chart.toBase64Image() || '').replace(/\s+/g, '');
      if (!dataUrl.startsWith('data:image')) {
        return;
      }
      images.push({
        category: category.name,
        image: dataUrl
      });
    } finally {
      if (chart) {
        chart.destroy();
      }
      canvas.remove();
    }
  });
  return images;
}

async function handleExport() {
  if (!state.result) {
    setStatus('Execute uma análise antes de exportar o PDF.', 'error');
    return;
  }
  const chartImages = collectChartImages();
  if (!chartImages.length) {
    setStatus('Nenhum gráfico visível com os filtros atuais.', 'error');
    return;
  }
  const payload = {
    reports: (state.result?.reports ?? []).map((report) => ({
      name: report.name,
      summaryLines: report.summaryLines
    })),
    comparison: state.result.comparison ?? { headers: [], groups: [] },
    filters: {
      hiddenReports: Array.from(state.hiddenReports),
      hiddenMetrics: Array.from(state.hiddenMetrics)
    },
    chartImages
  };

  setStatus('Gerando PDF com filtros aplicados...', 'neutral');
  elements.exportPdfButton.disabled = true;
  try {
    const response = await window.api.exportPdf(payload);
    if (response?.filePath) {
      setStatus(`PDF salvo em ${response.filePath}`, 'success');
    } else {
      setStatus('Exportação cancelada.', 'neutral');
    }
  } catch (error) {
    setStatus(error?.message ?? 'Erro ao exportar PDF.', 'error');
  } finally {
    elements.exportPdfButton.disabled = false;
  }
}

function normalizePathLabel(fullPath) {
  if (!fullPath) return '';
  const normalized = fullPath.replace(/^.*[\\/]/, '');
  return normalized || fullPath;
}

function updateSelectedReportsDisplay() {
  const list = elements.selectedReportsList;
  list.innerHTML = '';
  if (!state.selectedReports.length) {
    list.textContent = 'Nenhum relatório selecionado.';
    return;
  }
  state.selectedReports.forEach((filePath) => {
    const chip = document.createElement('span');
    chip.className = 'file-chip';
    chip.textContent = normalizePathLabel(filePath);
    list.appendChild(chip);
  });
}

function setHardwareLabel(pathValue) {
  if (!pathValue) {
    elements.hardwareFileLabel.textContent = 'Nenhum arquivo selecionado.';
    return;
  }
  elements.hardwareFileLabel.textContent = normalizePathLabel(pathValue);
}

function createHardwareCard(title, rows) {
  const card = document.createElement('article');
  card.className = 'hardware-card';
  const heading = document.createElement('h3');
  heading.textContent = title;
  const list = document.createElement('ul');
  rows.forEach((row) => {
    const item = document.createElement('li');
    const label = document.createElement('strong');
    label.textContent = row.label;
    const value = document.createElement('span');
    value.textContent = row.value;
    item.appendChild(label);
    item.appendChild(value);
    list.appendChild(item);
  });
  card.appendChild(heading);
  card.appendChild(list);
  return card;
}

function buildMemoryModuleRows(modules = []) {
  if (!Array.isArray(modules) || !modules.length) {
    return [{ label: 'Módulos', value: 'Nenhum dado' }];
  }
  return modules.map((module, index) => {
    if (typeof module === 'string') {
      return {
        label: module || `Módulo ${index + 1}`,
        value: module
      };
    }
    const label = module.slot || module.label || `Módulo ${index + 1}`;
    const size = Number.isFinite(module.sizeGB)
      ? `${module.sizeGB.toFixed(1)} GB`
      : module.sizeLabel || null;
    const model = module.model && module.model !== label ? module.model : null;
    const parts = [model, module.manufacturer, module.type, module.speed, size].filter(Boolean);
    return {
      label,
      value: parts.length ? parts.join(' · ') : size || '—'
    };
  });
}

function buildGpuRows(gpus = []) {
  if (!Array.isArray(gpus) || !gpus.length) {
    return [{ label: 'GPU', value: 'Nenhum dado' }];
  }
  return gpus.map((gpu, index) => {
    const label = gpu.name || gpu.chipset || `GPU ${index + 1}`;
    const driverParts = [];
    if (gpu.driverVersion) {
      driverParts.push(`Driver ${gpu.driverVersion}`);
    }
    if (gpu.driverDate) {
      driverParts.push(gpu.driverDate);
    }
    if (gpu.driverVendor) {
      driverParts.push(gpu.driverVendor);
    }
    const specParts = [
      gpu.memory,
      gpu.type,
      gpu.bus,
      gpu.coreClock,
      gpu.memoryClock,
      driverParts.length ? driverParts.join(' / ') : null
    ].filter(Boolean);
    return {
      label,
      value: specParts.length ? specParts.join(' · ') : '—'
    };
  });
}

function renderHardwareSection(hardware = { lines: [], profile: null }) {
  const cardsContainer = document.getElementById('hardwareCards');
  if (!cardsContainer) {
    return;
  }
  cardsContainer.innerHTML = '';
  const profile = hardware?.profile;
  if (!profile) {
    const placeholder = document.createElement('p');
    placeholder.className = 'placeholder';
    placeholder.textContent = 'Nenhum perfil de hardware carregado.';
    cardsContainer.appendChild(placeholder);
  } else {
    const cardDefinitions = [
      {
        title: 'Sistema operacional',
        rows: [
          { label: 'Marca', value: profile.system?.brand || '—' },
          { label: 'Nome', value: profile.system?.name || '—' },
          { label: 'SO', value: profile.os?.name || '—' },
          { label: 'UEFI', value: profile.os?.uefi || '—' },
          { label: 'Secure Boot', value: profile.os?.secureBoot || '—' }
        ]
      },
      {
        title: 'Processador',
        rows: [
          { label: 'Nome', value: profile.cpu?.name || '—' },
          {
            label: 'Cores / Threads',
            value:
              profile.cpu?.cores != null || profile.cpu?.threads != null
                ? `${profile.cpu?.cores ?? '--'} / ${profile.cpu?.threads ?? '--'}`
                : '—'
          },
          { label: 'Base clock', value: profile.cpu?.baseClock || '—' }
        ]
      },
      {
        title: 'Memória',
        rows: [
          {
            label: 'Total',
            value: profile.memory?.totalGB ? `${profile.memory?.totalGB.toFixed(1)} GB` : '—'
          },
          {
            label: 'Frequência',
            value: profile.memory?.freqMHz ? `${profile.memory?.freqMHz.toFixed(0)} MHz` : '—'
          },
          ...buildMemoryModuleRows(profile.memory?.modules)
        ]
      },
      {
        title: 'Discos rígidos',
        rows: profile.drives.length
          ? profile.drives.map((drive, index) => ({
              label: drive.model || `Drive ${index + 1}`,
              value: drive.capacityGB ? `${drive.capacityGB.toFixed(0)} GB` : '—'
            }))
          : [{ label: 'Discos', value: 'Nenhum dado' }]
      },
      {
        title: 'GPU',
        rows: buildGpuRows(profile.gpus)
      }
    ];
    cardDefinitions.forEach((definition) => {
      const card = createHardwareCard(definition.title, definition.rows);
      cardsContainer.appendChild(card);
    });
  }
  elements.hardwareLines.textContent = hardware.lines?.length
    ? hardware.lines.join('\n')
    : 'Nenhum perfil carregado. Use o botão acima para adicionar o CSV exportado do HWiNFO.';
}

function renderSummary(reports = []) {
  const container = elements.summaryContent;
  container.innerHTML = '';
  if (!reports.length) {
    const placeholder = document.createElement('p');
    placeholder.className = 'placeholder';
    placeholder.textContent = 'Execute uma análise para ver os resumos individuais dos relatórios.';
    container.appendChild(placeholder);
    return;
  }
  reports.forEach((report) => {
    const card = document.createElement('article');
    card.className = 'summary-card';
    const title = document.createElement('h4');
    title.textContent = report.name;
    const body = document.createElement('pre');
    body.textContent = report.summaryLines.join('\n');
    card.appendChild(title);
    card.appendChild(body);
    container.appendChild(card);
  });
}

function renderComparison(comparison = { headers: [], groups: [] }) {
  const container = elements.comparisonContent;
  container.innerHTML = '';
  if (!comparison.groups.length) {
    const placeholder = document.createElement('p');
    placeholder.className = 'placeholder';
    placeholder.textContent = 'Os resultados comparativos aparecerão aqui após a análise.';
    container.appendChild(placeholder);
    return;
  }
  comparison.groups.forEach((group) => {
    const section = document.createElement('section');
    section.className = 'comparison-group';
    const title = document.createElement('h3');
    title.textContent = group.title;
    section.appendChild(title);

    const table = document.createElement('table');
    table.className = 'comparison-table';
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    comparison.headers.forEach((header) => {
      const th = document.createElement('th');
      th.textContent = header;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    group.rows.forEach((row) => {
      const rowEl = document.createElement('tr');
      const labelCell = document.createElement('td');
      labelCell.textContent = row.label;
      rowEl.appendChild(labelCell);
      row.formattedValues.forEach((value, index) => {
        const cell = document.createElement('td');
        cell.textContent = value;
        if (row.bestIndex === index) {
          cell.classList.add('best-value');
        }
        if (row.critical?.[index]) {
          cell.classList.add('critical-value');
        }
        rowEl.appendChild(cell);
      });
      tbody.appendChild(rowEl);
    });
    table.appendChild(tbody);
    section.appendChild(table);
    container.appendChild(section);
  });
}

function renderChartCategories(chartCategories = [], chartData = {}) {
  const container = elements.chartCategories;
  container.innerHTML = '';
  if (!chartCategories.length) {
    const placeholder = document.createElement('span');
    placeholder.className = 'placeholder';
    placeholder.textContent = 'A análise dos relatórios carrega os gráficos.';
    container.appendChild(placeholder);
    return;
  }

  chartCategories.forEach((category) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chart-category-button';
    button.dataset.category = category.name;
    button.textContent = category.name;
    if (!chartData[category.name]) {
      button.disabled = true;
      button.title = 'Sem dados para esta categoria';
    }
    button.addEventListener('click', () => setActiveChartCategory(category.name));
    container.appendChild(button);
  });
}

function updateChart(categoryName) {
  const activeCategory = categoryName || state.currentCategory || '';
  if (categoryName && categoryName !== state.currentCategory) {
    state.currentCategory = categoryName;
  }
  const chartData = activeCategory ? state.result?.charts?.[activeCategory] : null;
  const chartInstance = state.chartInstance;
  if (!chartInstance) return;

  if (!chartData) {
    chartInstance.data.labels = [];
    chartInstance.data.datasets = [];
    chartInstance.update();
    elements.chartMessage.textContent =
      'Não há séries disponíveis para esta categoria.';
    elements.chartMessage.style.opacity = '1';
    clearFilterRows();
    state.chartPercMode = false;
    return;
  }

  const filteredDatasets = getFilteredDatasets(chartData, activeCategory);
  if (!filteredDatasets.length) {
    chartInstance.data.labels = chartData.labels;
    chartInstance.data.datasets = [];
    chartInstance.update();
    elements.chartMessage.textContent = 'Nenhum conjunto visível nas configurações atuais.';
    elements.chartMessage.style.opacity = '1';
    renderMetricFilters(chartData, activeCategory);
    renderReportFilters(chartData);
    return;
  }

  elements.chartMessage.style.opacity = '0';
  chartInstance.data.labels = chartData.labels;
  const percDatasets =
    filteredDatasets.length &&
    filteredDatasets.every((dataset) => (dataset.unit || '').includes('%'));
  const usePercScale = percDatasets || !!chartData.percMode;
  state.chartPercMode = usePercScale;
  chartInstance.data.datasets = filteredDatasets.map((dataset) => ({
    ...dataset,
    borderWidth: 2,
    pointRadius: 3,
    pointHoverRadius: 4,
    tension: dataset.tension ?? 0.2,
    spanGaps: dataset.spanGaps ?? true
  }));
  chartInstance.options.scales.y.title.text = chartData.yAxisTitle || '';
  if (usePercScale) {
    chartInstance.options.scales.y.min = 0;
    chartInstance.options.scales.y.max = 100;
    chartInstance.options.scales.y.beginAtZero = true;
  } else {
    delete chartInstance.options.scales.y.min;
    delete chartInstance.options.scales.y.max;
    chartInstance.options.scales.y.beginAtZero = false;
  }
  chartInstance.options.scales.y.ticks.callback = (value) =>
    usePercScale ? `${value}%` : `${value}`;
  chartInstance.update();
  renderMetricFilters(chartData, activeCategory);
  renderReportFilters(chartData);
}

function setActiveChartCategory(name) {
  if (!name) return;
  state.currentCategory = name;
  const buttons = elements.chartCategories.querySelectorAll('.chart-category-button');
  buttons.forEach((button) => {
    button.classList.toggle('active', button.dataset.category === name);
  });
  updateChart(name);
}

function setActiveTab(targetId) {
  tabButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.tabTarget === targetId);
  });
  tabPanels.forEach((panel) => {
    panel.classList.toggle('active', panel.id === targetId);
  });
}

async function handleAnalysis() {
  if (!state.selectedReports.length) {
    setStatus('Selecione pelo menos um relatório antes de analisar.', 'error');
    return;
  }
  elements.analyzeButton.disabled = true;
  elements.exportPdfButton.disabled = true;
  setStatus('Analisando os relatórios...', 'neutral');
  try {
    const payload = await window.api.runAnalysis({
      reports: state.selectedReports,
      hardwarePath: state.hardwarePath,
      tjmax: Number(elements.tjmaxInput.value) || 100
    });
    state.result = payload;
    setStatus('Análise concluída.', 'success');
    elements.exportPdfButton.disabled = false;
    renderHardwareSection(payload.hardware);
    renderSummary(payload.reports);
    renderComparison(payload.comparison);
    renderChartCategories(payload.chartCategories, payload.charts);
    const firstAvailable = payload.chartCategories.find((category) => payload.charts?.[category.name]);
    if (firstAvailable) {
      setActiveChartCategory(firstAvailable.name);
    } else {
      updateChart('');
    }
  } catch (error) {
    setStatus(error?.message ?? 'Erro durante a análise.', 'error');
  } finally {
    elements.analyzeButton.disabled = false;
  }
}

elements.loadReportsButton.addEventListener('click', async () => {
  const selected = await window.api.selectReportFiles();
  if (Array.isArray(selected) && selected.length) {
    state.selectedReports = selected;
    updateSelectedReportsDisplay();
  }
});

elements.loadHardwareButton.addEventListener('click', async () => {
  const selected = await window.api.selectHardwareFile();
  if (selected) {
    state.hardwarePath = selected;
    setHardwareLabel(selected);
    window.api.setHardwarePath(selected);
  }
});

elements.analyzeButton.addEventListener('click', handleAnalysis);
elements.exportPdfButton?.addEventListener('click', handleExport);
elements.themeToggle?.addEventListener('click', () => toggleThemePanel());
elements.themePanelClose?.addEventListener('click', () => closeThemePanel());
elements.themeApplyButton?.addEventListener('click', handleThemeSave);
elements.themeAccentInput?.addEventListener('input', handleThemeAccentChange);
elements.themeSurfaceRange?.addEventListener('input', handleThemeSurfaceChange);
themePresetRadios.forEach((radio) => radio.addEventListener('change', handleThemePresetChange));

document.addEventListener('click', (event) => {
  if (!themePanelOpen || !elements.themePanel) {
    return;
  }
  const target = event.target;
  if (
    target === elements.themePanel ||
    elements.themePanel.contains(target) ||
    elements.themeToggle?.contains(target)
  ) {
    return;
  }
  closeThemePanel();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && themePanelOpen) {
    closeThemePanel();
  }
});

tabButtons.forEach((button) => {
  button.addEventListener('click', () => setActiveTab(button.dataset.tabTarget));
});

updateSelectedReportsDisplay();
renderSummary();
renderComparison();
renderHardwareSection([]);

window.api.getSettings().then((settings) => {
  if (settings?.hardwarePath) {
    state.hardwarePath = settings.hardwarePath;
    setHardwareLabel(settings.hardwarePath);
  }
  if (settings?.hiddenReports) {
    state.hiddenReports = new Set(settings.hiddenReports);
  }
  if (settings?.hiddenMetrics) {
    state.hiddenMetrics = new Set(settings.hiddenMetrics);
  }
  if (settings?.theme) {
    const mergedTheme = { ...DEFAULT_THEME, ...settings.theme };
    themeDraft = { ...mergedTheme };
    applyTheme(mergedTheme);
  } else {
    themeDraft = { ...state.theme };
    applyTheme(state.theme);
  }
  syncThemeControls(themeDraft);
});
