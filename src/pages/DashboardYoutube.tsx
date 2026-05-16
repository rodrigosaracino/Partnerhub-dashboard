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
  const { data: videosDb }  = useSWR(`${API}/videos`);

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
  // ── Pillar analysis ──────────────────────────────────────────
  const PILLAR_META: Record<string, { label: string; color: string; desc: string }> = {
    diagnostic: { label: 'Diagnóstico', color: '#3B82F6', desc: 'Descoberta e conscientização' },
    solution:   { label: 'Solução',     color: '#10B981', desc: 'Tutoriais e resolução de problemas' },
    backstage:  { label: 'Bastidor',    color: '#F59E0B', desc: 'Conteúdo pessoal e relacionamento' },
  };
  const pillarStats = Object.entries(PILLAR_META).map(([key, meta]) => {
    const vids = ((videosDb || []) as any[]).filter(v => v.pillar === key && v.status === 'published');
    if (!vids.length) return null;
    const n        = vids.length;
    const avgViews = Math.round(vids.reduce((s: number, v: any) => s + (v.views || 0), 0) / n);
    const avgLikes = Math.round(vids.reduce((s: number, v: any) => s + (v.likes || 0), 0) / n);
    const avgEr    = avgViews > 0 ? parseFloat(((avgLikes / avgViews) * 100).toFixed(2)) : 0;
    return { key, ...meta, count: n, avgViews, avgLikes, avgEr };
  }).filter((x): x is NonNullable<typeof x> => x !== null);

  const pMaxViews = pillarStats.length ? Math.max(...pillarStats.map(p => p.avgViews)) || 1 : 1;
  const pMaxEr    = pillarStats.length ? Math.max(...pillarStats.map(p => p.avgEr))    || 1 : 1;
  const bestPillarViews = pillarStats.length ? pillarStats.reduce((b, p) => p.avgViews > b.avgViews ? p : b) : null;
  const bestPillarEr    = pillarStats.length ? pillarStats.reduce((b, p) => p.avgEr    > b.avgEr    ? p : b) : null;

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
        <div style={{ padding: '1rem 1.25rem', background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: '0.875rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <AlertCircle size={18} style={{ color: '#fbbf24', flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#fbbf24', marginBottom: '0.5rem' }}>
                YouTube Analytics não conectado
              </p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '0.875rem' }}>
                Para desbloquear Watch Time, inscritos por período, CTR e fontes de tráfego, autorize o acesso ao YouTube Analytics:
              </p>
              <ol style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: '1.25rem', marginBottom: '1rem' }}>
                <li>No <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" style={{ color: '#fbbf24', fontWeight: 600 }}>Google Cloud Console</a>, adicione <code style={{ background: 'rgba(255,255,255,0.08)', padding: '0.1rem 0.3rem', borderRadius: 3 }}>http://localhost:3001/api/auth/youtube/callback</code> como URI de redirecionamento autorizado do OAuth.</li>
                <li>Depois clique no botão abaixo para autorizar.</li>
                <li>Após autorizar, os dados históricos serão importados automaticamente.</li>
              </ol>
              <a
                href="/api/auth/youtube"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#fbbf24', color: '#000', fontWeight: 700, fontSize: '0.825rem', padding: '0.5rem 1.125rem', borderRadius: '0.5rem', textDecoration: 'none' }}
              >
                Conectar YouTube Analytics
              </a>
            </div>
          </div>
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

      {/* Pillar Performance */}
      {pillarStats.length >= 2 && (
        <Card className="glass-panel">
          <CardHeader style={{ paddingBottom: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <CardTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                <BarChart3 size={15} style={{ color: '#3B82F6' }} /> Performance por Pilar
              </CardTitle>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                {((videosDb || []) as any[]).filter(v => v.status === 'published').length} vídeos publicados no total
              </span>
            </div>
          </CardHeader>
          <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {/* Insight */}
            <div style={{ padding: '0.625rem 0.875rem', background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.18)', borderRadius: '0.5rem', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.6, display: 'flex', flexWrap: 'wrap', gap: '0.25rem 0.5rem' }}>
              <span>💡</span>
              {bestPillarViews && <span><strong style={{ color: bestPillarViews.color }}>{bestPillarViews.label}</strong> tem mais views ({fmt(bestPillarViews.avgViews)}/vídeo)</span>}
              {bestPillarEr?.key !== bestPillarViews?.key && bestPillarEr && <span> · <strong style={{ color: bestPillarEr.color }}>{bestPillarEr.label}</strong> tem melhor engajamento ({bestPillarEr.avgEr.toFixed(2)}% ER)</span>}
            </div>

            {/* Pillar cards */}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${pillarStats.length}, 1fr)`, gap: '0.75rem' }}>
              {pillarStats.map(ps => (
                <div key={ps.key} style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {/* Header */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: ps.color, flexShrink: 0 }} />
                      <p style={{ fontSize: '0.875rem', fontWeight: 700 }}>{ps.label}</p>
                    </div>
                    <p style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', paddingLeft: '1.125rem' }}>{ps.desc} · {ps.count} vídeo{ps.count !== 1 ? 's' : ''}</p>
                  </div>

                  {/* Metrics */}
                  {([
                    { label: 'Média de Views', value: fmt(ps.avgViews), pct: ps.avgViews / pMaxViews, isBest: bestPillarViews?.key === ps.key },
                    { label: 'Engajamento',    value: `${ps.avgEr.toFixed(2)}%`, pct: pMaxEr > 0 ? ps.avgEr / pMaxEr : 0, isBest: bestPillarEr?.key === ps.key },
                    { label: 'Curtidas méd.',  value: fmt(ps.avgLikes), pct: ps.avgViews > 0 ? ps.avgLikes / ps.avgViews : 0, isBest: false },
                  ] as { label: string; value: string; pct: number; isBest: boolean }[]).map(m => (
                    <div key={m.label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.63rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{m.label}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          {m.isBest && (
                            <span style={{ fontSize: '0.6rem', fontWeight: 700, color: ps.color, background: `${ps.color}18`, border: `1px solid ${ps.color}40`, padding: '0.05rem 0.3rem', borderRadius: '999px' }}>
                              melhor
                            </span>
                          )}
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: m.isBest ? ps.color : 'var(--text-primary)' }}>{m.value}</span>
                        </div>
                      </div>
                      <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 3, background: m.isBest ? ps.color : `${ps.color}70`, width: `${Math.min(Math.round(m.pct * 100), 100)}%`, transition: 'width 0.5s ease' }} />
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
