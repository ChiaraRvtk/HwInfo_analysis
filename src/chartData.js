const CHART_CATEGORIES = {
  CPU: [
    { label: 'Uso de CPU (%)', alias: 'cpu_usage', unit: '%' },
    { label: 'CPU Clock (MHz)', alias: 'cpu_effective_clock', unit: 'MHz' },
    { label: 'CPU Power (W)', alias: 'cpu_power', unit: 'W' }
  ],
  GPU: [
    { label: 'Uso GPU D3D (%)', alias: 'gpu_d3d_usage', unit: '%' },
    { label: 'GPU Clock (MHz)', alias: 'gpu_clock', unit: 'MHz' },
    { label: 'GPU Power (W)', alias: 'gpu_power', unit: 'W' },
    { label: 'Uso memória GPU (%)', alias: 'gpu_memory_usage', unit: '%' }
  ],
  Temperatura: [
    { label: 'CPU Temp (°C)', alias: 'cpu_temp', unit: '°C' },
    { label: 'GPU Temp (°C)', alias: 'gpu_temp', unit: '°C' },
    { label: 'Headroom (°C)', alias: 'thermal_headroom', unit: '°C' }
  ],
  Memória: [
    { label: 'Uso de RAM (%)', alias: 'ram_usage_percent', unit: '%' },
    { label: 'RAM utilizada (MB)', alias: 'ram_used_mb', unit: 'MB' }
  ],
  Disco: [
    { label: 'Leitura (MB/s)', alias: 'disk_read_rate', unit: 'MB/s' },
    { label: 'Gravação (MB/s)', alias: 'disk_write_rate', unit: 'MB/s' }
  ]
};

function collectGpuVariants(reports = []) {
  const variants = new Map();
  reports.forEach((report) => {
    const devices = report.metrics?.gpuDevices ?? [];
    devices.forEach((device, index) => {
      const order = device.index != null ? device.index : index + 1;
      const key = device.key || `gpu-${order}`;
      if (!variants.has(key)) {
        variants.set(key, {
          key,
          order,
          name: device.name || `GPU #${order}`
        });
      }
    });
  });
  return Array.from(variants.values()).sort((a, b) => {
    if (a.order != null && b.order != null) {
      return a.order - b.order;
    }
    if (a.order != null) {
      return -1;
    }
    if (b.order != null) {
      return 1;
    }
    return a.name.localeCompare(b.name);
  });
}

function createChartDataBuilder({ sanitizeValue, clampPercent }) {
  if (typeof sanitizeValue !== 'function' || typeof clampPercent !== 'function') {
    throw new Error('Missing helpers for chart data builder.');
  }

  function buildCategoryDataset(reports, metrics, options = {}) {
    const datasets = [];
    let maxPoints = 0;
    const units = new Set();

    metrics.forEach((metric) => {
      reports.forEach((report) => {
        const entries = report.aliasEntries?.[metric.alias];
        if (!entries || !entries.length) {
          return;
        }
        let entry = entries[0];
        if (options.gpuKey) {
          entry = entries.find(
            (candidate) => candidate.sensorInfo?.type === 'gpu' && candidate.sensorInfo.key === options.gpuKey
          );
        }
        if (!entry) {
          return;
        }
        const values = report.rows.map((row) => {
          const numeric = sanitizeValue(metric.alias, row[entry.header]);
          if (!Number.isFinite(numeric)) {
            return null;
          }
          if (metric.unit === '%') {
            return clampPercent(numeric);
          }
          return numeric;
        });
        if (!values.some((value) => value !== null)) {
          return;
        }
        maxPoints = Math.max(maxPoints, values.length);
        if (metric.unit) {
          units.add(metric.unit);
        }
        datasets.push({
          label: `${report.name} · ${metric.label}`,
          reportName: report.name,
          metricLabel: metric.label,
          unit: metric.unit || '',
          data: values,
          fill: false,
          tension: 0.2,
          pointRadius: 2,
          spanGaps: true
        });
      });
    });

    if (!datasets.length) {
      return null;
    }

    return {
      labels: Array.from({ length: maxPoints }, (_, index) => index + 1),
      datasets,
      yAxisTitle: [...units].join(' / ') || '',
      percMode:
        metrics.every((metric) => metric.unit === '%') && metrics.some((metric) => metric.unit)
    };
  }

  return function buildChartPayload(reports) {
    const charts = {};
    const categories = [];
    const gpuVariants = collectGpuVariants(reports);

    Object.entries(CHART_CATEGORIES).forEach(([categoryName, metrics]) => {
      if (categoryName === 'GPU') {
        if (gpuVariants.length) {
          gpuVariants.forEach((variant) => {
            const displayName =
              variant.order != null ? `GPU #${variant.order} - ${variant.name}` : `GPU - ${variant.name}`;
            const data = buildCategoryDataset(reports, metrics, { gpuKey: variant.key });
            if (data) {
              charts[displayName] = data;
              categories.push({ name: displayName, metrics, gpuKey: variant.key });
            }
          });
        } else {
          const data = buildCategoryDataset(reports, metrics);
          if (data) {
            charts[categoryName] = data;
            categories.push({ name: categoryName, metrics });
          }
        }
      } else {
        const data = buildCategoryDataset(reports, metrics);
        if (data) {
          charts[categoryName] = data;
          categories.push({ name: categoryName, metrics });
        }
      }
    });

    return { charts, categories };
  };
}

module.exports = {
  CHART_CATEGORIES,
  createChartDataBuilder
};
