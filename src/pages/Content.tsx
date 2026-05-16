import React, { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { Card, CardContent } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import {
  VideoDetailsModal,
  statusConfig, pillarConfig, journeyConfig, painPointsConfig,
  type VideoStatus, type VideoPillar, type JourneyStage, type VideoForModal,
} from '../components/VideoDetailsModal';
import { API } from '../utils/format';
import { Plus, Trash2, RefreshCw, Eye, ThumbsUp, Save, Edit2, AlertCircle } from 'lucide-react';

type Video = VideoForModal;

const API_URL = API;

export function Content() {
  const { data: videosData, isLoading: loading } = useSWR(`${API_URL}/videos`);
  const videos: Video[] = videosData || [];
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedVideoForDetails, setSelectedVideoForDetails] = useState<Video | null>(null);
  const [syncing, setSyncing] = useState(false);
  
  // Form states
  const [newTitle, setNewTitle] = useState('');
  const [newYoutubeId, setNewYoutubeId] = useState('');
  const [newPillar, setNewPillar] = useState<VideoPillar>('diagnostic');
  const [newStatus, setNewStatus] = useState<VideoStatus>('draft');
  const [newJourneyStage, setNewJourneyStage] = useState<JourneyStage>('tofu');
  const [newFocusKeyword, setNewFocusKeyword] = useState('');
  const [newTags, setNewTags] = useState('');
  
  // Strategy fields
  const [newPersona, setNewPersona] = useState('');
  const [newPainPoint, setNewPainPoint] = useState('');
  const [newProblemSolved, setNewProblemSolved] = useState('');

  const openForm = (video?: Video) => {
    if (video) {
      setEditingId(video.id);
      setNewTitle(video.title);
      setNewYoutubeId(video.youtube_id || '');
      setNewPillar(video.pillar);
      setNewStatus(video.status);
      setNewJourneyStage(video.journey_stage || 'tofu');
      setNewFocusKeyword(video.focus_keyword || '');
      setNewTags(video.tags || '');
      setNewPersona(video.persona || '');
      setNewPainPoint(video.pain_point || '');
      setNewProblemSolved(video.problem_solved || '');
    } else {
      setEditingId(null);
      setNewTitle('');
      setNewYoutubeId('');
      setNewPillar('diagnostic');
      setNewStatus('draft');
      setNewJourneyStage('tofu');
      setNewFocusKeyword('');
      setNewTags('');
      setNewPersona('');
      setNewPainPoint('');
      setNewProblemSolved('');
    }
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newVideo = {
      id: editingId || Math.random().toString(36).substring(7),
      title: newTitle,
      youtube_id: newYoutubeId || undefined,
      pillar: newPillar,
      status: newStatus,
      journey_stage: newJourneyStage,
      focus_keyword: newFocusKeyword || undefined,
      tags: newTags || undefined,
      persona: newPersona || undefined,
      pain_point: newPainPoint || undefined,
      problem_solved: newProblemSolved || undefined,
    };

    try {
      await fetch(`${API_URL}/videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newVideo)
      });
      await mutate(`${API_URL}/videos`);
      closeForm();
    } catch (e) {
      console.error('Erro ao salvar vídeo', e);
    }
  };

  const handleStatusChange = async (video: Video, updatedStatus: VideoStatus) => {
    try {
      await fetch(`${API_URL}/videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...video, status: updatedStatus })
      });
      await mutate(`${API_URL}/videos`);
    } catch (e) {
      console.error('Erro ao atualizar status', e);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja remover este vídeo?')) {
      try {
        await fetch(`${API_URL}/videos/${id}`, { method: 'DELETE' });
        await mutate(`${API_URL}/videos`);
      } catch (e) {
        console.error('Erro ao excluir vídeo', e);
      }
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      const res = await fetch(`${API_URL}/sync-youtube-all`, { method: 'POST' });
      if (res.ok) {
        const result = await res.json();
        alert(`Sincronização concluída! ${result.totalSynced} vídeos processados.`);
        await mutate(`${API_URL}/videos`);
      }
    } catch (e) {
      console.error('Erro ao sincronizar YouTube', e);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold mb-2">Backlog de Conteúdo</h1>
          <p className="text-muted">Gestão de produção, SEO e integração com YouTube.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSync} variant="secondary" icon={<RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />}>
            {syncing ? 'Sincronizando...' : 'Sincronizar YouTube'}
          </Button>
          <Button onClick={() => openForm()} icon={<Plus size={16} />}>
            Novo Vídeo
          </Button>
        </div>
      </div>

      {isFormOpen && (
        <Card className="glass-panel border border-[var(--accent-primary)]">
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">{editingId ? 'Editar Vídeo' : 'Adicionar Vídeo'}</h3>
            <form onSubmit={handleSave} className="flex flex-col gap-4">
              
              {/* Linha 1: Título e YouTube ID */}
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <Input 
                    label="Título do Vídeo" 
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    placeholder="Ex: Como atrair clientes B2B"
                    autoFocus
                  />
                </div>
                <div className="flex-1">
                  <Input 
                    label="YouTube ID (Opcional)" 
                    value={newYoutubeId}
                    onChange={e => setNewYoutubeId(e.target.value)}
                    placeholder="Ex: dQw4w9WgXcQ"
                  />
                </div>
              </div>

              {/* Linha 2: Estratégia Principal */}
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <label className="input-label block mb-2">Persona</label>
                  <Input 
                    value={newPersona}
                    onChange={e => setNewPersona(e.target.value)}
                    placeholder="Ex: Clínicas, B2B, Advogados"
                  />
                </div>
                <div className="flex-1">
                  <label className="input-label block mb-2">Dor Central (Pain Point)</label>
                  <select 
                    className="input-field w-full h-[42px]"
                    value={newPainPoint}
                    onChange={(e) => setNewPainPoint(e.target.value)}
                  >
                    <option value="">Selecione uma dor...</option>
                    {Object.entries(painPointsConfig).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="w-full mb-2">
                <label className="input-label block mb-2">Problema Resolvido (O que este vídeo ensina/cura)</label>
                <textarea 
                  className="input-field w-full h-20 p-3 resize-none"
                  value={newProblemSolved}
                  onChange={e => setNewProblemSolved(e.target.value)}
                  placeholder="Ex: Explica que o problema não é a ferramenta (Google/Meta), mas a falta de oferta estruturada antes de rodar o anúncio."
                />
              </div>

              {/* Linha 3: Pilar, Jornada e Status */}
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <label className="input-label block mb-2">Pilar</label>
                  <select 
                    className="input-field w-full h-[42px]"
                    value={newPillar}
                    onChange={(e) => setNewPillar(e.target.value as VideoPillar)}
                  >
                    <option value="diagnostic">Diagnóstico</option>
                    <option value="solution">Solução</option>
                    <option value="backstage">Bastidores</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="input-label block mb-2">Etapa da Jornada</label>
                  <select 
                    className="input-field w-full h-[42px]"
                    value={newJourneyStage}
                    onChange={(e) => setNewJourneyStage(e.target.value as JourneyStage)}
                  >
                    <option value="tofu">Topo de Funil (Consciência)</option>
                    <option value="mofu">Meio de Funil (Consideração)</option>
                    <option value="bofu">Fundo de Funil (Decisão)</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="input-label block mb-2">Status</label>
                  <select 
                    className="input-field w-full h-[42px]"
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as VideoStatus)}
                  >
                    <option value="draft">Rascunho</option>
                    <option value="scripting">Roteirização</option>
                    <option value="recording">Gravação</option>
                    <option value="editing">Edição</option>
                    <option value="published">Publicado</option>
                  </select>
                </div>
              </div>

              {/* Linha 4: SEO */}
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <Input 
                    label="Palavra-chave Foco" 
                    value={newFocusKeyword}
                    onChange={e => setNewFocusKeyword(e.target.value)}
                    placeholder="Ex: marketing b2b"
                  />
                </div>
                <div className="flex-1">
                  <Input 
                    label="Etiquetas (Tags)" 
                    value={newTags}
                    onChange={e => setNewTags(e.target.value)}
                    placeholder="Separe por vírgula. Ex: tráfego, instagram"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end mt-2 pt-4 border-t border-[rgba(255,255,255,0.05)]">
                <Button type="button" variant="ghost" onClick={closeForm}>Cancelar</Button>
                <Button type="submit" icon={<Save size={16}/>}>Salvar Estratégia</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-color)]">
                <th className="p-4 font-semibold text-sm text-muted">Título & SEO</th>
                <th className="p-4 font-semibold text-sm text-muted">Estratégia & Dores</th>
                <th className="p-4 font-semibold text-sm text-muted">Métricas</th>
                <th className="p-4 font-semibold text-sm text-muted">Status</th>
                <th className="p-4 font-semibold text-sm text-muted text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center text-muted">Carregando vídeos...</td></tr>
              ) : videos.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-muted">Nenhum vídeo cadastrado no banco de dados.</td></tr>
              ) : (
                videos.map((video) => (
                  <tr key={video.id} className="border-b border-[var(--border-color)] transition-colors" style={{ cursor: 'pointer' }} onClick={() => setSelectedVideoForDetails(video)}>
                    <td className="p-4 font-medium min-w-[250px]">
                      <div className="text-sm font-semibold hover:text-[var(--accent-primary)] transition-colors">{video.title}</div>
                      <div className="flex gap-3 items-center mt-2 flex-wrap">
                        {video.youtube_id && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-[rgba(255,0,0,0.1)] text-red-400 font-mono border border-red-900/30">ID: {video.youtube_id}</span>
                        )}
                        {video.focus_keyword && (
                          <span className="text-[11px] text-muted flex items-center gap-1">🔑 {video.focus_keyword}</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 min-w-[200px]">
                      <div className="flex flex-col gap-2 items-start">
                        <div className="flex gap-2 items-center">
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded border border-current ${pillarConfig[video.pillar].color} bg-opacity-10`}>
                            {pillarConfig[video.pillar].label}
                          </span>
                          {video.journey_stage && (
                            <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${(journeyConfig[video.journey_stage] as any).bg || 'bg-gray-500'} text-white`}>
                              {journeyConfig[video.journey_stage].label}
                            </span>
                          )}
                        </div>
                        {video.pain_point && painPointsConfig[video.pain_point] && (
                          <div className="text-xs text-[var(--accent-primary)] flex items-center gap-1 mt-1">
                            <AlertCircle size={12} /> {painPointsConfig[video.pain_point]}
                          </div>
                        )}
                        {video.persona && (
                          <div className="text-[11px] text-muted italic">👤 {video.persona}</div>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-4">
                        <div className="flex items-center gap-1 text-sm text-muted">
                          <Eye size={14} /> {video.views?.toLocaleString('pt-BR') || 0}
                        </div>
                        <div className="flex items-center gap-1 text-sm text-muted">
                          <ThumbsUp size={14} /> {video.likes?.toLocaleString('pt-BR') || 0}
                        </div>
                      </div>
                    </td>
                    <td className="p-4" onClick={e => e.stopPropagation()}>
                      <select 
                        className="bg-transparent border border-[var(--border-color)] rounded p-1 text-sm text-white focus:outline-none focus:border-[var(--accent-primary)]"
                        value={video.status}
                        onChange={(e) => handleStatusChange(video, e.target.value as VideoStatus)}
                      >
                        {Object.entries(statusConfig).map(([key, config]) => (
                          <option key={key} value={key} className="bg-[var(--bg-secondary)]">
                            {config.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-4 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" className="p-2 text-muted hover:text-[var(--accent-primary)]" title="Ver Detalhes" onClick={() => setSelectedVideoForDetails(video)}>
                          <Eye size={16} />
                        </Button>
                        <Button variant="ghost" className="p-2 text-muted hover:text-white" onClick={() => openForm(video)}>
                          <Edit2 size={16} />
                        </Button>
                        <Button variant="ghost" className="p-2 text-muted hover:text-[var(--danger)]" onClick={() => handleDelete(video.id)}>
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <VideoDetailsModal video={selectedVideoForDetails} onClose={() => setSelectedVideoForDetails(null)} />
    </div>
  );
}
