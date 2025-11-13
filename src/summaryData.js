function formatValue(value, unit = '', decimals = 2) {
  if (value == null || Number.isNaN(value)) {
    return '--';
  }
  return `${value.toFixed(decimals)}${unit}`;
}

function buildSummaryLines(sampleCount, metrics, name, tjmax) {
  const lines = [
    `Relatório: ${name}`,
    `Amostras: ${sampleCount}`,
    ` `,
    `CPU Power avg/max: ${formatValue(metrics.cpu_power_avg, ' W')} / ${formatValue(
      metrics.cpu_power_max,
      ' W'
    )}`,
    `CPU Temp avg/max: ${formatValue(metrics.cpu_temp_avg, ' °C')} / ${formatValue(
      metrics.cpu_temp_max,
      ' °C'
    )}`,
    ` `,
    `GPU Power avg/max: ${formatValue(metrics.gpu_power_avg, ' W')} / ${formatValue(
      metrics.gpu_power_max,
      ' W'
    )}`,
    `GPU Temp avg/max: ${formatValue(metrics.gpu_temp_avg, ' °C')} / ${formatValue(
      metrics.gpu_temp_max,
      ' °C'
    )}`,
    `Limite térmico GPU: ${formatValue(metrics.gpu_temp_limit, ' °C')}`,
    ` `,
    `Memory Available avg: ${formatValue(metrics.ram_available_mb_avg, ' MB')}`,
    `Memory Used avg: ${formatValue(metrics.ram_used_mb_avg, ' MB')}`,
    ` `,
    `Disk Read avg: ${formatValue(metrics.disk_read_rate_avg, ' MB/s')}`,
    `Disk Write avg: ${formatValue(metrics.disk_write_rate_avg, ' MB/s')}`,
    ` `,
    metrics.perf_per_watt != null
      ? `FPS/W: ${formatValue(metrics.perf_per_watt, ' FPS/W', 3)}`
      : null,
    `FPS médio: ${formatValue(metrics.fps_stats?.avg, ' FPS')}`,
    `FPS 1%: ${formatValue(metrics.fps_stats?.percentile_1, ' FPS')}`,
    `FPS 0.1%: ${formatValue(metrics.fps_stats?.percentile_01, ' FPS')}`,
    `Thermal headroom (TjMAX ${tjmax}°C): ${formatValue(metrics.thermal_headroom_min, ' °C')}`
  ].filter(Boolean);
  return lines;
}

module.exports = {
  buildSummaryLines
};
