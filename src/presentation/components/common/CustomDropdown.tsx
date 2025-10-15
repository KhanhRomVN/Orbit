import React from "react";
import { cn } from "../../../shared/lib/utils";

export interface DropdownOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
}

interface CustomDropdownProps {
  options: DropdownOption[];
  onSelect: (value: string) => void;
  className?: string;
  align?: "left" | "right";
  width?: string;
}

const CustomDropdown: React.FC<CustomDropdownProps> = ({
  options,
  onSelect,
  className,
  align = "right",
  width = "w-36",
}) => {
  const handleSelect = (value: string, disabled?: boolean) => {
    if (disabled) {
      return;
    }

    onSelect(value);
  };

  return (
    <div className={cn("relative", className)}>
      <div
        className={cn(
          "bg-card-background border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95",
          width,
          align === "right" ? "right-0" : "left-0"
        )}
        style={{ zIndex: 9999 }}
      >
        {options.map((option, index) => (
          <button
            key={option.value}
            onClick={(e) => {
              e.stopPropagation();
              handleSelect(option.value, option.disabled);
            }}
            disabled={option.disabled}
            className={cn(
              "w-full text-left px-3 py-2.5 flex items-center gap-2.5 transition-colors text-sm",
              option.disabled
                ? "text-gray-400 dark:text-gray-600 cursor-not-allowed"
                : option.danger
                ? "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700",
              index === 0 ? "rounded-t-lg" : "",
              index === options.length - 1 ? "rounded-b-lg" : ""
            )}
          >
            {option.icon && (
              <span className="w-3.5 h-3.5 flex items-center justify-center">
                {option.icon}
              </span>
            )}
            <span>{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default CustomDropdown;
