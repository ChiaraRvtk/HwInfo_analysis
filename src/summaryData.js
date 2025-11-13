function pad(value) {
  return String(value).padStart(2, '0');
}

function formatDateTimeLabel(value) {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatDuration(durationMs) {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return '';
  }
  const totalSeconds = Math.floor(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [];
  if (hours) {
    parts.push(`${hours}h`);
  }
  if (minutes) {
    parts.push(`${minutes}m`);
  }
  if (seconds || !parts.length) {
    parts.push(`${seconds}s`);
  }
  return parts.join(' ');
}

function formatValue(value, unit = '', decimals = 2) {
  if (value == null || Number.isNaN(value)) {
    return '--';
  }
  return `${value.toFixed(decimals)}${unit}`;
}

function buildSummaryLines(sampleCount, metrics, name, tjmax, period) {
  const lines = [
    `Relatório: ${name}`,
    `Amostras: ${sampleCount}`
  ];

  const resolvedPeriod = period || metrics?.period;
  if (resolvedPeriod) {
    const startLabel = resolvedPeriod.startDisplay || formatDateTimeLabel(resolvedPeriod.start);
    const endLabel = resolvedPeriod.endDisplay || formatDateTimeLabel(resolvedPeriod.end);
    if (startLabel || endLabel) {
      const durationLabel = formatDuration(resolvedPeriod.durationMs);
      const rangeText =
        startLabel && endLabel ? `${startLabel} → ${endLabel}` : startLabel || endLabel || '--';
      lines.push(durationLabel ? `Período: ${rangeText} (${durationLabel})` : `Período: ${rangeText}`);
    }
  }

  lines.push(` `);

  lines.push(
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
  );

  const filtered = lines.filter(Boolean);

  if (Array.isArray(metrics.gpuDevices) && metrics.gpuDevices.length) {
    filtered.push(
      ` `,
      metrics.gpuDevices.length > 1 ? 'GPUs monitoradas:' : 'GPU monitorada:'
    );
    metrics.gpuDevices.forEach((device, index) => {
      const label =
        device.name ||
        (device.index != null ? `GPU #${device.index}` : `GPU #${index + 1}`);
      filtered.push(`  ${label}`);
      if (device.power_avg != null || device.power_max != null) {
        filtered.push(
          `    Potência avg/max: ${formatValue(device.power_avg, ' W')} / ${formatValue(
            device.power_max,
            ' W'
          )}`
        );
      }
      if (device.clock_avg != null) {
        filtered.push(`    Clock médio: ${formatValue(device.clock_avg, ' MHz')}`);
      }
      if (device.usage_avg != null || device.usage_max != null) {
        filtered.push(
          `    Uso D3D avg/max: ${formatValue(device.usage_avg, ' %')} / ${formatValue(
            device.usage_max,
            ' %'
          )}`
        );
      }
      if (device.temp_avg != null || device.temp_max != null) {
        filtered.push(
          `    Temp avg/max: ${formatValue(device.temp_avg, ' °C')} / ${formatValue(
            device.temp_max,
            ' °C'
          )}`
        );
      }
      if (device.memory_usage_avg != null || device.memory_usage_max != null) {
        filtered.push(
          `    Memória avg/max: ${formatValue(device.memory_usage_avg, ' %')} / ${formatValue(
            device.memory_usage_max,
            ' %'
          )}`
        );
      }
    });
  }

  if (Array.isArray(metrics.driveDevices) && metrics.driveDevices.length) {
    filtered.push(
      ` `,
      metrics.driveDevices.length > 1 ? 'Drives monitorados:' : 'Drive monitorado:'
    );
    metrics.driveDevices.forEach((drive, index) => {
      const labelParts = [drive.name || `Drive ${index + 1}`];
      if (drive.letter) {
        labelParts.push(`[${drive.letter}]`);
      }
      filtered.push(`  ${labelParts.join(' ')}`);
      if (drive.read_avg != null || drive.read_max != null) {
        filtered.push(
          `    Leitura avg/max: ${formatValue(drive.read_avg, ' MB/s')} / ${formatValue(
            drive.read_max,
            ' MB/s'
          )}`
        );
      }
      if (drive.write_avg != null || drive.write_max != null) {
        filtered.push(
          `    Gravação avg/max: ${formatValue(drive.write_avg, ' MB/s')} / ${formatValue(
            drive.write_max,
            ' MB/s'
          )}`
        );
      }
    });
  }

  return filtered;
}

module.exports = {
  buildSummaryLines
};
