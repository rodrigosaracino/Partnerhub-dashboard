import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '../components/Card';
import { KpiCard } from '../components/KpiCard';
import { API, fmt, TOOLTIP_STYLE } from '../utils/format';
import {
  Video, Users, Eye, TrendingUp, Clock, MousePointerClick,
  Zap, Play, ThumbsUp, Upload, AlertCircle, Navigation, BarChart3,
} from 'lucide-react';
import {
  Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, ComposedChart, Line, Legend,
} from 'recharts';

function fmtDuration(secs: number): string {
  if (!secs) return '0:00';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function GrowthInsight({ label, value, hint, color = 'var(--accent-primary)' }: {
  label: string; value: string; hint: string; color?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: 10, borderLeft: `3px solid ${color}` }}>
      <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</span>
      <span style={{ fontSize: '1.1rem', fontWeight: 700, color }}>{value}</span>
      <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', lineHeight: 1.4 }}>{hint}</span>
    </div>
  );
}

const TRAFFIC_COLORS = ['#EF4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899','#14b8a6'];

export function DashboardYoutube() {
  const [months, setMonths] = useState(12);

  const { data: stats }     = useSWR(`${API}/channel-stats`);
  const { data: analytics, error: analyticsError } = useSWR(`${API}/youtube-analytics?months=${months}`);
  const { data: myVideos }  = useSWR(`${API}/my-video-stats`);

  const totalSubs  = parseInt(stats?.subscriberCount || '0');
  const summary:  any    = analytics?.summary  || {};
  const monthly:  any[]  = analytics?.monthly  || [];
  const traffic:  any[]  = analytics?.trafficSources || [];
  const hasImpressions   = analytics?.hasImpressions ?? false;
  const notAuthorized    = analyticsError || analytics?.error;

  // ── Filtro de período aplicado a myVideos ──────────────────
  const cutoff = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - months);
    return d;
  }, [months]);

  const filteredVideos = useMemo(() => {
    if (!myVideos) return [];
    return (myVideos as any[])
      .filter(v => new Date(v.publishedAt) >= cutoff)
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);
  }, [myVideos, cutoff]);

  // KPIs calculados do período filtrado
  const periodViews   = monthly.reduce((s: number, r: any) => s + r.views, 0);
  const periodUploads = filteredVideos.length;
  const avgViewsPeriod = periodUploads > 0 ? Math.round(periodViews / periodUploads) : 0;

  // Retenção média calculada com vídeos do período
  const retentionPct = useMemo(() => {
    if (!summary.avgViewDuration || !filteredVideos.length) return null;
    const vidsWithDuration = filteredVideos.filter((v: any) => v.duration);
    if (!vidsWithDuration.length) return null;
    const avgDurSecs = vidsWithDuration.reduce((s: number, v: any) => {
      const m = (v.duration || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (!m) return s;
      return s + parseInt(m[1]||'0')*3600 + parseInt(m[2]||'0')*60 + parseInt(m[3]||'0');
    }, 0) / vidsWithDuration.length;
    return avgDurSecs > 0 ? Math.min(100, Math.round((summary.avgViewDuration / avgDurSecs) * 100)) : null;
  }, [summary.avgViewDuration, filteredVideos]);

  const netSubs  = (summary.subsGained || 0) - (summary.subsLost || 0);
  const topSource = traffic[0];

  const ctrLevel = summary.ctr == null ? null
    : summary.ctr >= 6 ? { label: 'Excelente', color: '#4ade80' }
    : summary.ctr >= 4 ? { label: 'Boa',        color: '#facc15' }
    : summary.ctr >  0 ? { label: 'Baixa',       color: '#f87171' }
    : null;

  return (
    <div className="flex flex-col gap-6 pb-10">

      {/* Header + seletor de período */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg,#EF4444,#DC2626)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(239,68,68,0.35)' }}>
            <Video size={24} color="#fff" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">YouTube — Growth Dashboard</h1>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Todas as métricas referentes ao período selecionado</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', background: 'rgba(255,255,255,0.04)', padding: '0.3rem', borderRadius: 8 }}>
          {[3, 6, 12, 18].map(m => (
            <button key={m} onClick={() => setMonths(m)} style={{ padding: '0.35rem 0.8rem', borderRadius: 6, fontSize: '0.8rem', fontWeight: months === m ? 700 : 400, background: months === m ? '#EF4444' : 'transparent', border: 'none', color: months === m ? 'white' : 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.15s' }}>
              {m}m
            </button>
          ))}
        </div>
      </div>

      {/* Banner sem autorização */}
      {notAuthorized && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 1rem', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 10 }}>
          <AlertCircle size={16} style={{ color: '#fbbf24', flexShrink: 0 }} />
          <p style={{ fontSize: '0.85rem', color: '#fbbf24' }}>
            YouTube Analytics não conectado. <a href="/api/auth/youtube" style={{ fontWeight: 700, textDecoration: 'underline' }}>Clique aqui para autorizar</a> e desbloquear Watch Time, Inscritos por período e Fontes de Tráfego.
          </p>
        </div>
      )}

      {/* KPIs do período */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard title="Inscritos (total)"    value={fmt(totalSubs)}        sub="Acumulado do canal"           icon={<Users size={17} />}           accentClass="text-red-400"     />
        <KpiCard title="Views no Período"     value={fmt(periodViews)}      sub={`Últimos ${months} meses`}    icon={<Eye size={17} />}             accentClass="text-blue-400"    />
        <KpiCard title="Vídeos Publicados"    value={fmt(periodUploads)}    sub={`Últimos ${months} meses`}    icon={<Upload size={17} />}          accentClass="text-emerald-400" />
        <KpiCard title="Média Views/Vídeo"    value={fmt(avgViewsPeriod)}   sub="No período selecionado"       icon={<BarChart3 size={17} />}       accentClass="text-amber-400"   />
        <KpiCard title="Horas Assistidas"     value={fmt(summary.watchTimeHours || 0) + 'h'} sub={`Últimos ${months} meses`} icon={<Clock size={17} />} accentClass="text-cyan-400"    />
        <KpiCard title="Duração Média"        value={fmtDuration(summary.avgViewDuration || 0)} sub="Por visualização"    icon={<Play size={17} />}            accentClass="text-indigo-400"  />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard title="Inscritos Ganhos"   value={fmt(summary.subsGained || 0)}  sub={`Últimos ${months} meses`}  icon={<TrendingUp size={17} />}      accentClass="text-green-400"   />
        <KpiCard title="Inscritos Perdidos" value={fmt(summary.subsLost || 0)}    sub={`Últimos ${months} meses`}  icon={<Users size={17} />}           accentClass="text-orange-400"  />
        {hasImpressions && (
          <>
            <KpiCard title="Impressões"     value={fmt(summary.impressions || 0)} sub={`Últimos ${months} meses`}  icon={<Eye size={17} />}             accentClass="text-purple-400"  />
            <KpiCard title="CTR"            value={(summary.ctr || 0) + '%'}      sub="Taxa de clique no thumb"    icon={<MousePointerClick size={17} />} accentClass="text-pink-400"  />
          </>
        )}
      </div>

      {/* Insights de Growth */}
      {!notAuthorized && monthly.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {ctrLevel && (
            <GrowthInsight label="CTR do Canal" value={`${summary.ctr}% — ${ctrLevel.label}`}
              hint={summary.ctr >= 6 ? 'Thumbnails e títulos atraindo cliques acima da média.'
                : summary.ctr >= 4 ? 'CTR na média. Teste variações de thumbnail e título.'
                : 'CTR baixo. Reformule títulos e teste novos thumbnails.'}
              color={ctrLevel.color} />
          )}
          {retentionPct !== null && (
            <GrowthInsight label="Retenção Média" value={`${retentionPct}% do vídeo`}
              hint={retentionPct >= 50 ? 'Retenção forte — o algoritmo prioriza seu conteúdo.'
                : retentionPct >= 35 ? 'Retenção razoável. Melhore os primeiros 30 segundos.'
                : 'Retenção baixa. Revise o ritmo e gancho inicial dos vídeos.'}
              color={retentionPct >= 50 ? '#4ade80' : retentionPct >= 35 ? '#facc15' : '#f87171'} />
          )}
          {netSubs !== 0 && (
            <GrowthInsight label="Saldo de Inscritos" value={`${netSubs > 0 ? '+' : ''}${fmt(netSubs)}`}
              hint={netSubs > 0 ? `Ganho líquido de ${fmt(netSubs)} inscritos no período.` : `Perda líquida de ${fmt(Math.abs(netSubs))} inscritos. Analise o conteúdo com mais saídas.`}
              color={netSubs > 0 ? '#4ade80' : '#f87171'} />
          )}
          {topSource && (
            <GrowthInsight label="Principal Fonte" value={topSource.source}
              hint={`${topSource.pct}% das views. ${topSource.source.includes('Pesquisa') ? 'Otimize títulos com palavras-chave.' : topSource.source.includes('Sugeridos') ? 'Algoritmo recomendando seus vídeos. Mantenha consistência.' : topSource.source === 'YouTube Shorts' ? 'Shorts gerando tráfego. Considere usar como topo de funil.' : 'Diversifique suas fontes de tráfego.'}`}
              color="#818cf8" />
          )}
        </div>
      )}

      {/* Gráficos */}
      {!notAuthorized && monthly.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Views + Horas Assistidas */}
          <Card className="glass-panel">
            <CardHeader><CardTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Clock size={15} style={{ color: '#EF4444' }} /> Views & Horas Assistidas</CardTitle></CardHeader>
            <CardContent style={{ height: '240px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthly} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradViews" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#EF4444" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                  <XAxis dataKey="name" stroke="var(--text-tertiary)" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="left"  stroke="var(--text-tertiary)" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="right" orientation="right" stroke="var(--text-tertiary)" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any, n: any) => n === 'Horas Assistidas' ? `${fmt(v)}h` : fmt(v)} />
                  <Legend />
                  <Area yAxisId="left"  type="monotone" dataKey="views"         stroke="#EF4444" fill="url(#gradViews)" strokeWidth={2} name="Views" />
                  <Line yAxisId="right" type="monotone" dataKey="watchTimeHours" stroke="#818cf8" strokeWidth={2} dot={false} name="Horas Assistidas" />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Inscritos Ganhos vs Perdidos */}
          <Card className="glass-panel">
            <CardHeader><CardTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Users size={15} style={{ color: '#EF4444' }} /> Inscritos Ganhos vs Perdidos</CardTitle></CardHeader>
            <CardContent style={{ height: '240px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                  <XAxis dataKey="name" stroke="var(--text-tertiary)" tick={{ fontSize: 10 }} />
                  <YAxis stroke="var(--text-tertiary)" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend />
                  <Bar dataKey="subsGained" fill="#4ade80" name="Ganhos"   radius={[3,3,0,0]} />
                  <Bar dataKey="subsLost"   fill="#f87171" name="Perdidos" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Impressões + CTR (só se disponível) */}
          {hasImpressions && (
            <Card className="glass-panel">
              <CardHeader><CardTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Eye size={15} style={{ color: '#EF4444' }} /> Impressões & CTR</CardTitle></CardHeader>
              <CardContent style={{ height: '240px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={monthly} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                    <XAxis dataKey="name" stroke="var(--text-tertiary)" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="left"  stroke="var(--text-tertiary)" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="right" orientation="right" stroke="var(--text-tertiary)" tick={{ fontSize: 10 }} unit="%" />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any, n: any) => n === 'CTR (%)' ? `${v}%` : fmt(v)} />
                    <Legend />
                    <Bar  yAxisId="left"  dataKey="impressions" fill="#EF4444" fillOpacity={0.6} name="Impressões" radius={[3,3,0,0]} />
                    <Line yAxisId="right" type="monotone" dataKey="ctr" stroke="#facc15" strokeWidth={2} dot={false} name="CTR (%)" />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Fontes de Tráfego */}
          {traffic.length > 0 && (
            <Card className="glass-panel">
              <CardHeader><CardTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Navigation size={15} style={{ color: '#EF4444' }} /> Fontes de Tráfego</CardTitle></CardHeader>
              <CardContent>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', paddingTop: '0.25rem' }}>
                  {traffic.slice(0, 8).map((t: any, i: number) => (
                    <div key={t.source} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', minWidth: 170, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.source}</span>
                      <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${t.pct}%`, background: TRAFFIC_COLORS[i % TRAFFIC_COLORS.length], borderRadius: 4 }} />
                      </div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, minWidth: 36, textAlign: 'right' }}>{t.pct}%</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', minWidth: 48, textAlign: 'right' }}>{fmt(t.views)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Top Vídeos do período */}
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Play size={16} style={{ color: '#EF4444' }} /> Top Vídeos — últimos {months} meses
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', fontWeight: 400 }}>{filteredVideos.length} vídeos no período</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!filteredVideos.length ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', textAlign: 'center', padding: '1.5rem 0' }}>
              Nenhum vídeo publicado nesse período.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {filteredVideos.map((v: any, i: number) => {
                const max  = filteredVideos[0]?.views || 1;
                const pct  = Math.round((v.views / max) * 100);
                const engRate = v.views > 0 ? ((v.likes / v.views) * 100).toFixed(1) : '0';
                const date = new Date(v.publishedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
                return (
                  <a key={v.id} href={v.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', padding: '0.75rem', borderRadius: '0.625rem', background: 'rgba(255,255,255,0.03)', textDecoration: 'none', color: 'inherit' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'}
                  >
                    <span style={{ fontSize: '0.875rem', fontWeight: 700, width: '1.5rem', textAlign: 'center', color: i===0?'#fbbf24':i===1?'#cbd5e1':i===2?'#fb923c':'var(--text-secondary)' }}>{i+1}</span>
                    {v.thumbnail && <img src={v.thumbnail} alt="" style={{ width: 56, height: 32, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '0.82rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '0.3rem' }}>{v.title}</p>
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#EF4444,#f87171)' }} />
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontSize: '0.875rem', fontWeight: 700 }}>{fmt(v.views)}</p>
                      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}><ThumbsUp size={9} />{fmt(v.likes)}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}><Zap size={9} />{engRate}%</span>
                        <span>{date}</span>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
