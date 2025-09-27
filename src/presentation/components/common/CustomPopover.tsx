// src/renderer/src/components/common/CustomPopover.tsx
import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../../shared/lib/utils";

interface CustomPopoverProps {
  children: React.ReactNode;
  content: React.ReactNode;
  trigger?: "click" | "hover";
  placement?:
    | "top"
    | "bottom"
    | "left"
    | "right"
    | "top-start"
    | "top-end"
    | "bottom-start"
    | "bottom-end";
  offset?: number;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  contentClassName?: string;
  disabled?: boolean;
  closeOnClickOutside?: boolean;
  closeOnEscape?: boolean;
  arrow?: boolean;
}

const CustomPopover: React.FC<CustomPopoverProps> = ({
  children,
  content,
  trigger = "click",
  placement = "bottom",
  offset = 8,
  open: controlledOpen,
  onOpenChange,
  className,
  contentClassName,
  disabled = false,
  closeOnClickOutside = true,
  closeOnEscape = true,
  arrow = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const isControlled = controlledOpen !== undefined;

  const actualOpen = isControlled ? controlledOpen : isOpen;

  const updatePosition = () => {
    if (!triggerRef.current || !actualOpen) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Get content dimensions for better positioning
    let contentWidth = 320; // Default width, will be updated when content is measured
    let contentHeight = 400; // Default height

    if (contentRef.current) {
      const contentRect = contentRef.current.getBoundingClientRect();
      contentWidth = contentRect.width || contentWidth;
      contentHeight = contentRect.height || contentHeight;
    }

    let top = 0;
    let left = 0;

    switch (placement) {
      case "top":
        top = triggerRect.top + scrollY - contentHeight - offset;
        left =
          triggerRect.left + scrollX + triggerRect.width / 2 - contentWidth / 2;
        break;
      case "top-start":
        top = triggerRect.top + scrollY - contentHeight - offset;
        left = triggerRect.left + scrollX;
        break;
      case "top-end":
        top = triggerRect.top + scrollY - contentHeight - offset;
        left = triggerRect.right + scrollX - contentWidth;
        break;
      case "bottom":
        top = triggerRect.bottom + scrollY + offset;
        left =
          triggerRect.left + scrollX + triggerRect.width / 2 - contentWidth / 2;
        break;
      case "bottom-start":
        top = triggerRect.bottom + scrollY + offset;
        left = triggerRect.left + scrollX;
        break;
      case "bottom-end":
        top = triggerRect.bottom + scrollY + offset;
        left = triggerRect.right + scrollX - contentWidth;
        break;
      case "left":
        top =
          triggerRect.top +
          scrollY +
          triggerRect.height / 2 -
          contentHeight / 2;
        left = triggerRect.left + scrollX - contentWidth - offset;
        break;
      case "right":
        top =
          triggerRect.top +
          scrollY +
          triggerRect.height / 2 -
          contentHeight / 2;
        left = triggerRect.right + scrollX + offset;
        break;
    }

    // Viewport boundary checks
    if (left < 10) left = 10;
    if (left + contentWidth > viewportWidth - 10)
      left = viewportWidth - contentWidth - 10;
    if (top < 10) top = 10;
    if (top + contentHeight > viewportHeight - 10)
      top = viewportHeight - contentHeight - 10;

    setPosition({ top, left });
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (disabled) return;

    if (isControlled) {
      onOpenChange?.(newOpen);
    } else {
      setIsOpen(newOpen);
    }
  };

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (trigger === "click") {
      handleOpenChange(!actualOpen);
    }
  };

  const handleTriggerMouseEnter = () => {
    if (trigger === "hover") {
      handleOpenChange(true);
    }
  };

  const handleTriggerMouseLeave = () => {
    if (trigger === "hover") {
      handleOpenChange(false);
    }
  };

  const handleClickOutside = (e: MouseEvent) => {
    if (
      closeOnClickOutside &&
      actualOpen &&
      triggerRef.current &&
      contentRef.current &&
      !triggerRef.current.contains(e.target as Node) &&
      !contentRef.current.contains(e.target as Node)
    ) {
      handleOpenChange(false);
    }
  };

  const handleEscapeKey = (e: KeyboardEvent) => {
    if (closeOnEscape && actualOpen && e.key === "Escape") {
      handleOpenChange(false);
    }
  };

  // Update position when open state changes or on resize/scroll
  useEffect(() => {
    if (actualOpen) {
      // Small delay to ensure DOM is updated
      const timeoutId = setTimeout(updatePosition, 0);

      const handleScroll = () => updatePosition();
      const handleResize = () => updatePosition();

      window.addEventListener("scroll", handleScroll, true);
      window.addEventListener("resize", handleResize);
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscapeKey);

      return () => {
        clearTimeout(timeoutId);
        window.removeEventListener("scroll", handleScroll, true);
        window.removeEventListener("resize", handleResize);
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", handleEscapeKey);
      };
    }
  }, [actualOpen, placement, offset, closeOnClickOutside, closeOnEscape]);

  // Update position when content changes
  useEffect(() => {
    if (actualOpen) {
      updatePosition();
    }
  }, [content]);

  const getArrowPosition = () => {
    const arrowSize = 6;
    const darkBorderColor = "rgb(55 65 81)"; // gray-700
    const lightBorderColor = "rgb(255 255 255)";

    switch (placement) {
      case "top":
      case "top-start":
      case "top-end":
        return {
          bottom: -arrowSize,
          borderLeft: `${arrowSize}px solid transparent`,
          borderRight: `${arrowSize}px solid transparent`,
          borderTop: `${arrowSize}px solid ${lightBorderColor}`,
          left:
            placement === "top"
              ? "50%"
              : placement === "top-start"
              ? "12px"
              : "auto",
          right: placement === "top-end" ? "12px" : "auto",
          transform: placement === "top" ? "translateX(-50%)" : "none",
        };
      case "bottom":
      case "bottom-start":
      case "bottom-end":
        return {
          top: -arrowSize,
          borderLeft: `${arrowSize}px solid transparent`,
          borderRight: `${arrowSize}px solid transparent`,
          borderBottom: `${arrowSize}px solid ${lightBorderColor}`,
          left:
            placement === "bottom"
              ? "50%"
              : placement === "bottom-start"
              ? "12px"
              : "auto",
          right: placement === "bottom-end" ? "12px" : "auto",
          transform: placement === "bottom" ? "translateX(-50%)" : "none",
        };
      case "left":
        return {
          right: -arrowSize,
          top: "50%",
          transform: "translateY(-50%)",
          borderTop: `${arrowSize}px solid transparent`,
          borderBottom: `${arrowSize}px solid transparent`,
          borderLeft: `${arrowSize}px solid ${lightBorderColor}`,
        };
      case "right":
        return {
          left: -arrowSize,
          top: "50%",
          transform: "translateY(-50%)",
          borderTop: `${arrowSize}px solid transparent`,
          borderBottom: `${arrowSize}px solid transparent`,
          borderRight: `${arrowSize}px solid ${lightBorderColor}`,
        };
      default:
        return {};
    }
  };

  const getContentTransform = () => {
    // Remove transforms as we're handling positioning with absolute coordinates
    return "none";
  };

  return (
    <>
      <div
        ref={triggerRef}
        className={cn("inline-block w-full", className)}
        onClick={handleTriggerClick}
        onMouseEnter={handleTriggerMouseEnter}
        onMouseLeave={handleTriggerMouseLeave}
        style={{ cursor: disabled ? "not-allowed" : "pointer" }}
      >
        {children}
      </div>

      {actualOpen &&
        createPortal(
          <div
            ref={contentRef}
            className={cn(
              "fixed z-[9999] rounded-lg border border-gray-200 bg-white shadow-xl",
              "dark:border-gray-700 dark:bg-gray-800 dark:text-gray-50",
              "animate-in fade-in-0 zoom-in-95 duration-200",
              contentClassName
            )}
            style={{
              top: position.top,
              left: position.left,
              transform: getContentTransform(),
              minWidth: "max-content",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {content}
            {arrow && (
              <div
                className="absolute w-0 h-0"
                style={{
                  ...getArrowPosition(),
                  filter: "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))",
                }}
              />
            )}
          </div>,
          document.body
        )}
    </>
  );
};

export default CustomPopover;
