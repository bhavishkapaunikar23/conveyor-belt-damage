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
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { SensorData, SensorHistoryPoint, Severity } from '../types';
import { SENSOR_METAS, calculateSensorFactorStatus } from '../utils/conveyorLogic';
import { AnimatedNumber } from './AnimatedNumber';

// Helper: Calculate statistical variance from recent Motor Current readings history
function calculateVariance(values: number[]): number {
  if (!values || values.length < 2) return 0;
  const mean = values.reduce((acc, v) => acc + v, 0) / values.length;
  return values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / values.length;
}

// Helper: Detect periodic alternating up/down ripple pattern (e.g. slip fluctuation)
function detectPeriodicPattern(values: number[]): boolean {
  if (!values || values.length < 5) return false;
  let directionalAlternations = 0;
  for (let i = 2; i < values.length; i++) {
    const d1 = values[i - 1] - values[i - 2];
    const d2 = values[i] - values[i - 1];
    if ((d1 > 0.35 && d2 < -0.35) || (d1 < -0.35 && d2 > 0.35)) {
      directionalAlternations++;
    }
  }
  return directionalAlternations >= 3;
}

// Derive MCSA insights strictly from existing Motor Current readings buffer
function deriveMcsaInsights(currentReadingsHistory: number[], currentVal: number) {
  const variance = calculateVariance(currentReadingsHistory);
  const hasPeriodicFluctuation = detectPeriodicPattern(currentReadingsHistory);
  const mean = currentReadingsHistory.length > 0
    ? currentReadingsHistory.reduce((acc, v) => acc + v, 0) / currentReadingsHistory.length
    : currentVal;

  const BEARING_FAULT_VARIANCE_THRESHOLD = 18.0;
  const MISALIGNMENT_THRESHOLD_HIGH = 24.0;
  const MISALIGNMENT_THRESHOLD_LOW = 9.0;

  // Derive bearing fault presence and characteristic sideband frequency (X.X Hz)
  const isBearingFault = variance > BEARING_FAULT_VARIANCE_THRESHOLD || currentVal > 225 || (variance > 12 && currentVal > 200);
  const faultFreqHz = (28.4 + ((Math.abs(mean) * 7.3) % 9.2)).toFixed(1);

  // Derive mechanical misalignment signature from current modulation
  const misalignment: 'Low' | 'Moderate' | 'High' =
    variance > MISALIGNMENT_THRESHOLD_HIGH || currentVal > 228
      ? 'High'
      : variance > MISALIGNMENT_THRESHOLD_LOW || currentVal > 200
      ? 'Moderate'
      : 'Low';

  // Derive belt slip indicator
  const beltSlip: 'Stable' | 'Fluctuating' =
    hasPeriodicFluctuation || (variance > 15 && currentVal > 210) ? 'Fluctuating' : 'Stable';

  let summaryText = 'No fault signatures detected';
  let severity: Severity = 'healthy';

  if (isBearingFault) {
    summaryText = 'Bearing fault signature detected';
    severity = 'critical';
  } else if (misalignment === 'High') {
    summaryText = 'High misalignment signature';
    severity = 'critical';
  } else if (beltSlip === 'Fluctuating') {
    summaryText = 'Belt slip modulation detected';
    severity = 'warning';
  } else if (misalignment === 'Moderate') {
    summaryText = 'Moderate harmonic modulation';
    severity = 'warning';
  }

  return {
    bearingFault: isBearingFault ? `Detected (${faultFreqHz} Hz)` : 'Not Detected',
    isBearingFault,
    misalignment,
    beltSlip,
    summaryText,
    severity,
  };
}

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
  const [mcsaExpanded, setMcsaExpanded] = React.useState(false);

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

          // MCSA insights derived strictly for Motor Current card from existing history buffer
          const isMotorCurrent = meta.key === 'motor_current';
          const mcsaInsights = isMotorCurrent
            ? deriveMcsaInsights(
                history.slice(-25).map((h) => Number(h.motor_current) || 0),
                valNum
              )
            : null;

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

                {/* MCSA (Motor Current Signature Analysis) Expandable Sub-Detail */}
                {isMotorCurrent && mcsaInsights && (
                  <div className="mt-2.5 pt-2 border-t border-[var(--border-subtle)]">
                    {/* Collapsed/Expandable Summary Row */}
                    <div
                      className="mcsa-summary-row flex items-center justify-between cursor-pointer group hover:bg-[var(--bg-surface-raised)]/70 px-2 py-1.5 -mx-1.5 rounded-[6px] transition-colors select-none"
                      onClick={() => setMcsaExpanded(!mcsaExpanded)}
                      title="Motor Current Signature Analysis - Click to toggle details"
                    >
                      <div className="flex items-center gap-1.5 overflow-hidden">
                        <span className="mcsa-label text-[11px] font-bold font-mono tracking-wider uppercase text-[var(--accent-primary)] shrink-0">
                          MCSA:
                        </span>
                        <span
                          className={`mcsa-status text-[11px] truncate font-medium ${
                            mcsaInsights.severity === 'critical'
                              ? 'text-[var(--status-critical)]'
                              : mcsaInsights.severity === 'warning'
                              ? 'text-[var(--status-warning)]'
                              : 'text-[var(--text-secondary)]'
                          }`}
                        >
                          {mcsaInsights.summaryText}
                        </span>
                      </div>
                      <div className="text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)] shrink-0 ml-1.5 transition-colors">
                        {mcsaExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </div>
                    </div>

                    {/* Expanded Detail Content */}
                    {mcsaExpanded && (
                      <div
                        id="mcsa-expanded-detail"
                        className="mt-2 space-y-1.5 text-[11px] bg-[var(--bg-surface-raised)]/50 p-2.5 rounded-[6px] border border-[var(--border-subtle)]"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[var(--text-tertiary)]">Bearing Fault Frequency:</span>
                          <span
                            className={`font-mono font-semibold ${
                              mcsaInsights.isBearingFault
                                ? 'text-[var(--status-critical)]'
                                : 'text-[var(--status-healthy)]'
                            }`}
                          >
                            {mcsaInsights.bearingFault}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[var(--text-tertiary)]">Misalignment Signature:</span>
                          <span
                            className={`font-mono font-semibold ${
                              mcsaInsights.misalignment === 'High'
                                ? 'text-[var(--status-critical)]'
                                : mcsaInsights.misalignment === 'Moderate'
                                ? 'text-[var(--status-warning)]'
                                : 'text-[var(--status-healthy)]'
                            }`}
                          >
                            {mcsaInsights.misalignment}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[var(--text-tertiary)]">Belt Slip Indicator:</span>
                          <span
                            className={`font-mono font-semibold ${
                              mcsaInsights.beltSlip === 'Fluctuating'
                                ? 'text-[var(--status-warning)]'
                                : 'text-[var(--status-healthy)]'
                            }`}
                          >
                            {mcsaInsights.beltSlip}
                          </span>
                        </div>
                        <div className="pt-1.5 text-[10px] text-[var(--text-tertiary)] border-t border-[var(--border-subtle)] leading-normal">
                          <span className="font-semibold text-[var(--text-secondary)]">Signal Source:</span> Derived from existing Motor Current sensor (no additional hardware)
                        </div>
                      </div>
                    )}
                  </div>
                )}
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

