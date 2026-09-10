import React, { useState } from 'react';
import {
  LayoutDashboard,
  Activity,
  Camera,
  Cpu,
  TrendingUp,
  Bell,
  Network,
  History,
  ShieldCheck,
  Zap,
  Info,
  X,
} from 'lucide-react';
import { PageId } from '../types';

interface SidebarProps {
  currentPage: PageId;
  onSelectPage: (page: PageId) => void;
  activeAlertCount: number;
  overallHealthScore: number;
  selectedConveyor: string;
  onSelectConveyor: (name: string) => void;
  isStreaming: boolean;
}

export interface NavItemConfig {
  id: PageId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const NAV_GROUPS: {
  groupName: string;
  items: NavItemConfig[];
}[] = [
  {
    groupName: 'MONITORING',
    items: [
      { id: 'realtime', label: 'Real-Time Telemetry', icon: Activity },
      { id: 'camera', label: 'Camera Inspection', icon: Camera },
      { id: 'digital-twin', label: 'Digital Twin View', icon: Cpu },
    ],
  },
  {
    groupName: 'INTELLIGENCE',
    items: [
      { id: 'overview', label: 'Fleet Overview', icon: LayoutDashboard },
      { id: 'predictions', label: 'Predictive Analytics', icon: TrendingUp },
      { id: 'alerts', label: 'Alerts & Incidents', icon: Bell },
    ],
  },
  {
    groupName: 'OPERATIONS',
    items: [
      { id: 'integrations', label: 'System Integrations', icon: Network },
      { id: 'history', label: 'Historical Reports', icon: History },
    ],
  },
];

export const CONVEYORS = [
  { id: 'CV-101', name: 'CV-101 • Primary Crusher Overland', short: 'CV-101', length: '2.4 km', capacity: '6,500 tph', criticalCount: 0 },
  { id: 'CV-102', name: 'CV-102 • Secondary Screen Feed', short: 'CV-102', length: '850 m', capacity: '4,200 tph', criticalCount: 1 },
  { id: 'CV-201', name: 'CV-201 • Stockpile Reclaim Conveyor', short: 'CV-201', length: '1.6 km', capacity: '5,800 tph', criticalCount: 0 },
  { id: 'CV-301', name: 'CV-301 • Train Loadout Terminal', short: 'CV-301', length: '3.1 km', capacity: '7,000 tph', criticalCount: 0 },
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onSelectPage,
  activeAlertCount,
  overallHealthScore,
  isStreaming,
}) => {
  const [showModelDetails, setShowModelDetails] = useState(false);

  return (
    <aside
      id="main-sidebar"
      className="w-[260px] bg-[var(--bg-surface)] border-r border-[var(--border-subtle)] flex flex-col shrink-0 h-screen overflow-y-auto select-none"
    >
      {/* Brand Header */}
      <div className="h-[64px] px-5 flex items-center border-b border-[var(--border-subtle)] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-[8px] bg-[var(--accent-primary-muted)] border border-[rgba(245,165,36,0.3)] flex items-center justify-center text-[var(--accent-primary)] shadow-sm shrink-0">
            <Zap className="w-4 h-4 fill-[var(--accent-primary)]" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold tracking-tight text-[15px] text-[var(--text-primary)]">
              PULSE-MINE
            </span>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-[4px] bg-[var(--accent-primary-muted)] text-[var(--accent-primary)] border border-[rgba(245,165,36,0.25)] font-mono">
              APM
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Modules Grouped with 11px uppercase headers */}
      <nav className="flex-1 px-3 py-4 space-y-5" aria-label="Dashboard Navigation">
        {NAV_GROUPS.map((group, groupIdx) => (
          <div key={group.groupName} className={groupIdx > 0 ? 'mt-6' : ''}>
            <div className="px-3 pb-2 text-[11px] font-semibold tracking-wider uppercase text-[var(--text-disabled)] font-sans">
              {group.groupName}
            </div>

            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                const isAlertTab = item.id === 'alerts';

                return (
                  <button
                    key={item.id}
                    id={`nav-btn-${item.id}`}
                    onClick={() => onSelectPage(item.id)}
                    className={`w-full h-[44px] px-3 rounded-[12px] text-[14px] font-medium flex items-center justify-between transition-colors duration-150 text-left ${
                      isActive
                        ? 'bg-[var(--accent-primary-muted)] text-[var(--text-primary)] border-l-[3px] border-[var(--accent-primary)]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-raised)] border-l-[3px] border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0 transition-colors duration-150 ${
                          isActive
                            ? 'bg-[var(--accent-primary-muted)] text-[var(--accent-primary)]'
                            : 'bg-[var(--bg-surface-raised)] text-[var(--text-secondary)]'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="truncate">{item.label}</span>
                    </div>

                    {isAlertTab && activeAlertCount > 0 && (
                      <span className="px-2 py-0.5 text-[11px] font-bold rounded-[6px] bg-[var(--status-critical-bg)] text-[var(--status-critical)] border border-[rgba(241,54,54,0.3)] shrink-0 font-mono">
                        {activeAlertCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer Info & ML Spec Trigger */}
      <div className="p-3 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] shrink-0">
        <div className="bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)] rounded-[12px] p-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span
              className={`w-2 h-2 rounded-full ${
                isStreaming ? 'bg-[var(--status-healthy)] animate-soft-pulse' : 'bg-[var(--text-disabled)]'
              }`}
            />
            <div className="text-[12px]">
              <div className="font-medium text-[var(--text-primary)]">
                {isStreaming ? 'Edge Telemetry Active' : 'Telemetry Paused'}
              </div>
              <div className="text-[11px] text-[var(--text-tertiary)] font-mono">
                Health: {overallHealthScore}/100
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowModelDetails(true)}
            className="p-1.5 rounded-[6px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.06)] transition-colors"
            title="View AI Model Specification & Fusion Logic"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Model Architecture Info Modal */}
      {showModelDetails && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-strong)] max-w-sm w-full rounded-[16px] p-6 shadow-[var(--shadow-elevated)] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[var(--text-primary)] font-semibold text-[16px]">
                <ShieldCheck className="w-5 h-5 text-[var(--status-healthy)]" />
                <span>AI Core Architecture</span>
              </div>
              <button
                onClick={() => setShowModelDetails(false)}
                className="p-1.5 rounded-[6px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.06)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-[12px] text-[var(--text-secondary)]">
              <div className="bg-[var(--bg-surface-raised)] p-3 rounded-[12px] border border-[var(--border-subtle)] space-y-1">
                <div className="text-[var(--text-tertiary)] text-[11px]">Primary Classifier:</div>
                <div className="text-[var(--text-primary)] font-semibold">Random Forest Ensemble (120 Trees)</div>
                <div className="text-[11px] text-[var(--status-healthy)]">Rule-based fallback boundary verification</div>
              </div>

              <div className="bg-[var(--bg-surface-raised)] p-3 rounded-[12px] border border-[var(--border-subtle)] space-y-1">
                <div className="text-[var(--text-tertiary)] text-[11px]">Weighted Fusion Formula:</div>
                <div className="font-mono text-[var(--accent-primary)] font-bold">
                  final_score = (0.6 × sensor_risk) + (0.4 × camera_risk)
                </div>
              </div>

              <p className="text-[11px] text-[var(--text-tertiary)] leading-relaxed">
                Telemetry streams are polled across 9 sensory dimensions and fused with high-speed optical surface line-scan features.
              </p>
            </div>

            <button
              onClick={() => setShowModelDetails(false)}
              className="btn-primary w-full"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};

