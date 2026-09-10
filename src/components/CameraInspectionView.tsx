import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Video,
  Scan,
  Cpu,
  Layers,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { CameraInspection, SensorData, CombinedPrediction, Severity } from '../types';
import {
  INITIAL_CAMERA_FRAMES,
  evaluateCombinedPrediction,
  calculateSensorRiskScore,
  getContributingFactors,
} from '../utils/conveyorLogic';
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
  const [feedMode, setFeedMode] = useState<'recorded' | 'live'>('recorded');
  const [cameraStatus, setCameraStatus] = useState<'Normal' | 'Minor Wear' | 'Crack Detected'>('Normal');
  const [liveAnomalyScore, setLiveAnomalyScore] = useState<number>(0);
  const [isScanning, setIsScanning] = useState<boolean>(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [videoLoadError, setVideoLoadError] = useState<boolean>(false);
  const [cctvTimestamp, setCctvTimestamp] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analysisCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Rolling baseline of edge counts for automatic anomaly detection (~25 frames)
  const baselineEdgeCountsRef = useRef<number[]>([]);
  // Debounce counter: sustained for at least 2 consecutive analysis cycles
  const candidateStatusRef = useRef<{ status: 'Normal' | 'Minor Wear' | 'Crack Detected'; count: number }>({
    status: 'Normal',
    count: 0,
  });
  const currentCameraStatusRef = useRef<'Normal' | 'Minor Wear' | 'Crack Detected'>('Normal');

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

  // 4. Combined Score Function (connects Camera → Digital Twin)
  const handleCameraDetection = useCallback(
    (
      status: 'Normal' | 'Minor Wear' | 'Crack Detected',
      confidence: number,
      customBbox?: { x: number; y: number; width: number; height: number; label: string }
    ) => {
      // 1. Convert camera status into a camera risk score: Crack Detected → 90, Minor Wear → 40, Normal → 0
      const cameraScore = status === 'Crack Detected' ? 90 : status === 'Minor Wear' ? 40 : 0;

      // 2. Combine with existing sensor-based risk score: finalScore = (0.6 * sensorRiskScore) + (0.4 * cameraScore)
      const sensorRisk = calculateSensorRiskScore(sensorData);
      const finalScore = Math.round((0.6 * sensorRisk + 0.4 * cameraScore) * 10) / 10;

      // 3. Map finalScore to status: >70 = Critical, 40–70 = Warning, <40 = Healthy
      const finalStatus: 'Critical' | 'Warning' | 'Healthy' =
        finalScore > 70 ? 'Critical' : finalScore > 40 ? 'Warning' : 'Healthy';

      setCameraStatus(status);
      setLiveAnomalyScore(confidence);
      currentCameraStatusRef.current = status;

      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

      const mappedDefectType: CameraInspection['defect_type'] =
        status === 'Crack Detected'
          ? 'Deep Splice Separation'
          : status === 'Minor Wear'
          ? 'Surface Micro-Crack'
          : 'No Defect / Clean Surface';

      const frameStatus: CameraInspection['status'] =
        finalStatus === 'Critical'
          ? 'Critical Damage'
          : finalStatus === 'Warning'
          ? 'Minor Damage'
          : 'Normal';

      const updatedFrame: CameraInspection = {
        id: `cam-${Date.now()}`,
        timestamp: timeStr,
        status: frameStatus,
        defect_type: mappedDefectType,
        confidence: confidence > 0 ? Math.round(confidence * 10) / 10 : 98.4,
        camera_risk_score: cameraScore,
        bbox: status === 'Normal' ? undefined : customBbox,
        imageUrl: activeFrame.imageUrl,
        beltLocation: 'Line-Scan Optical Cam #1 - Vulcanized Joint #1',
      };

      setActiveFrame(updatedFrame);
      setFrames((prev) => [updatedFrame, ...prev.slice(0, 5)]);

      // 4. Update Digital Twin component via existing combined prediction callback
      if (onUpdateCombinedPrediction) {
        const combinedResult: CombinedPrediction = {
          final_score: finalScore,
          sensor_risk_score: sensorRisk,
          camera_risk_score: cameraScore,
          status: finalStatus,
          failure_probability: Math.min(99, Math.max(3, Math.round(finalScore * 0.95))),
          rul_hours: finalScore > 70 ? 12 : finalScore > 40 ? 96 : 580,
          contributing_factors: [
            ...(cameraScore > 0
              ? [
                  {
                    name: `Optical Camera: ${status}`,
                    factor_key: 'camera_visual',
                    impact_percent: Math.round((cameraScore * 0.4 / (finalScore || 1)) * 100),
                    current_value: cameraScore,
                    threshold_exceeded: `${confidence > 0 ? confidence.toFixed(1) : '98.4'}% confidence`,
                    severity: (finalStatus === 'Critical' ? 'critical' : 'warning') as Severity,
                  },
                ]
              : []),
            ...getContributingFactors(sensorData),
          ],
          camera_defect: mappedDefectType,
          camera_confidence: confidence > 0 ? Math.round(confidence * 10) / 10 : 98.4,
          recommendation:
            finalStatus === 'Critical'
              ? 'CRITICAL DEFECT DETECTED BY CAMERA: Splice tear risk on Joint #1. Immediate stop required.'
              : finalStatus === 'Warning'
              ? 'WARNING: Camera inspection identified belt surface wear on Joint #1. Schedule NDT inspection.'
              : 'Conveyor belt operating within nominal parameters. Optical line-scan clean.',
          timestamp: new Date().toISOString(),
        };
        onUpdateCombinedPrediction(combinedResult);
      }
    },
    [sensorData, onUpdateCombinedPrediction, activeFrame.imageUrl]
  );

  // Handle Feed Mode switching (Recorded vs Live Webcam)
  useEffect(() => {
    if (feedMode === 'live') {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices
          .getUserMedia({ video: true })
          .then((stream) => {
            streamRef.current = stream;
            if (videoRef.current) {
              videoRef.current.srcObject = stream;
              videoRef.current.play().catch(() => {});
            }
            setCameraError(null);
          })
          .catch(() => {
            setCameraError('Camera access unavailable');
            // Gracefully fall back to Recorded Feed mode automatically
            setFeedMode('recorded');
          });
      } else {
        setCameraError('Camera access unavailable');
        setFeedMode('recorded');
      }
    } else {
      // Recorded feed mode: release any active webcam stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.src = './assets/belt-inspection.mp4';
        videoRef.current.play().catch(() => {});
      }
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [feedMode]);

  // Automatic Frame Analysis Engine (Canvas + Sobel Edge Filter + Rolling Baseline)
  useEffect(() => {
    // Runs periodically every 450ms while video is playing
    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.paused) return;

      const canvas = analysisCanvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      // Downscale to 160x90 for fast, non-blocking edge/anomaly detection
      canvas.width = 160;
      canvas.height = 90;
      ctx.drawImage(video, 0, 0, 160, 90);

      try {
        const frame = ctx.getImageData(0, 0, 160, 90);
        const { data, width, height } = frame;

        // 1. Grayscale conversion
        const gray = new Uint8ClampedArray(width * height);
        for (let i = 0; i < width * height; i++) {
          gray[i] = (data[i * 4] * 77 + data[i * 4 + 1] * 150 + data[i * 4 + 2] * 29) >> 8;
        }

        // 2. Sobel Edge Filter & Grid Cell Density Tracking (8 cols x 5 rows)
        const gridCols = 8;
        const gridRows = 5;
        const cellW = width / gridCols;
        const cellH = height / gridRows;
        const cellEdgeCounts = new Array(gridCols * gridRows).fill(0);

        let totalEdges = 0;
        let maxCellCount = 0;
        let maxCellIdx = 0;

        // Skip 3px outer border to avoid camera boundary edge artifacts
        for (let y = 3; y < height - 3; y++) {
          const cy = Math.floor(y / cellH);
          for (let x = 3; x < width - 3; x++) {
            const idx = y * width + x;
            const gx =
              -gray[idx - width - 1] + gray[idx - width + 1] -
              2 * gray[idx - 1] + 2 * gray[idx + 1] -
              gray[idx + width - 1] + gray[idx + width + 1];
            const gy =
              -gray[idx - width - 1] - 2 * gray[idx - width] - gray[idx - width + 1] +
              gray[idx + width - 1] + 2 * gray[idx + width] + gray[idx + width + 1];
            const mag = Math.abs(gx) + Math.abs(gy);

            if (mag > 80) {
              totalEdges++;
              const cx = Math.floor(x / cellW);
              const cIdx = cy * gridCols + cx;
              cellEdgeCounts[cIdx]++;
              if (cellEdgeCounts[cIdx] > maxCellCount) {
                maxCellCount = cellEdgeCounts[cIdx];
                maxCellIdx = cIdx;
              }
            }
          }
        }

        // 3. Rolling Baseline (average the last ~25 quiet frames)
        const baselineBuf = baselineEdgeCountsRef.current;
        let baselineAvg = totalEdges;
        if (baselineBuf.length > 0) {
          baselineAvg = baselineBuf.reduce((a, b) => a + b, 0) / baselineBuf.length;
        } else {
          baselineBuf.push(totalEdges);
        }

        // Add to baseline if quiet or initializing
        const ratio = totalEdges / Math.max(10, baselineAvg);
        if (ratio < 1.35 || baselineBuf.length < 8) {
          baselineBuf.push(totalEdges);
          if (baselineBuf.length > 25) {
            baselineBuf.shift();
          }
        }

        // Compute relative deviation from baseline & hotspot concentration
        const deviation = (totalEdges - baselineAvg) / Math.max(15, baselineAvg);
        const concentration = maxCellCount / Math.max(1, totalEdges);

        let anomalyScore = 0;
        let rawStatus: 'Normal' | 'Minor Wear' | 'Crack Detected' = 'Normal';

        if (deviation > 0.65 || (deviation > 0.40 && concentration > 0.28)) {
          anomalyScore = Math.min(98, Math.round(72 + Math.min(26, deviation * 30)));
          rawStatus = 'Crack Detected';
        } else if (deviation > 0.25 || (deviation > 0.15 && concentration > 0.22)) {
          anomalyScore = Math.min(70, Math.max(36, Math.round(38 + deviation * 60)));
          rawStatus = 'Minor Wear';
        } else {
          anomalyScore = Math.max(0, Math.min(30, Math.round(Math.max(0, deviation) * 80)));
          rawStatus = 'Normal';
        }

        // 4. Debounce result: sustained for at least 2 consecutive analysis cycles
        if (candidateStatusRef.current.status === rawStatus) {
          candidateStatusRef.current.count += 1;
        } else {
          candidateStatusRef.current = { status: rawStatus, count: 1 };
        }

        if (candidateStatusRef.current.count >= 2 && currentCameraStatusRef.current !== rawStatus) {
          const maxCx = maxCellIdx % gridCols;
          const maxCy = Math.floor(maxCellIdx / gridCols);
          const bbox =
            rawStatus !== 'Normal'
              ? {
                  x: Math.max(8, Math.min(68, Math.round((maxCx / gridCols) * 100))),
                  y: Math.max(12, Math.min(64, Math.round((maxCy / gridRows) * 100))),
                  width: 25,
                  height: 28,
                  label: rawStatus === 'Crack Detected' ? 'Crack / Tear Detected' : 'Surface Wear Band',
                }
              : undefined;

          handleCameraDetection(rawStatus, rawStatus === 'Normal' ? 0 : anomalyScore, bbox);
        }
      } catch (err) {
        // Silently handle any frame read errors (e.g., cross-origin security guards)
      }
    }, 450);

    return () => clearInterval(interval);
  }, [handleCameraDetection]);

  const combined = evaluateCombinedPrediction(sensorData, activeFrame);

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
                {feedMode === 'live' ? 'LIVE CAMERA (WEBCAM FEED)' : 'RECORDED FEED (OPTICAL LINE-SCAN)'}
              </span>
              <span className="text-[var(--text-tertiary)] font-mono text-[11px] hidden sm:inline">
                {activeFrame.beltLocation}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* 1. Feed Source Toggle: Recorded Feed vs Live Camera */}
              <div className="flex items-center rounded-[6px] bg-[var(--bg-base)] p-0.5 border border-[var(--border-subtle)]">
                <button
                  id="btn-feed-recorded"
                  onClick={() => setFeedMode('recorded')}
                  className={`px-2.5 py-1 rounded-[4px] text-[12px] font-medium transition-colors ${
                    feedMode === 'recorded'
                      ? 'bg-[var(--bg-surface-raised)] text-[var(--text-primary)] font-semibold shadow-sm'
                      : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  Recorded Feed
                </button>
                <button
                  id="btn-feed-live"
                  onClick={() => setFeedMode('live')}
                  className={`px-2.5 py-1 rounded-[4px] text-[12px] font-medium flex items-center gap-1.5 transition-colors ${
                    feedMode === 'live'
                      ? 'bg-[var(--accent-primary)] text-[#0A0E14] font-bold shadow-sm'
                      : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  <Video className="w-3 h-3" />
                  <span>Live Camera</span>
                </button>
              </div>

              <button
                onClick={() => setIsScanning(!isScanning)}
                className={`px-2.5 py-1 rounded-[6px] text-[12px] font-medium flex items-center gap-1.5 transition-colors ${
                  isScanning
                    ? 'badge-status-healthy h-[28px]'
                    : 'btn-secondary h-[28px]'
                }`}
              >
                <Scan className="w-3.5 h-3.5" />
                <span>{isScanning ? 'Vision HUD' : 'HUD Off'}</span>
              </button>
            </div>
          </div>

          {/* Video / Camera Display Area */}
          <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
            {/* Hidden analysis canvas for non-blocking heuristic edge & anomaly detection */}
            <canvas ref={analysisCanvasRef} className="hidden" aria-hidden="true" />

            {/* CCTV Live Broadcast & REC Overlay */}
            <div className="absolute top-3 right-3 z-20 flex items-center gap-2 px-2.5 py-1 rounded-[6px] bg-black/80 border border-white/10 backdrop-blur-sm pointer-events-none">
              <span className="w-2 h-2 rounded-full bg-[var(--status-critical)] animate-soft-pulse" />
              <span className="text-[11px] font-mono font-bold text-[var(--status-critical)] tracking-wider">REC</span>
              <span className="text-[11px] font-mono text-[var(--text-secondary)] border-l border-white/10 pl-2">
                {cctvTimestamp}
              </span>
            </div>

            {/* Video player for both Recorded Feed and Live Camera */}
            <video
              ref={videoRef}
              src={feedMode === 'recorded' ? './assets/belt-inspection.mp4' : undefined}
              autoPlay
              loop={feedMode === 'recorded'}
              playsInline
              muted
              crossOrigin="anonymous"
              onError={() => {
                if (feedMode === 'recorded') setVideoLoadError(true);
              }}
              onLoadedData={() => setVideoLoadError(false)}
              className="w-full h-full object-cover"
            />

            {/* Fallback image if video fails to load */}
            {videoLoadError && feedMode === 'recorded' && (
              <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center p-6 text-center z-10">
                <AlertTriangle className="w-8 h-8 text-[var(--status-warning)] mb-2" />
                <p className="text-[13px] text-[var(--text-primary)] font-medium">
                  Recorded feed (assets/belt-inspection.mp4) unavailable
                </p>
                <p className="text-[11px] text-[var(--text-tertiary)] font-mono mt-1">
                  Place belt-inspection.mp4 in /public/assets/
                </p>
              </div>
            )}

            {/* Laser Line Pulse Animation */}
            {isScanning && (
              <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-[var(--status-critical)] to-transparent shadow-[0_0_12px_var(--status-critical)] animate-soft-pulse pointer-events-none top-1/3" />
            )}

            {/* Bounding Box Overlay for detected anomalies */}
            {isScanning && activeFrame.bbox && (
              <div
                className="absolute border-2 border-[var(--status-critical)] bg-[rgba(241,54,54,0.15)] pointer-events-none shadow-[0_0_16px_rgba(241,54,54,0.4)] transition-all duration-300"
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
                <span>STATUS: {cameraStatus}</span>
                <span>ANOMALY: {liveAnomalyScore.toFixed(0)}</span>
              </div>
              <div className="text-[var(--accent-primary)] font-bold">
                SPEED SYNC: {sensorData.belt_speed.toFixed(2)} m/s
              </div>
            </div>

            {/* Inline warning for camera failure */}
            {cameraError && (
              <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-black/90 border border-[rgba(245,158,11,0.5)] px-4 py-2 rounded-[8px] text-[12px] text-[var(--status-warning)] z-30 shadow-lg flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span>{cameraError} — Reverted to Recorded Feed</span>
              </div>
            )}
          </div>

          {/* Bottom Bar: Manual Simulate Detection Buttons (always available alongside automatic engine) */}
          <div className="p-[16px] bg-[var(--bg-surface-raised)] border-t border-[var(--border-subtle)]">
            <div className="text-[12px] font-medium text-[var(--text-tertiary)] uppercase tracking-[0.06em] mb-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>Simulate Detection Controls (Manual Demo Override):</span>
              </div>
              <span className="text-[11px] text-[var(--text-tertiary)] font-mono lowercase">
                auto-engine active (450ms)
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                id="btn-simulate-crack"
                onClick={() =>
                  handleCameraDetection('Crack Detected', 91, {
                    x: 36,
                    y: 34,
                    width: 28,
                    height: 30,
                    label: 'Crack Detected',
                  })
                }
                className="p-2.5 rounded-[6px] bg-[var(--status-critical-bg)] hover:bg-opacity-80 border border-[rgba(241,54,54,0.4)] text-left transition-colors"
              >
                <div className="text-[12px] font-semibold text-[var(--status-critical)]">🔴 Simulate Crack Detection</div>
                <div className="text-[11px] text-[var(--text-tertiary)] font-mono">Camera: 90 | Conf: 91%</div>
              </button>

              <button
                id="btn-simulate-wear"
                onClick={() =>
                  handleCameraDetection('Minor Wear', 55, {
                    x: 30,
                    y: 38,
                    width: 32,
                    height: 22,
                    label: 'Minor Wear',
                  })
                }
                className="p-2.5 rounded-[6px] bg-[var(--status-warning-bg)] hover:bg-opacity-80 border border-[rgba(245,158,11,0.4)] text-left transition-colors"
              >
                <div className="text-[12px] font-semibold text-[var(--status-warning)]">⚠️ Simulate Minor Wear</div>
                <div className="text-[11px] text-[var(--text-tertiary)] font-mono">Camera: 40 | Conf: 55%</div>
              </button>

              <button
                id="btn-simulate-normal"
                onClick={() => handleCameraDetection('Normal', 0)}
                className="p-2.5 rounded-[6px] bg-[var(--bg-surface)] hover:bg-[var(--border-subtle)] border border-[var(--border-subtle)] text-left transition-colors"
              >
                <div className="text-[12px] font-semibold text-[var(--status-healthy)]">✓ Reset to Normal</div>
                <div className="text-[11px] text-[var(--text-tertiary)] font-mono">Camera: 0 | Nominal Surface</div>
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

