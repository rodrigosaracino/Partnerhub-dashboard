import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '../components/Card';
import { Badge } from '../components/Badge';
import { KpiCard } from '../components/KpiCard';
import { API, fmt, TOOLTIP_STYLE } from '../utils/format';
import { DateRangeFilter, filterByRange, type DateRange } from '../components/DateRangeFilter';
import { Video, Users, Eye, TrendingUp, BarChart3, Upload, Play, ThumbsUp } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts';

function initRange(): DateRange {
  const d = new Date();
  const to = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const from = `${d.getFullYear()}-01`;
  return { from, to };
}

export function DashboardYoutube() {
  const [range, setRange] = useState<DateRange>(initRange());

  const { data: stats } = useSWR(`${API}/channel-stats`);
  const { data: topVideosData } = useSWR(`${API}/youtube-top-videos`);
  const { data: monthlyStatsData } = useSWR(`${API}/youtube-monthly-stats`);
  const { data: uploadFreqData } = useSWR(`${API}/youtube-upload-frequency`);

  const topVideos = topVideosData || [];
  const monthlyStats = monthlyStatsData || [];
  const uploadFreq = uploadFreqData ? [...(uploadFreqData as any[])].reverse() : [];

  // Apply date filter to monthly/upload data
  const filteredMonthly  = filterByRange(monthlyStats, range);
  // uploadFreq has key 'month' not 'name', so rename before filtering
  const uploadFreqNamed  = uploadFreq.map(r => ({ ...r, name: r.month }));
  const filteredUpload   = filterByRange(uploadFreqNamed, range);

  const subscribers      = parseInt(stats?.subscriberCount || '0');
  const views            = parseInt(stats?.viewCount || '0');
  const videos           = parseInt(stats?.videoCount || '1');
  const avgViewsPerVideo = videos > 0 ? Math.round(views / videos) : 0;

  const totalUploads  = filteredUpload.reduce((s, r) => s + (r.count || 0), 0);
  const avgPerMonth   = filteredUpload.length > 0 ? (totalUploads / filteredUpload.length).toFixed(1) : '0';
  const topViewCount  = topVideos[0]?.views || 0;

  return (
    <div className="flex flex-col gap-6 pb-10">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(239,68,68,0.35)' }}>
            <Video size={24} color="#fff" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">YouTube — Rodrigo Saracino</h1>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Dashboard do Canal · Dados em tempo real</p>
          </div>
        </div>
        <Badge variant="neutral">{fmt(videos)} vídeos publicados</Badge>
      </div>

      {/* Date filter */}
      <div style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '0.75rem' }}>
        <DateRangeFilter value={range} onChange={setRange} accentColor="#EF4444" />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard title="Inscritos"              value={fmt(subscribers)}      sub="Total atual"            icon={<Users size={17} />}    accentClass="text-red-400"     />
        <KpiCard title="Visualizações Totais"   value={fmt(views)}            sub="Acumulado do canal"     icon={<Eye size={17} />}      accentClass="text-blue-400"    />
        <KpiCard title="Vídeos Publicados"      value={fmt(videos)}           sub="No canal"               icon={<Video size={17} />}    accentClass="text-emerald-400" />
        <KpiCard title="Média de Views/Vídeo"   value={fmt(avgViewsPerVideo)} sub="Desempenho médio"       icon={<BarChart3 size={17} />} accentClass="text-amber-400"  />
        <KpiCard title="Uploads por Mês"        value={avgPerMonth}           sub="No período selecionado" icon={<Upload size={17} />}   accentClass="text-indigo-400"  />
        <KpiCard title="Vídeo Mais Visto"       value={fmt(topViewCount)}     sub={topVideos[0]?.title?.slice(0, 28) + '…' || '—'} icon={<TrendingUp size={17} />} accentClass="text-pink-400" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="glass-panel">
          <CardHeader><CardTitle>Crescimento de Inscritos por Mês</CardTitle></CardHeader>
          <CardContent style={{ height: '260px' }}>
            {filteredMonthly.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={filteredMonthly} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ytSub" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#EF4444" stopOpacity={0.7} />
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                  <XAxis dataKey="name" stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} />
                  <YAxis stroke="var(--text-tertiary)" tick={{ fontSize: 10 }} domain={['dataMin - 20', 'dataMax + 20']} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Area type="monotone" dataKey="inscritos" stroke="#EF4444" fill="url(#ytSub)" strokeWidth={2} name="Inscritos" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem', textAlign: 'center' }}>
                Nenhum dado para o período selecionado.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader><CardTitle>Frequência de Upload por Mês</CardTitle></CardHeader>
          <CardContent style={{ height: '260px' }}>
            {filteredUpload.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={filteredUpload} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                  <XAxis dataKey="name" stroke="var(--text-tertiary)" tick={{ fontSize: 10 }} />
                  <YAxis stroke="var(--text-tertiary)" allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="count" fill="#EF4444" name="Vídeos" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                Nenhum dado para o período selecionado.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top 10 Videos */}
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Play size={16} style={{ color: '#EF4444' }} /> Top 10 Vídeos por Visualizações
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topVideos.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', textAlign: 'center', padding: '1.5rem 0' }}>
              Sincronize os vídeos primeiro.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {topVideos.map((v: any, i: number) => {
                const pct = topViewCount > 0 ? Math.round((v.views / topViewCount) * 100) : 0;
                return (
                  <div key={v.youtube_id} style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', padding: '0.75rem', borderRadius: '0.625rem', background: 'rgba(255,255,255,0.03)', transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'}
                  >
                    <span style={{ fontSize: '0.875rem', fontWeight: 700, width: '1.5rem', textAlign: 'center', color: i === 0 ? '#fbbf24' : i === 1 ? '#cbd5e1' : i === 2 ? '#fb923c' : 'var(--text-secondary)' }}>
                      {i + 1}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '0.85rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '0.375rem' }}>
                        {v.title || '(sem título)'}
                      </p>
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #EF4444, #f87171)' }} />
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontSize: '0.875rem', fontWeight: 700 }}>{fmt(v.views)}</p>
                      <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'flex-end' }}>
                        <ThumbsUp size={10} /> {fmt(v.likes)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
