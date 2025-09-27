import React, { useState } from "react";
import { Eye, X, ExternalLink, Focus, Minus } from "lucide-react";

interface ClaudeTab {
  id: number;
  title: string;
  url: string;
  active: boolean;
  container: string;
  containerName: string;
  containerColor: string;
  containerIcon: string;
}

interface TabGroup {
  id: string;
  name: string;
  type: "container" | "custom";
  containerCookieStoreId?: string;
  tabs: ClaudeTab[];
  expanded: boolean;
  color?: string;
  icon?: string;
  created: number;
  lastModified: number;
}

interface TabItemProps {
  tab: ClaudeTab;
  group: TabGroup;
  containerColor: string;
  onFocus: () => void;
  onClose: () => void;
  onRequestConfirmClose?: (tabId: number, tabTitle: string) => void;
  onRemoveFromGroup?: () => void;
}

const TabItem: React.FC<TabItemProps> = ({
  tab,
  group,
  containerColor,
  onFocus,
  onClose,
  onRequestConfirmClose,
  onRemoveFromGroup,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const getActiveStyles = () => {
    if (tab.active) {
      const colorMap: Record<string, string> = {
        blue: "bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-700 ring-1 ring-blue-200 dark:ring-blue-800",
        red: "bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-700 ring-1 ring-red-200 dark:ring-red-800",
        green:
          "bg-green-50 dark:bg-green-950/30 border-green-300 dark:border-green-700 ring-1 ring-green-200 dark:ring-green-800",
        yellow:
          "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-300 dark:border-yellow-700 ring-1 ring-yellow-200 dark:ring-yellow-800",
        orange:
          "bg-orange-50 dark:bg-orange-950/30 border-orange-300 dark:border-orange-700 ring-1 ring-orange-200 dark:ring-orange-800",
        purple:
          "bg-purple-50 dark:bg-purple-950/30 border-purple-300 dark:border-purple-700 ring-1 ring-purple-200 dark:ring-purple-800",
        pink: "bg-pink-50 dark:bg-pink-950/30 border-pink-300 dark:border-pink-700 ring-1 ring-pink-200 dark:ring-pink-800",
        gray: "bg-gray-50 dark:bg-gray-950/30 border-gray-300 dark:border-gray-700 ring-1 ring-gray-200 dark:ring-gray-800",
      };
      return colorMap[containerColor] || colorMap.blue;
    }
    return "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-750";
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
        className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${
          colorMap[containerColor] || colorMap.blue
        }`}
      >
        <Focus size={10} />
        Active
      </div>
    );
  };

  const getContainerBadge = () => {
    if (group.type === "container") return null; // Container info is redundant in container groups

    const colorMap: Record<string, string> = {
      blue: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700",
      red: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700",
      green:
        "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700",
      yellow:
        "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700",
      orange:
        "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700",
      purple:
        "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700",
      pink: "bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-900/30 dark:text-pink-300 dark:border-pink-700",
      gray: "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600",
    };

    return (
      <div
        className={`px-2 py-1 rounded-full text-xs font-medium border ${
          colorMap[tab.containerColor] || colorMap.blue
        }`}
      >
        {tab.containerName}
      </div>
    );
  };

  const truncateTitle = (title: string, maxLength: number = 35) => {
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

  const handleCloseClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Sử dụng custom confirm dialog thay vì window.confirm
    if (onRequestConfirmClose) {
      onRequestConfirmClose(tab.id, tab.title);
    } else {
      // Fallback - gọi onClose trực tiếp nếu không có custom confirm
      onClose();
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
          <div className="w-5 h-5 bg-gradient-to-br from-blue-600 to-purple-600 rounded-sm flex items-center justify-center text-white text-xs font-bold shadow-sm">
            C
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h4
              className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate pr-2 flex-1"
              title={tab.title}
            >
              {truncateTitle(tab.title || "Claude.ai")}
            </h4>
            <div className="flex items-center gap-2 flex-shrink-0">
              {getContainerBadge()}
              {getActiveBadge()}
            </div>
          </div>

          <p
            className="text-xs text-gray-500 dark:text-gray-400 truncate mb-2"
            title={tab.url}
          >
            {formatUrl(tab.url)}
          </p>

          {/* Container Information for Custom Groups */}
          {group.type === "custom" && (
            <div className="flex items-center gap-1 mb-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  tab.containerColor === "gray"
                    ? "bg-gray-400"
                    : `bg-${tab.containerColor}-500`
                }`}
              ></div>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {tab.containerName}
              </span>
            </div>
          )}

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
              className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded transition-colors"
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

            {/* Remove from Custom Group */}
            {onRemoveFromGroup && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveFromGroup();
                }}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-orange-100 dark:bg-orange-900/30 hover:bg-orange-200 dark:hover:bg-orange-900/50 text-orange-700 dark:text-orange-400 rounded transition-colors"
                title="Remove from group"
              >
                <Minus size={12} />
                Remove
              </button>
            )}

            <button
              onClick={handleCloseClick}
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
