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
}

export const DigitalTwinView: React.FC<DigitalTwinViewProps> = ({
  sensorData,
  prediction,
  onSelectComponent,
}) => {
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

  const joint1Severity: Severity =
    prediction.final_score >= 70
      ? 'critical'
      : prediction.final_score >= 40
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

      case 'joint_1':
        onSelectComponent({
          id: 'JNT-01-SPL',
          name: 'Belt Splice Joint #1 (Finger Step Splice)',
          type: 'Reinforced Rubber Splice Joint',
          status: joint1Severity,
          healthScore: Math.round(100 - prediction.final_score * 0.8),
          readings: {
            'Surface Acoustic Pulse': '82 pts',
            'Splice Tensile Strain': `${(sensorData.overload * 0.42).toFixed(1)} kN/m`,
            'Edge Skive Integrity': 'Nominal',
          },
          cameraStatus: 'No edge fraying detected in last line-scan capture.',
          recommendation: 'Nominal fatigue status. Continue monitoring via automated line cameras.',
          lastService: '68 days ago',
          cycles: '189,000 cycles',
        });
        break;

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
            Interactive 2D Conveyor Belt Digital Twin
          </h1>
          <p className="text-[13px] text-[var(--text-secondary)] max-w-2xl leading-[1.6]">
            Real-time multi-physics schematic synced to live telemetry velocity ({sensorData.belt_speed.toFixed(2)} m/s) and joint stress. Select any mechanical node below to inspect deep telemetry.
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
          <div className="flex items-center gap-3 font-mono">
            <span className="text-[var(--text-primary)] font-semibold">SYSTEM: CV-101 (2.4 km Overland)</span>
            <span className="text-[var(--text-disabled)] hidden sm:inline">•</span>
            <span className="text-[var(--accent-primary)] font-bold">
              SPEED: {sensorData.belt_speed.toFixed(2)} m/s {isMoving ? '(RUNNING)' : '(STOPPED)'}
            </span>
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

        {/* 2D SVG Interactive Diagram */}
        <div className="w-full overflow-x-auto">
          <svg
            id="conveyor-digital-twin-svg"
            viewBox="0 0 1100 480"
            className="w-full min-w-[850px] h-auto select-none"
            style={{ filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.6))' }}
          >
            <defs>
              {/* Dynamic Belt Motion Pattern Animation */}
              <style>
                {`
                  @keyframes beltMoveTop {
                    0% { stroke-dashoffset: 0; }
                    100% { stroke-dashoffset: -120; }
                  }
                  @keyframes beltMoveBottom {
                    0% { stroke-dashoffset: 0; }
                    100% { stroke-dashoffset: 120; }
                  }
                  @keyframes pulseRed {
                    0%, 100% { opacity: 0.9; }
                    50% { opacity: 0.4; }
                  }
                  @keyframes motorRotate {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                  .belt-top-anim {
                    animation: beltMoveTop ${animationDurationSec}s linear infinite;
                  }
                  .belt-bottom-anim {
                    animation: beltMoveBottom ${animationDurationSec}s linear infinite;
                  }
                  .crit-pulse {
                    animation: pulseRed 1s infinite;
                  }
                  @keyframes oreParticleMove {
                    0% { transform: translateX(0px); opacity: 0; }
                    8% { opacity: 0.9; }
                    92% { opacity: 0.9; }
                    100% { transform: translateX(-755px); opacity: 0; }
                  }
                  @keyframes pulseStatusHalo {
                    0%, 100% { opacity: 0.9; transform: scale(1); }
                    50% { opacity: 0.2; transform: scale(1.08); }
                  }
                  .status-change-halo {
                    animation: pulseStatusHalo 0.6s ease-in-out infinite;
                    transform-origin: center;
                  }
                `}
              </style>

              {/* Linear Gradients */}
              <linearGradient id="metalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#334155" />
                <stop offset="50%" stopColor="#1e293b" />
                <stop offset="100%" stopColor="#0f172a" />
              </linearGradient>

              <linearGradient id="pulleyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#64748b" />
                <stop offset="100%" stopColor="#1e293b" />
              </linearGradient>

              <linearGradient id="oreGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#d97706" />
                <stop offset="100%" stopColor="#78350f" />
              </linearGradient>

              <filter id="glowGreen" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
              <filter id="glowRed" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Industrial Floor Grid Background */}
            <g opacity="0.15">
              <line x1="40" y1="410" x2="1060" y2="410" stroke="#64748b" strokeWidth="2" />
              <line x1="40" y1="425" x2="1060" y2="425" stroke="#334155" strokeWidth="1" strokeDasharray="4 4" />
              {/* Structural Truss Columns */}
              <path d="M 120,410 L 120,280 M 340,410 L 340,280 M 560,410 L 560,280 M 780,410 L 780,280 M 960,410 L 960,280" stroke="#334155" strokeWidth="3" />
              <path d="M 120,280 L 340,410 M 340,280 L 120,410 M 340,280 L 560,410 M 560,280 L 340,410 M 560,280 L 780,410 M 780,280 L 560,410 M 780,280 L 960,410 M 960,280 L 780,410" stroke="#1e293b" strokeWidth="1.5" />
            </g>

            {/* 1. DRIVE MOTOR UNIT (Far Left) */}
            <g
              id="twin-comp-motor"
              className="cursor-pointer transition-transform hover:scale-105"
              onClick={() => handleComponentClick('motor')}
            >
              {recentlyChanged['motor'] && (
                <rect
                  x="44"
                  y="184"
                  width="92"
                  height="82"
                  rx="10"
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="3.5"
                  className="status-change-halo"
                />
              )}
              {/* Motor Housing */}
              <rect
                x="50"
                y="190"
                width="80"
                height="70"
                rx="6"
                fill="#1e293b"
                stroke={getColor(motorSeverity)}
                strokeWidth="3"
                className={motorSeverity === 'critical' ? 'crit-pulse' : ''}
              />
              {/* Motor Cooling Fins */}
              <line x1="58" y1="195" x2="58" y2="255" stroke="#475569" strokeWidth="2" />
              <line x1="68" y1="195" x2="68" y2="255" stroke="#475569" strokeWidth="2" />
              <line x1="78" y1="195" x2="78" y2="255" stroke="#475569" strokeWidth="2" />
              <line x1="88" y1="195" x2="88" y2="255" stroke="#475569" strokeWidth="2" />
              <line x1="98" y1="195" x2="98" y2="255" stroke="#475569" strokeWidth="2" />
              <line x1="108" y1="195" x2="108" y2="255" stroke="#475569" strokeWidth="2" />
              <line x1="118" y1="195" x2="118" y2="255" stroke="#475569" strokeWidth="2" />

              {/* Shaft & Coupler */}
              <rect x="130" y="218" width="30" height="14" fill="#64748b" rx="2" />
              <rect x="145" y="214" width="10" height="22" fill="#94a3b8" rx="1" />

              {/* Motor Label */}
              <text x="90" y="278" fill="#cbd5e1" fontSize="11" fontWeight="bold" textAnchor="middle">
                Drive Motor M-01
              </text>
              <text x="90" y="292" fill={getColor(motorSeverity)} fontSize="10" fontMono="true" textAnchor="middle">
                {sensorData.temperature.toFixed(1)}°C | {sensorData.motor_current.toFixed(0)}A
              </text>
            </g>

            {/* 2. PRIMARY HEAD DRIVE PULLEY */}
            <g
              id="twin-comp-drive-pulley"
              className="cursor-pointer transition-transform hover:scale-105"
              onClick={() => handleComponentClick('drive_pulley')}
            >
              {recentlyChanged['drive_pulley'] && (
                <circle
                  cx="195"
                  cy="225"
                  r="54"
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="3.5"
                  className="status-change-halo"
                />
              )}
              {/* Outer Drum */}
              <circle
                cx="195"
                cy="225"
                r="45"
                fill="url(#pulleyGrad)"
                stroke={getColor(drivePulleySeverity)}
                strokeWidth="4"
                className={drivePulleySeverity === 'critical' ? 'crit-pulse' : ''}
              />
              {/* Drum Spokes & Hub */}
              <circle cx="195" cy="225" r="14" fill="#0f172a" stroke="#64748b" strokeWidth="3" />
              <line x1="195" y1="180" x2="195" y2="270" stroke="#475569" strokeWidth="2" />
              <line x1="150" y1="225" x2="240" y2="225" stroke="#475569" strokeWidth="2" />

              {/* Bearing Pillow Block Indicator */}
              <rect
                x="185"
                y="215"
                width="20"
                height="20"
                rx="3"
                fill={getColor(drivePulleySeverity)}
                opacity="0.8"
              />

              {/* Label */}
              <text x="195" y="165" fill="#cbd5e1" fontSize="11" fontWeight="bold" textAnchor="middle">
                Head Drive Pulley
              </text>
              <text x="195" y="150" fill={getColor(drivePulleySeverity)} fontSize="10" textAnchor="middle">
                Bearing: {sensorData.bearing_condition.toFixed(0)} pts
              </text>
            </g>

            {/* SNUB DEFLECTION PULLEY */}
            <g>
              <circle cx="270" cy="285" r="24" fill="#1e293b" stroke="#64748b" strokeWidth="3" />
              <circle cx="270" cy="285" r="7" fill="#0f172a" />
              <text x="270" y="325" fill="#94a3b8" fontSize="9" textAnchor="middle">
                Snub Pulley
              </text>
            </g>

            {/* 3. TAIL RETURN PULLEY (Far Right) */}
            <g
              id="twin-comp-tail-pulley"
              className="cursor-pointer transition-transform hover:scale-105"
              onClick={() => handleComponentClick('tail_pulley')}
            >
              <circle
                cx="960"
                cy="225"
                r="45"
                fill="url(#pulleyGrad)"
                stroke="#10b981"
                strokeWidth="4"
              />
              <circle cx="960" cy="225" r="14" fill="#0f172a" stroke="#64748b" strokeWidth="3" />
              <line x1="960" y1="180" x2="960" y2="270" stroke="#475569" strokeWidth="2" />
              <line x1="915" y1="225" x2="1005" y2="225" stroke="#475569" strokeWidth="2" />

              <text x="960" y="165" fill="#cbd5e1" fontSize="11" fontWeight="bold" textAnchor="middle">
                Tail Return Pulley
              </text>
              <text x="960" y="150" fill="#10b981" fontSize="10" textAnchor="middle">
                Tension: Nominal
              </text>
            </g>

            {/* ORE LOADING CHUTE (Above Tail Pulley) */}
            <g>
              <polygon points="920,80 1000,80 970,165 950,165" fill="#334155" stroke="#475569" strokeWidth="2" />
              <rect x="945" y="70" width="30" height="15" fill="#0f172a" rx="2" />
              <text x="960" y="65" fill="#f59e0b" fontSize="10" fontWeight="bold" textAnchor="middle">
                Ore Chute (Crusher Feed)
              </text>
              {/* Ore particles dropping down */}
              {showFlowParticles && isMoving && (
                <g fill="#d97706" opacity="0.8">
                  <circle cx="956" cy="120" r="3" />
                  <circle cx="965" cy="135" r="4" />
                  <circle cx="958" cy="150" r="3.5" />
                  <circle cx="962" cy="168" r="5" />
                  <circle cx="952" cy="172" r="3" />
                </g>
              )}
            </g>

            {/* 4. CARRIER IDLER ROLLERS (Upper Strand Support) */}
            <g opacity="0.85">
              {[340, 430, 520, 610, 700, 790, 880].map((xPos) => (
                <g key={xPos}>
                  {/* Troughing idler 3-roll profile */}
                  <line x1={xPos - 14} y1="190" x2={xPos + 14} y2="190" stroke="#64748b" strokeWidth="4" strokeLinecap="round" />
                  <line x1={xPos - 22} y1="184" x2={xPos - 12} y2="190" stroke="#64748b" strokeWidth="3" strokeLinecap="round" />
                  <line x1={xPos + 12} y1="190" x2={xPos + 22} y2="184" stroke="#64748b" strokeWidth="3" strokeLinecap="round" />
                  <rect x={xPos - 2} y="192" width="4" height="15" fill="#334155" />
                </g>
              ))}
            </g>

            {/* 5. RETURN IDLERS (Lower Strand Support) */}
            <g opacity="0.7">
              {[380, 540, 700, 860].map((xPos) => (
                <g key={xPos}>
                  <circle cx={xPos} cy="285" r="8" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
                  <rect x={xPos - 1.5} y="293" width="3" height="12" fill="#334155" />
                </g>
              ))}
            </g>

            {/* 6. CONVEYOR BELT STRANDS */}

            {/* TOP CARRIER STRAND (Moving Leftward) */}
            <path
              d="M 960,180 L 195,180"
              stroke="#0f172a"
              strokeWidth="12"
              strokeLinecap="round"
            />
            <path
              d="M 960,180 L 195,180"
              stroke={getColor(beltSurfaceSeverity)}
              strokeWidth="4"
              strokeDasharray={isMoving ? '18 12' : 'none'}
              className={isMoving ? 'belt-top-anim' : ''}
            />

            {/* Ore Bulk on Top Strand */}
            {showFlowParticles && isMoving && (
              <>
                <path
                  d="M 950,175 Q 750,172 550,173 T 205,175"
                  fill="none"
                  stroke="url(#oreGrad)"
                  strokeWidth="7"
                  strokeDasharray="14 8"
                  opacity="0.9"
                  className="belt-top-anim"
                />
                {/* Moving material flow dots representing continuous ore transit */}
                <g opacity="0.9">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
                    <circle
                      key={i}
                      cx="950"
                      cy={174 + (i % 2 === 0 ? -1.5 : 1)}
                      r={2.5 + (i % 3) * 0.7}
                      fill="#f59e0b"
                      style={{
                        animation: `oreParticleMove ${animationDurationSec * 1.8}s linear infinite`,
                        animationDelay: `${-i * (animationDurationSec * 0.15)}s`,
                      }}
                    />
                  ))}
                </g>
              </>
            )}

            {/* RETURN STRAND with Dynamic Sag / Looseness (Moving Rightward) */}
            {/* The sag curve is dynamically influenced by sensorData.looseness! */}
            <path
              d={`M 270,305 Q 400,${305 + sensorData.looseness * 45} 520,305 Q 680,${305 + sensorData.looseness * 45} 960,270`}
              stroke="#0f172a"
              strokeWidth="10"
              fill="none"
            />
            <path
              d={`M 270,305 Q 400,${305 + sensorData.looseness * 45} 520,305 Q 680,${305 + sensorData.looseness * 45} 960,270`}
              stroke={getColor(tensionerSeverity)}
              strokeWidth="3"
              strokeDasharray={isMoving ? '18 12' : 'none'}
              fill="none"
              className={isMoving ? 'belt-bottom-anim' : ''}
            />

            {/* 7. VULCANIZED JOINT #1 (On Upper Strand ~500px) */}
            <g
              id="twin-comp-joint-1"
              className="cursor-pointer transition-transform hover:scale-110"
              onClick={() => handleComponentClick('joint_1')}
            >
              {/* Splice band overlay */}
              <rect
                x="470"
                y="170"
                width="35"
                height="20"
                rx="3"
                fill="#1e293b"
                stroke={getColor(joint1Severity)}
                strokeWidth="3"
              />
              <line x1="480" y1="172" x2="480" y2="188" stroke={getColor(joint1Severity)} strokeWidth="2" strokeDasharray="2 2" />
              <line x1="495" y1="172" x2="495" y2="188" stroke={getColor(joint1Severity)} strokeWidth="2" strokeDasharray="2 2" />

              {/* Joint Tag */}
              <g transform="translate(487, 135)">
                <rect x="-35" y="-12" width="70" height="20" rx="4" fill="#0f172a" stroke={getColor(joint1Severity)} strokeWidth="1.5" />
                <text x="0" y="2" fill="#f8fafc" fontSize="10" fontWeight="bold" textAnchor="middle">
                  Joint Splice #1
                </text>
                <line x1="0" y1="8" x2="0" y2="35" stroke={getColor(joint1Severity)} strokeWidth="1.5" strokeDasharray="2 2" />
              </g>
            </g>

            {/* 8. VULCANIZED JOINT #2 (The Critical Monitored Joint ~760px) */}
            <g
              id="twin-comp-joint-2"
              className="cursor-pointer transition-transform hover:scale-110"
              onClick={() => handleComponentClick('joint_2')}
            >
              {recentlyChanged['joint_2'] && (
                <rect
                  x="726"
                  y="158"
                  width="64"
                  height="44"
                  rx="6"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="3.5"
                  className="status-change-halo"
                />
              )}
              {/* Splice band */}
              <rect
                x="735"
                y="168"
                width="45"
                height="24"
                rx="4"
                fill="#1e293b"
                stroke={getColor(joint2Severity)}
                strokeWidth="3.5"
                className={joint2Severity === 'critical' ? 'crit-pulse' : ''}
              />
              <line x1="748" y1="170" x2="748" y2="190" stroke={getColor(joint2Severity)} strokeWidth="2" />
              <line x1="765" y1="170" x2="765" y2="190" stroke={getColor(joint2Severity)} strokeWidth="2" />

              {/* Callout box */}
              <g transform="translate(757, 125)">
                <rect
                  x="-55"
                  y="-14"
                  width="110"
                  height="26"
                  rx="4"
                  fill="#0f172a"
                  stroke={getColor(joint2Severity)}
                  strokeWidth="2"
                  className={joint2Severity === 'critical' ? 'crit-pulse' : ''}
                />
                <text x="0" y="0" fill="#f8fafc" fontSize="10" fontWeight="bold" textAnchor="middle">
                  Joint Splice #2 (CRITICAL)
                </text>
                <text x="0" y="9" fill={getColor(joint2Severity)} fontSize="8" fontMono="true" textAnchor="middle">
                  Risk: {prediction.final_score}/100 ({prediction.status})
                </text>
                <line x1="0" y1="12" x2="0" y2="43" stroke={getColor(joint2Severity)} strokeWidth="2" strokeDasharray="2 2" />
              </g>
            </g>

            {/* 9. CAMERA VISION SENSOR INSPECTION TOWER */}
            <g
              className="cursor-pointer"
              onClick={() => handleComponentClick('joint_2')}
            >
              <rect x="740" y="210" width="36" height="40" rx="4" fill="#0f172a" stroke="#f59e0b" strokeWidth="2" />
              <circle cx="758" cy="230" r="10" fill="#1e293b" stroke="#f59e0b" strokeWidth="2" />
              <circle cx="758" cy="230" r="4" fill="#ef4444" className="animate-pulse" />
              <text x="758" y="265" fill="#f59e0b" fontSize="9" fontWeight="bold" textAnchor="middle">
                Edge AI Cam #1
              </text>
              {/* Light beam to belt */}
              <polygon points="750,210 766,210 775,192 740,192" fill="#f59e0b" opacity="0.15" />
            </g>

            {/* 10. GRAVITY TAKE-UP TENSIONING TOWER (Center-Bottom) */}
            <g
              id="twin-comp-tensioner"
              className="cursor-pointer transition-transform hover:scale-105"
              onClick={() => handleComponentClick('tensioner')}
            >
              {recentlyChanged['tensioner'] && (
                <rect
                  x="414"
                  y={338 + sensorData.looseness * 40}
                  width="72"
                  height="46"
                  rx="6"
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="3.5"
                  className="status-change-halo"
                />
              )}
              {/* Vertical Guide Tower Rails */}
              <line x1="430" y1="305" x2="430" y2="430" stroke="#475569" strokeWidth="3" />
              <line x1="470" y1="305" x2="470" y2="430" stroke="#475569" strokeWidth="3" />
              <line x1="430" y1="430" x2="470" y2="430" stroke="#475569" strokeWidth="4" />

              {/* Gravity Counterweight Block (Position dynamically shifts based on looseness!) */}
              <rect
                x="422"
                y={345 + sensorData.looseness * 40}
                width="56"
                height="32"
                rx="3"
                fill="#1e293b"
                stroke={getColor(tensionerSeverity)}
                strokeWidth="2.5"
              />
              <text
                x="450"
                y={362 + sensorData.looseness * 40}
                fill="#f8fafc"
                fontSize="9"
                fontWeight="bold"
                textAnchor="middle"
              >
                18T Take-Up
              </text>
              <text
                x="450"
                y={372 + sensorData.looseness * 40}
                fill={getColor(tensionerSeverity)}
                fontSize="8"
                textAnchor="middle"
              >
                Sag: {sensorData.looseness.toFixed(2)}
              </text>
            </g>

            {/* Live Operational Vector Arrows */}
            <g opacity="0.6">
              <text x="600" y="160" fill="#94a3b8" fontSize="11" fontWeight="bold" textAnchor="middle">
                ← Material Transport Flow (6,500 tph)
              </text>
              <text x="600" y="340" fill="#64748b" fontSize="10" textAnchor="middle">
                Return Strand (Clean Rubber Underside) →
              </text>
            </g>
          </svg>
        </div>

        {/* Digital Twin Interactive Guide Footer */}
        <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] flex flex-col sm:flex-row items-center justify-between text-[12px] text-[var(--text-tertiary)] gap-3">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
            <span>
              Select any mechanical component (<strong>Motor M-01</strong>, <strong>Head Pulley</strong>, <strong>Splice #2</strong>, or <strong>Tensioner Tower</strong>) to inspect engineering telemetry.
            </span>
          </div>
          <div className="font-mono text-[var(--text-secondary)] shrink-0">
            Combined Belt Risk: <span className="font-bold text-[var(--accent-primary)]">{prediction.final_score}/100</span>
          </div>
        </div>
      </div>

      {/* 3. Component Status Cards Matrix (4-column grid, 16px gap) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Motor M-01 */}
        <div
          onClick={() => handleComponentClick('motor')}
          className="industrial-card cursor-pointer transition-all space-y-2.5"
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[14px] text-[var(--text-primary)]">Drive Motor M-01</span>
            {getStatusBadge(motorSeverity)}
          </div>
          <div className="text-[18px] font-bold font-mono tabular-nums text-[var(--text-primary)]">
            {sensorData.temperature.toFixed(1)} °C | {sensorData.motor_current.toFixed(0)} A
          </div>
          <div className="text-[12px] text-[var(--text-tertiary)] leading-[1.5]">
            450 kW induction drive; stator thermal sensing.
          </div>
        </div>

        {/* Drive Pulley */}
        <div
          onClick={() => handleComponentClick('drive_pulley')}
          className="industrial-card cursor-pointer transition-all space-y-2.5"
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[14px] text-[var(--text-primary)]">Head Drive Pulley</span>
            {getStatusBadge(drivePulleySeverity)}
          </div>
          <div className="text-[18px] font-bold font-mono tabular-nums text-[var(--text-primary)]">
            {sensorData.bearing_condition.toFixed(0)} pts | {sensorData.vibration.toFixed(2)} mm/s
          </div>
          <div className="text-[12px] text-[var(--text-tertiary)] leading-[1.5]">
            Acoustic shock pulse &amp; ceramic lagging friction.
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
            <span className="font-semibold text-[14px] text-[var(--text-primary)]">Joint Splice #2</span>
            {getStatusBadge(joint2Severity)}
          </div>
          <div className="text-[18px] font-bold font-mono tabular-nums text-[var(--text-primary)]">
            RUL: {prediction.rul_hours} hrs | Risk: {prediction.final_score}
          </div>
          <div className="text-[12px] text-[var(--text-tertiary)] leading-[1.5]">
            Steel cord vulcanized splice under camera AI.
          </div>
        </div>

        {/* Take-up Tensioner */}
        <div
          onClick={() => handleComponentClick('tensioner')}
          className="industrial-card cursor-pointer transition-all space-y-2.5"
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[14px] text-[var(--text-primary)]">Take-Up Tower</span>
            {getStatusBadge(tensionerSeverity)}
          </div>
          <div className="text-[18px] font-bold font-mono tabular-nums text-[var(--text-primary)]">
            Sag Index: {sensorData.looseness.toFixed(2)}
          </div>
          <div className="text-[12px] text-[var(--text-tertiary)] leading-[1.5]">
            18T counterweight gravity tensioner carriage.
          </div>
        </div>
      </div>
    </div>
  );
};
