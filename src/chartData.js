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

function createChartDataBuilder({ sanitizeValue, clampPercent }) {
  if (typeof sanitizeValue !== 'function' || typeof clampPercent !== 'function') {
    throw new Error('Missing helpers for chart data builder.');
  }

  return function buildChartData(reports) {
    const categoryData = {};
    Object.entries(CHART_CATEGORIES).forEach(([categoryName, metrics]) => {
      const datasets = [];
      let maxPoints = 0;
      const units = new Set();
      metrics.forEach((metric) => {
        reports.forEach((report) => {
          const column = report.resolved[metric.alias];
          if (!column) {
            return;
          }
          const values = report.rows.map((row) => {
            const numeric = sanitizeValue(metric.alias, row[column]);
            if (!Number.isFinite(numeric)) {
              return null;
            }
            if (metric.unit === '%') {
              return clampPercent(numeric);
            }
            return numeric;
          });
          if (!values.some((entry) => entry !== null)) {
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
        return;
      }
      categoryData[categoryName] = {
        labels: Array.from({ length: maxPoints }, (_, index) => index + 1),
        datasets,
        yAxisTitle: [...units].join(' / ') || '',
        percMode:
          metrics.every((metric) => metric.unit === '%') && metrics.some((metric) => metric.unit)
      };
    });
    return categoryData;
  };
}

module.exports = {
  CHART_CATEGORIES,
  createChartDataBuilder
};
