import React from 'react';
import { createPortal } from 'react-dom';
import { X, ExternalLink, Eye, ThumbsUp, AlertCircle, Video as VideoIcon } from 'lucide-react';
import { Badge } from './Badge';

// ─── Types (re-exported for use in Content.tsx) ───────────────────────────────
export type VideoStatus = 'draft' | 'scripting' | 'recording' | 'editing' | 'published';
export type VideoPillar = 'diagnostic' | 'solution' | 'backstage';
export type JourneyStage = 'tofu' | 'mofu' | 'bofu';

export interface VideoForModal {
  id: string;
  title: string;
  youtube_id?: string;
  pillar: VideoPillar;
  status: VideoStatus;
  journey_stage?: JourneyStage;
  focus_keyword?: string;
  tags?: string;
  persona?: string;
  pain_point?: string;
  problem_solved?: string;
  views: number;
  likes: number;
}

// ─── Shared Configs ──────────────────────────────────────────────────────────
export const statusConfig: Record<VideoStatus, { label: string; variant: 'success' | 'warning' | 'info' | 'neutral' | 'danger' }> = {
  draft:      { label: 'Rascunho',      variant: 'neutral'  },
  scripting:  { label: 'Roteirização',  variant: 'warning'  },
  recording:  { label: 'Gravação',      variant: 'info'     },
  editing:    { label: 'Edição',        variant: 'warning'  },
  published:  { label: 'Publicado',     variant: 'success'  },
};

export const pillarConfig: Record<VideoPillar, { label: string; color: string }> = {
  diagnostic: { label: 'Diagnóstico', color: 'text-red-400'    },
  solution:   { label: 'Solução',     color: 'text-blue-400'   },
  backstage:  { label: 'Bastidores',  color: 'text-purple-400' },
};

export const journeyConfig: Record<JourneyStage, { label: string }> = {
  tofu: { label: 'Topo de Funil'   },
  mofu: { label: 'Meio de Funil'   },
  bofu: { label: 'Fundo de Funil'  },
};

export const painPointsConfig: Record<string, string> = {
  pain1: 'Já tentei e não funcionou',
  pain2: 'Sem previsibilidade (Mês bom/ruim)',
  pain3: 'Não confio em agência',
  pain4: 'Orçamento limitado',
  pain5: 'Falta de tempo e clareza',
  other: 'Outra dor',
};

// ─── Modal Component ──────────────────────────────────────────────────────────
interface Props {
  video: VideoForModal | null;
  onClose: () => void;
}

const s = {
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.85)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
  },
  panel: {
    backgroundColor: '#0f0f11',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '1.25rem',
    width: '100%',
    maxWidth: '920px',
    maxHeight: '88vh',
    overflowY: 'auto' as const,
    boxShadow: '0 30px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04)',
    position: 'relative' as const,
    padding: '1.75rem',
    display: 'flex',
    gap: '2rem',
  },
  closeBtn: {
    position: 'absolute' as const,
    top: '1rem',
    right: '1rem',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '0.5rem',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    padding: '0.375rem',
    display: 'flex',
    transition: 'all 0.2s',
  },
  divider: { height: '1px', background: 'rgba(255,255,255,0.06)', margin: '0.25rem 0' },
  label: {
    fontSize: '0.6rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.12em',
    color: 'var(--text-secondary)',
    fontWeight: 700,
    marginBottom: '0.25rem',
  },
};

export function VideoDetailsModal({ video, onClose }: Props) {
  if (!video) return null;

  return createPortal(
    <div style={s.overlay} onClick={onClose}>
      <div style={s.panel} onClick={e => e.stopPropagation()}>
        {/* Close */}
        <button style={s.closeBtn} onClick={onClose}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#fff'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.12)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
        >
          <X size={18} />
        </button>

        {/* ── Left Column: Thumbnail + Metrics ─────────────────────────── */}
        <div style={{ flex: '0 0 340px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Thumbnail */}
          <div style={{ position: 'relative', borderRadius: '0.875rem', overflow: 'hidden', background: '#1a1a1e', aspectRatio: '16/9', border: '1px solid rgba(255,255,255,0.08)' }}>
            {video.youtube_id ? (
              <>
                <img
                  src={`https://img.youtube.com/vi/${video.youtube_id}/maxresdefault.jpg`}
                  onError={e => { (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${video.youtube_id}/mqdefault.jpg`; }}
                  alt="Thumbnail"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <a
                  href={`https://www.youtube.com/watch?v=${video.youtube_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                >
                  <div style={{ background: '#FF0000', borderRadius: '50%', padding: '0.875rem', boxShadow: '0 0 30px rgba(255,0,0,0.4)' }}>
                    <ExternalLink size={22} color="#fff" />
                  </div>
                </a>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', height: '100%', justifyContent: 'center' }}>
                <VideoIcon size={40} style={{ opacity: 0.4 }} />
                <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>Sem vídeo publicado</span>
              </div>
            )}
          </div>

          {/* Watch button */}
          {video.youtube_id && (
            <a
              href={`https://www.youtube.com/watch?v=${video.youtube_id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.625rem 1rem', borderRadius: '0.625rem', background: 'rgba(255,0,0,0.12)', border: '1px solid rgba(255,0,0,0.25)', color: '#ff6b6b', fontSize: '0.85rem', textDecoration: 'none', fontWeight: 600, transition: 'background 0.2s' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,0,0,0.2)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,0,0,0.12)'}
            >
              <ExternalLink size={14} /> Assistir no YouTube
            </a>
          )}

          {/* Metrics */}
          <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '0.875rem', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p style={s.label}>Métricas de Performance</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem', marginTop: '0.625rem' }}>
              <MetricBox icon={<Eye size={14} />} label="Views" value={video.views?.toLocaleString('pt-BR') || '0'} color="#60a5fa" />
              <MetricBox icon={<ThumbsUp size={14} />} label="Curtidas" value={video.likes?.toLocaleString('pt-BR') || '0'} color="#10b981" />
            </div>
          </div>
        </div>

        {/* ── Right Column: Strategy Details ──────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0, paddingRight: '2rem' }}>
          {/* Title + Badges */}
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, lineHeight: 1.4, marginBottom: '0.75rem' }}>
              {video.title}
            </h2>
            <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <Badge variant={statusConfig[video.status].variant}>
                {statusConfig[video.status].label}
              </Badge>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '0.375rem', border: '1px solid currentColor' }} className={pillarConfig[video.pillar].color}>
                {pillarConfig[video.pillar].label}
              </span>
              {video.journey_stage && (
                <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '0.375rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)' }}>
                  {journeyConfig[video.journey_stage].label}
                </span>
              )}
            </div>
          </div>

          <div style={s.divider} />

          {/* Strategy */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <InfoRow label="Público & Persona" value={video.persona || 'Não definido'} />
            <div>
              <p style={s.label}>Dor Central</p>
              <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <AlertCircle size={13} />
                {video.pain_point && painPointsConfig[video.pain_point] ? painPointsConfig[video.pain_point] : 'Não especificada'}
              </p>
            </div>
            <div>
              <p style={s.label}>Problema Resolvido</p>
              <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '0.625rem', border: '1px solid rgba(255,255,255,0.06)', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.65, fontStyle: 'italic' }}>
                {video.problem_solved || 'Nenhuma estratégia detalhada ainda.'}
              </div>
            </div>
          </div>

          <div style={s.divider} />

          {/* SEO */}
          <div>
            <p style={s.label}>SEO & Tags</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Palavra-chave:</span>
                <span style={{ fontFamily: 'monospace', color: 'var(--accent-secondary)', fontWeight: 700 }}>
                  {video.focus_keyword || '—'}
                </span>
              </div>
              {video.tags && (
                <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Tags:</span>
                  {video.tags.split(',').map((t, i) => (
                    <span key={i} style={{ fontSize: '0.65rem', padding: '0.15rem 0.45rem', borderRadius: '0.25rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', color: 'var(--text-secondary)' }}>
                      {t.trim()}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function MetricBox({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={s.label}>{label}</p>
      <p style={{ fontSize: '0.875rem', fontWeight: 600 }}>{value}</p>
    </div>
  );
}
