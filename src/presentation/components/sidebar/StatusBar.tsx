import React from "react";
import { AlertCircle, CheckCircle, Info, Loader2 } from "lucide-react";

interface StatusBarProps {
  status: {
    message: string;
    type: "loading" | "success" | "error" | "info";
  };
}

const StatusBar: React.FC<StatusBarProps> = ({ status }) => {
  const getStatusStyles = () => {
    switch (status.type) {
      case "loading":
        return "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      case "success":
        return "bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800";
      case "error":
        return "bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800";
      case "info":
        return "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800";
      default:
        return "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700";
    }
  };

  const getStatusIcon = () => {
    switch (status.type) {
      case "loading":
        return <Loader2 size={14} className="animate-spin" />;
      case "success":
        return <CheckCircle size={14} />;
      case "error":
        return <AlertCircle size={14} />;
      case "info":
        return <Info size={14} />;
      default:
        return <Info size={14} />;
    }
  };

  return (
    <div
      className={`px-4 py-2 border-b text-sm flex items-center gap-2 ${getStatusStyles()}`}
    >
      {getStatusIcon()}
      <span className="flex-1">{status.message}</span>
    </div>
  );
};

export default StatusBar;
