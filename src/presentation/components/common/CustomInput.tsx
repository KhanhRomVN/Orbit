import React, { useState, forwardRef, useRef, useEffect } from "react";
import { Eye, EyeOff, AlertCircle, CheckCircle, Info } from "lucide-react";
import DateAndTimePicker from "./DateAndTimePicker";

interface CustomInputProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "size" | "onChange"
  > {
  label?: string;
  required?: boolean;
  error?: string;
  success?: string;
  hint?: string;
  variant?:
    | "default"
    | "filled"
    | "outlined"
    | "underlined"
    | "floating"
    | "primary";
  size?: "sm" | "md" | "lg";
  showCharCount?: boolean;
  maxLength?: number;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  loading?: boolean;
  prefix?: string;
  suffix?: string;
  onChange?: (value: string) => void;
  // DateTimePicker specific props
  minDate?: string;
  maxDate?: string;
  showTime?: boolean;
  // Textarea specific props
  multiline?: boolean;
  rows?: number;
  minRows?: number;
  maxRows?: number;
  autoResize?: boolean;
}

const CustomInput = forwardRef<
  HTMLInputElement | HTMLTextAreaElement,
  CustomInputProps
>(
  (
    {
      label,
      required = false,
      error,
      success,
      hint,
      variant = "default",
      size = "md",
      showCharCount = false,
      maxLength,
      leftIcon,
      rightIcon,
      loading = false,
      prefix,
      suffix,
      type = "text",
      className = "",
      value = "",
      onChange,
      disabled,
      minDate,
      maxDate,
      showTime = true,
      // Textarea props
      multiline = false,
      rows = 3,
      minRows = 1,
      maxRows = 10,
      autoResize = true,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const isPassword = type === "password";
    const isDateTimeLocal = type === "datetime-local";
    const inputType = isPassword && showPassword ? "text" : type;
    const hasValue = String(value).length > 0;
    const charCount = String(value).length;

    // Auto-resize textarea
    useEffect(() => {
      if (multiline && autoResize && textareaRef.current) {
        const textarea = textareaRef.current;
        // Reset height to calculate scrollHeight
        textarea.style.height = "auto";

        // Calculate new height
        const scrollHeight = textarea.scrollHeight;
        const lineHeight = parseInt(getComputedStyle(textarea).lineHeight);
        const minHeight = lineHeight * minRows;
        const maxHeight = lineHeight * maxRows;

        // Set new height within constraints
        const newHeight = Math.max(
          minHeight,
          Math.min(maxHeight, scrollHeight)
        );
        textarea.style.height = `${newHeight}px`;
      }
    }, [value, multiline, autoResize, minRows, maxRows]);

    // Base styles
    const baseInputStyles = `
    w-full transition-all duration-200 outline-none
    disabled:opacity-50 disabled:cursor-not-allowed
    placeholder:text-gray-400 dark:placeholder:text-gray-500
    resize-none
  `;

    // Size styles
    const sizeStyles = {
      sm: "text-sm",
      md: "text-base",
      lg: "text-lg",
    };

    const paddingStyles = {
      sm: {
        default: "px-3 py-2",
        withLeftIcon: "pl-10 pr-3 py-2",
        withRightIcon: "pl-3 pr-10 py-2",
        withBothIcons: "pl-10 pr-10 py-2",
      },
      md: {
        default: "px-4 py-3",
        withLeftIcon: "pl-12 pr-4 py-3",
        withRightIcon: "pl-4 pr-12 py-3",
        withBothIcons: "pl-12 pr-12 py-3",
      },
      lg: {
        default: "px-5 py-4",
        withLeftIcon: "pl-14 pr-5 py-4",
        withRightIcon: "pl-5 pr-14 py-4",
        withBothIcons: "pl-14 pr-14 py-4",
      },
    };

    // Variant styles
    const variantStyles = {
      default: {
        container: "relative",
        input: `
        bg-card-background 
        border border-gray-300 dark:border-gray-600 
        rounded-lg
        focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
      `,
        label:
          "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2",
      },
      filled: {
        container: "relative",
        input: `
        bg-gray-50 dark:bg-gray-700 
        border border-transparent 
        rounded-lg
        focus:bg-white dark:focus:bg-gray-800
        focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
      `,
        label:
          "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2",
      },
      outlined: {
        container: "relative",
        input: `
        bg-transparent 
        border-2 border-gray-300 dark:border-gray-600 
        rounded-lg
        focus:border-blue-500
      `,
        label:
          "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2",
      },
      underlined: {
        container: "relative",
        input: `
        bg-transparent 
        border-0 border-b-2 border-gray-300 dark:border-gray-600 
        rounded-none
        focus:border-blue-500
      `,
        label:
          "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2",
      },
      floating: {
        container: "relative",
        input: `
        bg-card-background 
        border border-gray-300 dark:border-gray-600 
        rounded-lg pt-6 pb-2
        focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
      `,
        label: `
        absolute left-4 transition-all duration-200 pointer-events-none
        ${
          isFocused || hasValue
            ? "top-2 text-xs text-blue-500 dark:text-blue-400"
            : `${
                multiline ? "top-4" : "top-1/2 -translate-y-1/2"
              } text-base text-gray-400`
        }
      `,
      },
      primary: {
        container: "relative",
        input: `
        bg-input-background
        border border-gray-300 dark:border-gray-600 
        rounded-lg
        hover:border-gray-400 dark:hover:border-gray-500
        focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
      `,
        label:
          "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2",
      },
    };

    // Status styles with error validation
    const getStatusStyles = () => {
      if (error) {
        return {
          border:
            "border-red-500 dark:border-red-400 hover:border-red-600 dark:hover:border-red-300 focus:border-red-500 focus:ring-red-500/20",
          icon: <AlertCircle className="w-5 h-5 text-red-500" />,
          message: "text-red-600 dark:text-red-400",
        };
      }
      if (success) {
        return {
          border:
            "border-green-500 dark:border-green-400 focus:border-green-500 focus:ring-green-500/20",
          icon: <CheckCircle className="w-5 h-5 text-green-500" />,
          message: "text-green-600 dark:text-green-400",
        };
      }
      return {
        border: "",
        icon: null,
        message: "text-gray-500 dark:text-gray-400",
      };
    };

    const statusStyles = getStatusStyles();

    // Get padding based on icons
    const getPaddingClass = () => {
      const hasLeft = leftIcon || prefix;
      const hasRight =
        rightIcon || suffix || isPassword || loading || statusStyles.icon;

      if (hasLeft && hasRight) return paddingStyles[size].withBothIcons;
      if (hasLeft) return paddingStyles[size].withLeftIcon;
      if (hasRight) return paddingStyles[size].withRightIcon;
      return paddingStyles[size].default;
    };

    const LoadingSpinner = () => (
      <svg
        className="animate-spin h-4 w-4 text-gray-400"
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
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    );

    const handleChange = (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
      if (maxLength && e.target.value.length > maxLength) return;
      onChange?.(e.target.value);
    };

    // Handle datetime-local value change from DateAndTimePicker
    const handleDateTimeChange = (isoString: string) => {
      onChange?.(isoString);
    };

    // For datetime-local, we'll render the DateAndTimePicker
    if (isDateTimeLocal) {
      return (
        <div className={variantStyles[variant].container}>
          {/* Label for non-floating variants */}
          {label && variant !== "floating" && (
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {label}
                {required && <span className="text-red-500 ml-1">*</span>}
              </label>
            </div>
          )}

          <DateAndTimePicker
            value={value as string}
            onChange={handleDateTimeChange}
            disabled={disabled}
            size={size}
            error={!!error}
            helperText={error || success || hint}
            showTime={showTime}
            minDate={minDate}
            maxDate={maxDate}
            placeholder={props.placeholder || "Select date and time"}
            className={className}
            variant={variant}
            leftIcon={leftIcon}
            required={required}
            label={variant === "floating" ? label : undefined}
          />
        </div>
      );
    }

    return (
      <div className={variantStyles[variant].container}>
        {/* Label for non-floating variants */}
        {label && variant !== "floating" && (
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {label}
              {required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {/* Character Count in Label Row */}
            {showCharCount && maxLength && (
              <span
                className={`text-sm ${
                  charCount > maxLength * 0.9
                    ? "text-red-500"
                    : "text-text-primary"
                }`}
              >
                {charCount}/{maxLength}
              </span>
            )}
          </div>
        )}

        {/* Input Container */}
        <div className="relative">
          {/* Prefix */}
          {prefix && !multiline && (
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-sm font-medium pointer-events-none z-10">
              {prefix}
            </div>
          )}

          {/* Left Icon */}
          {leftIcon && (
            <div
              className={`absolute left-3 ${
                multiline ? "top-4" : "top-1/2 -translate-y-1/2"
              } text-text-primary pointer-events-none z-10`}
            >
              {leftIcon}
            </div>
          )}

          {/* Floating Label */}
          {label && variant === "floating" && (
            <label className={variantStyles[variant].label}>
              {label}
              {required && <span className="text-red-500 ml-1">*</span>}
            </label>
          )}

          {/* Input or Textarea */}
          {multiline ? (
            <textarea
              ref={(node) => {
                textareaRef.current = node;
                if (typeof ref === "function") {
                  ref(node);
                } else if (ref) {
                  ref.current = node;
                }
              }}
              value={value}
              onChange={handleChange}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              disabled={disabled}
              rows={autoResize ? minRows : rows}
              className={`
                ${baseInputStyles}
                ${sizeStyles[size]}
                ${getPaddingClass()}
                ${variantStyles[variant].input}
                ${statusStyles.border}
                ${className}
              `
                .replace(/\s+/g, " ")
                .trim()}
              {...(props as any)}
            />
          ) : (
            <input
              ref={ref as React.Ref<HTMLInputElement>}
              type={inputType}
              value={value}
              onChange={handleChange}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              disabled={disabled}
              className={`
                ${baseInputStyles}
                ${sizeStyles[size]}
                ${getPaddingClass()}
                ${variantStyles[variant].input}
                ${statusStyles.border}
                ${className}
              `
                .replace(/\s+/g, " ")
                .trim()}
              {...props}
            />
          )}

          {/* Right Icons Container */}
          <div
            className={`absolute right-3 ${
              multiline ? "top-4" : "top-1/2 -translate-y-1/2"
            } flex items-center gap-2`}
          >
            {/* Loading Spinner */}
            {loading && <LoadingSpinner />}

            {/* Status Icon */}
            {statusStyles.icon && !loading && statusStyles.icon}

            {/* Password Toggle */}
            {isPassword && !loading && (
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            )}

            {/* Custom Right Icon */}
            {rightIcon &&
              !isPassword &&
              !isDateTimeLocal &&
              !loading &&
              !statusStyles.icon && (
                <div className="text-text-primary">{rightIcon}</div>
              )}
          </div>

          {/* Suffix */}
          {suffix && !multiline && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-sm font-medium pointer-events-none">
              {suffix}
            </div>
          )}
        </div>

        {/* Bottom Section - Only show messages, no character count */}
        <div className="mt-2">
          {/* Error Message */}
          {error && (
            <p
              className={`text-sm flex items-center gap-1 ${statusStyles.message}`}
            >
              <AlertCircle className="w-4 h-4" />
              {error}
            </p>
          )}

          {/* Success Message */}
          {success && !error && (
            <p
              className={`text-sm flex items-center gap-1 ${statusStyles.message}`}
            >
              <CheckCircle className="w-4 h-4" />
              {success}
            </p>
          )}

          {/* Hint Message */}
          {hint && !error && !success && (
            <p
              className={`text-sm flex items-center gap-1 ${statusStyles.message}`}
            >
              <Info className="w-4 h-4" />
              {hint}
            </p>
          )}
        </div>
      </div>
    );
  }
);

CustomInput.displayName = "CustomInput";

export default CustomInput;
