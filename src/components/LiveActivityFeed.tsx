import React from 'react';
import {
  Activity,
  Radio,
  Camera,
  Cpu,
  TrendingUp,
} from 'lucide-react';
import { ActivityEvent } from '../types';

interface LiveActivityFeedProps {
  events: ActivityEvent[];
  maxHeight?: string;
}

export const LiveActivityFeed: React.FC<LiveActivityFeedProps> = ({
  events,
  maxHeight = 'max-h-80',
}) => {
  const getSourceIcon = (source: ActivityEvent['source']) => {
    switch (source) {
      case 'Sensor':
        return <Radio className="w-3.5 h-3.5 text-[var(--accent-primary)]" />;
      case 'Camera':
        return <Camera className="w-3.5 h-3.5 text-[#38BDF8]" />;
      case 'Twin':
        return <Cpu className="w-3.5 h-3.5 text-[#A855F7]" />;
      case 'Prediction':
        return <TrendingUp className="w-3.5 h-3.5 text-[var(--status-healthy)]" />;
      default:
        return <Activity className="w-3.5 h-3.5 text-[var(--accent-primary)]" />;
    }
  };

  const getLevelBadge = (level: ActivityEvent['level']) => {
    switch (level) {
      case 'critical':
        return (
          <span className="badge-status-critical text-[10px] h-[20px] px-2 py-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-critical)]" />
            CRIT
          </span>
        );
      case 'warning':
        return (
          <span className="badge-status-warning text-[10px] h-[20px] px-2 py-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-warning)]" />
            WARN
          </span>
        );
      case 'success':
        return (
          <span className="badge-status-healthy text-[10px] h-[20px] px-2 py-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-healthy)]" />
            OK
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-[6px] bg-[rgba(255,255,255,0.06)] text-[var(--text-secondary)] border border-[var(--border-subtle)] font-mono">
            INFO
          </span>
        );
    }
  };

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[12px] p-[20px] shadow-[var(--shadow-card)] space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-[var(--status-healthy)] animate-soft-pulse shrink-0" />
          <h3 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)] flex items-center gap-2">
            <span>Live Activity &amp; Ingestion Stream</span>
          </h3>
        </div>
        <span className="text-[12px] font-mono text-[var(--text-tertiary)]">
          Buffer: {events.length} records
        </span>
      </div>

      {/* Scrolling Events Feed */}
      <div
        className={`${maxHeight} overflow-y-auto space-y-2 pr-1 divide-y divide-[var(--border-subtle)]`}
      >
        {events.length === 0 ? (
          <div className="text-center py-8 text-[13px] text-[var(--text-tertiary)]">
            Awaiting real-time telemetry events...
          </div>
        ) : (
          events.map((event, idx) => (
            <div
              key={event.id}
              className={`pt-2.5 pb-1 flex items-start gap-3 text-[13px] transition-all duration-300 ${
                idx === 0 ? 'page-transition-enter' : ''
              }`}
            >
              {/* Source Icon */}
              <div className="p-1.5 rounded-[6px] bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)] shrink-0 mt-0.5">
                {getSourceIcon(event.source)}
              </div>

              {/* Event Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[11px] text-[var(--text-tertiary)] font-normal">
                    {event.timestamp}
                  </span>
                  <span className="text-[var(--text-disabled)]">•</span>
                  <span className="font-medium text-[var(--text-primary)] text-[12px]">{event.source}</span>
                  {getLevelBadge(event.level)}
                </div>
                <p className="text-[13px] text-[var(--text-secondary)] mt-1 leading-[1.5] break-words">
                  {event.message}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

