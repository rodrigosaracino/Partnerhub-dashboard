import { useState } from 'react';
import { createPortal } from 'react-dom';
import useSWR from 'swr';
import {
  Target, Plus, Pencil, Trash2, X, Check, Loader2,
  Camera, PlaySquare, Eye, Users, TrendingUp, DollarSign,
  Zap, Calendar, ChevronDown,
} from 'lucide-react';
import { API, fmt, currency } from '../utils/format';
import { getToken } from './Login';

function authFetch(url: string, opts: RequestInit = {}) {
  const token = getToken();
  return fetch(url, { ...opts, headers: { ...(opts.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
}

// ─── Metric catalog ──────────────────────────────────────────
export interface MetricDef {
  key: string;
  label: string;
  category: 'Crescimento' | 'Produção' | 'Negócio';
  icon: JSX.Element;
  color: string;
  unit: string;
  format: (v: number) => string;
}

export const METRICS: MetricDef[] = [
  { key: 'instagram_followers',    label: 'Seguidores Instagram',       category: 'Crescimento', icon: <Camera size={16} />,     color: '#E1306C', unit: '',       format: fmt },
  { key: 'youtube_subscribers',    label: 'Inscritos YouTube',          category: 'Crescimento', icon: <PlaySquare size={16} />, color: '#FF0000', unit: '',       format: fmt },
  { key: 'instagram_reach_monthly',label: 'Alcance Mensal (Instagram)', category: 'Crescimento', icon: <Eye size={16} />,        color: '#A78BFA', unit: '/mês',   format: fmt },
  { key: 'youtube_views_monthly',  label: 'Views Mensais (YouTube)',    category: 'Crescimento', icon: <Eye size={16} />,        color: '#818CF8', unit: '/mês',   format: fmt },
  { key: 'posts_instagram_monthly',label: 'Posts Instagram por Mês',   category: 'Produção',    icon: <Camera size={16} />,     color: '#F59E0B', unit: 'posts',  format: v => `${v}` },
  { key: 'videos_youtube_monthly', label: 'Vídeos YouTube por Mês',    category: 'Produção',    icon: <PlaySquare size={16} />, color: '#3B82F6', unit: 'vídeos', format: v => `${v}` },
  { key: 'meta_leads_monthly',     label: 'Leads por Mês',             category: 'Negócio',     icon: <Users size={16} />,      color: '#10B981', unit: 'leads',  format: fmt },
  { key: 'revenue_monthly',        label: 'Faturamento Mensal',        category: 'Negócio',     icon: <DollarSign size={16} />, color: '#22D3EE', unit: '/mês',   format: currency },
];

const CATEGORIES = ['Crescimento', 'Produção', 'Negócio'] as const;

const CATEGORY_META = {
  Crescimento: { color: '#818CF8', icon: <TrendingUp size={14} /> },
  Produção:    { color: '#F59E0B', icon: <Zap size={14} /> },
  Negócio:     { color: '#10B981', icon: <DollarSign size={14} /> },
};

// ─── Types ────────────────────────────────────────────────────
interface Goal {
  id: string;
  label: string;
  metric: string;
  target_value: number;
  baseline_value: number;
  current_value: number;
  deadline: string;
  notes: string | null;
  created_at: string;
}

type GoalStatus = 'achieved' | 'on_track' | 'at_risk' | 'behind' | 'pending';

const STATUS_META: Record<GoalStatus, { label: string; color: string; bg: string }> = {
  achieved: { label: 'Atingida',  color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
  on_track: { label: 'No Prazo',  color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
  at_risk:  { label: 'Em Risco',  color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  behind:   { label: 'Atrasada',  color: '#EF4444', bg: 'rgba(239,68,68,0.12)'  },
  pending:  { label: 'Aguardando',color: '#6B7280', bg: 'rgba(107,114,128,0.1)' },
};

// ─── Helpers ──────────────────────────────────────────────────
function calcStatus(goal: Goal): GoalStatus {
  const range = goal.target_value - goal.baseline_value;
  if (range <= 0) return 'pending';

  const progress = Math.min((goal.current_value - goal.baseline_value) / range, 1);
  if (progress >= 1) return 'achieved';

  const created  = new Date(goal.created_at).getTime();
  const deadline = new Date(goal.deadline + '-28').getTime(); // end of deadline month
  const now      = Date.now();
  const totalMs  = deadline - created;
  if (totalMs <= 0) return 'pending';

  const timeRatio = Math.min((now - created) / totalMs, 1);

  if (progress >= timeRatio)       return 'on_track';
  if (progress >= timeRatio * 0.7) return 'at_risk';
  return 'behind';
}

function monthsLeft(deadline: string): string {
  const d = new Date(deadline + '-01');
  const now = new Date();
  const months = (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth());
  if (months < 0) return 'Prazo vencido';
  if (months === 0) return 'Vence este mês';
  return `${months} mês${months !== 1 ? 'es' : ''} restante${months !== 1 ? 's' : ''}`;
}

function fmtDeadline(d: string) {
  const [y, m] = d.split('-');
  const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${months[parseInt(m) - 1]} ${y}`;
}

function metricDef(key: string): MetricDef {
  return METRICS.find(m => m.key === key) || METRICS[0];
}

// ─── Goal Card ────────────────────────────────────────────────
function GoalCard({ goal, onEdit, onDelete }: { goal: Goal; onEdit: () => void; onDelete: () => void }) {
  const def    = metricDef(goal.metric);
  const status = calcStatus(goal);
  const sm     = STATUS_META[status];
  const range  = goal.target_value - goal.baseline_value;
  const pct    = range > 0 ? Math.min(Math.round(((goal.current_value - goal.baseline_value) / range) * 100), 100) : 0;

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${status === 'achieved' ? sm.color + '40' : 'rgba(255,255,255,0.07)'}`,
        borderRadius: '0.875rem',
        padding: '1.25rem',
        display: 'flex', flexDirection: 'column', gap: '1rem',
        transition: 'border-color 0.2s',
        position: 'relative',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minWidth: 0 }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: `${def.color}18`, border: `1px solid ${def.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: def.color, flexShrink: 0 }}>
            {def.icon}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{goal.label}</p>
            <p style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>{def.label}</p>
          </div>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.2rem 0.55rem', borderRadius: '999px', background: sm.bg, color: sm.color, fontSize: '0.68rem', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
          {sm.label}
        </span>
      </div>

      {/* Progress */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '1.5rem', fontWeight: 800, color: sm.color, letterSpacing: '-0.02em' }}>
            {def.format(goal.current_value)}
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            meta: <strong style={{ color: 'var(--text-primary)' }}>{def.format(goal.target_value)}</strong>
          </span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 3, background: sm.color, width: `${pct}%`, transition: 'width 0.6s ease' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.375rem' }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>{pct}% concluído</span>
          {goal.baseline_value > 0 && (
            <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
              partiu de {def.format(goal.baseline_value)}
            </span>
          )}
        </div>
      </div>

      {/* Deadline + actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
          <Calendar size={12} />
          <span>{fmtDeadline(goal.deadline)}</span>
          <span style={{ opacity: 0.5 }}>·</span>
          <span style={{ color: status === 'behind' ? '#EF4444' : 'var(--text-secondary)' }}>{monthsLeft(goal.deadline)}</span>
        </div>
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          <button onClick={onEdit}   style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0.25rem', borderRadius: 4, display: 'flex' }} title="Editar"><Pencil size={13} /></button>
          <button onClick={onDelete} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444',              padding: '0.25rem', borderRadius: 4, display: 'flex' }} title="Excluir"><Trash2 size={13} /></button>
        </div>
      </div>

      {goal.notes && (
        <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.625rem', lineHeight: 1.5 }}>
          {goal.notes}
        </p>
      )}
    </div>
  );
}

// ─── Form Modal ───────────────────────────────────────────────
const DEADLINE_PRESETS = [
  { label: '3 meses', getValue: () => { const d = new Date(); d.setMonth(d.getMonth() + 3); return d.toISOString().slice(0, 7); } },
  { label: '6 meses', getValue: () => { const d = new Date(); d.setMonth(d.getMonth() + 6); return d.toISOString().slice(0, 7); } },
  { label: 'Final do ano', getValue: () => `${new Date().getFullYear()}-12` },
  { label: '1 ano', getValue: () => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d.toISOString().slice(0, 7); } },
];

function GoalModal({
  initial, onClose, onSaved,
}: {
  initial?: Goal;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = !!initial;
  const [label,   setLabel]   = useState(initial?.label   || '');
  const [metric,  setMetric]  = useState(initial?.metric  || METRICS[0].key);
  const [target,  setTarget]  = useState(initial ? String(initial.target_value) : '');
  const [deadline,setDeadline]= useState(initial?.deadline || DEADLINE_PRESETS[1].getValue());
  const [notes,   setNotes]   = useState(initial?.notes   || '');
  const [saving,  setSaving]  = useState(false);
  const [showPresets, setShowPresets] = useState(false);

  const def = metricDef(metric);

  // auto-fill label from metric if user hasn't typed
  const handleMetricChange = (key: string) => {
    setMetric(key);
    const d = metricDef(key);
    if (!label || METRICS.some(m => m.label === label)) setLabel(d.label);
  };

  const handleSave = async () => {
    if (!label.trim() || !target || !deadline) return;
    setSaving(true);
    try {
      if (editing) {
        const res = await authFetch(`${API}/goals/${initial!.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label, target_value: parseFloat(target), deadline, notes }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
      } else {
        const res = await authFetch(`${API}/goals`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label, metric, target_value: parseFloat(target), deadline, notes }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
      }
      onSaved();
      onClose();
    } catch (e: any) { alert(e.message); }
    setSaving(false);
  };

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={onClose}
    >
      <div
        style={{ backgroundColor: '#0f0f11', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '1.25rem', width: '100%', maxWidth: '520px', padding: '1.75rem', position: 'relative', boxShadow: '0 30px 80px rgba(0,0,0,0.8)' }}
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.5rem', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0.375rem', display: 'flex' }}>
          <X size={18} />
        </button>

        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Target size={18} style={{ color: '#818CF8' }} />
          {editing ? 'Editar Meta' : 'Nova Meta'}
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Metric picker — only on create */}
          {!editing && (
            <div>
              <label style={labelStyle}>Indicador</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                {CATEGORIES.map(cat => (
                  <div key={cat}>
                    <p style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '0.375rem' }}>{cat}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                      {METRICS.filter(m => m.category === cat).map(m => (
                        <button
                          key={m.key}
                          onClick={() => handleMetricChange(m.key)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.3rem',
                            padding: '0.3rem 0.625rem', borderRadius: '999px',
                            border: `1px solid ${metric === m.key ? m.color : 'rgba(255,255,255,0.1)'}`,
                            background: metric === m.key ? `${m.color}18` : 'rgba(255,255,255,0.03)',
                            color: metric === m.key ? m.color : 'var(--text-secondary)',
                            fontSize: '0.72rem', fontWeight: metric === m.key ? 700 : 400,
                            cursor: 'pointer',
                          }}
                        >
                          {m.icon} {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Label */}
          <div>
            <label style={labelStyle}>Nome da meta</label>
            <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Ex: Chegar a 10k seguidores" style={inputStyle} />
          </div>

          {/* Target */}
          <div>
            <label style={labelStyle}>Valor alvo {def.unit && <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>({def.unit})</span>}</label>
            <div style={{ position: 'relative' }}>
              {def.format === currency && (
                <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>R$</span>
              )}
              <input
                type="number"
                value={target}
                onChange={e => setTarget(e.target.value)}
                placeholder="0"
                style={{ ...inputStyle, paddingLeft: def.format === currency ? '2.25rem' : '0.75rem' }}
              />
            </div>
          </div>

          {/* Deadline */}
          <div>
            <label style={labelStyle}>Prazo</label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
              {DEADLINE_PRESETS.map(p => {
                const v = p.getValue();
                return (
                  <button key={p.label} onClick={() => setDeadline(v)} style={{ padding: '0.25rem 0.625rem', borderRadius: '999px', border: `1px solid ${deadline === v ? '#818CF8' : 'rgba(255,255,255,0.1)'}`, background: deadline === v ? 'rgba(129,140,248,0.15)' : 'transparent', color: deadline === v ? '#818CF8' : 'var(--text-secondary)', fontSize: '0.72rem', cursor: 'pointer' }}>
                    {p.label}
                  </button>
                );
              })}
              <button onClick={() => setShowPresets(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.625rem', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.72rem', cursor: 'pointer' }}>
                Personalizado <ChevronDown size={12} />
              </button>
            </div>
            {showPresets && (
              <input type="month" value={deadline} onChange={e => setDeadline(e.target.value)} style={inputStyle} />
            )}
            {deadline && (
              <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                Prazo: <strong style={{ color: 'var(--text-primary)' }}>{fmtDeadline(deadline)}</strong> · {monthsLeft(deadline)}
              </p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label style={labelStyle}>Observações <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(opcional)</span></label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Por que esta meta é importante?" rows={2} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '0.625rem', borderRadius: '0.625rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.875rem' }}>
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !label.trim() || !target || !deadline}
            style={{ flex: 2, padding: '0.625rem', borderRadius: '0.625rem', background: '#818CF8', border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', opacity: saving || !label.trim() || !target || !deadline ? 0.5 : 1 }}
          >
            {saving ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={16} />}
            {editing ? 'Salvar Alterações' : 'Criar Meta'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.06em' };
const inputStyle: React.CSSProperties = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem', color: 'var(--text-primary)', fontSize: '0.875rem', padding: '0.5rem 0.75rem', outline: 'none', boxSizing: 'border-box' };

// ─── Main Page ────────────────────────────────────────────────
export function Goals() {
  const { data: goalsRaw, mutate } = useSWR(`${API}/goals`);
  const goals: Goal[] = goalsRaw || [];

  const [showModal, setShowModal]  = useState(false);
  const [editGoal, setEditGoal]    = useState<Goal | null>(null);
  const [deleting, setDeleting]    = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta meta?')) return;
    setDeleting(id);
    await authFetch(`${API}/goals/${id}`, { method: 'DELETE' });
    await mutate();
    setDeleting(null);
  };

  // Summary counts
  const counts = goals.reduce((acc, g) => {
    acc[calcStatus(g)]++;
    return acc;
  }, { achieved: 0, on_track: 0, at_risk: 0, behind: 0, pending: 0 } as Record<GoalStatus, number>);

  const totalActive = goals.length;
  const completionPct = totalActive > 0 ? Math.round((counts.achieved / totalActive) * 100) : 0;

  return (
    <div className="flex flex-col gap-6 pb-10">
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg, #818CF8 0%, #A78BFA 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(129,140,248,0.35)' }}>
            <Target size={24} color="#fff" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Painel de Metas</h1>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Acompanhe o progresso de todos os seus objetivos</p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#818CF8', border: 'none', borderRadius: '0.625rem', color: '#fff', fontSize: '0.875rem', fontWeight: 700, padding: '0.625rem 1.25rem', cursor: 'pointer', boxShadow: '0 4px 14px rgba(129,140,248,0.35)' }}
        >
          <Plus size={16} /> Nova Meta
        </button>
      </div>

      {/* Summary bar */}
      {totalActive > 0 && (
        <div style={{ padding: '1.25rem 1.5rem', background: 'rgba(129,140,248,0.06)', border: '1px solid rgba(129,140,248,0.2)', borderRadius: '0.875rem', display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1 }}>{counts.achieved}<span style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 400 }}>/{totalActive}</span></p>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>metas atingidas ({completionPct}%)</p>
          </div>
          <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.07)', overflow: 'hidden', minWidth: 120 }}>
            <div style={{ height: '100%', borderRadius: 4, background: 'linear-gradient(90deg, #818CF8, #10B981)', width: `${completionPct}%`, transition: 'width 0.6s ease' }} />
          </div>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {([['on_track','No Prazo'],['at_risk','Em Risco'],['behind','Atrasada']] as [GoalStatus, string][]).map(([s, l]) => counts[s] > 0 && (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_META[s].color }} />
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  <strong style={{ color: STATUS_META[s].color }}>{counts[s]}</strong> {l}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Goals by category */}
      {totalActive === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-secondary)' }}>
          <Target size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
          <p style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Nenhuma meta definida</p>
          <p style={{ fontSize: '0.875rem', marginBottom: '1.5rem' }}>Defina metas claras para acompanhar seu crescimento e resultado.</p>
          <button
            onClick={() => setShowModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#818CF8', border: 'none', borderRadius: '0.625rem', color: '#fff', fontSize: '0.875rem', fontWeight: 700, padding: '0.625rem 1.25rem', cursor: 'pointer' }}
          >
            <Plus size={16} /> Criar primeira meta
          </button>
        </div>
      ) : (
        CATEGORIES.map(cat => {
          const catGoals = goals.filter(g => metricDef(g.metric).category === cat);
          if (catGoals.length === 0) return null;
          const cm = CATEGORY_META[cat];
          return (
            <div key={cat}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
                <div style={{ color: cm.color }}>{cm.icon}</div>
                <h2 style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: cm.color }}>{cat}</h2>
                <div style={{ flex: 1, height: '1px', background: `${cm.color}25` }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                {catGoals.map(g => (
                  <GoalCard
                    key={g.id}
                    goal={g}
                    onEdit={() => setEditGoal(g)}
                    onDelete={() => { if (deleting !== g.id) handleDelete(g.id); }}
                  />
                ))}
              </div>
            </div>
          );
        })
      )}

      {/* Modals */}
      {showModal && (
        <GoalModal onClose={() => setShowModal(false)} onSaved={() => mutate()} />
      )}
      {editGoal && (
        <GoalModal initial={editGoal} onClose={() => setEditGoal(null)} onSaved={() => mutate()} />
      )}
    </div>
  );
}
