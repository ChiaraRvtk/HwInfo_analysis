const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const reportProcessor = require('./reportProcessor');
const APP_ROOT = path.join(__dirname, '..');
const CONFIG_PATH = path.join(APP_ROOT, 'hwi_electron_config.json');
const DEFAULT_SETTINGS = {
  hardwarePath: null,
  hiddenReports: [],
  hiddenMetrics: [],
  theme: {
    name: 'midnight',
    customAccent: '#60a5fa',
    surfaceAlpha: 0.85
  }
};
let appSettings = loadSettings();

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.webContents.openDevTools({ mode: 'detach' });
}

function loadSettings() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        theme: { ...DEFAULT_SETTINGS.theme, ...(parsed.theme || {}) }
      };
    }
  } catch (err) {
    console.warn('Falha ao ler o arquivo de configuração:', err);
  }
  return { ...DEFAULT_SETTINGS, theme: { ...DEFAULT_SETTINGS.theme } };
}

function saveSettings() {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(appSettings, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Falha ao gravar configurações:', err);
  }
}

function escapeHtml(text = '') {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildComparisonHtml(comparison) {
  if (!comparison?.groups?.length) {
    return '<p>Nenhum dado comparativo disponível.</p>';
  }
  return comparison.groups
    .map((group) => {
      const headerRow = comparison.headers
        .map((header) => `<th>${escapeHtml(header)}</th>`)
        .join('');
      const bodyRows = group.rows
        .map(
          (row) => `
            <tr>
              <td>${escapeHtml(row.label)}</td>
              ${row.formattedValues
                .map((value) => `<td>${escapeHtml(value)}</td>`)
                .join('')}
            </tr>
          `
        )
        .join('');
      return `
        <section class="comparison-group">
          <h3>${escapeHtml(group.title)}</h3>
          <table>
            <thead>
              <tr>${headerRow}</tr>
            </thead>
            <tbody>
              ${bodyRows}
            </tbody>
          </table>
        </section>
      `;
    })
    .join('');
}

function buildFiltersHtml() {
  return '';
}

function buildChartSections(charts = []) {
  if (!charts.length) {
    return '<p class="chart-empty">Nenhum gráfico disponível.</p>';
  }
  const cards = charts
    .map((chart, index) => {
      const safeSrc = chart.image ? chart.image.replace(/"/g, '&quot;') : '';
      return `
        <section class="chart-section">
          <h3>${escapeHtml(chart.category || `Gráfico ${index + 1}`)}</h3>
          <img src="${safeSrc}" alt="Gráfico ${escapeHtml(chart.category || `#${index + 1}`)}" class="chart-image" />
        </section>
      `;
    })
    .join('');
  return `<div class="chart-grid">${cards}</div>`;
}

function buildSummaryHtml(reports = []) {
  if (!reports?.length) {
    return '';
  }
  const cards = reports
    .map((report, index) => {
      const name = escapeHtml(report?.name || `Relatório ${index + 1}`);
      const periodLine =
        Array.isArray(report?.summaryLines) &&
        report.summaryLines.find((line) => line.startsWith('Período:'));
      const content = periodLine ? escapeHtml(periodLine) : 'Período: --';
      return `<p><strong>${name}:</strong> ${content}</p>`;
    })
    .join('');
  return `
    <section class="summary-section">
      <h2>Período dos relatórios</h2>
      ${cards}
    </section>
  `;
}

function buildPdfHtml(payload) {
  const summaryHtml = buildSummaryHtml(payload.reports);
  const comparisonHtml = buildComparisonHtml(payload.comparison);
  const filtersHtml = buildFiltersHtml(payload.filters);
  const chartHtml = buildChartSections(payload.chartImages ?? []);
  const chartSection = `
        <section class="charts-wrapper">
          <h2>Gráficos aplicados</h2>
          ${chartHtml}
        </section>`;
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>HWI Compare PDF</title>
        <style>
          body {
            font-family: 'Segoe UI', system-ui, sans-serif;
            margin: 24px;
            color: #111;
          }
          h1 {
            margin-top: 0;
            font-size: 26px;
          }
          h2 {
            margin-bottom: 0.25rem;
            font-size: 18px;
          }
          h3 {
            margin-bottom: 0.1rem;
            font-size: 16px;
          }
          pre {
            background: #f4f6fb;
            padding: 0.65rem;
            border-radius: 0.5rem;
            white-space: pre-wrap;
            font-size: 12px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 1rem;
          }
          th,
          td {
            border: 1px solid #d2d6e0;
            padding: 0.45rem 0.6rem;
            font-size: 12px;
          }
          th {
            background: #eef2ff;
            text-align: left;
          }
          .charts-wrapper {
            page-break-before: always;
          }
          .chart-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
            margin-top: 0.5rem;
          }
          .chart-section {
            flex: 1 1 calc(50% - 16px);
            min-width: 320px;
            max-width: calc(50% - 16px);
            border: 1px solid #d2d6e0;
            border-radius: 4px;
            padding: 0.4rem;
            background: #fff;
            page-break-inside: avoid;
            box-sizing: border-box;
          }
          .chart-section h3 {
            margin: 0 0 0.35rem;
            font-size: 13px;
          }
          .chart-image {
            width: 100%;
            border: 1px solid #cbd5f5;
            max-height: 260px;
            object-fit: contain;
          }
          .chart-empty {
            margin: 0;
          }
          .summary-section {
            margin-bottom: 1rem;
          }
          .summary-card {
            margin-bottom: 0.75rem;
            page-break-inside: avoid;
          }
          .summary-card pre {
            margin-top: 0.25rem;
          }
          .filter-section {
            margin-top: 1rem;
            padding-top: 0.5rem;
            border-top: 1px solid #d2d6e0;
          }
          .comparison-group {
            margin-bottom: 1rem;
          }
        </style>
      </head>
      <body>
        <h1>HWI Compare - Exportação</h1>
        ${summaryHtml}
        <h2>Comparação lado a lado</h2>
        ${comparisonHtml}
        ${filtersHtml}
${chartSection}
      </body>
    </html>
  `;
}

function openReportFiles() {
  return dialog
    .showOpenDialog({
      title: 'Selecione relatórios CSV exportados do HWiNFO',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'CSV', extensions: ['csv'] },
        { name: 'Todos os arquivos', extensions: ['*'] }
      ]
    })
    .then((result) => (result.canceled ? [] : result.filePaths));
}

function openHardwareFile() {
  return dialog
    .showOpenDialog({
      title: 'Selecione o XML exportado com os componentes (HWiNFO)',
      properties: ['openFile'],
      filters: [
        { name: 'XML', extensions: ['xml'] },
        { name: 'Todos os arquivos', extensions: ['*'] }
      ]
    })
    .then((result) => (result.canceled || !result.filePaths.length ? null : result.filePaths[0]));
}

ipcMain.handle('dialog:select-report-files', openReportFiles);
ipcMain.handle('dialog:select-hardware-file', openHardwareFile);
ipcMain.handle('analysis:run', async (_, payload) => {
  const reports = payload?.reports ?? [];
  const tjmax = Number(payload?.tjmax) || 100;
  const hardwarePath = payload?.hardwarePath;
  if (!reports.length) {
    throw new Error('Selecione pelo menos um relatório antes de analisar.');
  }
  return reportProcessor.analyzeReports(reports, { tjmax, hardwarePath });
});
ipcMain.handle('settings:get', () => appSettings);
ipcMain.handle('settings:set-hardware', (_, hardwarePath) => {
  appSettings.hardwarePath = hardwarePath;
  saveSettings();
  return appSettings;
});
ipcMain.handle('settings:set-filters', (_, filters) => {
  appSettings.hiddenReports = filters?.reports ?? [];
  appSettings.hiddenMetrics = filters?.metrics ?? [];
  saveSettings();
  return appSettings;
});
ipcMain.handle('settings:set-theme', (_, theme) => {
  appSettings.theme = {
    ...DEFAULT_SETTINGS.theme,
    ...(appSettings.theme || {}),
    ...(theme || {})
  };
  saveSettings();
  return appSettings.theme;
});
ipcMain.handle('export:pdf', async (_, payload) => {
  const parentWin = BrowserWindow.getFocusedWindow();
  const { canceled, filePath } = await dialog.showSaveDialog(parentWin, {
    title: 'Salvar relatório em PDF',
    defaultPath: path.join(app.getPath('documents'), 'hwi_compare_export.pdf'),
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  if (canceled || !filePath) {
    return { canceled: true };
  }
  const content = buildPdfHtml(payload);
  const pdfWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      offscreen: true
    }
  });
  await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(content)}`);
  const pdfData = await pdfWindow.webContents.printToPDF({
    printBackground: true,
    landscape: true,
    pageSize: 'A4'
  });
  pdfWindow.destroy();
  fs.writeFileSync(filePath, pdfData);
  return { filePath };
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
