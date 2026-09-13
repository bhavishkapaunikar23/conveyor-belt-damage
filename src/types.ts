export type Severity = 'healthy' | 'warning' | 'critical';

export interface SensorData {
  temperature: number; // °C, normal <60, warning 60-80, critical >80
  vibration: number; // mm/s, normal <2, warning 2-5, critical >5
  overload: number; // %, normal <90, warning 90-100, critical >100
  motor_current: number; // Amps, baseline 180A, normal 160-195, warning 195-230, critical >230
  belt_speed: number; // m/s, normal 3.8-4.5, warning 2.5-3.8, critical <2.5
  acceleration: number; // m/s², normal <1.5, warning 1.5-3.0, critical >3.0
  looseness: number; // 0.0 to 1.0, normal <0.5, warning 0.5-0.7, critical >0.7
  bearing_condition: number; // health score 0-100, normal >60, warning 40-60, critical <40
  motion_change: number; // start-stop frequency/hr, normal <3, warning 3-5, critical >5
  timestamp: string;
}

export interface FactorMeta {
  key: keyof Omit<SensorData, 'timestamp'>;
  label: string;
  unit: string;
  normalRange: string;
  warningRange: string;
  criticalRange: string;
  description: string;
  weight: number;
}

export interface SensorHistoryPoint {
  time: string;
  timestamp: number;
  temperature: number;
  vibration: number;
  overload: number;
  motor_current: number;
  belt_speed: number;
  acceleration: number;
  looseness: number;
  bearing_condition: number;
  motion_change: number;
  health_score: number;
}

export interface ContributingFactor {
  name: string;
  factor_key: string;
  impact_percent: number;
  current_value: number;
  threshold_exceeded: string;
  severity: Severity;
}

export interface SensorPrediction {
  sensor_risk_score: number; // 0-100
  status: 'Healthy' | 'Warning' | 'Critical';
  confidence: number; // percentage
  contributing_factors: ContributingFactor[];
  failure_probability: number; // percentage
  rul_hours: number;
  method: 'Random Forest Classifier' | 'Rule-based Fallback Model';
}

export type DefectCategory =
  | 'Normal'
  | 'Material Spillage'
  | 'Crack/Tear'
  | 'Misalignment/Edge Wear';

export interface CameraInspection {
  id: string;
  timestamp: string;
  status: 'Normal' | 'Minor Damage' | 'Critical Damage';
  defect_type:
    | 'No Defect / Clean Surface'
    | 'Surface Micro-Crack'
    | 'Deep Splice Separation'
    | 'Longitudinal Gouge'
    | 'Edge Fraying / Tear'
    | 'Material Spillage / Skirt Overflow'
    | 'Tracking Misalignment / Edge Wear';
  confidence: number; // e.g. 91%
  camera_risk_score: number; // 0-100
  bbox?: { x: number; y: number; width: number; height: number; label: string };
  imageUrl: string;
  beltLocation: string; // e.g. "Section C - Joint #2 Splice"
  snapshotUrl?: string;
}

export interface CombinedPrediction {
  final_score: number; // (0.6 * sensor_risk_score) + (0.4 * camera_risk_score)
  sensor_risk_score: number;
  camera_risk_score: number;
  status: 'Healthy' | 'Warning' | 'Critical';
  failure_probability: number;
  rul_hours: number;
  contributing_factors: ContributingFactor[];
  camera_defect: string;
  camera_confidence: number;
  recommendation: string;
  timestamp: string;
}

export interface AlertItem {
  id: string;
  timestamp: string;
  severity: 'Critical' | 'Warning';
  component: string;
  factor: string;
  value: string;
  threshold: string;
  status: 'Active' | 'Acknowledged' | 'Resolved';
  recommendation: string;
}

export interface DigitalTwinComponent {
  id: string;
  name: string;
  type: 'motor' | 'drive_pulley' | 'snub_pulley' | 'belt_joint_1' | 'belt_joint_2' | 'tail_pulley' | 'tensioner' | 'idlers';
  status: Severity;
  healthScore: number;
  sensorReadings: Record<string, string>;
  cameraStatus: string;
  recommendation: string;
  lastInspected: string;
  cycles: number;
}

export interface SystemIntegrationItem {
  id: string;
  name: string;
  category: string;
  protocol: string;
  status: 'Connected' | 'Disconnected' | 'Degraded';
  latencyMs: number;
  packetsPerSec: number;
  lastSynced: string;
  endpoint: string;
}

export type PageId =
  | 'overview'
  | 'realtime'
  | 'camera'
  | 'digital-twin'
  | 'predictions'
  | 'alerts'
  | 'integrations'
  | 'history';

export type NavigationTab = PageId;
export type AnomalyType = 'normal' | 'warning' | 'critical';

export interface ActivityEvent {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'critical' | 'success';
  source: 'Sensor' | 'Camera' | 'Twin' | 'PLC' | 'Prediction';
  message: string;
}
