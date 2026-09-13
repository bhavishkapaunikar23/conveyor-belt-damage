import React, { useState, useRef } from 'react';
import {
  Video,
  Scan,
  Cpu,
  Sparkles,
  AlertTriangle,
  Upload,
  FileVideo,
  RotateCcw,
  Flame,
  CheckCircle2,
} from 'lucide-react';
import { CameraInspection, SensorData, CombinedPrediction } from '../types';
import {
  evaluateCombinedPrediction,
} from '../utils/conveyorLogic';
import { useCameraFeed } from '../context/CameraFeedContext';

interface CameraInspectionViewProps {
  sensorData: SensorData;
  onUpdateCombinedPrediction?: (pred: CombinedPrediction) => void;
}

export const CameraInspectionView: React.FC<CameraInspectionViewProps> = ({
  sensorData,
}) => {
  const {
    videoSourceUrl,
    videoFileName,
    isSampleLoaded,
    feedMode,
    isScanning,
    cameraError,
    videoLoadError,
    cctvTimestamp,
    detection,
    liveAnomalyScore,
    activeFrame,
    videoRef,
    analysisCanvasRef,
    setFeedMode,
    setIsScanning,
    handleVideoUpload,
    handleLoadSampleVideo,
    triggerManualDefectTest,
  } = useCameraFeed();

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // File drop handler
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type.startsWith('video/') || file.name.match(/\.(mp4|webm|mov|m4v)$/i))) {
      handleVideoUpload(file);
    }
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleVideoUpload(file);
    }
  };

  // Structured defect detection specs lookup keyed by detection type
  const defectSpecsByType: Record<string, string[]> = {
    "Material Spillage": [
      "Outer Region Spillage: Left/Right Flange Margin Scan — ACTIVE (triggered this detection)",
      "Tracking Asymmetry: Lateral Differential Analysis — monitoring",
      "Debounce Window: 2 consecutive cycles (~760ms)"
    ],
    "Crack / Tear": [
      "Belt Surface Crack: High-frequency Sobel Filter — ACTIVE (triggered this detection)",
      "Outer Region Spillage: Left/Right Flange Margin Scan — monitoring",
      "Debounce Window: 2 consecutive cycles (~760ms)"
    ],
    "Edge Wear": [
      "Tracking Asymmetry: Lateral Differential Analysis — ACTIVE (triggered this detection)",
      "Belt Surface Crack: High-frequency Sobel Filter — monitoring",
      "Debounce Window: 2 consecutive cycles (~760ms)"
    ],
    "Normal": [
      "All scans running: Flange Margin Scan, Sobel Filter, Lateral Differential Analysis",
      "No anomaly above threshold in current window",
      "Debounce Window: 2 consecutive cycles (~760ms)"
    ]
  };

  // Structured maintenance recommendation lookup based on type and risk score
  const getMaintenanceRecommendation = (type: string, riskScore: number): string => {
    const recommendations: Record<string, string> = {
      "Material Spillage": riskScore > 70
        ? "CRITICAL: Significant material spillage at belt flange — stop feed rate, inspect skirt rubber and flange seals immediately to prevent continued material loss and potential belt tracking failure."
        : "WARNING: Material spillage detected at belt edge — check skirt board rubber seal and loading chute alignment at next inspection window.",
      "Crack / Tear": riskScore > 70
        ? "CRITICAL: Belt surface crack detected — potential splice failure risk. Halt operation and perform immediate visual/manual inspection before resuming."
        : "WARNING: Early-stage surface crack indicators detected. Schedule non-destructive testing (NDT) at next shift break and verify belt tension take-up.",
      "Edge Wear": "WARNING: Belt tracking asymmetry detected — check idler alignment and edge guide rollers; uneven wear may accelerate if uncorrected.",
      "Normal": "No action required. Belt surface and tracking within normal parameters."
    };
    return recommendations[type] || recommendations["Normal"];
  };

  const normalizeDefectType = (rawType?: string): 'Normal' | 'Material Spillage' | 'Crack / Tear' | 'Edge Wear' => {
    if (!rawType) return 'Normal';
    if (rawType.includes('Spillage')) return 'Material Spillage';
    if (rawType.includes('Crack') || rawType.includes('Tear') || rawType.includes('Splice')) return 'Crack / Tear';
    if (rawType.includes('Wear') || rawType.includes('Misalignment')) return 'Edge Wear';
    return 'Normal';
  };

  const getConditionLabel = (rawType?: string): string => {
    if (!rawType) return 'Normal / Clean Surface';
    if (rawType.includes('Spillage')) return 'Material Spillage / Skirt Overflow';
    if (rawType.includes('Crack') || rawType.includes('Tear') || rawType.includes('Splice')) return 'Crack / Tear';
    if (rawType.includes('Misalignment')) return 'Tracking Misalignment';
    if (rawType.includes('Wear')) return 'Edge Wear';
    return 'Normal / Clean Surface';
  };

  // Derive dynamic live analysis panel data from current detection state
  const currentCategory = normalizeDefectType(detection?.defectType || activeFrame?.defect_type);
  const currentCondition = getConditionLabel(detection?.defectType || activeFrame?.defect_type);
  const currentConfidence = detection?.confidence ?? activeFrame?.confidence ?? 98;
  const currentCameraRisk = detection?.cameraScore ?? activeFrame?.camera_risk_score ?? 0;
  const currentTimestamp = detection?.timestamp || activeFrame?.timestamp || cctvTimestamp || 'Live';
  const currentLocation = detection?.location || activeFrame?.beltLocation || 'Joint 1 — Transfer Point (Cam #1)';
  const currentSpecs = defectSpecsByType[currentCategory] || defectSpecsByType['Normal'];
  const currentRecommendation = getMaintenanceRecommendation(currentCategory, currentCameraRisk);
  const currentStatus: CameraInspection['status'] =
    currentCameraRisk >= 60 ? 'Critical Damage' : currentCameraRisk >= 30 ? 'Minor Damage' : 'Normal';

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
      {/* Hidden File Input for Video Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        onChange={onFileInputChange}
        className="hidden"
      />

      {/* Main Camera Feed & Edge Analysis Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left 8 Cols: Camera Viewport */}
        <div className="lg:col-span-8 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[12px] overflow-hidden shadow-[var(--shadow-card)] flex flex-col justify-between">
          {/* Viewport Top Bar */}
          <div className="px-4 py-3 bg-[var(--bg-surface-raised)] border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3 text-[13px]">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-2 h-2 rounded-full bg-[var(--status-critical)] animate-soft-pulse shrink-0" />
              <span className="font-semibold text-[var(--text-primary)] truncate">
                {feedMode === 'live'
                  ? 'LIVE WEBCAM STREAM'
                  : `INSPECTION FEED: ${videoFileName}`}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              {/* Upload Video Button */}
              <button
                id="btn-upload-video"
                onClick={() => fileInputRef.current?.click()}
                className="btn-secondary h-[28px] px-2.5 text-[12px] flex items-center gap-1.5"
                title="Upload MP4/WebM inspection video"
              >
                <Upload className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>Upload Video</span>
              </button>

              {/* Sample Reset Button if custom file is loaded */}
              {!isSampleLoaded && (
                <button
                  onClick={handleLoadSampleVideo}
                  className="btn-secondary h-[28px] px-2 text-[12px] flex items-center gap-1"
                  title="Reload sample conveyor video"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span className="hidden sm:inline">Sample</span>
                </button>
              )}

              {/* Feed Mode Toggle: Recorded vs Live Camera */}
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
                  Recorded
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
                  <span>Live Cam</span>
                </button>
              </div>

              {/* HUD Overlay Toggle */}
              <button
                onClick={() => setIsScanning(!isScanning)}
                className={`px-2.5 py-1 rounded-[6px] text-[12px] font-medium flex items-center gap-1.5 transition-colors ${
                  isScanning ? 'badge-status-healthy h-[28px]' : 'btn-secondary h-[28px]'
                }`}
              >
                <Scan className="w-3.5 h-3.5" />
                <span>{isScanning ? 'HUD' : 'Off'}</span>
              </button>
            </div>
          </div>

          {/* Video / Camera Display Area with Drag & Drop */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`relative aspect-video bg-black flex items-center justify-center overflow-hidden transition-all ${
              isDragging ? 'ring-4 ring-[var(--accent-primary)] ring-inset' : ''
            }`}
          >
            {/* Hidden analysis canvas for non-blocking heuristic edge & anomaly detection */}
            <canvas ref={analysisCanvasRef} className="hidden" aria-hidden="true" />

            {/* Drag and Drop Active Overlay */}
            {isDragging && (
              <div className="absolute inset-0 bg-black/80 z-30 flex flex-col items-center justify-center p-6 text-center">
                <Upload className="w-10 h-10 text-[var(--accent-primary)] mb-2 animate-bounce" />
                <p className="text-[14px] font-bold text-[var(--text-primary)]">
                  Drop video file here to begin inspection
                </p>
                <p className="text-[12px] text-[var(--text-secondary)] font-mono mt-1">
                  Supports MP4, WebM, MOV
                </p>
              </div>
            )}

            {/* Empty State: Prompt user to upload if no video is selected */}
            {!videoSourceUrl && feedMode === 'recorded' && (
              <div className="absolute inset-0 bg-[var(--bg-surface-raised)] flex flex-col items-center justify-center p-8 text-center z-20">
                <div className="w-14 h-14 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center mb-3 text-[var(--accent-primary)]">
                  <FileVideo className="w-7 h-7" />
                </div>
                <h3 className="text-[16px] font-semibold text-[var(--text-primary)] mb-1">
                  Upload a video to begin inspection
                </h3>
                <p className="text-[13px] text-[var(--text-secondary)] max-w-md mb-4 leading-relaxed">
                  Upload your conveyor belt inspection footage to automatically analyze edge density, detect tears or material spillage, and sync rupture risks with the 3D Digital Twin.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-primary h-[36px] px-4 text-[13px] flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Upload Inspection Video</span>
                  </button>
                  <button
                    onClick={handleLoadSampleVideo}
                    className="btn-secondary h-[36px] px-3.5 text-[13px]"
                  >
                    Load Calibrated Sample
                  </button>
                </div>
              </div>
            )}

            {/* CCTV Live Broadcast & REC Overlay */}
            <div className="absolute top-3 right-3 z-20 flex items-center gap-2 px-2.5 py-1 rounded-[6px] bg-black/80 border border-white/10 backdrop-blur-sm pointer-events-none">
              <span className="w-2 h-2 rounded-full bg-[var(--status-critical)] animate-soft-pulse" />
              <span className="text-[11px] font-mono font-bold text-[var(--status-critical)] tracking-wider">REC</span>
              <span className="text-[11px] font-mono text-[var(--text-secondary)] border-l border-white/10 pl-2">
                {cctvTimestamp}
              </span>
            </div>

            {/* Video Player */}
            <video
              ref={videoRef}
              src={feedMode === 'recorded' && videoSourceUrl ? videoSourceUrl : undefined}
              autoPlay
              loop={feedMode === 'recorded'}
              playsInline
              muted
              crossOrigin="anonymous"
              onError={() => {}}
              onLoadedData={() => {}}
              className="w-full h-full object-cover"
            />

            {/* Fallback image if video fails to load */}
            {videoLoadError && feedMode === 'recorded' && (
              <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center p-6 text-center z-10">
                <AlertTriangle className="w-8 h-8 text-[var(--status-warning)] mb-2" />
                <p className="text-[13px] text-[var(--text-primary)] font-medium">
                  Video feed unavailable ({videoFileName})
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-primary h-[32px] px-3 text-[12px] flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Video</span>
                  </button>
                  <button
                    onClick={handleLoadSampleVideo}
                    className="btn-secondary h-[32px] px-3 text-[12px]"
                  >
                    Load Sample Video
                  </button>
                </div>
              </div>
            )}

            {/* Laser Line Pulse Animation */}
            {isScanning && (
              <div
                className={`absolute inset-x-0 h-0.5 pointer-events-none top-1/3 ${
                  detection.defectType === 'Material Spillage'
                    ? 'bg-gradient-to-r from-transparent via-orange-500 to-transparent shadow-[0_0_12px_#f97316] animate-soft-pulse'
                    : detection.defectType === 'Crack/Tear'
                    ? 'bg-gradient-to-r from-transparent via-[var(--status-critical)] to-transparent shadow-[0_0_12px_var(--status-critical)] animate-soft-pulse'
                    : 'bg-gradient-to-r from-transparent via-[var(--accent-primary)] to-transparent shadow-[0_0_8px_var(--accent-primary)] opacity-60'
                }`}
              />
            )}

            {/* Bounding Box Overlay for detected anomalies */}
            {isScanning && detection.bbox && (
              <div
                className={`absolute border-2 pointer-events-none transition-all duration-300 z-10 ${
                  detection.defectType === 'Material Spillage'
                    ? 'border-orange-500 bg-[rgba(249,115,22,0.18)] shadow-[0_0_16px_rgba(249,115,22,0.5)]'
                    : detection.defectType === 'Crack/Tear'
                    ? 'border-[var(--status-critical)] bg-[rgba(241,54,54,0.18)] shadow-[0_0_16px_rgba(241,54,54,0.5)]'
                    : 'border-[var(--status-warning)] bg-[rgba(245,158,11,0.18)] shadow-[0_0_16px_rgba(245,158,11,0.5)]'
                }`}
                style={{
                  left: `${detection.bbox.x}%`,
                  top: `${detection.bbox.y}%`,
                  width: `${detection.bbox.width}%`,
                  height: `${detection.bbox.height}%`,
                }}
              >
                <div
                  className={`absolute -top-6 left-0 px-2 py-0.5 rounded-[4px] text-white text-[10px] font-bold whitespace-nowrap shadow-md ${
                    detection.defectType === 'Material Spillage'
                      ? 'bg-orange-600'
                      : detection.defectType === 'Crack/Tear'
                      ? 'bg-[var(--status-critical)]'
                      : 'bg-amber-600'
                  }`}
                >
                  {detection.defectLabel} — {detection.confidence}% confidence
                </div>
              </div>
            )}

            {/* Clean Surface Badge */}
            {isScanning && !detection.bbox && (
              <div className="absolute top-3 left-3 px-3 py-1 rounded-[6px] bg-black/75 border border-[rgba(16,185,129,0.3)] text-[var(--status-healthy)] text-[12px] font-semibold flex items-center gap-2 backdrop-blur-sm z-10">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-healthy)]" />
                <span>Nominal Surface Condition (98.4% Confidence)</span>
              </div>
            )}

            {/* Viewport HUD */}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] font-mono text-[var(--text-secondary)] bg-black/75 backdrop-blur-sm px-3.5 py-1.5 rounded-[6px] border border-white/10 pointer-events-none z-10">
              <div className="flex items-center gap-4">
                <span>FPS: 59.8</span>
                <span
                  className={
                    detection.defectType === 'Crack/Tear'
                      ? 'text-[var(--status-critical)] font-bold'
                      : detection.defectType === 'Material Spillage'
                      ? 'text-orange-400 font-bold'
                      : detection.defectType === 'Misalignment/Edge Wear'
                      ? 'text-[var(--status-warning)] font-bold'
                      : 'text-[var(--status-healthy)] font-bold'
                  }
                >
                  DEFECT: {detection.defectType.toUpperCase()}
                </span>
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
                <span>{cameraError}</span>
              </div>
            )}
          </div>

          {/* Bottom Bar: Manual Simulate Detection Buttons (Manual Demo Override) */}
          <div className="p-[16px] bg-[var(--bg-surface-raised)] border-t border-[var(--border-subtle)]">
            <div className="text-[12px] font-medium text-[var(--text-tertiary)] uppercase tracking-[0.06em] mb-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>Test Defect Simulator (Manual Demonstration Mode):</span>
              </div>
              <span className="text-[11px] text-[var(--text-tertiary)] font-mono lowercase">
                background analyzer active (380ms)
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <button
                id="btn-simulate-spillage"
                onClick={() => triggerManualDefectTest('Material Spillage')}
                className="p-2.5 rounded-[6px] bg-orange-950/40 hover:bg-orange-900/50 border border-orange-500/40 text-left transition-colors"
              >
                <div className="text-[12px] font-semibold text-orange-400">🟠 Material Spillage</div>
                <div className="text-[11px] text-[var(--text-tertiary)] font-mono">Score: 84 | Conf: 84%</div>
              </button>

              <button
                id="btn-simulate-crack"
                onClick={() => triggerManualDefectTest('Crack/Tear')}
                className="p-2.5 rounded-[6px] bg-[var(--status-critical-bg)] hover:bg-opacity-80 border border-[rgba(241,54,54,0.4)] text-left transition-colors"
              >
                <div className="text-[12px] font-semibold text-[var(--status-critical)]">🔴 Crack / Tear</div>
                <div className="text-[11px] text-[var(--text-tertiary)] font-mono">Score: 90 | Conf: 92%</div>
              </button>

              <button
                id="btn-simulate-wear"
                onClick={() => triggerManualDefectTest('Misalignment/Edge Wear')}
                className="p-2.5 rounded-[6px] bg-[var(--status-warning-bg)] hover:bg-opacity-80 border border-[rgba(245,158,11,0.4)] text-left transition-colors"
              >
                <div className="text-[12px] font-semibold text-[var(--status-warning)]">⚠️ Edge Wear</div>
                <div className="text-[11px] text-[var(--text-tertiary)] font-mono">Score: 50 | Conf: 78%</div>
              </button>

              <button
                id="btn-simulate-normal"
                onClick={() => triggerManualDefectTest('Normal')}
                className="p-2.5 rounded-[6px] bg-[var(--bg-surface)] hover:bg-[var(--border-subtle)] border border-[var(--border-subtle)] text-left transition-colors"
              >
                <div className="text-[12px] font-semibold text-[var(--status-healthy)]">✓ Reset Normal</div>
                <div className="text-[11px] text-[var(--text-tertiary)] font-mono">Score: 0 | Clean Belt</div>
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
              {getStatusBadge(currentStatus)}
            </div>

            <div className="space-y-3 text-[13px]">
              <div className="bg-[var(--bg-surface-raised)] p-3 rounded-[8px] border border-[var(--border-subtle)] space-y-2">
                <div className="flex justify-between">
                  <span className="text-[var(--text-tertiary)]">Condition:</span>
                  <span className="font-semibold text-[var(--text-primary)]">{currentCondition}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-tertiary)]">Confidence:</span>
                  <span className="font-mono font-bold text-[var(--accent-primary)]">{currentConfidence}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-tertiary)]">Camera Risk:</span>
                  <span className="font-mono font-bold text-[var(--status-critical)]">{currentCameraRisk}/100</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-tertiary)]">Source:</span>
                  <span className="font-mono text-[var(--text-secondary)] truncate max-w-[170px]">{videoFileName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-tertiary)]">Timestamp:</span>
                  <span className="font-mono text-[var(--text-secondary)]">{currentTimestamp}</span>
                </div>
              </div>

              {/* Edge Inference Spec */}
              <div className="p-3 rounded-[8px] bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)] text-[12px] space-y-1 text-[var(--text-secondary)]">
                <div className="font-semibold text-[var(--text-primary)]">Defect Detection Specs:</div>
                {currentSpecs.map((spec, idx) => (
                  <div key={idx} className={spec.includes('ACTIVE') ? 'text-[var(--accent-primary)] font-medium' : ''}>
                    • {spec}
                  </div>
                ))}
              </div>

              {/* Action Recommendation */}
              <div className="p-3 rounded-[8px] bg-[var(--accent-primary-muted)] border border-[rgba(245,165,36,0.25)] text-[13px] leading-[1.5]">
                <strong className="block font-semibold text-[var(--accent-primary)] mb-1">
                  Maintenance Recommendation:
                </strong>
                <span className="text-[var(--text-primary)]">{currentRecommendation}</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[var(--border-subtle)] text-[11px] text-[var(--text-tertiary)] flex items-center justify-between font-mono">
            <span>Location: {currentLocation}</span>
            <span>ID: {activeFrame.id}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
