import { useState } from 'react';
import { createPortal } from 'react-dom';
import useSWR from 'swr';
import {
  CalendarDays, ChevronLeft, ChevronRight, Plus, X, Check,
  Camera, PlaySquare, Loader2, Pencil, Trash2, CheckCircle2,
  Play, LayoutGrid, Layers, Radio, Zap, Clock,
} from 'lucide-react';
import { API } from '../utils/format';
import { getToken } from './Login';

function authFetch(url: string, opts: RequestInit = {}) {
  const token = getToken();
  return fetch(url, { ...opts, headers: { ...(opts.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
}

// ─── Types ────────────────────────────────────────────────────
interface CalItem {
  id: string;
  source: 'planned' | 'instagram';
  title: string;
  channel: 'instagram' | 'youtube';
  format: string;
  planned_date: string;
  status: 'planned' | 'published' | 'cancelled';
  tags: string[];
  notes: string | null;
}

interface IgTag { name: string; color: string; }

// ─── Constants ────────────────────────────────────────────────
const WEEK_DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

const IG_FORMATS = [
  { key: 'reel',      label: 'Reel',      icon: <Play size={12} /> },
  { key: 'carrossel', label: 'Carrossel', icon: <LayoutGrid size={12} /> },
  { key: 'foto',      label: 'Foto',      icon: <Camera size={12} /> },
  { key: 'story',     label: 'Story',     icon: <Layers size={12} /> },
  { key: 'live',      label: 'Live',      icon: <Radio size={12} /> },
];
const YT_FORMATS = [
  { key: 'video', label: 'Vídeo',  icon: <PlaySquare size={12} /> },
  { key: 'short', label: 'Short',  icon: <Zap size={12} /> },
  { key: 'live',  label: 'Live',   icon: <Radio size={12} /> },
];

const CHANNEL_COLOR = { instagram: '#E1306C', youtube: '#FF4444' };
const FORMAT_ICON: Record<string, JSX.Element> = {
  reel: <Play size={10} />, carrossel: <LayoutGrid size={10} />, foto: <Camera size={10} />,
  story: <Layers size={10} />, video: <PlaySquare size={10} />, short: <Zap size={10} />,
  live: <Radio size={10} />,
};

// ─── Helpers ──────────────────────────────────────────────────
function toMonthStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fmtMonthYear(d: Date) {
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

// Monday-first calendar days (42 cells)
function getCalDays(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const dow = (first.getDay() + 6) % 7; // 0=Mon … 6=Sun
  const days: Date[] = [];
  for (let i = dow; i > 0; i--) days.push(new Date(year, month, 1 - i));
  const last = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= last; d++) days.push(new Date(year, month, d));
  let next = 1;
  while (days.length < 42) days.push(new Date(year, month + 1, next++));
  return days;
}

function isToday(d: Date) {
  const t = new Date();
  return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
}

// ─── Item Chip (calendar cell) ────────────────────────────────
function ItemChip({ item, onClick }: { item: CalItem; onClick: () => void }) {
  const color = CHANNEL_COLOR[item.channel];
  const published = item.status === 'published';
  return (
    <div
      onClick={e => { e.stopPropagation(); onClick(); }}
      title={item.title}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.2rem',
        padding: '0.1rem 0.3rem', borderRadius: 4, cursor: 'pointer',
        background: published ? `${color}20` : 'transparent',
        border: `1px ${published ? 'solid' : 'dashed'} ${color}${published ? '60' : '50'}`,
        borderLeft: `3px solid ${color}`,
        fontSize: '0.62rem', lineHeight: 1.3,
        overflow: 'hidden',
        transition: 'opacity 0.15s',
        opacity: item.status === 'cancelled' ? 0.4 : 1,
      }}
      onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
      onMouseLeave={e => (e.currentTarget.style.opacity = item.status === 'cancelled' ? '0.4' : '1')}
    >
      <span style={{ color, flexShrink: 0 }}>{FORMAT_ICON[item.format] || <Clock size={10} />}</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
        {item.title}
      </span>
    </div>
  );
}

// ─── Day Cell ─────────────────────────────────────────────────
function DayCell({
  day, isCurrentMonth, items, onAdd, onItemClick,
}: {
  day: Date; isCurrentMonth: boolean; items: CalItem[];
  onAdd: (dateStr: string) => void; onItemClick: (item: CalItem) => void;
}) {
  const today = isToday(day);
  const dateStr = toDateStr(day);
  const visible = items.slice(0, 3);
  const hidden  = items.length - visible.length;

  return (
    <div
      style={{
        minHeight: 90, padding: '0.3rem', borderRadius: '0.5rem',
        background: today ? 'rgba(129,140,248,0.08)' : 'transparent',
        border: `1px solid ${today ? 'rgba(129,140,248,0.3)' : 'rgba(255,255,255,0.04)'}`,
        display: 'flex', flexDirection: 'column', gap: '0.2rem',
        cursor: 'pointer', transition: 'background 0.15s',
        opacity: isCurrentMonth ? 1 : 0.35,
      }}
      onClick={() => onAdd(dateStr)}
      onMouseEnter={e => { if (!today) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
      onMouseLeave={e => { if (!today) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      {/* Day number */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.1rem' }}>
        <span style={{
          fontSize: '0.72rem', fontWeight: today ? 800 : 500,
          color: today ? '#818CF8' : isCurrentMonth ? 'var(--text-primary)' : 'var(--text-tertiary)',
          width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '50%', background: today ? 'rgba(129,140,248,0.2)' : 'transparent',
        }}>
          {day.getDate()}
        </span>
        {items.length === 0 && (
          <Plus size={11} style={{ color: 'var(--text-tertiary)', opacity: 0 }} className="day-add-btn" />
        )}
      </div>

      {/* Items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', flex: 1 }}>
        {visible.map(item => (
          <ItemChip key={item.id} item={item} onClick={() => onItemClick(item)} />
        ))}
        {hidden > 0 && (
          <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', paddingLeft: '0.2rem' }}>
            +{hidden} mais
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Add / Edit Modal ─────────────────────────────────────────
function ItemModal({
  initial, defaultDate, tags, onClose, onSaved,
}: {
  initial?: CalItem; defaultDate: string; tags: IgTag[];
  onClose: () => void; onSaved: () => void;
}) {
  const editing = !!initial && initial.source === 'planned';
  const [title,   setTitle]   = useState(initial?.title   || '');
  const [channel, setChannel] = useState<'instagram' | 'youtube'>(initial?.channel || 'instagram');
  const [format,  setFormat]  = useState(initial?.format  || 'reel');
  const [date,    setDate]    = useState(initial?.planned_date || defaultDate);
  const [notes,   setNotes]   = useState(initial?.notes   || '');
  const [selTags, setSelTags] = useState<string[]>(initial?.tags || []);
  const [saving,  setSaving]  = useState(false);

  const formats = channel === 'instagram' ? IG_FORMATS : YT_FORMATS;

  // reset format when channel changes
  const handleChannel = (c: 'instagram' | 'youtube') => {
    setChannel(c);
    setFormat(c === 'instagram' ? 'reel' : 'video');
  };

  const toggleTag = (name: string) =>
    setSelTags(t => t.includes(name) ? t.filter(x => x !== name) : [...t, name]);

  const handleSave = async () => {
    if (!title.trim() || !date) return;
    setSaving(true);
    try {
      const body = { title, channel, format, planned_date: date, notes, tags: selTags };
      if (editing && initial) {
        await authFetch(`${API}/calendar/${initial.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        await authFetch(`${API}/calendar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }
      onSaved();
      onClose();
    } catch (e: any) { alert(e.message); }
    setSaving(false);
  };

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={onClose}>
      <div
        style={{ backgroundColor: '#0f0f11', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '1.25rem', width: '100%', maxWidth: '480px', padding: '1.75rem', position: 'relative', boxShadow: '0 30px 80px rgba(0,0,0,0.8)', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.5rem', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0.375rem', display: 'flex' }}>
          <X size={18} />
        </button>

        <h2 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CalendarDays size={17} style={{ color: '#818CF8' }} />
          {editing ? 'Editar Conteúdo' : 'Planejar Conteúdo'}
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Channel */}
          <div>
            <label style={lbl}>Canal</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {(['instagram', 'youtube'] as const).map(c => (
                <button
                  key={c}
                  onClick={() => handleChannel(c)}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                    padding: '0.5rem', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600,
                    background: channel === c ? `${CHANNEL_COLOR[c]}18` : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${channel === c ? CHANNEL_COLOR[c] + '60' : 'rgba(255,255,255,0.1)'}`,
                    color: channel === c ? CHANNEL_COLOR[c] : 'var(--text-secondary)',
                  }}
                >
                  {c === 'instagram' ? <Camera size={15} /> : <PlaySquare size={15} />}
                  {c === 'instagram' ? 'Instagram' : 'YouTube'}
                </button>
              ))}
            </div>
          </div>

          {/* Format */}
          <div>
            <label style={lbl}>Formato</label>
            <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
              {formats.map(f => (
                <button
                  key={f.key}
                  onClick={() => setFormat(f.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.3rem',
                    padding: '0.3rem 0.625rem', borderRadius: '999px', cursor: 'pointer', fontSize: '0.75rem',
                    background: format === f.key ? `${CHANNEL_COLOR[channel]}18` : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${format === f.key ? CHANNEL_COLOR[channel] + '60' : 'rgba(255,255,255,0.1)'}`,
                    color: format === f.key ? CHANNEL_COLOR[channel] : 'var(--text-secondary)',
                    fontWeight: format === f.key ? 700 : 400,
                  }}
                >
                  {f.icon} {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label style={lbl}>Título / Tema</label>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="Do que vai ser esse conteúdo?"
              style={inp}
            />
          </div>

          {/* Date */}
          <div>
            <label style={lbl}>Data planejada</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} />
          </div>

          {/* Tags (only Instagram) */}
          {channel === 'instagram' && tags.length > 0 && (
            <div>
              <label style={lbl}>Etiquetas</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                {tags.map(t => {
                  const active = selTags.includes(t.name);
                  return (
                    <button
                      key={t.name}
                      onClick={() => toggleTag(t.name)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                        padding: '0.2rem 0.6rem', borderRadius: '999px', cursor: 'pointer', fontSize: '0.72rem',
                        background: active ? `${t.color}28` : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${active ? t.color + '80' : 'rgba(255,255,255,0.1)'}`,
                        color: active ? t.color : 'var(--text-secondary)',
                        fontWeight: active ? 700 : 400,
                      }}
                    >
                      {active && <Check size={10} />} {t.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label style={lbl}>Observações <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(opcional)</span></label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ideia, referência, CTA..." rows={2} style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '0.625rem', borderRadius: '0.625rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.875rem' }}>
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !title.trim() || !date}
            style={{ flex: 2, padding: '0.625rem', borderRadius: '0.625rem', background: CHANNEL_COLOR[channel], border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', opacity: saving || !title.trim() || !date ? 0.5 : 1 }}
          >
            {saving ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={15} />}
            {editing ? 'Salvar' : 'Adicionar ao Calendário'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Item Detail Panel ────────────────────────────────────────
function ItemDetail({
  item, onClose, onEdit, onDelete, onStatusChange,
}: {
  item: CalItem; onClose: () => void; onEdit: () => void;
  onDelete: () => void; onStatusChange: (s: 'published' | 'planned' | 'cancelled') => void;
}) {
  const color = CHANNEL_COLOR[item.channel];
  const isPlanned = item.source === 'planned';
  const fmtDate = new Date(item.planned_date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const fmtInfo = [...IG_FORMATS, ...YT_FORMATS].find(f => f.key === item.format);

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={onClose}>
      <div
        style={{ backgroundColor: '#0f0f11', border: `1px solid ${color}30`, borderRadius: '1.25rem', width: '100%', maxWidth: '420px', padding: '1.5rem', position: 'relative', boxShadow: '0 20px 60px rgba(0,0,0,0.8)' }}
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} style={{ position: 'absolute', top: '0.875rem', right: '0.875rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}>
          <X size={18} />
        </button>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1rem' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${color}18`, border: `1px solid ${color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
            {item.channel === 'instagram' ? <Camera size={16} /> : <PlaySquare size={16} />}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.68rem', fontWeight: 700, color, background: `${color}18`, border: `1px solid ${color}40`, padding: '0.1rem 0.4rem', borderRadius: 4 }}>
                {fmtInfo?.icon} {fmtInfo?.label || item.format}
              </span>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: 4, background: item.status === 'published' ? 'rgba(16,185,129,0.15)' : item.status === 'cancelled' ? 'rgba(107,114,128,0.15)' : 'rgba(245,158,11,0.15)', color: item.status === 'published' ? '#10B981' : item.status === 'cancelled' ? '#6B7280' : '#F59E0B' }}>
                {item.status === 'published' ? 'Publicado' : item.status === 'cancelled' ? 'Cancelado' : 'Planejado'}
              </span>
            </div>
          </div>
        </div>

        <h3 style={{ fontSize: '1rem', fontWeight: 700, lineHeight: 1.4, marginBottom: '0.75rem' }}>{item.title}</h3>

        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <CalendarDays size={13} /> {fmtDate}
        </p>

        {item.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.75rem' }}>
            {item.tags.map(t => (
              <span key={t} style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem', borderRadius: '999px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>#{t}</span>
            ))}
          </div>
        )}

        {item.notes && (
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '0.5rem', padding: '0.625rem', lineHeight: 1.6, marginBottom: '0.75rem' }}>
            {item.notes}
          </p>
        )}

        {/* Source indicator for instagram synced */}
        {item.source === 'instagram' && (
          <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', fontStyle: 'italic' }}>
            Importado automaticamente do Instagram
          </p>
        )}

        {/* Actions — only for planned items */}
        {isPlanned && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.875rem' }}>
            {item.status === 'planned' && (
              <button
                onClick={() => onStatusChange('published')}
                style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '0.5rem', color: '#10B981', fontSize: '0.78rem', fontWeight: 600, padding: '0.4rem 0.75rem', cursor: 'pointer' }}
              >
                <CheckCircle2 size={13} /> Marcar como publicado
              </button>
            )}
            {item.status === 'published' && (
              <button
                onClick={() => onStatusChange('planned')}
                style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '0.5rem', color: '#F59E0B', fontSize: '0.78rem', fontWeight: 600, padding: '0.4rem 0.75rem', cursor: 'pointer' }}
              >
                <Clock size={13} /> Voltar para planejado
              </button>
            )}
            <button onClick={onEdit} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.78rem', padding: '0.4rem 0.75rem', cursor: 'pointer' }}>
              <Pencil size={13} /> Editar
            </button>
            <button onClick={onDelete} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '0.5rem', color: '#EF4444', fontSize: '0.78rem', padding: '0.4rem 0.75rem', cursor: 'pointer' }}>
              <Trash2 size={13} /> Excluir
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

const lbl: React.CSSProperties = { display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.06em' };
const inp: React.CSSProperties  = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem', color: 'var(--text-primary)', fontSize: '0.875rem', padding: '0.5rem 0.75rem', outline: 'none', boxSizing: 'border-box' };

// ─── Main Page ────────────────────────────────────────────────
export function Calendar() {
  const [current, setCurrent] = useState(() => new Date());
  const [addDate,   setAddDate]   = useState<string | null>(null);
  const [editItem,  setEditItem]  = useState<CalItem | null>(null);
  const [viewItem,  setViewItem]  = useState<CalItem | null>(null);

  const monthStr = toMonthStr(current);
  const { data, mutate } = useSWR(`${API}/calendar?month=${monthStr}`);
  const { data: tagsRaw } = useSWR(`${API}/ig-tags`);

  const items: CalItem[] = data?.items || [];
  const tags: IgTag[]    = tagsRaw || [];

  const calDays = getCalDays(current.getFullYear(), current.getMonth());

  const itemsByDate: Record<string, CalItem[]> = {};
  for (const item of items) {
    if (!itemsByDate[item.planned_date]) itemsByDate[item.planned_date] = [];
    itemsByDate[item.planned_date].push(item);
  }

  // Frequency stats for this month
  const published   = items.filter(i => i.status === 'published');
  const planned     = items.filter(i => i.source === 'planned' && i.status === 'planned');
  const igPub       = published.filter(i => i.channel === 'instagram');
  const ytPub       = published.filter(i => i.channel === 'youtube');
  const totalTarget = published.length + planned.length;
  const completionPct = totalTarget > 0 ? Math.round((published.length / totalTarget) * 100) : 0;

  // This week stats
  const todayStr = toDateStr(new Date());
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const weekEnd   = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
  const weekItems = items.filter(i => i.planned_date >= toDateStr(weekStart) && i.planned_date <= toDateStr(weekEnd));
  const weekPub   = weekItems.filter(i => i.status === 'published').length;
  const weekPlan  = weekItems.filter(i => i.status === 'planned').length;

  const prevMonth = () => setCurrent(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setCurrent(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  const goToday   = () => setCurrent(new Date());

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este item do calendário?')) return;
    await authFetch(`${API}/calendar/${id}`, { method: 'DELETE' });
    setViewItem(null);
    mutate();
  };

  const handleStatusChange = async (id: string, status: 'published' | 'planned' | 'cancelled') => {
    await authFetch(`${API}/calendar/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setViewItem(null);
    mutate();
  };

  return (
    <div className="flex flex-col gap-5 pb-10">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg, #E1306C 0%, #818CF8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(129,140,248,0.3)' }}>
            <CalendarDays size={24} color="#fff" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Calendário de Conteúdo</h1>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Planeje, acompanhe e analise sua cadência de publicação</p>
          </div>
        </div>
        <button
          onClick={() => setAddDate(todayStr)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#E1306C', border: 'none', borderRadius: '0.625rem', color: '#fff', fontSize: '0.875rem', fontWeight: 700, padding: '0.625rem 1.25rem', cursor: 'pointer', boxShadow: '0 4px 14px rgba(225,48,108,0.35)' }}
        >
          <Plus size={16} /> Planejar Conteúdo
        </button>
      </div>

      {/* Frequency strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
        {[
          { label: 'Publicados (mês)',   value: published.length,    color: '#10B981', sub: `${igPub.length} IG · ${ytPub.length} YT` },
          { label: 'Planejados (mês)',   value: planned.length,      color: '#F59E0B', sub: 'aguardando publicação' },
          { label: 'Publicados (semana)',value: weekPub,             color: '#818CF8', sub: `${weekPlan} planejados` },
          { label: 'Conclusão do mês',  value: `${completionPct}%`, color: completionPct >= 70 ? '#10B981' : completionPct >= 40 ? '#F59E0B' : '#EF4444', sub: `${published.length} de ${totalTarget}` },
        ].map(s => (
          <div key={s.label} style={{ padding: '0.875rem 1rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '0.75rem' }}>
            <p style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.25rem' }}>{s.label}</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</p>
            <p style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Calendar */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '1rem', padding: '1rem' }}>
        {/* Month navigation */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button onClick={prevMonth} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.5rem', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0.375rem', display: 'flex' }}>
              <ChevronLeft size={18} />
            </button>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, minWidth: 180, textAlign: 'center', textTransform: 'capitalize' }}>
              {fmtMonthYear(current)}
            </h2>
            <button onClick={nextMonth} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.5rem', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0.375rem', display: 'flex' }}>
              <ChevronRight size={18} />
            </button>
          </div>
          <button onClick={goToday} style={{ background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.25)', borderRadius: '0.5rem', cursor: 'pointer', color: '#818CF8', fontSize: '0.78rem', fontWeight: 600, padding: '0.35rem 0.75rem' }}>
            Hoje
          </button>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          {[
            { color: '#E1306C', label: 'Instagram publicado', dashed: false },
            { color: '#E1306C', label: 'Instagram planejado', dashed: true },
            { color: '#FF4444', label: 'YouTube planejado',   dashed: true },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
              <div style={{ width: 24, height: 8, borderRadius: 2, background: l.dashed ? 'transparent' : `${l.color}30`, border: `1px ${l.dashed ? 'dashed' : 'solid'} ${l.color}60`, borderLeft: `3px solid ${l.color}` }} />
              {l.label}
            </div>
          ))}
        </div>

        {/* Week day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.25rem', marginBottom: '0.25rem' }}>
          {WEEK_DAYS.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-secondary)', padding: '0.25rem 0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.25rem' }}>
          {calDays.map((day, i) => {
            const dateStr = toDateStr(day);
            const dayItems = itemsByDate[dateStr] || [];
            const inMonth = day.getMonth() === current.getMonth();
            return (
              <DayCell
                key={i}
                day={day}
                isCurrentMonth={inMonth}
                items={dayItems}
                onAdd={ds => setAddDate(ds)}
                onItemClick={item => setViewItem(item)}
              />
            );
          })}
        </div>
      </div>

      {/* Modals */}
      {addDate && (
        <ItemModal
          defaultDate={addDate}
          tags={tags}
          onClose={() => setAddDate(null)}
          onSaved={() => mutate()}
        />
      )}
      {editItem && (
        <ItemModal
          initial={editItem}
          defaultDate={editItem.planned_date}
          tags={tags}
          onClose={() => setEditItem(null)}
          onSaved={() => mutate()}
        />
      )}
      {viewItem && (
        <ItemDetail
          item={viewItem}
          onClose={() => setViewItem(null)}
          onEdit={() => { setEditItem(viewItem); setViewItem(null); }}
          onDelete={() => handleDelete(viewItem.id)}
          onStatusChange={s => handleStatusChange(viewItem.id, s)}
        />
      )}
    </div>
  );
}
