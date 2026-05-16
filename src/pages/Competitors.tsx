import { useState, useCallback } from 'react';
import {
  Users, Plus, ExternalLink, ThumbsUp, MessageSquare,
  Eye, TrendingUp, RefreshCw, ChevronDown, ChevronUp,
  Globe, Play, Search, AlertCircle, Loader2, Zap, X, Sparkles,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { getToken } from './Login';

function authFetch(url: string, options: RequestInit = {}) {
  const token = getToken();
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

// ─── Types ────────────────────────────────────────────────────
interface ChannelInfo {
  id: string;
  title: string;
  description: string;
  customUrl: string;
  publishedAt: string;
  thumbnail: string;
  country: string;
  subscribers: number;
  totalViews: number;
  videoCount: number;
}

interface VideoItem {
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

interface CompetitorData {
  channel: ChannelInfo;
  videos: VideoItem[];
  fetchedAt: string;
}

interface SavedChannel {
  id: string;
  input: string;
  title: string;
  thumbnail: string;
  subscribers: number;
  addedAt: string;
  platform?: 'youtube' | 'instagram';
}

type SortKey = 'views' | 'likes' | 'engagementRate' | 'publishedAt';

// ─── Helpers ──────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL ?? '/api';
const STORAGE_KEY = 'partnerhub_competitors';

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString('pt-BR');
}

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1)   return 'hoje';
  if (days === 1) return 'ontem';
  if (days < 30)  return `${days}d atrás`;
  if (days < 365) return `${Math.floor(days / 30)}m atrás`;
  return `${Math.floor(days / 365)}a atrás`;
}

function parseDuration(iso: string): string {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return '';
  const h = parseInt(m[1] || '0', 10);
  const min = parseInt(m[2] || '0', 10);
  const s = parseInt(m[3] || '0', 10);
  if (h > 0) return `${h}:${String(min).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${min}:${String(s).padStart(2, '0')}`;
}

function loadSaved(): SavedChannel[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function saveSaved(list: SavedChannel[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

// ─── Sub-components ───────────────────────────────────────────

function VideoCard({ video, platform }: { video: VideoItem, platform: 'youtube' | 'instagram' }) {
  const engColor = video.engagementRate >= 5
    ? 'var(--success)'
    : video.engagementRate >= 2
    ? 'var(--warning)'
    : 'var(--text-secondary)';

  return (
    <a href={video.url} target="_blank" rel="noopener noreferrer" className="video-card" title={video.title}>
      <div className="video-thumb-wrap">
        <img src={video.thumbnail} alt={video.title} className="video-thumb" loading="lazy" />
        {platform === 'youtube' && video.duration && (
          <span className="video-duration">{parseDuration(video.duration)}</span>
        )}
        <div className="video-play-overlay">
          {(platform === 'youtube' || video.duration === 'VIDEO') && <Play size={28} fill="white" color="white" />}
        </div>
      </div>
      <div className="video-info">
        <p className="video-title">{video.title}</p>
        <p className="video-date text-xs text-muted">{relativeDate(video.publishedAt)}</p>
        <div className="video-stats">
          {platform === 'youtube' && (
            <span className="video-stat"><Eye size={13} />{fmt(video.views)}</span>
          )}
          <span className="video-stat"><ThumbsUp size={13} />{fmt(video.likes)}</span>
          <span className="video-stat"><MessageSquare size={13} />{fmt(video.comments)}</span>
          <span className="video-stat" style={{ color: engColor, marginLeft: 'auto' }}>
            <Zap size={13} />{video.engagementRate.toFixed(1)}%
          </span>
        </div>
      </div>
    </a>
  );
}

function ChannelRow({
  saved, isActive, onSelect, onRemove, isLoading,
}: {
  saved: SavedChannel;
  isActive: boolean;
  onSelect: () => void;
  onRemove: () => void;
  isLoading: boolean;
}) {
  return (
    <div className={`channel-row${isActive ? ' active' : ''}`} onClick={onSelect}>
      <img src={saved.thumbnail} alt={saved.title} className="channel-row-avatar" />
      <div className="channel-row-info">
        <span className="channel-row-name">{saved.title}</span>
        <span className="channel-row-subs text-xs text-muted">{fmt(saved.subscribers)} inscritos</span>
      </div>
      {isLoading && <Loader2 size={16} className="spin text-muted" style={{ marginLeft: 'auto' }} />}
      {!isLoading && isActive && <ChevronUp size={16} className="text-muted" style={{ marginLeft: 'auto' }} />}
      {!isLoading && !isActive && <ChevronDown size={16} className="text-muted" style={{ marginLeft: 'auto' }} />}
      <button
        className="channel-row-remove"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        title="Remover canal"
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export function Competitors() {
  const [savedChannels, setSavedChannels] = useState<SavedChannel[]>(loadSaved);
  const [input, setInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [platformTab, setPlatformTab] = useState<'youtube' | 'instagram'>('youtube');

  // Active channel data
  const [activeId, setActiveId] = useState<string | null>(null);
  const [channelData, setChannelData] = useState<Record<string, CompetitorData>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // AI State
  const [aiAnalyses, setAiAnalyses] = useState<Record<string, string>>({});
  const [analyzingIds, setAnalyzingIds] = useState<Record<string, boolean>>({});

  // Filters
  const [sortKey, setSortKey] = useState<SortKey>('views');
  const [searchFilter, setSearchFilter] = useState('');

  // ── Fetch channel data ──────────────────────────────────────
  const fetchChannel = useCallback(async (channelInput: string, platform: 'youtube' | 'instagram', channelId?: string) => {
    const lookupId = channelId || channelInput;
    setLoadingId(lookupId);
    setFetchError(null);
    try {
      const endpoint = platform === 'instagram' ? 'instagram-competitor?username=' : 'competitor-channel?id=';
      const resp = await authFetch(`${API_BASE}/${endpoint}${encodeURIComponent(channelInput)}`);
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Erro ao buscar canal');
      return data as CompetitorData;
    } catch (e: any) {
      throw e;
    } finally {
      setLoadingId(null);
    }
  }, []);

  // ── Add channel ─────────────────────────────────────────────
  const handleAdd = async () => {
    if (!input.trim()) return;
    setAdding(true);
    setAddError('');
    try {
      const data = await fetchChannel(input.trim(), platformTab);
      const { channel } = data;

      // Check duplicate
      if (savedChannels.some(c => c.id === channel.id && (c.platform || 'youtube') === platformTab)) {
        setAddError('Esse concorrente já foi adicionado.');
        return;
      }

      const newEntry: SavedChannel = {
        id: channel.id,
        input: input.trim(),
        title: channel.title,
        thumbnail: channel.thumbnail,
        subscribers: channel.subscribers,
        addedAt: new Date().toISOString(),
        platform: platformTab,
      };

      const updated = [...savedChannels, newEntry];
      setSavedChannels(updated);
      saveSaved(updated);

      // Cache data and activate
      setChannelData(prev => ({ ...prev, [channel.id]: data }));
      setActiveId(channel.id);
      setInput('');
    } catch (e: any) {
      setAddError(e.message || 'Não foi possível encontrar o canal.');
    } finally {
      setAdding(false);
    }
  };

  // ── Analyze with AI ─────────────────────────────────────────
  const handleAnalyze = async (id: string) => {
    const data = channelData[id];
    if (!data) return;
    setAnalyzingIds(prev => ({ ...prev, [id]: true }));
    try {
      const resp = await authFetch(`${API_BASE}/analyze-competitor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: platformTab,
          channelName: data.channel.title,
          videos: data.videos
        })
      });
      const resData = await resp.json();
      if (!resp.ok) throw new Error(resData.error || 'Erro na análise');
      setAiAnalyses(prev => ({ ...prev, [id]: resData.analysis }));
    } catch (e: any) {
      alert(e.message);
    } finally {
      setAnalyzingIds(prev => ({ ...prev, [id]: false }));
    }
  };

  // ── Select / toggle channel ──────────────────────────────────
  const handleSelect = async (saved: SavedChannel) => {
    if (activeId === saved.id) {
      setActiveId(null);
      return;
    }
    setActiveId(saved.id);
    setFetchError(null);
    if (channelData[saved.id]) return; // already cached

    try {
      const data = await fetchChannel(saved.input, saved.platform || 'youtube', saved.id);
      setChannelData(prev => ({ ...prev, [saved.id]: data }));
      // Update subscribers in saved list
      setSavedChannels(prev => {
        const next = prev.map(c => c.id === saved.id ? { ...c, subscribers: data.channel.subscribers, thumbnail: data.channel.thumbnail } : c);
        saveSaved(next);
        return next;
      });
    } catch (e: any) {
      setFetchError(e.message);
    }
  };

  // ── Refresh ─────────────────────────────────────────────────
  const handleRefresh = async () => {
    if (!activeId) return;
    const saved = savedChannels.find(c => c.id === activeId);
    if (!saved) return;
    setFetchError(null);
    try {
      const data = await fetchChannel(saved.input, saved.platform || 'youtube', saved.id);
      setChannelData(prev => ({ ...prev, [saved.id]: data }));
    } catch (e: any) {
      setFetchError(e.message);
    }
  };

  // ── Remove channel ───────────────────────────────────────────
  const handleRemove = (id: string) => {
    const updated = savedChannels.filter(c => c.id !== id);
    setSavedChannels(updated);
    saveSaved(updated);
    if (activeId === id) setActiveId(null);
    setChannelData(prev => { const next = { ...prev }; delete next[id]; return next; });
  };

  // ── Derived videos ───────────────────────────────────────────
  const activeData = activeId ? channelData[activeId] : null;
  const filteredVideos = activeData
    ? activeData.videos
        .filter(v => !searchFilter || v.title.toLowerCase().includes(searchFilter.toLowerCase()))
        .sort((a, b) => {
          if (sortKey === 'publishedAt') return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
          return b[sortKey] - a[sortKey];
        })
    : [];

  const isLoadingActive = activeId ? loadingId === activeId : false;

  return (
    <div className="competitors-page animate-fade-in">
      {/* ── Header ── */}
      <div className="page-header mb-6">
        <div className="flex items-center justify-between gap-3" style={{ flexWrap: 'wrap' }}>
          <div className="flex items-center gap-3">
            <div className="comp-header-icon" style={{ background: platformTab === 'instagram' ? 'linear-gradient(135deg, #E1306C 0%, #833AB4 100%)' : undefined, boxShadow: platformTab === 'instagram' ? '0 4px 20px rgba(225,48,108,0.35)' : undefined }}>
              <Users size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Análise de Concorrentes</h1>
              <p className="text-sm text-muted mt-1">Monitore os melhores conteúdos dos seus concorrentes no {platformTab === 'youtube' ? 'YouTube' : 'Instagram'}</p>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', padding: '0.25rem', borderRadius: '0.5rem' }}>
            <button 
              onClick={() => { setPlatformTab('youtube'); setActiveId(null); setInput(''); setAddError(''); }}
              style={{ padding: '0.5rem 1rem', borderRadius: '0.375rem', fontSize: '0.875rem', fontWeight: 600, background: platformTab === 'youtube' ? 'var(--bg-glass)' : 'transparent', color: platformTab === 'youtube' ? 'white' : 'var(--text-secondary)' }}
            >
              YouTube
            </button>
            <button 
              onClick={() => { setPlatformTab('instagram'); setActiveId(null); setInput(''); setAddError(''); }}
              style={{ padding: '0.5rem 1rem', borderRadius: '0.375rem', fontSize: '0.875rem', fontWeight: 600, background: platformTab === 'instagram' ? 'var(--bg-glass)' : 'transparent', color: platformTab === 'instagram' ? 'white' : 'var(--text-secondary)' }}
            >
              Instagram
            </button>
          </div>
        </div>
      </div>

      {/* ── Add Channel Input ── */}
      <div className="glass-panel p-4 mb-6">
        <label className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ display: 'block' }}>
          <Plus size={15} />
          Adicionar canal concorrente
        </label>
        <div className="comp-add-row">
          <div className="comp-input-wrap">
            <Globe size={16} className="comp-input-icon" />
            <input
              type="text"
              className="comp-input"
              placeholder={platformTab === 'youtube' ? 'Cole a URL, @handle ou Channel ID do YouTube...' : 'Cole o @username do Instagram...'}
              value={input}
              onChange={e => { setInput(e.target.value); setAddError(''); }}
              onKeyDown={e => e.key === 'Enter' && !adding && handleAdd()}
              disabled={adding}
            />
          </div>
          <button
            className="comp-add-btn"
            onClick={handleAdd}
            disabled={adding || !input.trim()}
          >
            {adding ? <Loader2 size={16} className="spin" /> : <Plus size={16} />}
            {adding ? 'Buscando...' : 'Adicionar'}
          </button>
        </div>
        {addError && (
          <p className="comp-error">
            <AlertCircle size={14} />
            {addError}
          </p>
        )}
        <p className="text-xs text-muted mt-2">
          {platformTab === 'youtube' ? (
            <>Exemplos: <code>youtube.com/@MrBeast</code> · <code>@mkbhd</code> · <code>UCxxxxxx</code></>
          ) : (
            <>Exemplos: <code>@mrbeast</code> · <code>thiagofinch</code></>
          )}
        </p>
      </div>

      {/* ── Saved Channels List ── */}
      {savedChannels.filter(c => (c.platform || 'youtube') === platformTab).length === 0 ? (
        <div className="comp-empty">
          <Users size={40} style={{ opacity: 0.3 }} />
          <p className="font-semibold mt-3">Nenhum concorrente adicionado</p>
          <p className="text-sm text-muted mt-1">Adicione o primeiro {platformTab === 'youtube' ? 'canal' : 'perfil'} acima para começar a análise</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {savedChannels.filter(c => (c.platform || 'youtube') === platformTab).map(saved => (
            <div key={saved.id}>
              <ChannelRow
                saved={saved}
                isActive={activeId === saved.id}
                isLoading={loadingId === saved.id}
                onSelect={() => handleSelect(saved)}
                onRemove={() => handleRemove(saved.id)}
              />

              {/* ── Expanded channel content ── */}
              {activeId === saved.id && (
                <div className="comp-channel-content">
                  {/* Loading state */}
                  {isLoadingActive && (
                    <div className="comp-loading">
                      <Loader2 size={28} className="spin" />
                      <p className="text-muted mt-3">Buscando dados do canal...</p>
                    </div>
                  )}

                  {/* Error state */}
                  {!isLoadingActive && fetchError && (
                    <div className="comp-fetch-error">
                      <AlertCircle size={20} />
                      <p>{fetchError}</p>
                      <button className="comp-retry-btn" onClick={handleRefresh}>Tentar novamente</button>
                    </div>
                  )}

                  {/* Data */}
                  {!isLoadingActive && !fetchError && activeData && (
                    <>
                      {/* Channel Stats Bar */}
                      <div className="comp-channel-bar">
                        <div className="flex items-center gap-3">
                          <img src={activeData.channel.thumbnail} alt={activeData.channel.title} className="comp-bar-avatar" />
                          <div>
                            <p className="font-semibold">{activeData.channel.title}</p>
                            <p className="text-xs text-muted">{activeData.channel.customUrl || activeData.channel.id}</p>
                          </div>
                          <a
                            href={`https://youtube.com/${activeData.channel.customUrl || '/channel/' + activeData.channel.id}`}
                            target="_blank" rel="noopener noreferrer"
                            className="comp-ext-link"
                            onClick={e => e.stopPropagation()}
                          >
                            <ExternalLink size={14} />
                          </a>
                        </div>

                        <div className="comp-bar-stats">
                          <div className="comp-bar-stat">
                            <Users size={14} />
                            <span>{fmt(activeData.channel.subscribers)}</span>
                            <span className="text-xs text-muted">{platformTab === 'youtube' ? 'inscritos' : 'seguidores'}</span>
                          </div>
                          {platformTab === 'youtube' && (
                            <div className="comp-bar-stat">
                              <Eye size={14} />
                              <span>{fmt(activeData.channel.totalViews)}</span>
                              <span className="text-xs text-muted">views totais</span>
                            </div>
                          )}
                          <div className="comp-bar-stat">
                            <Play size={14} />
                            <span>{fmt(activeData.channel.videoCount)}</span>
                            <span className="text-xs text-muted">{platformTab === 'youtube' ? 'vídeos' : 'posts'}</span>
                          </div>
                          {platformTab === 'youtube' && (
                            <div className="comp-bar-stat">
                              <TrendingUp size={14} />
                              <span>{activeData.videos.length > 0 ? fmt(Math.round(activeData.videos.reduce((s: number, v: any) => s + v.views, 0) / activeData.videos.length)) : '—'}</span>
                              <span className="text-xs text-muted">média views/vídeo</span>
                            </div>
                          )}
                        </div>

                        <button className="comp-refresh-btn" onClick={(e) => { e.stopPropagation(); handleRefresh(); }} title="Atualizar dados">
                          <RefreshCw size={15} />
                        </button>
                      </div>

                      {/* AI Analysis Section */}
                      <div className="glass-panel" style={{ margin: '1rem 0', padding: '1.25rem', border: '1px solid rgba(168, 85, 247, 0.4)', background: 'rgba(168, 85, 247, 0.05)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: aiAnalyses[saved.id] ? '1rem' : '0' }}>
                          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', fontWeight: 600, color: '#c084fc' }}>
                            <Sparkles size={18} /> Inteligência Artificial (Google Gemini)
                          </h3>
                          {!aiAnalyses[saved.id] && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleAnalyze(saved.id); }}
                              disabled={analyzingIds[saved.id]}
                              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#9333ea', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.375rem', fontSize: '0.875rem', fontWeight: 600, border: 'none', cursor: analyzingIds[saved.id] ? 'not-allowed' : 'pointer' }}
                            >
                              {analyzingIds[saved.id] ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
                              {analyzingIds[saved.id] ? 'Analisando...' : 'Analisar Padrões'}
                            </button>
                          )}
                        </div>
                        {aiAnalyses[saved.id] && (
                          <div style={{ fontSize: '0.9rem', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
                            <ReactMarkdown>{aiAnalyses[saved.id]}</ReactMarkdown>
                          </div>
                        )}
                      </div>

                      {/* Filters */}
                      <div className="comp-filters">
                        <div className="comp-search-wrap">
                          <Search size={14} className="comp-search-icon" />
                          <input
                            type="text"
                            className="comp-search"
                            placeholder="Filtrar por título..."
                            value={searchFilter}
                            onChange={e => setSearchFilter(e.target.value)}
                            onClick={e => e.stopPropagation()}
                          />
                          {searchFilter && (
                            <button className="comp-search-clear" onClick={(e) => { e.stopPropagation(); setSearchFilter(''); }}>
                              <X size={12} />
                            </button>
                          )}
                        </div>

                        <div className="comp-sort-tabs">
                          {([
                            ['views', 'Mais vistos'],
                            ['likes', 'Mais curtidos'],
                            ['engagementRate', 'Engajamento'],
                            ['publishedAt', 'Mais recentes'],
                          ] as [SortKey, string][]).map(([key, label]) => (
                            <button
                              key={key}
                              className={`comp-sort-tab${sortKey === key ? ' active' : ''}`}
                              onClick={(e) => { e.stopPropagation(); setSortKey(key); }}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Videos Grid */}
                      {filteredVideos.length === 0 ? (
                        <p className="text-center text-muted p-6">Nenhum {platformTab === 'youtube' ? 'vídeo' : 'post'} encontrado com esse filtro.</p>
                      ) : (
                        <div className="comp-videos-grid">
                          {filteredVideos.map((video: any) => (
                            <VideoCard key={video.id} video={video} platform={platformTab} />
                          ))}
                        </div>
                      )}

                      <p className="text-xs text-muted text-right" style={{ paddingTop: '0.5rem' }}>
                        Atualizado {relativeDate(activeData.fetchedAt)} · cache de 1h
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
