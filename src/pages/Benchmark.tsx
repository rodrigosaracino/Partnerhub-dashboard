import React, { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { Trophy, Users, Loader2, AlertCircle, RefreshCw, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '../components/Card';
import { Badge } from '../components/Badge';
import { API } from '../utils/format';

// ─── Types ────────────────────────────────────────────────────

interface SavedChannel {
  id: string;
  input: string;
  title: string;
  thumbnail: string;
  subscribers: number;
  platform?: 'youtube' | 'instagram';
}

interface VideoStat {
  id: string;
  title: string;
  publishedAt: string;
  thumbnail: string;
  views: number;
  likes: number;
  comments: number;
  engagementRate: number;
  duration: string;
  url: string;
}

interface ColumnData {
  id: string;
  title: string;
  thumbnail: string;
  isMe: boolean;
  loading: boolean;
  error?: string;
  topVideo?: VideoStat;
  // YouTube
  subscribers?: number;
  totalViews?: number;
  videoCount?: number;
  avgViewsPerVideo?: number;
  avgEngagementRate?: number;
  avgLikesPerVideo?: number;
  avgCommentsPerVideo?: number;
  viewsPerSubscriber?: number;
  publishFrequency?: number;
  avgDurationMin?: number;
  consistencyRate?: number;
  // Instagram
  followers?: number;
  postCount?: number;
  igEngagementRate?: number;
  avgReachPerPost?: number;
  avgLikesPerPost?: number;
  avgCommentsPerPost?: number;
  avgSavedPerPost?: number;
  igPublishFrequency?: number;
}

// ─── Metric definitions ───────────────────────────────────────

const YT_METRICS: { key: keyof ColumnData; label: string; desc: string; fmt: 'num' | 'pct' | 'dec'; emoji: string }[] = [
  { key: 'subscribers',        label: 'Inscritos',                  desc: 'Total de inscritos no canal',                                   fmt: 'num', emoji: '👥' },
  { key: 'totalViews',         label: 'Views Totais',               desc: 'Soma de todas as visualizações históricas do canal',            fmt: 'num', emoji: '👁️' },
  { key: 'avgViewsPerVideo',   label: 'Média de Views/Vídeo',       desc: 'Views totais ÷ quantidade de vídeos publicados',                fmt: 'num', emoji: '📊' },
  { key: 'avgEngagementRate',  label: 'Taxa de Engajamento',        desc: '(Curtidas + Comentários) ÷ Views × 100 — qualidade do conteúdo',fmt: 'pct', emoji: '⚡' },
  { key: 'avgLikesPerVideo',   label: 'Curtidas Médias/Vídeo',      desc: 'Média de curtidas nos vídeos recentes — aprovação do conteúdo', fmt: 'num', emoji: '👍' },
  { key: 'avgCommentsPerVideo',label: 'Comentários Médios/Vídeo',   desc: 'Média de comentários — engajamento profundo com a audiência',   fmt: 'num', emoji: '💬' },
  { key: 'viewsPerSubscriber', label: 'Views por Inscrito',         desc: 'Views Totais ÷ Inscritos — eficiência do canal com a base',    fmt: 'dec', emoji: '📈' },
  { key: 'publishFrequency',   label: 'Frequência (vídeos/mês)',    desc: 'Média de vídeos publicados por mês — consistência de produção', fmt: 'dec', emoji: '📅' },
  { key: 'avgDurationMin',     label: 'Duração Média (min)',         desc: 'Tempo médio dos vídeos em minutos — formato de conteúdo',      fmt: 'dec', emoji: '⏱️' },
  { key: 'consistencyRate',    label: 'Consistência de Performance',desc: '% de vídeos com ≥ 50% da média de views — previsibilidade',    fmt: 'pct', emoji: '🎯' },
  { key: 'videoCount',         label: 'Vídeos Publicados',          desc: 'Volume total de vídeos no canal',                               fmt: 'num', emoji: '🎬' },
];

const IG_METRICS: { key: keyof ColumnData; label: string; desc: string; fmt: 'num' | 'pct' | 'dec'; emoji: string }[] = [
  { key: 'followers',           label: 'Seguidores',                desc: 'Total de seguidores do perfil',                                          fmt: 'num', emoji: '👥' },
  { key: 'igEngagementRate',    label: 'Taxa de Engajamento',       desc: '(Curtidas + Comentários) ÷ Seguidores × 100',                           fmt: 'pct', emoji: '⚡' },
  { key: 'avgReachPerPost',     label: 'Alcance Médio/Post',        desc: 'Contas únicas que viram o post — só disponível para sua conta',          fmt: 'num', emoji: '📡' },
  { key: 'avgLikesPerPost',     label: 'Curtidas Médias/Post',      desc: 'Média de curtidas nos posts recentes',                                   fmt: 'num', emoji: '👍' },
  { key: 'avgCommentsPerPost',  label: 'Comentários Médios/Post',   desc: 'Média de comentários nos posts recentes',                               fmt: 'num', emoji: '💬' },
  { key: 'avgSavedPerPost',     label: 'Salvamentos Médios/Post',   desc: 'Média de saves por post — indica conteúdo de alto valor percebido',     fmt: 'num', emoji: '🔖' },
  { key: 'igPublishFrequency',  label: 'Frequência (posts/mês)',    desc: 'Média de posts publicados por mês — consistência de produção',           fmt: 'dec', emoji: '📅' },
  { key: 'postCount',           label: 'Posts Publicados',          desc: 'Volume total de posts no perfil',                                        fmt: 'num', emoji: '📸' },
];

// ─── Helpers ──────────────────────────────────────────────────

function avgArr(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function parseDurationMin(iso: string): number {
  if (!iso) return 0;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return parseInt(m[1] || '0') * 60 + parseInt(m[2] || '0') + parseInt(m[3] || '0') / 60;
}

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
function withinDays(dateStr: string, ms: number): boolean {
  return Date.now() - new Date(dateStr).getTime() <= ms;
}

function calcFrequency(videos: { publishedAt: string }[]): number {
  if (videos.length < 2) return videos.length;
  const dates = videos.map(v => new Date(v.publishedAt).getTime()).sort((a, b) => a - b);
  const months = Math.max(0.5, (dates[dates.length - 1] - dates[0]) / (30 * 24 * 60 * 60 * 1000));
  return parseFloat((videos.length / months).toFixed(1));
}

function calcConsistency(videos: { views: number }[]): number {
  if (!videos.length) return 0;
  const mean = avgArr(videos.map(v => v.views));
  const above = videos.filter(v => v.views >= mean * 0.5).length;
  return parseFloat(((above / videos.length) * 100).toFixed(1));
}

function fmtVal(n: number | undefined, fmt: 'num' | 'pct' | 'dec'): string {
  if (n === undefined || n === null || isNaN(n)) return '—';
  if (fmt === 'pct') return n.toFixed(1) + '%';
  if (fmt === 'dec') return n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  return Math.round(n).toLocaleString('pt-BR');
}

function computeCompetitorYt(saved: SavedChannel, data: any): ColumnData {
  const { channel, videos = [] } = data;
  const valid = videos.filter((v: VideoStat) => v.views > 0);
  const recent90 = videos.filter((v: VideoStat) => withinDays(v.publishedAt, NINETY_DAYS_MS));
  const top = [...(recent90.length ? recent90 : videos)].sort((a: VideoStat, b: VideoStat) => b.views - a.views)[0];
  return {
    id: saved.id, title: channel.title, thumbnail: channel.thumbnail, isMe: false, loading: false,
    topVideo: top,
    subscribers:          channel.subscribers,
    totalViews:           channel.totalViews,
    videoCount:           channel.videoCount,
    avgViewsPerVideo:     channel.videoCount > 0 ? Math.round(channel.totalViews / channel.videoCount) : 0,
    avgEngagementRate:    parseFloat(avgArr(valid.map((v: VideoStat) => v.engagementRate)).toFixed(2)),
    avgLikesPerVideo:     Math.round(avgArr(valid.map((v: VideoStat) => v.likes))),
    avgCommentsPerVideo:  Math.round(avgArr(valid.map((v: VideoStat) => v.comments))),
    viewsPerSubscriber:   channel.subscribers > 0 ? parseFloat((channel.totalViews / channel.subscribers).toFixed(1)) : 0,
    publishFrequency:     calcFrequency(videos),
    avgDurationMin:       parseFloat(avgArr(videos.map((v: VideoStat) => parseDurationMin(v.duration))).toFixed(1)),
    consistencyRate:      calcConsistency(valid),
  };
}

function computeCompetitorIg(saved: SavedChannel, data: any): ColumnData {
  const { channel, videos = [] } = data;
  const recent90ig = videos.filter((v: VideoStat) => withinDays(v.publishedAt, NINETY_DAYS_MS));
  const top = [...(recent90ig.length ? recent90ig : videos)].sort((a: VideoStat, b: VideoStat) => b.likes - a.likes)[0];
  return {
    id: saved.id, title: channel.title, thumbnail: channel.thumbnail, isMe: false, loading: false,
    topVideo: top,
    followers:            channel.subscribers,
    postCount:            channel.videoCount,
    igEngagementRate:     parseFloat(avgArr(videos.map((v: VideoStat) => v.engagementRate)).toFixed(2)),
    avgLikesPerPost:      Math.round(avgArr(videos.map((v: VideoStat) => v.likes))),
    avgCommentsPerPost:   Math.round(avgArr(videos.map((v: VideoStat) => v.comments))),
    igPublishFrequency:   calcFrequency(videos),
  };
}

// ─── Cell color ───────────────────────────────────────────────

function getColor(val: number | undefined, all: (number | undefined)[]): { color: string; bg: string; bold: boolean } {
  if (val === undefined) return { color: 'var(--text-tertiary)', bg: 'transparent', bold: false };
  const nums = all.filter((v): v is number => v !== undefined && !isNaN(v));
  if (nums.length < 2) return { color: 'var(--text-primary)', bg: 'transparent', bold: false };
  const max = Math.max(...nums), min = Math.min(...nums);
  if (max === min) return { color: 'var(--text-primary)', bg: 'transparent', bold: false };
  if (val === max) return { color: '#4ade80', bg: 'rgba(74,222,128,0.08)', bold: true };
  if (val === min) return { color: '#f87171', bg: 'rgba(248,113,113,0.08)', bold: false };
  return { color: 'var(--text-primary)', bg: 'transparent', bold: false };
}

// ─── Top Content Section ──────────────────────────────────────

function TopContentRow({ columns, platform }: { columns: ColumnData[]; platform: 'youtube' | 'instagram' }) {
  const withVideo = columns.filter(c => c.topVideo);
  if (!withVideo.length) return null;

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
        🏅 Melhor conteúdo dos últimos 90 dias
      </p>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        {columns.map(col => {
          if (!col.topVideo) return null;
          const v = col.topVideo;
          return (
            <a
              key={col.id}
              href={v.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ flex: '1 1 200px', maxWidth: 260, background: col.isMe ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.03)', border: `1px solid ${col.isMe ? 'rgba(99,102,241,0.3)' : 'var(--border-color)'}`, borderRadius: 10, overflow: 'hidden', textDecoration: 'none', color: 'inherit', display: 'block' }}
            >
              {v.thumbnail && (
                <div style={{ position: 'relative' }}>
                  <img src={v.thumbnail} alt={v.title} style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }} />
                  <div style={{ position: 'absolute', top: 6, left: 6, display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(0,0,0,0.7)', padding: '2px 6px', borderRadius: 6 }}>
                    {col.thumbnail
                      ? <img src={col.thumbnail} alt={col.title} style={{ width: 14, height: 14, borderRadius: '50%', objectFit: 'cover' }} />
                      : <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'rgba(99,102,241,0.6)' }} />
                    }
                    <span style={{ fontSize: '0.6rem', color: 'white', fontWeight: 600, maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col.title}</span>
                    {col.isMe && <span style={{ fontSize: '0.55rem', color: '#818cf8', fontWeight: 700 }}>você</span>}
                  </div>
                  <ExternalLink size={11} style={{ position: 'absolute', bottom: 6, right: 6, color: 'rgba(255,255,255,0.6)' }} />
                </div>
              )}
              <div style={{ padding: '0.5rem 0.6rem' }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 500, lineHeight: 1.3, marginBottom: '0.35rem', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>{v.title}</p>
                <div style={{ display: 'flex', gap: '0.6rem', fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>
                  {platform === 'youtube' && <span>👁️ {v.views.toLocaleString('pt-BR')}</span>}
                  <span>👍 {v.likes.toLocaleString('pt-BR')}</span>
                  <span>⚡ {v.engagementRate.toFixed(1)}%</span>
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}

// ─── Comparison table ─────────────────────────────────────────

function CompareTable({
  title, icon, columns, metrics, platform,
}: {
  title: string;
  icon: React.ReactNode;
  columns: ColumnData[];
  metrics: typeof YT_METRICS;
  platform: 'youtube' | 'instagram';
}) {
  const firstKey = metrics[0].key;
  const myPos = columns
    .slice()
    .sort((a, b) => ((b[firstKey] as number) || 0) - ((a[firstKey] as number) || 0))
    .findIndex(c => c.isMe);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
        {icon}
        <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{title}</span>
        {myPos === 0
          ? <span style={{ fontSize: '0.65rem', background: 'rgba(255,215,0,0.18)', color: '#FFD700', padding: '2px 10px', borderRadius: 20, fontWeight: 700 }}>🏆 Você lidera</span>
          : <Badge variant="neutral">#{myPos + 1}ª posição</Badge>
        }
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '0.82rem', minWidth: 500 }}>
          <thead>
            <tr>
              <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: 500, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.07em', minWidth: 230, borderBottom: '2px solid var(--border-color)' }}>
                Métrica
              </th>
              {columns.map(col => (
                <th key={col.id} style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '2px solid var(--border-color)', minWidth: 140, background: col.isMe ? 'rgba(99,102,241,0.07)' : 'transparent' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'flex-end' }}>
                      {col.thumbnail
                        ? <img src={col.thumbnail} alt={col.title} style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} />
                        : <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(99,102,241,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.5rem', fontWeight: 700, color: 'white' }}>RS</div>
                      }
                      <span style={{ fontWeight: col.isMe ? 700 : 500, color: col.isMe ? 'var(--accent-primary)' : 'var(--text-secondary)', fontSize: '0.78rem', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {col.title}
                      </span>
                    </div>
                    {col.isMe && (
                      <span style={{ fontSize: '0.58rem', background: 'rgba(99,102,241,0.25)', color: 'var(--accent-primary)', padding: '1px 7px', borderRadius: 10, fontWeight: 700 }}>você</span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map((m, ri) => {
              const allVals = columns.map(c => c[m.key] as number | undefined);
              return (
                <tr key={m.key} style={{ background: ri % 2 === 0 ? 'rgba(255,255,255,0.018)' : 'transparent' }}>
                  <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
                      <span>{m.emoji}</span>
                      <div>
                        <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{m.label}</span>
                        <p style={{ fontSize: '0.66rem', color: 'var(--text-tertiary)', marginTop: 1, lineHeight: 1.3 }}>{m.desc}</p>
                      </div>
                    </div>
                  </td>
                  {columns.map(col => {
                    const val = col[m.key] as number | undefined;
                    const { color, bg, bold } = getColor(val, allVals);
                    return (
                      <td key={col.id} style={{ padding: '9px 12px', textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.04)', background: col.isMe ? `rgba(99,102,241,0.05)` : bg, verticalAlign: 'middle' }}>
                        {col.loading
                          ? <Loader2 size={13} className="spin" style={{ color: 'var(--text-tertiary)' }} />
                          : col.error
                          ? <span title={col.error}><AlertCircle size={13} style={{ color: '#f87171' }} /></span>
                          : <span style={{ color, fontWeight: bold ? 700 : 400 }}>{fmtVal(val, m.fmt)}</span>
                        }
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.6rem', fontSize: '0.67rem', color: 'var(--text-tertiary)' }}>
        <span><span style={{ color: '#4ade80', fontWeight: 700 }}>Verde</span> = melhor valor da linha</span>
        <span><span style={{ color: '#f87171', fontWeight: 700 }}>Vermelho</span> = pior valor da linha</span>
      </div>

      <TopContentRow columns={columns} platform={platform} />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────

export function Benchmark() {
  const { data: youtubeStats } = useSWR(`${API}/channel-stats`);
  const { data: igStats }      = useSWR(`${API}/instagram-stats`);
  const { data: myVideos }     = useSWR(`${API}/my-video-stats`);
  const { data: myIgPosts }    = useSWR(`${API}/instagram-posts?limit=30`);

  const saved = useMemo<SavedChannel[]>(() => {
    try { return JSON.parse(localStorage.getItem('partnerhub_competitors') || '[]'); } catch { return []; }
  }, []);

  const ytSaved = useMemo(() => saved.filter(c => (c.platform || 'youtube') === 'youtube'), [saved]);
  const igSaved = useMemo(() => saved.filter(c => c.platform === 'instagram'), [saved]);

  const [ytFetched, setYtFetched] = useState<Record<string, any>>({});
  const [igFetched, setIgFetched] = useState<Record<string, any>>({});
  const [fetchingIds, setFetchingIds] = useState<Set<string>>(new Set());
  const [fetchErrors, setFetchErrors] = useState<Record<string, string>>({});

  const fetchAll = () => {
    const ids = [...ytSaved.map(c => c.id), ...igSaved.map(c => c.id)];
    if (!ids.length) return;
    setFetchingIds(new Set(ids));
    setFetchErrors({});

    const ytP = ytSaved.map(c =>
      fetch(`${API}/competitor-channel?id=${encodeURIComponent(c.input)}`)
        .then(r => r.json()).then(d => ({ id: c.id, d, ok: !d.error, platform: 'yt' }))
        .catch(e => ({ id: c.id, d: null, ok: false, error: e.message, platform: 'yt' }))
    );
    const igP = igSaved.map(c =>
      fetch(`${API}/instagram-competitor?username=${encodeURIComponent(c.input)}`)
        .then(r => r.json()).then(d => ({ id: c.id, d, ok: !d.error, platform: 'ig' }))
        .catch(e => ({ id: c.id, d: null, ok: false, error: e.message, platform: 'ig' }))
    );

    Promise.all([...ytP, ...igP]).then(results => {
      const yt: Record<string, any> = {};
      const ig: Record<string, any> = {};
      const errs: Record<string, string> = {};
      results.forEach((r: any) => {
        if (!r.ok || !r.d) { errs[r.id] = r.error || r.d?.error || 'Erro'; return; }
        if (r.platform === 'yt') yt[r.id] = r.d;
        else ig[r.id] = r.d;
      });
      setYtFetched(yt); setIgFetched(ig); setFetchErrors(errs);
      setFetchingIds(new Set());
    });
  };

  useEffect(() => { fetchAll(); }, []); // eslint-disable-line

  // ── User YouTube metrics ──────────────────────────────────
  const userYtSubs   = parseInt(youtubeStats?.subscriberCount || '0', 10);
  const userYtViews  = parseInt(youtubeStats?.viewCount || '0', 10);
  const userYtVideos = parseInt(youtubeStats?.videoCount || '0', 10);
  const myVids: VideoStat[] = myVideos || [];
  const myVidsValid = myVids.filter(v => v.views > 0);
  const myVids90 = myVids.filter(v => withinDays(v.publishedAt, NINETY_DAYS_MS));
  const myTopVideo = [...(myVids90.length ? myVids90 : myVids)].sort((a, b) => b.views - a.views)[0];

  const userYtCol: ColumnData = {
    id: '__me_yt__', title: 'Rodrigo Saracino', thumbnail: '', isMe: true, loading: false,
    topVideo: myTopVideo,
    subscribers:          userYtSubs,
    totalViews:           userYtViews,
    videoCount:           userYtVideos,
    avgViewsPerVideo:     userYtVideos > 0 ? Math.round(userYtViews / userYtVideos) : 0,
    avgEngagementRate:    myVidsValid.length ? parseFloat(avgArr(myVidsValid.map(v => v.engagementRate)).toFixed(2)) : undefined,
    avgLikesPerVideo:     myVidsValid.length ? Math.round(avgArr(myVidsValid.map(v => v.likes))) : undefined,
    avgCommentsPerVideo:  myVidsValid.length ? Math.round(avgArr(myVidsValid.map(v => v.comments))) : undefined,
    viewsPerSubscriber:   userYtSubs > 0 ? parseFloat((userYtViews / userYtSubs).toFixed(1)) : 0,
    publishFrequency:     myVids.length >= 2 ? calcFrequency(myVids) : undefined,
    avgDurationMin:       myVids.length ? parseFloat(avgArr(myVids.map(v => parseDurationMin(v.duration))).toFixed(1)) : undefined,
    consistencyRate:      myVidsValid.length ? calcConsistency(myVidsValid) : undefined,
  };

  // ── User Instagram metrics ────────────────────────────────
  const userIgFollowers = parseInt(igStats?.followers || '0', 10);
  const userIgPosts     = parseInt(igStats?.media_count || '0', 10);
  const igPostsList: any[] = myIgPosts || [];

  // Mesma fórmula dos concorrentes: (curtidas + comentários) / seguidores × 100 por post
  const userIgEngRate = useMemo(() => {
    if (!igPostsList.length || !userIgFollowers) return undefined;
    const rates = igPostsList.map(p => ((p.like_count + p.comments_count) / userIgFollowers) * 100);
    return parseFloat(avgArr(rates).toFixed(2));
  }, [igPostsList, userIgFollowers]);

  const userIgAvgLikes    = igPostsList.length ? Math.round(avgArr(igPostsList.map(p => p.like_count))) : undefined;
  const userIgAvgComments = igPostsList.length ? Math.round(avgArr(igPostsList.map(p => p.comments_count))) : undefined;
  const userIgAvgReach    = igPostsList.length ? Math.round(avgArr(igPostsList.map(p => p.insights?.reach || 0))) : undefined;
  const userIgAvgSaved    = igPostsList.length ? Math.round(avgArr(igPostsList.map(p => p.insights?.saved || 0))) : undefined;
  const userIgFrequency  = igPostsList.length >= 2
    ? calcFrequency(igPostsList.map(p => ({ publishedAt: p.timestamp })))
    : undefined;

  const igPosts90 = igPostsList.filter(p => withinDays(p.timestamp, NINETY_DAYS_MS));
  const userIgTopPost = (igPosts90.length ? igPosts90 : igPostsList).length
    ? [...(igPosts90.length ? igPosts90 : igPostsList)].sort((a, b) => (b.like_count + b.comments_count) - (a.like_count + a.comments_count))[0]
    : undefined;

  const userIgTopVideo: VideoStat | undefined = userIgTopPost ? {
    id: userIgTopPost.id,
    title: userIgTopPost.caption?.slice(0, 80) || '(Sem legenda)',
    publishedAt: userIgTopPost.timestamp,
    thumbnail: userIgTopPost.media_url || userIgTopPost.thumbnail_url || '',
    views: 0,
    likes: userIgTopPost.like_count,
    comments: userIgTopPost.comments_count,
    engagementRate: userIgFollowers > 0
      ? parseFloat(((userIgTopPost.like_count + userIgTopPost.comments_count) / userIgFollowers * 100).toFixed(2))
      : 0,
    duration: '',
    url: userIgTopPost.permalink,
  } : undefined;

  const userIgCol: ColumnData = {
    id: '__me_ig__', title: `@${igStats?.username || 'rodrigosaracino.mkt'}`, thumbnail: '', isMe: true, loading: false,
    topVideo:            userIgTopVideo,
    followers:           userIgFollowers,
    postCount:           userIgPosts,
    igEngagementRate:    userIgEngRate,
    avgReachPerPost:     userIgAvgReach,
    avgLikesPerPost:     userIgAvgLikes,
    avgCommentsPerPost:  userIgAvgComments,
    avgSavedPerPost:     userIgAvgSaved,
    igPublishFrequency:  userIgFrequency,
  };

  // ── Build column arrays ───────────────────────────────────
  const ytColumns: ColumnData[] = [
    userYtCol,
    ...ytSaved.map(c => {
      if (fetchingIds.has(c.id)) return { id: c.id, title: c.title, thumbnail: c.thumbnail, isMe: false, loading: true };
      if (fetchErrors[c.id])     return { id: c.id, title: c.title, thumbnail: c.thumbnail, isMe: false, loading: false, error: fetchErrors[c.id] };
      if (ytFetched[c.id])       return computeCompetitorYt(c, ytFetched[c.id]);
      return { id: c.id, title: c.title, thumbnail: c.thumbnail, isMe: false, loading: true };
    }),
  ];

  const igColumns: ColumnData[] = [
    userIgCol,
    ...igSaved.map(c => {
      if (fetchingIds.has(c.id)) return { id: c.id, title: c.title, thumbnail: c.thumbnail, isMe: false, loading: true };
      if (fetchErrors[c.id])     return { id: c.id, title: c.title, thumbnail: c.thumbnail, isMe: false, loading: false, error: fetchErrors[c.id] };
      if (igFetched[c.id])       return computeCompetitorIg(c, igFetched[c.id]);
      return { id: c.id, title: c.title, thumbnail: c.thumbnail, isMe: false, loading: true };
    }),
  ];

  const hasYt = ytSaved.length > 0;
  const hasIg = igSaved.length > 0;
  const isLoading = fetchingIds.size > 0;

  return (
    <div className="flex flex-col gap-8 pb-10">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 className="text-2xl font-bold mb-1" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Trophy size={22} style={{ color: '#FFD700' }} />
            Benchmark de Concorrentes
          </h1>
          <p className="text-muted">Compare eficiência de produção e qualidade de conteúdo com seus concorrentes.</p>
        </div>
        <button
          onClick={fetchAll}
          disabled={isLoading}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', padding: '0.45rem 0.9rem', borderRadius: 8, fontSize: '0.82rem', color: 'var(--text-secondary)', cursor: isLoading ? 'not-allowed' : 'pointer' }}
        >
          {isLoading ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
          {isLoading ? 'Carregando...' : 'Atualizar dados'}
        </button>
      </div>

      {/* Empty state */}
      {!hasYt && !hasIg && (
        <Card className="glass-panel">
          <CardContent style={{ padding: '3rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', textAlign: 'center' }}>
            <Users size={40} style={{ opacity: 0.2 }} />
            <p style={{ fontWeight: 600, fontSize: '1rem' }}>Nenhum concorrente cadastrado</p>
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
              Acesse a aba <strong style={{ color: 'var(--text-secondary)' }}>Concorrentes</strong> e adicione canais do YouTube ou perfis do Instagram.
            </p>
          </CardContent>
        </Card>
      )}

      {/* YouTube */}
      {hasYt && (
        <Card className="glass-panel">
          <CardContent style={{ padding: '1.5rem' }}>
            <CompareTable
              title="YouTube"
              icon={<span style={{ fontSize: '1.1rem' }}>▶️</span>}
              columns={ytColumns}
              metrics={YT_METRICS}
              platform="youtube"
            />
          </CardContent>
        </Card>
      )}

      {/* Instagram */}
      {hasIg && (
        <Card className="glass-panel">
          <CardContent style={{ padding: '1.5rem' }}>
            <CompareTable
              title="Instagram"
              icon={<span style={{ fontSize: '1.1rem' }}>📸</span>}
              columns={igColumns}
              metrics={IG_METRICS}
              platform="instagram"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
