import React from 'react';
import { Flame, AlertTriangle, X, ArrowRight } from 'lucide-react';
import { AlertItem, PageId } from '../types';

export interface ToastAlert extends AlertItem {
  toastId: string;
}

interface AlertToastContainerProps {
  toasts: ToastAlert[];
  onDismiss: (toastId: string) => void;
  onNavigateToAlerts: () => void;
}

export const AlertToastContainer: React.FC<AlertToastContainerProps> = ({
  toasts,
  onDismiss,
  onNavigateToAlerts,
}) => {
  if (toasts.length === 0) return null;

  return (
    <div
      id="alert-toast-container"
      className="fixed top-16 right-6 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
    >
      {toasts.map((toast) => {
        const isCrit = toast.severity === 'Critical';
        return (
          <div
            key={toast.toastId}
            className={`pointer-events-auto rounded-[8px] p-3.5 shadow-[var(--shadow-overlay)] border backdrop-blur-md transition-all duration-300 animate-in slide-in-from-right-8 fade-in ${
              isCrit
                ? 'bg-[#150a0e]/95 border-[rgba(241,54,54,0.4)] text-[var(--text-primary)] animate-breathe-critical'
                : 'bg-[#15120a]/95 border-[rgba(245,158,11,0.4)] text-[var(--text-primary)] animate-breathe-warning'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-6 h-6 rounded-[4px] flex items-center justify-center shrink-0 ${
                    isCrit ? 'bg-[rgba(241,54,54,0.2)] text-[var(--status-critical)]' : 'bg-[rgba(245,158,11,0.2)] text-[var(--status-warning)]'
                  }`}
                >
                  {isCrit ? <Flame className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-[0.06em] px-1.5 py-0.5 rounded-[3px] font-mono ${
                        isCrit ? 'badge-status-critical' : 'badge-status-warning'
                      }`}
                    >
                      {toast.severity} Alert
                    </span>
                    <span className="text-[11px] text-[var(--text-tertiary)] font-mono">{toast.timestamp}</span>
                  </div>
                  <h4 className="text-[12px] font-semibold text-[var(--text-primary)] mt-0.5">{toast.component}</h4>
                </div>
              </div>

              <button
                onClick={() => onDismiss(toast.toastId)}
                className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] p-1 rounded-[4px] hover:bg-[var(--bg-surface-raised)] transition-colors"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-[11px] text-[var(--text-secondary)] mt-1.5 leading-[1.5]">
              <strong className="text-[var(--text-primary)]">{toast.factor}:</strong> Value{' '}
              <span className="font-mono font-semibold text-[var(--text-primary)] tabular-nums">{toast.value}</span> exceeded{' '}
              <span className="font-mono text-[var(--text-tertiary)] tabular-nums">{toast.threshold}</span>.
            </p>

            <div className="mt-2.5 pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px]">
              <span className="text-[11px] text-[var(--text-tertiary)] truncate max-w-[200px]">
                {toast.recommendation}
              </span>
              <button
                onClick={onNavigateToAlerts}
                className="inline-flex items-center gap-1 text-[var(--accent-primary)] hover:underline font-semibold text-[11px] transition-colors shrink-0"
              >
                <span>View</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
