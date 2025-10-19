import React, { useState, useEffect } from "react";
import { Clock, Database } from "lucide-react";
import CustomButton from "../common/CustomButton";

const SessionInfoBanner: React.FC = () => {
  const [sessionInfo, setSessionInfo] = useState<{
    exists: boolean;
    timestamp: number | null;
    groupCount: number;
    tabCount: number;
  } | null>(null);

  useEffect(() => {
    loadSessionInfo();
  }, []);

  const loadSessionInfo = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        action: "getSessionInfo",
      });
      setSessionInfo(response);
    } catch (error) {
      console.error("Failed to load session info:", error);
    }
  };

  if (!sessionInfo || !sessionInfo.exists) {
    return null;
  }

  const ageInHours = sessionInfo.timestamp
    ? (Date.now() - sessionInfo.timestamp) / (1000 * 60 * 60)
    : 0;

  return (
    <div className="mx-4 mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
      <div className="flex items-start gap-2">
        <Database className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">
            Session Backup Available
          </p>
          <p className="text-[10px] text-blue-600 dark:text-blue-400">
            {sessionInfo.groupCount} groups, {sessionInfo.tabCount} tabs
          </p>
          <div className="flex items-center gap-1 mt-1">
            <Clock className="w-3 h-3 text-blue-500" />
            <p className="text-[10px] text-blue-500">
              {ageInHours < 1
                ? "< 1 hour ago"
                : ageInHours < 24
                ? `${Math.floor(ageInHours)} hours ago`
                : `${Math.floor(ageInHours / 24)} days ago`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionInfoBanner;
