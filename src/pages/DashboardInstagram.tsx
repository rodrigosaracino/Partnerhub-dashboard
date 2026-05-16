import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '../components/Card';
import { Badge } from '../components/Badge';
import { KpiCard } from '../components/KpiCard';
import { API, fmt, TOOLTIP_STYLE } from '../utils/format';
import { DateRangeFilter, filterByRange, filterByRangeDate, type DateRange } from '../components/DateRangeFilter';
import {
  Eye, Heart, UserPlus, Users, Camera, BarChart3, TrendingUp,
  MessageCircle, Star, Play, Bookmark, ArrowUpDown, RefreshCw,
  Tag, Plus, X, Mic, Loader2, ChevronDown, ChevronUp, ExternalLink,
  Pencil, Trash2, Check, Settings2, LayoutGrid, Award,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, ReferenceLine,
} from 'recharts';
import { getToken } from './Login';

function authFetch(url: string, options: RequestInit = {}) {
  const token = getToken();
  return fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
}

// ─── Types ────────────────────────────────────────────────────
interface IgTag {
  name: string;
  color: string;
  created_at: string;
  usage: number;
}

interface IgPost {
  id: string;
  caption: string | null;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  media_url: string | null;
  thumbnail_url: string | null;
  permalink: string | null;
  posted_at: string | null;
  like_count: number;
  comments_count: number;
  reach: number;
  impressions: number;
  saved: number;
  video_views: number;
  tags: string[];
  transcript: string | null;
  synced_at: string;
  updated_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────
const COLOR_PALETTE = [
  '#E1306C', '#818CF8', '#10B981', '#F59E0B',
  '#3B82F6', '#A78BFA', '#EC4899', '#14B8A6',
  '#F97316', '#06B6D4', '#84CC16', '#EF4444',
];

function initRange(): DateRange {
  const d = new Date();
  const to = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const from = `${d.getFullYear()}-01`;
  return { from, to };
}

function relativeDate(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return 'hoje';
  if (days === 1) return 'ontem';
  if (days < 30) return `${days}d atrás`;
  if (days < 365) return `${Math.floor(days / 30)}m atrás`;
  return `${Math.floor(days / 365)}a atrás`;
}

function calcEr(post: IgPost): number {
  const reach = post.reach || post.impressions || 0;
  if (!reach) return 0;
  return ((post.like_count + post.comments_count) / reach) * 100;
}

function erColor(er: number) {
  if (er >= 5) return '#10B981';
  if (er >= 2) return '#F59E0B';
  return '#E1306C';
}

// Look up color from registry; fallback to palette hash
function resolveColor(name: string, registry: IgTag[]): string {
  const found = registry.find(t => t.name === name);
  if (found) return found.color;
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return COLOR_PALETTE[h % COLOR_PALETTE.length];
}

type SortKey = 'recent' | 'reach' | 'likes' | 'comments' | 'engagement';

const SORT_OPTIONS: { key: SortKey; label: string; icon: ReactNode }[] = [
  { key: 'recent',     label: 'Recentes',      icon: <ArrowUpDown size={12} /> },
  { key: 'reach',      label: 'Visualizações', icon: <Eye size={12} /> },
  { key: 'likes',      label: 'Curtidas',      icon: <Heart size={12} /> },
  { key: 'comments',   label: 'Comentários',   icon: <MessageCircle size={12} /> },
  { key: 'engagement', label: 'Engajamento',   icon: <BarChart3 size={12} /> },
];

function sortPosts(posts: IgPost[], key: SortKey): IgPost[] {
  const s = [...posts];
  switch (key) {
    case 'reach':      return s.sort((a, b) => (b.reach || b.impressions || 0) - (a.reach || a.impressions || 0));
    case 'likes':      return s.sort((a, b) => b.like_count - a.like_count);
    case 'comments':   return s.sort((a, b) => b.comments_count - a.comments_count);
    case 'engagement': return s.sort((a, b) => calcEr(b) - calcEr(a));
    default:           return s.sort((a, b) => new Date(b.posted_at || 0).getTime() - new Date(a.posted_at || 0).getTime());
  }
}

// ─── Tag Pill ─────────────────────────────────────────────────
function TagPill({
  label, color, onRemove, small, onClick,
}: {
  label: string; color: string; onRemove?: () => void;
  small?: boolean; onClick?: () => void;
}) {
  return (
    <span
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
        padding: small ? '0.1rem 0.4rem' : '0.15rem 0.5rem',
        borderRadius: '999px',
        background: `${color}22`,
        border: `1px solid ${color}55`,
        color,
        fontSize: small ? '0.62rem' : '0.7rem',
        fontWeight: 600,
        whiteSpace: 'nowrap' as const,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {label}
      {onRemove && (
        <button onClick={e => { e.stopPropagation(); onRemove(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color, padding: 0, display: 'flex', lineHeight: 1 }}>
          <X size={10} />
        </button>
      )}
    </span>
  );
}

// ─── Color Picker ─────────────────────────────────────────────
function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
      {COLOR_PALETTE.map(c => (
        <button
          key={c}
          onClick={() => onChange(c)}
          style={{
            width: 22, height: 22, borderRadius: '50%', background: c, border: 'none',
            cursor: 'pointer', outline: value === c ? `2px solid white` : 'none',
            outlineOffset: 2, transition: 'transform 0.1s',
            transform: value === c ? 'scale(1.2)' : 'scale(1)',
          }}
        />
      ))}
    </div>
  );
}

// ─── Tag Manager Modal ────────────────────────────────────────
function TagManager({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const { data: tagsRaw, mutate } = useSWR(`${API}/ig-tags`);
  const tags: IgTag[] = tagsRaw || [];

  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(COLOR_PALETTE[0]);
  const [creating, setCreating] = useState(false);

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await authFetch(`${API}/ig-tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), color: newColor }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setNewName('');
      await mutate();
      onChanged();
    } catch (e: any) { alert(e.message); }
    setCreating(false);
  };

  const startEdit = (tag: IgTag) => {
    setEditId(tag.name);
    setEditName(tag.name);
    setEditColor(tag.color);
  };

  const handleSaveEdit = async () => {
    if (!editId) return;
    setSaving(true);
    try {
      const res = await authFetch(`${API}/ig-tags/${encodeURIComponent(editId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim() || editId, color: editColor }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setEditId(null);
      await mutate();
      onChanged();
    } catch (e: any) { alert(e.message); }
    setSaving(false);
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Excluir a etiqueta "${name}"? Ela será removida de todos os posts.`)) return;
    setDeleting(name);
    try {
      const res = await authFetch(`${API}/ig-tags/${encodeURIComponent(name)}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      await mutate();
      onChanged();
    } catch (e: any) { alert(e.message); }
    setDeleting(null);
  };

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={onClose}
    >
      <div
        style={{ backgroundColor: '#0f0f11', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '1.25rem', width: '100%', maxWidth: '540px', maxHeight: '85vh', overflowY: 'auto', padding: '1.75rem', position: 'relative', boxShadow: '0 30px 80px rgba(0,0,0,0.8)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem', fontWeight: 700 }}>
            <Tag size={18} style={{ color: '#E1306C' }} /> Gerenciar Etiquetas
          </h2>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.5rem', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0.375rem', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        {/* Create new */}
        <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '0.75rem', marginBottom: '1.5rem' }}>
          <p style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '0.75rem' }}>
            Nova Etiqueta
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="Nome da etiqueta..."
              style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem', color: 'var(--text-primary)', fontSize: '0.875rem', padding: '0.5rem 0.75rem', outline: 'none' }}
            />
            <button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', background: newColor, color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: 600, cursor: creating || !newName.trim() ? 'not-allowed' : 'pointer', opacity: creating || !newName.trim() ? 0.5 : 1, whiteSpace: 'nowrap' }}
            >
              {creating ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={14} />}
              Criar
            </button>
          </div>
          <ColorPicker value={newColor} onChange={setNewColor} />
          {newName.trim() && (
            <div style={{ marginTop: '0.75rem' }}>
              <TagPill label={newName.trim().toLowerCase().replace(/\s+/g, '-')} color={newColor} />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>pré-visualização</span>
            </div>
          )}
        </div>

        {/* Tags list */}
        <p style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '0.75rem' }}>
          Etiquetas cadastradas ({tags.length})
        </p>

        {tags.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', textAlign: 'center', padding: '1.5rem 0' }}>
            Nenhuma etiqueta cadastrada ainda.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {tags.map(tag => (
              <div key={tag.name} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '0.625rem', padding: '0.75rem 1rem' }}>
                {editId === tag.name ? (
                  // Edit mode
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSaveEdit()}
                        style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '0.375rem', color: 'var(--text-primary)', fontSize: '0.85rem', padding: '0.4rem 0.625rem', outline: 'none' }}
                      />
                      <button
                        onClick={handleSaveEdit}
                        disabled={saving}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: '#10B981', color: '#fff', border: 'none', borderRadius: '0.375rem', padding: '0.4rem 0.75rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                      >
                        {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={13} />}
                        Salvar
                      </button>
                      <button
                        onClick={() => setEditId(null)}
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.375rem', padding: '0.4rem 0.625rem', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}
                      >
                        <X size={13} />
                      </button>
                    </div>
                    <ColorPicker value={editColor} onChange={setEditColor} />
                  </div>
                ) : (
                  // View mode
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <TagPill label={tag.name} color={tag.color} />
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginRight: 'auto' }}>
                      {tag.usage} post{tag.usage !== 1 ? 's' : ''}
                    </span>
                    <button
                      onClick={() => startEdit(tag)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0.25rem', display: 'flex', borderRadius: '0.25rem' }}
                      title="Editar"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(tag.name)}
                      disabled={deleting === tag.name}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: deleting === tag.name ? 'var(--text-secondary)' : '#EF4444', padding: '0.25rem', display: 'flex', borderRadius: '0.25rem' }}
                      title="Excluir"
                    >
                      {deleting === tag.name ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={14} />}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ─── Post Card ────────────────────────────────────────────────
function IgPostCard({ post, registry, onClick }: { post: IgPost; registry: IgTag[]; onClick: () => void }) {
  const er = calcEr(post);
  const color = erColor(er);
  const reach = post.reach || post.impressions || 0;
  const thumb = post.media_type === 'VIDEO' ? (post.thumbnail_url || post.media_url) : post.media_url;

  return (
    <div className="video-card" style={{ cursor: 'pointer' }} onClick={onClick}>
      <div className="video-thumb-wrap">
        {thumb ? (
          <img src={thumb} alt="post" className="video-thumb" loading="lazy" />
        ) : (
          <div className="video-thumb" style={{ background: '#1a1a1e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Camera size={32} style={{ opacity: 0.3 }} />
          </div>
        )}
        <div className="video-play-overlay">
          {post.media_type === 'VIDEO' && <Play size={28} fill="white" color="white" />}
        </div>
        <div style={{ position: 'absolute', top: '0.4rem', left: '0.4rem', display: 'flex', gap: '0.25rem' }}>
          <span style={{ background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: '0.6rem', fontWeight: 700, padding: '0.15rem 0.35rem', borderRadius: '4px' }}>
            {post.media_type === 'VIDEO' ? 'Vídeo' : post.media_type === 'CAROUSEL_ALBUM' ? 'Carrossel' : 'Foto'}
          </span>
          {post.transcript && (
            <span style={{ background: 'rgba(99,102,241,0.8)', color: '#fff', fontSize: '0.6rem', fontWeight: 700, padding: '0.15rem 0.35rem', borderRadius: '4px' }}>
              <Mic size={8} style={{ display: 'inline', marginRight: 2 }} />Transcrito
            </span>
          )}
        </div>
      </div>

      <div className="video-info">
        <p className="video-title">{post.caption || '(Sem legenda)'}</p>
        <p className="video-date text-xs text-muted">{relativeDate(post.posted_at)}</p>

        <div className="video-stats">
          <span className="video-stat"><Heart size={12} color="#E1306C" />{fmt(post.like_count)}</span>
          <span className="video-stat"><MessageCircle size={12} color="#818CF8" />{fmt(post.comments_count)}</span>
          {reach > 0 && <span className="video-stat"><Eye size={12} color="#A78BFA" />{fmt(reach)}</span>}
          {post.saved > 0 && <span className="video-stat"><Bookmark size={12} color="#F59E0B" />{fmt(post.saved)}</span>}
          {reach > 0 && (
            <span className="video-stat" style={{ color, marginLeft: 'auto' }}>
              <BarChart3 size={12} />{er.toFixed(1)}%
            </span>
          )}
        </div>

        {post.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.5rem' }}>
            {post.tags.slice(0, 3).map(t => (
              <TagPill key={t} label={t} color={resolveColor(t, registry)} small />
            ))}
            {post.tags.length > 3 && (
              <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary)' }}>+{post.tags.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Post Modal ───────────────────────────────────────────────
function IgPostModal({ post: initialPost, registry, onClose, onTagsChanged }: {
  post: IgPost;
  registry: IgTag[];
  onClose: () => void;
  onTagsChanged: (id: string, tags: string[]) => void;
}) {
  const [post, setPost] = useState<IgPost>(initialPost);
  const [savingTags, setSavingTags] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(!!post.transcript);
  const [showNewTag, setShowNewTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(COLOR_PALETTE[0]);
  const [creatingTag, setCreatingTag] = useState(false);

  const er = calcEr(post);
  const color = erColor(er);
  const reach = post.reach || post.impressions || 0;
  const thumb = post.media_type === 'VIDEO' ? (post.thumbnail_url || post.media_url) : post.media_url;

  const saveTags = async (tags: string[]) => {
    setSavingTags(true);
    try {
      await authFetch(`${API}/instagram-posts/${post.id}/tags`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags }),
      });
      const updated = { ...post, tags };
      setPost(updated);
      onTagsChanged(post.id, tags);
    } catch {}
    setSavingTags(false);
  };

  const toggleTag = (name: string) => {
    const has = post.tags.includes(name);
    saveTags(has ? post.tags.filter(t => t !== name) : [...post.tags, name]);
  };

  const handleCreateAndAdd = async () => {
    if (!newTagName.trim()) return;
    setCreatingTag(true);
    const slug = newTagName.trim().toLowerCase().replace(/\s+/g, '-');
    try {
      // Create tag in registry
      await authFetch(`${API}/ig-tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: slug, color: newTagColor }),
      });
      // Add to post if not already there
      if (!post.tags.includes(slug)) await saveTags([...post.tags, slug]);
      setNewTagName('');
      setShowNewTag(false);
      onTagsChanged(post.id, post.tags.includes(slug) ? post.tags : [...post.tags, slug]);
    } catch (e: any) { alert(e.message); }
    setCreatingTag(false);
  };

  const handleTranscribe = async () => {
    setTranscribing(true);
    try {
      const res = await authFetch(`${API}/instagram-posts/${post.id}/transcribe`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro na transcrição');
      setPost(p => ({ ...p, transcript: data.transcript }));
      setTranscriptOpen(true);
    } catch (e: any) { alert(e.message); }
    setTranscribing(false);
  };

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={onClose}
    >
      <div
        className="video-modal-panel"
        style={{ backgroundColor: '#0f0f11', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '1.25rem', width: '100%', maxWidth: '860px', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 30px 80px rgba(0,0,0,0.8)', position: 'relative', padding: '1.75rem' }}
        onClick={e => e.stopPropagation()}
      >
        <button
          style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.5rem', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0.375rem', display: 'flex' }}
          onClick={onClose}
        >
          <X size={18} />
        </button>

        {/* Left: thumbnail */}
        <div className="video-modal-left">
          <div style={{ position: 'relative', borderRadius: '0.875rem', overflow: 'hidden', background: '#1a1a1e', aspectRatio: '1/1', border: '1px solid rgba(255,255,255,0.08)' }}>
            {thumb ? (
              <img src={thumb} alt="post" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Camera size={40} style={{ opacity: 0.3 }} />
              </div>
            )}
            {post.media_type === 'VIDEO' && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)' }}>
                <Play size={40} fill="white" color="white" />
              </div>
            )}
          </div>
          {post.permalink && (
            <a
              href={post.permalink}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.625rem 1rem', borderRadius: '0.625rem', fontSize: '0.85rem', textDecoration: 'none', fontWeight: 600, background: 'rgba(225,48,108,0.12)', border: '1px solid rgba(225,48,108,0.3)', color: '#f472b6' }}
              onClick={e => e.stopPropagation()}
            >
              <ExternalLink size={14} /> Ver no Instagram
            </a>
          )}
        </div>

        {/* Right */}
        <div className="video-modal-right">
          {/* Caption + date */}
          <div>
            <p style={{ fontSize: '0.85rem', lineHeight: 1.6, marginBottom: '0.4rem' }}>
              {post.caption || '(Sem legenda)'}
            </p>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              {post.posted_at
                ? new Date(post.posted_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
                : '—'}
              {' · '}{relativeDate(post.posted_at)}
            </p>
          </div>

          <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} />

          {/* Metrics */}
          <div>
            <p style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '0.75rem' }}>
              Métricas
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
              <StatBox icon={<Eye size={14} />}           label="Alcance"     value={fmt(reach)}              color="#A78BFA" />
              <StatBox icon={<Heart size={14} />}         label="Curtidas"    value={fmt(post.like_count)}    color="#E1306C" />
              <StatBox icon={<MessageCircle size={14} />} label="Comentários" value={fmt(post.comments_count)} color="#818CF8" />
              <StatBox icon={<Bookmark size={14} />}      label="Salvamentos" value={fmt(post.saved)}         color="#F59E0B" />
              {post.video_views > 0 && (
                <StatBox icon={<Play size={14} />}        label="Visualiz."   value={fmt(post.video_views)}   color="#3B82F6" />
              )}
              {reach > 0 && (
                <StatBox icon={<BarChart3 size={14} />}   label="Engajamento" value={`${er.toFixed(1)}%`}    color={color} />
              )}
            </div>
          </div>

          <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} />

          {/* Tags picker */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.625rem' }}>
              <p style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-secondary)', fontWeight: 700 }}>
                Etiquetas {savingTags && <Loader2 size={10} style={{ display: 'inline', animation: 'spin 1s linear infinite', marginLeft: 4 }} />}
              </p>
              <button
                onClick={() => { setShowNewTag(v => !v); setNewTagName(''); }}
                style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.72rem' }}
              >
                <Plus size={12} /> Nova etiqueta
              </button>
            </div>

            {/* Registered tags — toggle list */}
            {registry.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '0.625rem' }}>
                {registry.map(tag => {
                  const active = post.tags.includes(tag.name);
                  return (
                    <button
                      key={tag.name}
                      onClick={() => toggleTag(tag.name)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                        padding: '0.2rem 0.6rem', borderRadius: '999px',
                        background: active ? `${tag.color}28` : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${active ? tag.color + '80' : 'rgba(255,255,255,0.1)'}`,
                        color: active ? tag.color : 'var(--text-secondary)',
                        fontSize: '0.72rem', fontWeight: active ? 700 : 400,
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}
                    >
                      {active && <Check size={10} />}
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: '0.5rem' }}>
                Nenhuma etiqueta cadastrada. Use "Nova etiqueta" para criar.
              </p>
            )}

            {/* Inline create */}
            {showNewTag && (
              <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.625rem' }}>
                <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '0.625rem' }}>
                  <input
                    autoFocus
                    value={newTagName}
                    onChange={e => setNewTagName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCreateAndAdd()}
                    placeholder="Nome da nova etiqueta..."
                    style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.375rem', color: 'var(--text-primary)', fontSize: '0.8rem', padding: '0.35rem 0.625rem', outline: 'none' }}
                  />
                  <button
                    onClick={handleCreateAndAdd}
                    disabled={creatingTag || !newTagName.trim()}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: newTagColor, color: '#fff', border: 'none', borderRadius: '0.375rem', padding: '0.35rem 0.75rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', opacity: creatingTag || !newTagName.trim() ? 0.5 : 1 }}
                  >
                    {creatingTag ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={12} />}
                    Criar e adicionar
                  </button>
                </div>
                <ColorPicker value={newTagColor} onChange={setNewTagColor} />
              </div>
            )}
          </div>

          {/* Transcription */}
          {post.media_type === 'VIDEO' && (
            <>
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: post.transcript ? '0.5rem' : 0 }}>
                  <p style={{ fontSize: '0.6rem', textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: 'var(--text-secondary)', fontWeight: 700 }}>Transcrição</p>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {post.transcript && (
                      <button onClick={() => setTranscriptOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.75rem' }}>
                        {transcriptOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        {transcriptOpen ? 'Recolher' : 'Expandir'}
                      </button>
                    )}
                    {!post.transcript && (
                      <button
                        onClick={handleTranscribe}
                        disabled={transcribing}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: '0.375rem', color: '#818cf8', fontSize: '0.8rem', fontWeight: 600, padding: '0.3rem 0.75rem', cursor: transcribing ? 'not-allowed' : 'pointer', opacity: transcribing ? 0.7 : 1 }}
                      >
                        {transcribing ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Mic size={13} />}
                        {transcribing ? 'Transcrevendo...' : 'Transcrever com Gemini'}
                      </button>
                    )}
                    {post.transcript && !transcribing && (
                      <button onClick={handleTranscribe} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.7rem' }}>
                        <Mic size={12} /> Refazer
                      </button>
                    )}
                  </div>
                </div>
                {post.transcript && transcriptOpen && (
                  <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '0.625rem', border: '1px solid rgba(255,255,255,0.06)', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.7, maxHeight: '200px', overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                    {post.transcript}
                  </div>
                )}
                {post.transcript && !transcriptOpen && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>Transcrição disponível — clique em Expandir para ver.</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function StatBox({ icon, label, value, color }: { icon: ReactNode; label: string; value: string; color: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', padding: '0.625rem 0.75rem', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <div style={{ color, opacity: 0.9 }}>{icon}</div>
      <div>
        <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
        <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>{value}</div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export function DashboardInstagram() {
  const [range, setRange] = useState<DateRange>(initRange());
  const [sortBy, setSortBy] = useState<SortKey>('recent');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<IgPost | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [showTagManager, setShowTagManager] = useState(false);

  const { data: stats } = useSWR(`${API}/instagram-stats`);
  const { data: historyData } = useSWR(`${API}/instagram-history`);
  const { data: monthlyData } = useSWR(`${API}/instagram-monthly`);
  const { data: dbPostsRaw, mutate: mutatePosts } = useSWR(`${API}/instagram-posts/db`);
  const { data: tagStatsRaw, mutate: mutateTagStats } = useSWR(`${API}/instagram-posts/tag-stats`);
  const { data: registryRaw, mutate: mutateRegistry } = useSWR(`${API}/ig-tags`);

  const history: any[] = historyData || [];
  const monthly: any[] = monthlyData || [];
  const dbPosts: IgPost[] = dbPostsRaw || [];
  const tagStats: any[] = tagStatsRaw || [];
  const registry: IgTag[] = registryRaw || [];

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

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg('');
    try {
      const res = await authFetch(`${API}/instagram-posts/sync`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro na sincronização');
      setSyncMsg(`${data.synced} posts sincronizados`);
      await mutatePosts();
      await mutateTagStats();
    } catch (e: any) { setSyncMsg(e.message); }
    setSyncing(false);
  };

  const handleTagsChanged = (id: string, tags: string[]) => {
    mutatePosts(dbPosts.map(p => p.id === id ? { ...p, tags } : p), false);
    mutateTagStats();
    if (selectedPost?.id === id) setSelectedPost(p => p ? { ...p, tags } : p);
  };

  const handleTagManagerChanged = () => {
    mutateRegistry();
    mutateTagStats();
    mutatePosts();
  };

  // ── Format performance analysis ─────────────────────────────
  const FORMAT_GROUPS = [
    { key: 'reel',      label: 'Reel',      icon: <Play size={14} />,        color: '#E1306C', types: ['VIDEO']          },
    { key: 'carrossel', label: 'Carrossel', icon: <LayoutGrid size={14} />,  color: '#818CF8', types: ['CAROUSEL_ALBUM'] },
    { key: 'foto',      label: 'Foto',      icon: <Camera size={14} />,      color: '#F59E0B', types: ['IMAGE']          },
  ];
  const formatStats = FORMAT_GROUPS.map(g => {
    const ps = dbPosts.filter(p => g.types.includes(p.media_type));
    if (!ps.length) return null;
    const n = ps.length;
    const avgReach    = Math.round(ps.reduce((s, p) => s + (p.reach || p.impressions || 0), 0) / n);
    const avgEr       = ps.reduce((s, p) => s + calcEr(p), 0) / n;
    const avgSaved    = Math.round(ps.reduce((s, p) => s + (p.saved || 0), 0) / n);
    const avgLikes    = Math.round(ps.reduce((s, p) => s + p.like_count, 0) / n);
    const avgComments = Math.round(ps.reduce((s, p) => s + p.comments_count, 0) / n);
    return { ...g, count: n, avgReach, avgEr, avgSaved, avgLikes, avgComments };
  }).filter((x): x is NonNullable<typeof x> => x !== null);

  const fMaxReach = formatStats.length ? Math.max(...formatStats.map(f => f.avgReach)) || 1 : 1;
  const fMaxEr    = formatStats.length ? Math.max(...formatStats.map(f => f.avgEr))    || 1 : 1;
  const fMaxSaved = formatStats.length ? Math.max(...formatStats.map(f => f.avgSaved)) || 1 : 1;
  const bestFmtReach  = formatStats.reduce((b, f) => f.avgReach > b.avgReach ? f : b, formatStats[0]);
  const bestFmtEr     = formatStats.reduce((b, f) => f.avgEr    > b.avgEr    ? f : b, formatStats[0]);
  const bestFmtSaved  = formatStats.reduce((b, f) => f.avgSaved > b.avgSaved ? f : b, formatStats[0]);

  const visiblePosts = sortPosts(
    tagFilter ? dbPosts.filter(p => p.tags.includes(tagFilter)) : dbPosts,
    sortBy,
  );

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
            <InsightBar label="Taxa de Engajamento"       value={(stats?.engagement_rate || 0).toFixed(2)} unit="%" color="#E1306C" max={10}  />
            <InsightBar label="Conversão (visita→follow)" value={(stats?.conversion_rate || 0).toFixed(2)} unit="%" color="#818CF8" max={20}  />
            <InsightBar label="Retenção (alcance→perfil)" value={(stats?.retention_rate  || 0).toFixed(2)} unit="%" color="#F59E0B" max={15}  />
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

      {/* Format Performance */}
      {formatStats.length >= 2 && (
        <Card className="glass-panel">
          <CardHeader style={{ paddingBottom: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <CardTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                <BarChart3 size={15} style={{ color: '#818CF8' }} /> Performance por Formato
              </CardTitle>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{dbPosts.length} posts analisados</span>
            </div>
          </CardHeader>
          <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {/* Insight strip */}
            <div style={{ padding: '0.625rem 0.875rem', background: 'rgba(129,140,248,0.07)', border: '1px solid rgba(129,140,248,0.18)', borderRadius: '0.5rem', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.6, display: 'flex', flexWrap: 'wrap', gap: '0.25rem 0.75rem' }}>
              <span>💡</span>
              {[
                bestFmtReach && <span key="r"><strong style={{ color: bestFmtReach.color }}>{bestFmtReach.label}</strong> tem mais alcance ({fmt(bestFmtReach.avgReach)}/post)</span>,
                bestFmtEr?.key !== bestFmtReach?.key && bestFmtEr && <span key="e"> · <strong style={{ color: bestFmtEr.color }}>{bestFmtEr.label}</strong> tem melhor engajamento ({bestFmtEr.avgEr.toFixed(1)}% ER)</span>,
                bestFmtSaved?.key !== bestFmtReach?.key && bestFmtSaved?.key !== bestFmtEr?.key && bestFmtSaved && <span key="s"> · <strong style={{ color: bestFmtSaved.color }}>{bestFmtSaved.label}</strong> gera mais salvamentos</span>,
              ]}
            </div>

            {/* Format cards */}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${formatStats.length}, 1fr)`, gap: '0.75rem' }}>
              {formatStats.map(fs => (
                <div key={fs.key} style={{ padding: '0.875rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${fs.color}18`, border: `1px solid ${fs.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: fs.color, flexShrink: 0 }}>
                      {fs.icon}
                    </div>
                    <div>
                      <p style={{ fontSize: '0.875rem', fontWeight: 700 }}>{fs.label}</p>
                      <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>{fs.count} post{fs.count !== 1 ? 's' : ''}</p>
                    </div>
                  </div>

                  {/* Metric rows */}
                  {([
                    { label: 'Alcance',    value: fmt(fs.avgReach),           pct: fs.avgReach / fMaxReach,  isBest: bestFmtReach?.key  === fs.key, barColor: fs.color         },
                    { label: 'Engaj.',     value: `${fs.avgEr.toFixed(1)}%`,  pct: fs.avgEr    / fMaxEr,     isBest: bestFmtEr?.key     === fs.key, barColor: erColor(fs.avgEr)},
                    { label: 'Salvam.',    value: fmt(fs.avgSaved),           pct: fs.avgSaved / fMaxSaved,  isBest: bestFmtSaved?.key  === fs.key, barColor: fs.color         },
                  ] as { label: string; value: string; pct: number; isBest: boolean; barColor: string }[]).map(m => (
                    <div key={m.label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.63rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{m.label}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          {m.isBest && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.15rem', fontSize: '0.6rem', fontWeight: 700, color: m.barColor, background: `${m.barColor}18`, border: `1px solid ${m.barColor}40`, padding: '0.05rem 0.3rem', borderRadius: '999px' }}>
                              <Award size={8} /> melhor
                            </span>
                          )}
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: m.isBest ? m.barColor : 'var(--text-primary)' }}>{m.value}</span>
                        </div>
                      </div>
                      <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 3, background: m.isBest ? m.barColor : `${m.barColor}70`, width: `${Math.min(Math.round(m.pct * 100), 100)}%`, transition: 'width 0.5s ease' }} />
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Averages sub-row */}
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', paddingTop: '0.25rem', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              {formatStats.map(fs => (
                <span key={fs.key} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ color: fs.color }}>{fs.icon}</span>
                  {fs.label}: <strong style={{ color: 'var(--text-primary)' }}>{fmt(fs.avgLikes)} curtidas</strong> · {fmt(fs.avgComments)} comentários
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tag Stats */}
      {tagStats.length > 0 && (
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Tag size={16} style={{ color: '#E1306C' }} /> Performance por Etiqueta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
              {tagStats.map((ts: any) => {
                const color = resolveColor(ts.tag, registry);
                return (
                  <div
                    key={ts.tag}
                    onClick={() => setTagFilter(f => f === ts.tag ? null : ts.tag)}
                    style={{ padding: '0.75rem 1rem', borderRadius: '0.625rem', background: tagFilter === ts.tag ? `${color}18` : 'rgba(255,255,255,0.03)', border: `1px solid ${tagFilter === ts.tag ? color + '55' : 'rgba(255,255,255,0.06)'}`, cursor: 'pointer', transition: 'all 0.15s' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <TagPill label={ts.tag} color={color} />
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{ts.count} post{ts.count !== 1 ? 's' : ''}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                      <span><Eye size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />{fmt(ts.avgReach)}</span>
                      <span style={{ color: erColor(ts.avgEr), fontWeight: 600 }}>{ts.avgEr.toFixed(1)}% ER</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Posts Section */}
      <Card className="glass-panel">
        <CardHeader>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <CardTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Camera size={16} style={{ color: '#E1306C' }} />
                Meus Posts
                {dbPosts.length > 0 && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 400 }}>
                    ({visiblePosts.length}{tagFilter ? ` com #${tagFilter}` : ''} de {dbPosts.length})
                  </span>
                )}
              </CardTitle>

              {/* Sync */}
              <button
                onClick={handleSync}
                disabled={syncing}
                style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', background: 'rgba(225,48,108,0.1)', border: '1px solid rgba(225,48,108,0.3)', borderRadius: '0.5rem', color: '#E1306C', fontSize: '0.75rem', fontWeight: 600, padding: '0.3rem 0.75rem', cursor: syncing ? 'not-allowed' : 'pointer', opacity: syncing ? 0.7 : 1 }}
              >
                {syncing ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={13} />}
                {syncing ? 'Sincronizando...' : 'Sincronizar'}
              </button>
              {syncMsg && <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{syncMsg}</span>}

              {/* Tag Manager button */}
              <button
                onClick={() => setShowTagManager(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, padding: '0.3rem 0.75rem', cursor: 'pointer' }}
              >
                <Settings2 size={13} /> Etiquetas
                {registry.length > 0 && (
                  <span style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '999px', padding: '0 0.35rem', fontSize: '0.65rem' }}>{registry.length}</span>
                )}
              </button>
            </div>

            {/* Sort */}
            <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
              {SORT_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setSortBy(opt.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.3rem',
                    padding: '0.3rem 0.625rem', borderRadius: '999px',
                    border: `1px solid ${sortBy === opt.key ? '#E1306C' : 'rgba(255,255,255,0.1)'}`,
                    background: sortBy === opt.key ? 'rgba(225,48,108,0.15)' : 'rgba(255,255,255,0.03)',
                    color: sortBy === opt.key ? '#E1306C' : 'var(--text-secondary)',
                    fontSize: '0.72rem', fontWeight: sortBy === opt.key ? 600 : 400,
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {opt.icon} {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tag filter pills */}
          {registry.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.75rem' }}>
              <button
                onClick={() => setTagFilter(null)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.15rem 0.625rem', borderRadius: '999px', border: `1px solid ${!tagFilter ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.08)'}`, background: !tagFilter ? 'rgba(255,255,255,0.08)' : 'transparent', color: !tagFilter ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '0.7rem', cursor: 'pointer' }}
              >
                Todos
              </button>
              {registry.map(t => (
                <button key={t.name} onClick={() => setTagFilter(f => f === t.name ? null : t.name)} style={{ padding: 0, background: 'none', border: 'none', cursor: 'pointer' }}>
                  <TagPill
                    label={t.name}
                    color={t.color}
                    small
                    onClick={() => setTagFilter(f => f === t.name ? null : t.name)}
                  />
                </button>
              ))}
            </div>
          )}
        </CardHeader>

        <CardContent>
          {dbPosts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-secondary)' }}>
              <Camera size={36} style={{ opacity: 0.25, marginBottom: '0.75rem' }} />
              <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Nenhum post salvo ainda.</p>
              <p style={{ fontSize: '0.8rem' }}>Clique em <strong>Sincronizar</strong> para buscar seus posts do Instagram.</p>
            </div>
          ) : visiblePosts.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              Nenhum post com a etiqueta <strong>#{tagFilter}</strong>.
            </p>
          ) : (
            <div className="comp-videos-grid">
              {visiblePosts.map(post => (
                <IgPostCard key={post.id} post={post} registry={registry} onClick={() => setSelectedPost(post)} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedPost && (
        <IgPostModal
          key={selectedPost.id}
          post={selectedPost}
          registry={registry}
          onClose={() => setSelectedPost(null)}
          onTagsChanged={handleTagsChanged}
        />
      )}

      {showTagManager && (
        <TagManager
          onClose={() => setShowTagManager(false)}
          onChanged={handleTagManagerChanged}
        />
      )}
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
