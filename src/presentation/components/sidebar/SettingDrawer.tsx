// File: /home/khanhromvn/Documents/Coding/Orbit/src/presentation/components/sidebar/SettingDrawer.tsx

import React from "react";
import { Plus, Palette, X, Search, Database, ArrowUpDown } from "lucide-react";
import MotionCustomDrawer from "../common/CustomDrawer";
import CustomButton from "../common/CustomButton";

interface SettingDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onAddGroup: () => void;
  onTheme: () => void;
  onSearch: () => void;
  onBackup: () => void;
  onSortGroups: () => void; // Add this new prop
}

const SettingDrawer: React.FC<SettingDrawerProps> = ({
  isOpen,
  onClose,
  onAddGroup,
  onTheme,
  onSearch,
  onBackup,
  onSortGroups, // Add this
}) => {
  const handleAddGroup = () => {
    onAddGroup();
    onClose();
  };

  const handleTheme = () => {
    onTheme();
    onClose();
  };

  const handleSearch = () => {
    onSearch();
    onClose();
  };

  const handleBackup = () => {
    onBackup();
    onClose();
  };

  const handleSortGroups = () => {
    onSortGroups();
    onClose();
  };

  return (
    <MotionCustomDrawer
      isOpen={isOpen}
      onClose={onClose}
      direction="bottom"
      size="md"
      animationType="slide"
      enableBlur={true}
      closeOnOverlayClick={true}
      showCloseButton={false}
      hideHeader={true}
    >
      <div className="h-full flex flex-col bg-drawer-background">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-4 pb-3 border-b border-border-default">
          <h3 className="text-base font-semibold text-text-primary">
            Settings
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-sidebar-itemHover rounded-lg transition-colors"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-2">
            {/* Add Group Button */}
            <CustomButton
              variant="ghost"
              size="md"
              align="left"
              icon={Plus}
              onClick={handleAddGroup}
            >
              Add Group
            </CustomButton>

            {/* Sort Groups Button */}
            <CustomButton
              variant="ghost"
              size="md"
              align="left"
              icon={ArrowUpDown}
              onClick={handleSortGroups}
            >
              Sort Groups
            </CustomButton>

            {/* Theme Button */}
            <CustomButton
              variant="ghost"
              size="md"
              align="left"
              icon={Palette}
              onClick={handleTheme}
            >
              Theme
            </CustomButton>

            {/* Search Button */}
            <CustomButton
              variant="ghost"
              size="md"
              align="left"
              icon={Search}
              onClick={handleSearch}
            >
              Search
            </CustomButton>

            {/* Backup Button */}
            <CustomButton
              variant="ghost"
              size="md"
              align="left"
              icon={Database}
              onClick={handleBackup}
            >
              Backup
            </CustomButton>
          </div>
        </div>
      </div>
    </MotionCustomDrawer>
  );
};

export default SettingDrawer;
