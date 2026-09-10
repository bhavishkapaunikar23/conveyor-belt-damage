import React, { useState, useEffect, useCallback } from 'react';
import {
  PageId,
  SensorData,
  SensorHistoryPoint,
  CombinedPrediction,
  CameraInspection,
  AlertItem,
  AnomalyType,
  ActivityEvent,
} from './types';
import {
  DEFAULT_SENSOR_DATA,
  INITIAL_CAMERA_FRAMES,
  INITIAL_ALERTS,
  evaluateCombinedPrediction,
  calculateSensorRiskScore,
  checkThresholdAlerts,
  simulateNextSensorReading,
} from './utils/conveyorLogic';
import { Sidebar } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import { OverviewView } from './components/OverviewView';
import { RealtimeSensorsView } from './components/RealtimeSensorsView';
import { CameraInspectionView } from './components/CameraInspectionView';
import { DigitalTwinView, SelectedTwinComponent } from './components/DigitalTwinView';
import { PredictiveAnalyticsView } from './components/PredictiveAnalyticsView';
import { AlertsView } from './components/AlertsView';
import { SystemIntegrationView } from './components/SystemIntegrationView';
import { HistoricalReportsView } from './components/HistoricalReportsView';
import { ComponentDetailModal } from './components/ComponentDetailModal';
import { AlertToastContainer, ToastAlert } from './components/AlertToastContainer';

const INITIAL_ACTIVITY_EVENTS: ActivityEvent[] = [
  {
    id: 'evt-1',
    timestamp: new Date(Date.now() - 3000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    source: 'Sensor',
    message: '9 telemetry channels synchronized at 50Hz via edge MQTT gateway',
    level: 'info',
  },
  {
    id: 'evt-2',
    timestamp: new Date(Date.now() - 12000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    source: 'Camera',
    message: 'High-speed line-scan camera 60fps completed splice integrity pass on Joint #2',
    level: 'info',
  },
  {
    id: 'evt-3',
    timestamp: new Date(Date.now() - 25000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    source: 'Twin',
    message: 'Digital twin sag tension recalculated to 0.28m; gravity take-up balanced',
    level: 'info',
  },
  {
    id: 'evt-4',
    timestamp: new Date(Date.now() - 58000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    source: 'PLC',
    message: 'Rockwell ControlLogix PLC nodes operating with 4ms latency',
    level: 'info',
  },
];

export default function App() {
  // Navigation & Conveyor
  const [currentPage, setCurrentPage] = useState<PageId>('overview');
  const [selectedConveyor, setSelectedConveyor] = useState<string>('CV-101');

  // Streaming & Simulation State
  const [isStreaming, setIsStreaming] = useState<boolean>(true);
  const [pollIntervalMs, setPollIntervalMs] = useState<number>(2000);
  const [anomalyMode, setAnomalyMode] = useState<AnomalyType>('normal');

  // Core Telemetry State
  const [sensorData, setSensorData] = useState<SensorData>(DEFAULT_SENSOR_DATA);

  // Live Toast Notifications
  const [toasts, setToasts] = useState<ToastAlert[]>([]);

  // Live Activity Stream
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>(INITIAL_ACTIVITY_EVENTS);

  // Sensor History for charts/sparklines
  const [history, setHistory] = useState<SensorHistoryPoint[]>(() => {
    const pts: SensorHistoryPoint[] = [];
    const now = Date.now();
    for (let i = 15; i >= 0; i--) {
      const t = new Date(now - i * 2000);
      pts.push({
        time: t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        timestamp: t.getTime(),
        temperature: 52 + Math.random() * 2,
        vibration: 1.4 + Math.random() * 0.2,
        overload: 75 + Math.random() * 4,
        motor_current: 178 + Math.random() * 6,
        belt_speed: 4.2 + (Math.random() - 0.5) * 0.1,
        acceleration: 0.6 + Math.random() * 0.2,
        looseness: 0.28 + Math.random() * 0.04,
        bearing_condition: 88 - Math.random() * 2,
        motion_change: 1.2,
        health_score: 85,
      });
    }
    return pts;
  });

  // Camera State
  const [activeCamera, setActiveCamera] = useState<CameraInspection>(INITIAL_CAMERA_FRAMES[1]);

  // Combined Prediction
  const [prediction, setPrediction] = useState<CombinedPrediction>(() =>
    evaluateCombinedPrediction(DEFAULT_SENSOR_DATA, INITIAL_CAMERA_FRAMES[1])
  );

  // Alerts State
  const [alerts, setAlerts] = useState<AlertItem[]>(INITIAL_ALERTS);

  // Digital Twin Modal
  const [selectedComponent, setSelectedComponent] = useState<SelectedTwinComponent | null>(null);

  // Calculate Health Scores
  const sensorRiskScore = calculateSensorRiskScore(sensorData);
  const overallHealthScore = Math.max(5, Math.min(100, Math.round(100 - prediction.final_score)));

  // Simulation step
  const stepSimulation = useCallback(async () => {
    if (!isStreaming) return;

    try {
      // Attempt backend simulation endpoint
      const res = await fetch(`/simulate-sensor-data?anomaly=${anomalyMode}`);
      if (res.ok) {
        const freshData: SensorData = await res.json();
        setSensorData(freshData);

        const freshRisk = calculateSensorRiskScore(freshData);
        const point: SensorHistoryPoint = {
          ...freshData,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          timestamp: Date.now(),
          health_score: Math.max(5, 100 - freshRisk),
        };
        setHistory((prev) => [...prev.slice(-20), point]);

        // Evaluate alerts
        const newAlerts = checkThresholdAlerts(freshData);
        if (newAlerts.length > 0) {
          setAlerts((prev) => {
            const existingIds = new Set(prev.map((a) => a.factor + a.component));
            const freshFiltered = newAlerts.filter((a) => !existingIds.has(a.factor + a.component));
            if (freshFiltered.length > 0) {
              // Dispatch toast
              freshFiltered.forEach((al) => {
                const toastId = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                setToasts((t) => [{ ...al, toastId }, ...t.slice(0, 2)]);
                setTimeout(() => {
                  setToasts((t) => t.filter((item) => item.toastId !== toastId));
                }, 6500);
              });
              // Append to activity events
              const evts: ActivityEvent[] = freshFiltered.map((al) => ({
                id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                source: 'Sensor',
                message: `${al.factor} Alert on ${al.component}: ${al.value} (threshold ${al.threshold})`,
                level: al.severity === 'Critical' ? 'critical' : 'warning',
              }));
              setActivityEvents((act) => [...evts, ...act.slice(0, 19)]);
            }
            return [...freshFiltered, ...prev];
          });
        }

        setPrediction(evaluateCombinedPrediction(freshData, activeCamera));
        return;
      }
    } catch (e) {
      // Fall through to local simulation
    }

    // Local simulation fallback
    setSensorData((prev) => {
      const next = simulateNextSensorReading(prev, anomalyMode);
      const freshRisk = calculateSensorRiskScore(next);
      const point: SensorHistoryPoint = {
        ...next,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        timestamp: Date.now(),
        health_score: Math.max(5, 100 - freshRisk),
      };
      setHistory((hist) => [...hist.slice(-20), point]);

      const newAlerts = checkThresholdAlerts(next);
      if (newAlerts.length > 0) {
        setAlerts((existing) => {
          const ids = new Set(existing.map((a) => a.factor + a.component));
          const freshFiltered = newAlerts.filter((a) => !ids.has(a.factor + a.component));
          if (freshFiltered.length > 0) {
            freshFiltered.forEach((al) => {
              const toastId = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
              setToasts((t) => [{ ...al, toastId }, ...t.slice(0, 2)]);
              setTimeout(() => {
                setToasts((t) => t.filter((item) => item.toastId !== toastId));
              }, 6500);
            });
            const evts: ActivityEvent[] = freshFiltered.map((al) => ({
              id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              source: 'Sensor',
              message: `${al.factor} Alert on ${al.component}: ${al.value} (threshold ${al.threshold})`,
              level: al.severity === 'Critical' ? 'critical' : 'warning',
            }));
            setActivityEvents((act) => [...evts, ...act.slice(0, 19)]);
          }
          return [...freshFiltered, ...existing];
        });
      } else if (Math.random() > 0.65) {
        // Subtle periodic event to keep activity stream alive with genuine industrial events
        const eventOptions = [
          { source: 'Sensor' as const, message: `Belt running at ${next.belt_speed.toFixed(2)} m/s, motor current ${next.motor_current.toFixed(0)} A` },
          { source: 'Camera' as const, message: 'Edge camera verified splice joint #2 surface integrity (nominal)' },
          { source: 'Twin' as const, message: `Digital twin kinematics synced with ${next.vibration.toFixed(2)} mm/s RMS vibration` },
          { source: 'Prediction' as const, message: 'ML Random Forest model scored current operational risk index' },
        ];
        const chosen = eventOptions[Math.floor(Math.random() * eventOptions.length)];
        setActivityEvents((act) => [
          {
            id: `evt-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            source: chosen.source,
            message: chosen.message,
            level: 'info',
          },
          ...act.slice(0, 19),
        ]);
      }

      setPrediction(evaluateCombinedPrediction(next, activeCamera));
      return next;
    });
  }, [isStreaming, anomalyMode, activeCamera]);

  // Polling Interval Effect
  useEffect(() => {
    const timer = setInterval(() => {
      stepSimulation();
    }, pollIntervalMs);

    return () => clearInterval(timer);
  }, [stepSimulation, pollIntervalMs]);

  // Alert Handlers
  const handleAcknowledgeAlert = (id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'Acknowledged' as const } : a))
    );
  };

  const handleResolveAlert = (id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'Resolved' as const } : a))
    );
  };

  const activeAlertCount = alerts.filter((a) => a.status === 'Active').length;

  return (
    <div className="flex h-screen bg-[var(--bg-base)] text-[var(--text-primary)] font-sans overflow-hidden">
      {/* 1. Left Sidebar Navigation */}
      <Sidebar
        currentPage={currentPage}
        onSelectPage={setCurrentPage}
        activeAlertCount={activeAlertCount}
        overallHealthScore={overallHealthScore}
        selectedConveyor={selectedConveyor}
        onSelectConveyor={setSelectedConveyor}
        isStreaming={isStreaming}
      />

      {/* 2. Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[var(--bg-base)]">
        {/* Top Header Simulation & Control Bar */}
        <TopHeader
          currentPage={currentPage}
          isStreaming={isStreaming}
          onToggleStreaming={() => setIsStreaming(!isStreaming)}
          onTriggerAnomaly={(mode) => setAnomalyMode(mode)}
          pollIntervalMs={pollIntervalMs}
          onChangePollInterval={setPollIntervalMs}
          selectedConveyor={selectedConveyor}
          onManualRefresh={stepSimulation}
          beltSpeed={sensorData.belt_speed}
        />

        {/* View Routing Body with Scroll */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-[var(--bg-base)]">
          <div className="max-w-7xl mx-auto">
            {currentPage === 'overview' && (
              <OverviewView
                sensorData={sensorData}
                prediction={prediction}
                activeAlertCount={activeAlertCount}
                overallHealthScore={overallHealthScore}
                onNavigate={setCurrentPage}
                selectedConveyor={selectedConveyor}
                activityEvents={activityEvents}
              />
            )}

            {currentPage === 'realtime' && (
              <RealtimeSensorsView
                sensorData={sensorData}
                history={history}
                overallHealthScore={overallHealthScore}
                sensorRiskScore={sensorRiskScore}
              />
            )}

            {currentPage === 'camera' && (
              <CameraInspectionView
                sensorData={sensorData}
                onUpdateCombinedPrediction={(pred) => setPrediction(pred)}
              />
            )}

            {currentPage === 'digital-twin' && (
              <DigitalTwinView
                sensorData={sensorData}
                prediction={prediction}
                onSelectComponent={(comp) => setSelectedComponent(comp)}
              />
            )}

            {currentPage === 'predictions' && (
              <PredictiveAnalyticsView
                sensorData={sensorData}
                prediction={prediction}
                activeCamera={activeCamera}
                onRefreshPrediction={(custom) => {
                  if (custom) {
                    setPrediction(custom);
                  } else {
                    setPrediction(evaluateCombinedPrediction(sensorData, activeCamera));
                  }
                }}
              />
            )}

            {currentPage === 'alerts' && (
              <AlertsView
                alerts={alerts}
                onAcknowledgeAlert={handleAcknowledgeAlert}
                onResolveAlert={handleResolveAlert}
              />
            )}

            {currentPage === 'integrations' && <SystemIntegrationView />}

            {currentPage === 'history' && <HistoricalReportsView />}
          </div>
        </main>
      </div>

      {/* Live Toast Alerts */}
      <AlertToastContainer
        toasts={toasts}
        onDismiss={(toastId) => setToasts((prev) => prev.filter((t) => t.toastId !== toastId))}
        onNavigateToAlerts={() => setCurrentPage('alerts')}
      />

      {/* Detail Modal for Selected Component */}
      <ComponentDetailModal
        component={selectedComponent}
        onClose={() => setSelectedComponent(null)}
      />
    </div>
  );
}
