import React, { useState, useEffect, useRef } from 'react';
import {
  Cpu,
  Layers,
  Zap,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Flame,
  Info,
  Sliders,
  Maximize2,
  RefreshCw,
} from 'lucide-react';
import { SensorData, CombinedPrediction, Severity } from '../types';
import { Conveyor3DScene } from './Conveyor3DScene';
import { useCameraFeed } from '../context/CameraFeedContext';

interface DigitalTwinViewProps {
  sensorData: SensorData;
  prediction: CombinedPrediction;
  onSelectComponent: (comp: SelectedTwinComponent) => void;
}

export interface SelectedTwinComponent {
  id: string;
  name: string;
  type: string;
  status: Severity;
  healthScore: number;
  readings: Record<string, string>;
  cameraStatus: string;
  recommendation: string;
  lastService: string;
  cycles: string;
  cameraDefectType?: string;
  cameraConfidence?: number;
  cameraSnapshotUrl?: string;
  cameraLocation?: string;
}

export const DigitalTwinView: React.FC<DigitalTwinViewProps> = ({
  sensorData,
  prediction,
  onSelectComponent,
}) => {
  const { detection } = useCameraFeed();
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [showFlowParticles, setShowFlowParticles] = useState<boolean>(true);
  const [activeHighlight, setActiveHighlight] = useState<string | null>(null);
  const [recentlyChanged, setRecentlyChanged] = useState<Record<string, boolean>>({});

  // Speed calculation: always subtly moving even when idling (minimum speed baseline)
  const effectiveSpeed = Math.max(0.6, sensorData.belt_speed);
  const isMoving = true;
  const animationDurationSec = Math.max(0.5, (4.2 / effectiveSpeed) * 1.6);

  // Determine component statuses based on sensor thresholds & combined prediction
  const motorSeverity: Severity =
    sensorData.temperature > 80 || sensorData.motor_current > 230
      ? 'critical'
      : sensorData.temperature > 60 || sensorData.motor_current > 195
      ? 'warning'
      : 'healthy';

  const drivePulleySeverity: Severity =
    sensorData.bearing_condition < 40 || sensorData.vibration > 5
      ? 'critical'
      : sensorData.bearing_condition < 60 || sensorData.vibration > 2
      ? 'warning'
      : 'healthy';

  const joint2Severity: Severity =
    prediction.final_score >= 60 || sensorData.vibration > 5
      ? 'critical'
      : prediction.final_score >= 30 || sensorData.vibration > 2.5
      ? 'warning'
      : 'healthy';

  // Joint #1 is directly monitored by Optical Camera #1
  const cameraDefectOnJ1 = detection.defectType !== 'Normal';
  const joint1Severity: Severity = cameraDefectOnJ1
    ? detection.defectType === 'Crack/Tear'
      ? 'critical'
      : 'warning'
    : prediction.final_score > 70
    ? 'critical'
    : prediction.final_score > 40
    ? 'warning'
    : 'healthy';

  const beltSurfaceSeverity: Severity =
    prediction.final_score >= 60
      ? 'critical'
      : prediction.final_score >= 30
      ? 'warning'
      : 'healthy';

  const tensionerSeverity: Severity =
    sensorData.looseness > 0.7 ? 'critical' : sensorData.looseness > 0.5 ? 'warning' : 'healthy';

  // Track status transitions to fire a 2-second highlight pulse when any component flips state
  const prevStatusesRef = useRef<Record<string, Severity>>({});
  useEffect(() => {
    const current: Record<string, Severity> = {
      motor: motorSeverity,
      drive_pulley: drivePulleySeverity,
      joint_2: joint2Severity,
      joint_1: joint1Severity,
      tensioner: tensionerSeverity,
    };

    const changes: Record<string, boolean> = {};
    let hadChange = false;

    Object.entries(current).forEach(([k, status]) => {
      if (prevStatusesRef.current[k] && prevStatusesRef.current[k] !== status) {
        changes[k] = true;
        hadChange = true;
      }
    });

    prevStatusesRef.current = current;

    if (hadChange) {
      setRecentlyChanged((prev) => ({ ...prev, ...changes }));
      const timer = setTimeout(() => {
        setRecentlyChanged((prev) => {
          const next = { ...prev };
          Object.keys(changes).forEach((key) => delete next[key]);
          return next;
        });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [motorSeverity, drivePulleySeverity, joint2Severity, joint1Severity, tensionerSeverity]);

  const getColor = (sev: Severity) => {
    switch (sev) {
      case 'critical':
        return '#ef4444';
      case 'warning':
        return '#f59e0b';
      case 'healthy':
      default:
        return '#10b981';
    }
  };

  const getStatusBadge = (sev: Severity) => {
    switch (sev) {
      case 'critical':
        return (
          <span className="badge-status-critical">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-critical)]" />
            Critical
          </span>
        );
      case 'warning':
        return (
          <span className="badge-status-warning">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-warning)]" />
            Warning
          </span>
        );
      case 'healthy':
      default:
        return (
          <span className="badge-status-healthy">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-healthy)]" />
            Optimal
          </span>
        );
    }
  };

  const handleComponentClick = (id: string) => {
    setActiveHighlight(id);
    switch (id) {
      case 'motor':
        onSelectComponent({
          id: 'MTR-01',
          name: 'Main Drive Electric Motor M-01 (450 kW)',
          type: 'Drive Unit / Squirrel-Cage Induction',
          status: motorSeverity,
          healthScore: Math.round(100 - (sensorData.temperature > 60 ? (sensorData.temperature - 60) * 2.5 : 5)),
          readings: {
            'Winding Temp': `${sensorData.temperature.toFixed(1)} °C`,
            'Current Draw': `${sensorData.motor_current.toFixed(1)} A`,
            'Frequency': `${(sensorData.belt_speed * 11.9).toFixed(1)} Hz`,
            'VFD Power Factor': '0.89',
          },
          cameraStatus: 'Visual enclosure intact; no smoke or thermal haze detected.',
          recommendation:
            motorSeverity === 'critical'
              ? 'EMERGENCY: Motor winding temperature exceeds insulation class F ceiling (80°C). Reduce throughput or initiate controlled stop.'
              : motorSeverity === 'warning'
              ? 'WARNING: Air intake filter pressure drop elevated. Clean ventilation louvers on next shift change.'
              : 'Nominal operation. Thermal gradient across rotor and bearings within standard ASTM limits.',
          lastService: '12 days ago (Lube renewal)',
          cycles: '14,280 continuous hrs',
        });
        break;

      case 'drive_pulley':
        onSelectComponent({
          id: 'PLY-DRV-01',
          name: 'Primary Drive Head Pulley (1,200mm Dia)',
          type: 'Lagged Drive Drum & Pillow Block Bearings',
          status: drivePulleySeverity,
          healthScore: Math.round(sensorData.bearing_condition),
          readings: {
            'Bearing Shock Pulse': `${sensorData.bearing_condition.toFixed(1)} pts`,
            'Radial Vibration': `${sensorData.vibration.toFixed(2)} mm/s`,
            'Ceramic Lagging Wear': '1.8 mm (Nominal)',
            'Shaft Alignment Runout': '0.04 mm',
          },
          cameraStatus: 'Ceramic diamond grooved lagging clean; no rubber carcass shedding observed.',
          recommendation:
            drivePulleySeverity === 'critical'
              ? 'CRITICAL: High-frequency acoustic emission indicates spalling in spherical roller bearing race. Prepare replacement pillow block assembly.'
              : drivePulleySeverity === 'warning'
              ? 'WARNING: Vibration harmonics suggest minor lagging wear or buildup. Inspect drum surface during washdown.'
              : 'Lagging adhesion and bearing lubrication film nominal.',
          lastService: '4 days ago (Auto-greaser recharge)',
          cycles: '3.8M drum revolutions',
        });
        break;

      case 'joint_2':
        onSelectComponent({
          id: 'JNT-02-SPL',
          name: 'Vulcanized Belt Splice Joint #2 (Hot Spliced)',
          type: 'Steel-Cord Hot Vulcanized Finger Splice (ST-4500)',
          status: joint2Severity,
          healthScore: Math.round(100 - prediction.final_score),
          readings: {
            'Splice Chatter Vibration': `${sensorData.vibration.toFixed(2)} mm/s`,
            'Step Delamination Gap': joint2Severity === 'critical' ? '4.8 mm' : joint2Severity === 'warning' ? '1.9 mm' : '0.2 mm',
            'Magnetic Cord Integrity': joint2Severity === 'critical' ? 'Broken cords: 2' : 'Steel cords continuous',
            'Estimated RUL': `${prediction.rul_hours} Operating Hours`,
          },
          cameraStatus:
            prediction.camera_defect || 'Optical line camera scanning splice finger adhesion.',
          recommendation:
            joint2Severity === 'critical'
              ? 'URGENT INTERVENTION: Deep splice delamination detected at finger joint seam! High probability of full transverse rupture under tension. Stop line immediately.'
              : joint2Severity === 'warning'
              ? 'WARNING: Minor step gap separation observed under acoustic chattering. Apply non-destructive magnetic scanning and clamp joint edge.'
              : 'Joint vulcanization seam smooth. No cord pull-out detected.',
          lastService: '42 days ago (Splice hot vulcanization cure)',
          cycles: '124,500 belt loop cycles',
        });
        break;

      case 'joint_1': {
        const isDefect = detection.defectType !== 'Normal';
        onSelectComponent({
          id: 'JNT-01-SPL',
          name: 'Belt Splice Joint #1 & Transfer Chute (Optical Cam #1)',
          type: 'Reinforced Rubber Splice & Transfer Point',
          status: isDefect
            ? detection.defectType === 'Crack/Tear'
              ? 'critical'
              : 'warning'
            : joint1Severity,
          healthScore: isDefect
            ? Math.max(15, 100 - detection.anomalyScore)
            : Math.round(100 - prediction.final_score * 0.8),
          readings: {
            'Surface Acoustic Pulse': '82 pts',
            'Optical Anomaly Score': `${detection.anomalyScore.toFixed(0)} / 100`,
            'Defect Classification': detection.defectType,
            'Detection Confidence': `${detection.confidence}%`,
            'Camera Station': 'Line-Scan Optical Camera #1 (Joint 1 / Skirtboard)',
          },
          cameraStatus: isDefect
            ? `${detection.defectLabel} (${detection.confidence}% confidence) detected at optical camera inspection station.`
            : 'No surface anomalies or edge tears detected in current video inspection.',
          recommendation:
            detection.defectType === 'Material Spillage'
              ? 'MATERIAL SPILLAGE WARNING: Pellet overflow detected along conveyor skirtboard near Joint #1 / Transfer chute. Inspect polyurethane skirt seals and adjust impact chute deflector.'
              : detection.defectType === 'Crack/Tear'
              ? 'CRITICAL TEAR: Longitudinal splice tear detected at Joint #1 vulcanization seam. Stop line immediately to prevent full belt rupture.'
              : detection.defectType === 'Misalignment/Edge Wear'
              ? 'WARNING: Edge wear / tracking misalignment detected. Inspect tracking idlers and belt guide rollers.'
              : 'Nominal fatigue status. Continue monitoring via automated line cameras.',
          lastService: '68 days ago',
          cycles: '189,000 cycles',
          cameraDefectType: detection.defectType,
          cameraConfidence: detection.confidence,
          cameraSnapshotUrl: detection.snapshotUrl,
          cameraLocation: 'Joint 1 — Transfer Point (Cam #1)',
        });
        break;
      }

      case 'tail_pulley':
        onSelectComponent({
          id: 'PLY-TL-02',
          name: 'Tail Return Pulley & Loading Chute Impact Bed',
          type: 'Wing Pulley with Impact Idler Cradle',
          status: 'healthy',
          healthScore: 92,
          readings: {
            'Impact Bed Sag': `${sensorData.looseness.toFixed(2)} sag`,
            'Chute Ore Throughput': `${(sensorData.overload * 65).toFixed(0)} tph`,
            'Chute Jerk Shock': `${sensorData.acceleration.toFixed(2)} m/s²`,
          },
          cameraStatus: 'Material flow centered on belt trough; no skirtboard trapping.',
          recommendation: 'Impact cradle polyurethane bars show even wear. Nominal.',
          lastService: '18 days ago',
          cycles: '1.2M revolutions',
        });
        break;

      case 'tensioner':
        onSelectComponent({
          id: 'TNS-TWR-01',
          name: 'Gravity Take-Up Tensioner Carriage & Counterweight',
          type: 'Vertical Tower with 18-Tonne Concrete Counterweight',
          status: tensionerSeverity,
          healthScore: Math.round(100 - sensorData.looseness * 80),
          readings: {
            'Belt Sag Index': `${sensorData.looseness.toFixed(2)}`,
            'Carriage Travel Height': `${(2.4 - sensorData.looseness * 1.5).toFixed(2)} m`,
            'Sheave Cable Tension': '88.5 kN',
          },
          cameraStatus: 'Guide rails aligned; wire rope safety clamps engaged.',
          recommendation:
            tensionerSeverity === 'critical'
              ? 'CRITICAL: Excessive belt sag detected. Risk of belt slipping on drive drum. Check counterweight guide ropes for binding.'
              : tensionerSeverity === 'warning'
              ? 'WARNING: Belt elongation approaching limit. Schedule take-up stroke adjustment.'
              : 'Tension cradle floating freely in nominal equilibrium window.',
          lastService: '14 days ago',
          cycles: 'Continuous active gravity balance',
        });
        break;

      default:
        break;
    }
  };

  return (
    <div id="digital-twin-view" className="space-y-6 pb-12 page-transition-enter">
      {/* 1. Header Banner */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[12px] p-[24px] shadow-[var(--shadow-card)] flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--status-healthy)] animate-soft-pulse" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--accent-primary)] font-mono">
              Digital Twin Kinematics
            </span>
          </div>
          <h1 className="text-[20px] font-semibold text-[var(--text-primary)] tracking-tight">
            Interactive 3D Conveyor Belt Digital Twin
          </h1>
          <p className="text-[13px] text-[var(--text-secondary)] max-w-2xl leading-[1.6]">
            Real-time multi-physics 3D kinematic twin synced to live telemetry velocity ({sensorData.belt_speed.toFixed(2)} m/s), tensioner sag, and optical camera joint defect sensing. Drag to orbit, scroll to zoom, and select any mechanical component to inspect deep telemetry.
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)] px-3.5 py-2 rounded-[8px] text-[12px]">
          <span className="text-[var(--text-tertiary)] font-semibold uppercase tracking-[0.06em] text-[11px]">Status:</span>
          <span className="flex items-center gap-1.5 text-[var(--status-healthy)] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-healthy)]" /> Optimal
          </span>
          <span className="flex items-center gap-1.5 text-[var(--status-warning)] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-warning)]" /> Warning
          </span>
          <span className="flex items-center gap-1.5 text-[var(--status-critical)] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-critical)]" /> Critical
          </span>
        </div>
      </div>

      {/* 2. Flagship SVG Canvas Container */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[12px] p-[20px] shadow-[var(--shadow-card)] relative overflow-hidden">
        {/* Canvas Top Controls */}
        <div className="flex items-center justify-between text-[12px] text-[var(--text-tertiary)] mb-4 pb-3 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3 font-mono flex-wrap">
            <span className="text-[var(--text-primary)] font-semibold">SYSTEM: CV-101 (2.4 km Overland)</span>
            <span className="text-[var(--text-disabled)] hidden sm:inline">•</span>
            <span className="text-[var(--accent-primary)] font-bold">
              SPEED: {sensorData.belt_speed.toFixed(2)} m/s {isMoving ? '(RUNNING)' : '(STOPPED)'}
            </span>
            <span className="text-[var(--text-disabled)] hidden sm:inline">•</span>
            {detection.defectType === 'Crack/Tear' ? (
              <span className="px-2 py-0.5 rounded-[4px] bg-red-950/80 border border-red-500/80 text-red-300 font-mono text-[11px] font-bold flex items-center gap-1.5 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                CAM 1: CRACK/TEAR ({detection.confidence}%)
              </span>
            ) : detection.defectType === 'Material Spillage' ? (
              <span className="px-2 py-0.5 rounded-[4px] bg-orange-950/80 border border-orange-500/80 text-orange-300 font-mono text-[11px] font-bold flex items-center gap-1.5 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-ping" />
                CAM 1: MATERIAL SPILLAGE ({detection.confidence}%)
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-[4px] bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 font-mono text-[11px] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                CAM 1: NORMAL
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFlowParticles(!showFlowParticles)}
              className={`px-3 py-1 rounded-[6px] text-[12px] font-medium transition-colors ${
                showFlowParticles
                  ? 'bg-[var(--accent-primary)] text-[#0A0E14] font-bold'
                  : 'btn-secondary h-[28px]'
              }`}
            >
              Ore Flow: {showFlowParticles ? 'Active' : 'Muted'}
            </button>
          </div>
        </div>

        {/* 3D WebGL Canvas via React Three Fiber */}
        <Conveyor3DScene
          sensorData={sensorData}
          prediction={prediction}
          motorSeverity={motorSeverity}
          drivePulleySeverity={drivePulleySeverity}
          joint1Severity={joint1Severity}
          joint2Severity={joint2Severity}
          tensionerSeverity={tensionerSeverity}
          recentlyChanged={recentlyChanged}
          showFlowParticles={showFlowParticles}
          onSelectComponent={handleComponentClick}
          activeHighlight={activeHighlight}
          cameraDefectType={detection.defectType}
          cameraDefectConfidence={detection.confidence}
          cameraSnapshotUrl={detection.snapshotUrl}
        />

        {/* Digital Twin Interactive Guide Footer */}
        <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] flex flex-col sm:flex-row items-center justify-between text-[12px] text-[var(--text-tertiary)] gap-3">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
            <span>
              Select any mechanical component (<strong>Motor M-01</strong>, <strong>Head Pulley</strong>, <strong>Splice #1</strong>, <strong>Splice #2</strong>, or <strong>Tensioner Tower</strong>) to inspect engineering telemetry.
            </span>
          </div>
          <div className="font-mono text-[var(--text-secondary)] shrink-0">
            Combined Belt Risk: <span className="font-bold text-[var(--accent-primary)]">{prediction.final_score}/100</span>
          </div>
        </div>
      </div>

      {/* 3. Component Status Cards Matrix (5-column grid, 14px gap) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Motor M-01 */}
        <div
          onClick={() => handleComponentClick('motor')}
          className="industrial-card cursor-pointer transition-all space-y-2.5"
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[13px] text-[var(--text-primary)]">Drive Motor M-01</span>
            {getStatusBadge(motorSeverity)}
          </div>
          <div className="text-[17px] font-bold font-mono tabular-nums text-[var(--text-primary)]">
            {sensorData.temperature.toFixed(1)} °C | {sensorData.motor_current.toFixed(0)} A
          </div>
          <div className="text-[11px] text-[var(--text-tertiary)] leading-[1.5]">
            450 kW induction drive; stator thermal sensing.
          </div>
        </div>

        {/* Drive Pulley */}
        <div
          onClick={() => handleComponentClick('drive_pulley')}
          className="industrial-card cursor-pointer transition-all space-y-2.5"
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[13px] text-[var(--text-primary)]">Head Drive Pulley</span>
            {getStatusBadge(drivePulleySeverity)}
          </div>
          <div className="text-[17px] font-bold font-mono tabular-nums text-[var(--text-primary)]">
            {sensorData.bearing_condition.toFixed(0)} pts | {sensorData.vibration.toFixed(2)} mm/s
          </div>
          <div className="text-[11px] text-[var(--text-tertiary)] leading-[1.5]">
            Acoustic shock pulse &amp; ceramic lagging friction.
          </div>
        </div>

        {/* Joint #1 (Optical Cam #1 Monitored) */}
        <div
          onClick={() => handleComponentClick('joint_1')}
          className={`industrial-card cursor-pointer transition-all space-y-2.5 ${
            detection.defectType === 'Material Spillage'
              ? 'border-orange-500/70 ring-1 ring-orange-500/30 bg-orange-950/20'
              : detection.defectType === 'Crack/Tear'
              ? 'border-red-500/70 ring-1 ring-red-500/30 bg-red-950/20'
              : joint1Severity === 'warning'
              ? 'border-amber-500/50 ring-1 ring-amber-500/20'
              : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[13px] text-[var(--text-primary)]">Joint #1 (Cam 1)</span>
            {getStatusBadge(joint1Severity)}
          </div>
          <div className="text-[17px] font-bold font-mono tabular-nums text-[var(--text-primary)]">
            {detection.defectType !== 'Normal' ? (
              <span className={detection.defectType === 'Material Spillage' ? 'text-orange-400' : 'text-red-400'}>
                {detection.defectType === 'Material Spillage' ? 'Spillage' : detection.defectType} ({detection.confidence}%)
              </span>
            ) : (
              <span>Anomaly: {detection.anomalyScore.toFixed(0)}/100</span>
            )}
          </div>
          <div className="text-[11px] text-[var(--text-tertiary)] leading-[1.5]">
            {detection.defectType !== 'Normal' ? 'Optical line scan detected anomaly.' : 'Transfer chute optical station.'}
          </div>
        </div>

        {/* Joint #2 */}
        <div
          onClick={() => handleComponentClick('joint_2')}
          className={`industrial-card cursor-pointer transition-all space-y-2.5 ${
            joint2Severity === 'critical'
              ? 'border-[rgba(241,54,54,0.6)] ring-1 ring-[rgba(241,54,54,0.3)]'
              : joint2Severity === 'warning'
              ? 'border-[rgba(245,158,11,0.5)] ring-1 ring-[rgba(245,158,11,0.2)]'
              : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[13px] text-[var(--text-primary)]">Joint Splice #2</span>
            {getStatusBadge(joint2Severity)}
          </div>
          <div className="text-[17px] font-bold font-mono tabular-nums text-[var(--text-primary)]">
            RUL: {prediction.rul_hours} hrs
          </div>
          <div className="text-[11px] text-[var(--text-tertiary)] leading-[1.5]">
            Steel cord vulcanized splice under camera AI.
          </div>
        </div>

        {/* Take-up Tensioner */}
        <div
          onClick={() => handleComponentClick('tensioner')}
          className="industrial-card cursor-pointer transition-all space-y-2.5"
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[13px] text-[var(--text-primary)]">Take-Up Tower</span>
            {getStatusBadge(tensionerSeverity)}
          </div>
          <div className="text-[17px] font-bold font-mono tabular-nums text-[var(--text-primary)]">
            Sag: {sensorData.looseness.toFixed(2)}
          </div>
          <div className="text-[11px] text-[var(--text-tertiary)] leading-[1.5]">
            18T counterweight gravity tensioner carriage.
          </div>
        </div>
      </div>
    </div>
  );
};
