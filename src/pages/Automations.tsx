import React, { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Badge } from '../components/Badge';
import { getToken } from './Login';
import {
  Plus, Trash2, Power, MessageCircle, Send, Link2, MousePointerClick,
  ArrowDown, ChevronRight, Pencil, X, GripVertical, CheckCircle2,
  Zap, AlertTriangle,
} from 'lucide-react';

// ── Tipos ──────────────────────────────────────────────────────

type ButtonType = 'url' | 'quick_reply';
type StepType = 'comment_reply' | 'dm';

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
}

interface Flow {
  id: string;
  name: string;
  trigger_keyword: string;
  active: number;
  steps: FlowStep[];
  created_at: string;
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

// ── Página principal ───────────────────────────────────────────

export function Automations() {
  const { data, isLoading } = useSWR(`${API}/flows`);
  const flows: Flow[] = data || [];
  const [editing, setEditing] = useState<Flow | null>(null);
  const [isNew, setIsNew] = useState(false);

  const openNew = () => {
    setEditing({ id: uid(), name: '', trigger_keyword: '', active: 1, steps: [], created_at: '' });
    setIsNew(true);
  };

  const openEdit = (f: Flow) => { setEditing({ ...f, steps: f.steps || [] }); setIsNew(false); };
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

      {isLoading ? (
        <p className="text-muted text-center py-16">Carregando...</p>
      ) : flows.length === 0 ? (
        <EmptyState onNew={openNew} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {flows.map(f => (
            <FlowCard
              key={f.id}
              flow={f}
              onEdit={openEdit}
              onToggle={toggleFlow}
              onDelete={deleteFlow}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Card do Fluxo na listagem ──────────────────────────────────

function FlowCard({ flow, onEdit, onToggle, onDelete }: {
  flow: Flow;
  onEdit: (f: Flow) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const steps = flow.steps || [];
  return (
    <div className={`glass-panel rounded-xl border-l-4 p-5 ${flow.active ? 'border-[var(--success)]' : 'border-gray-600'}`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant={flow.active ? 'success' : 'neutral'}>{flow.active ? 'Ativo' : 'Pausado'}</Badge>
            <span className="font-semibold text-sm truncate">{flow.name || '(sem nome)'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <Zap size={12} className="text-yellow-400" />
            <span>Gatilho:</span>
            <code className="bg-white/10 px-1.5 py-0.5 rounded font-mono text-[var(--accent-primary)]">"{flow.trigger_keyword}"</code>
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
    const step: FlowStep = { id: uid(), type, text: '', buttons: [] };
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

      {!valid && flow.steps.length > 0 && (
        <p className="text-xs text-amber-400 flex items-center gap-1.5">
          <AlertTriangle size={13} /> Preencha o texto de todos os passos antes de salvar.
        </p>
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

  const addButton = (type: ButtonType) => {
    onUpdate({ buttons: [...(step.buttons || []), { id: uid(), type, title: '', url: '' }] });
  };

  const updateButton = (id: string, patch: Partial<FlowButton>) => {
    onUpdate({ buttons: (step.buttons || []).map(b => b.id === id ? { ...b, ...patch } : b) });
  };

  const removeButton = (id: string) => {
    onUpdate({ buttons: (step.buttons || []).filter(b => b.id !== id) });
  };

  return (
    <div className={`rounded-xl border p-5 ${meta.color} bg-opacity-10`}>
      {/* Header do passo */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-white/10 text-white text-xs font-bold flex items-center justify-center">{index + 1}</span>
          {meta.icon}
          <span className="font-semibold text-sm">{meta.label}</span>
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

          {(step.buttons || []).some(b => b.type === 'quick_reply') && (
            <p className="text-xs text-orange-300 flex items-start gap-1.5 mt-1">
              <MousePointerClick size={12} className="shrink-0 mt-0.5" />
              O botão de opt-in aparece como resposta rápida. Quando o usuário clicar, os próximos passos do fluxo serão enviados automaticamente.
            </p>
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
