import React from 'react'
import { LucideIcon } from 'lucide-react'

interface CustomBadgeProps {
  variant?:
    | 'default'
    | 'primary'
    | 'secondary'
    | 'success'
    | 'warning'
    | 'error'
    | 'info'
    | 'phone'
    | 'input-filled'
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
  icon?: LucideIcon
  iconClassName?: string
  className?: string
}

const CustomBadge: React.FC<CustomBadgeProps> = ({
  variant = 'default',
  size = 'md',
  children,
  icon: Icon,
  iconClassName = '',
  className = ''
}) => {
  const baseStyles = `
    inline-flex items-center gap-1 rounded-lg font-medium
    whitespace-nowrap border
  `

  const sizeStyles = {
    sm: 'px-3 h-[38px] text-sm',
    md: 'px-4 h-[48px] text-base',
    lg: 'px-5 h-[56px] text-lg'
  }

  const iconSizes = {
    sm: 'h-2 w-2',
    md: 'h-3 w-3',
    lg: 'h-4 w-4'
  }

  const variantStyles = {
    default: `
    bg-gray-100 text-gray-800 border-gray-200
    dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700
  `,
    primary: `
    bg-blue-100 text-blue-800 border-blue-200
    dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800
  `,
    secondary: `
    bg-gray-100 text-gray-700 border-gray-200
    dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600
  `,
    success: `
    bg-green-100 text-green-800 border-green-200
    dark:bg-green-900/20 dark:text-green-300 dark:border-green-800
  `,
    warning: `
    bg-yellow-100 text-yellow-800 border-yellow-200
    dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800
  `,
    error: `
    bg-red-100 text-red-800 border-red-200
    dark:bg-red-900/20 dark:text-red-300 dark:border-red-800
  `,
    info: `
    bg-blue-100 text-blue-800 border-blue-200
    dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800
  `,
    phone: `
    bg-blue-50 text-blue-700 border-blue-200
    dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-700
  `,
    'input-filled': `
    bg-gray-50 text-gray-700 border-transparent
    dark:bg-gray-700 dark:text-gray-300 dark:border-transparent
  `
  }

  return (
    <span
      className={`
        ${baseStyles}
        ${sizeStyles[size]}
        ${variantStyles[variant]}
        ${className}
      `
        .replace(/\s+/g, ' ')
        .trim()}
    >
      {Icon && <Icon className={`${iconSizes[size]} ${iconClassName}`.trim()} />}
      {children}
    </span>
  )
}

export default CustomBadge
