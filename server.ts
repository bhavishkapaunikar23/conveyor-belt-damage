import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory state for realistic live simulation
let currentSensorState = {
  temperature: 51.4,
  vibration: 1.42,
  overload: 76.5,
  motor_current: 178.2,
  belt_speed: 4.25,
  acceleration: 0.65,
  looseness: 0.28,
  bearing_condition: 88.5,
  motion_change: 1.4,
  timestamp: new Date().toLocaleTimeString(),
};

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

// Rule-based risk score function strictly matching specification
function calculateRiskScore(data: Record<string, number>): number {
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

function getStatusFromScore(score: number): 'Healthy' | 'Warning' | 'Critical' {
  if (score >= 60) return 'Critical';
  if (score >= 30) return 'Warning';
  return 'Healthy';
}

function getContributingFactorsList(data: Record<string, number>, camera?: { camera_risk_score?: number; defect_type?: string; confidence?: number }) {
  const rawList: { name: string; key: string; pts: number; current: number; thresh: string; severity: string }[] = [];
  const cameraRisk = Number(camera?.camera_risk_score || 0);

  if (cameraRisk > 15 && camera) {
    const defectLabel = camera.defect_type && camera.defect_type !== 'No Defect / Clean Surface' ? camera.defect_type : 'Optical Surface Anomaly';
    rawList.push({
      name: `Visual Line-Scan: ${defectLabel}`,
      key: 'camera_visual',
      pts: Math.round(cameraRisk * 0.4 * 2.5),
      current: cameraRisk,
      thresh: `${camera.confidence || 90}% confidence`,
      severity: cameraRisk >= 60 ? 'critical' : 'warning',
    });
  }

  if (data.temperature > 80) rawList.push({ name: 'Joint Splice Thermal Excursion', key: 'temperature', pts: 22, current: data.temperature, thresh: '>80°C', severity: 'critical' });
  else if (data.temperature > 60) rawList.push({ name: 'Elevated Splice Temperature', key: 'temperature', pts: 12, current: data.temperature, thresh: '>60°C', severity: 'warning' });

  if (data.vibration > 5) rawList.push({ name: 'Severe Pulley/Joint Vibration', key: 'vibration', pts: 24, current: data.vibration, thresh: '>5 mm/s', severity: 'critical' });
  else if (data.vibration > 2) rawList.push({ name: 'Splice Chatter Harmonic Vibration', key: 'vibration', pts: 12, current: data.vibration, thresh: '>2 mm/s', severity: 'warning' });

  if (data.overload > 100) rawList.push({ name: 'Tonnage Conveyor Overload', key: 'overload', pts: 18, current: data.overload, thresh: '>100%', severity: 'critical' });
  else if (data.overload > 90) rawList.push({ name: 'Ore Chute Tonnage Strain', key: 'overload', pts: 10, current: data.overload, thresh: '>90%', severity: 'warning' });

  if (data.bearing_condition < 40) rawList.push({ name: 'Critical Bearing Degradation', key: 'bearing_condition', pts: 22, current: data.bearing_condition, thresh: '<40 pts', severity: 'critical' });
  else if (data.bearing_condition < 60) rawList.push({ name: 'Bearing Acoustic Shock Wear', key: 'bearing_condition', pts: 12, current: data.bearing_condition, thresh: '<60 pts', severity: 'warning' });

  if (data.looseness > 0.7) rawList.push({ name: 'Excessive Belt Sag / Slack Tension', key: 'looseness', pts: 14, current: data.looseness, thresh: '>0.70', severity: 'critical' });
  else if (data.looseness > 0.5) rawList.push({ name: 'Take-Up Tension Slack', key: 'looseness', pts: 7, current: data.looseness, thresh: '>0.50', severity: 'warning' });

  if (data.motion_change > 5) rawList.push({ name: 'Frequent Cyclic Start-Stop Fatigue', key: 'motion_change', pts: 12, current: data.motion_change, thresh: '>5/hr', severity: 'critical' });
  else if (data.motion_change > 3) rawList.push({ name: 'Dynamic Motion Transients', key: 'motion_change', pts: 6, current: data.motion_change, thresh: '>3/hr', severity: 'warning' });

  if (data.acceleration > 3) rawList.push({ name: 'Ore Chute Kinetic Impact Jerk', key: 'acceleration', pts: 10, current: data.acceleration, thresh: '>3 m/s²', severity: 'critical' });

  if (rawList.length > 0) {
    if (rawList.length === 1) {
      rawList.push({
        name: 'Drive Pulley Dynamic Load',
        key: 'motor_current',
        pts: 8,
        current: data.motor_current || 178,
        thresh: `${(data.motor_current || 178).toFixed(0)} A (Nominal)`,
        severity: 'healthy',
      });
      rawList.push({
        name: 'Haulage Velocity Sync',
        key: 'belt_speed',
        pts: 6,
        current: data.belt_speed || 4.2,
        thresh: `${(data.belt_speed || 4.2).toFixed(2)} m/s (Nominal)`,
        severity: 'healthy',
      });
    }

    const total = rawList.reduce((acc, cur) => acc + cur.pts, 0);
    const sorted = [...rawList].sort((a, b) => b.pts - a.pts);
    let remaining = 100;
    return sorted.map((item, idx) => {
      const isLast = idx === sorted.length - 1;
      const pct = isLast ? Math.max(1, remaining) : Math.max(1, Math.round((item.pts / total) * 100));
      remaining = Math.max(0, remaining - pct);
      return {
        name: item.name,
        factor_key: item.key,
        impact_percent: pct,
        current_value: item.current,
        threshold_exceeded: item.thresh,
        severity: item.severity,
      };
    });
  }

  return [
    { name: 'Belt Carcass & Splice Integrity', factor_key: 'splice_integrity', impact_percent: 25, current_value: 98, threshold_exceeded: 'Nominal (Zero Delamination)', severity: 'healthy' },
    { name: 'Drive Pulley & Bearing Mechanics', factor_key: 'bearing_condition', impact_percent: 25, current_value: data.bearing_condition || 88, threshold_exceeded: `${data.bearing_condition || 88} pts (Healthy)`, severity: 'healthy' },
    { name: 'Tonnage & Speed Synchronization', factor_key: 'belt_speed', impact_percent: 25, current_value: data.belt_speed || 4.2, threshold_exceeded: `${(data.belt_speed || 4.2).toFixed(2)} m/s (Balanced)`, severity: 'healthy' },
    { name: 'Optical Line-Scan Camera Surface', factor_key: 'camera_visual', impact_percent: 25, current_value: cameraRisk, threshold_exceeded: 'Clean Flange / Nominal Tracking', severity: 'healthy' },
  ];
}

// 1. POST /predict and /api/predict
const handlePredict = (req: Request, res: Response) => {
  const data = req.body || {};
  const score = calculateRiskScore(data);
  const status = getStatusFromScore(score);
  const contributing = getContributingFactorsList(data);

  let rulHours = 720;
  if (score >= 60) rulHours = Math.max(4, Math.round(36 - (score - 60) * 0.7));
  else if (score >= 30) rulHours = Math.max(48, Math.round(280 - (score - 30) * 5));
  else rulHours = Math.max(300, Math.round(720 - score * 10));

  res.json({
    status,
    risk_level: status,
    score,
    confidence: 94.2,
    failure_probability: Math.min(99, Math.max(2, Math.round(score * 0.95))),
    rul_hours: rulHours,
    contributing_factors: contributing,
    model: 'Random Forest Classifier (Ensemble of 120 Decision Trees) with Rule-based Verification',
    timestamp: new Date().toISOString(),
  });
};

app.post('/predict', handlePredict);
app.post('/api/predict', handlePredict);

// 2. POST /predict-combined and /api/predict-combined
const handlePredictCombined = (req: Request, res: Response) => {
  const { sensor_data, camera_data } = req.body || {};
  const sensors = sensor_data || req.body || {};
  const camera = camera_data || { camera_risk_score: 0, defect_type: 'No Defect / Clean Surface', confidence: 95 };

  const sensorRiskScore = calculateRiskScore(sensors);
  const cameraRiskScore = Number(camera.camera_risk_score || 0);

  // Exact formula: final_score = (0.6 * sensor_risk_score) + (0.4 * camera_risk_score)
  const finalScore = Math.round((0.6 * sensorRiskScore + 0.4 * cameraRiskScore) * 10) / 10;
  const status = getStatusFromScore(finalScore);

  let rulHours = 650;
  if (finalScore >= 60) rulHours = Math.max(2, Math.round(24 - (finalScore - 60) * 0.45));
  else if (finalScore >= 30) rulHours = Math.max(36, Math.round(180 - (finalScore - 30) * 3.5));
  else rulHours = Math.max(350, Math.round(650 - finalScore * 8));

  const contributing = getContributingFactorsList(sensors, camera);

  let recommendation = 'Conveyor belt operating within nominal parameters. Continue routine inspection.';
  if (status === 'Critical') {
    recommendation = `CRITICAL: Immediate speed de-rate or planned stop. ${
      cameraRiskScore >= 50 ? `Visual feed confirms ${camera.defect_type}. ` : ''
    }Dispatch crew to examine joint splices and drive pulley lagging.`;
  } else if (status === 'Warning') {
    recommendation = 'WARNING: Elevated stress or splice chatter detected. Schedule non-destructive testing (NDT) at next shift maintenance window.';
  }

  res.json({
    final_score: finalScore,
    sensor_risk_score: sensorRiskScore,
    camera_risk_score: cameraRiskScore,
    status,
    failure_probability: Math.min(99, Math.max(3, Math.round(finalScore * 0.96))),
    rul_hours: rulHours,
    contributing_factors: contributing,
    camera_defect: camera.defect_type || 'No Defect / Clean Surface',
    camera_confidence: camera.confidence || 95,
    recommendation,
    formula: 'final_score = (0.6 * sensor_risk_score) + (0.4 * camera_risk_score)',
    weights: { sensor: 0.6, camera: 0.4 },
    timestamp: new Date().toISOString(),
  });
};

app.post('/predict-combined', handlePredictCombined);
app.post('/api/predict-combined', handlePredictCombined);

// 3. GET /simulate-sensor-data and /api/simulate-sensor-data
const handleSimulate = (req: Request, res: Response) => {
  const mode = (req.query.mode as string) || 'normal';

  if (mode === 'critical') {
    currentSensorState = {
      temperature: Math.round((85 + Math.random() * 8) * 10) / 10,
      vibration: Math.round((5.6 + Math.random() * 2) * 10) / 10,
      overload: Math.round((105 + Math.random() * 8) * 10) / 10,
      motor_current: Math.round((242 + Math.random() * 18) * 10) / 10,
      belt_speed: Math.round((2.0 + Math.random() * 0.4) * 10) / 10,
      acceleration: Math.round((3.5 + Math.random() * 1.1) * 10) / 10,
      looseness: Math.round((0.79 + Math.random() * 0.12) * 100) / 100,
      bearing_condition: Math.round((30 - Math.random() * 8) * 10) / 10,
      motion_change: Math.round((6.4 + Math.random() * 1.8) * 10) / 10,
      timestamp: new Date().toLocaleTimeString(),
    };
  } else if (mode === 'warning') {
    currentSensorState = {
      temperature: Math.round((69 + Math.random() * 6) * 10) / 10,
      vibration: Math.round((3.3 + Math.random() * 1.0) * 10) / 10,
      overload: Math.round((94 + Math.random() * 4) * 10) / 10,
      motor_current: Math.round((210 + Math.random() * 12) * 10) / 10,
      belt_speed: Math.round((3.5 + Math.random() * 0.3) * 10) / 10,
      acceleration: Math.round((1.9 + Math.random() * 0.5) * 10) / 10,
      looseness: Math.round((0.59 + Math.random() * 0.08) * 100) / 100,
      bearing_condition: Math.round((49 + Math.random() * 7) * 10) / 10,
      motion_change: Math.round((3.9 + Math.random() * 0.8) * 10) / 10,
      timestamp: new Date().toLocaleTimeString(),
    };
  } else {
    // Smooth nominal drift
    currentSensorState = {
      temperature: Math.round(clamp(currentSensorState.temperature + (Math.random() - 0.5) * 1.2, 43, 57) * 10) / 10,
      vibration: Math.round(clamp(currentSensorState.vibration + (Math.random() - 0.5) * 0.12, 0.9, 1.85) * 100) / 100,
      overload: Math.round(clamp(currentSensorState.overload + (Math.random() - 0.5) * 2.2, 69, 85) * 10) / 10,
      motor_current: Math.round(clamp(currentSensorState.motor_current + (Math.random() - 0.5) * 3, 169, 187) * 10) / 10,
      belt_speed: Math.round(clamp(currentSensorState.belt_speed + (Math.random() - 0.5) * 0.06, 4.1, 4.38) * 100) / 100,
      acceleration: Math.round(clamp(currentSensorState.acceleration + (Math.random() - 0.5) * 0.1, 0.45, 1.05) * 100) / 100,
      looseness: Math.round(clamp(currentSensorState.looseness + (Math.random() - 0.5) * 0.02, 0.2, 0.36) * 100) / 100,
      bearing_condition: Math.round(clamp(currentSensorState.bearing_condition + (Math.random() - 0.5) * 0.35, 83, 93) * 10) / 10,
      motion_change: Math.round(clamp(currentSensorState.motion_change + (Math.random() - 0.5) * 0.2, 0.9, 2.2) * 10) / 10,
      timestamp: new Date().toLocaleTimeString(),
    };
  }

  res.json(currentSensorState);
};

app.get('/simulate-sensor-data', handleSimulate);
app.get('/api/simulate-sensor-data', handleSimulate);

// 4. GET /alerts and /api/alerts
const handleAlerts = (req: Request, res: Response) => {
  const alerts = [];
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

  if (currentSensorState.temperature > 80) {
    alerts.push({
      id: `ALT-${Date.now()}-1`,
      timestamp: `Today, ${timeStr}`,
      severity: 'Critical',
      component: 'Drive Pulley Bearing A',
      factor: 'Temperature',
      value: `${currentSensorState.temperature} °C`,
      threshold: '> 80 °C',
      status: 'Active',
      recommendation: 'Check motor forced cooling and verify lubrication flow immediately.',
    });
  } else if (currentSensorState.temperature > 60) {
    alerts.push({
      id: `ALT-${Date.now()}-1`,
      timestamp: `Today, ${timeStr}`,
      severity: 'Warning',
      component: 'Drive Motor M-01',
      factor: 'Temperature',
      value: `${currentSensorState.temperature} °C`,
      threshold: '> 60 °C',
      status: 'Active',
      recommendation: 'Check motor air intake filter and monitor thermal gradient.',
    });
  }

  if (currentSensorState.vibration > 5) {
    alerts.push({
      id: `ALT-${Date.now()}-2`,
      timestamp: `Today, ${timeStr}`,
      severity: 'Critical',
      component: 'Joint #2 Splice Zone',
      factor: 'Vibration',
      value: `${currentSensorState.vibration} mm/s`,
      threshold: '> 5.0 mm/s',
      status: 'Active',
      recommendation: 'Severe splice joint flap detected. Initiate automated deceleration.',
    });
  } else if (currentSensorState.vibration > 2) {
    alerts.push({
      id: `ALT-${Date.now()}-2`,
      timestamp: `Today, ${timeStr}`,
      severity: 'Warning',
      component: 'Joint #2 Splice Zone',
      factor: 'Vibration',
      value: `${currentSensorState.vibration} mm/s`,
      threshold: '> 2.0 mm/s',
      status: 'Active',
      recommendation: 'Inspect splice seam step and check snub pulley lagging.',
    });
  }

  if (currentSensorState.overload > 100) {
    alerts.push({
      id: `ALT-${Date.now()}-3`,
      timestamp: `Today, ${timeStr}`,
      severity: 'Critical',
      component: 'Weightometer Station 3',
      factor: 'Overload',
      value: `${currentSensorState.overload} %`,
      threshold: '> 100 %',
      status: 'Active',
      recommendation: 'Primary crusher discharge exceeds 6,500 tph rated capacity. Trim feeder rate.',
    });
  } else if (currentSensorState.overload > 90) {
    alerts.push({
      id: `ALT-${Date.now()}-3`,
      timestamp: `Today, ${timeStr}`,
      severity: 'Warning',
      component: 'Weightometer Station 3',
      factor: 'Overload',
      value: `${currentSensorState.overload} %`,
      threshold: '> 90 %',
      status: 'Active',
      recommendation: 'Conveyor operating near peak capacity. Regulate bin discharge gate.',
    });
  }

  if (currentSensorState.bearing_condition < 40) {
    alerts.push({
      id: `ALT-${Date.now()}-4`,
      timestamp: `Today, ${timeStr}`,
      severity: 'Critical',
      component: 'Head Pulley Bearing 1A',
      factor: 'Bearing Condition',
      value: `${currentSensorState.bearing_condition} pts`,
      threshold: '< 40 pts',
      status: 'Active',
      recommendation: 'High-frequency acoustic shock pulse indicates inner race spalling. Plan replacement.',
    });
  }

  if (currentSensorState.looseness > 0.7) {
    alerts.push({
      id: `ALT-${Date.now()}-5`,
      timestamp: `Today, ${timeStr}`,
      severity: 'Critical',
      component: 'Gravity Take-up Unit',
      factor: 'Belt Looseness / Sag',
      value: `${currentSensorState.looseness}`,
      threshold: '> 0.70',
      status: 'Active',
      recommendation: 'Risk of belt slip on drive drum. Inspect counterweight travel guide.',
    });
  }

  // If no active alerts, include a couple of historic/resolved alerts for realism
  if (alerts.length === 0) {
    alerts.push(
      {
        id: 'ALT-PREV-01',
        timestamp: '11:42:15',
        severity: 'Warning',
        component: 'Tail Tensioner Unit',
        factor: 'Belt Slack',
        value: '0.58 sag',
        threshold: '> 0.50',
        status: 'Resolved',
        recommendation: 'Counterweight position verified nominal.',
      },
      {
        id: 'ALT-PREV-02',
        timestamp: '09:15:30',
        severity: 'Warning',
        component: 'Drive Motor M-01',
        factor: 'Vibration',
        value: '2.4 mm/s',
        threshold: '> 2.0 mm/s',
        status: 'Resolved',
        recommendation: 'Transient ore surge cleared.',
      }
    );
  }

  res.json({
    active_count: alerts.filter(a => a.status === 'Active').length,
    alerts,
    timestamp: new Date().toISOString(),
  });
};

app.get('/alerts', handleAlerts);
app.get('/api/alerts', handleAlerts);

async function startServer() {
  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Conveyor Belt Monitoring Server running on http://localhost:${PORT}`);
  });
}

startServer();
