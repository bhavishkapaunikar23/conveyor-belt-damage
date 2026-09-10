import React from 'react';
import {
  LineChart,
  Line,
  ResponsiveContainer,
  YAxis,
  Tooltip,
} from 'recharts';
import {
  Thermometer,
  Activity,
  Weight,
  Zap,
  Gauge,
  ZapOff,
  MoveDown,
  Shield,
  RotateCw,
} from 'lucide-react';
import { SensorData, SensorHistoryPoint, Severity } from '../types';
import { SENSOR_METAS, calculateSensorFactorStatus } from '../utils/conveyorLogic';
import { AnimatedNumber } from './AnimatedNumber';

interface RealtimeSensorsViewProps {
  sensorData: SensorData;
  history: SensorHistoryPoint[];
  overallHealthScore: number;
  sensorRiskScore: number;
  onSelectFactorModal?: (factorKey: string) => void;
}

const FACTOR_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  temperature: Thermometer,
  vibration: Activity,
  overload: Weight,
  motor_current: Zap,
  belt_speed: Gauge,
  acceleration: ZapOff,
  looseness: MoveDown,
  bearing_condition: Shield,
  motion_change: RotateCw,
};

export const RealtimeSensorsView: React.FC<RealtimeSensorsViewProps> = ({
  sensorData,
  history,
  overallHealthScore,
  sensorRiskScore,
}) => {
  const getBadge = (severity: Severity) => {
    switch (severity) {
      case 'healthy':
        return (
          <span className="badge-status-healthy">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-healthy)]" />
            Optimal
          </span>
        );
      case 'warning':
        return (
          <span className="badge-status-warning">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-warning)]" />
            Warning
          </span>
        );
      case 'critical':
        return (
          <span className="badge-status-critical">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-critical)]" />
            Critical
          </span>
        );
    }
  };

  const getLineColor = (severity: Severity) => {
    if (severity === 'critical') return 'var(--status-critical)';
    if (severity === 'warning') return 'var(--status-warning)';
    return 'var(--status-healthy)';
  };

  return (
    <div id="realtime-sensors-view" className="space-y-6 pb-12 page-transition-enter">
      {/* 1. Top Banner: Primary Conveyor Health Gauge */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[12px] p-[24px] shadow-[var(--shadow-card)]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Circular Health Gauge & Summary */}
          <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
            <div className="relative w-28 h-28 flex items-center justify-center shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="var(--bg-surface-raised)"
                  strokeWidth="8"
                  fill="transparent"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke={
                    overallHealthScore >= 70
                      ? 'var(--status-healthy)'
                      : overallHealthScore >= 40
                      ? 'var(--status-warning)'
                      : 'var(--status-critical)'
                  }
                  strokeWidth="8"
                  strokeDasharray={2 * Math.PI * 40}
                  strokeDashoffset={2 * Math.PI * 40 * (1 - overallHealthScore / 100)}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-700 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[28px] font-bold font-mono tabular-nums text-[var(--text-primary)] leading-none">
                  <AnimatedNumber value={overallHealthScore} decimals={0} />
                </span>
                <span className="text-[10px] uppercase font-semibold text-[var(--text-tertiary)] mt-1 tracking-wider">
                  / 100
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                <h1 className="text-[22px] font-semibold text-[var(--text-primary)] tracking-tight">
                  Telemetry Aggregated Health Index
                </h1>
                {overallHealthScore >= 70 ? (
                  <span className="badge-status-healthy">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-healthy)]" />
                    Optimal State
                  </span>
                ) : overallHealthScore >= 40 ? (
                  <span className="badge-status-warning">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-warning)]" />
                    Degraded State
                  </span>
                ) : (
                  <span className="badge-status-critical">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-critical)]" />
                    Critical State
                  </span>
                )}
              </div>
              <p className="text-[14px] text-[var(--text-secondary)] max-w-xl leading-[1.6]">
                Calibrated across 9 SCADA edge transducers including roller bearings, 3-axis vibration FFT, dynamic motor torque, and belt sag displacement.
              </p>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex items-center gap-6 justify-center lg:justify-end border-t lg:border-t-0 lg:border-l border-[var(--border-subtle)] pt-4 lg:pt-0 lg:pl-8 shrink-0">
            <div>
              <div className="text-[12px] text-[var(--text-tertiary)] font-medium uppercase tracking-[0.06em]">
                Composite Risk
              </div>
              <div className="text-[24px] font-bold font-mono tabular-nums text-[var(--text-primary)] mt-0.5">
                <AnimatedNumber value={sensorRiskScore} decimals={0} />%
              </div>
            </div>
            <div className="w-px h-8 bg-[var(--border-subtle)]" />
            <div>
              <div className="text-[12px] text-[var(--text-tertiary)] font-medium uppercase tracking-[0.06em]">
                Sampling Rate
              </div>
              <div className="text-[24px] font-bold font-mono tabular-nums text-[var(--status-healthy)] mt-0.5">
                1.0 Hz
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Sensor Cards Grid: 3 Columns, 16px Gutters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {SENSOR_METAS.map((meta) => {
          const rawVal = sensorData[meta.key];
          const valNum = Number(rawVal);
          const severity = calculateSensorFactorStatus(meta.key, valNum);
          const Icon = FACTOR_ICONS[meta.key] || Activity;
          const lineColor = getLineColor(severity);

          // Rolling Sparkline buffer (last 25 readings)
          const trendData = history.slice(-25).map((h, i) => ({
            index: i,
            val: h[meta.key] as number,
          }));

          const isCritical = severity === 'critical';
          const isWarning = severity === 'warning';

          return (
            <div
              key={meta.key}
              id={`sensor-card-${meta.key}`}
              className={`industrial-card flex flex-col justify-between ${
                isCritical
                  ? 'border-[rgba(241,54,54,0.6)] ring-1 ring-[rgba(241,54,54,0.3)] animate-breathe-critical'
                  : isWarning
                  ? 'border-[rgba(245,158,11,0.5)] ring-1 ring-[rgba(245,158,11,0.2)] animate-breathe-warning'
                  : ''
              }`}
            >
              <div>
                {/* Header: Icon + Factor Name + Badge */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0 ${
                        isCritical
                          ? 'bg-[var(--status-critical-bg)] text-[var(--status-critical)]'
                          : isWarning
                          ? 'bg-[var(--status-warning-bg)] text-[var(--status-warning)]'
                          : 'bg-[var(--bg-surface-raised)] text-[var(--accent-primary)]'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-[14px] font-semibold text-[var(--text-primary)] leading-tight">
                        {meta.label}
                      </h2>
                      <span className="text-[11px] font-mono text-[var(--text-tertiary)]">
                        {meta.unit}
                      </span>
                    </div>
                  </div>

                  {getBadge(severity)}
                </div>

                {/* Primary Metric Reading with Smooth Number Animation */}
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-[32px] font-bold font-mono tabular-nums text-[var(--text-primary)] tracking-tight">
                    <AnimatedNumber
                      value={valNum}
                      decimals={meta.unit === 'mm/s' || meta.unit === 'sag index' ? 2 : 1}
                    />
                  </span>
                  <span className="text-[13px] text-[var(--text-tertiary)] font-normal">{meta.unit}</span>
                </div>

                {/* Live Sparkline Visual */}
                <div className="h-14 w-full my-1 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData}>
                      <YAxis domain={['auto', 'auto']} hide />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--bg-surface-raised)',
                          borderColor: 'var(--border-subtle)',
                          borderRadius: '6px',
                          fontSize: '11px',
                          color: 'var(--text-primary)',
                        }}
                        labelFormatter={() => ''}
                        formatter={(value) => [`${Number(value).toFixed(2)} ${meta.unit}`, meta.label]}
                      />
                      <Line
                        type="monotone"
                        dataKey="val"
                        stroke={lineColor}
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Threshold Footer */}
              <div className="pt-2.5 border-t border-[var(--border-subtle)] flex items-center justify-between text-[12px] text-[var(--text-tertiary)] mt-2">
                <span>Norm: {meta.normalRange}</span>
                <span className="font-mono text-[11px] text-[var(--text-disabled)]">
                  {meta.criticalRange}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

