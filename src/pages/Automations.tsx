import React, { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { Card, CardContent } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import {
  MessageSquare, Plus, Trash2, Power, CheckCircle2,
  ArrowDown, MessageCircle, Send, Link2, ChevronDown, ChevronUp, X,
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
  enableCommentReply: false,
  dmMessage: '',
  enableButton: false,
  buttonText: '',
  buttonUrl: '',
};

export function Automations() {
  const { data: rulesData, isLoading: loading } = useSWR(`${API}/automation-rules`);
  const rules: Rule[] = rulesData || [];
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const setField = (field: keyof typeof emptyForm, value: string | boolean) =>
    setForm(f => ({ ...f, [field]: value }));

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
          comment_reply: form.enableCommentReply && form.commentReply.trim() ? form.commentReply.trim() : null,
          dm_button_text: form.enableButton && form.buttonText.trim() ? form.buttonText.trim() : null,
          dm_button_url: form.enableButton && form.buttonUrl.trim() ? form.buttonUrl.trim() : null,
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold mb-1">Automações</h1>
          <p className="text-muted text-sm">Responda comentários e envie DMs automáticas no Instagram.</p>
        </div>
        <Button onClick={() => { setForm(emptyForm); setIsFormOpen(v => !v); }} icon={isFormOpen ? <X size={16} /> : <Plus size={16} />}>
          {isFormOpen ? 'Fechar' : 'Nova Automação'}
        </Button>
      </div>

      {/* ── Formulário ── */}
      {isFormOpen && (
        <Card className="glass-panel border border-[var(--accent-primary)]">
          <CardContent className="pt-6 pb-6">
            <h3 className="text-base font-semibold mb-6">Nova Automação</h3>
            <form onSubmit={handleSave}>
              <div className="flex flex-col gap-0">

                {/* Bloco 1: Gatilho */}
                <div className="border border-white/10 rounded-t-xl p-5 bg-white/[0.02]">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted mb-3 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[var(--accent-primary)] text-white text-[10px] flex items-center justify-center">1</span>
                    Gatilho
                  </p>
                  <Input
                    label="Quando o comentário contiver a palavra:"
                    placeholder='Ex: "QUERO", "LINK", "INFO"'
                    value={form.keyword}
                    onChange={e => setField('keyword', e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="flex justify-center py-1 border-x border-white/10 bg-white/[0.01]">
                  <ArrowDown size={16} className="text-muted" />
                </div>

                {/* Bloco 2: Reply no comentário */}
                <div className="border border-white/10 p-5 bg-white/[0.02]">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-purple-500 text-white text-[10px] flex items-center justify-center">2</span>
                      <MessageCircle size={13} className="text-purple-400" />
                      Responder no comentário (público)
                    </p>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <span className="text-xs text-muted">{form.enableCommentReply ? 'Ativado' : 'Desativado'}</span>
                      <div
                        onClick={() => setField('enableCommentReply', !form.enableCommentReply)}
                        className={`relative w-11 h-6 rounded-full cursor-pointer transition-colors ${form.enableCommentReply ? 'bg-purple-500' : 'bg-white/10'}`}
                      >
                        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${form.enableCommentReply ? 'translate-x-6' : 'translate-x-1'}`} />
                      </div>
                    </label>
                  </div>
                  {form.enableCommentReply ? (
                    <textarea
                      className="input-field w-full p-3 resize-none h-20 text-sm"
                      placeholder="Ex: Oi! Te enviei uma mensagem 😊"
                      value={form.commentReply}
                      onChange={e => setField('commentReply', e.target.value)}
                    />
                  ) : (
                    <p className="text-xs text-muted">Opcional — ative para postar uma resposta pública visível para todos no comentário.</p>
                  )}
                </div>

                <div className="flex justify-center py-1 border-x border-white/10 bg-white/[0.01]">
                  <ArrowDown size={16} className="text-muted" />
                </div>

                {/* Bloco 3: DM */}
                <div className="border border-white/10 p-5 bg-white/[0.02]">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted mb-3 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[var(--accent-primary)] text-white text-[10px] flex items-center justify-center">3</span>
                    <Send size={13} className="text-[var(--accent-primary)]" />
                    Mensagem na DM (privado) <span className="text-red-400">*</span>
                  </p>
                  <textarea
                    className="input-field w-full p-3 resize-none h-24 text-sm"
                    placeholder="Ex: Olá! Obrigado pelo interesse. Aqui está o link que você pediu..."
                    value={form.dmMessage}
                    onChange={e => setField('dmMessage', e.target.value)}
                    required
                  />
                </div>

                <div className="flex justify-center py-1 border-x border-white/10 bg-white/[0.01]">
                  <ArrowDown size={16} className="text-muted" />
                </div>

                {/* Bloco 4: Botão */}
                <div className="border border-white/10 rounded-b-xl p-5 bg-white/[0.02]">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] flex items-center justify-center">4</span>
                      <Link2 size={13} className="text-emerald-400" />
                      Botão com link na DM
                    </p>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <span className="text-xs text-muted">{form.enableButton ? 'Ativado' : 'Desativado'}</span>
                      <div
                        onClick={() => setField('enableButton', !form.enableButton)}
                        className={`relative w-11 h-6 rounded-full cursor-pointer transition-colors ${form.enableButton ? 'bg-emerald-500' : 'bg-white/10'}`}
                      >
                        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${form.enableButton ? 'translate-x-6' : 'translate-x-1'}`} />
                      </div>
                    </label>
                  </div>
                  {form.enableButton ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Input
                        label="Texto do botão"
                        placeholder="Ex: Acessar agora"
                        value={form.buttonText}
                        onChange={e => setField('buttonText', e.target.value)}
                      />
                      <Input
                        label="URL do botão"
                        placeholder="https://..."
                        value={form.buttonUrl}
                        onChange={e => setField('buttonUrl', e.target.value)}
                      />
                    </div>
                  ) : (
                    <p className="text-xs text-muted">Opcional — ative para incluir um botão clicável com link na DM.</p>
                  )}
                </div>

              </div>

              <div className="flex gap-2 justify-end mt-5">
                <Button type="button" variant="ghost" onClick={() => setIsFormOpen(false)}>Cancelar</Button>
                <Button type="submit" icon={<CheckCircle2 size={16} />}>Salvar Automação</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ── Lista de regras ── */}
      <div className="flex flex-col gap-3">
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
    <Card className={`glass-panel border-l-4 transition-colors ${rule.active ? 'border-[var(--success)]' : 'border-gray-600'}`}>
      <CardContent className="pt-4 pb-4">
        {/* Linha principal */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap min-w-0">
            <Badge variant={rule.active ? 'success' : 'neutral'}>{rule.active ? 'Ativa' : 'Pausada'}</Badge>
            <span className="font-mono font-bold text-[var(--accent-primary)] bg-[var(--accent-primary)]/10 px-2 py-0.5 rounded text-sm">
              "{rule.trigger_keyword}"
            </span>
            <span className="text-muted text-xs hidden sm:flex items-center gap-1.5">
              {rule.comment_reply && <><MessageCircle size={12} className="text-purple-400" /><span className="text-purple-400">Reply</span><span>·</span></>}
              <Send size={12} className="text-[var(--accent-primary)]" />
              <span className="text-[var(--accent-primary)]">DM</span>
              {rule.dm_button_text && <><span>·</span><Link2 size={12} className="text-emerald-400" /><span className="text-emerald-400">Botão</span></>}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => setExpanded(v => !v)} className="p-2 rounded-lg text-muted hover:text-white hover:bg-white/5 transition-colors">
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            <button onClick={() => onToggle(rule)} title={rule.active ? 'Pausar' : 'Ativar'} className="p-2 rounded-lg text-muted hover:text-white hover:bg-white/5 transition-colors">
              <Power size={16} className={rule.active ? 'text-[var(--success)]' : ''} />
            </button>
            <button onClick={() => onDelete(rule.id)} className="p-2 rounded-lg text-muted hover:text-[var(--danger)] hover:bg-white/5 transition-colors">
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* Detalhes expandidos */}
        {expanded && (
          <div className="mt-4 pt-4 border-t border-white/10 flex flex-col gap-3">
            {rule.comment_reply && (
              <div className="flex gap-3 items-start">
                <div className="flex items-center gap-1.5 text-purple-400 text-xs font-bold uppercase shrink-0 w-28">
                  <MessageCircle size={12} /> Comentário
                </div>
                <p className="text-sm text-muted italic bg-white/5 px-3 py-2 rounded-lg flex-1">{rule.comment_reply}</p>
              </div>
            )}
            <div className="flex gap-3 items-start">
              <div className="flex items-center gap-1.5 text-[var(--accent-primary)] text-xs font-bold uppercase shrink-0 w-28">
                <Send size={12} /> DM
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted italic bg-white/5 px-3 py-2 rounded-lg">{rule.response_message}</p>
                {rule.dm_button_text && rule.dm_button_url && (
                  <div className="mt-2 inline-flex items-center gap-2 border border-emerald-500/40 text-emerald-400 text-xs px-3 py-1.5 rounded-lg bg-emerald-500/5 max-w-full">
                    <Link2 size={12} className="shrink-0" />
                    <span className="font-semibold shrink-0">{rule.dm_button_text}</span>
                    <span className="text-muted truncate">{rule.dm_button_url}</span>
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
