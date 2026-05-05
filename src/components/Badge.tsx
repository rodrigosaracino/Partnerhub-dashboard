import React, { HTMLAttributes } from 'react';
import { cn } from './Button';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}

export function Badge({ children, variant = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span 
      className={cn('badge', `badge-${variant}`, className)} 
      {...props}
    >
      {children}
    </span>
  );
}
