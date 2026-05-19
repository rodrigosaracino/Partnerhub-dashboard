import React, { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Badge } from '../components/Badge';
import { getToken } from './Login';
import {
  Plus, Trash2, Power, MessageCircle, Send, Link2, MousePointerClick,
  ArrowDown, ChevronRight, Pencil, X, GripVertical, CheckCircle2,
  Zap, AlertTriangle, Clock, Users, Activity, Timer, Image, Eye,
  Megaphone, Loader2,
} from 'lucide-react';

// ── Tipos ──────────────────────────────────────────────────────

type ButtonType = 'url' | 'quick_reply';
type StepType = 'comment_reply' | 'dm' | 'image' | 'wait';
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
  image_url?: string;
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
  name?: string;
  profile_pic?: string;
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
  comment_reply: {
    label: 'Reply no Comentário',
    icon: <MessageCircle size={15} />,
    color: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    desc: 'Resposta pública visível para todos no post',
  },
  dm: {
    label: 'Mensagem na DM',
    icon: <Send size={15} />,
    color: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    desc: 'Mensagem privada com texto e/ou botões',
  },
  image: {
    label: 'Imagem na DM',
    icon: <Image size={15} />,
    color: 'text-pink-400 bg-pink-500/10 border-pink-500/30',
    desc: 'Envia uma imagem (e legenda opcional) na DM',
  },
  wait: {
    label: 'Aguardar',
    icon: <Timer size={15} />,
    color: 'text-gray-400 bg-gray-500/10 border-gray-500/30',
    desc: 'Pausa o fluxo por um tempo antes de continuar',
  },
};

const COOLDOWN_OPTIONS = [
  { value: 0,   label: 'Sem cooldown' },
  { value: 1,   label: '1 hora' },
  { value: 6,   label: '6 horas' },
  { value: 24,  label: '24 horas' },
  { value: 72,  label: '3 dias' },
  { value: 168, label: '7 dias' },
  { value: -1,  label: 'Nunca repetir' },
];

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

function fmtDelay(seconds: number) {
  if (!seconds || seconds <= 0) return null;
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
  return `${Math.round(seconds / 3600)}h`;
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
  const [broadcastFlow, setBroadcastFlow] = useState<Flow | null>(null);

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
    return <FlowEditor flow={editing} isNew={isNew} onSave={saveFlow} onCancel={closeEditor} />;
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
          { key: 'flows',       label: 'Fluxos',     icon: <Zap size={14} /> },
          { key: 'logs',        label: 'Logs',        icon: <Activity size={14} /> },
          { key: 'subscribers', label: 'Subscribers', icon: <Users size={14} /> },
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
                onBroadcast={() => setBroadcastFlow(f)}
              />
            ))}
          </div>
        )
      )}

      {activeTab === 'logs' && <LogsTab />}
      {activeTab === 'subscribers' && <SubscribersTab />}

      {broadcastFlow && (
        <BroadcastModal
          flow={broadcastFlow}
          subscriberCount={countFor(broadcastFlow.id)}
          onClose={() => setBroadcastFlow(null)}
        />
      )}
    </div>
  );
}

// ── Subscriber preview bar (usado no Broadcast Modal) ─────────

function SubscriberPreviewBar({ flowId, total, flowName }: { flowId: string; total: number; flowName: string }) {
  const { data } = useSWR(`${API}/subscribers`);
  const all: Subscriber[] = data || [];
  const flowSubs = all.filter(s => s.flow_id === flowId).slice(0, 5);

  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-3 flex items-center gap-3">
      <div className="flex -space-x-2">
        {flowSubs.length > 0
          ? flowSubs.map(s => <Avatar key={s.id} name={s.name} src={s.profile_pic} size={28} />)
          : <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center"><Users size={13} className="text-muted" /></div>}
        {total > 5 && (
          <div className="w-7 h-7 rounded-full bg-white/20 border border-white/10 flex items-center justify-center text-[10px] font-bold text-muted">
            +{total - 5}
          </div>
        )}
      </div>
      <div>
        <p className="text-sm font-semibold">{total} subscriber{total !== 1 ? 's' : ''}</p>
        <p className="text-xs text-muted">Flow: {flowName}</p>
      </div>
    </div>
  );
}

// ── Broadcast Modal ────────────────────────────────────────────

function BroadcastModal({ flow, subscriberCount, onClose }: {
  flow: Flow;
  subscriberCount: number;
  onClose: () => void;
}) {
  const [message, setMessage] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ total: number; status: string } | null>(null);

  const handleSend = async () => {
    if (!message.trim() && !imageUrl.trim()) return;
    if (!confirm(`Enviar mensagem para ${subscriberCount} subscribers de "${flow.name}"?`)) return;
    setSending(true);
    try {
      const r = await authFetch(`${API}/flows/${flow.id}/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim() || undefined, image_url: imageUrl.trim() || undefined }),
      });
      const d = await r.json();
      setResult(d);
    } catch {
      setResult({ total: 0, status: 'error' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="glass-panel rounded-2xl w-full max-w-md p-6 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Megaphone size={18} className="text-[var(--accent-primary)]" />
            <h2 className="font-bold">Broadcast</h2>
          </div>
          <button onClick={onClose} className="text-muted hover:text-white transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        <SubscriberPreviewBar flowId={flow.id} total={subscriberCount} flowName={flow.name || flow.trigger_keyword} />

        {result ? (
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-center">
            <CheckCircle2 size={24} className="text-emerald-400 mx-auto mb-2" />
            <p className="font-semibold text-emerald-300">Broadcast enviado!</p>
            <p className="text-xs text-muted mt-1">{result.total} mensagen{result.total !== 1 ? 's' : ''} em processamento</p>
            <button onClick={onClose} className="mt-3 text-xs text-muted hover:text-white underline">Fechar</button>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">URL da imagem (opcional)</label>
                <input
                  className="input-field text-sm py-2 px-3"
                  placeholder="https://... (jpg, png, gif)"
                  value={imageUrl}
                  onChange={e => setImageUrl(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">Mensagem</label>
                <textarea
                  className="input-field w-full p-3 resize-none h-28 text-sm"
                  placeholder="Escreva aqui a mensagem do broadcast..."
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                />
              </div>
            </div>

            <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3">
              <p className="text-xs text-amber-300 flex items-start gap-1.5">
                <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                Broadcasts só funcionam dentro da janela de 24h após a última interação do usuário (regra da Meta). Fora desta janela, a API pode recusar o envio.
              </p>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={onClose} icon={<X size={15} />}>Cancelar</Button>
              <Button
                onClick={handleSend}
                disabled={sending || (!message.trim() && !imageUrl.trim()) || subscriberCount === 0}
                icon={sending ? <Loader2 size={15} className="animate-spin" /> : <Megaphone size={15} />}
              >
                {sending ? 'Enviando...' : `Enviar para ${subscriberCount}`}
              </Button>
            </div>
          </>
        )}
      </div>
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
        <button onClick={() => refetch()} className="text-xs text-muted hover:text-white transition-colors underline">Atualizar</button>
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
                    {log.rule_matched
                      ? <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs text-[var(--accent-primary)]">"{log.rule_matched}"</code>
                      : <span className="text-xs text-muted">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {log.error
                      ? <span className="text-xs text-red-400" title={log.error}>Erro</span>
                      : log.replied
                        ? <span className="text-xs text-green-400">Enviado</span>
                        : <span className="text-xs text-muted">Ignorado</span>}
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

// ── Avatar component ───────────────────────────────────────────

function Avatar({ name, src, size = 32 }: { name?: string; src?: string; size?: number }) {
  const initials = name
    ? name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';
  const colors = ['bg-pink-500', 'bg-purple-500', 'bg-blue-500', 'bg-emerald-500', 'bg-orange-500', 'bg-yellow-500'];
  const color = colors[(initials.charCodeAt(0) || 0) % colors.length];

  if (src) {
    return (
      <img
        src={src}
        alt={name || ''}
        style={{ width: size, height: size }}
        className="rounded-full object-cover shrink-0 ring-1 ring-white/10"
        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      className={`rounded-full shrink-0 flex items-center justify-center font-bold text-white ${color}`}
    >
      {initials}
    </div>
  );
}

// ── Aba de Subscribers ─────────────────────────────────────────

function SubscribersTab() {
  const { data, isLoading, mutate: refetch } = useSWR(`${API}/subscribers`);
  const subscribers: Subscriber[] = data || [];
  const [enriching, setEnriching] = useState(false);
  const [enrichResult, setEnrichResult] = useState<{ enriched: number; total: number } | null>(null);

  const withoutName = subscribers.filter(s => !s.name).length;

  const handleEnrich = async () => {
    setEnriching(true);
    setEnrichResult(null);
    try {
      const r = await authFetch(`${API}/subscribers/enrich`, { method: 'POST' });
      const d = await r.json();
      setEnrichResult(d);
      await refetch();
    } finally {
      setEnriching(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          Pessoas que clicaram no botão de opt-in.
          {subscribers.length > 0 && <span className="ml-1 text-white font-medium">{subscribers.length} total</span>}
        </p>
        <div className="flex items-center gap-3">
          {enrichResult && (
            <span className="text-xs text-emerald-400">{enrichResult.enriched} perfis atualizados</span>
          )}
          {withoutName > 0 && (
            <button
              onClick={handleEnrich}
              disabled={enriching}
              className="flex items-center gap-1.5 text-xs border border-white/15 hover:border-white/30 text-muted hover:text-white rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
            >
              {enriching ? <Loader2 size={12} className="animate-spin" /> : <Users size={12} />}
              {enriching ? 'Buscando...' : `Buscar nomes (${withoutName})`}
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted text-center py-16">Carregando...</p>
      ) : subscribers.length === 0 ? (
        <p className="text-muted text-center py-16">Nenhum subscriber ainda. Crie um flow com botão de opt-in para começar.</p>
      ) : (
        <div className="glass-panel rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs text-muted uppercase">
                <th className="text-left px-4 py-3">Pessoa</th>
                <th className="text-left px-4 py-3">Flow</th>
                <th className="text-left px-4 py-3">Opt-in em</th>
                <th className="text-center px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {subscribers.map(sub => (
                <tr key={sub.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={sub.name} src={sub.profile_pic} size={34} />
                      <div className="min-w-0">
                        {sub.name
                          ? <p className="text-sm font-medium truncate">{sub.name}</p>
                          : <p className="text-xs text-muted italic">Nome não carregado</p>}
                        <p className="text-[11px] text-muted font-mono truncate">{sub.sender_id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <Zap size={11} className="text-yellow-400 shrink-0" />
                      <span className="text-xs truncate max-w-[120px]">{sub.flow_name || sub.flow_id}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted whitespace-nowrap">{formatDate(sub.opted_in_at)}</td>
                  <td className="px-4 py-2.5 text-center">
                    <Badge variant={sub.status === 'active' ? 'success' : 'neutral'}>
                      {sub.status === 'active' ? 'Ativo' : 'Cancelado'}
                    </Badge>
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

function FlowCard({ flow, subscriberCount, onEdit, onToggle, onDelete, onBroadcast }: {
  flow: Flow;
  subscriberCount: number;
  onEdit: (f: Flow) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onBroadcast: () => void;
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
              <Clock size={11} /><span>{cooldownLabel}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {subscriberCount > 0 && (
            <button onClick={onBroadcast} className="p-2 rounded-lg text-muted hover:text-[var(--accent-primary)] hover:bg-white/5 transition-colors" title="Broadcast">
              <Megaphone size={15} />
            </button>
          )}
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
          <Zap size={11} /><span>"{flow.trigger_keyword}"</span>
        </div>
        {steps.map(step => (
          <React.Fragment key={step.id}>
            <ChevronRight size={12} className="text-muted shrink-0" />
            {step.delay_seconds && step.delay_seconds > 0 && step.type !== 'wait' && (
              <div className="flex items-center gap-1 text-xs text-muted border border-white/10 px-1.5 py-1 rounded-lg">
                <Timer size={10} /><span>{fmtDelay(step.delay_seconds)}</span>
              </div>
            )}
            <div className={`flex items-center gap-1 text-xs border px-2 py-1 rounded-lg ${STEP_META[step.type]?.color}`}>
              {STEP_META[step.type]?.icon}
              {step.type === 'wait'
                ? <span>{fmtDelay(step.delay_seconds ?? 0) ?? '?'}</span>
                : <span>{STEP_META[step.type]?.label}</span>}
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
  const [showPreview, setShowPreview] = useState(false);

  const updateFlow = (patch: Partial<Flow>) => setFlow(f => ({ ...f, ...patch }));

  const addStep = (type: StepType) => {
    const step: FlowStep = { id: uid(), type, text: '', buttons: [], delay_seconds: 0, image_url: '' };
    setFlow(f => ({ ...f, steps: [...f.steps, step] }));
    setAddingStep(false);
  };

  const updateStep = (id: string, patch: Partial<FlowStep>) =>
    setFlow(f => ({ ...f, steps: f.steps.map(s => s.id === id ? { ...s, ...patch } : s) }));

  const removeStep = (id: string) =>
    setFlow(f => ({ ...f, steps: f.steps.filter(s => s.id !== id) }));

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
    setSaving(true);
    await onSave({ ...flow, name: flow.name || `Fluxo "${flow.trigger_keyword}"` });
    setSaving(false);
  };

  const valid = flow.trigger_keyword.trim() && flow.steps.length > 0 &&
    flow.steps.every(s => {
      if (s.type === 'wait') return (s.delay_seconds ?? 0) > 0;
      if (s.type === 'image') return !!(s.image_url?.trim());
      return !!s.text.trim();
    });

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
          <Button variant="ghost" onClick={() => setShowPreview(v => !v)} icon={<Eye size={15} />}>
            {showPreview ? 'Fechar preview' : 'Preview'}
          </Button>
          <Button variant="ghost" onClick={onCancel} icon={<X size={16} />}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!valid || saving} icon={<CheckCircle2 size={16} />}>
            {saving ? 'Salvando...' : 'Salvar Fluxo'}
          </Button>
        </div>
      </div>

      <div className={`flex gap-5 ${showPreview ? 'items-start' : ''}`}>
        {/* Coluna principal */}
        <div className="flex flex-col gap-5 flex-1 min-w-0">
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
                <Clock size={12} /> Cooldown (mesma pessoa só dispara de novo após:)
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
                Dispara quando alguém comentar algo contendo{' '}
                <code className="bg-white/10 px-1 rounded">"{flow.trigger_keyword}"</code>
              </p>
            )}
          </div>

          {/* Passos */}
          <div className="flex flex-col gap-3">
            {flow.steps.map((step, idx) => (
              <React.Fragment key={step.id}>
                {idx > 0 && <div className="flex justify-center"><ArrowDown size={18} className="text-muted" /></div>}
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
                <div className="grid grid-cols-2 gap-3">
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

          {!valid && flow.steps.length > 0 && (
            <p className="text-xs text-amber-400 flex items-center gap-1.5">
              <AlertTriangle size={13} /> Preencha todos os campos obrigatórios antes de salvar.
            </p>
          )}
          {hasQRBeforeEnd && (
            <p className="text-xs text-orange-300 flex items-start gap-1.5">
              <AlertTriangle size={13} className="shrink-0 mt-0.5" />
              Há um botão de opt-in antes do último passo — os passos seguintes só serão enviados após o clique.
            </p>
          )}

          {flow.steps.length === 0 && (
            <div className="glass-panel rounded-xl p-4 border border-white/5">
              <p className="text-xs font-semibold mb-2 text-[var(--accent-primary)]">Fluxo recomendado (estilo ManyChat):</p>
              <ol className="text-xs text-muted flex flex-col gap-1 list-decimal list-inside">
                <li>Passo <strong>Reply no Comentário</strong> → "Oi! Te enviei uma mensagem 😊"</li>
                <li>Passo <strong>DM</strong> com botão <strong>Opt-in</strong> → "Clique em 'Quero' para receber"</li>
                <li>Passo <strong>DM</strong> ou <strong>Imagem</strong> → conteúdo entregue após o clique</li>
              </ol>
            </div>
          )}
        </div>

        {/* Preview lateral */}
        {showPreview && (
          <FlowPreview flow={flow} />
        )}
      </div>
    </div>
  );
}

// ── Preview do Fluxo ───────────────────────────────────────────

function FlowPreview({ flow }: { flow: Flow }) {
  if (flow.steps.length === 0) {
    return (
      <div className="glass-panel rounded-xl p-5 w-72 shrink-0 flex items-center justify-center text-muted text-sm">
        Adicione passos para ver o preview
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-xl p-4 w-72 shrink-0 flex flex-col gap-3">
      <div className="flex items-center gap-2 mb-1">
        <Eye size={14} className="text-muted" />
        <span className="text-xs font-semibold text-muted uppercase">Preview do fluxo</span>
      </div>

      {/* Gatilho */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-yellow-500/20 flex items-center justify-center shrink-0">
          <Zap size={12} className="text-yellow-400" />
        </div>
        <div className="rounded-xl rounded-tl-sm bg-white/10 px-3 py-2 text-xs flex-1">
          Alguém comenta <strong>"{flow.trigger_keyword || '...'}"</strong>
        </div>
      </div>

      {/* Steps */}
      {flow.steps.map((step, idx) => {
        const meta = STEP_META[step.type];
        const delay = fmtDelay(step.delay_seconds ?? 0);
        const hasOptIn = step.type === 'dm' && (step.buttons || []).some(b => b.type === 'quick_reply');
        const isPublic = step.type === 'comment_reply';

        return (
          <React.Fragment key={step.id}>
            {/* Delay indicator */}
            {delay && step.type !== 'wait' && (
              <div className="flex items-center gap-1.5 px-2 text-xs text-muted">
                <div className="flex-1 border-t border-dashed border-white/10" />
                <Timer size={10} />
                <span>aguarda {delay}</span>
                <div className="flex-1 border-t border-dashed border-white/10" />
              </div>
            )}

            {/* Wait step */}
            {step.type === 'wait' && (
              <div className="flex items-center gap-2 text-xs text-muted px-2 py-1">
                <div className="flex-1 border-t border-dashed border-white/10" />
                <Timer size={10} className="text-gray-400" />
                <span>aguarda {fmtDelay(step.delay_seconds ?? 0) ?? '?'}</span>
                <div className="flex-1 border-t border-dashed border-white/10" />
              </div>
            )}

            {/* Message bubble */}
            {step.type !== 'wait' && (
              <div className="flex items-start gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${meta.color}`}>
                  {meta.icon}
                </div>
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                  {step.type === 'image' && step.image_url && (
                    <div className="rounded-xl overflow-hidden bg-white/5 border border-white/10 aspect-video flex items-center justify-center">
                      <img
                        src={step.image_url}
                        alt="preview"
                        className="w-full h-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </div>
                  )}
                  {(step.text || step.type !== 'image') && step.text && (
                    <div className={`rounded-xl px-3 py-2 text-xs whitespace-pre-wrap ${
                      isPublic
                        ? 'bg-purple-500/10 border border-purple-500/20 text-purple-200'
                        : 'bg-white/10 text-white'
                    }`}>
                      {step.text}
                    </div>
                  )}
                  {/* Buttons */}
                  {(step.buttons || []).length > 0 && (
                    <div className="flex flex-col gap-1">
                      {(step.buttons || []).map(btn => (
                        <div
                          key={btn.id}
                          className={`text-xs px-3 py-1.5 rounded-lg text-center border font-medium ${
                            btn.type === 'quick_reply'
                              ? 'border-orange-500/40 text-orange-300 bg-orange-500/5'
                              : 'border-emerald-500/40 text-emerald-300 bg-emerald-500/5'
                          }`}
                        >
                          {btn.title || '(sem título)'}
                        </div>
                      ))}
                    </div>
                  )}
                  {isPublic && (
                    <span className="text-[10px] text-purple-400 px-1">resposta pública no post</span>
                  )}
                  {hasOptIn && (
                    <span className="text-[10px] text-orange-400 px-1">⏸ fluxo pausa aqui até o clique</span>
                  )}
                </div>
              </div>
            )}

            {idx < flow.steps.length - 1 && step.type !== 'wait' && (
              <div className="flex justify-center ml-3.5">
                <ArrowDown size={14} className="text-muted/40" />
              </div>
            )}
          </React.Fragment>
        );
      })}
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
  const hasOptIn = step.type === 'dm' && (step.buttons || []).some(b => b.type === 'quick_reply');

  const addButton = (type: ButtonType) =>
    onUpdate({ buttons: [...(step.buttons || []), { id: uid(), type, title: '', url: '' }] });

  const updateButton = (id: string, patch: Partial<FlowButton>) =>
    onUpdate({ buttons: (step.buttons || []).map(b => b.id === id ? { ...b, ...patch } : b) });

  const removeButton = (id: string) =>
    onUpdate({ buttons: (step.buttons || []).filter(b => b.id !== id) });

  return (
    <div className={`rounded-xl border p-5 ${meta.color}`}>
      {/* Header */}
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
            <button onClick={() => onMove(-1)} className="p-1.5 rounded hover:bg-white/10 text-muted hover:text-white transition-colors" title="Mover para cima">
              <GripVertical size={14} className="rotate-90" />
            </button>
          )}
          {index < total - 1 && (
            <button onClick={() => onMove(1)} className="p-1.5 rounded hover:bg-white/10 text-muted hover:text-white transition-colors" title="Mover para baixo">
              <GripVertical size={14} className="-rotate-90" />
            </button>
          )}
          <button onClick={onRemove} className="p-1.5 rounded hover:bg-red-500/20 text-muted hover:text-red-400 transition-colors">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Delay (não aparece para step de wait) */}
      {index > 0 && step.type !== 'wait' && (
        <div className="flex items-center gap-2 mb-3 p-2.5 rounded-lg bg-white/5 border border-white/10">
          <Timer size={13} className="text-muted shrink-0" />
          <span className="text-xs text-muted">Aguardar</span>
          <input
            type="number" min={0} max={1440}
            className="input-field text-xs py-1 px-2 w-20 text-center"
            value={delayMinutes}
            onChange={e => onUpdate({ delay_seconds: Math.max(0, parseInt(e.target.value) || 0) * 60 })}
          />
          <span className="text-xs text-muted">min antes de enviar</span>
          {delayMinutes > 0 && <span className="text-xs text-blue-400 ml-auto">⏳ {delayMinutes}min</span>}
        </div>
      )}

      {/* ── Step: WAIT ─────────────────────────────────────────── */}
      {step.type === 'wait' && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
          <Timer size={24} className="text-gray-400 shrink-0" />
          <div className="flex items-center gap-2 flex-1">
            <span className="text-sm text-muted">Aguardar</span>
            <input
              type="number" min={1} max={1440}
              className="input-field text-sm py-1.5 px-3 w-24 text-center"
              value={delayMinutes || ''}
              placeholder="0"
              onChange={e => onUpdate({ delay_seconds: Math.max(1, parseInt(e.target.value) || 0) * 60 })}
            />
            <span className="text-sm text-muted">minutos</span>
          </div>
          {delayMinutes > 0 && (
            <span className="text-xs text-gray-400 shrink-0">
              {delayMinutes >= 60 ? `${(delayMinutes / 60).toFixed(1)}h` : `${delayMinutes}min`}
            </span>
          )}
        </div>
      )}

      {/* ── Step: IMAGE ────────────────────────────────────────── */}
      {step.type === 'image' && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted flex items-center gap-1">
              <Image size={11} /> URL da imagem <span className="text-red-400">*</span>
            </label>
            <input
              className="input-field text-sm py-2 px-3"
              placeholder="https://... (jpg, png, gif)"
              value={step.image_url || ''}
              onChange={e => onUpdate({ image_url: e.target.value })}
            />
          </div>
          {step.image_url && (
            <div className="rounded-lg overflow-hidden bg-white/5 border border-white/10 h-32 flex items-center justify-center">
              <img
                src={step.image_url}
                alt="preview"
                className="max-h-full max-w-full object-contain"
                onError={e => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
              />
            </div>
          )}
          <textarea
            className="input-field w-full p-3 resize-none h-16 text-sm"
            placeholder="Legenda da imagem (opcional)"
            value={step.text}
            onChange={e => onUpdate({ text: e.target.value })}
          />
        </div>
      )}

      {/* ── Step: COMMENT_REPLY ou DM ──────────────────────────── */}
      {(step.type === 'comment_reply' || step.type === 'dm') && (
        <>
          <textarea
            className="input-field w-full p-3 resize-none h-24 text-sm mb-4"
            placeholder={step.type === 'comment_reply'
              ? 'Ex: Oi! Te enviei uma mensagem no direct 😊'
              : 'Ex: Olá! Aqui está o conteúdo que você pediu...'}
            value={step.text}
            onChange={e => onUpdate({ text: e.target.value })}
          />

          {/* Botões (só DM) */}
          {step.type === 'dm' && (
            <div className="flex flex-col gap-3">
              {(step.buttons || []).map(btn => (
                <ButtonRow key={btn.id} btn={btn} onChange={p => updateButton(btn.id, p)} onRemove={() => removeButton(btn.id)} />
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
                    <span><strong>Opt-in ativo:</strong> O sistema para aqui e só envia os próximos passos quando o usuário clicar. Respeita as regras da Meta.</span>
                  </p>
                </div>
              )}
            </div>
          )}
        </>
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
        <button onClick={onRemove} className="text-muted hover:text-red-400 transition-colors p-1"><X size={13} /></button>
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
          placeholder="URL (https://...)"
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
