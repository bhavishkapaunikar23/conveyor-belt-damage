import React, { useState } from 'react';
import {
  Bell,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Download,
  Search,
  Check,
} from 'lucide-react';
import { AlertItem } from '../types';

interface AlertsViewProps {
  alerts: AlertItem[];
  onAcknowledgeAlert: (id: string) => void;
  onResolveAlert: (id: string) => void;
}

export const AlertsView: React.FC<AlertsViewProps> = ({
  alerts,
  onAcknowledgeAlert,
  onResolveAlert,
}) => {
  const [severityFilter, setSeverityFilter] = useState<'All' | 'Critical' | 'Warning'>('All');
  const [componentFilter, setComponentFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const componentsList = Array.from(new Set(alerts.map((a) => a.component)));

  const filteredAlerts = alerts.filter((alert) => {
    if (severityFilter !== 'All' && alert.severity !== severityFilter) return false;
    if (componentFilter !== 'All' && alert.component !== componentFilter) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const match =
        alert.component.toLowerCase().includes(q) ||
        alert.factor.toLowerCase().includes(q) ||
        alert.recommendation.toLowerCase().includes(q) ||
        alert.id.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const handleExportCSV = () => {
    const headers = 'Alert ID,Timestamp,Severity,Component,Factor,Trigger Value,Threshold,Status,Recommendation\n';
    const rows = filteredAlerts
      .map(
        (a) =>
          `"${a.id}","${a.timestamp}","${a.severity}","${a.component}","${a.factor}","${a.value}","${a.threshold}","${a.status}","${a.recommendation.replace(/"/g, '""')}"`
      )
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `conveyor-alerts-export-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="alerts-view" className="space-y-6 pb-12 page-transition-enter">
      {/* 1. Header Banner */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[12px] p-[24px] shadow-[var(--shadow-card)] flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-[6px] bg-[var(--accent-primary-muted)] text-[var(--accent-primary)] flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--accent-primary)] font-mono">
              Alerts &amp; Incident Registry
            </span>
          </div>
          <h1 className="text-[20px] font-semibold text-[var(--text-primary)] tracking-tight">
            Safety Interlocks &amp; Real-Time Alarm Journal
          </h1>
          <p className="text-[13px] text-[var(--text-secondary)] max-w-2xl leading-[1.6]">
            Active operational trip events and statistical threshold breaches streamed across 9 SCADA sensor transducers and high-speed computer vision.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="btn-secondary h-[36px] flex items-center gap-2 self-start md:self-auto shrink-0"
        >
          <Download className="w-4 h-4 text-[var(--accent-primary)]" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* 2. Filter and Search Bar */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[8px] p-4 shadow-[var(--shadow-card)] flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Severity Filter */}
          <div className="flex items-center gap-1 bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)] rounded-[6px] p-1">
            <button
              onClick={() => setSeverityFilter('All')}
              className={`px-3 py-1 rounded-[4px] text-[12px] font-medium transition-colors ${
                severityFilter === 'All' ? 'bg-[var(--accent-primary)] text-[#0A0E14] font-semibold' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              All ({alerts.length})
            </button>
            <button
              onClick={() => setSeverityFilter('Critical')}
              className={`px-3 py-1 rounded-[4px] text-[12px] font-medium flex items-center gap-1.5 transition-colors ${
                severityFilter === 'Critical'
                  ? 'bg-[var(--status-critical)] text-white font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--status-critical)]'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              Critical ({alerts.filter((a) => a.severity === 'Critical').length})
            </button>
            <button
              onClick={() => setSeverityFilter('Warning')}
              className={`px-3 py-1 rounded-[4px] text-[12px] font-medium flex items-center gap-1.5 transition-colors ${
                severityFilter === 'Warning'
                  ? 'bg-[var(--status-warning)] text-[#0A0E14] font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--status-warning)]'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Warning ({alerts.filter((a) => a.severity === 'Warning').length})
            </button>
          </div>

          {/* Component Dropdown */}
          <select
            value={componentFilter}
            onChange={(e) => setComponentFilter(e.target.value)}
            className="text-[12px] bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)] text-[var(--text-primary)] rounded-[6px] px-3 py-1.5 focus:outline-none focus:border-[var(--accent-primary)]"
          >
            <option value="All">All Components ({componentsList.length})</option>
            {componentsList.map((comp) => (
              <option key={comp} value={comp}>
                {comp}
              </option>
            ))}
          </select>
        </div>

        {/* Search Field */}
        <div className="relative w-full md:w-72">
          <Search className="w-3.5 h-3.5 text-[var(--text-tertiary)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search alerts or recommendations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-[12px] bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)] rounded-[6px] pl-8 pr-3 py-1.5 text-[var(--text-primary)] placeholder-[var(--text-disabled)] focus:outline-none focus:border-[var(--accent-primary)]"
          />
        </div>
      </div>

      {/* 3. Chronological Alert Cards List */}
      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <div className="industrial-card p-12 text-center text-[var(--text-tertiary)] text-[13px]">
            No active alerts matching current filter parameters.
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const isCrit = alert.severity === 'Critical';
            return (
              <div
                key={alert.id}
                id={`alert-card-${alert.id}`}
                className={`industrial-card p-4 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                  isCrit ? 'border-[rgba(241,54,54,0.4)]' : ''
                }`}
              >
                {/* Left Col: Badge, Component, Factor, Value */}
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className={isCrit ? 'badge-status-critical' : 'badge-status-warning'}>
                      {isCrit ? <Flame className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                      {alert.severity}
                    </span>

                    <span className="font-semibold text-[13px] text-[var(--text-primary)]">{alert.component}</span>
                    <span className="text-[var(--text-disabled)]">•</span>
                    <span className="text-[12px] text-[var(--text-secondary)] font-medium">{alert.factor}</span>

                    <span
                      className={`text-[11px] font-mono px-2 py-0.5 rounded-[4px] border ${
                        alert.status === 'Active'
                          ? 'badge-status-critical'
                          : alert.status === 'Acknowledged'
                          ? 'badge-status-warning'
                          : 'badge-status-healthy'
                      }`}
                    >
                      {alert.status}
                    </span>
                  </div>

                  <p className="text-[12px] text-[var(--text-secondary)] leading-[1.5] max-w-3xl">
                    <strong className="text-[var(--text-tertiary)]">Trigger: </strong>
                    <span className="font-mono text-[var(--text-primary)] font-semibold">{alert.value}</span> (Threshold{' '}
                    <span className="font-mono text-[var(--text-tertiary)]">{alert.threshold}</span>). {alert.recommendation}
                  </p>

                  <div className="text-[11px] text-[var(--text-tertiary)] font-mono flex items-center gap-4">
                    <span>Logged: {alert.timestamp}</span>
                    <span>ID: {alert.id}</span>
                  </div>
                </div>

                {/* Right Col: Action Buttons */}
                <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                  {alert.status === 'Active' && (
                    <button
                      onClick={() => onAcknowledgeAlert(alert.id)}
                      className="btn-secondary h-[32px] text-[12px] flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Acknowledge
                    </button>
                  )}

                  {alert.status !== 'Resolved' && (
                    <button
                      onClick={() => onResolveAlert(alert.id)}
                      className="px-3.5 py-1.5 rounded-[6px] text-[12px] font-semibold bg-[rgba(16,185,129,0.12)] border border-[rgba(16,185,129,0.3)] text-[var(--status-healthy)] hover:bg-[rgba(16,185,129,0.2)] flex items-center gap-1.5 transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Resolve
                    </button>
                  )}

                  {alert.status === 'Resolved' && (
                    <span className="badge-status-healthy flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Resolved
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

