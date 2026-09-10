import React, { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  History,
  Download,
  Calendar,
  Search,
} from 'lucide-react';
import { generateHistoricalData } from '../utils/conveyorLogic';

export const HistoricalReportsView: React.FC = () => {
  const [timeRange, setTimeRange] = useState<'24h' | '7d'>('24h');
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([
    'temperature',
    'vibration',
    'overload',
    'health_score',
  ]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const rowsPerPage = 10;

  // Generate dataset based on toggle
  const data = useMemo(() => {
    return generateHistoricalData(timeRange === '24h' ? 1 : 7);
  }, [timeRange]);

  const toggleMetric = (key: string) => {
    setSelectedMetrics((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleExportCSV = () => {
    const headers = 'Timestamp,Drive Temp (°C),Vibration (mm/s),Overload (%),Bearing Score,Belt Speed (m/s),Health Score\n';
    const rows = data
      .map(
        (d) =>
          `"${d.time}",${d.temperature},${d.vibration},${d.overload},${d.bearing_condition},${d.belt_speed},${d.health_score}`
      )
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `conveyor-history-${timeRange}-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredData = data.filter((row) =>
    row.time.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const paginatedData = filteredData.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );
  const totalPages = Math.ceil(filteredData.length / rowsPerPage) || 1;

  return (
    <div id="historical-reports-view" className="space-y-6 pb-12 page-transition-enter">
      {/* 1. Header Banner */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[12px] p-[24px] shadow-[var(--shadow-card)] flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-[6px] bg-[var(--accent-primary-muted)] text-[var(--accent-primary)] flex items-center justify-center">
              <History className="w-4 h-4" />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--accent-primary)] font-mono">
              Historical Telemetry &amp; Audit Trail
            </span>
          </div>
          <h1 className="text-[20px] font-semibold text-[var(--text-primary)] tracking-tight">
            Sensor Degradation Curves &amp; Shift Trend Analytics
          </h1>
          <p className="text-[13px] text-[var(--text-secondary)] max-w-2xl leading-[1.6]">
            Multi-channel telemetry analysis over time. Identify progressive fatigue signatures, thermal runaway, and mechanical drift across operating shifts.
          </p>
        </div>

        {/* Time Range Toggle & CSV Download */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)] rounded-[6px] p-1 flex items-center gap-1">
            <button
              onClick={() => {
                setTimeRange('24h');
                setCurrentPage(1);
              }}
              className={`px-3 py-1 rounded-[4px] text-[12px] font-medium transition-colors ${
                timeRange === '24h' ? 'bg-[var(--accent-primary)] text-[#0A0E14] font-semibold' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Last 24 Hours
            </button>
            <button
              onClick={() => {
                setTimeRange('7d');
                setCurrentPage(1);
              }}
              className={`px-3 py-1 rounded-[4px] text-[12px] font-medium transition-colors ${
                timeRange === '7d' ? 'bg-[var(--accent-primary)] text-[#0A0E14] font-semibold' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Last 7 Days
            </button>
          </div>

          <button
            id="btn-export-history-csv"
            onClick={handleExportCSV}
            className="btn-secondary h-[34px] flex items-center gap-2"
          >
            <Download className="w-4 h-4 text-[var(--accent-primary)]" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 2. Multi-Line Chart (Recharts) */}
      <div className="industrial-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[var(--border-subtle)]">
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)] flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[var(--accent-primary)]" />
            <span>Temporal Trend Analysis ({timeRange === '24h' ? 'Hourly Intervals' : 'Daily Shift Intervals'})</span>
          </h2>

          {/* Metric Selector Pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            {[
              { key: 'temperature', label: 'Drive Temp (°C)', color: '#f97316' },
              { key: 'vibration', label: 'Vibration (mm/s)', color: '#eab308' },
              { key: 'overload', label: 'Overload (%)', color: '#ef4444' },
              { key: 'bearing_condition', label: 'Bearing Score', color: '#06b6d4' },
              { key: 'health_score', label: 'Health Score', color: '#10b981' },
            ].map((m) => {
              const active = selectedMetrics.includes(m.key);
              return (
                <button
                  key={m.key}
                  onClick={() => toggleMetric(m.key)}
                  className={`px-2.5 py-1 rounded-[4px] text-[11px] font-medium border transition-all flex items-center gap-1.5 ${
                    active
                      ? 'bg-[var(--bg-surface-raised)] text-[var(--text-primary)] border-[var(--border-strong)]'
                      : 'bg-transparent text-[var(--text-disabled)] border-transparent opacity-50 line-through'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Chart Canvas */}
        <div className="h-80 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="time" stroke="var(--text-tertiary)" fontSize={11} fontFamily="JetBrains Mono, monospace" />
              <YAxis stroke="var(--text-tertiary)" fontSize={11} domain={['auto', 'auto']} fontFamily="JetBrains Mono, monospace" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--bg-surface-raised)',
                  borderColor: 'var(--border-subtle)',
                  borderRadius: '8px',
                  fontSize: '11px',
                  color: 'var(--text-primary)',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />

              {selectedMetrics.includes('temperature') && (
                <Line
                  type="monotone"
                  dataKey="temperature"
                  name="Drive Temp (°C)"
                  stroke="#f97316"
                  strokeWidth={2}
                  dot={false}
                />
              )}
              {selectedMetrics.includes('vibration') && (
                <Line
                  type="monotone"
                  dataKey="vibration"
                  name="Vibration (mm/s)"
                  stroke="#eab308"
                  strokeWidth={2}
                  dot={false}
                />
              )}
              {selectedMetrics.includes('overload') && (
                <Line
                  type="monotone"
                  dataKey="overload"
                  name="Overload (%)"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={false}
                />
              )}
              {selectedMetrics.includes('bearing_condition') && (
                <Line
                  type="monotone"
                  dataKey="bearing_condition"
                  name="Bearing Condition"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  dot={false}
                />
              )}
              {selectedMetrics.includes('health_score') && (
                <Line
                  type="monotone"
                  dataKey="health_score"
                  name="Health Score (0-100)"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. Historical Data Table */}
      <div className="industrial-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[var(--border-subtle)]">
          <div>
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
              Sensor Reading Log ({filteredData.length} entries)
            </h2>
            <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">Timestamped telemetry records buffered from PLC acquisition cycles</p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-[var(--text-tertiary)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search timestamp..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-[12px] bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)] rounded-[6px] pl-8 pr-3 py-1.5 text-[var(--text-primary)] placeholder-[var(--text-disabled)] focus:outline-none focus:border-[var(--accent-primary)]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-[var(--text-tertiary)] text-[11px] uppercase tracking-[0.06em] font-semibold">
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Drive Temp (°C)</th>
                <th className="py-2.5 px-3">Vibration (mm/s)</th>
                <th className="py-2.5 px-3">Overload (%)</th>
                <th className="py-2.5 px-3">Bearing Score</th>
                <th className="py-2.5 px-3">Belt Speed (m/s)</th>
                <th className="py-2.5 px-3">Health Score</th>
                <th className="py-2.5 px-3 text-right">Integrity Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] font-mono text-[var(--text-secondary)] tabular-nums">
              {paginatedData.map((row, idx) => {
                const isCrit = row.health_score < 40;
                const isWarn = row.health_score < 70;
                return (
                  <tr key={idx} className="hover:bg-[var(--bg-surface-raised)] transition-colors">
                    <td className="py-2.5 px-3 font-sans font-medium text-[var(--text-primary)]">{row.time}</td>
                    <td className="py-2.5 px-3">
                      <span className={row.temperature > 60 ? 'text-[var(--status-warning)] font-semibold' : ''}>
                        {row.temperature}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={row.vibration > 2 ? 'text-[var(--status-warning)] font-semibold' : ''}>
                        {row.vibration}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={row.overload > 90 ? 'text-[var(--status-warning)] font-semibold' : ''}>
                        {row.overload}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={row.bearing_condition < 60 ? 'text-[var(--status-warning)] font-semibold' : ''}>
                        {row.bearing_condition}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">{row.belt_speed}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`font-semibold ${
                          isCrit ? 'text-[var(--status-critical)]' : isWarn ? 'text-[var(--status-warning)]' : 'text-[var(--status-healthy)]'
                        }`}
                      >
                        {row.health_score} / 100
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-sans">
                      <span
                        className={
                          isCrit
                            ? 'badge-status-critical'
                            : isWarn
                            ? 'badge-status-warning'
                            : 'badge-status-healthy'
                        }
                      >
                        {isCrit ? 'Critical' : isWarn ? 'Warning' : 'Optimal'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center justify-between pt-3 border-t border-[var(--border-subtle)] text-[12px] text-[var(--text-tertiary)]">
          <div>
            Showing {(currentPage - 1) * rowsPerPage + 1} to{' '}
            {Math.min(currentPage * rowsPerPage, filteredData.length)} of {filteredData.length} records
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="btn-secondary h-[28px] text-[11px] disabled:opacity-30"
            >
              Previous
            </button>
            <span className="font-mono px-2 text-[var(--text-primary)] text-[11px]">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="btn-secondary h-[28px] text-[11px] disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

