import React, { useState } from "react";
import { Download, Upload, AlertCircle, CheckCircle } from "lucide-react";
import MotionCustomDrawer from "../common/CustomDrawer";
import CustomButton from "../common/CustomButton";
import ExportDrawer from "./ExportDrawer";
import ImportDrawer from "./ImportDrawer";
import SessionInfoBanner from "./SessionInfoBanner";

interface BackupDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const BackupDrawer: React.FC<BackupDrawerProps> = ({ isOpen, onClose }) => {
  const [showExportDrawer, setShowExportDrawer] = useState(false);
  const [showImportDrawer, setShowImportDrawer] = useState(false);
  const [status, setStatus] = useState<{
    type: "idle" | "success" | "error";
    message: string;
  }>({ type: "idle", message: "" });

  const handleExport = () => {
    setShowExportDrawer(true);
  };

  const handleImport = () => {
    setShowImportDrawer(true);
  };

  return (
    <>
      <MotionCustomDrawer
        isOpen={isOpen && !showExportDrawer && !showImportDrawer}
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
        <div className="h-full overflow-y-auto bg-drawer-background p-4">
          <div className="space-y-4">
            {/* Status Message */}
            {status.message && (
              <div
                className={`flex items-center gap-2 p-3 rounded-lg ${
                  status.type === "success"
                    ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                    : status.type === "error"
                    ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                    : ""
                }`}
              >
                {status.type === "success" && (
                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                )}
                {status.type === "error" && (
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                )}
                <p
                  className={`text-xs ${
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
            <div className="bg-card-background rounded-lg border border-border-default p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                    <Download className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-text-primary">
                    Export Backup
                  </h3>
                </div>
              </div>
              <p className="text-xs text-text-secondary mb-3 leading-relaxed">
                Select specific groups and tabs to export as JSON file.
              </p>
              <CustomButton
                variant="primary"
                size="sm"
                icon={Download}
                onClick={handleExport}
                className="w-full"
              >
                Export Backup
              </CustomButton>
            </div>

            {/* Import Section */}
            <div className="bg-card-background rounded-lg border border-border-default p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded">
                    <Upload className="w-4 h-4 text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-text-primary">
                    Import Backup
                  </h3>
                </div>
              </div>
              <p className="text-xs text-text-secondary mb-3 leading-relaxed">
                Select and import specific groups and tabs from backup file.
              </p>
              <CustomButton
                variant="primary"
                size="sm"
                icon={Upload}
                onClick={handleImport}
                className="w-full"
              >
                Import Backup
              </CustomButton>
            </div>
          </div>
        </div>
      </MotionCustomDrawer>

      {/* Export Drawer */}
      <ExportDrawer
        isOpen={showExportDrawer}
        onClose={() => {
          setShowExportDrawer(false);
          setStatus({
            type: "success",
            message: "Export completed successfully!",
          });
          setTimeout(() => setStatus({ type: "idle", message: "" }), 3000);
        }}
      />

      {/* Import Drawer */}
      <ImportDrawer
        isOpen={showImportDrawer}
        onClose={() => {
          setShowImportDrawer(false);
          setStatus({
            type: "success",
            message: "Import completed successfully!",
          });
          setTimeout(() => setStatus({ type: "idle", message: "" }), 3000);
        }}
      />
      <SessionInfoBanner />
    </>
  );
};

export default BackupDrawer;
