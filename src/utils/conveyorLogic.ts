import {
  SensorData,
  ContributingFactor,
  SensorPrediction,
  CameraInspection,
  CombinedPrediction,
  AlertItem,
  FactorMeta,
  Severity,
} from '../types';

export const SENSOR_METAS: FactorMeta[] = [
  {
    key: 'temperature',
    label: 'Temperature',
    unit: '°C',
    normalRange: '< 60°C',
    warningRange: '60 - 80°C',
    criticalRange: '> 80°C',
    description: 'Drive pulley and bearing junction thermal infrared readout',
    weight: 0.20,
  },
  {
    key: 'vibration',
    label: 'Vibration',
    unit: 'mm/s',
    normalRange: '< 2.0 mm/s',
    warningRange: '2.0 - 5.0 mm/s',
    criticalRange: '> 5.0 mm/s',
    description: '3-axis accelerometer detecting pulley imbalance and belt splice chatter',
    weight: 0.20,
  },
  {
    key: 'overload',
    label: 'Overloading',
    unit: '%',
    normalRange: '< 90%',
    warningRange: '90 - 100%',
    criticalRange: '> 100%',
    description: 'Conveyor belt weightometer tonnage load vs rated 6,500 tph capacity',
    weight: 0.15,
  },
  {
    key: 'motor_current',
    label: 'Motor Current',
    unit: 'A',
    normalRange: '160 - 195 A',
    warningRange: '195 - 230 A',
    criticalRange: '> 230 A',
    description: 'Main drive 450kW induction motor electrical draw across 3 phases',
    weight: 0.10,
  },
  {
    key: 'belt_speed',
    label: 'Belt Speed',
    unit: 'm/s',
    normalRange: '3.8 - 4.5 m/s',
    warningRange: '2.5 - 3.8 m/s',
    criticalRange: '< 2.5 m/s',
    description: 'Optical encoder tracking linear surface speed of overland belt',
    weight: 0.08,
  },
  {
    key: 'acceleration',
    label: 'Acceleration',
    unit: 'm/s²',
    normalRange: '< 1.5 m/s²',
    warningRange: '1.5 - 3.0 m/s²',
    criticalRange: '> 3.0 m/s²',
    description: 'Dynamic jerk sensor detecting sudden ore dump impact spikes',
    weight: 0.05,
  },
  {
    key: 'looseness',
    label: 'Looseness / Slack',
    unit: 'sag index',
    normalRange: '< 0.50',
    warningRange: '0.50 - 0.70',
    criticalRange: '> 0.70',
    description: 'Ultrasonic sag sensor measuring belt sag between idler troughs',
    weight: 0.10,
  },
  {
    key: 'bearing_condition',
    label: 'Bearing Condition',
    unit: 'score',
    normalRange: '> 60 / 100',
    warningRange: '40 - 60',
    criticalRange: '< 40 / 100',
    description: 'High-frequency acoustic shock pulse evaluation of bearing race wear',
    weight: 0.20,
  },
  {
    key: 'motion_change',
    label: 'Change in Motion',
    unit: 'cycles/hr',
    normalRange: '< 3.0',
    warningRange: '3.0 - 5.0',
    criticalRange: '> 5.0',
    description: 'Emergency stops, dynamic ramping, and start-stop fatigue frequency',
    weight: 0.10,
  },
];

export function calculateSensorRiskScore(data: SensorData): number {
  let score = 0;
  if (data.temperature > 80) score += 20;
  else if (data.temperature > 60) score += 10;

  if (data.vibration > 5) score += 20;
  else if (data.vibration > 2) score += 10;

  if (data.overload > 100) score += 15;
  else if (data.overload > 90) score += 8;

  if (data.bearing_condition < 40) score += 20;
  else if (data.bearing_condition < 60) score += 10;

  if (data.looseness > 0.7) score += 10;
  if (data.motion_change > 5) score += 10;
  if (data.acceleration > 3) score += 5;

  return Math.min(score, 100);
}

export function getStatusFromScore(score: number): 'Healthy' | 'Warning' | 'Critical' {
  if (score >= 60) return 'Critical';
  if (score >= 30) return 'Warning';
  return 'Healthy';
}

export function getSeverityFromScore(score: number): Severity {
  if (score >= 60) return 'critical';
  if (score >= 30) return 'warning';
  return 'healthy';
}

export function calculateSensorFactorStatus(
  key: keyof Omit<SensorData, 'timestamp'>,
  val: number
): Severity {
  switch (key) {
    case 'temperature':
      if (val > 80) return 'critical';
      if (val > 60) return 'warning';
      return 'healthy';
    case 'vibration':
      if (val > 5) return 'critical';
      if (val > 2) return 'warning';
      return 'healthy';
    case 'overload':
      if (val > 100) return 'critical';
      if (val > 90) return 'warning';
      return 'healthy';
    case 'motor_current':
      if (val > 230 || val < 130) return 'critical';
      if (val > 195 || val < 150) return 'warning';
      return 'healthy';
    case 'belt_speed':
      if (val < 2.5) return 'critical';
      if (val < 3.8) return 'warning';
      return 'healthy';
    case 'acceleration':
      if (val > 3.0) return 'critical';
      if (val > 1.5) return 'warning';
      return 'healthy';
    case 'looseness':
      if (val > 0.7) return 'critical';
      if (val > 0.5) return 'warning';
      return 'healthy';
    case 'bearing_condition':
      if (val < 40) return 'critical';
      if (val < 60) return 'warning';
      return 'healthy';
    case 'motion_change':
      if (val > 5) return 'critical';
      if (val > 3) return 'warning';
      return 'healthy';
    default:
      return 'healthy';
  }
}

export function getContributingFactors(data: SensorData): ContributingFactor[] {
  const factors: { name: string; key: string; pts: number; current: number; thresh: string; severity: Severity }[] = [];

  if (data.temperature > 80) {
    factors.push({ name: 'High Temperature', key: 'temperature', pts: 20, current: data.temperature, thresh: '>80°C', severity: 'critical' });
  } else if (data.temperature > 60) {
    factors.push({ name: 'Elevated Temperature', key: 'temperature', pts: 10, current: data.temperature, thresh: '>60°C', severity: 'warning' });
  }

  if (data.vibration > 5) {
    factors.push({ name: 'Severe Pulley/Joint Vibration', key: 'vibration', pts: 20, current: data.vibration, thresh: '>5 mm/s', severity: 'critical' });
  } else if (data.vibration > 2) {
    factors.push({ name: 'Splice Chatter Vibration', key: 'vibration', pts: 10, current: data.vibration, thresh: '>2 mm/s', severity: 'warning' });
  }

  if (data.overload > 100) {
    factors.push({ name: 'Severe Conveyor Overload', key: 'overload', pts: 15, current: data.overload, thresh: '>100%', severity: 'critical' });
  } else if (data.overload > 90) {
    factors.push({ name: 'Tonnage Capacity Strain', key: 'overload', pts: 8, current: data.overload, thresh: '>90%', severity: 'warning' });
  }

  if (data.bearing_condition < 40) {
    factors.push({ name: 'Critical Bearing Degradation', key: 'bearing_condition', pts: 20, current: data.bearing_condition, thresh: '<40 pts', severity: 'critical' });
  } else if (data.bearing_condition < 60) {
    factors.push({ name: 'Bearing Race Wear', key: 'bearing_condition', pts: 10, current: data.bearing_condition, thresh: '<60 pts', severity: 'warning' });
  }

  if (data.looseness > 0.7) {
    factors.push({ name: 'Excessive Belt Sag / Looseness', key: 'looseness', pts: 10, current: data.looseness, thresh: '>0.70', severity: 'critical' });
  } else if (data.looseness > 0.5) {
    factors.push({ name: 'Tension Slack Indication', key: 'looseness', pts: 5, current: data.looseness, thresh: '>0.50', severity: 'warning' });
  }

  if (data.motion_change > 5) {
    factors.push({ name: 'Frequent Start-Stop Cycling', key: 'motion_change', pts: 10, current: data.motion_change, thresh: '>5/hr', severity: 'critical' });
  } else if (data.motion_change > 3) {
    factors.push({ name: 'Cyclic Motion Fatigue', key: 'motion_change', pts: 5, current: data.motion_change, thresh: '>3/hr', severity: 'warning' });
  }

  if (data.acceleration > 3) {
    factors.push({ name: 'Ore Chute Impact Jerk', key: 'acceleration', pts: 5, current: data.acceleration, thresh: '>3 m/s²', severity: 'critical' });
  }

  const totalPts = factors.reduce((sum, f) => sum + f.pts, 0);
  if (totalPts === 0) {
    return [
      {
        name: 'Normal Operating Baseline',
        factor_key: 'system',
        impact_percent: 100,
        current_value: 0,
        threshold_exceeded: 'Within nominal tolerances',
        severity: 'healthy',
      },
    ];
  }

  return factors
    .map((f) => ({
      name: f.name,
      factor_key: f.key,
      impact_percent: Math.round((f.pts / totalPts) * 100),
      current_value: f.current,
      threshold_exceeded: f.thresh,
      severity: f.severity,
    }))
    .sort((a, b) => b.impact_percent - a.impact_percent);
}

export function evaluateSensorPrediction(data: SensorData): SensorPrediction {
  const riskScore = calculateSensorRiskScore(data);
  const status = getStatusFromScore(riskScore);
  const contributing = getContributingFactors(data);
  
  // Failure probability roughly scales with risk score
  const failureProb = Math.min(99, Math.max(2, Math.round(riskScore * 0.95 + (Math.random() * 4 - 2))));
  
  // Estimated RUL: Healthy > 500h, Warning 72-200h, Critical < 24h
  let rulHours = 720;
  if (riskScore >= 60) {
    rulHours = Math.max(4, Math.round(36 - (riskScore - 60) * 0.7));
  } else if (riskScore >= 30) {
    rulHours = Math.max(48, Math.round(280 - (riskScore - 30) * 5));
  } else {
    rulHours = Math.max(300, Math.round(720 - riskScore * 10));
  }

  return {
    sensor_risk_score: riskScore,
    status,
    confidence: 93.4,
    contributing_factors: contributing,
    failure_probability: failureProb,
    rul_hours: rulHours,
    method: 'Random Forest Classifier',
  };
}

export function evaluateCombinedPrediction(
  sensorData: SensorData,
  cameraInspection: CameraInspection
): CombinedPrediction {
  const sensorRisk = calculateSensorRiskScore(sensorData);
  const cameraRisk = cameraInspection.camera_risk_score;
  
  // Required formula: final_score = (0.6 * sensor_risk_score) + (0.4 * camera_risk_score)
  const finalScore = Math.round((0.6 * sensorRisk + 0.4 * cameraRisk) * 10) / 10;
  const status = getStatusFromScore(finalScore);
  
  const contributing = getContributingFactors(sensorData);
  if (cameraRisk > 20) {
    contributing.unshift({
      name: `Visual Inspection: ${cameraInspection.defect_type}`,
      factor_key: 'camera_visual',
      impact_percent: Math.round((cameraRisk * 0.4 / (finalScore || 1)) * 100),
      current_value: cameraRisk,
      threshold_exceeded: `${cameraInspection.confidence}% confidence`,
      severity: cameraRisk >= 60 ? 'critical' : 'warning',
    });
  }

  // Calculate RUL based on combined risk
  let rulHours = 640;
  if (finalScore >= 60) {
    rulHours = Math.max(2, Math.round(24 - (finalScore - 60) * 0.45));
  } else if (finalScore >= 30) {
    rulHours = Math.max(36, Math.round(180 - (finalScore - 30) * 3.5));
  } else {
    rulHours = Math.max(350, Math.round(650 - finalScore * 8));
  }

  let recommendation = 'Conveyor belt operating within nominal parameters. Continue routine scheduled shift inspection.';
  if (status === 'Critical') {
    recommendation = `CRITICAL ALERT: Immediate automated speed reduction or controlled stop recommended. ${
      cameraInspection.camera_risk_score >= 50
        ? `Optical feed confirmed ${cameraInspection.defect_type}. `
        : ''
    }Dispatch electrical and mechanical rigging crew to inspect drive pulley & joint splices.`;
  } else if (status === 'Warning') {
    recommendation = `WARNING: Accelerated splice wear or thermal excursion detected. Schedule non-destructive testing (NDT) at next shift break and verify belt tension take-up.`;
  }

  return {
    final_score: finalScore,
    sensor_risk_score: sensorRisk,
    camera_risk_score: cameraRisk,
    status,
    failure_probability: Math.min(99, Math.max(3, Math.round(finalScore * 0.96))),
    rul_hours: rulHours,
    contributing_factors: contributing,
    camera_defect: cameraInspection.defect_type,
    camera_confidence: cameraInspection.confidence,
    recommendation,
    timestamp: new Date().toISOString(),
  };
}

export function generateLiveSensorData(prev?: SensorData, anomalyMode?: 'normal' | 'warning' | 'critical'): SensorData {
  const now = new Date();
  const timeStr = now.toLocaleTimeString();
  const clamp = (val: number, min: number, max: number) => Math.min(max, Math.max(min, val));

  const p = prev || {
    temperature: 52.4,
    vibration: 1.45,
    overload: 76.2,
    motor_current: 178.5,
    belt_speed: 4.25,
    acceleration: 0.65,
    looseness: 0.28,
    bearing_condition: 88.0,
    motion_change: 1.2,
    timestamp: timeStr,
  };

  if (anomalyMode === 'critical') {
    // Smooth ramp towards critical targets
    const targetTemp = 86.5 + (Math.random() - 0.5) * 4;
    const targetVib = 6.2 + (Math.random() - 0.5) * 1.5;
    const targetOverload = 106 + (Math.random() - 0.5) * 5;
    const targetMotor = 242 + (Math.random() - 0.5) * 10;
    const targetSpeed = 2.1 + (Math.random() - 0.5) * 0.4;
    const targetBearing = 28 + (Math.random() - 0.5) * 6;

    return {
      temperature: Math.round((p.temperature + (targetTemp - p.temperature) * 0.45) * 10) / 10,
      vibration: Math.round((p.vibration + (targetVib - p.vibration) * 0.45) * 100) / 100,
      overload: Math.round((p.overload + (targetOverload - p.overload) * 0.45) * 10) / 10,
      motor_current: Math.round((p.motor_current + (targetMotor - p.motor_current) * 0.45) * 10) / 10,
      belt_speed: Math.round((p.belt_speed + (targetSpeed - p.belt_speed) * 0.45) * 100) / 100,
      acceleration: Math.round((p.acceleration + (3.4 - p.acceleration) * 0.45) * 100) / 100,
      looseness: Math.round((p.looseness + (0.78 - p.looseness) * 0.45) * 100) / 100,
      bearing_condition: Math.round((p.bearing_condition + (targetBearing - p.bearing_condition) * 0.45) * 10) / 10,
      motion_change: Math.round(clamp(p.motion_change + 0.8, 1, 7.5) * 10) / 10,
      timestamp: timeStr,
    };
  }

  if (anomalyMode === 'warning') {
    // Smooth ramp towards warning targets
    const targetTemp = 68.5 + (Math.random() - 0.5) * 3;
    const targetVib = 3.4 + (Math.random() - 0.5) * 0.6;
    const targetOverload = 94.2 + (Math.random() - 0.5) * 3;
    const targetMotor = 212 + (Math.random() - 0.5) * 8;
    const targetSpeed = 3.5 + (Math.random() - 0.5) * 0.2;
    const targetBearing = 48 + (Math.random() - 0.5) * 4;

    return {
      temperature: Math.round((p.temperature + (targetTemp - p.temperature) * 0.35) * 10) / 10,
      vibration: Math.round((p.vibration + (targetVib - p.vibration) * 0.35) * 100) / 100,
      overload: Math.round((p.overload + (targetOverload - p.overload) * 0.35) * 10) / 10,
      motor_current: Math.round((p.motor_current + (targetMotor - p.motor_current) * 0.35) * 10) / 10,
      belt_speed: Math.round((p.belt_speed + (targetSpeed - p.belt_speed) * 0.35) * 100) / 100,
      acceleration: Math.round((p.acceleration + (1.9 - p.acceleration) * 0.35) * 100) / 100,
      looseness: Math.round((p.looseness + (0.58 - p.looseness) * 0.35) * 100) / 100,
      bearing_condition: Math.round((p.bearing_condition + (targetBearing - p.bearing_condition) * 0.35) * 10) / 10,
      motion_change: Math.round(clamp(p.motion_change + 0.3, 1, 4.5) * 10) / 10,
      timestamp: timeStr,
    };
  }

  // Realistic nominal gradual drift with slight sine wave periodic surges
  const sec = (Date.now() / 1000) % 120; // 2 minute cycle
  const surgeWave = Math.sin(sec / 15); // gentle swell
  const hasSurge = surgeWave > 0.85;

  const targetTempBase = hasSurge ? 58.2 : 51.5;
  const targetVibBase = hasSurge ? 1.95 : 1.38;
  const targetOverloadBase = hasSurge ? 88.5 : 75.0;

  return {
    temperature: Math.round(clamp(p.temperature + (targetTempBase - p.temperature) * 0.15 + (Math.random() - 0.5) * 0.6, 44, 62) * 10) / 10,
    vibration: Math.round(clamp(p.vibration + (targetVibBase - p.vibration) * 0.15 + (Math.random() - 0.5) * 0.08, 0.95, 2.15) * 100) / 100,
    overload: Math.round(clamp(p.overload + (targetOverloadBase - p.overload) * 0.18 + (Math.random() - 0.5) * 1.5, 68, 92) * 10) / 10,
    motor_current: Math.round(clamp(p.motor_current + (p.overload * 2.3 - p.motor_current) * 0.2 + (Math.random() - 0.5) * 1.8, 168, 192) * 10) / 10,
    belt_speed: Math.round(clamp(p.belt_speed + (4.25 - p.belt_speed) * 0.12 + (Math.random() - 0.5) * 0.04, 4.05, 4.38) * 100) / 100,
    acceleration: Math.round(clamp(p.acceleration + (Math.random() - 0.5) * 0.08, 0.45, 1.05) * 100) / 100,
    looseness: Math.round(clamp(p.looseness + (Math.random() - 0.5) * 0.015, 0.22, 0.36) * 100) / 100,
    bearing_condition: Math.round(clamp(p.bearing_condition + (88 - p.bearing_condition) * 0.08 + (Math.random() - 0.5) * 0.2, 82, 94) * 10) / 10,
    motion_change: Math.round(clamp(p.motion_change + (Math.random() - 0.5) * 0.1, 0.8, 2.2) * 10) / 10,
    timestamp: timeStr,
  };
}

export function generateHistoricalData(days: number = 1): Array<{
  time: string;
  temperature: number;
  vibration: number;
  overload: number;
  bearing_condition: number;
  belt_speed: number;
  health_score: number;
}> {
  const points = days === 1 ? 24 : 28; // 24 hours or 28 intervals for 7 days
  const data = [];
  const now = Date.now();
  const interval = (days * 24 * 3600 * 1000) / points;

  for (let i = points; i >= 0; i--) {
    const time = new Date(now - i * interval);
    const label = days === 1
      ? time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : `${time.getMonth() + 1}/${time.getDate()} ${time.getHours()}:00`;

    // Add a couple of realistic transient load bumps in the past
    const isSpike = (i === 8 || i === 17);
    const temp = isSpike ? 67 + Math.random() * 8 : 48 + Math.sin(i / 3) * 6 + Math.random() * 3;
    const vib = isSpike ? 3.4 + Math.random() * 1.2 : 1.3 + Math.cos(i / 4) * 0.5 + Math.random() * 0.2;
    const oload = isSpike ? 96 + Math.random() * 7 : 76 + Math.sin(i / 2) * 10 + Math.random() * 4;
    const bearing = Math.max(45, 92 - (points - i) * 0.3 - (isSpike ? 10 : 0));
    const speed = isSpike ? 3.4 : 4.2 + (Math.random() - 0.5) * 0.2;

    const sensorMock: SensorData = {
      temperature: temp,
      vibration: vib,
      overload: oload,
      motor_current: 180 + (oload - 75) * 1.2,
      belt_speed: speed,
      acceleration: isSpike ? 2.1 : 0.7,
      looseness: 0.3,
      bearing_condition: bearing,
      motion_change: isSpike ? 3.8 : 1.5,
      timestamp: label,
    };
    const risk = calculateSensorRiskScore(sensorMock);
    const health = Math.max(5, 100 - risk);

    data.push({
      time: label,
      temperature: Math.round(temp * 10) / 10,
      vibration: Math.round(vib * 100) / 100,
      overload: Math.round(oload * 10) / 10,
      bearing_condition: Math.round(bearing * 10) / 10,
      belt_speed: Math.round(speed * 100) / 100,
      health_score: health,
    });
  }
  return data;
}

export const INITIAL_CAMERA_FRAMES: CameraInspection[] = [
  {
    id: 'cam-01',
    timestamp: '14:28:12',
    status: 'Normal',
    defect_type: 'No Defect / Clean Surface',
    confidence: 98.4,
    camera_risk_score: 5,
    bbox: undefined,
    imageUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=400&q=80',
    beltLocation: 'Carrying Strand - Section A',
  },
  {
    id: 'cam-02',
    timestamp: '14:26:40',
    status: 'Minor Damage',
    defect_type: 'Surface Micro-Crack',
    confidence: 86.2,
    camera_risk_score: 35,
    bbox: { x: 38, y: 44, width: 24, height: 18, label: 'Micro-crack (2.4mm)' },
    imageUrl: 'https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?auto=format&fit=crop&w=400&q=80',
    beltLocation: 'Top Cover - Joint #1 Splice Zone',
  },
  {
    id: 'cam-03',
    timestamp: '14:22:15',
    status: 'Normal',
    defect_type: 'No Defect / Clean Surface',
    confidence: 96.8,
    camera_risk_score: 8,
    bbox: undefined,
    imageUrl: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=400&q=80',
    beltLocation: 'Return Strand - Pulley Snub',
  },
  {
    id: 'cam-04',
    timestamp: '14:18:02',
    status: 'Minor Damage',
    defect_type: 'Longitudinal Gouge',
    confidence: 79.5,
    camera_risk_score: 42,
    bbox: { x: 52, y: 30, width: 32, height: 12, label: 'Shallow Gouge (1.8mm)' },
    imageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=400&q=80',
    beltLocation: 'Chute Drop Impact Bed Zone',
  },
  {
    id: 'cam-05',
    timestamp: '14:12:30',
    status: 'Normal',
    defect_type: 'No Defect / Clean Surface',
    confidence: 99.1,
    camera_risk_score: 4,
    bbox: undefined,
    imageUrl: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=400&q=80',
    beltLocation: 'Discharge Head Pulley',
  },
  {
    id: 'cam-06',
    timestamp: '14:05:19',
    status: 'Critical Damage',
    defect_type: 'Deep Splice Separation',
    confidence: 91.2,
    camera_risk_score: 88,
    bbox: { x: 22, y: 40, width: 56, height: 35, label: 'Critical Splice Delamination (91%)' },
    imageUrl: 'https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?auto=format&fit=crop&w=400&q=80',
    beltLocation: 'Hot Vulcanized Splice #2',
  },
];

export const INITIAL_ALERTS: AlertItem[] = [
  {
    id: 'ALT-1094',
    timestamp: 'Today, 14:24:18',
    severity: 'Warning',
    component: 'Joint #2 Splice Zone',
    factor: 'Vibration & Chatter',
    value: '3.4 mm/s',
    threshold: '> 2.0 mm/s',
    status: 'Active',
    recommendation: 'Verify splice step adhesion and inspect snub pulley lagging wear during next planned stoppage.',
  },
  {
    id: 'ALT-1093',
    timestamp: 'Today, 13:58:02',
    severity: 'Warning',
    component: 'Drive Motor M-01',
    factor: 'Temperature Excursion',
    value: '64.8 °C',
    threshold: '> 60.0 °C',
    status: 'Active',
    recommendation: 'Check forced cooling fan intake filter and examine motor non-drive end bearing lube.',
  },
  {
    id: 'ALT-1092',
    timestamp: 'Today, 12:15:44',
    severity: 'Critical',
    component: 'Weightometer Station 3',
    factor: 'Tonnage Overload',
    value: '106.5%',
    threshold: '> 100.0%',
    status: 'Acknowledged',
    recommendation: 'Vibratory feeder feed rate trimmed by 8% via PLC interlock. Monitor belt sag.',
  },
  {
    id: 'ALT-1091',
    timestamp: 'Today, 10:42:10',
    severity: 'Warning',
    component: 'Tail Tensioner Unit',
    factor: 'Belt Slack / Sag Index',
    value: '0.59 sag',
    threshold: '> 0.50 sag',
    status: 'Resolved',
    recommendation: 'Gravity take-up carriage counterweight inspected. Sheave cables re-tensioned.',
  },
  {
    id: 'ALT-1090',
    timestamp: 'Yesterday, 22:11:05',
    severity: 'Critical',
    component: 'Drive Pulley Bearing A',
    factor: 'Acoustic Shock Pulse',
    value: '34 pts',
    threshold: '< 40 pts',
    status: 'Resolved',
    recommendation: 'Automated centralized greasing cycle discharged. Vibration normalized to 1.6 mm/s.',
  },
];

export const DEFAULT_SENSOR_DATA: SensorData = {
  temperature: 52.4,
  vibration: 1.45,
  overload: 76.2,
  motor_current: 178.5,
  belt_speed: 4.25,
  acceleration: 0.65,
  looseness: 0.28,
  bearing_condition: 88.0,
  motion_change: 1.2,
  timestamp: '14:30:00',
};

export const evaluateSensorRisk = calculateSensorRiskScore;
export const simulateNextSensorReading = generateLiveSensorData;

export function checkThresholdAlerts(data: SensorData): AlertItem[] {
  const alerts: AlertItem[] = [];
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

  if (data.temperature > 80) {
    alerts.push({
      id: `ALT-${Date.now()}-1`,
      timestamp: timeStr,
      severity: 'Critical',
      component: 'Drive Motor M-01',
      factor: 'Winding Temperature',
      value: `${data.temperature.toFixed(1)} °C`,
      threshold: '> 80.0 °C',
      status: 'Active',
      recommendation: 'Critical thermal overload. Reduce conveyor tonnage feed rate immediately.',
    });
  } else if (data.temperature > 60) {
    alerts.push({
      id: `ALT-${Date.now()}-1`,
      timestamp: timeStr,
      severity: 'Warning',
      component: 'Drive Motor M-01',
      factor: 'Winding Temperature',
      value: `${data.temperature.toFixed(1)} °C`,
      threshold: '> 60.0 °C',
      status: 'Active',
      recommendation: 'Winding temperature trending high. Inspect cooling fans and air intake louvers.',
    });
  }

  if (data.vibration > 5.0) {
    alerts.push({
      id: `ALT-${Date.now()}-2`,
      timestamp: timeStr,
      severity: 'Critical',
      component: 'Drive Head Pulley & Joint #2',
      factor: 'Radial Vibration',
      value: `${data.vibration.toFixed(2)} mm/s`,
      threshold: '> 5.0 mm/s',
      status: 'Active',
      recommendation: 'Severe splice chatter or drum unbalance detected. High risk of catastrophic failure.',
    });
  } else if (data.vibration > 2.0) {
    alerts.push({
      id: `ALT-${Date.now()}-2`,
      timestamp: timeStr,
      severity: 'Warning',
      component: 'Drive Head Pulley',
      factor: 'Radial Vibration',
      value: `${data.vibration.toFixed(2)} mm/s`,
      threshold: '> 2.0 mm/s',
      status: 'Active',
      recommendation: 'Moderate vibration detected. Inspect pulley lagging adhesion and idler roll bearings.',
    });
  }

  if (data.overload > 100) {
    alerts.push({
      id: `ALT-${Date.now()}-3`,
      timestamp: timeStr,
      severity: 'Critical',
      component: 'Overland Conveyor Loading Chute',
      factor: 'Belt Overload',
      value: `${data.overload.toFixed(1)}%`,
      threshold: '> 100.0%',
      status: 'Active',
      recommendation: 'Tonnage exceeds maximum design throughput (6,500 tph). Throttle crusher apron feeder.',
    });
  }

  if (data.bearing_condition < 40) {
    alerts.push({
      id: `ALT-${Date.now()}-4`,
      timestamp: timeStr,
      severity: 'Critical',
      component: 'Primary Drive Pillow Block Bearing',
      factor: 'Bearing Shock Pulse',
      value: `${data.bearing_condition.toFixed(0)} pts`,
      threshold: '< 40.0 pts',
      status: 'Active',
      recommendation: 'Bearing race spalling or cage breakdown imminent. Plan emergency bearing change.',
    });
  }

  if (data.looseness > 0.70) {
    alerts.push({
      id: `ALT-${Date.now()}-5`,
      timestamp: timeStr,
      severity: 'Critical',
      component: 'Gravity Take-Up Tensioner',
      factor: 'Belt Sag Looseness',
      value: `${data.looseness.toFixed(2)} sag`,
      threshold: '> 0.70 sag',
      status: 'Active',
      recommendation: 'Extreme belt sag detected. Slippage on drive drum probable. Inspect counterweight travel.',
    });
  }

  return alerts;
}
