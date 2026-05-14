import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '../components/Card';
import { Badge } from '../components/Badge';
import { KpiCard } from '../components/KpiCard';
import { API, fmt, TOOLTIP_STYLE } from '../utils/format';
import { DateRangeFilter, filterByRange, filterByRangeDate, type DateRange } from '../components/DateRangeFilter';
import { Eye, Heart, UserPlus, Users, Camera, BarChart3, TrendingUp, MessageCircle, Star, Play } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, ReferenceLine,
} from 'recharts';

function initRange(): DateRange {
  const d = new Date();
  const to = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const from = `${d.getFullYear()}-01`;
  return { from, to };
}

export function DashboardInstagram() {
  const [range, setRange] = useState<DateRange>(initRange());

  const { data: stats } = useSWR(`${API}/instagram-stats`);
  const { data: historyData } = useSWR(`${API}/instagram-history`);
  const { data: monthlyData } = useSWR(`${API}/instagram-monthly`);
  const { data: postsData } = useSWR(`${API}/instagram-posts`);

  const history = historyData || [];
  const monthly = monthlyData || [];
  const posts = postsData || [];

  // Apply date filter to history (daily data, name = 'DD/MM')
  // The daily history has `name` like '01/01', so we use the raw array filtered by matching months
  const filteredHistory: any[] = filterByRangeDate(history, range);
  const filteredMonthly: any[] = filterByRange(monthly, range);

  const avgReach = filteredHistory.length > 0
    ? Math.round(filteredHistory.reduce((s, r) => s + (r.alcance || 0), 0) / filteredHistory.length)
    : 0;
  const bestDay   = filteredHistory.reduce((b, r) => r.alcance > (b?.alcance || 0) ? r : b, null as any);
  const daysAbove = filteredHistory.filter(r => r.alcance > avgReach).length;
  const consistency = filteredHistory.length > 0 ? Math.round((daysAbove / filteredHistory.length) * 100) : 0;

  const tip = (() => {
    const er = stats?.engagement_rate || 0;
    const cr = stats?.conversion_rate || 0;
    if (er < 3)  return '📌 Engajamento abaixo de 3%. Priorize carrosséis, polls e perguntas para aumentar saves e comentários.';
    if (cr < 5)  return '📌 Boa visibilidade! Mas poucas visitas viram seguidores. Capriche na bio e use CTAs diretos nos posts.';
    return '🚀 Ótimos indicadores! Mantenha a frequência e experimente Reels para escalar o alcance.';
  })();

  return (
    <div className="flex flex-col gap-6 pb-10">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg, #E1306C 0%, #833AB4 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(225,48,108,0.35)' }}>
            <Camera size={24} color="#fff" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">@{stats?.username || 'rodrigosaracino.mkt'}</h1>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Dashboard de Instagram · Dados em tempo real</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Badge variant="info">{fmt(stats?.followers)} seguidores</Badge>
          <Badge variant="neutral">{fmt(stats?.media_count)} posts</Badge>
        </div>
      </div>

      {/* Date filter */}
      <div style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '0.75rem' }}>
        <DateRangeFilter value={range} onChange={setRange} accentColor="#E1306C" />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard title="Alcance do Mês"       value={fmt(stats?.reach)}               sub="Contas únicas"           icon={<Eye size={17} />}         accentClass="text-red-400"     />
        <KpiCard title="Contas Engajadas"     value={fmt(stats?.accounts_engaged)}     sub="Interagiram com posts"  icon={<Heart size={17} />}        accentClass="text-pink-400"    />
        <KpiCard title="Visitas ao Perfil"    value={fmt(stats?.profile_views)}        sub="Potencial conversão"    icon={<Users size={17} />}        accentClass="text-blue-400"    />
        <KpiCard title="Novos Seguidores"     value={fmt(stats?.new_followers)}        sub="Saldo do mês"           icon={<UserPlus size={17} />}     accentClass="text-emerald-400" />
        <KpiCard title="Interações Totais"    value={fmt(stats?.total_interactions)}   sub="Curtidas + comentários" icon={<MessageCircle size={17} />} accentClass="text-amber-400"  />
        <KpiCard title="Melhor Dia (Alcance)" value={fmt(bestDay?.alcance)}            sub={bestDay?.name || '—'}  icon={<Star size={17} />}         accentClass="text-yellow-400"  />
        <KpiCard title="Média Diária"         value={fmt(avgReach)}                    sub="No período selecionado" icon={<BarChart3 size={17} />}    accentClass="text-indigo-400"  />
        <KpiCard title="Consistência"         value={`${consistency}%`}               sub={`${daysAbove}/${filteredHistory.length} dias acima da média`} icon={<TrendingUp size={17} />} accentClass="text-teal-400" />
      </div>

      {/* Insights + Gráfico Histórico */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="glass-panel" style={{ border: '1px solid rgba(225,48,108,0.25)' }}>
          <CardHeader style={{ paddingBottom: '0.75rem' }}>
            <CardTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
              <BarChart3 size={15} style={{ color: '#E1306C' }} /> Insights Estratégicos
            </CardTitle>
          </CardHeader>
          <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <InsightBar label="Taxa de Engajamento"          value={(stats?.engagement_rate || 0).toFixed(2)} unit="%" color="#E1306C" max={10}  />
            <InsightBar label="Conversão (visita→follow)"    value={(stats?.conversion_rate || 0).toFixed(2)} unit="%" color="#818CF8" max={20}  />
            <InsightBar label="Retenção (alcance→perfil)"    value={(stats?.retention_rate  || 0).toFixed(2)} unit="%" color="#F59E0B" max={15}  />
            <div style={{ paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {tip}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel" style={{ gridColumn: 'span 2' }}>
          <CardHeader>
            <CardTitle>Alcance Histórico Diário — Período selecionado</CardTitle>
          </CardHeader>
          <CardContent style={{ height: '250px' }}>
            {filteredHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={filteredHistory} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="igReach" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#E1306C" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="#E1306C" stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                  <XAxis dataKey="name" stroke="var(--text-tertiary)" tick={{ fontSize: 10 }} interval={Math.max(0, Math.floor(filteredHistory.length / 10))} />
                  <YAxis stroke="var(--text-tertiary)" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <ReferenceLine y={avgReach} stroke="#F59E0B" strokeDasharray="4 4" label={{ value: 'Média', fill: '#F59E0B', fontSize: 10 }} />
                  <Area type="monotone" dataKey="alcance" stroke="#E1306C" fill="url(#igReach)" strokeWidth={2} name="Alcance" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                Nenhum dado para o período selecionado.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Monthly charts */}
      {filteredMonthly.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="glass-panel">
            <CardHeader><CardTitle>Alcance Acumulado por Mês</CardTitle></CardHeader>
            <CardContent style={{ height: '240px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={filteredMonthly} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                  <XAxis dataKey="name" stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} />
                  <YAxis stroke="var(--text-tertiary)" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="alcance" fill="#E1306C" name="Alcance Total" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="glass-panel">
            <CardHeader><CardTitle>Evolução de Seguidores</CardTitle></CardHeader>
            <CardContent style={{ height: '240px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={filteredMonthly} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="igSeg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#818CF8" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="#818CF8" stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                  <XAxis dataKey="name" stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} />
                  <YAxis stroke="var(--text-tertiary)" tick={{ fontSize: 10 }} domain={['dataMin - 50', 'dataMax + 50']} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Area type="monotone" dataKey="seguidores" stroke="#818CF8" fill="url(#igSeg)" strokeWidth={2} name="Seguidores" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent Posts Section */}
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Camera size={16} style={{ color: '#E1306C' }} /> Posts Recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {posts.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', textAlign: 'center', padding: '1.5rem 0' }}>
              Nenhum post encontrado ou carregando...
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {posts.map((post: any) => (
                <a key={post.id} href={post.permalink} target="_blank" rel="noreferrer" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ borderRadius: '0.625rem', overflow: 'hidden', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', transition: 'transform 0.2s, background 0.2s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
                  >
                    <div style={{ position: 'relative', width: '100%', paddingTop: '100%' /* 1:1 aspect ratio */, backgroundColor: '#111' }}>
                      <img 
                        src={post.media_type === 'VIDEO' ? post.thumbnail_url || post.media_url : post.media_url} 
                        alt="Post media" 
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      {post.media_type === 'VIDEO' && (
                        <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'rgba(0,0,0,0.6)', padding: '0.2rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                          <Play size={10} fill="white" />
                        </div>
                      )}
                    </div>
                    <div style={{ padding: '0.75rem' }}>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {post.caption || '(Sem legenda)'}
                      </p>
                      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-primary)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Heart size={12} color="#E1306C" /> {fmt(post.like_count)}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <MessageCircle size={12} color="#818CF8" /> {fmt(post.comments_count)}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Eye size={12} color="#A78BFA" /> {fmt(post.insights?.reach || post.insights?.impressions || 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InsightBar({ label, value, unit, color, max }: { label: string; value: string; unit: string; color: string; max: number }) {
  const pct = Math.min((parseFloat(value) / max) * 100, 100);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color }}>{value}{unit}</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
