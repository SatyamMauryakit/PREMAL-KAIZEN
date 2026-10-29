import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'icon';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className = '', ...props }, ref) => {
    const baseStyles = 'font-semibold rounded transition-all duration-200 cursor-pointer';

    const variantStyles = {
      primary: 'bg-cream text-black hover:bg-beige-light active:bg-beige disabled:bg-gray-light disabled:text-gray-light',
      secondary:
        'border border-black bg-transparent text-black hover:bg-black hover:text-cream disabled:border-gray-light disabled:text-gray-light',
      icon: 'bg-transparent text-black hover:bg-beige-light rounded transition-all duration-200',
    };

    const sizeStyles = {
      sm: 'px-3 py-2 text-sm',
      md: 'px-6 py-3 text-base',
      lg: 'px-8 py-4 text-lg',
    };

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
