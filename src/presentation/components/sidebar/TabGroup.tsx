import React from "react";
import TabItem from "./TabItem";

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

interface TabGroupProps {
  containerName: string;
  containerColor: string;
  containerIcon: string;
  tabs: ClaudeTab[];
  showContainerHeader: boolean;
  onFocusTab: (tabId: number) => void;
  onCloseTab: (tabId: number) => void;
}

const TabGroup: React.FC<TabGroupProps> = ({
  containerName,
  containerColor,
  containerIcon,
  tabs,
  showContainerHeader,
  onFocusTab,
  onCloseTab,
}) => {
  const getContainerColorClass = (color: string) => {
    const colorMap: Record<string, string> = {
      blue: "bg-blue-100 text-blue-800 border-blue-200",
      red: "bg-red-100 text-red-800 border-red-200",
      green: "bg-green-100 text-green-800 border-green-200",
      yellow: "bg-yellow-100 text-yellow-800 border-yellow-200",
      orange: "bg-orange-100 text-orange-800 border-orange-200",
      purple: "bg-purple-100 text-purple-800 border-purple-200",
      pink: "bg-pink-100 text-pink-800 border-pink-200",
      gray: "bg-gray-100 text-gray-800 border-gray-200",
    };
    return colorMap[color] || colorMap.blue;
  };

  const getContainerIconEmoji = (icon: string) => {
    const iconMap: Record<string, string> = {
      fingerprint: "🔒",
      briefcase: "💼",
      dollar: "💰",
      cart: "🛒",
      circle: "⭕",
      gift: "🎁",
      vacation: "🏖️",
      food: "🍕",
      fruit: "🍎",
      pet: "🐾",
      tree: "🌳",
      chill: "😎",
    };
    return iconMap[icon] || "📁";
  };

  return (
    <div>
      {showContainerHeader && (
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">
              {getContainerIconEmoji(containerIcon)}
            </span>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {containerName}
            </h3>
            <div
              className={`px-2 py-1 rounded-full text-xs font-medium border ${getContainerColorClass(
                containerColor
              )}`}
            >
              {tabs.length} tab{tabs.length > 1 ? "s" : ""}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {tabs
          .sort((a, b) => {
            // Active tabs first
            if (a.active && !b.active) return -1;
            if (!a.active && b.active) return 1;
            // Then by title
            return a.title.localeCompare(b.title);
          })
          .map((tab) => (
            <TabItem
              key={tab.id}
              tab={tab}
              containerColor={containerColor}
              onFocus={() => onFocusTab(tab.id)}
              onClose={() => onCloseTab(tab.id)}
            />
          ))}
      </div>
    </div>
  );
};

export default TabGroup;
