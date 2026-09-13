import React, { useState, useMemo } from 'react';
import {
  BrainCircuit,
  Clock,
  Sparkles,
  BarChart3,
  Layers,
  Shield,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  Sliders,
  Wrench,
  Gauge,
  Activity,
  ChevronRight,
  Info,
  Calendar,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import { SensorData, CombinedPrediction, CameraInspection } from '../types';
import { evaluateSegmentPredictions, MonitoredSegmentData } from '../utils/conveyorLogic';

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
  const [selectedJointId, setSelectedJointId] = useState<string>('J-102');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [lastAnalyzedTime, setLastAnalyzedTime] = useState<string>(new Date().toLocaleTimeString());
  const [analysisSource, setAnalysisSource] = useState<'backend' | 'local'>('backend');

  // Interactive What-If simulation levers
  const [simSpeedDerate, setSimSpeedDerate] = useState<boolean>(false);
  const [simLoadShed, setSimLoadShed] = useState<boolean>(false);
  const [simCoolingActive, setSimCoolingActive] = useState<boolean>(false);

  // Compute multi-segment predictions (J-102, J-101, SEC-B)
  const segmentPredictions = useMemo(() => {
    return evaluateSegmentPredictions(sensorData, activeCamera);
  }, [sensorData, activeCamera]);

  const rawActiveSegment: MonitoredSegmentData = useMemo(() => {
    return segmentPredictions[selectedJointId] || segmentPredictions['J-102'];
  }, [segmentPredictions, selectedJointId]);

  // Apply What-If simulation offsets to active segment if toggled
  const activeSegment = useMemo(() => {
    let simRisk = rawActiveSegment.riskScore;
    let simRul = rawActiveSegment.rulHours;

    if (simSpeedDerate) {
      simRisk = Math.max(5, simRisk - 18);
      simRul += 48;
    }
    if (simLoadShed) {
      simRisk = Math.max(5, simRisk - 22);
      simRul += 72;
    }
    if (simCoolingActive) {
      simRisk = Math.max(5, simRisk - 12);
      simRul += 36;
    }

    const failureProb = Math.min(99, Math.max(3, Math.round(simRisk * 0.95)));
    const status: 'Healthy' | 'Warning' | 'Critical' =
      simRisk >= 60 ? 'Critical' : simRisk >= 30 ? 'Warning' : 'Healthy';

    return {
      ...rawActiveSegment,
      riskScore: Math.round(simRisk * 10) / 10,
      rulHours: simRul,
      failureProbability: failureProb,
      status,
    };
  }, [rawActiveSegment, simSpeedDerate, simLoadShed, simCoolingActive]);

  // Generate 72-hour degradation trajectory forecast data
  const degradationChartData = useMemo(() => {
    const currentHealth = Math.max(5, 100 - activeSegment.riskScore);
    const hourlyDecay =
      activeSegment.status === 'Critical' ? 1.4 : activeSegment.status === 'Warning' ? 0.45 : 0.08;

    const data: Array<{
      timeLabel: string;
      historicHealth?: number;
      projectedHealth?: number;
      upperBound?: number;
      lowerBound?: number;
      tripThreshold: number;
    }> = [];

    // Past 24 hours (t = -24h to t = 0)
    for (let h = -24; h <= 0; h += 4) {
      const noise = (Math.sin(h * 0.5) * 1.5 + Math.cos(h * 0.8) * 1.2);
      const pastVal = Math.min(100, Math.max(20, currentHealth + Math.abs(h) * (hourlyDecay * 0.7) + noise));
      data.push({
        timeLabel: h === 0 ? 'Now' : `${h}h`,
        historicHealth: Math.round(pastVal * 10) / 10,
        projectedHealth: h === 0 ? Math.round(currentHealth * 10) / 10 : undefined,
        upperBound: h === 0 ? Math.round(currentHealth * 10) / 10 : undefined,
        lowerBound: h === 0 ? Math.round(currentHealth * 10) / 10 : undefined,
        tripThreshold: 40,
      });
    }

    // Future 72 hours (t = +4h to t = +72h)
    for (let h = 4; h <= 72; h += 4) {
      const projVal = Math.max(10, currentHealth - h * hourlyDecay);
      const uncertainty = h * 0.35;
      data.push({
        timeLabel: `+${h}h`,
        projectedHealth: Math.round(projVal * 10) / 10,
        upperBound: Math.min(100, Math.round((projVal + uncertainty) * 10) / 10),
        lowerBound: Math.max(5, Math.round((projVal - uncertainty) * 10) / 10),
        tripThreshold: 40,
      });
    }

    return data;
  }, [activeSegment]);

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
      setTimeout(() => setIsAnalyzing(false), 450);
    }
  };

  const getFailureBadge = (prob: number, status: string) => {
    if (status === 'Critical' || prob >= 60) {
      return (
        <span className="badge-status-critical flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-critical)] animate-pulse" />
          Critical Risk ({prob}%)
        </span>
      );
    }
    if (status === 'Warning' || prob >= 30) {
      return (
        <span className="badge-status-warning flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-warning)]" />
          Elevated Stress ({prob}%)
        </span>
      );
    }
    return (
      <span className="badge-status-healthy flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-healthy)]" />
        Nominal State ({prob}%)
      </span>
    );
  };

  return (
    <div id="predictive-analytics-view" className="space-y-6 pb-12 page-transition-enter">
      {/* 1. Top Banner with Action Button & Live Pipeline Status */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[12px] p-[24px] shadow-[var(--shadow-card)] flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-[6px] bg-[var(--accent-primary-muted)] text-[var(--accent-primary)] flex items-center justify-center">
              <BrainCircuit className="w-4 h-4" />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--accent-primary)] font-mono">
              Predictive Diagnostics &amp; Prognostics Engine
            </span>
          </div>
          <h1 className="text-[20px] font-semibold text-[var(--text-primary)] tracking-tight">
            Splice Rupture Prognosis &amp; Remaining Useful Life (RUL)
          </h1>
          <p className="text-[13px] text-[var(--text-secondary)] leading-[1.6]">
            Coupled ML inference pipeline synthesizing 9 multi-axis SCADA sensors (60% weight) with high-speed line-scan computer vision (40% weight). Evaluates joint delamination, carcass fatigue, and structural life expectancy across all monitored segments.
          </p>
        </div>

        {/* Action Button: "Execute Prognostics" */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 shrink-0">
          <div className="text-right hidden sm:block text-[12px] text-[var(--text-tertiary)] font-mono">
            <div>
              Last inference: <strong className="text-[var(--text-primary)]">{lastAnalyzedTime}</strong>
            </div>
            <div className="text-[var(--status-healthy)] text-[11px] flex items-center justify-end gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-healthy)]" />
              Pipeline: {analysisSource}
            </div>
          </div>
          <button
            id="btn-analyze-now"
            onClick={handleAnalyzeNow}
            disabled={isAnalyzing}
            className="btn-primary flex items-center justify-center gap-2 px-4 py-2.5"
          >
            <Sparkles className={`w-4 h-4 ${isAnalyzing ? 'animate-spin text-amber-300' : ''}`} />
            <span>{isAnalyzing ? 'Running Inference...' : 'Execute Prognostics'}</span>
          </button>
        </div>
      </div>

      {/* 2. Target Joint Selector & Core Predictions (3-Column Grid, 16px Gutters) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Col: Monitored Belt Segments Selector & Technical Profile */}
        <div className="industrial-card space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <h2 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)] flex items-center gap-2">
                <Layers className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>Monitored Belt Segments</span>
              </h2>
              <span className="text-[11px] text-[var(--text-tertiary)] font-mono">CV-101 (3 STATIONS)</span>
            </div>

            {/* Segment selection cards */}
            <div className="space-y-2.5">
              {Object.values(segmentPredictions).map((seg) => {
                const isSelected = selectedJointId === seg.id;
                return (
                  <div
                    key={seg.id}
                    id={`segment-card-${seg.id}`}
                    onClick={() => setSelectedJointId(seg.id)}
                    className={`p-3 rounded-[8px] border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-[var(--accent-primary-muted)] border-[rgba(245,165,36,0.5)] shadow-sm'
                        : 'bg-[var(--bg-surface-raised)] border-[var(--border-subtle)] hover:border-[var(--border-default)]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[13px] font-semibold">
                      <span className={`${isSelected ? 'text-[var(--text-primary)] font-bold' : 'text-[var(--text-secondary)]'}`}>
                        {seg.name}
                      </span>
                      <span
                        className={`text-[11px] font-mono px-2 py-0.5 rounded-[4px] border ${
                          seg.riskScore >= 60
                            ? 'badge-status-critical'
                            : seg.riskScore >= 30
                            ? 'badge-status-warning'
                            : 'badge-status-healthy'
                        }`}
                      >
                        Risk: {seg.riskScore}
                      </span>
                    </div>
                    <div className="text-[11px] text-[var(--text-tertiary)] mt-1.5 flex justify-between font-mono">
                      <span className="truncate max-w-[210px]">{seg.monitoredSensors}</span>
                      <span className="text-[var(--accent-primary)] font-bold">{seg.id}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Segment Technical Specification */}
          <div className="p-3.5 bg-[var(--bg-surface-raised)] rounded-[8px] border border-[var(--border-subtle)] text-[12px] space-y-2">
            <div className="flex items-center justify-between font-semibold text-[var(--text-primary)] border-b border-[var(--border-subtle)] pb-2">
              <span className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>{activeSegment.shortName} Specs</span>
              </span>
              <span className="font-mono text-[11px] text-[var(--text-tertiary)]">{activeSegment.id}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div>
                <span className="text-[var(--text-tertiary)] block">Splice Type:</span>
                <span className="text-[var(--text-primary)] font-medium truncate block">{activeSegment.spliceType}</span>
              </div>
              <div>
                <span className="text-[var(--text-tertiary)] block">Longitudinal Position:</span>
                <span className="text-[var(--text-primary)] font-medium truncate block">{activeSegment.location}</span>
              </div>
              <div>
                <span className="text-[var(--text-tertiary)] block">Operational Age:</span>
                <span className="text-[var(--text-primary)] font-medium">{activeSegment.cumulativeHours} Hours</span>
              </div>
              <div>
                <span className="text-[var(--text-tertiary)] block">Wear Rate (dh/dt):</span>
                <span className="text-[var(--accent-primary)] font-bold">{activeSegment.degradationRate}</span>
              </div>
            </div>
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
              {getFailureBadge(activeSegment.failureProbability, activeSegment.status)}
            </div>

            {/* Big RUL Display */}
            <div className="bg-[var(--bg-surface-raised)] p-5 rounded-[8px] border border-[var(--border-subtle)] text-center space-y-1">
              <span className="text-[11px] uppercase tracking-[0.06em] font-medium text-[var(--text-tertiary)]">
                Time to Splice Replacement / Delamination Limit
              </span>
              <div className="text-[44px] font-bold font-mono tabular-nums tracking-tight text-[var(--text-primary)]">
                {activeSegment.rulHours}{' '}
                <span className="text-[18px] font-semibold text-[var(--accent-primary)]">Hours</span>
              </div>
              <div className="text-[11px] text-[var(--text-tertiary)] font-mono">
                ≈ {(activeSegment.rulHours / 24).toFixed(1)} Days of Continuous Haulage (90% CI: ±12h)
              </div>
            </div>

            {/* Failure Probability Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[12px]">
                <span className="text-[var(--text-tertiary)] font-medium">Splice Rupture Probability</span>
                <span className="font-mono font-bold text-[var(--text-primary)]">
                  {activeSegment.failureProbability}%
                </span>
              </div>
              <div className="w-full h-2 bg-[var(--bg-surface-raised)] rounded-[4px] overflow-hidden border border-[var(--border-subtle)]">
                <div
                  className={`h-full rounded-[4px] transition-all duration-700 ${
                    activeSegment.failureProbability >= 60
                      ? 'bg-[var(--status-critical)]'
                      : activeSegment.failureProbability >= 30
                      ? 'bg-[var(--status-warning)]'
                      : 'bg-[var(--status-healthy)]'
                  }`}
                  style={{ width: `${activeSegment.failureProbability}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-[var(--text-disabled)] font-mono">
                <span>0% Nominal</span>
                <span>30% Warning</span>
                <span>60% Trip</span>
                <span>100% Failure</span>
              </div>
            </div>

            {/* Primary Predicted Failure Mechanism */}
            <div className="p-2.5 rounded-[6px] bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)] text-[11px] flex items-center justify-between font-mono">
              <span className="text-[var(--text-tertiary)]">Dominant Risk Mechanism:</span>
              <span className="text-[var(--text-primary)] font-semibold truncate max-w-[200px] text-right">
                {activeSegment.failureMode}
              </span>
            </div>
          </div>

          {/* Prescriptive Engineering Recommendation */}
          <div className="p-3.5 rounded-[8px] bg-[var(--accent-primary-muted)] border border-[rgba(245,165,36,0.3)] text-[12px] leading-[1.5]">
            <div className="font-semibold text-[var(--accent-primary)] mb-1 flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5" />
              <span>Prescriptive Engineering Action:</span>
            </div>
            <span className="text-[var(--text-primary)]">{activeSegment.recommendation}</span>
          </div>
        </div>

        {/* Right Col: Fixed & Normalized SHAP Feature Importance */}
        <div className="industrial-card space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)] mb-3">
              <h2 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)] flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>Feature Importance (SHAP)</span>
              </h2>
              <span className="text-[11px] text-[var(--text-tertiary)] font-mono">Normalized (100%)</span>
            </div>

            <p className="text-[12px] text-[var(--text-tertiary)] mb-3 leading-[1.5]">
              Ranked telemetry variables contributing to {activeSegment.shortName} fatigue risk:
            </p>

            {/* Normalized Contributing Factor Bars */}
            <div className="space-y-3">
              {activeSegment.contributingFactors.map((factor, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="font-medium text-[var(--text-secondary)] truncate max-w-[175px]">
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
                      style={{ width: `${Math.min(100, Math.max(4, factor.impact_percent))}%` }}
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

      {/* 3. 72-Hour Splice Degradation Trajectory & Forecast Chart */}
      <div className="industrial-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[var(--border-subtle)] gap-2">
          <div>
            <h2 className="text-[14px] font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Activity className="w-4 h-4 text-[var(--accent-primary)]" />
              <span>Splice Health Degradation Trajectory &amp; 72-Hour Prognostic Forecast</span>
            </h2>
            <p className="text-[12px] text-[var(--text-tertiary)]">
              Historical health index trend (solid) vs. projected failure trajectory with 90% confidence envelope (dashed) for {activeSegment.name}.
            </p>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-mono text-[var(--text-tertiary)]">
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-[var(--accent-primary)]" />
              Historical
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 border-t-2 border-dashed border-[#60a5fa]" />
              Projected
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-[var(--status-critical)]" />
              Trip Limit (40)
            </span>
          </div>
        </div>

        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={degradationChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="confidenceEnvelope" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="timeLabel"
                stroke="var(--text-tertiary)"
                tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                stroke="var(--text-tertiary)"
                tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
                tickLine={false}
                unit=" pts"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--bg-surface-raised)',
                  borderColor: 'var(--border-subtle)',
                  borderRadius: '6px',
                  fontSize: '12px',
                  color: 'var(--text-primary)',
                }}
              />
              <ReferenceLine
                y={40}
                stroke="var(--status-critical)"
                strokeDasharray="4 4"
                label={{ value: 'Safety Replacement Threshold (40)', fill: 'var(--status-critical)', fontSize: 10, position: 'insideBottomRight' }}
              />
              {/* Confidence interval area */}
              <Area
                type="monotone"
                dataKey="upperBound"
                stroke="transparent"
                fill="url(#confidenceEnvelope)"
                isAnimationActive={false}
              />
              {/* Historic Line */}
              <Line
                type="monotone"
                dataKey="historicHealth"
                name="Historical Integrity"
                stroke="var(--accent-primary)"
                strokeWidth={2.5}
                dot={{ r: 2, fill: 'var(--accent-primary)' }}
                connectNulls
              />
              {/* Projected Line */}
              <Line
                type="monotone"
                dataKey="projectedHealth"
                name="Forecast Integrity"
                stroke="#60a5fa"
                strokeWidth={2.5}
                strokeDasharray="5 5"
                dot={{ r: 2, fill: '#60a5fa' }}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. What-If Operational Sensitivity Levers & Physics Diagnostics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: What-If Operational Control Levers */}
        <div className="industrial-card space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)] flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[var(--accent-primary)]" />
              <span>What-If Operational Sensitivity Levers</span>
            </h2>
            <span className="text-[11px] text-[var(--accent-primary)] font-mono">Simulate Mitigation</span>
          </div>

          <p className="text-[12px] text-[var(--text-tertiary)] leading-[1.5]">
            Test real-time control actions to project remaining life extension and risk reduction on {activeSegment.shortName}:
          </p>

          <div className="space-y-3">
            {/* Lever 1: Speed De-rate */}
            <div
              onClick={() => setSimSpeedDerate(!simSpeedDerate)}
              className={`p-3 rounded-[8px] border cursor-pointer transition-all flex items-center justify-between ${
                simSpeedDerate
                  ? 'bg-[var(--accent-primary-muted)] border-[var(--accent-primary)]'
                  : 'bg-[var(--bg-surface-raised)] border-[var(--border-subtle)] hover:border-[var(--border-default)]'
              }`}
            >
              <div className="space-y-0.5">
                <div className="text-[13px] font-semibold text-[var(--text-primary)] flex items-center gap-2">
                  <span>De-rate Haulage Speed (-15% to 3.6 m/s)</span>
                  {simSpeedDerate && <span className="badge-status-healthy text-[10px] py-0">ACTIVE</span>}
                </div>
                <div className="text-[11px] text-[var(--text-tertiary)]">
                  Reduces dynamic cyclic tension over pulleys. Projected extension: <strong>+48 RUL Hours</strong>
                </div>
              </div>
              <input
                type="checkbox"
                checked={simSpeedDerate}
                onChange={() => {}}
                className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
              />
            </div>

            {/* Lever 2: Tonnage Load Shedding */}
            <div
              onClick={() => setSimLoadShed(!simLoadShed)}
              className={`p-3 rounded-[8px] border cursor-pointer transition-all flex items-center justify-between ${
                simLoadShed
                  ? 'bg-[var(--accent-primary-muted)] border-[var(--accent-primary)]'
                  : 'bg-[var(--bg-surface-raised)] border-[var(--border-subtle)] hover:border-[var(--border-default)]'
              }`}
            >
              <div className="space-y-0.5">
                <div className="text-[13px] font-semibold text-[var(--text-primary)] flex items-center gap-2">
                  <span>Feeder Load Shedding (-20% Tonnage)</span>
                  {simLoadShed && <span className="badge-status-healthy text-[10px] py-0">ACTIVE</span>}
                </div>
                <div className="text-[11px] text-[var(--text-tertiary)]">
                  Alleviates impact cradle pressure and belt sag. Projected extension: <strong>+72 RUL Hours</strong>
                </div>
              </div>
              <input
                type="checkbox"
                checked={simLoadShed}
                onChange={() => {}}
                className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
              />
            </div>

            {/* Lever 3: Thermal Mist Cooling */}
            <div
              onClick={() => setSimCoolingActive(!simCoolingActive)}
              className={`p-3 rounded-[8px] border cursor-pointer transition-all flex items-center justify-between ${
                simCoolingActive
                  ? 'bg-[var(--accent-primary-muted)] border-[var(--accent-primary)]'
                  : 'bg-[var(--bg-surface-raised)] border-[var(--border-subtle)] hover:border-[var(--border-default)]'
              }`}
            >
              <div className="space-y-0.5">
                <div className="text-[13px] font-semibold text-[var(--text-primary)] flex items-center gap-2">
                  <span>Drive Pulley Water-Mist Cooling</span>
                  {simCoolingActive && <span className="badge-status-healthy text-[10px] py-0">ACTIVE</span>}
                </div>
                <div className="text-[11px] text-[var(--text-tertiary)]">
                  Mitigates vulcanization thermal softening (-18°C). Projected extension: <strong>+36 RUL Hours</strong>
                </div>
              </div>
              <input
                type="checkbox"
                checked={simCoolingActive}
                onChange={() => {}}
                className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Right: Prognostics & Root Cause Physics Diagnostics */}
        <div className="industrial-card space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)] flex items-center gap-2">
              <Wrench className="w-4 h-4 text-[var(--accent-primary)]" />
              <span>Prognostics &amp; Root Cause Diagnostics</span>
            </h2>
            <span className="text-[11px] text-[var(--text-tertiary)] font-mono">CV-101 ASSET</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-[12px]">
            <div className="p-3 bg-[var(--bg-surface-raised)] rounded-[8px] border border-[var(--border-subtle)] space-y-1">
              <span className="text-[11px] text-[var(--text-tertiary)] uppercase font-mono">Primary Failure Risk</span>
              <div className="font-semibold text-[var(--text-primary)] truncate">{activeSegment.failureMode}</div>
            </div>

            <div className="p-3 bg-[var(--bg-surface-raised)] rounded-[8px] border border-[var(--border-subtle)] space-y-1">
              <span className="text-[11px] text-[var(--text-tertiary)] uppercase font-mono">Degradation Rate</span>
              <div className="font-semibold font-mono text-[var(--accent-primary)]">{activeSegment.degradationRate}</div>
            </div>

            <div className="p-3 bg-[var(--bg-surface-raised)] rounded-[8px] border border-[var(--border-subtle)] space-y-1">
              <span className="text-[11px] text-[var(--text-tertiary)] uppercase font-mono">Next Maintenance Target</span>
              <div className="font-semibold text-[var(--text-primary)]">
                Shift Break #{activeSegment.status === 'Critical' ? '1 (Urgent)' : '3 (Routine)'}
              </div>
            </div>

            <div className="p-3 bg-[var(--bg-surface-raised)] rounded-[8px] border border-[var(--border-subtle)] space-y-1">
              <span className="text-[11px] text-[var(--text-tertiary)] uppercase font-mono">Estimated Interlock</span>
              <div className="font-semibold text-[var(--text-primary)] font-mono">
                {activeSegment.rulHours < 30 ? 'E-STOP Interlock Armed' : 'Advisory Warning Only'}
              </div>
            </div>
          </div>

          <div className="p-3 bg-[var(--bg-surface-raised)] rounded-[8px] border border-[var(--border-subtle)] text-[11px] text-[var(--text-secondary)] space-y-1">
            <div className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>Recommended Tooling &amp; Spare Parts Kit:</span>
            </div>
            <p className="text-[var(--text-tertiary)] leading-[1.5]">
              {selectedJointId === 'J-102'
                ? 'Vulcanizing Press Pack ST-4500 (480V, 30kW), Core Rubber Compound Kit C-8, Wire Rope Tension Grips.'
                : selectedJointId === 'J-101'
                ? 'Cold-Cure Finger Splicing Cement, Scarfing Skive Tool, Step-Joint Clamping Bars.'
                : 'Heavy-Duty Polyurethane Impact Idler Rollers (89mm dia), Skirtboard Rubber Sealing Strips (15mm).'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
