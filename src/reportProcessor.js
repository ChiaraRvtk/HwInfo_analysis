const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');
const { XMLParser } = require('fast-xml-parser');
const { buildSummaryLines } = require('./summaryData');
const { buildComparison } = require('./comparisonData');
const { CHART_CATEGORIES, createChartDataBuilder } = require('./chartData');

const COLUMN_ALIASES = {
  // CPU
  cpu_power: [
    'Potência total da CPU [W]',
    'CPU Package Power [W]',
    'CPU Total Power [W]'
  ],
  cpu_usage: [
    'Uso total da CPU [%]',
    'Utilização total da CPU [%]',
    'Uso do núcleo (avg) [%]',
    'Utilização do núcleo (avg) [%]'
  ],
  cpu_effective_clock: [
    'Relógios efetivos núcleo (avg) [MHz]',
    'Relógio efetivo médio [MHz]'
  ],
  cpu_temp: ['CPU Inteira [°C]', 'Temperaturas centrais (avg) [°C]', 'CPU Temperature [°C]'],

  //  GPU
  max_cpu_core_temp: ['Núcleo máximo [°C]', 'CPU Inteira [°C]'],
  gpu_clock: ['GPU Clock [MHz]', 'GPU Effective Clock [MHz]'],
  gpu_power: ['GPU Potência [W]', 'GPU Power [W]'],
  gpu_d3d_usage: [
    'Utilização de D3D GPU [%]',
    'Utilizações de D3D GPU (avg) [%]',
    'GPU D3D Uso (avg) [%]',
    'Carga do núcleo da GPU [%]'
  ],
  gpu_memory_usage: ['Uso de memória GPU [%]', 'Carga do controlador de memória GPU [%]'],
  gpu_temp: [
    'Temperatura GPU [°C]',
    'Temperatura de ponto quente da GPU [°C]',
    'Temperatura de junção da memória GPU [°C]',
    'GPU Hotspot Temperature [°C]'
  ],
  gpu_temp_limit : ['Limite térmico da GPU [°C]', 'GPU Temperature Limit [°C]'],
  thermal_headroom: [
    'Distância do núcleo para TjMAX (avg) [°C]',
    'Distância para TjMAX [°C]',
    'Distance to TjMAX (avg) [°C]'
  ],

  //  FPS and Frame Time
  fps_avg: [
    'Taxa de quadros Presented (avg) [FPS]',
    'Taxa de quadros Displayed (avg) [FPS]'
  ],
  fps_1: [
    'Taxa de quadros Presented (1%) [FPS]',
    'Taxa de quadros Presented (1% low) [FPS]',
    'Taxa de quadros Displayed (1%) [FPS]'
  ],
  fps_01: [
    'Taxa de quadros Presented (0.1%) [FPS]',
    'Taxa de quadros Presented (0.1% low) [FPS]',
    'Taxa de quadros Displayed (0.1%) [FPS]'
  ],
  frame_time_series: [
    'Frame Time Presented (avg) [ms]',
    'Frame Time Displayed (avg) [ms]'
  ],
  ram_usage_percent: [
    'Carga da memória física [%]',
    'Memória física utilizada [%]',
    'Uso de memória física [%]'
  ],

  // RAM
  ram_used_mb: ['Memória física utilizada [MB]'],
  ram_available_mb: ['Memória física disponível [MB]'],

  // Disk
  disk_read_rate: ['Taxa de leituras [MB/s]', 'Leitura (MB/s)', 'Leitura de disco [MB/s]'],
  disk_write_rate: ['Taxa de gravações [MB/s]', 'Gravação (MB/s)', 'Gravação de disco [MB/s]'],
  
  system_power: ['Potência total do sistema [W]', 'System Total Power [W]']
};


const METRIC_BOUNDS = {
  cpu_power: { min: 0, max: 400 },
  gpu_power: { min: 0, max: 600 },
  system_power: { min: 0, max: 800 },
  cpu_usage: { min: 0, max: 100 },
  gpu_d3d_usage: { min: 0, max: 100 },
  ram_usage_percent: { min: 0, max: 100 },
  gpu_memory_usage: { min: 0, max: 100 },
  cpu_temp: { min: -20, max: 130 },
  max_cpu_core_temp: { min: -20, max: 130 },
  gpu_temp: { min: -20, max: 130 },
  gpu_temp_limit : { min: -20, max: 130 },
  thermal_headroom: { min: -50, max: 150 },
  ram_used_mb: { min: 0, max: 1048576 },
  ram_available_mb: { min: 0, max: 1048576 }
};

function normalize(text = '') {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9%]+/g, ' ')
    .trim();
}

function clampPercent(value) {
  if (!Number.isFinite(value)) {
    return value;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 100) {
    return 100;
  }
  return value;
}

function decodeHtmlEntities(text = '') {
  if (typeof text !== 'string') {
    return text;
  }
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function parseCapacity(value) {
  if (value == null) {
    return null;
  }
  if (typeof value === 'number') {
    return value;
  }
  const text = decodeHtmlEntities(String(value));
  const gbMatch = text.match(/([\d.,]+)\s*(?:g(?:b|bytes?|ib))/i);
  if (gbMatch) {
    const numeric = parseFloat(gbMatch[1].replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(numeric) ? numeric : null;
  }
  const mbMatch = text.match(/([\d.,]+)\s*(?:m(?:b|bytes?|ib))/i);
  if (mbMatch) {
    const numeric = parseFloat(mbMatch[1].replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(numeric) ? numeric / 1024 : null;
  }
  const numeric = toNumber(text);
  return Number.isFinite(numeric) ? numeric : null;
}

function parseSensorLabel(label = '') {
  if (typeof label !== 'string') {
    return null;
  }
  const trimmed = label.trim();
  if (!trimmed) {
    return null;
  }
  const gpuMatch = trimmed.match(/gpu\s*\[#(\d+)\]\s*:\s*(.+)/i);
  if (gpuMatch) {
    const index = Number(gpuMatch[1]);
    const name = gpuMatch[2].trim();
    const keyBase = Number.isFinite(index) ? `gpu-${index}` : normalize(name) || trimmed;
    return {
      type: 'gpu',
      index: Number.isFinite(index) ? index : null,
      name,
      label: trimmed,
      key: keyBase || `gpu-${trimmed.toLowerCase()}`
    };
  }
  return {
    type: 'other',
    name: trimmed,
    label: trimmed,
    key: normalize(trimmed) || trimmed.toLowerCase()
  };
}

function collectGpuSensors(aliasEntries = {}) {
  const sensors = new Map();
  Object.values(aliasEntries).forEach((entries) => {
    entries.forEach((entry) => {
      const info = entry.sensorInfo;
      if (info?.type === 'gpu') {
        const key = info.key || entry.header;
        if (!sensors.has(key)) {
          sensors.set(key, {
            key,
            index: info.index,
            name: info.name || info.label || null,
            label: info.label || null
          });
        }
      }
    });
  });
  return Array.from(sensors.values()).sort((a, b) => {
    if (a.index != null && b.index != null) {
      return a.index - b.index;
    }
    if (a.index != null) {
      return -1;
    }
    if (b.index != null) {
      return 1;
    }
    const nameA = a.name || a.label || a.key;
    const nameB = b.name || b.label || b.key;
    return nameA.localeCompare(nameB);
  });
}

function buildResolver(headers, columnSensors = {}) {
  const map = {};
  headers.forEach((header) => {
    const key = normalize(header);
    if (!key) {
      return;
    }
    const entry = {
      header,
      normalized: key,
      sensorLabel: columnSensors[header] || null,
      sensorInfo: parseSensorLabel(columnSensors[header])
    };
    if (!map[key]) {
      map[key] = [];
    }
    map[key].push(entry);
  });
  return map;
}

function resolveColumnEntries(resolver, candidates, predicate = () => true) {
  const normalizedCandidates = candidates.map((candidate) => normalize(candidate)).filter(Boolean);
  const seen = new Set();
  const matches = [];

  function addEntries(entries) {
    entries.forEach((entry) => {
      if (!entry || seen.has(entry.header)) {
        return;
      }
      if (predicate(entry)) {
        seen.add(entry.header);
        matches.push(entry);
      }
    });
  }

  normalizedCandidates.forEach((candidate) => {
    const entries = resolver[candidate];
    if (entries) {
      addEntries(entries);
    }
  });

  if (!matches.length) {
    Object.keys(resolver).forEach((key) => {
      if (normalizedCandidates.some((candidate) => candidate && key.includes(candidate))) {
        addEntries(resolver[key]);
      }
    });
  }

  return matches;
}

function resolveColumn(resolver, candidates, predicate) {
  const match = resolveColumnEntries(resolver, candidates, predicate)[0];
  return match ? match.header : null;
}

function isSensorDescriptorRow(row) {
  if (!row || typeof row !== 'object') {
    return false;
  }
  const date = typeof row.Date === 'string' ? row.Date.trim() : row.Date;
  const time = typeof row.Time === 'string' ? row.Time.trim() : row.Time;
  if (date || time) {
    return false;
  }
  const values = Object.values(row)
    .filter((value) => typeof value === 'string' && value.trim())
    .map((value) => value.trim());
  if (!values.length) {
    return false;
  }
  const descriptorCount = values.filter((value) => value.includes(':')).length;
  return descriptorCount >= Math.min(10, Math.ceil(values.length * 0.5));
}

function parseCsv(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = Papa.parse(raw, {
    header: true,
    skipEmptyLines: true
  });
  const headers = parsed.meta?.fields ?? [];
  let sensorRow = null;
  const rows = [];
  parsed.data.forEach((row) => {
    if (sensorRow == null && isSensorDescriptorRow(row)) {
      sensorRow = row;
      return;
    }
    if (row && (row.Date || row.Time)) {
      rows.push(row);
    }
  });
  const columnSensors = {};
  if (sensorRow) {
    headers.forEach((header) => {
      const label = sensorRow[header];
      if (typeof label === 'string' && label.trim()) {
        columnSensors[header] = label.trim();
      }
    });
  }
  return { rows, columnSensors, headers };
}

function toNumber(value) {
  if (value == null) {
    return NaN;
  }
  if (typeof value === 'number') {
    return value;
  }
  let text = String(value).trim();
  text = text.replace(/^,+|,+$/g, '');
  text = text.replace(/,/g, '.');
  text = text.replace(/[^0-9.\-]/g, '');
  if (!text) {
    return NaN;
  }
  const numeric = Number(text);
  return Number.isFinite(numeric) ? numeric : NaN;
}

function computeStats(values) {
  const filtered = values.filter((value) => Number.isFinite(value));
  if (!filtered.length) {
    return null;
  }
  const sum = filtered.reduce((total, value) => total + value, 0);
  return {
    avg: sum / filtered.length,
    min: Math.min(...filtered),
    max: Math.max(...filtered),
    values: filtered
  };
}

function computeBoundedStats(values = [], bounds = {}) {
  const { min = -Infinity, max = Infinity } = bounds;
  const filtered = values.filter(
    (value) => Number.isFinite(value) && value >= min && value <= max
  );
  if (filtered.length) {
    return computeStats(filtered);
  }
  return computeStats(values);
}

function quantile(values, q) {
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] != null) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

function sanitizeValue(alias, value) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return NaN;
    }
    const alpha = trimmed.replace(/[0-9eE+.,\-\s]/g, '');
    if (alpha.length) {
      return NaN;
    }
  }
  const numeric = toNumber(value);
  if (!Number.isFinite(numeric)) {
    return NaN;
  }
  const bounds = METRIC_BOUNDS[alias];
  if (bounds) {
    if (bounds.min != null && numeric < bounds.min) {
      return NaN;
    }
    if (bounds.max != null && numeric > bounds.max) {
      return NaN;
    }
  }
  return numeric;
}

const buildChartData = createChartDataBuilder({ sanitizeValue, clampPercent });

function analyzeReport(filePath, tjmax) {
  const { rows, columnSensors, headers } = parseCsv(filePath);
  const headerList = headers?.length
    ? headers
    : rows.length
      ? Object.keys(rows[0])
      : [];
  const resolver = buildResolver(headerList, columnSensors);
  const resolved = {};
  const aliasEntries = {};
  Object.entries(COLUMN_ALIASES).forEach(([alias, candidates]) => {
    const entries = resolveColumnEntries(resolver, candidates);
    if (entries.length) {
      aliasEntries[alias] = entries;
      resolved[alias] = entries[0].header;
    }
  });
  const gpuSensors = collectGpuSensors(aliasEntries);

  const metrics = {};

  function getSeries(alias, selector) {
    const entries = aliasEntries[alias];
    if (!entries || !entries.length) {
      return [];
    }
    const entry = selector ? entries.find(selector) : entries[0];
    if (!entry) {
      return [];
    }
    return rows.map((row) => sanitizeValue(alias, row[entry.header]));
  }

  function getGpuSeries(alias, gpuKey) {
    return getSeries(
      alias,
      (entry) => entry.sensorInfo?.type === 'gpu' && entry.sensorInfo.key === gpuKey
    );
  }

  const cpuPower = getSeries('cpu_power');
  if (cpuPower.length) {
    const stats = computeBoundedStats(cpuPower, { min: 0, max: 400 });
    metrics.cpu_power_avg = stats.avg;
    metrics.cpu_power_max = stats.max;
  }

  const gpuPower = getSeries('gpu_power');
  if (gpuPower.length) {
    const stats = computeBoundedStats(gpuPower, { min: 0, max: 2000 });
    metrics.gpu_power_avg = stats.avg;
    metrics.gpu_power_max = stats.max;
  }

  const systemPower = getSeries('system_power');
  if (systemPower.length) {
    const stats = computeStats(systemPower);
    metrics.system_power_avg = stats.avg;
    if (
      metrics.gpu_power_avg == null &&
      Number.isFinite(stats.avg) &&
      Number.isFinite(metrics.cpu_power_avg)
    ) {
      const inferred = stats.avg - metrics.cpu_power_avg;
      metrics.gpu_power_avg = inferred > 0 ? inferred : 0;
    }
  }

  const cpuClock = getSeries('cpu_effective_clock');
  if (cpuClock.length) {
    metrics.cpu_effective_clock_avg = computeStats(cpuClock)?.avg;
  }

  const gpuClock = getSeries('gpu_clock');
  if (gpuClock.length) {
    metrics.gpu_clock_avg = computeStats(gpuClock)?.avg;
  }

  const cpuUsage = getSeries('cpu_usage');
  if (cpuUsage.length) {
    const stats = computeBoundedStats(cpuUsage, { min: 0, max: 100 });
    metrics.cpu_usage_avg = clampPercent(stats.avg);
    metrics.cpu_usage_max = clampPercent(stats.max);
  }

  const gpuUsage = getSeries('gpu_d3d_usage');
  if (gpuUsage.length) {
    const stats = computeBoundedStats(gpuUsage, { min: 0, max: 100 });
    metrics.gpu_d3d_usage_avg = clampPercent(stats.avg);
    metrics.gpu_d3d_usage_max = clampPercent(stats.max);
  }

  const thermalHeadroom = getSeries('thermal_headroom');
  if (thermalHeadroom.length) {
    metrics.thermal_headroom_min = computeStats(thermalHeadroom)?.min;
  }

  const cpuTemps = getSeries('cpu_temp');
  if (cpuTemps.length) {
    const stats = computeBoundedStats(cpuTemps, { min: -20, max: 130 });
    metrics.cpu_temp_avg = stats.avg;
    metrics.cpu_temp_max = stats.max;
  }

  const maxCoreTemps = getSeries('max_cpu_core_temp');
  if (maxCoreTemps.length) {
    const stats = computeBoundedStats(maxCoreTemps, { min: -20, max: 130 });
    metrics.max_cpu_core_temp = stats.max;
    if (!metrics.cpu_temp_max || stats.max > metrics.cpu_temp_max) {
      metrics.cpu_temp_max = stats.max;
    }
  }

  if (metrics.cpu_temp_max != null && metrics.thermal_headroom_min == null && Number.isFinite(tjmax)) {
    metrics.thermal_headroom_min = tjmax - metrics.cpu_temp_max;
  }

  const gpuTemps = getSeries('gpu_temp');
  const gpuTempLimits = getSeries('gpu_temp_limit');
  if (gpuTemps.length) {
    const stats = computeBoundedStats(gpuTemps, { min: -20, max: 130 });
    metrics.gpu_temp_avg = stats.avg;
    metrics.gpu_temp_max = stats.max;
    metrics.gpu_temp_limit = computeStats(gpuTempLimits)?.avg;
  }

  const fpsAvg = getSeries('fps_avg');
  const fps1 = getSeries('fps_1');
  const fps01 = getSeries('fps_01');
  const frameTime = getSeries('frame_time_series');

  metrics.fps_stats = {
    avg: computeStats(fpsAvg)?.avg,
    percentile_1: computeStats(fps1)?.avg,
    percentile_01: computeStats(fps01)?.avg
  };

  if (frameTime.length) {
    const stats = computeStats(frameTime);
    metrics.frame_time_percentiles = {
      median: quantile(stats.values, 0.5),
      p95: quantile(stats.values, 0.95)
    };
  }

  const ramUsage = getSeries('ram_usage_percent');
  if (ramUsage.length) {
    const stats = computeBoundedStats(ramUsage, { min: 0, max: 100 });
    metrics.ram_usage_percent_avg = clampPercent(stats.avg);
    metrics.ram_usage_percent_max = clampPercent(stats.max);
  }

  const ramUsed = getSeries('ram_used_mb');
  if (ramUsed.length) {
    metrics.ram_used_mb_avg = computeStats(ramUsed)?.avg;
  }

  const ramAvailable = getSeries('ram_available_mb');
  if (ramAvailable.length) {
    metrics.ram_available_mb_avg = computeStats(ramAvailable)?.avg;
  }

  const diskRead = getSeries('disk_read_rate');
  if (diskRead.length) {
    metrics.disk_read_rate_avg = computeStats(diskRead)?.avg;
  }

  const diskWrite = getSeries('disk_write_rate');
  if (diskWrite.length) {
    metrics.disk_write_rate_avg = computeStats(diskWrite)?.avg;
  }

  const gpuMemoryUsage = getSeries('gpu_memory_usage');
  if (gpuMemoryUsage.length) {
    const stats = computeBoundedStats(gpuMemoryUsage, { min: 0, max: 100 });
    metrics.gpu_memory_usage_avg = clampPercent(stats.avg);
    metrics.gpu_memory_usage_max = clampPercent(stats.max);
  }

  const gpuDevices = gpuSensors
    .map((sensor, index) => {
      const accessSeries = (alias) => getGpuSeries(alias, sensor.key);
      const device = {
        key: sensor.key,
        index: sensor.index != null ? sensor.index : index + 1,
        name: sensor.name || sensor.label || `GPU #${sensor.index ?? index + 1}`
      };

      const powerSeries = accessSeries('gpu_power');
      if (powerSeries.length) {
        const stats = computeBoundedStats(powerSeries, { min: 0, max: 2000 });
        device.power_avg = stats.avg;
        device.power_max = stats.max;
      }

      const clockSeries = accessSeries('gpu_clock');
      if (clockSeries.length) {
        device.clock_avg = computeStats(clockSeries)?.avg;
      }

      const usageSeries = accessSeries('gpu_d3d_usage');
      if (usageSeries.length) {
        const stats = computeBoundedStats(usageSeries, { min: 0, max: 100 });
        device.usage_avg = clampPercent(stats.avg);
        device.usage_max = clampPercent(stats.max);
      }

      const tempSeries = accessSeries('gpu_temp');
      if (tempSeries.length) {
        const stats = computeBoundedStats(tempSeries, { min: -20, max: 130 });
        device.temp_avg = stats.avg;
        device.temp_max = stats.max;
      }

      const memoryUsageSeries = accessSeries('gpu_memory_usage');
      if (memoryUsageSeries.length) {
        const stats = computeBoundedStats(memoryUsageSeries, { min: 0, max: 100 });
        device.memory_usage_avg = clampPercent(stats.avg);
        device.memory_usage_max = clampPercent(stats.max);
      }

      const hasData = [
        device.power_avg,
        device.clock_avg,
        device.usage_avg,
        device.temp_avg,
        device.memory_usage_avg
      ].some((value) => value != null && !Number.isNaN(value));

      return hasData ? device : null;
    })
    .filter(Boolean);

  if (gpuDevices.length) {
    metrics.gpuDevices = gpuDevices;
    const primary = gpuDevices[0];
    if (primary) {
      if (primary.power_avg != null) {
        metrics.gpu_power_avg = primary.power_avg;
      }
      if (primary.power_max != null) {
        metrics.gpu_power_max = primary.power_max;
      }
      if (primary.clock_avg != null) {
        metrics.gpu_clock_avg = primary.clock_avg;
      }
      if (primary.usage_avg != null) {
        metrics.gpu_d3d_usage_avg = primary.usage_avg;
      }
      if (primary.usage_max != null) {
        metrics.gpu_d3d_usage_max = primary.usage_max;
      }
      if (primary.temp_avg != null) {
        metrics.gpu_temp_avg = primary.temp_avg;
      }
      if (primary.temp_max != null) {
        metrics.gpu_temp_max = primary.temp_max;
      }
      if (primary.memory_usage_avg != null) {
        metrics.gpu_memory_usage_avg = primary.memory_usage_avg;
      }
      if (primary.memory_usage_max != null) {
        metrics.gpu_memory_usage_max = primary.memory_usage_max;
      }
    }
  }

  if (metrics.fps_stats.avg && metrics.cpu_power_avg && metrics.gpu_power_avg) {
    const totalPower = metrics.cpu_power_avg + metrics.gpu_power_avg;
    if (totalPower) {
      metrics.perf_per_watt = metrics.fps_stats.avg / totalPower;
    }
  }

  const summaryLines = buildSummaryLines(rows.length, metrics, path.basename(filePath), tjmax);

  return {
    path: filePath,
    name: path.basename(filePath),
    metrics,
    summaryLines,
    resolved,
    aliasEntries,
    rows
  };
}


function ensureArray(value) {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function buildPropertyMap(sources = []) {
  const map = new Map();
  sources.forEach((source) => {
    ensureArray(source).forEach((item) => {
      if (!item || typeof item !== 'object') {
        return;
      }
      const entryText = decodeHtmlEntities(item.Entry ?? item.entry ?? '');
      if (!entryText) {
        return;
      }
      const key = normalize(entryText);
      if (!key || map.has(key)) {
        return;
      }
      const description =
        item.Description ?? item.description ?? item.Value ?? item.value ?? null;
      map.set(
        key,
        typeof description === 'string' ? decodeHtmlEntities(description) : description
      );
    });
  });
  return map;
}

function pickFromMap(map, keywords = []) {
  if (!map) {
    return null;
  }
  for (const keyword of keywords) {
    const normalizedKey = normalize(keyword);
    if (map.has(normalizedKey)) {
      return map.get(normalizedKey);
    }
  }
  return null;
}

function pickNumberFromMap(map, keywords = [], transform) {
  const value = pickFromMap(map, keywords);
  if (value == null) {
    return null;
  }
  const numeric = toNumber(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  return typeof transform === 'function' ? transform(numeric) : numeric;
}

function firstNode(value) {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? value[0] : value;
}

function collectPropertyEntries(node, list = []) {
  if (!node) {
    return list;
  }
  if (Array.isArray(node)) {
    node.forEach((item) => collectPropertyEntries(item, list));
    return list;
  }
  if (typeof node === 'object') {
    if (node.Property) {
      collectPropertyEntries(node.Property, list);
    }
    if (node.Entry != null && node.Description != null) {
      list.push({
        entry: decodeHtmlEntities(node.Entry),
        description: decodeHtmlEntities(node.Description)
      });
    }
    Object.values(node).forEach((child) => {
      if (child && typeof child === 'object') {
        collectPropertyEntries(child, list);
      }
    });
  }
  return list;
}

function extractMemoryModules(memoryNode) {
  return ensureArray(memoryNode?.SubNode)
    .map((moduleNode) => {
      if (!moduleNode) {
        return null;
      }
      const props = buildPropertyMap([moduleNode.Property]);
      const slotLabel = moduleNode.NodeName ? decodeHtmlEntities(moduleNode.NodeName) : null;
      const sizeLabel = pickFromMap(props, [
        'Tamanho do modulo',
        'Tamanho do módulo',
        'Module Size'
      ]);
      const sizeGB = parseCapacity(sizeLabel);
      const type = pickFromMap(props, ['Tipo de memoria', 'Tipo de memória', 'Memory Type']);
      const speed =
        pickFromMap(props, [
          'Velocidade da memoria',
          'Velocidade da memória',
          'Memory Speed',
          'Memory Clock'
        ]) ||
        pickFromMap(props, ['Frequencia da memoria', 'Frequência da memória']);
      const manufacturer = pickFromMap(props, [
        'Fabricante do modulo',
        'Fabricante do módulo',
        'Module Manufacturer'
      ]);
      const partNumber = pickFromMap(props, [
        'Numero da peca do modulo',
        'Número da peça do módulo',
        'Module Part Number'
      ]);
      return {
        slot: slotLabel || null,
        label: slotLabel || partNumber || manufacturer || null,
        manufacturer: manufacturer || null,
        model: partNumber || slotLabel || null,
        type: type || null,
        speed: speed || null,
        sizeGB: Number.isFinite(sizeGB) ? sizeGB : null,
        sizeLabel: sizeLabel || null
      };
    })
    .filter((entry) => !!entry);
}

function extractDrives(drivesNode) {
  const drives = [];
  const visit = (node) => {
    if (!node) {
      return;
    }
    if (node.Property) {
      const props = buildPropertyMap([node.Property]);
      const model =
        pickFromMap(
          props,
          ['Modelo de unidade', 'Drive Model', 'Nome da unidade', 'Drive Name']
        ) || (node.NodeName ? decodeHtmlEntities(node.NodeName) : null);
      if (model) {
        const capacityFromMb = pickNumberFromMap(
          props,
          ['Drive Capacity [MB]', 'Capacidade da unidade [MB]'],
          (value) => value / 1024
        );
        const capacityText = pickFromMap(
          props,
          ['Capacidade de unidade', 'Drive Capacity', 'Capacidade da unidade']
        );
        const letters = pickFromMap(props, ['Drive Letter(s)', 'Unidade(s)', 'Letra do drive']);
        const type = pickFromMap(props, ['Tipo de unidade', 'Drive Type', 'Tipo de disco']);
        drives.push({
          model,
          label: model,
          letters: letters || null,
          type: type || null,
          capacityGB: capacityFromMb ?? parseCapacity(capacityText)
        });
      }
    }
    ensureArray(node.SubNode).forEach(visit);
  };
  visit(drivesNode);
  const unique = [];
  const seen = new Set();
  drives.forEach((drive) => {
    const key = [drive.model, drive.letters].filter(Boolean).join('|') || drive.model;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(drive);
    }
  });
  return unique;
}

function extractGpus(videoNode) {
  const gpus = [];
  const visit = (node) => {
    if (!node) {
      return;
    }
    if (node.Property) {
      const props = buildPropertyMap([node.Property]);
      const name =
        (node.NodeName ? decodeHtmlEntities(node.NodeName) : null) ||
        pickFromMap(props, ['Placa de vídeo', 'Placa de video', 'Video Adapter', 'GPU Name', 'Graphics Card']);
      const chipset = pickFromMap(
        props,
        ['Conjunto de chips gráficos', 'Conjunto de chips graficos', 'Graphics Chipset', 'GPU Chipset']
      );
      const memory = pickFromMap(
        props,
        ['Memória gráfica', 'Memoria grafica', 'Tamanho da memória', 'Video Memory', 'Frame Buffer']
      );
      const type = pickFromMap(props, ['GPU Type', 'Tipo de GPU']);
      const bus = pickFromMap(props, [
        'Barramento de placa de vídeo',
        'Barramento de placa de video',
        'Video Adapter Bus',
        'GPU Bus',
        'Graphics Bus'
      ]);
      const coreClock = pickFromMap(props, [
        'Frequência do processador gráfico',
        'Frequencia do processador grafico',
        'GPU Core Clock',
        'Processor Clock'
      ]);
      const memoryClock = pickFromMap(props, [
        'Frequência de memória gráfica',
        'Frequencia de memoria grafica',
        'GPU Memory Clock',
        'Memory Clock'
      ]);
      const driverName = pickFromMap(props, ['Descrição do driver', 'Driver Description']);
      const driverVersion = pickFromMap(props, ['Versão do driver', 'Versao do driver', 'Driver Version']);
      const driverDate = pickFromMap(props, ['Data do driver', 'Driver Date']);
      const driverVendor = pickFromMap(props, ['Fornecedor de driver', 'Driver Vendor', 'Fabricante do driver']);
      if (name || chipset) {
        gpus.push({
          name: name || chipset || null,
          chipset: chipset || null,
          memory: memory || null,
          type: type || null,
          bus: bus || null,
          coreClock: coreClock || null,
          memoryClock: memoryClock || null,
          driver: driverName || null,
          driverVersion: driverVersion || null,
          driverDate: driverDate || null,
          driverVendor: driverVendor || null
        });
      }
    }
    ensureArray(node.SubNode).forEach(visit);
  };
  visit(videoNode);
  return gpus;
}

function formatDriveSummary(drive) {
  const parts = [drive.model];
  if (drive.letters) {
    parts.push(drive.letters);
  }
  if (Number.isFinite(drive.capacityGB)) {
    parts.push(`${drive.capacityGB.toFixed(0)} GB`);
  }
  return parts.filter(Boolean).join(' · ') || 'Unidade de disco';
}

function formatGpuSummary(gpu) {
  return [gpu.name, gpu.chipset].filter(Boolean).join(' / ') || gpu.name || 'GPU';
}

function parseHardwareXml(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return { lines: ['Nenhum perfil de hardware carregado.'], profile: null };
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    textNodeName: '#text',
    ignoreDeclaration: true,
    processEntities: true
  });
  let parsed;
  try {
    parsed = parser.parse(raw);
  } catch (error) {
    return { lines: [`Falha ao ler o XML: ${error.message}`], profile: null };
  }
  const computer = parsed?.HWINFO?.COMPUTER;
  if (!computer) {
    return { lines: ['Formato de hardware desconhecido.'], profile: null };
  }

  const entries = collectPropertyEntries(computer);
  const rootProps = buildPropertyMap([computer.Property]);
  const cpuNode = computer.SubNodes?.CPU;
  const cpuDetailNode = firstNode(cpuNode?.SubNode);
  const cpuProps = buildPropertyMap([cpuNode?.Property, cpuDetailNode?.Property]);
  const memoryNode = computer.SubNodes?.MEMORY;
  const memoryProps = buildPropertyMap([memoryNode?.Property]);

  let baseClock = pickFromMap(
    cpuProps,
    ['Frequência do processador original', 'Original Processor Frequency']
  );
  if (!baseClock) {
    const baseClockNumeric = pickNumberFromMap(cpuProps, ['Original Processor Frequency [MHz]']);
    if (Number.isFinite(baseClockNumeric)) {
      baseClock = `${baseClockNumeric.toFixed(0)} MHz`;
    }
  }

  const memoryTotalText = pickFromMap(
    memoryProps,
    ['Tamanho total da memória', 'Total Memory Size']
  );
  let totalMemoryGb = memoryTotalText ? parseCapacity(memoryTotalText) : null;
  if (!totalMemoryGb) {
    const totalMb = pickNumberFromMap(memoryProps, ['Total Memory Size [MB]']);
    if (Number.isFinite(totalMb)) {
      totalMemoryGb = totalMb / 1024;
    }
  }
  const memoryFreq = pickNumberFromMap(
    memoryProps,
    ['Frequência da memória atual', 'Memory Clock', 'Memory Speed']
  );

  const profile = {
    path: filePath,
    system: {
      brand: pickFromMap(rootProps, ['Nome da marca do computador', 'Fabricante', 'Marca']),
      name: pickFromMap(rootProps, ['Nome do computador'])
    },
    os: {
      name: pickFromMap(rootProps, ['Sistema operacional']),
      secureBoot: pickFromMap(rootProps, ['Inicialização segura', 'Secure Boot']),
      uefi: pickFromMap(rootProps, ['Inicialização UEFI', 'UEFI Boot'])
    },
    cpu: {
      name:
        (cpuDetailNode?.NodeName ? decodeHtmlEntities(cpuDetailNode.NodeName) : null) ||
        pickFromMap(cpuProps, ['Nome do processador', 'CPU Name']),
      cores: pickNumberFromMap(cpuProps, ['Número de núcleos de processador', 'Total Cores']),
      threads: pickNumberFromMap(
        cpuProps,
        ['Número de processadores lógicos', 'Logical Processor Count']
      ),
      baseClock: baseClock || null
    },
    memory: {
      totalGB: totalMemoryGb || null,
      freqMHz: memoryFreq || null,
      modules: extractMemoryModules(memoryNode)
    },
    drives: extractDrives(computer.SubNodes?.DRIVES),
    gpus: extractGpus(computer.SubNodes?.VIDEO),
    raw: entries
  };

  const lines = [
    profile.system.brand || profile.system.name
      ? `Sistema: ${[profile.system.brand, profile.system.name].filter(Boolean).join(' / ')}`
      : 'Sistema: --',
    profile.os.name ? `SO: ${profile.os.name}` : 'SO: --',
    profile.cpu.name ? `CPU: ${profile.cpu.name}` : 'CPU: --',
    profile.memory.totalGB ? `Memória: ${profile.memory.totalGB.toFixed(1)} GB` : 'Memória: --',
    profile.drives.length
      ? `Discos: ${profile.drives.map((drive) => formatDriveSummary(drive)).join(', ')}`
      : 'Discos: --',
    profile.gpus.length
      ? `GPU: ${profile.gpus.map((gpu) => formatGpuSummary(gpu)).join(', ')}`
      : 'GPU: --'
  ];

  return { lines, profile };
}

function buildComparisonPayload(reports) {
  const comparison = buildComparison(reports);
  const charts = buildChartData(reports);
  return { comparison, charts };
}

function analyzeReports(reportPaths = [], options = {}) {
  const tjmax = Number(options.tjmax) || 100;
  const reports = reportPaths.map((report) => analyzeReport(report, tjmax));
  const { comparison, charts } = buildComparisonPayload(reports);
  const hardware = parseHardwareXml(options.hardwarePath);
  return {
    reports: reports.map((report) => ({
      name: report.name,
      path: report.path,
      summaryLines: report.summaryLines,
      metrics: report.metrics
    })),
    comparison,
    charts,
    chartCategories: Object.keys(CHART_CATEGORIES).map((name) => ({
      name,
      metrics: CHART_CATEGORIES[name]
    })),
    hardware
  };
}

module.exports = {
  analyzeReports
};
