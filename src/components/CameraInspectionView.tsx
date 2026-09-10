import React, { useState, useRef, useEffect } from 'react';
import {
  Video,
  Scan,
  Cpu,
  Layers,
  Sparkles,
} from 'lucide-react';
import { CameraInspection, SensorData, CombinedPrediction } from '../types';
import { INITIAL_CAMERA_FRAMES, evaluateCombinedPrediction } from '../utils/conveyorLogic';
import { AnimatedNumber } from './AnimatedNumber';

interface CameraInspectionViewProps {
  sensorData: SensorData;
  onUpdateCombinedPrediction?: (pred: CombinedPrediction) => void;
}

export const CameraInspectionView: React.FC<CameraInspectionViewProps> = ({
  sensorData,
  onUpdateCombinedPrediction,
}) => {
  const [frames, setFrames] = useState<CameraInspection[]>(INITIAL_CAMERA_FRAMES);
  const [activeFrame, setActiveFrame] = useState<CameraInspection>(INITIAL_CAMERA_FRAMES[1]);
  const [useWebcam, setUseWebcam] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(true);
  const [webcamError, setWebcamError] = useState<string | null>(null);
  const [cctvTimestamp, setCctvTimestamp] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Live CCTV timestamp updater
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const yr = now.getFullYear();
      const mo = String(now.getMonth() + 1).padStart(2, '0');
      const da = String(now.getDate()).padStart(2, '0');
      const hr = String(now.getHours()).padStart(2, '0');
      const mi = String(now.getMinutes()).padStart(2, '0');
      const se = String(now.getSeconds()).padStart(2, '0');
      setCctvTimestamp(`${yr}-${mo}-${da} ${hr}:${mi}:${se} UTC`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Compute combined prediction based on current sensorData and activeFrame
  const combined = evaluateCombinedPrediction(sensorData, activeFrame);

  // Sync back to parent when combined prediction changes
  useEffect(() => {
    if (onUpdateCombinedPrediction) {
      onUpdateCombinedPrediction(combined);
    }
  }, [sensorData, activeFrame]);

  // Handle Webcam Start/Stop
  useEffect(() => {
    if (useWebcam) {
      navigator.mediaDevices
        ?.getUserMedia({ video: { width: 640, height: 480 } })
        .then((stream) => {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
          }
          setWebcamError(null);
        })
        .catch(() => {
          setWebcamError('Webcam access was denied or device not found. Reverting to high-speed conveyor feed simulation.');
          setUseWebcam(false);
        });
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [useWebcam]);

  const handleSimulateDefect = (
    defect: CameraInspection['defect_type'],
    status: CameraInspection['status'],
    risk: number,
    bbox?: { x: number; y: number; width: number; height: number; label: string }
  ) => {
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    const newFrame: CameraInspection = {
      id: `cam-${Date.now()}`,
      timestamp: timeStr,
      status,
      defect_type: defect,
      confidence: Math.round((88 + Math.random() * 10) * 10) / 10,
      camera_risk_score: risk,
      bbox,
      imageUrl: activeFrame.imageUrl,
      beltLocation: 'Optical Line Scanner #1 - Splice Bay',
    };

    setActiveFrame(newFrame);
    setFrames((prev) => [newFrame, ...prev.slice(0, 5)]);
  };

  const getStatusBadge = (status: CameraInspection['status']) => {
    switch (status) {
      case 'Normal':
        return (
          <span className="badge-status-healthy">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-healthy)]" />
            Clean Surface
          </span>
        );
      case 'Minor Damage':
        return (
          <span className="badge-status-warning">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-warning)]" />
            Minor Defect
          </span>
        );
      case 'Critical Damage':
        return (
          <span className="badge-status-critical">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-critical)]" />
            Critical Tear
          </span>
        );
    }
  };

  return (
    <div id="camera-inspection-view" className="space-y-6 pb-12 page-transition-enter">
      {/* 1. Formula & Weighted Fusion Banner */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[12px] p-[24px] shadow-[var(--shadow-card)]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-[4px] text-[11px] font-semibold bg-[var(--accent-primary-muted)] text-[var(--accent-primary)] border border-[rgba(245,165,36,0.3)] font-mono uppercase">
                Sensor-Vision Fusion
              </span>
              <h1 className="text-[20px] font-semibold text-[var(--text-primary)] tracking-tight">
                Combined Rupture Risk Index
              </h1>
            </div>
            <p className="text-[13px] text-[var(--text-tertiary)] font-mono">
              Composite Equation: (0.60 × Sensor Telemetry) + (0.40 × Optical Line-Scan)
            </p>
          </div>

          {/* Breakdown Equation Cards */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="px-3.5 py-2 rounded-[8px] bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)]">
              <div className="text-[11px] uppercase tracking-[0.06em] text-[var(--text-tertiary)] font-medium">Sensor Risk (60%)</div>
              <div className="text-[20px] font-bold font-mono tabular-nums text-[var(--text-primary)] mt-0.5">
                <AnimatedNumber value={combined.sensor_risk_score} decimals={1} />
                <span className="text-[11px] text-[var(--text-tertiary)] font-normal ml-1">/ 100</span>
              </div>
            </div>

            <span className="text-[var(--text-disabled)] font-bold text-base">+</span>

            <div className="px-3.5 py-2 rounded-[8px] bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)]">
              <div className="text-[11px] uppercase tracking-[0.06em] text-[var(--text-tertiary)] font-medium">Camera Risk (40%)</div>
              <div className="text-[20px] font-bold font-mono tabular-nums text-[var(--accent-primary)] mt-0.5">
                <AnimatedNumber value={combined.camera_risk_score} decimals={1} />
                <span className="text-[11px] text-[var(--text-tertiary)] font-normal ml-1">/ 100</span>
              </div>
            </div>

            <span className="text-[var(--text-disabled)] font-bold text-base">=</span>

            <div
              className={`px-4 py-2 rounded-[8px] border flex items-center gap-3 ${
                combined.final_score >= 60
                  ? 'bg-[var(--status-critical-bg)] border-[rgba(241,54,54,0.4)] text-[var(--status-critical)]'
                  : combined.final_score >= 30
                  ? 'bg-[var(--status-warning-bg)] border-[rgba(245,158,11,0.4)] text-[var(--status-warning)]'
                  : 'bg-[var(--status-healthy-bg)] border-[rgba(16,185,129,0.4)] text-[var(--status-healthy)]'
              }`}
            >
              <div>
                <div className="text-[11px] uppercase font-semibold tracking-[0.06em]">Composite Risk</div>
                <div className="text-[22px] font-bold font-mono tabular-nums leading-none mt-0.5">
                  <AnimatedNumber value={combined.final_score} decimals={1} />
                  <span className="text-[11px] font-normal ml-1">/ 100</span>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-[6px] text-[12px] font-bold border bg-[var(--bg-base)]">
                {combined.status}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main Camera Feed & Edge Analysis Grid (12-col: 8 cols feed, 4 cols analysis) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left 8 Cols: Camera Viewport */}
        <div className="lg:col-span-8 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[12px] overflow-hidden shadow-[var(--shadow-card)] flex flex-col justify-between">
          {/* Viewport Top Bar */}
          <div className="px-4 py-3 bg-[var(--bg-surface-raised)] border-b border-[var(--border-subtle)] flex items-center justify-between text-[13px]">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-2 h-2 rounded-full bg-[var(--status-critical)] animate-soft-pulse shrink-0" />
              <span className="font-semibold text-[var(--text-primary)] truncate">
                {useWebcam ? 'LIVE WEBCAM STREAM' : 'LINE-SCAN OPTICAL CAM #1 (60 FPS)'}
              </span>
              <span className="text-[var(--text-tertiary)] font-mono text-[11px] hidden sm:inline">
                {activeFrame.beltLocation}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                id="btn-toggle-webcam"
                onClick={() => setUseWebcam(!useWebcam)}
                className={`px-2.5 py-1 rounded-[6px] text-[12px] font-medium flex items-center gap-1.5 transition-colors ${
                  useWebcam
                    ? 'bg-[var(--accent-primary)] text-[#0A0E14] font-bold'
                    : 'btn-secondary h-[28px]'
                }`}
              >
                <Video className="w-3.5 h-3.5" />
                <span>{useWebcam ? 'Simulated Feed' : 'Use Webcam'}</span>
              </button>

              <button
                onClick={() => setIsScanning(!isScanning)}
                className={`px-2.5 py-1 rounded-[6px] text-[12px] font-medium flex items-center gap-1.5 transition-colors ${
                  isScanning
                    ? 'badge-status-healthy h-[28px]'
                    : 'btn-secondary h-[28px]'
                }`}
              >
                <Scan className="w-3.5 h-3.5" />
                <span>{isScanning ? 'AI Grid Active' : 'AI Hidden'}</span>
              </button>
            </div>
          </div>

          {/* Video / Image Display */}
          <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
            {/* CCTV Live Broadcast & REC Overlay */}
            <div className="absolute top-3 right-3 z-20 flex items-center gap-2 px-2.5 py-1 rounded-[6px] bg-black/80 border border-white/10 backdrop-blur-sm pointer-events-none">
              <span className="w-2 h-2 rounded-full bg-[var(--status-critical)] animate-soft-pulse" />
              <span className="text-[11px] font-mono font-bold text-[var(--status-critical)] tracking-wider">REC</span>
              <span className="text-[11px] font-mono text-[var(--text-secondary)] border-l border-white/10 pl-2">
                {cctvTimestamp}
              </span>
            </div>

            {useWebcam ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            ) : (
              <img
                src={activeFrame.imageUrl}
                alt="Conveyor belt surface inspection feed"
                className="w-full h-full object-cover filter contrast-125 brightness-95"
              />
            )}

            {/* Laser Line Pulse Animation */}
            {isScanning && (
              <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-[var(--status-critical)] to-transparent shadow-[0_0_12px_var(--status-critical)] animate-soft-pulse pointer-events-none top-1/3" />
            )}

            {/* Bounding Box Overlay */}
            {isScanning && activeFrame.bbox && (
              <div
                className="absolute border-2 border-[var(--status-critical)] bg-[rgba(241,54,54,0.15)] pointer-events-none shadow-[0_0_16px_rgba(241,54,54,0.4)]"
                style={{
                  left: `${activeFrame.bbox.x}%`,
                  top: `${activeFrame.bbox.y}%`,
                  width: `${activeFrame.bbox.width}%`,
                  height: `${activeFrame.bbox.height}%`,
                }}
              >
                <div className="absolute -top-6 left-0 px-2 py-0.5 rounded-[4px] bg-[var(--status-critical)] text-white text-[10px] font-bold whitespace-nowrap shadow-md">
                  {activeFrame.bbox.label} — {activeFrame.confidence}%
                </div>
              </div>
            )}

            {/* Clean Surface Badge */}
            {isScanning && !activeFrame.bbox && (
              <div className="absolute top-3 left-3 px-3 py-1 rounded-[6px] bg-black/75 border border-[rgba(16,185,129,0.3)] text-[var(--status-healthy)] text-[12px] font-semibold flex items-center gap-2 backdrop-blur-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-healthy)]" />
                <span>Nominal Surface Condition (98.4% Confidence)</span>
              </div>
            )}

            {/* Viewport HUD */}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] font-mono text-[var(--text-secondary)] bg-black/75 backdrop-blur-sm px-3.5 py-1.5 rounded-[6px] border border-white/10 pointer-events-none">
              <div className="flex items-center gap-4">
                <span>FPS: 59.8</span>
                <span>EXP: 1/4000s</span>
                <span>RES: 2048x1080</span>
              </div>
              <div className="text-[var(--accent-primary)] font-bold">
                SPEED SYNC: {sensorData.belt_speed.toFixed(2)} m/s
              </div>
            </div>

            {webcamError && (
              <div className="absolute inset-0 bg-black/85 flex items-center justify-center p-6 text-center text-[13px] text-[var(--status-warning)]">
                {webcamError}
              </div>
            )}
          </div>

          {/* Bottom Bar: Defect Injection Buttons */}
          <div className="p-[16px] bg-[var(--bg-surface-raised)] border-t border-[var(--border-subtle)]">
            <div className="text-[12px] font-medium text-[var(--text-tertiary)] uppercase tracking-[0.06em] mb-2.5 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>Inject Vision Scenarios:</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <button
                onClick={() => handleSimulateDefect('No Defect / Clean Surface', 'Normal', 5, undefined)}
                className="p-2.5 rounded-[6px] bg-[var(--bg-surface)] hover:bg-[var(--border-subtle)] border border-[var(--border-subtle)] text-left transition-colors"
              >
                <div className="text-[12px] font-semibold text-[var(--status-healthy)]">✓ Clean Surface</div>
                <div className="text-[11px] text-[var(--text-tertiary)] font-mono">Risk: 5%</div>
              </button>

              <button
                onClick={() =>
                  handleSimulateDefect('Surface Micro-Crack', 'Minor Damage', 35, {
                    x: 35,
                    y: 40,
                    width: 25,
                    height: 20,
                    label: 'Crack Detected',
                  })
                }
                className="p-2.5 rounded-[6px] bg-[var(--bg-surface)] hover:bg-[var(--border-subtle)] border border-[var(--border-subtle)] text-left transition-colors"
              >
                <div className="text-[12px] font-semibold text-[var(--status-warning)]">⚠️ Micro-Crack</div>
                <div className="text-[11px] text-[var(--text-tertiary)] font-mono">Risk: 35%</div>
              </button>

              <button
                onClick={() =>
                  handleSimulateDefect('Longitudinal Gouge', 'Minor Damage', 45, {
                    x: 20,
                    y: 28,
                    width: 48,
                    height: 18,
                    label: 'Gouge (3.2mm)',
                  })
                }
                className="p-2.5 rounded-[6px] bg-[var(--bg-surface)] hover:bg-[var(--border-subtle)] border border-[var(--border-subtle)] text-left transition-colors"
              >
                <div className="text-[12px] font-semibold text-[var(--status-warning)]">⚠️ Belt Gouge</div>
                <div className="text-[11px] text-[var(--text-tertiary)] font-mono">Risk: 45%</div>
              </button>

              <button
                onClick={() =>
                  handleSimulateDefect('Deep Splice Separation', 'Critical Damage', 88, {
                    x: 18,
                    y: 35,
                    width: 60,
                    height: 38,
                    label: 'Splice Delamination',
                  })
                }
                className="p-2.5 rounded-[6px] bg-[var(--status-critical-bg)] hover:bg-opacity-80 border border-[rgba(241,54,54,0.3)] text-left transition-colors"
              >
                <div className="text-[12px] font-semibold text-[var(--status-critical)]">🔴 Splice Tear</div>
                <div className="text-[11px] text-[var(--text-tertiary)] font-mono">Risk: 88%</div>
              </button>
            </div>
          </div>
        </div>

        {/* Right 4 Cols: Inspection Analysis Details */}
        <div className="lg:col-span-4 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[12px] p-[20px] shadow-[var(--shadow-card)] flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <h2 className="text-[15px] font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>Live Frame Analysis</span>
              </h2>
              {getStatusBadge(activeFrame.status)}
            </div>

            <div className="space-y-3 text-[13px]">
              <div className="bg-[var(--bg-surface-raised)] p-3 rounded-[8px] border border-[var(--border-subtle)] space-y-2">
                <div className="flex justify-between">
                  <span className="text-[var(--text-tertiary)]">Condition:</span>
                  <span className="font-semibold text-[var(--text-primary)]">{activeFrame.defect_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-tertiary)]">Confidence:</span>
                  <span className="font-mono font-bold text-[var(--accent-primary)]">{activeFrame.confidence}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-tertiary)]">Camera Risk:</span>
                  <span className="font-mono font-bold text-[var(--status-critical)]">{activeFrame.camera_risk_score}/100</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-tertiary)]">Timestamp:</span>
                  <span className="font-mono text-[var(--text-secondary)]">{activeFrame.timestamp}</span>
                </div>
              </div>

              {/* Edge Inference Spec */}
              <div className="p-3 rounded-[8px] bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)] text-[12px] space-y-1 text-[var(--text-secondary)]">
                <div className="font-semibold text-[var(--text-primary)]">Inference Pipeline:</div>
                <div>• Architecture: YOLOv8-Mining Belt S-Scan</div>
                <div>• Latency: 16.4 ms / frame</div>
                <div>• Hardware: Nvidia Jetson AGX Orin 64GB</div>
              </div>

              {/* Action Recommendation */}
              <div className="p-3 rounded-[8px] bg-[var(--accent-primary-muted)] border border-[rgba(245,165,36,0.25)] text-[13px] leading-[1.5]">
                <strong className="block font-semibold text-[var(--accent-primary)] mb-1">
                  Maintenance Recommendation:
                </strong>
                <span className="text-[var(--text-primary)]">{combined.recommendation}</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[var(--border-subtle)] text-[11px] text-[var(--text-tertiary)] flex items-center justify-between font-mono">
            <span>Location: {activeFrame.beltLocation}</span>
            <span>ID: {activeFrame.id}</span>
          </div>
        </div>
      </div>

      {/* 3. Thumbnail Gallery (6 Frames) */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[12px] p-[20px] shadow-[var(--shadow-card)] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[var(--accent-primary)]" />
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
              Historical Inspection Frames Gallery
            </h2>
          </div>
          <span className="text-[11px] text-[var(--text-tertiary)] font-mono">Click thumbnail to inspect</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {frames.map((frame) => {
            const isSelected = frame.id === activeFrame.id;
            return (
              <div
                key={frame.id}
                onClick={() => setActiveFrame(frame)}
                className={`group cursor-pointer bg-[var(--bg-surface-raised)] rounded-[8px] overflow-hidden border transition-all ${
                  isSelected
                    ? 'border-[var(--accent-primary)] ring-2 ring-[rgba(245,165,36,0.3)]'
                    : 'border-[var(--border-subtle)] hover:border-[var(--border-default)]'
                }`}
              >
                <div className="relative aspect-video bg-black overflow-hidden">
                  <img
                    src={frame.imageUrl}
                    alt={frame.defect_type}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-[4px] bg-black/80 font-mono text-[9px] text-[var(--text-secondary)]">
                    {frame.timestamp}
                  </div>
                  {frame.bbox && (
                    <div className="absolute top-1 left-1 px-1 py-0.2 rounded-[3px] bg-[var(--status-critical)] text-[8px] font-bold text-white uppercase">
                      Defect
                    </div>
                  )}
                </div>
                <div className="p-2 space-y-0.5">
                  <div className="text-[12px] font-medium text-[var(--text-primary)] truncate">
                    {frame.defect_type}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-[var(--text-tertiary)] font-mono">
                    <span>{frame.confidence}%</span>
                    <span className={frame.camera_risk_score >= 60 ? 'text-[var(--status-critical)] font-bold' : ''}>
                      R:{frame.camera_risk_score}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

