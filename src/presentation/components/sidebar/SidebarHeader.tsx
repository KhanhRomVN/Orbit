// File: src/presentation/components/sidebar/SidebarHeader.tsx
import React from "react";
import { Plus, Settings } from "lucide-react";

interface SidebarHeaderProps {
  onCreateGroup: () => void;
}

const SidebarHeader: React.FC<SidebarHeaderProps> = ({ onCreateGroup }) => {
  return (
    <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center space-x-2">
        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-sm">S</span>
        </div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
          Sigil
        </h1>
      </div>

      <div className="flex items-center space-x-2">
        <button
          onClick={onCreateGroup}
          className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          title="Create New Group"
        >
          <Plus className="w-5 h-5" />
        </button>

        <button
          className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          title="Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default SidebarHeader;
