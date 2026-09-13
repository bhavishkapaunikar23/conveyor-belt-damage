import React from 'react';
import {
  X,
  Cpu,
  AlertTriangle,
  CheckCircle2,
  Flame,
  Activity,
  Camera,
  Wrench,
  Clock,
} from 'lucide-react';
import { SelectedTwinComponent } from './DigitalTwinView';

interface ComponentDetailModalProps {
  component: SelectedTwinComponent | null;
  onClose: () => void;
}

export const ComponentDetailModal: React.FC<ComponentDetailModalProps> = ({
  component,
  onClose,
}) => {
  if (!component) return null;

  const isCrit = component.status === 'critical';
  const isWarn = component.status === 'warning';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        id="component-detail-modal"
        className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] max-w-xl w-full rounded-[12px] p-6 shadow-[var(--shadow-overlay)] space-y-5 animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-[8px] flex items-center justify-center shrink-0 ${
                isCrit
                  ? 'bg-[rgba(241,54,54,0.15)] text-[var(--status-critical)] border border-[rgba(241,54,54,0.25)]'
                  : isWarn
                  ? 'bg-[rgba(245,158,11,0.15)] text-[var(--status-warning)] border border-[rgba(245,158,11,0.25)]'
                  : 'bg-[rgba(16,185,129,0.15)] text-[var(--status-healthy)] border border-[rgba(16,185,129,0.25)]'
              }`}
            >
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 font-mono">
                <span className="text-[11px] uppercase tracking-[0.06em] text-[var(--accent-primary)] font-semibold">
                  {component.id}
                </span>
                <span className="text-[var(--text-disabled)]">•</span>
                <span className="text-[11px] text-[var(--text-tertiary)]">{component.type}</span>
              </div>
              <h2 className="text-[15px] font-semibold text-[var(--text-primary)] mt-0.5">{component.name}</h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-[6px] bg-[var(--bg-surface-raised)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Health Score & Status Badge */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[var(--bg-surface-raised)] p-3.5 rounded-[8px] border border-[var(--border-subtle)]">
            <div className="text-[11px] uppercase font-semibold text-[var(--text-tertiary)]">Integrity Health Score</div>
            <div className="flex items-baseline gap-2 mt-1">
              <span
                className={`text-[28px] font-semibold font-mono tabular-nums leading-none ${
                  isCrit ? 'text-[var(--status-critical)]' : isWarn ? 'text-[var(--status-warning)]' : 'text-[var(--status-healthy)]'
                }`}
              >
                {component.healthScore}
              </span>
              <span className="text-[12px] text-[var(--text-tertiary)] font-mono">/ 100</span>
            </div>
          </div>

          <div className="bg-[var(--bg-surface-raised)] p-3.5 rounded-[8px] border border-[var(--border-subtle)] flex flex-col justify-between">
            <div className="text-[11px] uppercase font-semibold text-[var(--text-tertiary)]">Operational Condition</div>
            <div className="mt-1">
              <span
                className={
                  isCrit
                    ? 'badge-status-critical'
                    : isWarn
                    ? 'badge-status-warning'
                    : 'badge-status-healthy'
                }
              >
                {isCrit ? (
                  <Flame className="w-3.5 h-3.5" />
                ) : isWarn ? (
                  <AlertTriangle className="w-3.5 h-3.5" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                {component.status.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Live Sensor Telemetry Table */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-[12px] font-semibold text-[var(--text-primary)]">
            <Activity className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span>Active Linked Sensor Readouts:</span>
          </div>
          <div className="grid grid-cols-2 gap-2 bg-[var(--bg-surface-raised)] p-3 rounded-[8px] border border-[var(--border-subtle)] text-[11px]">
            {Object.entries(component.readings).map(([key, val]) => (
              <div key={key} className="flex justify-between py-1 border-b border-[var(--border-subtle)] last:border-0">
                <span className="text-[var(--text-tertiary)]">{key}:</span>
                <span className="font-mono font-semibold text-[var(--text-primary)] tabular-nums">{val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Optical Camera Inspection Status & Captured Frame Snapshot */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[12px] font-semibold text-[var(--text-primary)]">
            <div className="flex items-center gap-2">
              <Camera className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>Computer Vision Surface Inspection:</span>
            </div>
            {component.cameraDefectType && component.cameraDefectType !== 'Normal' && (
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                  component.cameraDefectType === 'Material Spillage'
                    ? 'bg-orange-950/80 text-orange-400 border border-orange-500/40'
                    : component.cameraDefectType === 'Crack/Tear'
                    ? 'bg-red-950/80 text-red-400 border border-red-500/40'
                    : 'bg-amber-950/80 text-amber-400 border border-amber-500/40'
                }`}
              >
                {component.cameraDefectType} ({component.cameraConfidence}%)
              </span>
            )}
          </div>
          <div className="bg-[var(--bg-surface-raised)] p-3 rounded-[8px] border border-[var(--border-subtle)] text-[12px] text-[var(--text-secondary)] leading-[1.5] space-y-2">
            <div>{component.cameraStatus}</div>
            {component.cameraSnapshotUrl && (
              <div className="mt-2 pt-2 border-t border-[var(--border-subtle)] space-y-1">
                <div className="text-[11px] font-mono text-[var(--text-tertiary)] flex items-center justify-between">
                  <span>Captured Frame Snapshot at Detection Moment:</span>
                  <span className="text-[var(--accent-primary)]">{component.cameraLocation || 'Joint 1'}</span>
                </div>
                <div className="relative aspect-video max-h-48 w-full bg-black rounded-[6px] overflow-hidden border border-white/10">
                  <img
                    src={component.cameraSnapshotUrl}
                    alt="Captured inspection frame"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded bg-black/80 font-mono text-[10px] text-white">
                    Optical Snapshot
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recommendation Text */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-[12px] font-semibold text-[var(--text-primary)]">
            <Wrench className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span>Prescriptive Recommendation:</span>
          </div>
          <div
            className={`p-3 rounded-[8px] border text-[12px] leading-[1.5] ${
              isCrit
                ? 'bg-[rgba(241,54,54,0.1)] border-[rgba(241,54,54,0.3)] text-red-200'
                : isWarn
                ? 'bg-[rgba(245,158,11,0.1)] border-[rgba(245,158,11,0.3)] text-amber-200'
                : 'bg-[rgba(16,185,129,0.1)] border-[rgba(16,185,129,0.3)] text-emerald-200'
            }`}
          >
            {component.recommendation}
          </div>
        </div>

        {/* Service Metadata Footer */}
        <div className="pt-2.5 border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px] text-[var(--text-tertiary)] font-mono">
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[var(--text-disabled)]" />
            Last service: {component.lastService}
          </span>
          <span>Duty: {component.cycles}</span>
        </div>

        {/* Close Button */}
        <div className="flex justify-end pt-1">
          <button
            onClick={onClose}
            className="btn-primary h-[34px] text-[12px]"
          >
            Dismiss Dossier
          </button>
        </div>
      </div>
    </div>
  );
};
