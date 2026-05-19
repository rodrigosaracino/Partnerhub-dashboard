import React, { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Badge } from '../components/Badge';
import { getToken } from './Login';
import {
  Plus, Trash2, Power, MessageCircle, Send, Link2, MousePointerClick,
  ArrowDown, ChevronRight, Pencil, X, GripVertical, CheckCircle2,
  Zap, AlertTriangle, Clock, Users, Activity, Timer,
} from 'lucide-react';

// ── Tipos ──────────────────────────────────────────────────────

type ButtonType = 'url' | 'quick_reply';
type StepType = 'comment_reply' | 'dm';
type ActiveTab = 'flows' | 'logs' | 'subscribers';

interface FlowButton {
  id: string;
  type: ButtonType;
  title: string;
  url?: string;
}

interface FlowStep {
  id: string;
  type: StepType;
  text: string;
  buttons?: FlowButton[];
  delay_seconds?: number;
}

interface Flow {
  id: string;
  name: string;
  trigger_keyword: string;
  active: number;
  steps: FlowStep[];
  cooldown_hours: number;
  created_at: string;
}

interface WebhookLogEntry {
  id: number;
  event_type: string;
  sender_id: string;
  content: string;
  rule_matched: string | null;
  replied: number;
  error: string | null;
  received_at: string;
}

interface Subscriber {
  id: number;
  sender_id: string;
  flow_id: string;
  flow_name: string;
  trigger_keyword: string;
  opted_in_at: string;
  status: string;
}

interface SubscriberCount {
  flow_id: string;
  total: number;
}

// ── Helpers ────────────────────────────────────────────────────

const API = import.meta.env.VITE_API_URL ?? '/api';

function authFetch(url: string, options: RequestInit = {}) {
  const token = getToken();
  return fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
}

const uid = () => Math.random().toString(36).slice(2, 8);

const STEP_META: Record<StepType, { label: string; icon: React.ReactNode; color: string; desc: string }> = {
  comment_reply: { label: 'Reply no Comentário', icon: <MessageCircle size={15} />, color: 'text-purple-400 bg-purple-500/10 border-purple-500/30', desc: 'Resposta pública visível para todos no post' },
  dm:            { label: 'Mensagem na DM',      icon: <Send size={15} />,           color: 'text-blue-400 bg-blue-500/10 border-blue-500/30',     desc: 'Mensagem privada com texto e/ou botões' },
};

const COOLDOWN_OPTIONS = [
  { value: 0,   label: 'Sem cooldown (sempre dispara)' },
  { value: 1,   label: '1 hora' },
  { value: 6,   label: '6 horas' },
  { value: 24,  label: '24 horas' },
  { value: 72,  label: '3 dias' },
  { value: 168, label: '7 dias' },
  { value: -1,  label: 'Nunca repetir (1× por pessoa)' },
];

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

// ── Página principal ───────────────────────────────────────────

export function Automations() {
  const { data, isLoading } = useSWR(`${API}/flows`);
  const { data: countsData } = useSWR(`${API}/subscribers/counts`);
  const flows: Flow[] = data || [];
  const subscriberCounts: SubscriberCount[] = countsData || [];
  const [editing, setEditing] = useState<Flow | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('flows');

  const countFor = (flowId: string) => subscriberCounts.find(c => c.flow_id === flowId)?.total ?? 0;

  const openNew = () => {
    setEditing({ id: uid(), name: '', trigger_keyword: '', active: 1, steps: [], cooldown_hours: 24, created_at: '' });
    setIsNew(true);
  };

  const openEdit = (f: Flow) => { setEditing({ ...f, steps: f.steps || [], cooldown_hours: f.cooldown_hours ?? 24 }); setIsNew(false); };
  const closeEditor = () => { setEditing(null); setIsNew(false); };

  const saveFlow = async (flow: Flow) => {
    await authFetch(`${API}/flows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(flow),
    });
    await mutate(`${API}/flows`);
    closeEditor();
  };

  const toggleFlow = async (id: string) => {
    await authFetch(`${API}/flows/${id}/toggle`, { method: 'PATCH' });
    await mutate(`${API}/flows`);
  };

  const deleteFlow = async (id: string) => {
    if (!confirm('Excluir este fluxo?')) return;
    await authFetch(`${API}/flows/${id}`, { method: 'DELETE' });
    await mutate(`${API}/flows`);
  };

  if (editing) {
    return (
      <FlowEditor
        flow={editing}
        isNew={isNew}
        onSave={saveFlow}
        onCancel={closeEditor}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold mb-1">Automações</h1>
          <p className="text-muted text-sm">Crie fluxos automáticos de resposta para comentários e DMs no Instagram.</p>
        </div>
        <Button onClick={openNew} icon={<Plus size={16} />}>Novo Fluxo</Button>
      </div>

      {/* Abas */}
      <div className="flex gap-1 border-b border-white/10 -mb-2">
        {([
          { key: 'flows',       label: 'Fluxos',      icon: <Zap size={14} /> },
          { key: 'logs',        label: 'Logs',         icon: <Activity size={14} /> },
          { key: 'subscribers', label: 'Subscribers',  icon: <Users size={14} /> },
        ] as { key: ActiveTab; label: string; icon: React.ReactNode }[]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.key
                ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
                : 'border-transparent text-muted hover:text-white'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'flows' && (
        isLoading ? (
          <p className="text-muted text-center py-16">Carregando...</p>
        ) : flows.length === 0 ? (
          <EmptyState onNew={openNew} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {flows.map(f => (
              <FlowCard
                key={f.id}
                flow={f}
                subscriberCount={countFor(f.id)}
                onEdit={openEdit}
                onToggle={toggleFlow}
                onDelete={deleteFlow}
              />
            ))}
          </div>
        )
      )}

      {activeTab === 'logs' && <LogsTab />}
      {activeTab === 'subscribers' && <SubscribersTab />}
    </div>
  );
}

// ── Aba de Logs ────────────────────────────────────────────────

function LogsTab() {
  const { data, isLoading, mutate: refetch } = useSWR(`${API}/webhook-log?limit=200`);
  const logs: WebhookLogEntry[] = data || [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted">Últimos 200 eventos recebidos pelo webhook.</p>
        <button onClick={() => refetch()} className="text-xs text-muted hover:text-white transition-colors underline">
          Atualizar
        </button>
      </div>
      {isLoading ? (
        <p className="text-muted text-center py-16">Carregando...</p>
      ) : logs.length === 0 ? (
        <p className="text-muted text-center py-16">Nenhum evento registrado ainda.</p>
      ) : (
        <div className="glass-panel rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs text-muted uppercase">
                <th className="text-left px-4 py-3">Data</th>
                <th className="text-left px-4 py-3">Tipo</th>
                <th className="text-left px-4 py-3">Conteúdo</th>
                <th className="text-left px-4 py-3">Flow</th>
                <th className="text-center px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-4 py-2.5 text-xs text-muted whitespace-nowrap">{formatDate(log.received_at)}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant={log.event_type === 'comment' ? 'neutral' : 'info'}>
                      {log.event_type === 'comment' ? 'Comentário' : 'DM'}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-xs max-w-[200px] truncate" title={log.content}>{log.content || '—'}</td>
                  <td className="px-4 py-2.5">
                    {log.rule_matched ? (
                      <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs text-[var(--accent-primary)]">"{log.rule_matched}"</code>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {log.error ? (
                      <span className="text-xs text-red-400" title={log.error}>Erro</span>
                    ) : log.replied ? (
                      <span className="text-xs text-green-400">Enviado</span>
                    ) : (
                      <span className="text-xs text-muted">Ignorado</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Aba de Subscribers ─────────────────────────────────────────

function SubscribersTab() {
  const { data, isLoading } = useSWR(`${API}/subscribers`);
  const subscribers: Subscriber[] = data || [];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">Pessoas que clicaram no botão de opt-in e aceitaram receber mensagens.</p>
      {isLoading ? (
        <p className="text-muted text-center py-16">Carregando...</p>
      ) : subscribers.length === 0 ? (
        <p className="text-muted text-center py-16">Nenhum subscriber ainda. Crie um flow com botão de opt-in para começar.</p>
      ) : (
        <div className="glass-panel rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs text-muted uppercase">
                <th className="text-left px-4 py-3">ID Instagram</th>
                <th className="text-left px-4 py-3">Flow</th>
                <th className="text-left px-4 py-3">Opt-in em</th>
                <th className="text-center px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {subscribers.map(sub => (
                <tr key={sub.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-xs">{sub.sender_id}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <Zap size={11} className="text-yellow-400" />
                      <span className="text-xs">{sub.flow_name || sub.flow_id}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted">{formatDate(sub.opted_in_at)}</td>
                  <td className="px-4 py-2.5 text-center">
                    <Badge variant={sub.status === 'active' ? 'success' : 'neutral'}>{sub.status === 'active' ? 'Ativo' : 'Cancelado'}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Card do Fluxo na listagem ──────────────────────────────────

function FlowCard({ flow, subscriberCount, onEdit, onToggle, onDelete }: {
  flow: Flow;
  subscriberCount: number;
  onEdit: (f: Flow) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const steps = flow.steps || [];
  const cooldownLabel = COOLDOWN_OPTIONS.find(o => o.value === (flow.cooldown_hours ?? 24))?.label ?? `${flow.cooldown_hours}h`;

  return (
    <div className={`glass-panel rounded-xl border-l-4 p-5 ${flow.active ? 'border-[var(--success)]' : 'border-gray-600'}`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant={flow.active ? 'success' : 'neutral'}>{flow.active ? 'Ativo' : 'Pausado'}</Badge>
            <span className="font-semibold text-sm truncate">{flow.name || '(sem nome)'}</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <Zap size={12} className="text-yellow-400" />
              <span>Gatilho:</span>
              <code className="bg-white/10 px-1.5 py-0.5 rounded font-mono text-[var(--accent-primary)]">"{flow.trigger_keyword}"</code>
            </div>
            {subscriberCount > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted">
                <Users size={11} className="text-emerald-400" />
                <span className="text-emerald-400 font-semibold">{subscriberCount}</span>
                <span>sub{subscriberCount !== 1 ? 's' : ''}</span>
              </div>
            )}
            <div className="flex items-center gap-1 text-xs text-muted">
              <Clock size={11} />
              <span>{cooldownLabel}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => onEdit(flow)} className="p-2 rounded-lg text-muted hover:text-white hover:bg-white/5 transition-colors" title="Editar">
            <Pencil size={15} />
          </button>
          <button onClick={() => onToggle(flow.id)} className="p-2 rounded-lg text-muted hover:text-white hover:bg-white/5 transition-colors" title={flow.active ? 'Pausar' : 'Ativar'}>
            <Power size={15} className={flow.active ? 'text-[var(--success)]' : ''} />
          </button>
          <button onClick={() => onDelete(flow.id)} className="p-2 rounded-lg text-muted hover:text-[var(--danger)] hover:bg-white/5 transition-colors" title="Excluir">
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Mini flow preview */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <div className="flex items-center gap-1 text-xs bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2 py-1 rounded-lg">
          <Zap size={11} />
          <span>"{flow.trigger_keyword}"</span>
        </div>
        {steps.map((step) => (
          <React.Fragment key={step.id}>
            <ChevronRight size={12} className="text-muted shrink-0" />
            {step.delay_seconds && step.delay_seconds > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted border border-white/10 px-1.5 py-1 rounded-lg">
                <Timer size={10} />
                <span>{step.delay_seconds >= 60 ? `${Math.round(step.delay_seconds / 60)}min` : `${step.delay_seconds}s`}</span>
              </div>
            )}
            <div className={`flex items-center gap-1 text-xs border px-2 py-1 rounded-lg ${STEP_META[step.type]?.color}`}>
              {STEP_META[step.type]?.icon}
              <span>{STEP_META[step.type]?.label}</span>
              {step.buttons && step.buttons.length > 0 && (
                <span className="bg-white/10 rounded px-1">{step.buttons.length}</span>
              )}
            </div>
          </React.Fragment>
        ))}
        {steps.length === 0 && <span className="text-xs text-muted italic">Sem passos</span>}
      </div>
    </div>
  );
}

// ── Editor de Fluxo ────────────────────────────────────────────

function FlowEditor({ flow: initial, isNew, onSave, onCancel }: {
  flow: Flow;
  isNew: boolean;
  onSave: (f: Flow) => void;
  onCancel: () => void;
}) {
  const [flow, setFlow] = useState<Flow>(initial);
  const [saving, setSaving] = useState(false);
  const [addingStep, setAddingStep] = useState(false);

  const updateFlow = (patch: Partial<Flow>) => setFlow(f => ({ ...f, ...patch }));

  const addStep = (type: StepType) => {
    const step: FlowStep = { id: uid(), type, text: '', buttons: [], delay_seconds: 0 };
    setFlow(f => ({ ...f, steps: [...f.steps, step] }));
    setAddingStep(false);
  };

  const updateStep = (id: string, patch: Partial<FlowStep>) => {
    setFlow(f => ({ ...f, steps: f.steps.map(s => s.id === id ? { ...s, ...patch } : s) }));
  };

  const removeStep = (id: string) => {
    setFlow(f => ({ ...f, steps: f.steps.filter(s => s.id !== id) }));
  };

  const moveStep = (id: string, dir: -1 | 1) => {
    setFlow(f => {
      const steps = [...f.steps];
      const i = steps.findIndex(s => s.id === id);
      if (i + dir < 0 || i + dir >= steps.length) return f;
      [steps[i], steps[i + dir]] = [steps[i + dir], steps[i]];
      return { ...f, steps };
    });
  };

  const handleSave = async () => {
    if (!flow.trigger_keyword.trim()) return;
    if (flow.steps.length === 0) return;
    setSaving(true);
    await onSave({ ...flow, name: flow.name || `Fluxo "${flow.trigger_keyword}"` });
    setSaving(false);
  };

  const valid = flow.trigger_keyword.trim() && flow.steps.length > 0 &&
    flow.steps.every(s => !!s.text.trim());

  const hasQRBeforeEnd = flow.steps.some((s, i) =>
    i < flow.steps.length - 1 && (s.buttons || []).some(b => b.type === 'quick_reply')
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">{isNew ? 'Novo Fluxo' : 'Editar Fluxo'}</h1>
          <p className="text-muted text-sm">Monte os passos que serão executados em sequência.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onCancel} icon={<X size={16} />}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!valid || saving} icon={<CheckCircle2 size={16} />}>
            {saving ? 'Salvando...' : 'Salvar Fluxo'}
          </Button>
        </div>
      </div>

      {/* Config do fluxo */}
      <div className="glass-panel rounded-xl p-5 flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Nome do fluxo"
            placeholder='Ex: "Fluxo Vendas", "Download Grátis"'
            value={flow.name}
            onChange={e => updateFlow({ name: e.target.value })}
          />
          <Input
            label="Palavra-chave gatilho"
            placeholder='Ex: "QUERO", "LINK", "INFO"'
            value={flow.trigger_keyword}
            onChange={e => updateFlow({ trigger_keyword: e.target.value })}
            autoFocus={isNew}
          />
        </div>

        {/* Cooldown */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted flex items-center gap-1.5">
            <Clock size={12} /> Cooldown (mesma pessoa não dispara de novo antes de:)
          </label>
          <div className="flex flex-wrap gap-2">
            {COOLDOWN_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => updateFlow({ cooldown_hours: opt.value })}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  flow.cooldown_hours === opt.value
                    ? 'border-[var(--accent-primary)] text-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                    : 'border-white/15 text-muted hover:text-white hover:border-white/30'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {flow.trigger_keyword && (
          <p className="text-xs text-muted flex items-center gap-1.5">
            <Zap size={12} className="text-yellow-400" />
            Dispara quando alguém comentar algo contendo <code className="bg-white/10 px-1 rounded">"{flow.trigger_keyword}"</code>
          </p>
        )}
      </div>

      {/* Passos */}
      <div className="flex flex-col gap-3">
        {flow.steps.map((step, idx) => (
          <React.Fragment key={step.id}>
            {idx > 0 && (
              <div className="flex justify-center">
                <ArrowDown size={18} className="text-muted" />
              </div>
            )}
            <StepBlock
              step={step}
              index={idx}
              total={flow.steps.length}
              onUpdate={p => updateStep(step.id, p)}
              onRemove={() => removeStep(step.id)}
              onMove={dir => moveStep(step.id, dir)}
            />
          </React.Fragment>
        ))}

        {/* Botão de adicionar passo */}
        {!addingStep ? (
          <div className="flex justify-center mt-2">
            <button
              onClick={() => setAddingStep(true)}
              className="flex items-center gap-2 text-sm text-muted hover:text-white border border-dashed border-white/20 hover:border-white/40 rounded-xl px-5 py-3 transition-colors"
            >
              <Plus size={16} /> Adicionar passo
            </button>
          </div>
        ) : (
          <div className="glass-panel rounded-xl p-4">
            <p className="text-xs font-bold uppercase text-muted mb-3">Escolha o tipo de passo:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(Object.entries(STEP_META) as [StepType, typeof STEP_META[StepType]][]).map(([type, meta]) => (
                <button
                  key={type}
                  onClick={() => addStep(type)}
                  className={`flex items-start gap-3 p-4 rounded-xl border transition-all text-left hover:scale-[1.01] ${meta.color}`}
                >
                  <span className="mt-0.5">{meta.icon}</span>
                  <div>
                    <p className="font-semibold text-sm">{meta.label}</p>
                    <p className="text-xs opacity-70 mt-0.5">{meta.desc}</p>
                  </div>
                </button>
              ))}
            </div>
            <button onClick={() => setAddingStep(false)} className="mt-3 text-xs text-muted hover:text-white transition-colors">
              Cancelar
            </button>
          </div>
        )}
      </div>

      {/* Avisos */}
      {!valid && flow.steps.length > 0 && (
        <p className="text-xs text-amber-400 flex items-center gap-1.5">
          <AlertTriangle size={13} /> Preencha o texto de todos os passos antes de salvar.
        </p>
      )}
      {hasQRBeforeEnd && (
        <p className="text-xs text-orange-300 flex items-start gap-1.5">
          <AlertTriangle size={13} className="shrink-0 mt-0.5" />
          Há um botão de opt-in antes do último passo. Os passos seguintes só serão enviados após o usuário clicar.
        </p>
      )}

      {/* Dica de uso */}
      {flow.steps.length === 0 && (
        <div className="glass-panel rounded-xl p-4 border border-white/5">
          <p className="text-xs font-semibold mb-2 text-[var(--accent-primary)]">Fluxo recomendado (estilo ManyChat):</p>
          <ol className="text-xs text-muted flex flex-col gap-1 list-decimal list-inside">
            <li>Passo <strong>Reply no Comentário</strong> → "Oi! Te enviei uma mensagem no direct 😊"</li>
            <li>Passo <strong>DM</strong> com botão <strong>Opt-in</strong> → "Clique em 'Quero' para receber o link"</li>
            <li>Passo <strong>DM</strong> com conteúdo → enviado só após o clique no opt-in</li>
          </ol>
        </div>
      )}
    </div>
  );
}

// ── Bloco de passo ─────────────────────────────────────────────

function StepBlock({ step, index, total, onUpdate, onRemove, onMove }: {
  step: FlowStep;
  index: number;
  total: number;
  onUpdate: (p: Partial<FlowStep>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const meta = STEP_META[step.type];
  const delayMinutes = step.delay_seconds ? Math.round(step.delay_seconds / 60) : 0;

  const addButton = (type: ButtonType) => {
    onUpdate({ buttons: [...(step.buttons || []), { id: uid(), type, title: '', url: '' }] });
  };

  const updateButton = (id: string, patch: Partial<FlowButton>) => {
    onUpdate({ buttons: (step.buttons || []).map(b => b.id === id ? { ...b, ...patch } : b) });
  };

  const removeButton = (id: string) => {
    onUpdate({ buttons: (step.buttons || []).filter(b => b.id !== id) });
  };

  const hasOptIn = (step.buttons || []).some(b => b.type === 'quick_reply');

  return (
    <div className={`rounded-xl border p-5 ${meta.color} bg-opacity-10`}>
      {/* Header do passo */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-white/10 text-white text-xs font-bold flex items-center justify-center">{index + 1}</span>
          {meta.icon}
          <span className="font-semibold text-sm">{meta.label}</span>
          {hasOptIn && (
            <span className="text-xs bg-orange-500/20 text-orange-300 border border-orange-500/30 px-2 py-0.5 rounded-full">opt-in</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {index > 0 && (
            <button onClick={() => onMove(-1)} className="p-1.5 rounded hover:bg-white/10 transition-colors text-muted hover:text-white" title="Mover para cima">
              <GripVertical size={14} className="rotate-90" />
            </button>
          )}
          {index < total - 1 && (
            <button onClick={() => onMove(1)} className="p-1.5 rounded hover:bg-white/10 transition-colors text-muted hover:text-white" title="Mover para baixo">
              <GripVertical size={14} className="-rotate-90" />
            </button>
          )}
          <button onClick={onRemove} className="p-1.5 rounded hover:bg-red-500/20 text-muted hover:text-red-400 transition-colors" title="Remover passo">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Delay antes do passo */}
      {index > 0 && (
        <div className="flex items-center gap-2 mb-3 p-2.5 rounded-lg bg-white/5 border border-white/10">
          <Timer size={13} className="text-muted shrink-0" />
          <span className="text-xs text-muted">Aguardar</span>
          <input
            type="number"
            min={0}
            max={1440}
            className="input-field text-xs py-1 px-2 w-20 text-center"
            value={delayMinutes}
            onChange={e => onUpdate({ delay_seconds: Math.max(0, parseInt(e.target.value) || 0) * 60 })}
          />
          <span className="text-xs text-muted">minutos antes de enviar</span>
          {delayMinutes > 0 && <span className="text-xs text-blue-400 ml-auto">⏳ {delayMinutes}min de delay</span>}
        </div>
      )}

      {/* Texto do passo */}
      <textarea
        className="input-field w-full p-3 resize-none h-24 text-sm mb-4"
        placeholder={step.type === 'comment_reply'
          ? 'Ex: Oi! Te enviei uma mensagem no direct 😊'
          : 'Ex: Olá! Aqui está o conteúdo que você pediu...'}
        value={step.text}
        onChange={e => onUpdate({ text: e.target.value })}
      />

      {/* Botões (só para DM) */}
      {step.type === 'dm' && (
        <div className="flex flex-col gap-3">
          {(step.buttons || []).map(btn => (
            <ButtonRow
              key={btn.id}
              btn={btn}
              onChange={p => updateButton(btn.id, p)}
              onRemove={() => removeButton(btn.id)}
            />
          ))}

          {(step.buttons || []).length < 3 && (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => addButton('url')}
                className="flex items-center gap-1.5 text-xs border border-dashed border-white/20 hover:border-emerald-400/50 text-muted hover:text-emerald-400 rounded-lg px-3 py-2 transition-colors"
              >
                <Link2 size={13} /> + Botão com Link
              </button>
              <button
                onClick={() => addButton('quick_reply')}
                className="flex items-center gap-1.5 text-xs border border-dashed border-white/20 hover:border-orange-400/50 text-muted hover:text-orange-400 rounded-lg px-3 py-2 transition-colors"
              >
                <MousePointerClick size={13} /> + Botão de Opt-in
              </button>
            </div>
          )}

          {hasOptIn && (
            <div className="rounded-lg bg-orange-500/5 border border-orange-500/20 p-3">
              <p className="text-xs text-orange-300 flex items-start gap-1.5">
                <MousePointerClick size={12} className="shrink-0 mt-0.5" />
                <span><strong>Opt-in ativo:</strong> O sistema para aqui e só envia os próximos passos quando o usuário clicar neste botão. Isso respeita as regras da Meta sobre primeira mensagem.</span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Linha de botão ─────────────────────────────────────────────

function ButtonRow({ btn, onChange, onRemove }: {
  btn: FlowButton;
  onChange: (p: Partial<FlowButton>) => void;
  onRemove: () => void;
}) {
  const isUrl = btn.type === 'url';
  return (
    <div className={`rounded-lg border p-3 flex flex-col gap-2 ${isUrl ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-orange-500/30 bg-orange-500/5'}`}>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-bold flex items-center gap-1.5 ${isUrl ? 'text-emerald-400' : 'text-orange-400'}`}>
          {isUrl ? <Link2 size={12} /> : <MousePointerClick size={12} />}
          {isUrl ? 'Botão com Link' : 'Botão de Opt-in'}
        </span>
        <button onClick={onRemove} className="text-muted hover:text-red-400 transition-colors p-1">
          <X size={13} />
        </button>
      </div>
      <input
        className="input-field text-sm py-1.5 px-2"
        placeholder="Texto do botão (máx. 20 caracteres)"
        maxLength={20}
        value={btn.title}
        onChange={e => onChange({ title: e.target.value })}
      />
      {isUrl && (
        <input
          className="input-field text-sm py-1.5 px-2"
          placeholder="URL  (https://...)"
          value={btn.url || ''}
          onChange={e => onChange({ url: e.target.value })}
        />
      )}
    </div>
  );
}

// ── Estado vazio ───────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="text-center py-24 glass-panel rounded-xl flex flex-col items-center gap-4">
      <div className="w-16 h-16 rounded-full bg-[var(--accent-primary)]/10 flex items-center justify-center">
        <Zap size={28} className="text-[var(--accent-primary)]" />
      </div>
      <div>
        <p className="font-semibold mb-1">Nenhum fluxo criado ainda</p>
        <p className="text-muted text-sm">Crie um fluxo para automatizar respostas a comentários do Instagram.</p>
      </div>
      <Button onClick={onNew} icon={<Plus size={16} />}>Criar primeiro fluxo</Button>
    </div>
  );
}
