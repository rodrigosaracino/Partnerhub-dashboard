import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/Card';
import { Badge } from '../components/Badge';
import { KpiCard } from '../components/KpiCard';
import { API, fmt, currency, TOOLTIP_STYLE } from '../utils/format';
import { DateRangeFilter, filterByRange, type DateRange } from '../components/DateRangeFilter';
import {
  Users, DollarSign, Video, Globe, TrendingUp, Zap, Camera,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, ComposedChart,
} from 'recharts';

function initRange(): DateRange {
  const d = new Date();
  const to = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const from = `${d.getFullYear()}-01`;
  return { from, to };
}

export function DashboardMix() {
  const [impact, setImpact] = useState<any>(null);
  const [igHistory, setIgHistory] = useState<any[]>([]);
  const [ytHistory, setYtHistory] = useState<any[]>([]);
  const [metaHistory, setMetaHistory] = useState<any[]>([]);
  const [igStats, setIgStats] = useState<any>(null);
  const [ytStats, setYtStats] = useState<any>(null);
  const [metaStats, setMetaStats] = useState<any>(null);
  const [financialStats, setFinancialStats] = useState({ income: 0, goal: 0, progress: 0 });
  const [range, setRange] = useState<DateRange>(initRange());

  useEffect(() => {
    (async () => {
      try {
        const [impactRes, igMonthRes, ytMonthRes, metaHistRes, igRes, ytRes, metaRes, goalsRes, txRes] =
          await Promise.allSettled([
            fetch(`${API}/total-impact`).then(r => r.json()),
            fetch(`${API}/instagram-monthly`).then(r => r.json()),
            fetch(`${API}/youtube-monthly-stats`).then(r => r.json()),
            fetch(`${API}/meta-history`).then(r => r.json()),
            fetch(`${API}/instagram-stats`).then(r => r.json()),
            fetch(`${API}/channel-stats`).then(r => r.json()),
            fetch(`${API}/meta-ads-stats`).then(r => r.json()),
            fetch(`${API}/financial-goals`).then(r => r.json()),
            fetch(`${API}/transactions`).then(r => r.json()),
          ]);

        if (impactRes.status === 'fulfilled') setImpact(impactRes.value);
        if (igMonthRes.status === 'fulfilled') setIgHistory(igMonthRes.value);
        if (ytMonthRes.status === 'fulfilled') setYtHistory(ytMonthRes.value);
        if (metaHistRes.status === 'fulfilled') setMetaHistory((metaHistRes.value as any[]).slice(-12));
        if (igRes.status === 'fulfilled') setIgStats(igRes.value);
        if (ytRes.status === 'fulfilled') setYtStats(ytRes.value);
        if (metaRes.status === 'fulfilled') setMetaStats(metaRes.value);

        if (goalsRes.status === 'fulfilled' && txRes.status === 'fulfilled') {
          const goals = goalsRes.value as any[];
          const txs   = txRes.value as any[];
          const today = new Date();
          const monthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
          const goal   = goals.find((g: any) => g.id === monthStr)?.target_revenue || 0;
          const income = txs.filter((t: any) => t.date?.startsWith(monthStr) && t.type === 'income')
                            .reduce((s: number, t: any) => s + t.amount, 0);
          setFinancialStats({ income, goal, progress: goal > 0 ? Math.min(Math.round((income / goal) * 100), 100) : 0 });
        }
      } catch (e) { console.error(e); }
    })();
  }, []);

  // Build filtered combined chart
  const combinedChart = (() => {
    const months: Record<string, any> = {};
    filterByRange(igHistory, range).forEach(r => { months[r.name] = { ...months[r.name], name: r.name, ig: r.alcance }; });

    const sortedYt = [...ytHistory].sort((a: any, b: any) => a.name.localeCompare(b.name));
    const ytFiltered = filterByRange(sortedYt, range);
    ytFiltered.forEach((r, idx) => {
      const globalIdx = sortedYt.findIndex(x => x.name === r.name);
      const prevViews = globalIdx > 0 ? sortedYt[globalIdx - 1].views : 5200;
      const monthlyViews = Math.max(0, r.views - prevViews);
      months[r.name] = { ...months[r.name], name: r.name, yt: monthlyViews };
    });

    return Object.values(months).sort((a: any, b: any) => a.name.localeCompare(b.name));
  })();

  const filteredMeta = filterByRange(metaHistory, range);

  return (
    <div className="flex flex-col gap-6 pb-10">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">Visão Geral — Mix</h1>
          <p className="text-muted" style={{ fontSize: '0.875rem' }}>Impacto consolidado de todas as redes e investimentos em 2026</p>
        </div>
        <Badge variant="success">Ao Vivo</Badge>
      </div>

      {/* Date filter */}
      <div style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '0.75rem' }}>
        <DateRangeFilter value={range} onChange={setRange} accentColor="#6366f1" />
      </div>

      {/* KPIs anuais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Alcance Total (Ano)"   value={fmt(impact?.year?.reach)} sub="Instagram + YouTube" icon={<Globe   size={18} />} accentClass="text-blue-400"    />
        <KpiCard title="Comunidade Total"      value={fmt(impact?.community?.total)} sub={`${fmt(impact?.community?.youtube)} YT · ${fmt(impact?.community?.instagram)} IG`} icon={<Users   size={18} />} accentClass="text-purple-400"  />
        <KpiCard title="Leads Gerados (Ano)"   value={fmt(impact?.year?.leads)}  sub="Via Meta Ads"       icon={<Zap     size={18} />} accentClass="text-amber-400"   />
        <KpiCard title="Investimento (Ano)"    value={currency(impact?.year?.investment || 0)} sub="Tráfego pago" icon={<DollarSign size={18} />} accentClass="text-emerald-400" />
      </div>

      {/* Alcance Combinado */}
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle>Alcance Combinado por Mês — IG vs YouTube</CardTitle>
        </CardHeader>
        <CardContent style={{ height: '280px' }}>
          {combinedChart.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={combinedChart} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gIg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#E1306C" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#E1306C" stopOpacity={0}   />
                  </linearGradient>
                  <linearGradient id="gYt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#FF0000" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#FF0000" stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} />
                <YAxis stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend />
                <Area type="monotone" dataKey="ig" name="Alcance IG"     stroke="#E1306C" fill="url(#gIg)" strokeWidth={2} />
                <Area type="monotone" dataKey="yt" name="Views YouTube"  stroke="#FF0000" fill="url(#gYt)" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Snapshots dos canais */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SnapshotCard title="Instagram" accentColor="#E1306C" icon={<Camera size={16} />}>
          <SnapRow label="Seguidores"            value={fmt(igStats?.followers)}               />
          <SnapRow label="Alcance (mês)"         value={fmt(igStats?.reach)}                   />
          <SnapRow label="Interações"            value={fmt(igStats?.total_interactions)}       />
          <SnapRow label="Novos seguidores"      value={fmt(igStats?.new_followers)}            />
          <SnapRow label="Taxa de Engajamento"   value={`${(igStats?.engagement_rate || 0).toFixed(2)}%`} />
        </SnapshotCard>

        <SnapshotCard title="YouTube" accentColor="#EF4444" icon={<Video size={16} />}>
          <SnapRow label="Inscritos"             value={fmt(ytStats?.subscriberCount)}          />
          <SnapRow label="Visualizações totais"  value={fmt(ytStats?.viewCount)}                />
          <SnapRow label="Vídeos publicados"     value={fmt(ytStats?.videoCount)}               />
          <SnapRow label="Média views/vídeo"     value={fmt(Math.round(parseInt(ytStats?.viewCount || '0') / parseInt(ytStats?.videoCount || '1')))} />
        </SnapshotCard>

        <SnapshotCard title="Meta Ads (Mês)" accentColor="#60a5fa" icon={<TrendingUp size={16} />}>
          <SnapRow label="Leads gerados"         value={fmt(metaStats?.leads)}                  />
          <SnapRow label="Investimento"          value={currency(metaStats?.spend || 0)}        />
          <SnapRow label="Custo por lead (CPL)"  value={currency(metaStats?.cpl || 0)}          />
          <SnapRow label="Faturamento (mês)"     value={currency(financialStats.income)}        />
          <SnapRow label="Meta do mês"           value={`${financialStats.progress}% (${currency(financialStats.goal)})`} />
        </SnapshotCard>
      </div>

      {/* Meta Ads History */}
      {filteredMeta.length > 0 && (
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle>Histórico de Anúncios — Leads vs Investimento</CardTitle>
          </CardHeader>
          <CardContent style={{ height: '260px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={filteredMeta} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="l" stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="r" orientation="right" stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend />
                <Bar yAxisId="l" dataKey="leads" fill="var(--accent-secondary)" name="Leads"     radius={[4,4,0,0]} />
                <Bar yAxisId="r" dataKey="spend" fill="#F59E0B"                 name="Gasto (R$)" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ── Local sub-components ──────────────────────────────────────── */
function EmptyState() {
  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
      Nenhum dado para o período selecionado.
    </div>
  );
}

function SnapshotCard({ title, accentColor, icon, children }: { title: string; accentColor: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="glass-panel" style={{ borderLeft: `3px solid ${accentColor}` }}>
      <CardHeader style={{ paddingBottom: '0.75rem' }}>
        <CardTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: accentColor }}>
          {icon} {title}
        </CardTitle>
      </CardHeader>
      <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
        {children}
      </CardContent>
    </Card>
  );
}

function SnapRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.375rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{value}</span>
    </div>
  );
}
