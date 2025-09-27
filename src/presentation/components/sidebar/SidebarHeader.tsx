import React, { useState, useRef, useEffect } from "react";
import { Plus, RefreshCw, MessageSquare, ChevronDown } from "lucide-react";

interface Container {
  cookieStoreId: string;
  name: string;
  color: string;
  icon: string;
}

interface SidebarHeaderProps {
  onNewTab: () => void;
  onRefresh: () => void;
  isCreatingTab?: boolean;
  containers: Container[];
  onCreateTabInContainer: (containerCookieStoreId: string) => void;
}

const SidebarHeader: React.FC<SidebarHeaderProps> = ({
  onNewTab,
  onRefresh,
  isCreatingTab = false,
  containers,
  onCreateTabInContainer,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showDropdown]);

  const getContainerColorClass = (color: string) => {
    const colorMap: Record<string, string> = {
      blue: "bg-blue-500",
      red: "bg-red-500",
      green: "bg-green-500",
      yellow: "bg-yellow-500",
      orange: "bg-orange-500",
      purple: "bg-purple-500",
      pink: "bg-pink-500",
      gray: "bg-gray-500",
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

  const handleCreateInDefault = () => {
    setShowDropdown(false);
    onNewTab();
  };

  const handleCreateInContainer = (containerCookieStoreId: string) => {
    setShowDropdown(false);
    onCreateTabInContainer(containerCookieStoreId);
  };

  return (
    <div className="bg-slate-800 text-white p-4 border-b border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-lg">
            <MessageSquare size={20} />
          </div>
          <div>
            <h1 className="font-semibold text-lg">Claude Assistant</h1>
            <p className="text-sm text-slate-300">Tab Manager</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        {/* New Tab Button with Dropdown */}
        <div className="flex-1 relative" ref={dropdownRef}>
          <div className="flex">
            <button
              onClick={handleCreateInDefault}
              disabled={isCreatingTab}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-l-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreatingTab ? (
                <RefreshCw size={18} className="animate-spin" />
              ) : (
                <Plus size={18} />
              )}
              {isCreatingTab ? "Creating..." : "New Claude Tab"}
            </button>

            <button
              onClick={() => setShowDropdown(!showDropdown)}
              disabled={isCreatingTab}
              className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-2.5 rounded-r-lg border-l border-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronDown
                size={16}
                className={`transition-transform ${
                  showDropdown ? "rotate-180" : ""
                }`}
              />
            </button>
          </div>

          {/* Dropdown Menu */}
          {showDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
              <div className="py-1">
                {/* Default Container Option */}
                <button
                  onClick={handleCreateInDefault}
                  className="w-full text-left px-4 py-2 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-600 flex items-center gap-3"
                >
                  <div className="w-3 h-3 bg-gray-400 rounded-full flex-shrink-0"></div>
                  <span>Default Container</span>
                </button>

                {/* Container Options */}
                {containers.map((container) => (
                  <button
                    key={container.cookieStoreId}
                    onClick={() =>
                      handleCreateInContainer(container.cookieStoreId)
                    }
                    className="w-full text-left px-4 py-2 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-600 flex items-center gap-3"
                  >
                    <div
                      className={`w-3 h-3 rounded-full flex-shrink-0 ${getContainerColorClass(
                        container.color
                      )}`}
                    ></div>
                    <span className="text-base mr-2">
                      {getContainerIconEmoji(container.icon)}
                    </span>
                    <span>{container.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Refresh Button */}
        <button
          onClick={onRefresh}
          className="flex items-center justify-center bg-slate-700 hover:bg-slate-600 text-white px-3 py-2.5 rounded-lg transition-colors"
          title="Refresh tabs"
        >
          <RefreshCw size={18} />
        </button>
      </div>
    </div>
  );
};

export default SidebarHeader;
