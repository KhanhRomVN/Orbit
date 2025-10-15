import React, { useState } from "react";
import { Download, Upload, AlertCircle, CheckCircle } from "lucide-react";
import MotionCustomDrawer from "../common/CustomDrawer";
import CustomButton from "../common/CustomButton";
import { getBrowserAPI } from "../../../shared/lib/browser-api";

interface BackupDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface BackupData {
  version: string;
  timestamp: string;
  tabGroups: any[];
  activeGroupId: string | null;
  containers?: any[];
  proxies?: any[];
}

const BackupDrawer: React.FC<BackupDrawerProps> = ({ isOpen, onClose }) => {
  const [status, setStatus] = useState<{
    type: "idle" | "success" | "error";
    message: string;
  }>({ type: "idle", message: "" });
  const [isProcessing, setIsProcessing] = useState(false);

  const handleExport = async () => {
    setIsProcessing(true);
    setStatus({ type: "idle", message: "" });

    try {
      const browserAPI = getBrowserAPI();

      // Lấy tất cả dữ liệu từ storage
      const data = await browserAPI.storage.local.get([
        "tabGroups",
        "activeGroupId",
        "proxySettings",
        "containerProxies",
        "tabProxies",
      ]);

      // ✅ Sanitize tab data - chỉ giữ metadata cần thiết
      const sanitizedGroups = (data.tabGroups || []).map((group: any) => ({
        ...group,
        tabs: (group.tabs || []).map((tab: any) => ({
          // Chỉ giữ metadata, loại bỏ runtime properties
          title: tab.title || "New Tab",
          url: tab.url || "about:blank",
          favIconUrl: tab.favIconUrl || null,
          cookieStoreId: tab.cookieStoreId || "firefox-default",
          groupId: tab.groupId || group.id,
          // ❌ KHÔNG lưu: id, windowId, active, index, pinned, ...
        })),
      }));

      const backupData: BackupData = {
        version: "1.0.1",
        timestamp: new Date().toISOString(),
        tabGroups: sanitizedGroups,
        activeGroupId: data.activeGroupId || null,
        proxies: data.proxySettings || [],
        containers: data.containerProxies || {},
      };

      // Tạo file JSON để download
      const blob = new Blob([JSON.stringify(backupData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const filename = `orbit-backup-${
        new Date().toISOString().split("T")[0]
      }.json`;

      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setStatus({
        type: "success",
        message: "Backup exported successfully!",
      });
    } catch (error) {
      console.error("Export failed:", error);
      setStatus({
        type: "error",
        message: "Failed to export backup. Please try again.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";

    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];

      if (!file) return;

      setIsProcessing(true);
      setStatus({ type: "idle", message: "" });

      try {
        const text = await file.text();
        const backupData: BackupData = JSON.parse(text);

        // Validate backup data
        if (!backupData.version || !backupData.tabGroups) {
          throw new Error("Invalid backup file format");
        }

        const browserAPI = getBrowserAPI();

        // ✅ Keep tabs metadata, just remove runtime properties
        const cleanedGroups = backupData.tabGroups.map((group: any) => {
          const cleanedTabs = (group.tabs || []).map((tab: any) => ({
            title: tab.title || "New Tab",
            url: tab.url || "about:blank",
            favIconUrl: tab.favIconUrl || null,
            cookieStoreId: tab.cookieStoreId || "firefox-default",
            groupId: group.id,
            // ❌ Không giữ: id, windowId, active, index
          }));

          return {
            ...group,
            tabs: cleanedTabs,
          };
        });

        // Restore data to storage
        await browserAPI.storage.local.set({
          tabGroups: cleanedGroups,
          activeGroupId: backupData.activeGroupId,
          proxySettings: backupData.proxies || [],
          containerProxies: backupData.containers || {},
        });

        // Verify saved data
        await browserAPI.storage.local.get(["tabGroups"]);

        // Notify background script to reload
        await browserAPI.runtime.sendMessage({
          action: "reloadAfterImport",
        });

        setStatus({
          type: "success",
          message: "Groups imported successfully! Tabs metadata preserved.",
        });

        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } catch (error) {
        console.error("[BackupDrawer] ❌ Import failed:", error);
        setStatus({
          type: "error",
          message: "Failed to import backup. Please check the file format.",
        });
      } finally {
        setIsProcessing(false);
      }
    };

    input.click();
  };

  return (
    <MotionCustomDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Backup & Restore"
      subtitle="Export or import your groups, tabs, and settings"
      direction="right"
      size="full"
      animationType="slide"
      enableBlur={false}
      closeOnOverlayClick={true}
      showCloseButton={true}
    >
      <div className="h-full overflow-y-auto bg-drawer-background p-6">
        <div className="space-y-6">
          {/* Status Message */}
          {status.message && (
            <div
              className={`flex items-center gap-3 p-4 rounded-lg ${
                status.type === "success"
                  ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                  : status.type === "error"
                  ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                  : ""
              }`}
            >
              {status.type === "success" && (
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
              )}
              {status.type === "error" && (
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
              )}
              <p
                className={`text-sm ${
                  status.type === "success"
                    ? "text-green-700 dark:text-green-300"
                    : "text-red-700 dark:text-red-300"
                }`}
              >
                {status.message}
              </p>
            </div>
          )}

          {/* Export Section */}
          <div className="bg-card-background rounded-lg border border-border-default p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <Download className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-text-primary mb-2">
                  Export Backup
                </h3>
                <p className="text-sm text-text-secondary mb-4">
                  Download a JSON file containing all your groups, tabs,
                  containers, and proxy settings. You can use this file to
                  restore your data on another device or browser.
                </p>
                <CustomButton
                  variant="primary"
                  size="sm"
                  icon={Download}
                  onClick={handleExport}
                  disabled={isProcessing}
                  loading={isProcessing && status.type === "idle"}
                >
                  Export Backup
                </CustomButton>
              </div>
            </div>
          </div>

          {/* Import Section */}
          <div className="bg-card-background rounded-lg border border-border-default p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <Upload className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-text-primary mb-2">
                  Import Backup
                </h3>
                <p className="text-sm text-text-secondary mb-4">
                  Restore your data from a previously exported backup file. This
                  will replace all current data with the imported data.
                </p>
                <div className="flex items-center gap-3">
                  <CustomButton
                    variant="primary"
                    size="sm"
                    icon={Upload}
                    onClick={handleImport}
                    disabled={isProcessing}
                    loading={isProcessing && status.type === "idle"}
                  >
                    Import Backup
                  </CustomButton>
                </div>
              </div>
            </div>
          </div>

          {/* Warning Section */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-yellow-800 dark:text-yellow-300 mb-1">
                  Important Notes
                </h4>
                <ul className="text-sm text-yellow-700 dark:text-yellow-400 space-y-1 list-disc list-inside">
                  <li>Importing will replace all current data</li>
                  <li>
                    Make sure to export your current data before importing
                  </li>
                  <li>The page will reload after successful import</li>
                  <li>
                    <strong>Active tabs will not be restored</strong> - Only
                    group structure and metadata are imported. You'll need to
                    manually open tabs again.
                  </li>
                  <li>
                    Imported tabs are <strong>ghost data</strong> - clicking
                    them won't work until you create real tabs
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MotionCustomDrawer>
  );
};

export default BackupDrawer;
