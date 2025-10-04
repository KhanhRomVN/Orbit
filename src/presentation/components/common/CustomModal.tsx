// src/components/common/CustomModal.tsx
import React from "react";
import { X } from "lucide-react";
import CustomButton from "./CustomButton";

interface CustomModalProps {
  // Modal state
  isOpen: boolean;
  onClose: () => void;

  // Header props
  title: string;
  headerActions?: React.ReactNode;

  // Body props
  children: React.ReactNode;

  // Footer props
  cancelText?: string;
  actionText?: string;
  onAction?: () => void;
  actionVariant?: "primary" | "secondary" | "danger" | "success";
  actionDisabled?: boolean;
  actionLoading?: boolean;
  hideFooter?: boolean;
  footerActions?: React.ReactNode;

  // Modal props
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  className?: string;
}

const sizeClasses = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  "2xl": "max-w-6xl",
};

const CustomModal: React.FC<CustomModalProps> = ({
  isOpen,
  onClose,
  title,
  headerActions,
  children,
  cancelText = "Cancel",
  actionText,
  onAction,
  actionDisabled = false,
  actionLoading = false,
  hideFooter = false,
  footerActions,
  size = "lg",
  className = "",
}) => {
  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleCancel = () => {
    onClose();
  };

  const handleAction = () => {
    if (onAction) {
      onAction();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200"
      onClick={handleBackdropClick}
    >
      <div
        className={`bg-dialog-background rounded-xl shadow-lg border border-border-default overflow-hidden w-full ${sizeClasses[size]} ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-default bg-dialog-background">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
            {headerActions && (
              <div className="flex items-center gap-2">{headerActions}</div>
            )}
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-sidebar-itemHover rounded-lg transition-all duration-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="bg-dialog-background">{children}</div>

        {/* Footer */}
        {!hideFooter && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border-default bg-dialog-background">
            <div className="flex items-center gap-3">
              {/* Left side of footer - can be used for additional info */}
            </div>

            <div className="flex items-center gap-3">
              {footerActions && (
                <div className="flex items-center gap-3 mr-3">
                  {footerActions}
                </div>
              )}

              <CustomButton
                variant="secondary"
                size="md"
                onClick={handleCancel}
                className="w-fit"
              >
                {cancelText}
              </CustomButton>

              {actionText && onAction && (
                <CustomButton
                  variant="primary"
                  size="md"
                  onClick={handleAction}
                  disabled={actionDisabled}
                  loading={actionLoading}
                  className="w-fit"
                >
                  {actionText}
                </CustomButton>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomModal;
