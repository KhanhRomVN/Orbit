import React, { useState } from "react";
import { Eye, X, ExternalLink } from "lucide-react";

interface ClaudeTab {
  id: number;
  title: string;
  url: string;
  active: boolean;
  cookieStoreId?: string;
  containerName?: string;
  containerColor?: string;
  containerIcon?: string;
}

interface TabItemProps {
  tab: ClaudeTab;
  containerColor: string;
  onFocus: () => void;
  onClose: () => void;
}

const TabItem: React.FC<TabItemProps> = ({
  tab,
  containerColor,
  onFocus,
  onClose,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const getActiveStyles = () => {
    if (tab.active) {
      const colorMap: Record<string, string> = {
        blue: "bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-700",
        red: "bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-700",
        green:
          "bg-green-50 dark:bg-green-950/30 border-green-300 dark:border-green-700",
        yellow:
          "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-300 dark:border-yellow-700",
        orange:
          "bg-orange-50 dark:bg-orange-950/30 border-orange-300 dark:border-orange-700",
        purple:
          "bg-purple-50 dark:bg-purple-950/30 border-purple-300 dark:border-purple-700",
        pink: "bg-pink-50 dark:bg-pink-950/30 border-pink-300 dark:border-pink-700",
        gray: "bg-gray-50 dark:bg-gray-950/30 border-gray-300 dark:border-gray-700",
      };
      return colorMap[containerColor] || colorMap.blue;
    }
    return "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600";
  };

  const getActiveBadge = () => {
    if (!tab.active) return null;

    const colorMap: Record<string, string> = {
      blue: "bg-blue-600 text-white",
      red: "bg-red-600 text-white",
      green: "bg-green-600 text-white",
      yellow: "bg-yellow-600 text-white",
      orange: "bg-orange-600 text-white",
      purple: "bg-purple-600 text-white",
      pink: "bg-pink-600 text-white",
      gray: "bg-gray-600 text-white",
    };

    return (
      <div
        className={`px-2 py-1 rounded-full text-xs font-medium ${
          colorMap[containerColor] || colorMap.blue
        }`}
      >
        Active
      </div>
    );
  };

  const truncateTitle = (title: string, maxLength: number = 40) => {
    return title.length > maxLength
      ? title.substring(0, maxLength) + "..."
      : title;
  };

  const formatUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname + (urlObj.pathname !== "/" ? urlObj.pathname : "");
    } catch {
      return url;
    }
  };

  return (
    <div
      className={`border rounded-lg p-3 transition-all duration-200 cursor-pointer group ${getActiveStyles()}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => {
        // Don't trigger focus if clicking on action buttons
        if (!(e.target as HTMLElement).closest(".tab-actions")) {
          onFocus();
        }
      }}
    >
      <div className="flex items-start gap-3">
        {/* Favicon/Icon */}
        <div className="flex-shrink-0 mt-0.5">
          <div className="w-5 h-5 bg-blue-600 rounded-sm flex items-center justify-center text-white text-xs font-bold">
            C
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h4
              className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate pr-2"
              title={tab.title}
            >
              {truncateTitle(tab.title || "Claude.ai")}
            </h4>
            {getActiveBadge()}
          </div>

          <p
            className="text-xs text-gray-500 dark:text-gray-400 truncate mb-2"
            title={tab.url}
          >
            {formatUrl(tab.url)}
          </p>

          {/* Action buttons */}
          <div
            className={`tab-actions flex items-center gap-1 transition-opacity duration-200 ${
              isHovered || tab.active ? "opacity-100" : "opacity-0"
            }`}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFocus();
              }}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded transition-colors"
              title="Focus tab"
            >
              <Eye size={12} />
              Focus
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                window.open(tab.url, "_blank");
              }}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded transition-colors"
              title="Open in new tab"
            >
              <ExternalLink size={12} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 rounded transition-colors"
              title="Close tab"
            >
              <X size={12} />
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TabItem;
