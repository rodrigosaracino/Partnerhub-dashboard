// ─────────────────────────────────────────────
// Centralized utilities for all dashboard pages
// ─────────────────────────────────────────────

export const API = 'http://127.0.0.1:8787';

/** Format a number with pt-BR locale. Returns '0' for nullish / NaN values. */
export function fmt(n?: number | string | null): string {
  if (n == null || n === '') return '0';
  const num = typeof n === 'string' ? parseFloat(n) : n;
  return isNaN(num) ? '0' : num.toLocaleString('pt-BR');
}

/** Format a value as BRL currency. */
export function currency(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

/** Shared Recharts tooltip content style. */
export const TOOLTIP_STYLE = {
  backgroundColor: 'var(--bg-secondary)',
  borderColor: 'var(--border-color)',
  borderRadius: '10px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  fontSize: '12px',
  color: 'var(--text-primary)',
};
