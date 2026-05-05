import React, { useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';

export type DateRange = { from: string; to: string }; // 'YYYY-MM'

const PRESETS = [
  { label: 'Este mês',  months: 1  },
  { label: '3 meses',   months: 3  },
  { label: '6 meses',   months: 6  },
  { label: 'Ano todo',  months: 12 },
];

function currentYM(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function subtractMonths(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 - (n - 1), 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

interface Props {
  value: DateRange;
  onChange: (range: DateRange) => void;
  accentColor?: string;
}

export function DateRangeFilter({ value, onChange, accentColor = '#6366f1' }: Props) {
  const [showCustom, setShowCustom] = useState(false);

  function applyPreset(months: number) {
    const to = currentYM();
    const from = subtractMonths(to, months);
    onChange({ from, to });
    setShowCustom(false);
  }

  function isActive(months: number) {
    const to = currentYM();
    const from = subtractMonths(to, months);
    return value.from === from && value.to === to;
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
      <Calendar size={14} style={{ color: accentColor, flexShrink: 0 }} />
      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
        Período:
      </span>

      {/* Preset buttons */}
      {PRESETS.map(p => (
        <button
          key={p.label}
          type="button"
          onClick={() => applyPreset(p.months)}
          style={{
            padding: '0.25rem 0.75rem',
            fontSize: '0.75rem',
            fontWeight: 600,
            borderRadius: '999px',
            border: `1px solid ${isActive(p.months) ? accentColor : 'rgba(255,255,255,0.1)'}`,
            background: isActive(p.months) ? `${accentColor}22` : 'transparent',
            color: isActive(p.months) ? accentColor : 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'all 0.15s',
            whiteSpace: 'nowrap',
          }}
        >
          {p.label}
        </button>
      ))}

      {/* Custom toggle */}
      <button
        type="button"
        onClick={() => setShowCustom(v => !v)}
        style={{
          padding: '0.25rem 0.75rem',
          fontSize: '0.75rem',
          fontWeight: 600,
          borderRadius: '999px',
          border: `1px solid ${showCustom ? accentColor : 'rgba(255,255,255,0.1)'}`,
          background: showCustom ? `${accentColor}22` : 'transparent',
          color: showCustom ? accentColor : 'var(--text-secondary)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          transition: 'all 0.15s',
        }}
      >
        Personalizado <ChevronDown size={11} style={{ transform: showCustom ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s' }} />
      </button>

      {/* Custom date inputs */}
      {showCustom && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input
            type="month"
            value={value.from}
            max={value.to}
            onChange={e => onChange({ ...value, from: e.target.value })}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '0.375rem',
              color: 'var(--text-primary)',
              padding: '0.2rem 0.5rem',
              fontSize: '0.75rem',
              cursor: 'pointer',
            }}
          />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>até</span>
          <input
            type="month"
            value={value.to}
            min={value.from}
            max={currentYM()}
            onChange={e => onChange({ ...value, to: e.target.value })}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '0.375rem',
              color: 'var(--text-primary)',
              padding: '0.2rem 0.5rem',
              fontSize: '0.75rem',
              cursor: 'pointer',
            }}
          />
        </div>
      )}
    </div>
  );
}

/** Utility: filter an array of objects that have a `name` field in 'YYYY-MM' format */
export function filterByRange<T extends { name: string }>(data: T[], range: DateRange): T[] {
  return data.filter(r => r.name >= range.from && r.name <= range.to);
}

/** Utility: filter an array of objects that have a `date` field in 'YYYY-MM-DD' format */
export function filterByRangeDate<T extends { name: string }>(data: T[], range: DateRange): T[] {
  // Converts 'YYYY-MM-DD' name to 'YYYY-MM' for comparison
  return data.filter(r => {
    const ym = r.name.length > 7 ? r.name.substring(0, 7) : r.name;
    return ym >= range.from && ym <= range.to;
  });
}
