const COMPARISON_DEFINITIONS = [
  {
    title: 'Desempenho / FPS',
    rows: [
      {
        label: 'FPS médio',
        getter: (m) => m.fps_stats?.avg,
        unit: ' FPS',
        decimals: 2,
        prefer: 'max'
      },
      {
        label: 'FPS 1%',
        getter: (m) => m.fps_stats?.percentile_1,
        unit: ' FPS',
        decimals: 2,
        prefer: 'max'
      },
      {
        label: 'FPS 0.1%',
        getter: (m) => m.fps_stats?.percentile_01,
        unit: ' FPS',
        decimals: 2,
        prefer: 'max'
      },
      {
        label: 'CPU Power médio',
        getter: (m) => m.cpu_power_avg,
        unit: ' W',
        decimals: 1,
        prefer: 'min'
      },
      {
        label: 'GPU Power médio',
        getter: (m) => m.gpu_power_avg,
        unit: ' W',
        decimals: 1,
        prefer: 'min'
      },
      {
        label: 'FPS / Watt',
        getter: (m) => m.perf_per_watt,
        unit: ' FPS/W',
        decimals: 3,
        prefer: 'max'
      }
    ]
  },
  {
    title: 'Temperatura',
    rows: [
      {
        label: 'CPU Temp máx',
        getter: (m) => m.cpu_temp_max,
        unit: ' °C',
        decimals: 1,
        prefer: 'min'
      },
      {
        label: 'GPU Temp máx',
        getter: (m) => m.gpu_temp_max,
        unit: ' °C',
        decimals: 1,
        prefer: 'min'
      },
      {
        label: 'Headroom mínimo',
        getter: (m) => m.thermal_headroom_min,
        unit: ' °C',
        decimals: 1,
        prefer: 'max'
      }
    ]
  },
  {
    title: 'CPU',
    rows: [
      {
        label: 'CPU Effective Clock',
        getter: (m) => m.cpu_effective_clock_avg,
        unit: ' MHz',
        decimals: 0,
        prefer: 'max'
      },
      {
        label: 'Uso médio de CPU',
        getter: (m) => m.cpu_usage_avg,
        unit: ' %',
        decimals: 1,
        prefer: 'min'
      },
      {
        label: 'Thermal headroom (TjMAX)',
        getter: (m) => m.thermal_headroom_min,
        unit: ' °C',
        decimals: 1,
        prefer: 'max'
      }
    ]
  },
  {
    title: 'Memória / Disco',
    rows: [
      {
        label: 'Uso RAM (%)',
        getter: (m) => m.ram_usage_percent_avg,
        unit: ' %',
        decimals: 1,
        prefer: 'min'
      },
      {
        label: 'RAM utilizada (MB)',
        getter: (m) => m.ram_used_mb_avg,
        unit: ' MB',
        decimals: 0,
        prefer: 'min'
      },
      {
        label: 'Leitura (MB/s)',
        getter: (m) => m.disk_read_rate_avg,
        unit: ' MB/s',
        decimals: 1,
        prefer: 'min'
      },
      {
        label: 'Gravação (MB/s)',
        getter: (m) => m.disk_write_rate_avg,
        unit: ' MB/s',
        decimals: 1,
        prefer: 'min'
      }
    ]
  }
];

const GPU_COMPARISON_ROW_TEMPLATES = [
  {
    label: 'Potência média',
    unit: ' W',
    decimals: 1,
    prefer: 'min',
    accessor: (gpu) => gpu?.power_avg
  },
  {
    label: 'Potência máxima',
    unit: ' W',
    decimals: 1,
    prefer: 'min',
    accessor: (gpu) => gpu?.power_max
  },
  {
    label: 'Clock médio',
    unit: ' MHz',
    decimals: 0,
    prefer: 'max',
    accessor: (gpu) => gpu?.clock_avg
  },
  {
    label: 'Uso D3D médio',
    unit: ' %',
    decimals: 1,
    prefer: 'max',
    accessor: (gpu) => gpu?.usage_avg
  },
  {
    label: 'Uso D3D máximo',
    unit: ' %',
    decimals: 1,
    prefer: 'max',
    accessor: (gpu) => gpu?.usage_max
  },
  {
    label: 'Temperatura média',
    unit: ' °C',
    decimals: 1,
    prefer: 'min',
    accessor: (gpu) => gpu?.temp_avg
  },
  {
    label: 'Temperatura máxima',
    unit: ' °C',
    decimals: 1,
    prefer: 'min',
    accessor: (gpu) => gpu?.temp_max
  },
  {
    label: 'Uso memória médio',
    unit: ' %',
    decimals: 1,
    prefer: 'max',
    accessor: (gpu) => gpu?.memory_usage_avg
  },
  {
    label: 'Uso memória máxima',
    unit: ' %',
    decimals: 1,
    prefer: 'max',
    accessor: (gpu) => gpu?.memory_usage_max
  }
];

function formatComparisonValue(value, definition) {
  if (typeof definition.formatter === 'function') {
    return definition.formatter(value, definition);
  }
  if (!Number.isFinite(value)) {
    return '--';
  }
  const decimals = definition.decimals ?? 2;
  const unit = definition.unit || '';
  return `${value.toFixed(decimals)}${unit}`;
}

function evaluateDefinition(reports, definition) {
  const values = reports.map((report) => definition.getter(report.metrics));
  const formattedValues = values.map((value) => formatComparisonValue(value, definition));
  const numericValues = values.map((value) => (Number.isFinite(value) ? Number(value) : null));
  let bestIndex = null;
  if (definition.prefer && numericValues.every((value) => value !== null)) {
    bestIndex =
      definition.prefer === 'max'
        ? numericValues.indexOf(Math.max(...numericValues))
        : numericValues.indexOf(Math.min(...numericValues));
  }
  const critical = numericValues.map((value) => {
    if (value == null) {
      return false;
    }
    if (definition.critical_high != null && value >= definition.critical_high) {
      return true;
    }
    if (definition.critical_low != null && value <= definition.critical_low) {
      return true;
    }
    return false;
  });
  return {
    label: definition.label,
    values,
    formattedValues,
    bestIndex,
    critical
  };
}

function buildRows(reports, definitions) {
  return definitions.map((definition) => evaluateDefinition(reports, definition));
}

function buildGpuComparisonGroups(reports = []) {
  const maxGpuCount = reports.reduce((max, report) => {
    const count = Array.isArray(report.metrics?.gpuDevices) ? report.metrics.gpuDevices.length : 0;
    return Math.max(max, count);
  }, 0);
  if (!maxGpuCount) {
    return [];
  }
  const groups = [];
  for (let index = 0; index < maxGpuCount; index += 1) {
    const definitions = [
      {
        label: 'Modelo',
        formatter: (value) => (value ? String(value) : '--'),
        getter: (metrics) => {
          const device = Array.isArray(metrics.gpuDevices) ? metrics.gpuDevices[index] : null;
          return device?.name || device?.label || null;
        }
      },
      ...GPU_COMPARISON_ROW_TEMPLATES.map((template) => ({
        ...template,
        getter: (metrics) => {
          const device = Array.isArray(metrics.gpuDevices) ? metrics.gpuDevices[index] : null;
          return template.accessor(device);
        }
      }))
    ];
    groups.push({
      title: `GPU ${index + 1}`,
      rows: buildRows(reports, definitions)
    });
  }
  return groups;
}

function buildComparison(reports) {
  const headers = ['Métrica', ...reports.map((report) => report.name)];
  const groups = COMPARISON_DEFINITIONS.map((group) => ({
    title: group.title,
    rows: buildRows(reports, group.rows)
  }));
  const gpuGroups = buildGpuComparisonGroups(reports);
  if (gpuGroups.length) {
    groups.push(...gpuGroups);
  }
  return { headers, groups };
}

module.exports = {
  COMPARISON_DEFINITIONS,
  buildComparison
};

