import React, { useState } from 'react';
import {
  Network,
  CheckCircle2,
  XCircle,
  Server,
  Cpu,
  Radio,
  Share2,
  Database,
  ArrowRightLeft,
} from 'lucide-react';
import { SystemIntegrationItem } from '../types';

const INITIAL_INTEGRATIONS: SystemIntegrationItem[] = [
  {
    id: 'int-scada',
    name: 'Plant Supervisory Control & SCADA (Ignition)',
    category: 'Supervisory Control',
    protocol: 'OPC-UA (IEC 62541)',
    status: 'Connected',
    latencyMs: 14,
    packetsPerSec: 1420,
    lastSynced: 'Just now (< 2s ago)',
    endpoint: 'opc.tcp://scada-core.pilbara-mine.net:4840',
  },
  {
    id: 'int-plc',
    name: 'Conveyor Drive PLC (Allen-Bradley ControlLogix)',
    category: 'Programmable Logic Controller',
    protocol: 'EtherNet/IP & CIP',
    status: 'Connected',
    latencyMs: 6,
    packetsPerSec: 2850,
    lastSynced: 'Just now (< 1s ago)',
    endpoint: '192.168.10.45 / Slot 2',
  },
  {
    id: 'int-iot',
    name: 'Industrial Edge IoT Gateway (Advantech UNO)',
    category: 'Field Sensor Hub',
    protocol: 'MQTT / Sparkplug B',
    status: 'Connected',
    latencyMs: 22,
    packetsPerSec: 840,
    lastSynced: 'Just now (< 2s ago)',
    endpoint: 'mqtts://edge-gw-01.local:8883',
  },
  {
    id: 'int-vision',
    name: 'Edge AI Line-Scan Unit (Nvidia Jetson Orin)',
    category: 'Computer Vision Inference',
    protocol: 'RTSP & WebRTC (H.265)',
    status: 'Connected',
    latencyMs: 16,
    packetsPerSec: 1950,
    lastSynced: 'Just now (< 1s ago)',
    endpoint: 'rtsp://jetson-cam-01.mine.net:554/live',
  },
  {
    id: 'int-weight',
    name: 'Weightometer Station (Thermo Ramsey 10-20)',
    category: 'Bulk Scale Telemetry',
    protocol: 'Modbus TCP / RTU',
    status: 'Connected',
    latencyMs: 38,
    packetsPerSec: 180,
    lastSynced: '3s ago',
    endpoint: '192.168.10.88:502 (Unit 1)',
  },
  {
    id: 'int-sap',
    name: 'Enterprise Asset Management (SAP PM / Maximo)',
    category: 'Work Order & CMMS Dispatch',
    protocol: 'REST API / OAuth 2.0',
    status: 'Connected',
    latencyMs: 85,
    packetsPerSec: 12,
    lastSynced: '18s ago',
    endpoint: 'https://sap-gateway.ironorecorp.com/api/v2/pm',
  },
];

export const SystemIntegrationView: React.FC = () => {
  const [integrations, setIntegrations] = useState<SystemIntegrationItem[]>(INITIAL_INTEGRATIONS);

  const handleTestConnection = (id: string) => {
    setTimeout(() => {
      setIntegrations((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                lastSynced: 'Verified Just Now',
                latencyMs: Math.round(item.latencyMs * (0.9 + Math.random() * 0.2)),
              }
            : item
        )
      );
    }, 400);
  };

  const handleToggleStatus = (id: string) => {
    setIntegrations((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const nextStatus = item.status === 'Connected' ? 'Disconnected' : 'Connected';
        return { ...item, status: nextStatus };
      })
    );
  };

  return (
    <div id="system-integrations-view" className="space-y-6 pb-12 page-transition-enter">
      {/* 1. Header Banner */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[12px] p-[24px] shadow-[var(--shadow-card)] flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-[6px] bg-[var(--accent-primary-muted)] text-[var(--accent-primary)] flex items-center justify-center">
              <Network className="w-4 h-4" />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--accent-primary)] font-mono">
              Industrial Bus &amp; EAM Topology
            </span>
          </div>
          <h1 className="text-[20px] font-semibold text-[var(--text-primary)] tracking-tight">
            SCADA, PLC &amp; Edge Middleware Gateways
          </h1>
          <p className="text-[13px] text-[var(--text-secondary)] max-w-2xl leading-[1.6]">
            Active interface connectivity, telemetry ingest rates, and round-trip ping latency across field PLCs, Modbus scale transducers, MQTT brokers, and SAP PM work orders.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)] px-3.5 py-2 rounded-[8px] text-[12px] shrink-0">
          <span className="w-2 h-2 rounded-full bg-[var(--status-healthy)] animate-soft-pulse" />
          <span className="font-semibold text-[var(--status-healthy)]">
            {integrations.filter((i) => i.status === 'Connected').length} / {integrations.length} Systems Online
          </span>
        </div>
      </div>

      {/* 2. Industrial Topology Architecture Card */}
      <div className="industrial-card space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)] flex items-center gap-2">
            <Share2 className="w-4 h-4 text-[var(--accent-primary)]" />
            <span>Field Bus &amp; Cloud Gateway Data Pipeline</span>
          </h2>
          <span className="text-[11px] text-[var(--text-tertiary)] font-mono">End-to-End Latency: &lt; 40ms</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-[12px]">
          <div className="p-3.5 bg-[var(--bg-surface-raised)] rounded-[8px] border border-[var(--border-subtle)] space-y-1">
            <div className="flex items-center justify-between text-[var(--text-tertiary)] font-semibold text-[11px]">
              <span>1. Field Transducers</span>
              <Radio className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            </div>
            <div className="text-[var(--text-primary)] font-semibold text-[13px]">Modbus RTU / 4-20mA</div>
            <p className="text-[11px] text-[var(--text-tertiary)] leading-[1.5]">
              Thermocouples, accelerometers &amp; ultrasonic belt sag sensors.
            </p>
          </div>

          <div className="p-3.5 bg-[var(--bg-surface-raised)] rounded-[8px] border border-[var(--border-subtle)] space-y-1">
            <div className="flex items-center justify-between text-[var(--text-tertiary)] font-semibold text-[11px]">
              <span>2. Deterministic PLC</span>
              <Cpu className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="text-[var(--text-primary)] font-semibold text-[13px]">EtherNet/IP CIP</div>
            <p className="text-[11px] text-[var(--text-tertiary)] leading-[1.5]">
              Allen-Bradley ControlLogix 10ms deterministic interlock loop.
            </p>
          </div>

          <div className="p-3.5 bg-[var(--bg-surface-raised)] rounded-[8px] border border-[var(--border-subtle)] space-y-1">
            <div className="flex items-center justify-between text-[var(--text-tertiary)] font-semibold text-[11px]">
              <span>3. Edge AI Compute</span>
              <Server className="w-3.5 h-3.5 text-[var(--status-healthy)]" />
            </div>
            <div className="text-[var(--text-primary)] font-semibold text-[13px]">MQTT Sparkplug B</div>
            <p className="text-[11px] text-[var(--text-tertiary)] leading-[1.5]">
              Jetson AGX Orin 60fps crack inference &amp; feature extraction.
            </p>
          </div>

          <div className="p-3.5 bg-[var(--bg-surface-raised)] rounded-[8px] border border-[var(--border-subtle)] space-y-1">
            <div className="flex items-center justify-between text-[var(--text-tertiary)] font-semibold text-[11px]">
              <span>4. Enterprise EAM</span>
              <Database className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="text-[var(--text-primary)] font-semibold text-[13px]">REST / WebSockets</div>
            <p className="text-[11px] text-[var(--text-tertiary)] leading-[1.5]">
              SAP PM automated work order ticket &amp; maintenance dispatch.
            </p>
          </div>
        </div>
      </div>

      {/* 3. Integration Cards List (2-column, 16px gap) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {integrations.map((item) => {
          const isConn = item.status === 'Connected';
          return (
            <div
              key={item.id}
              id={`integration-${item.id}`}
              className={`industrial-card space-y-3.5 transition-all ${
                isConn ? '' : 'border-[rgba(241,54,54,0.4)]'
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] uppercase font-semibold text-[var(--accent-primary)] font-mono">
                      {item.category}
                    </span>
                    <span className="text-[var(--text-disabled)]">•</span>
                    <span className="text-[11px] font-mono text-[var(--text-tertiary)]">{item.protocol}</span>
                  </div>
                  <h3 className="text-[14px] font-semibold text-[var(--text-primary)] mt-0.5">{item.name}</h3>
                </div>

                <span className={isConn ? 'badge-status-healthy' : 'badge-status-critical'}>
                  {isConn ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  {item.status}
                </span>
              </div>

              {/* Endpoint & Stats */}
              <div className="bg-[var(--bg-surface-raised)] p-3 rounded-[6px] border border-[var(--border-subtle)] text-[11px] font-mono space-y-1.5">
                <div className="text-[var(--text-tertiary)] truncate">
                  URI: <span className="text-[var(--text-secondary)]">{item.endpoint}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-[var(--border-subtle)]">
                  <span className="text-[var(--text-tertiary)]">
                    Latency: <strong className="text-[var(--text-primary)] tabular-nums">{item.latencyMs} ms</strong>
                  </span>
                  <span className="text-[var(--text-tertiary)]">
                    Rate: <strong className="text-[var(--text-primary)] tabular-nums">{item.packetsPerSec} pkt/s</strong>
                  </span>
                  <span className="text-[var(--text-tertiary)]">
                    Sync: <strong className="text-[var(--text-primary)]">{item.lastSynced}</strong>
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-1 text-[12px]">
                <button
                  onClick={() => handleToggleStatus(item.id)}
                  className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] text-[11px] underline transition-colors"
                >
                  {isConn ? 'Simulate Disconnect' : 'Reconnect Interface'}
                </button>

                <button
                  onClick={() => handleTestConnection(item.id)}
                  className="btn-secondary h-[32px] text-[12px] flex items-center gap-1.5"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  Test Handshake
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

