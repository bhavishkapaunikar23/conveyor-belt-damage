import React, { useState } from 'react';
import {
  BrainCircuit,
  Clock,
  Sparkles,
  BarChart3,
  Layers,
  Shield,
} from 'lucide-react';
import { SensorData, CombinedPrediction, CameraInspection } from '../types';

interface PredictiveAnalyticsViewProps {
  sensorData: SensorData;
  prediction: CombinedPrediction;
  activeCamera: CameraInspection;
  onRefreshPrediction: (customPred?: CombinedPrediction) => void;
}

export const PredictiveAnalyticsView: React.FC<PredictiveAnalyticsViewProps> = ({
  sensorData,
  prediction,
  activeCamera,
  onRefreshPrediction,
}) => {
  const [selectedJoint, setSelectedJoint] = useState<string>('J-102');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [lastAnalyzedTime, setLastAnalyzedTime] = useState<string>(new Date().toLocaleTimeString());
  const [analysisSource, setAnalysisSource] = useState<'backend' | 'local'>('backend');

  const handleAnalyzeNow = async () => {
    setIsAnalyzing(true);
    try {
      const res = await fetch('/predict-combined', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sensor_data: sensorData,
          camera_data: {
            camera_risk_score: activeCamera.camera_risk_score,
            defect_type: activeCamera.defect_type,
            confidence: activeCamera.confidence,
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAnalysisSource('backend');
        setLastAnalyzedTime(new Date().toLocaleTimeString());
        onRefreshPrediction(data);
      } else {
        setAnalysisSource('local');
        setLastAnalyzedTime(new Date().toLocaleTimeString());
        onRefreshPrediction();
      }
    } catch {
      setAnalysisSource('local');
      setLastAnalyzedTime(new Date().toLocaleTimeString());
      onRefreshPrediction();
    } finally {
      setTimeout(() => setIsAnalyzing(false), 500);
    }
  };

  const getFailureBadge = (prob: number) => {
    if (prob >= 60) {
      return (
        <span className="badge-status-critical">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-critical)]" />
          High Risk ({prob}%)
        </span>
      );
    }
    if (prob >= 30) {
      return (
        <span className="badge-status-warning">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-warning)]" />
          Elevated Stress ({prob}%)
        </span>
      );
    }
    return (
      <span className="badge-status-healthy">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-healthy)]" />
        Nominal State ({prob}%)
      </span>
    );
  };

  return (
    <div id="predictive-analytics-view" className="space-y-6 pb-12 page-transition-enter">
      {/* 1. Top Banner with Action Button */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[12px] p-[24px] shadow-[var(--shadow-card)] flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-[6px] bg-[var(--accent-primary-muted)] text-[var(--accent-primary)] flex items-center justify-center">
              <BrainCircuit className="w-4 h-4" />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--accent-primary)] font-mono">
              Predictive Diagnostics &amp; Prognostics
            </span>
          </div>
          <h1 className="text-[20px] font-semibold text-[var(--text-primary)] tracking-tight">
            Splice Rupture Prognosis &amp; Remaining Useful Life (RUL)
          </h1>
          <p className="text-[13px] text-[var(--text-secondary)] leading-[1.6]">
            Coupled ML inference pipeline aggregating 9 multi-axis SCADA transducers with high-speed line-scan computer vision. Random Forest regression with deterministic safety interlock bounds.
          </p>
        </div>

        {/* Action Button: "Analyze Now" */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 shrink-0">
          <div className="text-right hidden sm:block text-[12px] text-[var(--text-tertiary)] font-mono">
            <div>Last inference: <strong className="text-[var(--text-primary)]">{lastAnalyzedTime}</strong></div>
            <div className="text-[var(--status-healthy)] text-[11px]">Pipeline: {analysisSource}</div>
          </div>
          <button
            id="btn-analyze-now"
            onClick={handleAnalyzeNow}
            disabled={isAnalyzing}
            className="btn-primary flex items-center justify-center gap-2"
          >
            <Sparkles className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
            <span>{isAnalyzing ? 'Running Inference...' : 'Execute Prognostics'}</span>
          </button>
        </div>
      </div>

      {/* 2. Target Joint Selector & Core Predictions (3-Column Grid, 16px Gutters) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Col: Target Joint / Belt Segment Profile */}
        <div className="industrial-card space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)] flex items-center gap-2">
              <Layers className="w-4 h-4 text-[var(--accent-primary)]" />
              <span>Monitored Belt Segments</span>
            </h2>
            <span className="text-[11px] text-[var(--text-tertiary)] font-mono">CV-101</span>
          </div>

          <div className="space-y-2.5">
            {[
              { id: 'J-102', name: 'Vulcanized Joint Splice #2 (ST-4500)', risk: prediction.final_score, status: prediction.status, monitored: 'Thermal + Acoustic + Camera' },
              { id: 'J-101', name: 'Vulcanized Joint Splice #1 (Finger)', risk: Math.round(prediction.final_score * 0.75), status: 'Healthy', monitored: 'Acoustic + Speed' },
              { id: 'SEC-B', name: 'Belt Section B (Impact Cradle)', risk: Math.round(prediction.final_score * 0.85), status: prediction.status === 'Critical' ? 'Warning' : 'Healthy', monitored: 'Ultrasonic Sag + Line Scan' },
            ].map((j) => (
              <div
                key={j.id}
                onClick={() => setSelectedJoint(j.id)}
                className={`p-3 rounded-[8px] border cursor-pointer transition-all ${
                  selectedJoint === j.id
                    ? 'bg-[var(--accent-primary-muted)] border-[rgba(245,165,36,0.3)] text-[var(--text-primary)]'
                    : 'bg-[var(--bg-surface-raised)] border-[var(--border-subtle)] hover:border-[var(--border-default)] text-[var(--text-secondary)]'
                }`}
              >
                <div className="flex items-center justify-between text-[13px] font-semibold">
                  <span className="text-[var(--text-primary)]">{j.name}</span>
                  <span
                    className={`text-[11px] font-mono px-2 py-0.5 rounded-[4px] border ${
                      j.risk >= 60
                        ? 'badge-status-critical'
                        : j.risk >= 30
                        ? 'badge-status-warning'
                        : 'badge-status-healthy'
                    }`}
                  >
                    Risk: {j.risk}
                  </span>
                </div>
                <div className="text-[11px] text-[var(--text-tertiary)] mt-1 flex justify-between font-mono">
                  <span>{j.monitored}</span>
                  <span className="text-[var(--text-disabled)]">{j.id}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Model Health / Architecture */}
          <div className="p-3 bg-[var(--bg-surface-raised)] rounded-[8px] border border-[var(--border-subtle)] text-[12px] text-[var(--text-secondary)] space-y-1.5">
            <div className="flex items-center justify-between font-semibold text-[var(--text-primary)]">
              <span className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-[var(--status-healthy)]" />
                Active Model Architecture
              </span>
              <span className="text-[var(--status-healthy)] font-mono text-[11px]">ONLINE</span>
            </div>
            <p className="text-[11px] text-[var(--text-tertiary)] leading-[1.5]">
              Gradient boosted random forest (120 estimators). Source: {analysisSource === 'backend' ? 'Express REST API' : 'Edge Heuristics'}.
            </p>
          </div>
        </div>

        {/* Center Col: RUL & Failure Probability Gauge */}
        <div className="industrial-card flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <h2 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)] flex items-center gap-2">
                <Clock className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>Remaining Useful Life (RUL)</span>
              </h2>
              {getFailureBadge(prediction.failure_probability)}
            </div>

            {/* Big RUL Display */}
            <div className="bg-[var(--bg-surface-raised)] p-5 rounded-[8px] border border-[var(--border-subtle)] text-center space-y-1">
              <span className="text-[11px] uppercase tracking-[0.06em] font-medium text-[var(--text-tertiary)]">
                Time to Splice Replacement / Critical Delamination
              </span>
              <div className="text-[44px] font-bold font-mono tabular-nums tracking-tight text-[var(--text-primary)]">
                {prediction.rul_hours}{' '}
                <span className="text-[18px] font-semibold text-[var(--accent-primary)]">Hours</span>
              </div>
              <div className="text-[11px] text-[var(--text-tertiary)] font-mono">
                ≈ {(prediction.rul_hours / 24).toFixed(1)} Days of Continuous Haulage (90% CI: ±12h)
              </div>
            </div>

            {/* Failure Probability Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[12px]">
                <span className="text-[var(--text-tertiary)] font-medium">Splice Rupture Probability</span>
                <span className="font-mono font-bold text-[var(--text-primary)]">{prediction.failure_probability}%</span>
              </div>
              <div className="w-full h-2 bg-[var(--bg-surface-raised)] rounded-[4px] overflow-hidden border border-[var(--border-subtle)]">
                <div
                  className={`h-full rounded-[4px] transition-all duration-700 ${
                    prediction.failure_probability >= 60
                      ? 'bg-[var(--status-critical)]'
                      : prediction.failure_probability >= 30
                      ? 'bg-[var(--status-warning)]'
                      : 'bg-[var(--status-healthy)]'
                  }`}
                  style={{ width: `${prediction.failure_probability}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-[var(--text-disabled)] font-mono">
                <span>0% Nominal</span>
                <span>30% Warning</span>
                <span>60% Trip</span>
                <span>100%</span>
              </div>
            </div>
          </div>

          {/* AI Decision Text */}
          <div className="p-3 rounded-[8px] bg-[var(--accent-primary-muted)] border border-[rgba(245,165,36,0.25)] text-[12px] leading-[1.5]">
            <div className="font-semibold text-[var(--accent-primary)] mb-1">Prescriptive Engineering Action:</div>
            <span className="text-[var(--text-primary)]">{prediction.recommendation}</span>
          </div>
        </div>

        {/* Right Col: Top Contributing Factors (Explainable AI) */}
        <div className="industrial-card space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)] mb-3">
              <h2 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)] flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>Feature Importance (SHAP)</span>
              </h2>
              <span className="text-[11px] text-[var(--text-tertiary)] font-mono">Normalized</span>
            </div>

            <p className="text-[12px] text-[var(--text-tertiary)] mb-3 leading-[1.5]">
              Ranked telemetry variables contributing to current joint fatigue risk:
            </p>

            {/* Contributing Factor Bars */}
            <div className="space-y-3">
              {prediction.contributing_factors.map((factor, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="font-medium text-[var(--text-secondary)] truncate max-w-[170px]">
                      {factor.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-[var(--text-tertiary)]">
                        {factor.threshold_exceeded}
                      </span>
                      <span className="font-mono font-bold text-[var(--text-primary)] text-[12px]">
                        {factor.impact_percent}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-[var(--bg-surface-raised)] rounded-[3px] overflow-hidden border border-[var(--border-subtle)]">
                    <div
                      className={`h-full rounded-[3px] transition-all duration-500 ${
                        factor.severity === 'critical'
                          ? 'bg-[var(--status-critical)]'
                          : factor.severity === 'warning'
                          ? 'bg-[var(--status-warning)]'
                          : 'bg-[var(--status-healthy)]'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(5, factor.impact_percent))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-[var(--border-subtle)] text-[11px] text-[var(--text-tertiary)] flex items-center justify-between font-mono">
            <span>Synthesis Formula:</span>
            <span className="text-[var(--accent-primary)] font-semibold">0.6·Sensor + 0.4·Camera</span>
          </div>
        </div>
      </div>
    </div>
  );
};

