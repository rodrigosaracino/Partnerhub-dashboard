import { InputHTMLAttributes } from 'react';
import { cn } from './Button';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className, id, ...props }: InputProps) {
  const inputId = id || Math.random().toString(36).substring(7);
  
  return (
    <div className={cn('input-group', className)}>
      {label && <label htmlFor={inputId} className="input-label">{label}</label>}
      <input 
        id={inputId}
        className={cn('input-field', error && 'border-[var(--danger)]')} 
        {...props} 
      />
      {error && <span className="text-[var(--danger)] text-xs mt-1">{error}</span>}
    </div>
  );
}
