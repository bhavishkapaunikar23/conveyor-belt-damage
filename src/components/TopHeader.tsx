import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  Settings,
  ShieldAlert,
  ChevronDown,
  Gauge,
  Play,
  Pause,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Zap,
} from 'lucide-react';
import { PageId } from '../types';
import { CONVEYORS } from './Sidebar';
import { AnimatedNumber } from './AnimatedNumber';

interface TopHeaderProps {
  currentPage: PageId;
  isStreaming: boolean;
  onToggleStreaming: () => void;
  onTriggerAnomaly: (mode: 'normal' | 'warning' | 'critical') => void;
  pollIntervalMs: number;
  onChangePollInterval: (ms: number) => void;
  selectedConveyor: string;
  onSelectConveyor?: (name: string) => void;
  onManualRefresh: () => void;
  beltSpeed: number;
  overallHealthScore?: number;
  activeAlertCount?: number;
  onNavigateToAlerts?: () => void;
  lastUpdateTimestamp?: number;
}

const PAGE_NAMES: Record<PageId, string> = {
  overview: 'Fleet Overview',
  realtime: 'Real-Time Telemetry',
  camera: 'Camera Inspection',
  'digital-twin': 'Digital Twin View',
  predictions: 'Predictive Analytics',
  alerts: 'Alerts & Incidents',
  integrations: 'System Integrations',
  history: 'Historical Reports',
};

export const TopHeader: React.FC<TopHeaderProps> = ({
  currentPage,
  isStreaming,
  onToggleStreaming,
  onTriggerAnomaly,
  pollIntervalMs,
  onChangePollInterval,
  selectedConveyor,
  onSelectConveyor,
  onManualRefresh,
  beltSpeed,
  activeAlertCount = 1,
  onNavigateToAlerts,
  lastUpdateTimestamp = Date.now(),
}) => {
  const [secondsAgo, setSecondsAgo] = useState<number>(0);
  const [showSettingsDropdown, setShowSettingsDropdown] = useState<boolean>(false);
  const [showHaltModal, setShowHaltModal] = useState<boolean>(false);
  const settingsRef = useRef<HTMLDivElement | null>(null);

  // Seconds ago tracker
  useEffect(() => {
    setSecondsAgo(0);
    const interval = setInterval(() => {
      const elapsed = Math.max(0, Math.floor((Date.now() - lastUpdateTimestamp) / 1000));
      setSecondsAgo(elapsed);
    }, 1000);
    return () => clearInterval(interval);
  }, [lastUpdateTimestamp]);

  // Click outside to close settings
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettingsDropdown(false);
      }
    };
    if (showSettingsDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSettingsDropdown]);

  return (
    <>
      {/* 1. Main Top Navigation Bar (Fixed 64px, --bg-surface, border-b --border-subtle) */}
      <header
        id="top-header"
        className="h-[64px] bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] px-6 lg:px-8 flex items-center justify-between shrink-0 z-30 select-none"
      >
        {/* Left & Center-Left: Logo + Product Name + Breadcrumb */}
        <div className="flex items-center gap-6 min-w-0">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-[8px] bg-[var(--accent-primary-muted)] border border-[rgba(245,165,36,0.3)] flex items-center justify-center text-[var(--accent-primary)] shadow-sm">
              <Zap className="w-4 h-4 fill-[var(--accent-primary)]" />
            </div>
            <span className="font-bold text-[16px] text-[var(--text-primary)] tracking-tight">
              PULSE-MINE
            </span>
          </div>

          <div className="hidden sm:flex items-center text-[14px] text-[var(--text-secondary)] font-normal gap-2 border-l border-[var(--border-subtle)] pl-5 min-w-0">
            <span className="font-medium text-[var(--text-primary)]">{selectedConveyor}</span>
            <span className="text-[var(--text-disabled)]">/</span>
            <span className="truncate">{PAGE_NAMES[currentPage] || 'Dashboard'}</span>
          </div>
        </div>

        {/* Right Side: Max 4 distinct items, each clearly separated by 24px gap */}
        <div className="flex items-center gap-[24px]">
          {/* 1. Live status pill: 8px pulsing dot + "Live" text + "Updated 2s ago" */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-[6px] bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)] text-[12px]">
            {isStreaming ? (
              <>
                <span className="w-2 h-2 rounded-full bg-[var(--status-healthy)] animate-soft-pulse shrink-0" />
                <span className="text-[var(--status-healthy)] font-bold font-mono text-[11px] tracking-wide">
                  Live
                </span>
                <span className="text-[var(--text-disabled)]">•</span>
                <span className="text-[var(--text-tertiary)] font-mono text-[11px] whitespace-nowrap">
                  {secondsAgo <= 0 ? 'Just now' : `Updated ${secondsAgo}s ago`}
                </span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-[var(--text-disabled)] shrink-0" />
                <span className="text-[var(--text-disabled)] font-medium font-mono text-[11px]">
                  Paused
                </span>
              </>
            )}
          </div>

          {/* Notification Bell Icon with alert badge */}
          <button
            id="top-bell-alerts"
            onClick={onNavigateToAlerts}
            className="relative p-2 rounded-[8px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-raised)] transition-colors"
            title="View Active Incidents & Alerts"
          >
            <Bell className="w-4 h-4" />
            {activeAlertCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-[var(--status-critical)] text-white text-[10px] font-bold flex items-center justify-center font-mono">
                {activeAlertCount}
              </span>
            )}
          </button>

          {/* 3. Settings / Gear Icon with Dropdown for Secondary Controls */}
          <div className="relative" ref={settingsRef}>
            <button
              id="btn-settings-toggle"
              onClick={() => setShowSettingsDropdown(!showSettingsDropdown)}
              className={`p-2 rounded-[8px] transition-colors ${
                showSettingsDropdown
                  ? 'text-[var(--accent-primary)] bg-[var(--bg-surface-raised)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-raised)]'
              }`}
              title="Telemetry Settings & Polling Controls"
            >
              <Settings className="w-4 h-4" />
            </button>

            {showSettingsDropdown && (
              <div className="absolute right-0 mt-2 w-64 rounded-[12px] bg-[var(--bg-surface)] border border-[var(--border-strong)] p-4 shadow-[var(--shadow-elevated)] z-50 space-y-3.5">
                <div className="text-[12px] font-semibold text-[var(--text-primary)] border-b border-[var(--border-subtle)] pb-2 flex items-center justify-between">
                  <span>Stream Configuration</span>
                  <span className="text-[11px] font-mono text-[var(--accent-primary)]">MQTT v5</span>
                </div>

                <div className="space-y-1.5">
                  <div className="text-[11px] text-[var(--text-tertiary)] uppercase font-medium tracking-wider">
                    Telemetry Stream
                  </div>
                  <button
                    onClick={onToggleStreaming}
                    className={`w-full py-1.5 px-3 rounded-[6px] text-[12px] font-medium flex items-center justify-between border transition-colors ${
                      isStreaming
                        ? 'bg-[var(--bg-surface-raised)] border-[var(--border-default)] text-[var(--text-primary)]'
                        : 'bg-[var(--accent-primary)] text-[#0A0E14] font-bold border-transparent'
                    }`}
                  >
                    <span>{isStreaming ? 'Pause Active Stream' : 'Resume Telemetry'}</span>
                    {isStreaming ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <div className="space-y-1.5">
                  <div className="text-[11px] text-[var(--text-tertiary)] uppercase font-medium tracking-wider">
                    Poll Frequency
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {[1000, 2000, 3000, 5000].map((ms) => (
                      <button
                        key={ms}
                        onClick={() => onChangePollInterval(ms)}
                        className={`py-1 rounded-[6px] text-[11px] font-mono font-medium transition-colors ${
                          pollIntervalMs === ms
                            ? 'bg-[var(--accent-primary)] text-[#0A0E14] font-bold'
                            : 'bg-[var(--bg-surface-raised)] text-[var(--text-secondary)] hover:text-white'
                        }`}
                      >
                        {ms / 1000}s
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-1 border-t border-[var(--border-subtle)] flex items-center justify-between">
                  <span className="text-[11px] text-[var(--text-tertiary)]">Immediate Poll:</span>
                  <button
                    onClick={() => {
                      onManualRefresh();
                      setShowSettingsDropdown(false);
                    }}
                    className="p-1.5 rounded-[6px] bg-[var(--bg-surface-raised)] hover:bg-[var(--border-strong)] text-[var(--text-secondary)] hover:text-white transition-colors flex items-center gap-1.5 text-[11px]"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Sync</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 4. User Profile Avatar */}
          <div
            className="w-8 h-8 rounded-full bg-[var(--bg-surface-raised)] border border-[var(--border-strong)] flex items-center justify-center text-[12px] font-bold text-[var(--text-primary)] shrink-0 cursor-default"
            title="Plant Operations Manager (Lead Shift)"
          >
            OP
          </div>
        </div>
      </header>

      {/* 2. Secondary Contextual Toolbar (48px height, subtle strip below main nav) */}
      <div
        id="secondary-toolbar"
        className="h-[48px] bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] px-6 lg:px-8 flex items-center justify-between gap-4 shrink-0 z-20 select-none text-[13px]"
      >
        {/* Left Side: Conveyor Selector + Speed readout */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <select
              id="conveyor-select-toolbar"
              value={selectedConveyor}
              onChange={(e) => onSelectConveyor && onSelectConveyor(e.target.value)}
              className="appearance-none bg-[var(--bg-surface-raised)] border border-[var(--border-default)] hover:border-[var(--border-strong)] text-[var(--text-primary)] text-[13px] font-medium rounded-[6px] pl-3 pr-7 py-1 focus:outline-none focus:border-[var(--accent-primary)] cursor-pointer transition-colors"
            >
              {CONVEYORS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[var(--text-tertiary)] absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Belt Speed Metric */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-secondary)]">
            <Gauge className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span>Speed:</span>
            <span className="font-mono font-bold text-[var(--text-primary)]">
              <AnimatedNumber value={beltSpeed} decimals={2} />
              <span className="text-[var(--text-tertiary)] font-normal text-[11px] ml-0.5">m/s</span>
            </span>
          </div>
        </div>

        {/* Right Side: Anomaly Drill Presets & Destructive E-Stop */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold hidden md:inline mr-1">
            Drills:
          </span>

          <button
            id="btn-mode-nominal"
            onClick={() => onTriggerAnomaly('normal')}
            className="px-2.5 py-1 rounded-[6px] text-[12px] font-semibold bg-[var(--status-healthy-bg)] text-[var(--status-healthy)] hover:bg-opacity-80 flex items-center gap-1.5 transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Nominal</span>
          </button>

          <button
            id="btn-mode-warning"
            onClick={() => onTriggerAnomaly('warning')}
            className="px-2.5 py-1 rounded-[6px] text-[12px] font-semibold bg-[var(--status-warning-bg)] text-[var(--status-warning)] hover:bg-opacity-80 flex items-center gap-1.5 transition-colors"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Warning</span>
          </button>

          <button
            id="btn-mode-critical"
            onClick={() => onTriggerAnomaly('critical')}
            className="px-2.5 py-1 rounded-[6px] text-[12px] font-semibold bg-[var(--status-critical-bg)] text-[var(--status-critical)] hover:bg-opacity-80 flex items-center gap-1.5 transition-colors"
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Critical</span>
          </button>

          {/* E-Stop Destructive Button */}
          <button
            id="btn-emergency-halt"
            onClick={() => setShowHaltModal(true)}
            className="btn-destructive ml-2 h-[30px] px-3 py-0 text-[12px] rounded-[6px]"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>E-STOP</span>
          </button>
        </div>
      </div>

      {/* Emergency Halt Confirmation Modal */}
      {showHaltModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface)] border border-[rgba(241,54,54,0.4)] max-w-md w-full rounded-[16px] p-6 shadow-[var(--shadow-elevated)] space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[10px] bg-[var(--status-critical-bg)] border border-[rgba(241,54,54,0.3)] flex items-center justify-center text-[var(--status-critical)] shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-[16px] font-bold text-[var(--text-primary)]">Emergency Conveyor Deceleration</h3>
                <p className="text-[12px] text-[var(--text-secondary)]">Target Line: {selectedConveyor}</p>
              </div>
            </div>

            <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
              Initiating this command dispatches an emergency interlock signal to the Allen-Bradley ControlLogix PLC via EtherNet/IP. The variable frequency drive will safely ramp belt speed to 0.0 m/s in 4.2 seconds.
            </p>

            <div className="bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)] p-3.5 rounded-[10px] text-[12px] text-[var(--text-secondary)] space-y-1">
              <div className="font-semibold text-[var(--accent-primary)]">Safety Interlock Sequence:</div>
              <div>• Conveyor drive motor de-energized</div>
              <div>• Gravity counterweight brake clamped</div>
              <div>• Upstream crusher feed gates locked</div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setShowHaltModal(false)}
                className="btn-secondary text-[13px] py-1.5 px-3.5 rounded-[6px]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowHaltModal(false);
                  onTriggerAnomaly('critical');
                }}
                className="btn-destructive text-[13px] py-1.5 px-4 rounded-[6px]"
              >
                Execute Emergency Halt
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

