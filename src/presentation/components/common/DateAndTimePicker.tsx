// src/renderer/src/components/common/DateAndTimePicker.tsx
import React, { useState, useEffect, useRef } from "react";
import { Calendar, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../../../shared/lib/utils";
import CustomPopover from "./CustomPopover";

interface DateAndTimePickerProps {
  value?: string; // ISO string format
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  showTime?: boolean;
  format?: string; // Display format
  minDate?: string;
  maxDate?: string;
  size?: "sm" | "md" | "lg";
  error?: boolean;
  helperText?: string;
  label?: string;
  required?: boolean;
  variant?:
    | "default"
    | "filled"
    | "outlined"
    | "underlined"
    | "floating"
    | "primary";
  leftIcon?: React.ReactNode;
}

const DateAndTimePicker: React.FC<DateAndTimePickerProps> = ({
  value,
  onChange,
  placeholder = "Select date and time",
  disabled = false,
  className,
  showTime = true,
  format = "DD/MM/YYYY HH:mm",
  minDate,
  maxDate,
  size = "md",
  error = false,
  helperText,
  label,
  required = false,
  variant = "default",
  leftIcon,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState({ hours: 0, minutes: 0 });
  const [tempDate, setTempDate] = useState<Date | null>(null);
  const [tempTime, setTempTime] = useState({ hours: 0, minutes: 0 });
  const [lastScrollY, setLastScrollY] = useState(0);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (value) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        setSelectedDate(date);
        setViewDate(date);
        setSelectedTime({
          hours: date.getHours(),
          minutes: date.getMinutes(),
        });
        setTempDate(date);
        setTempTime({
          hours: date.getHours(),
          minutes: date.getMinutes(),
        });
      }
    } else {
      setSelectedDate(null);
      setTempDate(null);
    }
  }, [value]);

  // Handle scroll to hide popover
  useEffect(() => {
    if (!isOpen) return;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Clear existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Set timeout to hide popover after scroll stops
      scrollTimeoutRef.current = setTimeout(() => {
        // Check if scroll distance is significant
        if (Math.abs(currentScrollY - lastScrollY) > 10) {
          setIsOpen(false);
        }
        setLastScrollY(currentScrollY);
      }, 100);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    document.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("scroll", handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [isOpen, lastScrollY]);

  // Set initial scroll position when opening
  useEffect(() => {
    if (isOpen) {
      setLastScrollY(window.scrollY);
    }
  }, [isOpen]);

  const formatDisplayValue = (date: Date) => {
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();

    if (showTime) {
      const hours = date.getHours().toString().padStart(2, "0");
      const minutes = date.getMinutes().toString().padStart(2, "0");
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    }

    return `${day}/${month}/${year}`;
  };

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const navigateMonth = (direction: "prev" | "next") => {
    setViewDate((prev) => {
      const newDate = new Date(prev);
      if (direction === "prev") {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const navigateYear = (direction: "prev" | "next") => {
    setViewDate((prev) => {
      const newDate = new Date(prev);
      if (direction === "prev") {
        newDate.setFullYear(prev.getFullYear() - 1);
      } else {
        newDate.setFullYear(prev.getFullYear() + 1);
      }
      return newDate;
    });
  };

  const handleDateSelect = (day: number) => {
    const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);

    if (showTime) {
      newDate.setHours(tempTime.hours, tempTime.minutes);
    }

    setTempDate(newDate);

    if (!showTime) {
      setSelectedDate(newDate);
      onChange?.(newDate.toISOString());
      setIsOpen(false);
    }
  };

  const handleTimeChange = (type: "hours" | "minutes", value: number) => {
    setTempTime((prev) => ({ ...prev, [type]: value }));

    if (tempDate) {
      const newDate = new Date(tempDate);
      if (type === "hours") {
        newDate.setHours(value);
      } else {
        newDate.setMinutes(value);
      }
      setTempDate(newDate);
    }
  };

  const handleApply = () => {
    if (tempDate) {
      if (showTime) {
        tempDate.setHours(tempTime.hours, tempTime.minutes);
      }
      setSelectedDate(tempDate);
      setSelectedTime(tempTime);
      onChange?.(tempDate.toISOString());
    }
    setIsOpen(false);
  };

  const handleCancel = () => {
    // Reset temp values to current selected values
    setTempDate(selectedDate);
    setTempTime(selectedTime);
    setIsOpen(false);
  };

  const handleClear = () => {
    setSelectedDate(null);
    setTempDate(null);
    setSelectedTime({ hours: 0, minutes: 0 });
    setTempTime({ hours: 0, minutes: 0 });
    onChange?.("");
    setIsOpen(false);
  };

  const handleToday = () => {
    const today = new Date();
    setTempDate(today);
    setViewDate(today);
    if (showTime) {
      const currentTime = {
        hours: today.getHours(),
        minutes: today.getMinutes(),
      };
      setTempTime(currentTime);
    }
  };

  const isDateDisabled = (date: Date) => {
    if (minDate && date < new Date(minDate)) return true;
    if (maxDate && date > new Date(maxDate)) return true;
    return false;
  };

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(viewDate);
    const firstDay = getFirstDayOfMonth(viewDate);
    const days = [];
    const today = new Date();

    // Get previous month's last days
    const prevMonth = new Date(
      viewDate.getFullYear(),
      viewDate.getMonth() - 1,
      0
    );
    const daysInPrevMonth = prevMonth.getDate();

    // Previous month's trailing days
    for (let i = firstDay - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      const date = new Date(
        viewDate.getFullYear(),
        viewDate.getMonth() - 1,
        day
      );
      days.push(
        <button
          key={`prev-${day}`}
          onClick={() => {
            navigateMonth("prev");
            setTimeout(() => handleDateSelect(day), 0);
          }}
          className="h-7 w-7 rounded-md text-xs text-gray-400 dark:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          {day}
        </button>
      );
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
      const isSelected =
        tempDate &&
        tempDate.getDate() === day &&
        tempDate.getMonth() === viewDate.getMonth() &&
        tempDate.getFullYear() === viewDate.getFullYear();
      const isToday = today.toDateString() === date.toDateString();
      const disabled = isDateDisabled(date);

      days.push(
        <button
          key={day}
          onClick={() => !disabled && handleDateSelect(day)}
          disabled={disabled}
          className={cn(
            "h-7 w-7 rounded-md text-xs font-medium transition-colors hover:bg-gray-100 dark:hover:bg-gray-700",
            {
              "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700":
                isSelected,
              "bg-blue-100 text-blue-900 dark:bg-blue-900/50 dark:text-blue-100 ring-1 ring-blue-600 dark:ring-blue-400":
                isToday && !isSelected,
              "text-gray-300 cursor-not-allowed hover:bg-transparent dark:text-gray-700":
                disabled,
              "text-gray-900 dark:text-gray-100":
                !isSelected && !isToday && !disabled,
            }
          )}
        >
          {day}
        </button>
      );
    }

    // Next month's leading days to fill the grid
    const totalCells = 42; // 6 rows × 7 days
    const remainingCells = totalCells - days.length;
    for (let day = 1; day <= remainingCells; day++) {
      const date = new Date(
        viewDate.getFullYear(),
        viewDate.getMonth() + 1,
        day
      );
      days.push(
        <button
          key={`next-${day}`}
          onClick={() => {
            navigateMonth("next");
            setTimeout(() => handleDateSelect(day), 0);
          }}
          className="h-7 w-7 rounded-md text-xs text-gray-400 dark:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          {day}
        </button>
      );
    }

    return days;
  };

  const renderTimePicker = () => {
    if (!showTime) return null;

    return (
      <div className="flex flex-col items-center justify-start py-4 px-3 bg-gray-50 dark:bg-gray-800/50 min-h-[300px] space-y-4">
        <label className="text-xs font-medium text-text-secondary mb-1">
          Select Time
        </label>

        {/* Time Display */}
        <div className="text-2xl font-mono font-bold text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 min-w-[80px] text-center">
          {tempTime.hours.toString().padStart(2, "0")}:
          {tempTime.minutes.toString().padStart(2, "0")}
        </div>

        {/* Hours Section */}
        <div className="flex flex-col items-center w-full space-y-2">
          <label className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            Hours
          </label>
          <select
            value={tempTime.hours}
            onChange={(e) =>
              handleTimeChange("hours", parseInt(e.target.value))
            }
            className="w-full max-w-[80px] px-3 py-2 text-sm font-mono border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none cursor-pointer text-center"
          >
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>
                {i.toString().padStart(2, "0")}
              </option>
            ))}
          </select>
        </div>

        {/* Minutes Section */}
        <div className="flex flex-col items-center w-full space-y-2">
          <label className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            Minutes
          </label>
          <select
            value={tempTime.minutes}
            onChange={(e) =>
              handleTimeChange("minutes", parseInt(e.target.value))
            }
            className="w-full max-w-[80px] px-3 py-2 text-sm font-mono border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none cursor-pointer text-center"
          >
            {Array.from({ length: 60 }, (_, i) => (
              <option key={i} value={i}>
                {i.toString().padStart(2, "0")}
              </option>
            ))}
          </select>
        </div>

        {/* Now Button */}
        <div className="mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const now = new Date();
              setTempTime({
                hours: now.getHours(),
                minutes: now.getMinutes(),
              });
            }}
            className="text-xs text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 h-7 px-3"
          >
            <Clock className="h-3 w-3 mr-1" />
            Now
          </Button>
        </div>
      </div>
    );
  };

  const sizeClasses = {
    sm: "h-8 text-sm px-2",
    md: "h-10 text-sm px-3",
    lg: "h-12 text-base px-4",
  };

  // Variant styles matching CustomInput
  const variantStyles = {
    default: `
      bg-card-background 
      border border-gray-300 dark:border-gray-600 
      rounded-lg
      focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
    `,
    filled: `
      bg-gray-50 dark:bg-gray-700 
      border border-transparent 
      rounded-lg
      focus:bg-white dark:focus:bg-gray-800
      focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
    `,
    outlined: `
      bg-transparent 
      border-2 border-gray-300 dark:border-gray-600 
      rounded-lg
      focus:border-blue-500
    `,
    underlined: `
      bg-transparent 
      border-0 border-b-2 border-gray-300 dark:border-gray-600 
      rounded-none
      focus:border-blue-500
    `,
    floating: `
      bg-card-background 
      border border-gray-300 dark:border-gray-600 
      rounded-lg pt-6 pb-2
      focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
    `,
    primary: `
      bg-input-background
      border border-gray-300 dark:border-gray-600 
      rounded-lg
      hover:border-gray-400 dark:hover:border-gray-500
      focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
    `,
  };

  // Get padding based on left icon
  const getPaddingClass = () => {
    if (leftIcon) {
      switch (size) {
        case "sm":
          return "pl-8 pr-8"; // Match với CustomInput withLeftIcon
        case "md":
          return "pl-12 pr-12"; // Match với CustomInput withLeftIcon (tăng từ 10 lên 12)
        case "lg":
          return "pl-14 pr-14"; // Match với CustomInput withLeftIcon (tăng từ 12 lên 14)
      }
    }
    switch (size) {
      case "sm":
        return "pl-3 pr-8"; // Match với CustomInput default (tăng từ 2 lên 3)
      case "md":
        return "pl-4 pr-12"; // Match với CustomInput default (tăng từ 3 lên 4)
      case "lg":
        return "pl-5 pr-14"; // Match với CustomInput default (tăng từ 4 lên 5)
    }
  };

  const pickerContent = (
    <div className="w-96 bg-card-background rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
      {/* Horizontal Layout Container */}
      <div className="flex">
        {/* Calendar Section */}
        <div className="flex-1">
          {/* Calendar Header */}
          <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigateYear("prev")}
                className="h-6 w-6 p-0 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigateMonth("prev")}
                className="h-6 w-6 p-0 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <ChevronLeft className="h-2 w-2" />
              </Button>
            </div>

            <div className="font-semibold text-gray-900 dark:text-gray-100 text-center">
              <div className="text-xs">{monthNames[viewDate.getMonth()]}</div>
              <div className="text-sm font-bold">{viewDate.getFullYear()}</div>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigateMonth("next")}
                className="h-6 w-6 p-0 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <ChevronRight className="h-2 w-2" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigateYear("next")}
                className="h-6 w-6 p-0 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="p-3">
            <div className="grid grid-cols-7 gap-1 mb-1">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                <div
                  key={day}
                  className="h-6 w-7 text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center justify-center"
                >
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">{renderCalendar()}</div>

            {/* Today Button */}
            <div className="mt-2 text-center">
              <Button
                variant="outline"
                size="sm"
                onClick={handleToday}
                className="text-xs text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 h-6 px-2"
              >
                <Calendar className="h-3 w-3 mr-1" />
                Today
              </Button>
            </div>
          </div>
        </div>

        {/* Time Picker Section */}
        {showTime && (
          <div className="w-32 border-l border-gray-200 dark:border-gray-700">
            {renderTimePicker()}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
            className="text-xs text-text-secondary border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 h-6 px-2"
          >
            Clear
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancel}
            className="text-xs text-text-secondary border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 h-6 px-2"
          >
            Cancel
          </Button>
        </div>
        <Button
          size="sm"
          onClick={handleApply}
          disabled={!tempDate}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 text-white font-medium h-6 px-3 text-xs"
        >
          Apply
        </Button>
      </div>
    </div>
  );

  return (
    <div className={cn("flex flex-col", className)}>
      {label && variant === "floating" && (
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <CustomPopover
        open={isOpen}
        onOpenChange={setIsOpen}
        content={pickerContent}
        placement="bottom-start"
        closeOnClickOutside={true}
        closeOnEscape={true}
        disabled={disabled}
        offset={4}
      >
        <div className="relative">
          {/* Left Icon */}
          {leftIcon && (
            <div
              className={cn(
                "absolute left-3 top-1/2 -translate-y-1/2 text-text-primary pointer-events-none z-10",
                size === "sm" && "left-2.5", // Match với CustomInput
                size === "md" && "left-3", // Match với CustomInput
                size === "lg" && "left-4" // Match với CustomInput
              )}
            >
              {leftIcon}
            </div>
          )}

          {/* Floating Label */}
          {label && variant === "floating" && (
            <label
              className={cn(
                "absolute left-4 transition-all duration-200 pointer-events-none z-10",
                isOpen || selectedDate
                  ? "top-2 text-xs text-blue-500 dark:text-blue-400"
                  : "top-1/2 -translate-y-1/2 text-base text-gray-400",
                leftIcon && "left-10"
              )}
            >
              {label}
              {required && <span className="text-red-500 ml-1">*</span>}
            </label>
          )}

          <div
            className={cn(
              "relative flex items-center justify-between border rounded-md cursor-pointer transition-all duration-200",
              "hover:border-gray-400 dark:hover:border-gray-500",
              "focus-within:border-blue-500 dark:focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500/20 dark:focus-within:ring-blue-400/20",
              error
                ? "border-red-500 dark:border-red-400"
                : "border-gray-300 dark:border-gray-600",
              sizeClasses[size],
              getPaddingClass(),
              variantStyles[variant],
              disabled &&
                "opacity-50 cursor-not-allowed hover:border-gray-300 dark:hover:border-gray-600"
            )}
            onClick={() => !disabled && setIsOpen(!isOpen)}
          >
            <span
              className={cn(
                "flex-1 text-left truncate",
                !selectedDate && "text-gray-500 dark:text-gray-400",
                selectedDate && "text-gray-900 dark:text-gray-100",
                variant === "floating" && (isOpen || selectedDate) && "mt-2"
              )}
            >
              {selectedDate ? formatDisplayValue(selectedDate) : placeholder}
            </span>
            <div className="flex items-center gap-1 ml-2 flex-shrink-0">
              <Calendar className="h-4 w-4 text-gray-400" />
            </div>
          </div>
        </div>
      </CustomPopover>

      {helperText && (
        <div
          className={cn(
            "mt-1 text-xs",
            error
              ? "text-red-500 dark:text-red-400"
              : "text-gray-500 dark:text-gray-400"
          )}
        >
          {helperText}
        </div>
      )}
    </div>
  );
};

export default DateAndTimePicker;
