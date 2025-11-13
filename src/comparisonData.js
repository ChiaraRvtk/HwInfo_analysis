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
    title: 'GPU',
    rows: [
      {
        label: 'Uso GPU (%)',
        getter: (m) => m.gpu_d3d_usage_avg,
        unit: ' %',
        decimals: 1,
        prefer: 'max'
      },
      {
        label: 'GPU Clock',
        getter: (m) => m.gpu_clock_avg,
        unit: ' MHz',
        decimals: 0,
        prefer: 'max'
      },
      {
        label: 'Uso memória GPU (%)',
        getter: (m) => m.gpu_memory_usage_avg,
        unit: ' %',
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

function buildComparison(reports) {
  const headers = ['Métrica', ...reports.map((report) => report.name)];
  const groups = COMPARISON_DEFINITIONS.map((group) => {
    const rows = group.rows.map((definition) => {
      const values = reports.map((report) => definition.getter(report.metrics));
      const formattedValues = values.map((value) => {
        if (value == null || Number.isNaN(value)) {
          return '--';
        }
        return `${value.toFixed(definition.decimals ?? 2)}${definition.unit || ''}`;
      });
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
    });
    return { title: group.title, rows };
  });
  return { headers, groups };
}

module.exports = {
  COMPARISON_DEFINITIONS,
  buildComparison
};
