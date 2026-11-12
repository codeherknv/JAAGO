'use client';

import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  children: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      fullWidth = false,
      disabled = false,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    // Base: 8px radius, sentence case, minimum 44px tap target height for touch
    let baseStyles =
      'inline-flex items-center justify-center font-heading font-semibold transition-colors rounded-control select-none disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';

    // Size variants
    let sizeStyles = 'min-h-[44px] px-4 py-2.5 text-sm';
    if (size === 'sm') {
      sizeStyles = 'min-h-[40px] px-3 py-1.5 text-xs';
    } else if (size === 'lg') {
      sizeStyles = 'min-h-[50px] px-6 py-3 text-base';
    }

    // Color variants
    let variantStyles = '';
    switch (variant) {
      case 'primary':
        // Marking yellow (#F2B705) with dark asphalt text for high outdoor contrast
        variantStyles =
          'bg-marking-yellow hover:bg-marking-hover active:bg-marking-hover text-asphalt border border-[#D9A304] focus-visible:outline-asphalt';
        break;
      case 'secondary':
        // White surface with 1px border (#D9DFE2)
        variantStyles =
          'bg-white hover:bg-kerb text-asphalt border border-border active:bg-kerb-dark focus-visible:outline-signboard-blue';
        break;
      case 'destructive':
        // Alert red (#C8372D) plate
        variantStyles =
          'bg-alert-red hover:bg-[#B32E25] active:bg-[#9F271F] text-white border border-[#A6271D] focus-visible:outline-alert-red';
        break;
      case 'ghost':
        variantStyles =
          'bg-transparent hover:bg-kerb text-asphalt active:bg-kerb-dark border border-transparent focus-visible:outline-signboard-blue';
        break;
    }

    const widthStyle = fullWidth ? 'w-full' : '';

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={`${baseStyles} ${sizeStyles} ${variantStyles} ${widthStyle} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
