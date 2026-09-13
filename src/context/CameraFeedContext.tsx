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
  location: 'Joint 1 — Transfer Point / Skirtboard',
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
  activeFrame: INITIAL_CAMERA_FRAMES[1],
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
  const [activeFrame, setActiveFrame] = useState<CameraInspection>(INITIAL_CAMERA_FRAMES[1]);
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
  const candidateStatusRef = useRef<{ defectType: DefectCategory; count: number }>({
    defectType: 'Normal',
    count: 0,
  });
  const currentDefectTypeRef = useRef<DefectCategory>('Normal');
  const lastAlertTimestampRef = useRef<number>(0);

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

    baselineEdgeCountsRef.current = [];
    candidateStatusRef.current = { defectType: 'Normal', count: 0 };
    currentDefectTypeRef.current = 'Normal';
    setLiveAnomalyScore(0);
    setDetection(DEFAULT_DETECTION);

    if (videoRef.current) {
      videoRef.current.src = objectUrl;
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  }, []);

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

    baselineEdgeCountsRef.current = [];
    candidateStatusRef.current = { defectType: 'Normal', count: 0 };
    currentDefectTypeRef.current = 'Normal';
    setLiveAnomalyScore(10);
    setDetection(DEFAULT_DETECTION);

    if (videoRef.current) {
      videoRef.current.src = './assets/belt-inspection.mp4';
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  }, []);

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
  }, [feedMode, videoSourceUrl]);

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

  // Continuous Frame Analysis Loop (Runs every 380ms)
  useEffect(() => {
    if (!isScanning) return;

    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.paused) return;

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

        // Expected belt track region:
        // Conveyor belt is centered between x: 16%..86%, y: 20%..82%
        const beltX1 = Math.round(width * 0.16);
        const beltX2 = Math.round(width * 0.86);
        const beltY1 = Math.round(height * 0.20);
        const beltY2 = Math.round(height * 0.82);

        let insideEdges = 0;
        let outsideEdges = 0;
        let leftOutEdges = 0;
        let rightOutEdges = 0;

        let minOutX = width;
        let maxOutX = 0;
        let minOutY = height;
        let maxOutY = 0;

        for (let y = 3; y < height - 3; y++) {
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

            if (mag > 45) {
              const isInside = x >= beltX1 && x <= beltX2 && y >= beltY1 && y <= beltY2;
              if (isInside) {
                insideEdges++;
              } else {
                outsideEdges++;
                if (x < beltX1) leftOutEdges++;
                if (x > beltX2) rightOutEdges++;
                if (x < minOutX) minOutX = x;
                if (x > maxOutX) maxOutX = x;
                if (y < minOutY) minOutY = y;
                if (y > maxOutY) maxOutY = y;
              }
            }
          }
        }

        // Rolling baseline of outside edge activity (to detect when outside edges spike)
        const baselineBuf = baselineEdgeCountsRef.current;
        let baselineAvg = outsideEdges;
        if (baselineBuf.length > 0) {
          baselineAvg = baselineBuf.reduce((a, b) => a + b, 0) / baselineBuf.length;
        } else {
          baselineBuf.push(outsideEdges);
        }

        if (outsideEdges < 30 || baselineBuf.length < 5) {
          baselineBuf.push(outsideEdges);
          if (baselineBuf.length > 20) baselineBuf.shift();
        }

        // Defect Classification Logic:
        let defectType: DefectCategory = 'Normal';
        let anomalyScore = 12;
        let confidence = 98;
        let defectLabel = 'Nominal Belt Surface — Clean Tracking';
        let bbox: CameraDefectInfo['bbox'];
        let status: CameraDefectInfo['status'] = 'Normal';
        let severity: CameraDefectInfo['severity'] = 'Healthy';
        let cameraScore = 0;

        // 1. MATERIAL SPILLAGE DETECTION:
        // Spillage is characterized by significant edge/texture density appearing OUTSIDE
        // the expected belt region (ore pellets spilling over the side flange/skirtboard).
        // On the provided sample video, outsideEdges jumps to ~260 along x=3%..12%, y=30%..62% between 3.9s and 7.1s.
        if (outsideEdges > 35 || (outsideEdges > 25 && (leftOutEdges > 20 || rightOutEdges > 20))) {
          defectType = 'Material Spillage';
          status = 'Spillage Detected';
          severity = 'Warning';
          cameraScore = 82;
          anomalyScore = Math.min(96, Math.round(74 + Math.min(22, (outsideEdges / 250) * 20)));
          confidence = anomalyScore;
          const isLeft = leftOutEdges >= rightOutEdges;
          defectLabel = isLeft
            ? 'Material Spillage: Left Flange Overflow'
            : 'Material Spillage: Right Skirt Overflow';

          const bx = Math.max(2, Math.min(80, Math.round((minOutX / width) * 100)));
          const by = Math.max(5, Math.min(75, Math.round((minOutY / height) * 100)));
          const bw = Math.max(14, Math.min(45, Math.round(((maxOutX - minOutX) / width) * 100) + 6));
          const bh = Math.max(18, Math.min(55, Math.round(((maxOutY - minOutY) / height) * 100) + 6));

          bbox = {
            x: bx,
            y: by,
            width: bw,
            height: bh,
            label: `${defectLabel} (${confidence}%)`,
          };
        }
        // 2. CRACK / TEAR DETECTION:
        // Sharp irregular dark lines appearing INSIDE the belt region
        else if (insideEdges > 65) {
          defectType = 'Crack/Tear';
          status = 'Crack Detected';
          severity = 'Critical';
          cameraScore = 90;
          anomalyScore = Math.min(96, Math.round(76 + (insideEdges / 200) * 20));
          confidence = anomalyScore;
          defectLabel = 'Crack/Tear: Longitudinal Separation';
          bbox = {
            x: 28,
            y: 35,
            width: 44,
            height: 38,
            label: `Crack/Tear Detected (${confidence}%)`,
          };
        }
        // 3. TRACKING MISALIGNMENT / EDGE WEAR:
        // Persistent asymmetry between left and right side activity
        else if (Math.abs(leftOutEdges - rightOutEdges) > 22) {
          defectType = 'Misalignment/Edge Wear';
          status = 'Minor Wear';
          severity = 'Warning';
          cameraScore = 45;
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

        setLiveAnomalyScore(anomalyScore);

        // Debounce: sustain for at least 2 consecutive analysis cycles (~760ms)
        // This reliably catches 2-3s real defect segments while filtering single-frame noise
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
    }, 380);

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
