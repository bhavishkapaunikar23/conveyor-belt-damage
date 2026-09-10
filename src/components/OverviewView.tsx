import React from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  Clock,
  Layers,
  ArrowUpRight,
  TrendingDown,
  Gauge,
  Eye,
  Cpu,
  Zap,
} from 'lucide-react';
import { SensorData, CombinedPrediction, PageId, ActivityEvent } from '../types';
import { CONVEYORS } from './Sidebar';
import { LiveActivityFeed } from './LiveActivityFeed';
import { AnimatedNumber } from './AnimatedNumber';

interface OverviewViewProps {
  sensorData: SensorData;
  prediction: CombinedPrediction;
  activeAlertCount: number;
  overallHealthScore: number;
  onNavigate: (page: PageId) => void;
  selectedConveyor: string;
  activityEvents?: ActivityEvent[];
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  sensorData,
  prediction,
  activeAlertCount,
  overallHealthScore,
  onNavigate,
  selectedConveyor,
  activityEvents = [],
}) => {
  const healthyCount = prediction.status === 'Healthy' ? 3 : 2;
  const criticalCount = prediction.status === 'Critical' ? 1 : 0;

  return (
    <div id="overview-view" className="space-y-6 pb-12 page-transition-enter">
      {/* 1. Header Banner */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[12px] p-[24px] shadow-[var(--shadow-card)] flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-[6px] bg-[var(--accent-primary-muted)] text-[var(--accent-primary)] text-[12px] font-semibold tracking-wide">
            <Zap className="w-3.5 h-3.5 fill-[var(--accent-primary)]" />
            <span>Autonomous Overland Conveyance APM</span>
          </div>

          <h1 className="text-[28px] font-semibold text-[var(--text-primary)] tracking-[-0.02em] leading-tight">
            Predictive Belt Rupture Prevention &amp; Joint Health Surveillance
          </h1>

          <p className="text-[14px] text-[var(--text-secondary)] leading-[1.6]">
            Real-time sensory telemetry fusion across 9 critical mechanical parameters, 60fps high-speed line-scan optical defect classification, and live physics-based digital twin taking action before catastrophic failure.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            onClick={() => onNavigate('digital-twin')}
            className="btn-primary"
          >
            <Cpu className="w-4 h-4" />
            <span>Open Digital Twin</span>
          </button>
          <button
            onClick={() => onNavigate('realtime')}
            className="btn-secondary"
          >
            <Gauge className="w-4 h-4" />
            <span>Inspect Telemetry</span>
          </button>
          <button
            onClick={() => onNavigate('camera')}
            className="btn-secondary"
          >
            <Eye className="w-4 h-4" />
            <span>Camera Feed</span>
          </button>
        </div>
      </div>

      {/* 2. Key Metrics Row: 12-Column Grid (4 Cards, 3 Columns Each) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4">
        {/* Metric 1: Total Lines (span 3) */}
        <div className="industrial-card lg:col-span-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-[12px] font-medium text-[var(--text-tertiary)] uppercase tracking-[0.06em] mb-2">
              <span>Fleet Network</span>
              <Layers className="w-4 h-4 text-[var(--accent-primary)]" />
            </div>
            <div className="text-[32px] font-bold font-mono tabular-nums text-[var(--text-primary)] mb-1">
              4 Lines
            </div>
          </div>
          <div className="flex items-center justify-between text-[12px] text-[var(--text-secondary)] pt-3 border-t border-[var(--border-subtle)] mt-2">
            <span>7.95 km total</span>
            <span className="text-[var(--status-healthy)] font-medium">100% Operational</span>
          </div>
        </div>

        {/* Metric 2: Active Alerts (span 3) */}
        <div
          onClick={() => onNavigate('alerts')}
          className="industrial-card lg:col-span-3 flex flex-col justify-between cursor-pointer group"
        >
          <div>
            <div className="flex items-center justify-between text-[12px] font-medium text-[var(--text-tertiary)] uppercase tracking-[0.06em] mb-2">
              <span>Active Alerts</span>
              <AlertTriangle className="w-4 h-4 text-[var(--status-warning)]" />
            </div>
            <div
              className={`text-[32px] font-bold font-mono tabular-nums mb-1 ${
                activeAlertCount > 0 ? 'text-[var(--status-warning)]' : 'text-[var(--text-primary)]'
              }`}
            >
              <AnimatedNumber value={activeAlertCount} decimals={0} />
            </div>
          </div>
          <div className="flex items-center justify-between text-[12px] text-[var(--text-secondary)] pt-3 border-t border-[var(--border-subtle)] mt-2">
            <span className={criticalCount > 0 ? 'text-[var(--status-critical)] font-semibold' : 'text-[var(--text-tertiary)]'}>
              {criticalCount} Critical
            </span>
            <span className="text-[var(--accent-primary)] font-medium flex items-center gap-1 group-hover:underline">
              Inspect <ArrowUpRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>

        {/* Metric 3: Fleet Uptime (span 3) */}
        <div className="industrial-card lg:col-span-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-[12px] font-medium text-[var(--text-tertiary)] uppercase tracking-[0.06em] mb-2">
              <span>Operational Availability</span>
              <Clock className="w-4 h-4 text-[var(--status-healthy)]" />
            </div>
            <div className="text-[32px] font-bold font-mono tabular-nums text-[var(--status-healthy)] mb-1">
              99.4%
            </div>
          </div>
          <div className="flex items-center justify-between text-[12px] text-[var(--text-secondary)] pt-3 border-t border-[var(--border-subtle)] mt-2">
            <span>MTBF 340h</span>
            <span className="text-[var(--status-healthy)] font-medium">+0.8% MoM</span>
          </div>
        </div>

        {/* Metric 4: Belt Health Index (span 3) */}
        <div className="industrial-card lg:col-span-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-[12px] font-medium text-[var(--text-tertiary)] uppercase tracking-[0.06em] mb-2">
              <span>Belt Health Score</span>
              <ShieldCheck className="w-4 h-4 text-[var(--accent-primary)]" />
            </div>
            <div className="text-[32px] font-bold font-mono tabular-nums text-[var(--text-primary)] mb-1 flex items-baseline">
              <AnimatedNumber value={overallHealthScore} decimals={0} />
              <span className="text-[18px] text-[var(--text-tertiary)] font-normal ml-1">/100</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-[12px] text-[var(--text-secondary)] pt-3 border-t border-[var(--border-subtle)] mt-2">
            <span>{healthyCount} Lines Nominal</span>
            <span
              className={`font-semibold ${
                overallHealthScore >= 70
                  ? 'text-[var(--status-healthy)]'
                  : overallHealthScore >= 40
                  ? 'text-[var(--status-warning)]'
                  : 'text-[var(--status-critical)]'
              }`}
            >
              {overallHealthScore >= 70 ? 'Healthy' : overallHealthScore >= 40 ? 'Warning' : 'Critical'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Fleet Matrix Table (56px row height, sticky header, status badges, monospace numbers) */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[12px] shadow-[var(--shadow-card)] overflow-hidden">
        <div className="p-[20px] border-b border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-semibold text-[var(--text-secondary)] uppercase tracking-[0.04em]">
              Fleet Conveyor Operational Matrix
            </h2>
            <p className="text-[13px] text-[var(--text-tertiary)] mt-0.5">
              Live telemetry and edge AI health status across primary Pilbara conveyor segments
            </p>
          </div>
          <div className="px-3 py-1 rounded-[6px] bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-secondary)] font-mono self-start sm:self-auto">
            Focus: <span className="text-[var(--accent-primary)] font-semibold">{selectedConveyor}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[14px]">
            <thead>
              <tr className="bg-[var(--bg-surface-raised)] border-b border-[var(--border-subtle)] text-[12px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em]">
                <th className="py-3 px-5">Conveyor Line</th>
                <th className="py-3 px-4 text-right">Length</th>
                <th className="py-3 px-4 text-right">Capacity</th>
                <th className="py-3 px-4 text-right">Belt Speed</th>
                <th className="py-3 px-4 text-right">Drive Temp</th>
                <th className="py-3 px-4 text-right">Vibration</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] text-[var(--text-secondary)]">
              {CONVEYORS.map((c) => {
                const isSelected = c.id === selectedConveyor;
                const status = isSelected ? prediction.status : c.id === 'CV-102' ? 'Warning' : 'Healthy';
                const speed = isSelected ? sensorData.belt_speed : 4.2;
                const temp = isSelected ? sensorData.temperature : 49.5;
                const vib = isSelected ? sensorData.vibration : 1.35;

                return (
                  <tr
                    key={c.id}
                    className={`h-[56px] hover:bg-[var(--bg-surface-raised)] transition-colors duration-150 ${
                      isSelected ? 'bg-[rgba(245,165,36,0.04)]' : ''
                    }`}
                  >
                    <td className="py-3 px-5">
                      <div className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
                        <span>{c.name}</span>
                        {isSelected && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-[4px] bg-[var(--accent-primary-muted)] text-[var(--accent-primary)] border border-[rgba(245,165,36,0.25)] font-mono font-medium">
                            Active Focus
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-right text-[var(--text-tertiary)]">
                      {c.length}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-right text-[var(--text-tertiary)]">
                      {c.capacity}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-right text-[var(--text-primary)]">
                      {speed.toFixed(2)} m/s
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-right">
                      <span className={temp > 60 ? 'text-[var(--status-warning)] font-semibold' : 'text-[var(--text-secondary)]'}>
                        {temp.toFixed(1)} °C
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-right">
                      <span className={vib > 2 ? 'text-[var(--status-warning)] font-semibold' : 'text-[var(--text-secondary)]'}>
                        {vib.toFixed(2)} mm/s
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {status === 'Healthy' ? (
                        <span className="badge-status-healthy">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-healthy)]" />
                          Healthy
                        </span>
                      ) : status === 'Warning' ? (
                        <span className="badge-status-warning">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-warning)]" />
                          Warning
                        </span>
                      ) : (
                        <span className="badge-status-critical">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-critical)]" />
                          Critical
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-5 text-right">
                      <button
                        onClick={() => onNavigate('digital-twin')}
                        className="btn-secondary py-1 px-2.5 text-[12px] h-[30px] rounded-[6px]"
                      >
                        Inspect Twin
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Live Activity Feed Stream */}
      <LiveActivityFeed events={activityEvents} maxHeight="max-h-72" />

      {/* 5. Operational Highlights (3-Column Layout with design tokens) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="industrial-card space-y-2.5">
          <div className="w-9 h-9 rounded-[8px] bg-[var(--status-healthy-bg)] text-[var(--status-healthy)] flex items-center justify-center">
            <TrendingDown className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[12px] uppercase font-medium tracking-[0.06em] text-[var(--text-tertiary)]">
              Downtime Mitigated
            </div>
            <div className="text-[22px] font-bold font-mono tabular-nums text-[var(--text-primary)] mt-0.5">
              18.4 Hours
            </div>
          </div>
          <p className="text-[13px] text-[var(--text-secondary)] leading-[1.6]">
            Early detection of joint splice micro-tears and bearing cage spalling prevented 3 major overland halts this quarter.
          </p>
        </div>

        <div className="industrial-card space-y-2.5">
          <div className="w-9 h-9 rounded-[8px] bg-[var(--accent-primary-muted)] text-[var(--accent-primary)] flex items-center justify-center">
            <Eye className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[12px] uppercase font-medium tracking-[0.06em] text-[var(--text-tertiary)]">
              Line-Scan AI Passes
            </div>
            <div className="text-[22px] font-bold font-mono tabular-nums text-[var(--text-primary)] mt-0.5">
              43,200 / Day
            </div>
          </div>
          <p className="text-[13px] text-[var(--text-secondary)] leading-[1.6]">
            High-speed vision processing with sub-millimeter longitudinal tear segmentation at 4.20 m/s continuous belt speed.
          </p>
        </div>

        <div className="industrial-card space-y-2.5">
          <div className="w-9 h-9 rounded-[8px] bg-[rgba(56,189,248,0.12)] text-[#38BDF8] flex items-center justify-center">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[12px] uppercase font-medium tracking-[0.06em] text-[var(--text-tertiary)]">
              Digital Twin Synchronization
            </div>
            <div className="text-[22px] font-bold font-mono tabular-nums text-[var(--text-primary)] mt-0.5">
              Real-Time Kinematics
            </div>
          </div>
          <p className="text-[13px] text-[var(--text-secondary)] leading-[1.6]">
            Synchronized physics model calculating sag tension, pulley wrap angle slip margin, and ore load distribution.
          </p>
        </div>
      </div>
    </div>
  );
};

