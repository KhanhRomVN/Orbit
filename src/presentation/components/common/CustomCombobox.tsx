import { FC, useMemo, useRef, useState, KeyboardEvent, useEffect } from "react";
import { ChevronDown, Search, X as XIcon } from "lucide-react";
import { cn } from "../../../shared/lib/utils";

type Option = {
  value: string;
  label: string;
};

interface CustomComboboxProps {
  label: string;
  value: string | string[];
  options: Option[];
  onChange: (value: string | string[]) => void;
  className?: string;
  placeholder?: string;
  searchable?: boolean;
  multiple?: boolean;
  creatable?: boolean;
  size?: "sm" | "md" | "lg";
  required?: boolean;
}

const OPTION_INPUT_THRESHOLD = 10;

const CustomCombobox: FC<CustomComboboxProps> = ({
  label,
  value,
  options,
  onChange,
  className,
  placeholder = "Please enter/select your option...",
  searchable,
  multiple = false,
  creatable = false,
  size = "md",
  required = false,
}) => {
  // Auto determine if should be searchable
  const isInput = useMemo(() => {
    if (multiple === true) return true;
    if (typeof searchable === "boolean") return searchable;
    return options.length >= OPTION_INPUT_THRESHOLD;
  }, [multiple, searchable, options.length]);

  return (
    <ComboboxInput
      label={label}
      value={value}
      options={options}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      multiple={multiple}
      isInput={isInput}
      creatable={creatable}
      size={size}
      required={required}
    />
  );
};

const ComboboxInput: FC<
  Omit<CustomComboboxProps, "searchable"> & { isInput?: boolean }
> = ({
  label,
  value,
  options,
  onChange,
  className,
  placeholder,
  multiple = false,
  creatable = false,
  isInput = false,
  size = "md",
  required = false,
}) => {
  const [input, setInput] = useState("");
  const [showDrop, setShowDrop] = useState(false);
  const [dynamicOptions, setDynamicOptions] = useState<Option[]>([]);
  const [isInputFocused, setIsInputFocused] = useState(false);

  const isMulti = !!multiple;
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Size styles
  const sizeStyles = {
    sm: {
      input: "py-2 text-sm",
      padding: isInput ? "pl-8 pr-8" : "pl-3 pr-8",
      searchIcon: "left-2.5 w-3.5 h-3.5",
      chevron: "right-2 w-4 h-4 p-1 flex items-center justify-center", // Fixed: increased icon size and added flex centering
      label: "text-sm font-medium mb-2",
      badge: "text-xs px-2 py-0.5",
      badgeIcon: "w-2.5 h-2.5",
      option: "px-2.5 py-1.5 text-sm",
      dropdown: "max-h-48",
    },
    md: {
      input: "py-3 text-base",
      padding: isInput ? "pl-10 pr-8" : "pl-3 pr-8",
      searchIcon: "left-3 w-4 h-4",
      chevron: "right-2 w-4 h-4 p-1",
      label: "text-sm font-medium mb-2",
      badge: "text-sm px-3 py-1",
      badgeIcon: "w-3.5 h-3.5",
      option: "px-3 py-2.5 text-sm",
      dropdown: "max-h-60",
    },
    lg: {
      input: "py-4 text-lg",
      padding: isInput ? "pl-12 pr-10" : "pl-4 pr-10",
      searchIcon: "left-4 w-5 h-5",
      chevron: "right-3 w-5 h-5 p-1",
      label: "text-base font-medium mb-2",
      badge: "text-base px-4 py-1.5",
      badgeIcon: "w-4 h-4",
      option: "px-4 py-3 text-base",
      dropdown: "max-h-72",
    },
  };

  const currentSize = sizeStyles[size];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDrop(false);
        setInput("");
        setIsInputFocused(false);
      }
    };
    if (showDrop) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showDrop]);

  // Sync dynamicOptions for values from outside (AI, setValue, etc.)
  useEffect(() => {
    if (isMulti && Array.isArray(value)) {
      const missing = value.filter(
        (v) =>
          !options.some((opt) => opt.value === v) &&
          !dynamicOptions.some((opt) => opt.value === v)
      );
      if (missing.length > 0) {
        setDynamicOptions((prev) => [
          ...prev,
          ...missing.map((v) => ({
            value: v,
            label: v.charAt(0).toUpperCase() + v.slice(1),
          })),
        ]);
      }
    }
    if (!isMulti && typeof value === "string" && value) {
      if (
        !options.some((opt) => opt.value === value) &&
        !dynamicOptions.some((opt) => opt.value === value)
      ) {
        setDynamicOptions((prev) => [
          ...prev,
          {
            value,
            label: value.charAt(0).toUpperCase() + value.slice(1),
          },
        ]);
      }
    }
  }, [value, options, dynamicOptions, isMulti]);

  // Merge options
  const allOptions = useMemo(
    () => [
      ...options,
      ...dynamicOptions.filter(
        (opt) => !options.some((o) => o.value === opt.value)
      ),
    ],
    [options, dynamicOptions]
  );

  // Filtered options
  const filteredOpts = useMemo(() => {
    if (isMulti && Array.isArray(value)) {
      const availableOptions = allOptions.filter(
        (opt) => !value.some((v) => String(v) === String(opt.value || ""))
      );

      if (!input.trim()) {
        return availableOptions;
      }

      const safeInput = input.toLowerCase();
      return availableOptions.filter((opt) => {
        const safeLabel = String(opt.label || "").toLowerCase();
        const safeValue = String(opt.value || "").toLowerCase();
        return safeLabel.includes(safeInput) || safeValue.includes(safeInput);
      });
    }

    if (!input.trim()) {
      return allOptions;
    }

    const safeInput = input.toLowerCase();
    return allOptions.filter((opt) => {
      const safeLabel = String(opt.label || "").toLowerCase();
      const safeValue = String(opt.value || "").toLowerCase();
      return safeLabel.includes(safeInput) || safeValue.includes(safeInput);
    });
  }, [allOptions, input, value, isMulti]);

  // Selected options
  const selectedOpts: Option[] =
    isMulti && Array.isArray(value)
      ? allOptions.filter((o) => value.includes(o.value))
      : typeof value === "string" && value
      ? allOptions.filter((o) => o.value === value)
      : [];

  // Display value logic
  let displayValue: string = "";
  if (isMulti && Array.isArray(value)) {
    displayValue = input;
  } else if (!isMulti && typeof value === "string") {
    if (isInputFocused || showDrop) {
      displayValue = input;
    } else {
      if (value && !input) {
        const selectedOption = allOptions.find((o) => o.value === value);
        displayValue = selectedOption ? selectedOption.label : value;
      } else {
        displayValue = input;
      }
    }
  } else {
    displayValue = input;
  }

  // Dropdown toggles
  const openDropdown = () => {
    setShowDrop(true);
    setIsInputFocused(true);

    if (!isInput && !isMulti && typeof value === "string" && value) {
      setInput("");
    }

    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const clearValue = () => {
    setInput("");
    setIsInputFocused(true);
    if (isMulti) {
      onChange([]);
    } else {
      onChange("");
    }
  };

  const toggleMulti = (val: string) => {
    if (!isMulti) {
      onChange(val);
      setShowDrop(false);
      setInput("");
      setIsInputFocused(false);
      return;
    }
    const arr = Array.isArray(value) ? value.slice() : [];
    if (arr.includes(val)) {
      onChange(arr.filter((v) => v !== val));
    } else {
      onChange([...arr, val]);
    }
    setInput("");
    setShowDrop(true);
  };

  // Remove badge for multi
  const handleRemoveBadge = (val: string) => {
    if (!isMulti) return;
    const arr = Array.isArray(value) ? value.slice() : [];
    onChange(arr.filter((v) => v !== val));
  };

  // Creatable: when pressing Enter, create new tag
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (
      creatable &&
      e.key === "Enter" &&
      input.trim() !== "" &&
      !allOptions.some(
        (opt) => opt.value.toLowerCase() === input.trim().toLowerCase()
      )
    ) {
      e.preventDefault();
      const newOption: Option = {
        value: input.trim(),
        label: input.trim(),
      };
      setDynamicOptions((prev) => [...prev, newOption]);
      if (isMulti) {
        const curArr = Array.isArray(value) ? value.slice() : [];
        onChange([...curArr, newOption.value]);
      } else {
        onChange(newOption.value);
        setShowDrop(false);
      }
      setInput("");
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInput(newValue);
    setShowDrop(true);

    if (!isInput && !isMulti && newValue === "") {
      onChange("");
    }
  };

  const handleFocus = () => {
    setIsInputFocused(true);
    setShowDrop(true);

    if (isInput && !isMulti && typeof value === "string" && value && !input) {
      const selectedOption = allOptions.find((o) => o.value === value);
      if (selectedOption) {
        setInput(selectedOption.label);
      }
    }
  };

  const handleBlur = () => {
    setIsInputFocused(false);
  };

  return (
    <div className={cn("w-full", className)}>
      {label && (
        <label
          className={`block text-gray-700 dark:text-gray-300 ${currentSize.label}`}
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* Input container */}
      <div className="relative" ref={dropdownRef}>
        <div className="relative flex items-center h-full">
          <input
            ref={inputRef}
            type="text"
            autoComplete="off"
            value={displayValue}
            placeholder={placeholder}
            className={cn(
              `w-full ${currentSize.input} bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors text-text-primary placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:bg-white dark:focus:bg-gray-800`,
              currentSize.padding
            )}
            onChange={handleInputChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            readOnly={!isInput && !creatable}
          />

          {/* Search Icon */}
          {isInput && (
            <Search
              className={`absolute ${currentSize.searchIcon} text-gray-400 pointer-events-none`}
            />
          )}

          {/* Chevron/Close Button */}
          {showDrop ||
          (isMulti ? Array.isArray(value) && value.length > 0 : value) ? (
            <button
              type="button"
              aria-label={showDrop ? "Close menu" : "Clear selection"}
              className={`absolute ${currentSize.chevron} z-20 rounded transition-colors hover:bg-gray-100 dark:hover:bg-gray-600 top-1/2 -translate-y-1/2`}
              tabIndex={0}
              onClick={() => {
                clearValue();
              }}
            >
              <XIcon
                className={`${
                  currentSize.chevron.includes("w-4 h-4")
                    ? "w-4 h-4"
                    : currentSize.chevron.includes("w-5 h-5")
                    ? "w-5 h-5"
                    : "w-3.5 h-3.5"
                } text-gray-400 hover:text-gray-600 dark:hover:text-gray-300`}
              />
            </button>
          ) : (
            <button
              type="button"
              aria-label="Open menu"
              className={`absolute ${currentSize.chevron} z-20 rounded transition-colors hover:bg-gray-100 dark:hover:bg-gray-600 top-1/2 -translate-y-1/2`}
              tabIndex={0}
              onClick={openDropdown}
            >
              <ChevronDown className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-transform" />
            </button>
          )}
        </div>

        {/* Dropdown Menu */}
        {showDrop && (
          <div
            className="absolute left-0 top-full z-30 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95"
            style={{ width: "100%", minWidth: "max-content" }}
          >
            {" "}
            <div className={`${currentSize.dropdown} overflow-auto py-1`}>
              {filteredOpts.length === 0 ? (
                <div
                  className={`${currentSize.option} text-gray-400 dark:text-gray-600`}
                >
                  No options found
                  {creatable &&
                    input.trim() !== "" &&
                    !allOptions.some(
                      (opt) =>
                        opt.value.toLowerCase() === input.trim().toLowerCase()
                    ) && (
                      <div className="text-blue-500 dark:text-blue-400 mt-1">
                        Press <b>Enter</b> to create "{input.trim()}"
                      </div>
                    )}
                </div>
              ) : (
                filteredOpts.map((opt: Option, index) => (
                  <button
                    key={opt.value}
                    tabIndex={0}
                    className={cn(
                      `w-full text-left ${currentSize.option} flex items-center gap-2.5 transition-colors`,
                      isMulti && Array.isArray(value)
                        ? value.includes(opt.value)
                          ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium"
                          : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                        : value === opt.value
                        ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700",
                      index === 0 ? "rounded-t-lg" : "",
                      index === filteredOpts.length - 1 ? "rounded-b-lg" : ""
                    )}
                    onMouseDown={() => toggleMulti(opt.value)}
                  >
                    {isMulti &&
                      Array.isArray(value) &&
                      value.includes(opt.value) && (
                        <span
                          className={`${
                            size === "sm"
                              ? "w-2.5 h-2.5"
                              : size === "lg"
                              ? "w-4 h-4"
                              : "w-3.5 h-3.5"
                          } flex items-center justify-center text-blue-600 dark:text-blue-400`}
                        >
                          ✓
                        </span>
                      )}
                    <span className="flex-1">{opt.label}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Multi-select badges */}
      {isMulti && selectedOpts.length > 0 && (
        <div
          className={`flex flex-wrap gap-${size === "sm" ? "1" : "2"} ${
            size === "sm" ? "mt-1" : "mt-2"
          }`}
        >
          {selectedOpts.map((opt) => (
            <span
              key={opt.value}
              className={`bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 ${currentSize.badge} rounded-md flex items-center gap-1.5 font-medium`}
            >
              <span>{opt.label}</span>
              <button
                type="button"
                className="hover:text-red-500 dark:hover:text-red-400 focus:outline-none transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveBadge(opt.value);
                }}
              >
                <XIcon className={currentSize.badgeIcon} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomCombobox;
