import React from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '../components/Card';
import { Badge } from '../components/Badge';
import { Users, DollarSign, MousePointerClick, Video, Camera, Eye, Heart, UserPlus, Globe, TrendingUp, Zap, BarChart3, Target } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { API } from '../utils/format';

const mockYoutubeData = [
  { name: 'Sem 1', views: 4000, subs: 120 },
  { name: 'Sem 2', views: 5500, subs: 150 },
  { name: 'Sem 3', views: 8000, subs: 280 },
  { name: 'Sem 4', views: 12000, subs: 450 },
  { name: 'Sem 5', views: 18000, subs: 600 },
];

const mockFunnelData = [
  { name: 'Sem 1', leads: 0, vendas: 0 },
  { name: 'Sem 2', leads: 0, vendas: 0 },
  { name: 'Sem 3', leads: 0, vendas: 0 },
  { name: 'Sem 4', leads: 0, vendas: 0 },
  { name: 'Sem 5', leads: 0, vendas: 0 },
];

export function Dashboard() {
  const { data: youtubeStats } = useSWR(`${API}/channel-stats`);
  const { data: totalImpact } = useSWR(`${API}/total-impact`);
  const { data: youtubeGrowthData } = useSWR(`${API}/channel-history`);
  const { data: metaGrowthData } = useSWR(`${API}/meta-history`);
  const { data: instagramGrowthData } = useSWR(`${API}/instagram-history`);
  const { data: igStats } = useSWR(`${API}/instagram-stats`);
  const { data: metaStatsData } = useSWR(`${API}/meta-ads-stats`);
  const { data: goalsRes } = useSWR(`${API}/financial-goals`);
  const { data: txRes } = useSWR(`${API}/transactions`);

  const youtubeLoading = !youtubeStats;
  const youtubeGrowth = youtubeGrowthData || [];
  const metaGrowth = metaGrowthData ? (metaGrowthData as any[]).slice(-15) : [];
  const instagramGrowth = instagramGrowthData ? (instagramGrowthData as any[]).slice(-15) : [];
  const metaStats = metaStatsData?.error || !metaStatsData ? { spend: 0, leads: 0, cpl: 0, error: true } : { ...metaStatsData, error: false };

  const financialStats = (() => {
    let income = 0;
    let goal = 0;
    let progress = 0;
    if (goalsRes && txRes) {
      const today = new Date();
      const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      goal = goalsRes.find((g: any) => g.id === currentMonthStr)?.target_revenue || 0;
      income = txRes.filter((tx: any) => tx.date?.startsWith(currentMonthStr) && tx.type === 'income')
                        .reduce((acc: number, tx: any) => acc + tx.amount, 0);
      progress = goal > 0 ? Math.min(Math.round((income / goal) * 100), 100) : 0;
    }
    return { income, goal, progress };
  })();

  const formatNumber = (num?: number | string) => {
    if (!num) return '0';
    return (typeof num === 'string' ? parseInt(num) : num).toLocaleString('pt-BR');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div className="flex justify-between items-center mb-2">
        <div>
          <h1 className="text-2xl font-bold mb-1">Impacto Global 2026</h1>
          <p className="text-muted">Visão estratégica consolidada de todas as redes e investimentos.</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="success" className="animate-pulse">Sincronizado</Badge>
        </div>
      </div>

      {/* Seção Impacto Total */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        <MetricCard 
          title="Alcance Total (Ano)" 
          value={formatNumber(totalImpact?.year?.reach)} 
          sub="Impacto acumulado YouTube + IG" 
          icon={<Globe className="text-blue-400" />} 
          progress={100}
          variant="glass"
        />
        <MetricCard 
          title="Comunidade Total" 
          value={formatNumber(totalImpact?.community?.total)} 
          sub={`${formatNumber(totalImpact?.community?.youtube)} YT | ${formatNumber(totalImpact?.community?.instagram)} IG`} 
          icon={<Users className="text-purple-400" />} 
          progress={100}
          variant="glass"
        />
        <MetricCard 
          title="Leads Gerados (Ano)" 
          value={formatNumber(totalImpact?.year?.leads)} 
          sub="Volume total de conversões" 
          icon={<Zap className="text-amber-400" />} 
          progress={100}
          variant="glass"
        />
        <MetricCard 
          title="Investimento Total (Ano)" 
          value={formatCurrency(totalImpact?.year?.investment || 0)} 
          sub="Capital aplicado em tráfego" 
          icon={<DollarSign className="text-[var(--success)]" />} 
          progress={100}
          variant="glass"
        />
      </div>

      <div className="h-px bg-[var(--border-color)] my-2"></div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard 
          title="Faturamento (Mês)" 
          value={formatCurrency(financialStats.income)} 
          sub={financialStats.goal > 0 ? `Meta: ${formatCurrency(financialStats.goal)} (${financialStats.progress}%)` : 'Nenhuma meta definida'} 
          icon={<Target className="text-[var(--success)]" />} 
          progress={financialStats.progress} 
        />
        <MetricCard 
          title="Leads (Mês)" 
          value={metaStats.error ? "0" : formatNumber(metaStats.leads)} 
          sub={metaStats.error ? "Aguardando token" : "Meta Ads"} 
          icon={<TrendingUp className="text-[var(--accent-primary)]" />} 
          progress={metaStats.leads > 0 ? 100 : 0} 
        />
        <MetricCard 
          title="Inscritos YouTube" 
          value={youtubeLoading ? '...' : formatNumber(youtubeStats?.subscriberCount)} 
          sub={youtubeStats?.videoCount ? `${youtubeStats.videoCount} vídeos no canal` : ""} 
          icon={<Video className="text-[var(--danger)]" />} 
          progress={100} 
        />
        <MetricCard 
          title="CPL (Mês)" 
          value={metaStats.error ? "R$ 0,00" : formatCurrency(metaStats.cpl)} 
          sub={metaStats.error ? "Sem dados" : `Gasto: ${formatCurrency(metaStats.spend)}`} 
          icon={<MousePointerClick className="text-[var(--warning)]" />} 
          progress={100} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle>Crescimento do YouTube</CardTitle>
          </CardHeader>
          <CardContent style={{ height: '320px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={youtubeGrowth.length > 0 ? youtubeGrowth : mockYoutubeData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorInscritos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--danger)" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="var(--danger)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="var(--text-tertiary)" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
                <YAxis stroke="var(--text-tertiary)" />
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '8px' }} />
                <Area type="monotone" dataKey="inscritos" stroke="var(--danger)" fillOpacity={1} fill="url(#colorInscritos)" name="Inscritos" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader>
            <CardTitle>Histórico de Anúncios (Leads vs Investimento)</CardTitle>
          </CardHeader>
          <CardContent style={{ height: '320px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metaGrowth.length > 0 ? metaGrowth : mockFunnelData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <XAxis dataKey="name" stroke="var(--text-tertiary)" />
                <YAxis yAxisId="left" stroke="var(--text-tertiary)" />
                <YAxis yAxisId="right" orientation="right" stroke="var(--text-tertiary)" />
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '8px', color: 'white' }} />
                <Legend />
                <Bar yAxisId="left" dataKey="leads" fill="var(--accent-secondary)" name="Leads Gerados" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="spend" fill="var(--warning)" name="Investimento (R$)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Seção Instagram Expandida */}
      <div className="mt-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Camera size={20} className="text-[#E1306C]" />
            <h2 className="text-lg font-bold">Instagram <span className="text-muted font-normal text-sm">@{igStats?.username || 'rodrigosaracino.mkt'}</span></h2>
          </div>
          <Badge variant="info">{formatNumber(igStats?.followers)} seguidores</Badge>
          <Badge variant="neutral">{igStats?.media_count || 0} posts</Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-2 gap-4">
            <MetricCard
              title="Alcance do Mês"
              value={formatNumber(igStats?.reach)}
              sub="Contas únicas alcançadas"
              icon={<Eye className="text-[#E1306C]" />}
              progress={100}
            />
            <MetricCard
              title="Engajamento Total"
              value={formatNumber(igStats?.total_interactions)}
              sub="Curtidas, comentários, saves"
              icon={<Heart className="text-[#E1306C]" />}
              progress={100}
            />
            <MetricCard
              title="Visitas ao Perfil"
              value={formatNumber(igStats?.profile_views)}
              sub="Potencial de conversão"
              icon={<Users className="text-[var(--accent-primary)]" />}
              progress={100}
            />
            <MetricCard
              title="Novos Seguidores"
              value={formatNumber(igStats?.new_followers)}
              sub="Saldo positivo do mês"
              icon={<UserPlus className="text-[var(--success)]" />}
              progress={100}
            />
          </div>

          <Card className="glass-panel border border-[rgba(225,48,108,0.3)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 size={16} className="text-[#E1306C]" />
                Insights Estratégicos
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted">Taxa de Engajamento</span>
                <span className="text-sm font-bold text-[var(--success)]">{(igStats?.engagement_rate || 0).toFixed(2)}%</span>
              </div>
              <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                <div className="bg-[#E1306C] h-full" style={{ width: `${Math.min((igStats?.engagement_rate || 0) * 10, 100)}%` }}></div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-xs text-muted">Taxa de Conversão</span>
                <span className="text-sm font-bold text-blue-400">{(igStats?.conversion_rate || 0).toFixed(2)}%</span>
              </div>
              <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                <div className="bg-blue-400 h-full" style={{ width: `${Math.min((igStats?.conversion_rate || 0) * 10, 100)}%` }}></div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-xs text-muted">Retenção (Perfil/Alcance)</span>
                <span className="text-sm font-bold text-amber-400">{(igStats?.retention_rate || 0).toFixed(2)}%</span>
              </div>
              <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                <div className="bg-amber-400 h-full" style={{ width: `${Math.min((igStats?.retention_rate || 0) * 10, 100)}%` }}></div>
              </div>

              <div className="mt-2 pt-3 border-t border-white/5">
                <p className="text-[10px] text-muted leading-relaxed">
                  💡 Sua maior eficiência está na <strong>{igStats && igStats.engagement_rate > 5 ? 'retenção' : 'descoberta'}</strong>. 
                  Considere aumentar postagens de topo de funil (Reels) para escalar o alcance.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="glass-panel mt-6">
          <CardHeader>
            <CardTitle>Alcance Histórico do Instagram</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {(instagramGrowth.length > 0 || (igStats && igStats.reach_chart.length > 0)) ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={instagramGrowth.length > 0 ? instagramGrowth : igStats?.reach_chart} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorIgReach" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#E1306C" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#E1306C" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="var(--text-tertiary)" tick={{ fontSize: 12 }} />
                  <YAxis stroke="var(--text-tertiary)" />
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '8px' }} />
                  <Area type="monotone" dataKey="alcance" stroke="#E1306C" fillOpacity={1} fill="url(#colorIgReach)" name="Alcance" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted">Carregando histórico do Instagram...</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ title, value, sub, icon, progress, variant = 'default' }: { title: string, value: string, sub: string, icon: React.ReactNode, progress: number, variant?: 'default' | 'glass' }) {
  return (
    <Card className={`glass-panel hoverable ${variant === 'glass' ? 'bg-white/5 border-none' : ''}`}>
      <CardContent className="p-1">
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-xs text-muted font-medium mb-1 uppercase tracking-wider">{title}</p>
            <h3 className="text-2xl font-bold">{value}</h3>
          </div>
          <div className="p-2 bg-[rgba(255,255,255,0.05)] rounded-lg">
            {icon}
          </div>
        </div>
        <div className="w-full bg-[var(--bg-tertiary)] rounded-full h-1.5 mb-2 overflow-hidden">
          <div className="bg-[var(--accent-gradient)] h-1.5 rounded-full" style={{ width: `${progress}%` }}></div>
        </div>
        <p className="text-[10px] text-muted line-clamp-1">{sub}</p>
      </CardContent>
    </Card>
  );
}
