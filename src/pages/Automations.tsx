import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { MessageSquare, Plus, Trash2, Power, AlertTriangle, ExternalLink, CheckCircle2 } from 'lucide-react';
import { Badge } from '../components/Badge';

interface Rule {
  id: string;
  trigger_keyword: string;
  response_message: string;
  active: number;
}

const API_URL = 'http://127.0.0.1:8787';

export function Automations() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [keyword, setKeyword] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/automation-rules`);
      if (res.ok) {
        const data = await res.json();
        setRules(data);
      }
    } catch (e) {
      console.error('Erro ao buscar regras', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim() || !message.trim()) return;

    try {
      await fetch(`${API_URL}/automation-rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger_keyword: keyword, response_message: message, active: 1 })
      });
      setKeyword('');
      setMessage('');
      setIsFormOpen(false);
      await fetchRules();
    } catch (e) {
      console.error('Erro ao salvar regra', e);
    }
  };

  const toggleRule = async (rule: Rule) => {
    try {
      await fetch(`${API_URL}/automation-rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...rule, active: rule.active ? 0 : 1 })
      });
      await fetchRules();
    } catch (e) {
      console.error('Erro ao alternar regra', e);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Deseja excluir esta automação?')) {
      try {
        await fetch(`${API_URL}/automation-rules/${id}`, { method: 'DELETE' });
        await fetchRules();
      } catch (e) {
        console.error('Erro ao excluir', e);
      }
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold mb-2">Automação de Comentários</h1>
          <p className="text-muted">Envie DMs automáticas quando alguém comentar palavras-chave nos seus posts.</p>
        </div>
        <Button onClick={() => setIsFormOpen(!isFormOpen)} icon={<Plus size={16} />}>
          Nova Automação
        </Button>
      </div>

      <Card className="glass-panel border-l-4 border-amber-500 bg-amber-500/10">
        <CardContent className="flex items-start gap-4 p-4">
          <AlertTriangle className="text-amber-500 shrink-0 mt-1" size={20} />
          <div className="text-sm">
            <p className="font-bold mb-1">Atenção: Configuração Necessária</p>
            <p className="mb-2">Para as automações funcionarem, você precisa configurar o Webhook no Painel da Meta Developers:</p>
            <ul className="list-disc ml-4 space-y-1 text-muted">
              <li><strong>Callback URL:</strong> <code>https://SEU-WORKER.workers.dev/webhook</code></li>
              <li><strong>Verify Token:</strong> <code>partnerhub_secret_2026</code></li>
              <li><strong>Campos:</strong> Inscreva-se no campo <code>comments</code> em Instagram.</li>
            </ul>
            <div className="mt-3 flex gap-4">
              <a href="https://developers.facebook.com/apps/" target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[var(--accent-primary)] hover:underline font-medium">
                Abrir Meta Developers <ExternalLink size={14} />
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      {isFormOpen && (
        <Card className="glass-panel border border-[var(--accent-primary)] animate-in fade-in slide-in-from-top-2">
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">Configurar Nova Resposta</h3>
            <form onSubmit={handleSave} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input 
                  label="Se o comentário contiver a palavra:" 
                  placeholder="Ex: QUERO, LINK, INFO" 
                  value={keyword}
                  onChange={e => setKeyword(e.target.value)}
                  autoFocus
                />
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-muted uppercase font-bold">Enviar esta mensagem por DM:</label>
                  <textarea 
                    className="input-field h-[100px] p-3 resize-none"
                    placeholder="Olá! Que bom que você se interessou. Aqui está o link..."
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="ghost" onClick={() => setIsFormOpen(false)}>Cancelar</Button>
                <Button type="submit" icon={<CheckCircle2 size={16} />}>Ativar Automação</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <p className="text-muted col-span-full text-center py-10">Carregando regras...</p>
        ) : rules.length === 0 ? (
          <div className="col-span-full text-center py-20 glass-panel rounded-xl">
            <MessageSquare className="mx-auto mb-4 text-muted" size={40} />
            <p className="text-muted">Nenhuma automação criada ainda.</p>
          </div>
        ) : (
          rules.map(rule => (
            <Card key={rule.id} className={`glass-panel border-t-4 ${rule.active ? 'border-[var(--success)]' : 'border-gray-500'}`}>
              <CardContent className="pt-6">
                <div className="flex justify-between items-start mb-4">
                  <Badge variant={rule.active ? 'success' : 'neutral'}>
                    {rule.active ? 'Ativa' : 'Pausada'}
                  </Badge>
                  <div className="flex gap-1">
                    <button onClick={() => toggleRule(rule)} title={rule.active ? 'Pausar' : 'Ativar'} className="p-2 hover:bg-white/5 rounded-lg text-muted hover:text-white transition-colors">
                      <Power size={16} className={rule.active ? 'text-[var(--success)]' : ''} />
                    </button>
                    <button onClick={() => handleDelete(rule.id)} title="Excluir" className="p-2 hover:bg-white/5 rounded-lg text-muted hover:text-[var(--danger)] transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                
                <div className="mb-4">
                  <p className="text-xs text-muted uppercase font-bold mb-1">Palavra-Chave</p>
                  <p className="text-lg font-bold text-[var(--accent-primary)]">"{rule.trigger_keyword}"</p>
                </div>
                
                <div>
                  <p className="text-xs text-muted uppercase font-bold mb-1">Mensagem de Resposta</p>
                  <p className="text-sm line-clamp-3 bg-white/5 p-3 rounded-lg italic">
                    {rule.response_message}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
