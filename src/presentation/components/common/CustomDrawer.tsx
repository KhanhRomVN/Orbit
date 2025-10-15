// src/renderer/src/components/common/CustomDrawer.tsx - Fixed Scroll Version
import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "../../../shared/lib/utils";
import { createPortal } from "react-dom";

interface MotionCustomDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  direction?: "left" | "right" | "top" | "bottom";
  children: React.ReactNode;
  headerActions?: React.ReactNode;
  footerActions?: React.ReactNode;
  className?: string;
  overlayOpacity?: number;
  hideHeader?: boolean;
  animationType?: "slide" | "scale" | "fade" | "bounce" | "elastic";
  enableBlur?: boolean;
  closeOnOverlayClick?: boolean;
  showCloseButton?: boolean;
}

const sizeMap = {
  sm: "25%",
  md: "35%",
  lg: "45%",
  xl: "60%",
  full: "100%",
};

// Animation variants
const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const getDrawerVariants = (direction: string, animationType: string) => {
  const baseVariants = {
    slide: {
      hidden: {
        x: direction === "right" ? "100%" : direction === "left" ? "-100%" : 0,
        y: direction === "top" ? "-100%" : direction === "bottom" ? "100%" : 0,
      },
      visible: { x: 0, y: 0 },
    },
    scale: {
      hidden: { scale: 0.8, opacity: 0 },
      visible: { scale: 1, opacity: 1 },
    },
    fade: {
      hidden: { opacity: 0 },
      visible: { opacity: 1 },
    },
    bounce: {
      hidden: {
        x: direction === "right" ? "100%" : direction === "left" ? "-100%" : 0,
        y: direction === "top" ? "-100%" : direction === "bottom" ? "100%" : 0,
        scale: 0.8,
      },
      visible: {
        x: 0,
        y: 0,
        scale: 1,
        transition: {
          type: "spring",
          damping: 15,
          stiffness: 300,
        },
      },
    },
    elastic: {
      hidden: {
        x: direction === "right" ? "100%" : direction === "left" ? "-100%" : 0,
        y: direction === "top" ? "-100%" : direction === "bottom" ? "100%" : 0,
      },
      visible: {
        x: 0,
        y: 0,
        transition: {
          type: "spring",
          damping: 20,
          stiffness: 100,
          mass: 0.8,
        },
      },
    },
  };

  return baseVariants[animationType] || baseVariants.slide;
};

const headerVariants = {
  hidden: { opacity: 0, y: -20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      delay: 0.2,
      duration: 0.4,
      ease: "easeOut",
    },
  },
};

const MotionCustomDrawer: React.FC<MotionCustomDrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  size = "lg",
  direction = "right",
  children,
  headerActions,
  footerActions,
  className,
  overlayOpacity = 0.4,
  hideHeader = false,
  animationType = "slide",
  enableBlur = true,
  closeOnOverlayClick = true,
  showCloseButton = true,
}) => {
  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  const handleOverlayClick = () => {
    if (closeOnOverlayClick) {
      onClose();
    }
  };

  const getDrawerStyle = () => {
    const baseStyle: React.CSSProperties = {
      position: "fixed",
      zIndex: 1000,
      backgroundColor: "var(--drawer-background, #ffffff)",
      boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
      display: "flex",
      flexDirection: "column",
    };

    switch (direction) {
      case "right":
        return {
          ...baseStyle,
          top: 0,
          right: 0,
          height: "100vh",
          width: sizeMap[size],
        };
      case "left":
        return {
          ...baseStyle,
          top: 0,
          left: 0,
          height: "100vh",
          width: sizeMap[size],
        };
      case "top":
        return {
          ...baseStyle,
          top: 0,
          left: 0,
          right: 0,
          height: sizeMap[size],
        };
      case "bottom":
        return {
          ...baseStyle,
          bottom: 0,
          left: 0,
          right: 0,
          height: sizeMap[size],
        };
      default:
        return baseStyle;
    }
  };

  const drawerContent = (
    <AnimatePresence mode="wait">
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: 0.3 }}
            className={cn(
              "fixed inset-0 z-[999]",
              enableBlur && "backdrop-blur-sm"
            )}
            style={{
              backgroundColor: `rgba(0, 0, 0, ${overlayOpacity})`,
            }}
            onClick={handleOverlayClick}
          />

          {/* Drawer */}
          <motion.div
            variants={getDrawerVariants(direction, animationType)}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{
              duration:
                animationType === "bounce" || animationType === "elastic"
                  ? undefined
                  : 0.4,
              ease:
                animationType === "bounce" || animationType === "elastic"
                  ? undefined
                  : "easeInOut",
            }}
            style={getDrawerStyle()}
            className={cn("", className)}
          >
            {/* Header */}
            {!hideHeader && (
              <motion.div
                variants={headerVariants}
                initial="hidden"
                animate="visible"
                className="flex-shrink-0 px-6 py-5 bg-drawer-background"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    {title && (
                      <motion.h2
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3, duration: 0.4 }}
                        className="text-base font-bold text-text-primary truncate"
                      >
                        {title}
                      </motion.h2>
                    )}
                    {subtitle && (
                      <motion.p
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4, duration: 0.4 }}
                        className="text-sm text-text-secondary mt-1 truncate"
                      >
                        {subtitle}
                      </motion.p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {headerActions && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3, duration: 0.3 }}
                      >
                        {headerActions}
                      </motion.div>
                    )}
                    {showCloseButton && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        transition={{ delay: 0.4, duration: 0.3 }}
                        onClick={onClose}
                        className={cn(
                          "p-2 text-text-secondary hover:text-text-primary hover:bg-background rounded-lg",
                          "transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20"
                        )}
                      >
                        <X className="h-5 w-5" />
                      </motion.button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Content - FIXED SCROLL IMPLEMENTATION */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="flex-1 min-h-0"
              style={{ flex: "1 1 0%", minHeight: 0 }}
            >
              {/* Direct render children without staggered animation wrapper */}
              <div className="h-full">{children}</div>
            </motion.div>

            {/* Footer */}
            {footerActions && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.4 }}
                className="flex-shrink-0 p-2 bg-drawer-background"
              >
                <div className="flex items-center justify-end gap-3">
                  {footerActions}
                </div>
              </motion.div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  // Render in portal for proper z-index layering
  return createPortal(drawerContent, document.body);
};

export default MotionCustomDrawer;
