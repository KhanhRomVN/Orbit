import React from "react";
import { LucideIcon } from "lucide-react";

interface CustomButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "primary"
    | "secondary"
    | "error"
    | "warning"
    | "success"
    | "loading"
    | "ghost";
  size?: "sm" | "md" | "lg";
  align?: "left" | "center" | "right";
  children: React.ReactNode;
  loading?: boolean;
  icon?: LucideIcon;
  iconClassName?: string; // Custom class for icon styling
  emoji?: React.ReactNode; // SVG emoji
}

const CustomButton: React.FC<CustomButtonProps> = ({
  variant = "primary",
  size = "md",
  align = "center",
  children,
  loading = false,
  icon: Icon,
  iconClassName = "",
  emoji,
  className = "",
  disabled,
  ...props
}) => {
  const baseStyles = `
    inline-flex items-center gap-2 rounded-md font-normal 
    transition-all duration-200 focus:outline-none
    disabled:opacity-50 disabled:cursor-not-allowed
  `;

  const alignStyles = {
    left: "justify-start text-left",
    center: "justify-center text-center",
    right: "justify-end text-right",
  };

  const sizeStyles = {
    sm: "px-2 py-1 text-xs",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg",
  };

  // Icon sizes based on button size
  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  // Emoji sizes based on button size
  const emojiSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  const variantStyles = {
    primary: `
      bg-button-bg text-button-bgText border border-button-border
      hover:bg-button-secondBgHover hover:border-button-borderHover
    `,
    secondary: `
      bg-gray-100 text-gray-700 border border-gray-300
      hover:bg-gray-200 hover:border-gray-400
      dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600
      dark:hover:bg-gray-600 dark:hover:border-gray-500
    `,
    error: `
      bg-red-600 text-white border border-red-600
      hover:bg-red-700 hover:border-red-700
    `,
    warning: `
      bg-yellow-500 text-white border border-yellow-500
      hover:bg-yellow-600 hover:border-yellow-600
    `,
    success: `
      bg-green-600 text-white border border-green-600
      hover:bg-green-700 hover:border-green-700
    `,
    loading: `
      bg-gray-400 text-white border border-gray-400
      cursor-not-allowed
    `,
    ghost: `
      text-text-primary font-normal
      hover:bg-sidebar-itemHover
      active:bg-button-bg active:text-button-bgText
      border-none
    `,
  };

  // Override size styles for ghost variant
  const ghostSizeStyles = {
    sm: "w-full px-2 py-1 text-xs",
    md: "w-full px-3 py-2 text-base",
    lg: "w-full px-4 py-3 text-lg",
  };

  const LoadingSpinner = () => (
    <svg
      className="animate-spin h-3 w-3"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      ></circle>
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      ></path>
    </svg>
  );

  const currentVariant = loading ? "loading" : variant;
  const isDisabled = disabled || loading || variant === "loading";

  // Render icon or emoji based on what's provided (mutually exclusive)
  const renderLeftIcon = () => {
    if (loading || variant === "loading") {
      return <LoadingSpinner />;
    }

    // Only render icon if no emoji is provided
    if (Icon && !emoji) {
      return <Icon className={`${iconSizes[size]} ${iconClassName}`.trim()} />;
    }

    // Only render emoji if no icon is provided
    if (emoji && !Icon) {
      return (
        <span className={`inline-block ${emojiSizes[size]}`}>{emoji}</span>
      );
    }

    // If both are provided, prioritize icon and ignore emoji
    if (Icon && emoji) {
      console.warn(
        "CustomButton: Both icon and emoji props provided. Only icon will be rendered."
      );
      return <Icon className={`${iconSizes[size]} ${iconClassName}`.trim()} />;
    }

    return null;
  };

  return (
    <button
      className={`
        ${baseStyles}
        ${alignStyles[align]}
        ${variant === "ghost" ? ghostSizeStyles[size] : sizeStyles[size]}
        ${variantStyles[currentVariant]}
        ${className}
      `
        .replace(/\s+/g, " ")
        .trim()}
      disabled={isDisabled}
      {...props}
    >
      {renderLeftIcon()}
      {children}
    </button>
  );
};

export default CustomButton;
