import React from 'react';

interface KpiCardProps {
  title: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  /** Optional accent color class for the icon container, e.g. 'text-blue-400' */
  accentClass?: string;
  /** Optional gradient border color, e.g. 'rgba(99,102,241,0.4)' */
  borderColor?: string;
}

/**
 * Universal KPI card used by all dashboards.
 * Replaces the duplicated IgKpi, YtKpi and KpiCard components.
 */
export function KpiCard({ title, value, sub, icon, accentClass = '', borderColor }: KpiCardProps) {
  return (
    <div
      style={{
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: `1px solid ${borderColor || 'var(--glass-border)'}`,
        borderRadius: 'var(--radius-xl)',
        padding: '1.25rem',
        boxShadow: 'var(--shadow-md)',
        transition: 'border-color 0.25s ease, box-shadow 0.25s ease, transform 0.2s ease',
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '0.5rem',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = borderColor ? borderColor : 'rgba(99,102,241,0.35)';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 0 20px rgba(99,102,241,0.12), var(--shadow-md)';
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = borderColor || 'var(--glass-border)';
        (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-md)';
        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{
            fontSize: '0.625rem',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--text-secondary)',
            marginBottom: '0.375rem',
            fontWeight: 600,
          }}>
            {title}
          </p>
          <p style={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: 1.1 }}>{value}</p>
        </div>
        <div
          className={accentClass}
          style={{
            padding: '0.5rem',
            background: 'rgba(255,255,255,0.06)',
            borderRadius: '0.625rem',
            border: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon}
        </div>
      </div>
      <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.125rem' }}>{sub}</p>
    </div>
  );
}
