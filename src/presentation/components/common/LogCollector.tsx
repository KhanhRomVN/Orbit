// src/presentation/components/common/LogCollector.tsx
import React, { useState, useEffect, useRef } from "react";
import {
  Copy,
  Trash2,
  Download,
  X,
  ChevronDown,
  ChevronUp,
  Filter,
} from "lucide-react";
import { logger, LogEntry } from "@/shared/utils/logger";

interface LogCollectorProps {
  isOpen: boolean;
  onClose: () => void;
}

const LogCollector: React.FC<LogCollectorProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filterLevel, setFilterLevel] = useState<
    "all" | "info" | "warn" | "error" | "debug"
  >("all");
  const [searchTerm, setSearchTerm] = useState("");
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Load initial logs
    setLogs(logger.getLogs());

    // Subscribe to new logs
    const unsubscribe = logger.subscribe((newLog) => {
      setLogs((prev) => [newLog, ...prev]);
    });

    return unsubscribe;
  }, [isOpen]);

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = 0;
    }
  }, [logs, autoScroll]);

  const filteredLogs = logs.filter((log) => {
    const matchesLevel = filterLevel === "all" || log.level === filterLevel;
    const matchesSearch =
      searchTerm === "" ||
      log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.context &&
        JSON.stringify(log.context)
          .toLowerCase()
          .includes(searchTerm.toLowerCase()));

    return matchesLevel && matchesSearch;
  });

  const handleCopyLogs = async () => {
    try {
      await navigator.clipboard.writeText(logger.exportLogs());
      logger.info("Logs copied to clipboard");
    } catch (error) {
      logger.error("Failed to copy logs", error);
    }
  };

  const handleDownloadLogs = () => {
    const blob = new Blob([logger.exportLogs()], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shortcutpaste-logs-${
      new Date().toISOString().split("T")[0]
    }.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClearLogs = () => {
    logger.clearLogs();
    setLogs([]);
  };

  const getLevelColor = (level: LogEntry["level"]) => {
    switch (level) {
      case "error":
        return "text-red-500";
      case "warn":
        return "text-yellow-500";
      case "info":
        return "text-blue-500";
      case "debug":
        return "text-gray-500";
      default:
        return "text-gray-500";
    }
  };

  const getLevelBgColor = (level: LogEntry["level"]) => {
    switch (level) {
      case "error":
        return "bg-red-500/10";
      case "warn":
        return "bg-yellow-500/10";
      case "info":
        return "bg-blue-500/10";
      case "debug":
        return "bg-gray-500/10";
      default:
        return "bg-gray-500/10";
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-dialog-background rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-default">
          <h2 className="text-lg font-semibold text-text-primary">
            Application Logs
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLogs}
              className="p-2 hover:bg-button-second-bg-hover rounded transition-colors"
              title="Copy all logs"
            >
              <Copy size={16} />
            </button>
            <button
              onClick={handleDownloadLogs}
              className="p-2 hover:bg-button-second-bg-hover rounded transition-colors"
              title="Download logs"
            >
              <Download size={16} />
            </button>
            <button
              onClick={handleClearLogs}
              className="p-2 hover:bg-button-second-bg-hover rounded transition-colors"
              title="Clear logs"
            >
              <Trash2 size={16} />
            </button>
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className="p-2 hover:bg-button-second-bg-hover rounded transition-colors"
              title={
                autoScroll ? "Auto-scroll enabled" : "Auto-scroll disabled"
              }
            >
              {autoScroll ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-button-second-bg-hover rounded transition-colors"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-border-default space-y-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-text-secondary" />
              <select
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value as any)}
                className="bg-input-background border border-border-default rounded px-3 py-1 text-sm"
              >
                <option value="all">All Levels</option>
                <option value="error">Error</option>
                <option value="warn">Warning</option>
                <option value="info">Info</option>
                <option value="debug">Debug</option>
              </select>
            </div>

            <input
              type="text"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 bg-input-background border border-border-default rounded px-3 py-1 text-sm"
            />
          </div>

          <div className="text-xs text-text-secondary">
            Showing {filteredLogs.length} of {logs.length} logs
          </div>
        </div>

        {/* Log Content */}
        <div
          ref={logContainerRef}
          className="flex-1 overflow-auto p-4 font-mono text-sm"
        >
          {filteredLogs.length === 0 ? (
            <div className="text-center text-text-secondary py-8">
              No logs found matching your criteria
            </div>
          ) : (
            <div className="space-y-2">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className={`p-3 rounded border border-border-default ${getLevelBgColor(
                    log.level
                  )}`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`font-medium ${getLevelColor(
                        log.level
                      )} flex-shrink-0`}
                    >
                      [{new Date(log.timestamp).toLocaleTimeString()}]
                    </div>
                    <div
                      className={`font-medium ${getLevelColor(
                        log.level
                      )} flex-shrink-0`}
                    >
                      {log.level.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-text-primary break-words">
                        {log.message}
                      </div>
                      {log.context && (
                        <div className="mt-1 text-text-secondary">
                          <pre className="whitespace-pre-wrap break-all text-xs">
                            {typeof log.context === "string"
                              ? log.context
                              : JSON.stringify(log.context, null, 2)}
                          </pre>
                        </div>
                      )}
                      {log.source && (
                        <div className="text-xs text-text-secondary mt-1">
                          Source: {log.source}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LogCollector;
