import React, { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { Card, CardContent } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import {
  MessageSquare, Plus, Trash2, Power, CheckCircle2,
  ArrowRight, MessageCircle, Send, Link2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Badge } from '../components/Badge';
import { getToken } from './Login';

interface Rule {
  id: string;
  trigger_keyword: string;
  response_message: string;
  comment_reply: string | null;
  dm_button_text: string | null;
  dm_button_url: string | null;
  active: number;
}

const API = import.meta.env.VITE_API_URL ?? '/api';

function authFetch(url: string, options: RequestInit = {}) {
  const token = getToken();
  return fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
}

const emptyForm = {
  keyword: '',
  commentReply: '',
  useCommentReply: false,
  dmMessage: '',
  useButton: false,
  buttonText: '',
  buttonUrl: '',
};

export function Automations() {
  const { data: rulesData, isLoading: loading } = useSWR(`${API}/automation-rules`);
  const rules: Rule[] = rulesData || [];

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const set = (field: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const toggle = (field: 'useCommentReply' | 'useButton') =>
    setForm(f => ({ ...f, [field]: !f[field] }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.keyword.trim() || !form.dmMessage.trim()) return;
    try {
      await authFetch(`${API}/automation-rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trigger_keyword: form.keyword.trim(),
          response_message: form.dmMessage.trim(),
          comment_reply: form.useCommentReply ? form.commentReply.trim() : null,
          dm_button_text: form.useButton ? form.buttonText.trim() : null,
          dm_button_url: form.useButton ? form.buttonUrl.trim() : null,
          active: 1,
        }),
      });
      setForm(emptyForm);
      setIsFormOpen(false);
      await mutate(`${API}/automation-rules`);
    } catch (err) {
      console.error('Erro ao salvar regra', err);
    }
  };

  const toggleRule = async (rule: Rule) => {
    try {
      await authFetch(`${API}/automation-rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...rule, active: rule.active ? 0 : 1 }),
      });
      await mutate(`${API}/automation-rules`);
    } catch (err) {
      console.error('Erro ao alternar regra', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Deseja excluir esta automação?')) {
      try {
        await authFetch(`${API}/automation-rules/${id}`, { method: 'DELETE' });
        await mutate(`${API}/automation-rules`);
      } catch (err) {
        console.error('Erro ao excluir', err);
      }
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold mb-1">Automações</h1>
          <p className="text-muted text-sm">Responda comentários e envie DMs automáticas no Instagram.</p>
        </div>
        <Button onClick={() => { setForm(emptyForm); setIsFormOpen(!isFormOpen); }} icon={<Plus size={16} />}>
          Nova Automação
        </Button>
      </div>

      {/* Form */}
      {isFormOpen && (
        <Card className="glass-panel border border-[var(--accent-primary)]">
          <CardContent className="pt-6">
            <h3 className="text-base font-semibold mb-5">Configurar Automação</h3>
            <form onSubmit={handleSave} className="flex flex-col gap-6">

              {/* Trigger */}
              <div className="rounded-xl border border-white/10 p-4 flex flex-col gap-3">
                <p className="text-xs font-bold uppercase text-muted tracking-wider flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[var(--accent-primary)] text-white text-[10px] flex items-center justify-center font-bold">1</span>
                  Gatilho — Palavra-chave no comentário
                </p>
                <Input
                  placeholder='Ex: "QUERO", "LINK", "INFO"'
                  value={form.keyword}
                  onChange={set('keyword')}
                  autoFocus
                />
                <p className="text-xs text-muted">A automação dispara quando o comentário contiver essa palavra (não diferencia maiúsculas).</p>
              </div>

              {/* Action 1: Comment Reply */}
              <div className="rounded-xl border border-white/10 p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase text-muted tracking-wider flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-purple-500 text-white text-[10px] flex items-center justify-center font-bold">2</span>
                    <MessageCircle size={14} className="text-purple-400" />
                    Responder no comentário (público)
                  </p>
                  <button
                    type="button"
                    onClick={() => toggle('useCommentReply')}
                    className={`relative w-10 h-5 rounded-full transition-colors ${form.useCommentReply ? 'bg-purple-500' : 'bg-white/10'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${form.useCommentReply ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                {form.useCommentReply && (
                  <textarea
                    className="input-field p-3 resize-none h-20"
                    placeholder="Ex: Oi! Enviei uma mensagem privada pra você 😊"
                    value={form.commentReply}
                    onChange={set('commentReply')}
                  />
                )}
                {!form.useCommentReply && (
                  <p className="text-xs text-muted">Opcional. Deixe ativado para postar uma resposta pública visível para todos.</p>
                )}
              </div>

              {/* Action 2: DM */}
              <div className="rounded-xl border border-white/10 p-4 flex flex-col gap-3">
                <p className="text-xs font-bold uppercase text-muted tracking-wider flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[var(--accent-primary)] text-white text-[10px] flex items-center justify-center font-bold">3</span>
                  <Send size={14} className="text-[var(--accent-primary)]" />
                  Mensagem na DM (privado)
                </p>
                <textarea
                  className="input-field p-3 resize-none h-24"
                  placeholder="Ex: Olá! Aqui está o link que você pediu..."
                  value={form.dmMessage}
                  onChange={set('dmMessage')}
                  required
                />

                {/* Button toggle */}
                <div className="flex items-center justify-between pt-1 border-t border-white/10">
                  <p className="text-xs font-bold uppercase text-muted tracking-wider flex items-center gap-2">
                    <Link2 size={14} className="text-emerald-400" />
                    Incluir botão com link
                  </p>
                  <button
                    type="button"
                    onClick={() => toggle('useButton')}
                    className={`relative w-10 h-5 rounded-full transition-colors ${form.useButton ? 'bg-emerald-500' : 'bg-white/10'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${form.useButton ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                {form.useButton && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input
                      label="Texto do botão"
                      placeholder="Ex: Acessar agora"
                      value={form.buttonText}
                      onChange={set('buttonText')}
                    />
                    <Input
                      label="URL do botão"
                      placeholder="https://..."
                      value={form.buttonUrl}
                      onChange={set('buttonUrl')}
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="ghost" onClick={() => setIsFormOpen(false)}>Cancelar</Button>
                <Button type="submit" icon={<CheckCircle2 size={16} />}>Ativar Automação</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Rules list */}
      <div className="flex flex-col gap-4">
        {loading ? (
          <p className="text-muted text-center py-10">Carregando...</p>
        ) : rules.length === 0 ? (
          <div className="text-center py-20 glass-panel rounded-xl">
            <MessageSquare className="mx-auto mb-4 text-muted" size={40} />
            <p className="text-muted">Nenhuma automação criada ainda.</p>
          </div>
        ) : (
          rules.map(rule => <RuleCard key={rule.id} rule={rule} onToggle={toggleRule} onDelete={handleDelete} />)
        )}
      </div>
    </div>
  );
}

function RuleCard({ rule, onToggle, onDelete }: { rule: Rule; onToggle: (r: Rule) => void; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className={`glass-panel border-l-4 ${rule.active ? 'border-[var(--success)]' : 'border-gray-600'}`}>
      <CardContent className="pt-4 pb-4">
        {/* Top row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant={rule.active ? 'success' : 'neutral'}>{rule.active ? 'Ativa' : 'Pausada'}</Badge>
            {/* Flow summary */}
            <div className="flex items-center gap-2 text-sm flex-wrap">
              <span className="bg-white/10 px-2 py-0.5 rounded font-mono text-[var(--accent-primary)] font-bold">
                "{rule.trigger_keyword}"
              </span>
              <ArrowRight size={14} className="text-muted shrink-0" />
              {rule.comment_reply && (
                <>
                  <span className="flex items-center gap-1 text-purple-400 text-xs bg-purple-500/10 px-2 py-0.5 rounded">
                    <MessageCircle size={12} /> Reply
                  </span>
                  <ArrowRight size={14} className="text-muted shrink-0" />
                </>
              )}
              <span className="flex items-center gap-1 text-[var(--accent-primary)] text-xs bg-[var(--accent-primary)]/10 px-2 py-0.5 rounded">
                <Send size={12} /> DM
              </span>
              {rule.dm_button_text && (
                <>
                  <ArrowRight size={14} className="text-muted shrink-0" />
                  <span className="flex items-center gap-1 text-emerald-400 text-xs bg-emerald-500/10 px-2 py-0.5 rounded">
                    <Link2 size={12} /> Botão
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => setExpanded(v => !v)} className="p-2 hover:bg-white/5 rounded-lg text-muted hover:text-white transition-colors">
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            <button onClick={() => onToggle(rule)} title={rule.active ? 'Pausar' : 'Ativar'} className="p-2 hover:bg-white/5 rounded-lg text-muted hover:text-white transition-colors">
              <Power size={16} className={rule.active ? 'text-[var(--success)]' : ''} />
            </button>
            <button onClick={() => onDelete(rule.id)} className="p-2 hover:bg-white/5 rounded-lg text-muted hover:text-[var(--danger)] transition-colors">
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="flex flex-col gap-3 mt-3 pt-3 border-t border-white/10">
            {rule.comment_reply && (
              <div className="flex gap-3">
                <div className="w-1 rounded bg-purple-500 shrink-0" />
                <div>
                  <p className="text-xs text-purple-400 font-bold uppercase mb-1 flex items-center gap-1"><MessageCircle size={11} /> Resposta no comentário</p>
                  <p className="text-sm bg-white/5 px-3 py-2 rounded-lg italic text-muted">{rule.comment_reply}</p>
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <div className="w-1 rounded bg-[var(--accent-primary)] shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-[var(--accent-primary)] font-bold uppercase mb-1 flex items-center gap-1"><Send size={11} /> Mensagem na DM</p>
                <p className="text-sm bg-white/5 px-3 py-2 rounded-lg italic text-muted">{rule.response_message}</p>
                {rule.dm_button_text && rule.dm_button_url && (
                  <div className="mt-2 inline-flex items-center gap-2 border border-emerald-500/40 text-emerald-400 text-xs px-3 py-1.5 rounded-lg bg-emerald-500/5">
                    <Link2 size={12} />
                    <span className="font-medium">{rule.dm_button_text}</span>
                    <span className="text-muted truncate max-w-[180px]">{rule.dm_button_url}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
