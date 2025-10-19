import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { RotateCcw, Clock, Database, AlertCircle } from "lucide-react";
import MotionCustomDrawer from "../common/CustomDrawer";
import CustomButton from "../common/CustomButton";

interface RestoreDrawerProps {
  isOpen: boolean;
  onRestore: () => void;
  onCancel: () => void;
}

const RestoreDrawer: React.FC<RestoreDrawerProps> = ({
  isOpen,
  onRestore,
  onCancel,
}) => {
  const [sessionInfo, setSessionInfo] = useState<{
    timestamp: number | null;
    groupCount: number;
    tabCount: number;
    source: string | null;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSessionInfo();
    }
  }, [isOpen]);

  const loadSessionInfo = async () => {
    console.debug("[RestoreDrawer] 🔄 Loading session info...");
    try {
      const response = await new Promise<{
        exists: boolean;
        timestamp: number | null;
        groupCount: number;
        tabCount: number;
        source: string | null;
      }>((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            action: "getSessionInfo",
          },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error(
                "[RestoreDrawer] ❌ Runtime error:",
                chrome.runtime.lastError
              );
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }

            if (!response) {
              console.error("[RestoreDrawer] ❌ No response from background");
              reject(new Error("No response from background script"));
              return;
            }

            console.debug(
              "[RestoreDrawer] ✅ Session info received:",
              response
            );
            resolve(response);
          }
        );
      });

      setSessionInfo(response);
    } catch (error) {
      console.error("[RestoreDrawer] ❌ Failed to load session info:", error);
      setSessionInfo({
        timestamp: null,
        groupCount: 0,
        tabCount: 0,
        source: null,
      });
    }
  };

  const handleRestore = async () => {
    setIsLoading(true);
    try {
      await onRestore();
    } finally {
      setIsLoading(false);
    }
  };

  const getSessionAge = () => {
    if (!sessionInfo?.timestamp) return "";

    const ageInHours = (Date.now() - sessionInfo.timestamp) / (1000 * 60 * 60);

    if (ageInHours < 1) return "< 1 hour ago";
    if (ageInHours < 24)
      return `${Math.floor(ageInHours)} hour${
        Math.floor(ageInHours) > 1 ? "s" : ""
      } ago`;
    return `${Math.floor(ageInHours / 24)} day${
      Math.floor(ageInHours / 24) > 1 ? "s" : ""
    } ago`;
  };

  const drawerContent = (
    <MotionCustomDrawer
      isOpen={isOpen}
      onClose={onCancel}
      title="Restore Previous Session"
      subtitle="Your tabs and groups from the last session are available"
      direction="right"
      size="full"
      animationType="slide"
      enableBlur={true}
      closeOnOverlayClick={false}
      showCloseButton={true}
      footerActions={
        <>
          <CustomButton
            variant="secondary"
            size="sm"
            onClick={async () => {
              console.debug(
                "[RestoreDrawer] ❌ User declined restore, clearing session..."
              );
              try {
                // ✅ XÓA SESSION KHI USER CHỌN "Start Fresh"
                await chrome.runtime.sendMessage({
                  action: "clearSession",
                });
                console.debug("[RestoreDrawer] ✅ Session cleared");
              } catch (error) {
                console.error(
                  "[RestoreDrawer] ❌ Failed to clear session:",
                  error
                );
              }
              onCancel();
            }}
            disabled={isLoading}
          >
            Start Fresh
          </CustomButton>
          <CustomButton
            variant="primary"
            size="sm"
            icon={RotateCcw}
            onClick={handleRestore}
            loading={isLoading}
          >
            Restore Session
          </CustomButton>
        </>
      }
    >
      <div className="h-full flex flex-col items-center justify-center bg-drawer-background px-6">
        <div className="w-full max-w-md space-y-6">
          {/* Icon */}
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <RotateCcw className="w-10 h-10 text-primary" />
            </div>
          </div>

          {/* Title */}
          <div className="text-center space-y-2">
            <h2 className="text-xl font-bold text-text-primary">
              Welcome Back!
            </h2>
            <p className="text-sm text-text-secondary">
              We found your previous session. Would you like to restore it?
            </p>
          </div>

          {/* Session Info */}
          {sessionInfo && (
            <div className="space-y-3">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg space-y-3">
                <div className="flex items-center gap-3">
                  <Database className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                      Session Details
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      {sessionInfo.groupCount} groups • {sessionInfo.tabCount}{" "}
                      tabs
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                      Last Saved
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      {getSessionAge()}
                    </p>
                  </div>
                </div>

                {sessionInfo.source && (
                  <div className="pt-2 border-t border-blue-200 dark:border-blue-700">
                    <p className="text-[10px] text-blue-500 dark:text-blue-400">
                      Source: {sessionInfo.source}
                    </p>
                  </div>
                )}
              </div>

              {/* Warning */}
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-700 dark:text-yellow-300 leading-relaxed">
                  Restoring will merge your saved session with any existing
                  groups. Tabs will be created when you click on them.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </MotionCustomDrawer>
  );

  return isOpen ? createPortal(drawerContent, document.body) : null;
};

export default RestoreDrawer;
