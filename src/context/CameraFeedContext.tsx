import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { CameraInspection, SensorData, CombinedPrediction, DefectCategory } from '../types';
import {
  INITIAL_CAMERA_FRAMES,
  calculateSensorRiskScore,
  evaluateCombinedPrediction,
} from '../utils/conveyorLogic';

export interface CameraDefectInfo {
  defectType: DefectCategory;
  status: 'Normal' | 'Minor Wear' | 'Crack Detected' | 'Spillage Detected';
  confidence: number;
  anomalyScore: number;
  defectLabel: string;
  bbox?: { x: number; y: number; width: number; height: number; label: string };
  snapshotUrl?: string;
  timestamp: string;
  location: string;
  severity: 'Healthy' | 'Warning' | 'Critical';
  cameraScore: number;
}

interface CameraFeedContextType {
  videoSourceUrl: string | null;
  videoFileName: string;
  isSampleLoaded: boolean;
  feedMode: 'recorded' | 'live';
  isScanning: boolean;
  cameraError: string | null;
  videoLoadError: boolean;
  cctvTimestamp: string;
  detection: CameraDefectInfo;
  liveAnomalyScore: number;
  frames: CameraInspection[];
  activeFrame: CameraInspection;
  videoRef: React.RefObject<HTMLVideoElement>;
  analysisCanvasRef: React.RefObject<HTMLCanvasElement>;
  setFeedMode: (mode: 'recorded' | 'live') => void;
  setIsScanning: (scanning: boolean) => void;
  handleVideoUpload: (file: File) => void;
  handleLoadSampleVideo: () => void;
  setActiveFrame: (frame: CameraInspection) => void;
  triggerManualDefectTest: (type: DefectCategory) => void;
}

const DEFAULT_DETECTION: CameraDefectInfo = {
  defectType: 'Normal',
  status: 'Normal',
  confidence: 98,
  anomalyScore: 10,
  defectLabel: 'Nominal Belt Surface — Clean Tracking',
  timestamp: 'Just now',
  location: 'Joint 1 — Transfer Point (Cam #1)',
  severity: 'Healthy',
  cameraScore: 0,
};

const CameraFeedContext = createContext<CameraFeedContextType | null>(null);

const FALLBACK_CONTEXT_VALUE: CameraFeedContextType = {
  videoSourceUrl: './assets/belt-inspection.mp4',
  videoFileName: 'belt-inspection.mp4 (Sample)',
  isSampleLoaded: true,
  feedMode: 'recorded',
  isScanning: true,
  cameraError: null,
  videoLoadError: false,
  cctvTimestamp: '',
  detection: DEFAULT_DETECTION,
  liveAnomalyScore: 10,
  frames: INITIAL_CAMERA_FRAMES,
  activeFrame: INITIAL_CAMERA_FRAMES[0],
  videoRef: { current: null },
  analysisCanvasRef: { current: null },
  setFeedMode: () => {},
  setIsScanning: () => {},
  handleVideoUpload: () => {},
  handleLoadSampleVideo: () => {},
  setActiveFrame: () => {},
  triggerManualDefectTest: () => {},
};

export const useCameraFeed = (): CameraFeedContextType => {
  const context = useContext(CameraFeedContext);
  if (!context) {
    console.warn('useCameraFeed was called outside CameraFeedProvider; using fallback context');
    return FALLBACK_CONTEXT_VALUE;
  }
  return context;
};

interface CameraFeedProviderProps {
  children: React.ReactNode;
  sensorData: SensorData;
  onDefectDetected?: (defect: CameraDefectInfo) => void;
  onUpdateCombinedPrediction?: (pred: CombinedPrediction) => void;
}

export const CameraFeedProvider: React.FC<CameraFeedProviderProps> = ({
  children,
  sensorData,
  onDefectDetected,
  onUpdateCombinedPrediction,
}) => {
  const [frames, setFrames] = useState<CameraInspection[]>(INITIAL_CAMERA_FRAMES);
  const [activeFrame, setActiveFrame] = useState<CameraInspection>(INITIAL_CAMERA_FRAMES[0]);
  const [feedMode, setFeedMode] = useState<'recorded' | 'live'>('recorded');
  const [isScanning, setIsScanning] = useState<boolean>(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [videoLoadError, setVideoLoadError] = useState<boolean>(false);
  const [cctvTimestamp, setCctvTimestamp] = useState<string>('');
  const [liveAnomalyScore, setLiveAnomalyScore] = useState<number>(10);

  // Video source state - persisted at context level
  const [videoSourceUrl, setVideoSourceUrl] = useState<string | null>('./assets/belt-inspection.mp4');
  const [videoFileName, setVideoFileName] = useState<string>('belt-inspection.mp4 (Sample)');
  const [isSampleLoaded, setIsSampleLoaded] = useState<boolean>(true);

  // Live detection state
  const [detection, setDetection] = useState<CameraDefectInfo>(DEFAULT_DETECTION);

  // References
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analysisCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const createdObjectUrlRef = useRef<string | null>(null);

  // Baseline and debouncing
  const baselineEdgeCountsRef = useRef<number[]>([]);
  const calibrationFramesCountRef = useRef<number>(0);
  const prevFrameDataRef = useRef<Uint8ClampedArray | null>(null);
  const candidateStatusRef = useRef<{ defectType: DefectCategory; count: number }>({
    defectType: 'Normal',
    count: 0,
  });
  const currentDefectTypeRef = useRef<DefectCategory>('Normal');
  const lastAlertTimestampRef = useRef<number>(0);
  const manualOverrideUntilRef = useRef<number>(0);

  // Helper to cleanly reset baseline and calibration
  const resetCalibrationAndState = useCallback(() => {
    baselineEdgeCountsRef.current = [];
    calibrationFramesCountRef.current = 0;
    prevFrameDataRef.current = null;
    candidateStatusRef.current = { defectType: 'Normal', count: 0 };
    currentDefectTypeRef.current = 'Normal';
    manualOverrideUntilRef.current = 0;
    setLiveAnomalyScore(8);
    setDetection(DEFAULT_DETECTION);
  }, []);

  // CCTV timestamp clock
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

  // Handle Video Upload
  const handleVideoUpload = useCallback((file: File) => {
    if (createdObjectUrlRef.current) {
      URL.revokeObjectURL(createdObjectUrlRef.current);
    }
    const objectUrl = URL.createObjectURL(file);
    createdObjectUrlRef.current = objectUrl;

    setVideoSourceUrl(objectUrl);
    setVideoFileName(file.name);
    setIsSampleLoaded(false);
    setFeedMode('recorded');
    setVideoLoadError(false);

    resetCalibrationAndState();

    if (videoRef.current) {
      videoRef.current.src = objectUrl;
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  }, [resetCalibrationAndState]);

  // Handle Load Sample Video
  const handleLoadSampleVideo = useCallback(() => {
    if (createdObjectUrlRef.current) {
      URL.revokeObjectURL(createdObjectUrlRef.current);
      createdObjectUrlRef.current = null;
    }
    setVideoSourceUrl('./assets/belt-inspection.mp4');
    setVideoFileName('belt-inspection.mp4 (Sample)');
    setIsSampleLoaded(true);
    setFeedMode('recorded');
    setVideoLoadError(false);

    resetCalibrationAndState();

    if (videoRef.current) {
      videoRef.current.src = './assets/belt-inspection.mp4';
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  }, [resetCalibrationAndState]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (createdObjectUrlRef.current) {
        URL.revokeObjectURL(createdObjectUrlRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Feed mode stream management (Live Webcam vs Recorded)
  useEffect(() => {
    resetCalibrationAndState();
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
            setCameraError('Camera access unavailable (check permissions)');
            setFeedMode('recorded');
          });
      } else {
        setCameraError('Camera API unsupported in this environment');
        setFeedMode('recorded');
      }
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        if (videoSourceUrl) {
          videoRef.current.src = videoSourceUrl;
          videoRef.current.play().catch(() => {});
        }
      }
    }
  }, [feedMode, videoSourceUrl, resetCalibrationAndState]);

  // Combined score calculator & defect alert trigger
  const processDefectChange = useCallback(
    (defect: CameraDefectInfo) => {
      setDetection(defect);
      currentDefectTypeRef.current = defect.defectType;

      // 1. Convert camera status to risk score
      const cameraScore = defect.cameraScore;

      // 2. Combine with sensor risk score: finalScore = 0.6 * sensor + 0.4 * camera
      const sensorRisk = calculateSensorRiskScore(sensorData);
      const finalScore = Math.round((0.6 * sensorRisk + 0.4 * cameraScore) * 10) / 10;

      const finalStatus: 'Critical' | 'Warning' | 'Healthy' =
        finalScore > 70 ? 'Critical' : finalScore > 40 ? 'Warning' : 'Healthy';

      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

      // Update frame record
      const mappedDefectType: CameraInspection['defect_type'] =
        defect.defectType === 'Material Spillage'
          ? 'Material Spillage / Skirt Overflow'
          : defect.defectType === 'Crack/Tear'
          ? 'Deep Splice Separation'
          : defect.defectType === 'Misalignment/Edge Wear'
          ? 'Tracking Misalignment / Edge Wear'
          : 'No Defect / Clean Surface';

      const updatedInspection: CameraInspection = {
        id: `CAM-${Date.now().toString().slice(-4)}`,
        timestamp: timeStr,
        status: finalStatus === 'Critical' ? 'Critical Damage' : finalStatus === 'Warning' ? 'Minor Damage' : 'Normal',
        defect_type: mappedDefectType,
        confidence: defect.confidence,
        camera_risk_score: cameraScore,
        bbox: defect.bbox,
        imageUrl: defect.snapshotUrl || '',
        beltLocation: 'Joint 1 — Transfer Point (Cam #1)',
        snapshotUrl: defect.snapshotUrl,
      };

      setActiveFrame(updatedInspection);
      setFrames((prev) => [updatedInspection, ...prev.slice(0, 9)]);

      if (onUpdateCombinedPrediction) {
        const combined = evaluateCombinedPrediction(sensorData, updatedInspection);
        onUpdateCombinedPrediction(combined);
      }

      // Fire defect alert toast/event if transitioning to a warning or critical defect
      const nowMs = Date.now();
      if (defect.defectType !== 'Normal' && nowMs - lastAlertTimestampRef.current > 5000) {
        lastAlertTimestampRef.current = nowMs;
        if (onDefectDetected) {
          onDefectDetected(defect);
        }
      }
    },
    [sensorData, onDefectDetected, onUpdateCombinedPrediction]
  );

  // Manual defect test trigger for simulation
  const triggerManualDefectTest = useCallback(
    (type: DefectCategory) => {
      // Grant 6 seconds of manual override protection so manual clicks are not immediately undone by background analyzer
      manualOverrideUntilRef.current = Date.now() + 6000;
      candidateStatusRef.current = { defectType: type, count: 3 };

      let score = 0;
      let conf = 98;
      let label = 'Nominal Belt Surface';
      let bbox: CameraDefectInfo['bbox'];
      let status: CameraDefectInfo['status'] = 'Normal';
      let severity: CameraDefectInfo['severity'] = 'Healthy';

      if (type === 'Material Spillage') {
        score = 84;
        conf = 84;
        label = 'Material Spillage: Left Flange Overflow';
        bbox = { x: 4, y: 32, width: 16, height: 40, label: 'Material Spillage: Left Flange Overflow' };
        status = 'Spillage Detected';
        severity = 'Warning';
      } else if (type === 'Crack/Tear') {
        score = 90;
        conf = 92;
        label = 'Crack/Tear: Longitudinal Separation';
        bbox = { x: 28, y: 36, width: 44, height: 42, label: 'Crack/Tear: Longitudinal Separation' };
        status = 'Crack Detected';
        severity = 'Critical';
      } else if (type === 'Misalignment/Edge Wear') {
        score = 50;
        conf = 78;
        label = 'Tracking Misalignment / Edge Wear';
        bbox = { x: 12, y: 22, width: 22, height: 50, label: 'Edge Wear / Misalignment' };
        status = 'Minor Wear';
        severity = 'Warning';
      }

      setLiveAnomalyScore(score);

      let snapshot: string | undefined;
      if (analysisCanvasRef.current) {
        try {
          snapshot = analysisCanvasRef.current.toDataURL('image/jpeg', 0.85);
        } catch {
          // ignore
        }
      }

      processDefectChange({
        defectType: type,
        status,
        confidence: conf,
        anomalyScore: score,
        defectLabel: label,
        bbox,
        snapshotUrl: snapshot,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        location: 'Joint 1 — Transfer Point / Skirtboard',
        severity,
        cameraScore: score,
      });
    },
    [processDefectChange]
  );

  // Continuous Frame Analysis Loop (Runs every 350ms)
  useEffect(() => {
    if (!isScanning) return;

    const interval = setInterval(() => {
      const video = videoRef.current;
      // Guard 1: Ignore uninitialized, buffering, or paused states
      if (!video || video.readyState < 2 || video.paused || video.ended) return;
      if (video.videoWidth === 0 || video.videoHeight === 0) return;

      const canvas = analysisCanvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      canvas.width = 160;
      canvas.height = 90;
      ctx.drawImage(video, 0, 0, 160, 90);

      try {
        const frame = ctx.getImageData(0, 0, 160, 90);
        const { data, width, height } = frame;

        // Grayscale conversion
        const gray = new Uint8ClampedArray(width * height);
        for (let i = 0; i < width * height; i++) {
          gray[i] = (data[i * 4] * 77 + data[i * 4 + 1] * 150 + data[i * 4 + 2] * 29) >> 8;
        }

        // Conveyor belt region geometry:
        // Central carrying surface: x: 16%..84%, y: 15%..72%
        // Bottom spill/discharge area ("material niche gir raha hai"): y >= 72%
        // Left & right overflow flanges: x <= 16%, x >= 84%
        const beltX1 = Math.round(width * 0.16);
        const beltX2 = Math.round(width * 0.84);
        const beltY1 = Math.round(height * 0.15);
        const beltY2 = Math.round(height * 0.72);

        // Frame-to-frame temporal motion analysis
        const prevGray = prevFrameDataRef.current;
        let bottomMotion = 0;
        let flankMotion = 0;
        let insideMotion = 0;

        if (prevGray && prevGray.length === gray.length) {
          for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
              const idx = y * width + x;
              const diff = Math.abs(gray[idx] - prevGray[idx]);
              if (diff > 14) {
                if (y >= beltY2) {
                  bottomMotion++;
                } else if (x <= beltX1 || x >= beltX2) {
                  flankMotion++;
                } else if (y >= beltY1) {
                  insideMotion++;
                }
              }
            }
          }
        }
        prevFrameDataRef.current = new Uint8ClampedArray(gray);

        // Edge detection & Crack Fissure analysis
        let insideEdges = 0;
        let insideStrongEdges = 0;
        let crackFissureCount = 0;

        let minCrackX = width;
        let maxCrackX = 0;
        let minCrackY = height;
        let maxCrackY = 0;

        let bottomEdges = 0;
        let leftOutEdges = 0;
        let rightOutEdges = 0;

        let minSpillX = width;
        let maxSpillX = 0;
        let minSpillY = height;
        let maxSpillY = 0;

        for (let y = 2; y < height - 2; y++) {
          for (let x = 2; x < width - 2; x++) {
            const idx = y * width + x;
            const gx =
              -gray[idx - width - 1] + gray[idx - width + 1] -
              2 * gray[idx - 1] + 2 * gray[idx + 1] -
              gray[idx + width - 1] + gray[idx + width + 1];
            const gy =
              -gray[idx - width - 1] - 2 * gray[idx - width] - gray[idx - width + 1] +
              gray[idx + width - 1] + 2 * gray[idx + width] + gray[idx + width + 1];
            const mag = Math.abs(gx) + Math.abs(gy);

            // Spatial assignment
            const isBottomSpill = y >= beltY2;
            const isLeftSpill = x <= beltX1 && y >= beltY1;
            const isRightSpill = x >= beltX2 && y >= beltY1;
            const isInsideBelt = x > beltX1 && x < beltX2 && y >= beltY1 && y < beltY2;

            if (mag > 28) {
              if (isBottomSpill) {
                bottomEdges++;
                if (x < minSpillX) minSpillX = x;
                if (x > maxSpillX) maxSpillX = x;
                if (y < minSpillY) minSpillY = y;
                if (y > maxSpillY) maxSpillY = y;
              } else if (isLeftSpill) {
                leftOutEdges++;
                if (x < minSpillX) minSpillX = x;
                if (x > maxSpillX) maxSpillX = x;
                if (y < minSpillY) minSpillY = y;
                if (y > maxSpillY) maxSpillY = y;
              } else if (isRightSpill) {
                rightOutEdges++;
                if (x < minSpillX) minSpillX = x;
                if (x > maxSpillX) maxSpillX = x;
                if (y < minSpillY) minSpillY = y;
                if (y > maxSpillY) maxSpillY = y;
              } else if (isInsideBelt) {
                insideEdges++;
                if (mag > 42) insideStrongEdges++;

                // Fissure detection: dark valley / crack boundary on rubber
                const centerVal = gray[idx];
                const isHorizValley =
                  gray[idx - 2] - centerVal > 11 && gray[idx + 2] - centerVal > 11;
                const isVertValley =
                  gray[idx - 2 * width] - centerVal > 11 && gray[idx + 2 * width] - centerVal > 11;
                const isDirectionalTear = Math.abs(gx) > 28 || Math.abs(gy) > 28;

                if (isHorizValley || isVertValley || (mag > 42 && isDirectionalTear)) {
                  crackFissureCount++;
                  if (x < minCrackX) minCrackX = x;
                  if (x > maxCrackX) maxCrackX = x;
                  if (y < minCrackY) minCrackY = y;
                  if (y > maxCrackY) maxCrackY = y;
                }
              }
            }
          }
        }

        // Fast calibration: only requires 2 frames (~700ms) to settle
        calibrationFramesCountRef.current += 1;
        const isCalibrating = calibrationFramesCountRef.current < 2;

        let defectType: DefectCategory = 'Normal';
        let anomalyScore = 8;
        let confidence = 98;
        let defectLabel = 'Nominal Belt Surface — Clean Tracking';
        let bbox: CameraDefectInfo['bbox'];
        let status: CameraDefectInfo['status'] = 'Normal';
        let severity: CameraDefectInfo['severity'] = 'Healthy';
        let cameraScore = 0;

        if (!isCalibrating) {
          const totalSpillEdges = bottomEdges + leftOutEdges + rightOutEdges;
          const totalSpillMotion = bottomMotion + flankMotion;

          // 1. MATERIAL SPILLAGE (Material falling down underneath / spilling over skirtboards)
          const isFallingDown =
            bottomEdges >= 18 ||
            bottomMotion >= 22 ||
            (bottomEdges >= 10 && bottomMotion >= 10);
          const isFlangeOverflow =
            leftOutEdges >= 22 ||
            rightOutEdges >= 22 ||
            (leftOutEdges >= 12 && flankMotion >= 12) ||
            (rightOutEdges >= 12 && flankMotion >= 12);
          const isGeneralSpillage = totalSpillEdges >= 36 || totalSpillMotion >= 45;

          if (isFallingDown || isFlangeOverflow || isGeneralSpillage) {
            defectType = 'Material Spillage';
            status = 'Spillage Detected';
            severity = 'Warning';
            cameraScore = 84;
            anomalyScore = Math.min(96, Math.max(78, Math.round(74 + (totalSpillEdges + totalSpillMotion) * 0.25)));
            confidence = anomalyScore;

            if (isFallingDown || bottomEdges > Math.max(leftOutEdges, rightOutEdges)) {
              defectLabel = 'Material Spillage: Chute Discharge Fall / Overflow';
              const bx = Math.max(4, Math.min(75, Math.round((minSpillX / width) * 100)));
              const by = Math.max(60, Math.min(80, Math.round((minSpillY / height) * 100)));
              const bw = Math.max(25, Math.min(70, Math.round(((maxSpillX - minSpillX) / width) * 100) + 8));
              const bh = Math.max(16, Math.min(35, Math.round(((maxSpillY - minSpillY) / height) * 100) + 8));
              bbox = { x: bx, y: by, width: bw, height: bh, label: `${defectLabel} (${confidence}%)` };
            } else if (leftOutEdges >= rightOutEdges) {
              defectLabel = 'Material Spillage: Left Flange Overflow';
              const bx = Math.max(2, Math.min(25, Math.round((minSpillX / width) * 100)));
              const by = Math.max(20, Math.min(70, Math.round((minSpillY / height) * 100)));
              const bw = Math.max(16, Math.min(30, Math.round(((maxSpillX - minSpillX) / width) * 100) + 6));
              const bh = Math.max(20, Math.min(50, Math.round(((maxSpillY - minSpillY) / height) * 100) + 6));
              bbox = { x: bx, y: by, width: bw, height: bh, label: `${defectLabel} (${confidence}%)` };
            } else {
              defectLabel = 'Material Spillage: Right Skirt Overflow';
              const bx = Math.max(70, Math.min(85, Math.round((minSpillX / width) * 100)));
              const by = Math.max(20, Math.min(70, Math.round((minSpillY / height) * 100)));
              const bw = Math.max(16, Math.min(30, Math.round(((maxSpillX - minSpillX) / width) * 100) + 6));
              const bh = Math.max(20, Math.min(50, Math.round(((maxSpillY - minSpillY) / height) * 100) + 6));
              bbox = { x: bx, y: by, width: bw, height: bh, label: `${defectLabel} (${confidence}%)` };
            }
          }
          // 2. CRACK / TEAR DETECTION (Rupture, tear, slit, splice parting inside belt body)
          else if (
            insideStrongEdges >= 22 ||
            crackFissureCount >= 12 ||
            (insideEdges >= 30 && crackFissureCount >= 6) ||
            insideEdges >= 42
          ) {
            defectType = 'Crack/Tear';
            status = 'Crack Detected';
            severity = 'Critical';
            cameraScore = 90;
            anomalyScore = Math.min(98, Math.max(82, Math.round(80 + (crackFissureCount + insideStrongEdges) * 0.35)));
            confidence = anomalyScore;
            defectLabel = 'Crack/Tear: Surface Separation';

            const bx = Math.max(16, Math.min(70, Math.round((minCrackX / width) * 100) - 2));
            const by = Math.max(18, Math.min(65, Math.round((minCrackY / height) * 100) - 2));
            const bw = Math.max(20, Math.min(55, Math.round(((maxCrackX - minCrackX) / width) * 100) + 6));
            const bh = Math.max(18, Math.min(45, Math.round(((maxCrackY - minCrackY) / height) * 100) + 6));

            bbox = {
              x: bx,
              y: by,
              width: bw,
              height: bh,
              label: `${defectLabel} (${confidence}%)`,
            };
          }
          // 3. TRACKING MISALIGNMENT / EDGE WEAR
          else if (
            Math.abs(leftOutEdges - rightOutEdges) >= 24 &&
            (leftOutEdges >= 18 || rightOutEdges >= 18)
          ) {
            defectType = 'Misalignment/Edge Wear';
            status = 'Minor Wear';
            severity = 'Warning';
            cameraScore = 50;
            anomalyScore = 52;
            confidence = 78;
            defectLabel = 'Tracking Misalignment / Edge Wear';
            bbox = {
              x: leftOutEdges > rightOutEdges ? 8 : 72,
              y: 20,
              width: 20,
              height: 50,
              label: `Tracking Misalignment (${confidence}%)`,
            };
          }
        }

        // Live anomaly score follows real detected level or rests at baseline
        setLiveAnomalyScore(anomalyScore);

        // Check if a manual button override is active
        const nowMs = Date.now();
        const isManualOverrideActive = nowMs < manualOverrideUntilRef.current;
        if (isManualOverrideActive) {
          return;
        }

        // Debounce: require 2 consecutive analysis cycles (~700ms) to lock in state change
        if (candidateStatusRef.current.defectType === defectType) {
          candidateStatusRef.current.count += 1;
        } else {
          candidateStatusRef.current = { defectType, count: 1 };
        }

        if (
          candidateStatusRef.current.count >= 2 &&
          currentDefectTypeRef.current !== defectType
        ) {
          let snapshot: string | undefined;
          try {
            snapshot = canvas.toDataURL('image/jpeg', 0.82);
          } catch {
            // ignore
          }

          const now = new Date();
          const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

          processDefectChange({
            defectType,
            status,
            confidence,
            anomalyScore,
            defectLabel,
            bbox,
            snapshotUrl: snapshot,
            timestamp: timeStr,
            location: 'Joint 1 — Transfer Point / Skirtboard',
            severity,
            cameraScore,
          });
        }
      } catch (e) {
        // Silent catch for canvas reading edge cases
      }
    }, 350);

    return () => clearInterval(interval);
  }, [isScanning, processDefectChange]);

  return (
    <CameraFeedContext.Provider
      value={{
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
        frames,
        activeFrame,
        videoRef,
        analysisCanvasRef,
        setFeedMode,
        setIsScanning,
        handleVideoUpload,
        handleLoadSampleVideo,
        setActiveFrame,
        triggerManualDefectTest,
      }}
    >
      {children}
    </CameraFeedContext.Provider>
  );
};
