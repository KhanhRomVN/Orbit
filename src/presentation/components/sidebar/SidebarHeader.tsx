import React from "react";
import { X } from "lucide-react";
import CustomInput from "../common/CustomInput";
import CustomButton from "../common/CustomButton";

interface SidebarHeaderProps {
  isSearching: boolean;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onCloseSearch: () => void;
}

const SidebarHeader: React.FC<SidebarHeaderProps> = ({
  isSearching,
  searchValue,
  onSearchChange,
  onCloseSearch,
}) => {
  if (!isSearching) {
    return null;
  }

  return (
    <div className="flex-shrink-0 p-2 bg-background">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <CustomInput
            value={searchValue}
            onChange={onSearchChange}
            placeholder="Search groups..."
            variant="primary"
            size="sm"
            autoFocus
          />
        </div>
        <CustomButton
          variant="secondary"
          size="sm"
          icon={X}
          onClick={onCloseSearch}
          title="Close search"
          className="flex-shrink-0 mt-0 !p-3"
          aria-label="Close search"
          children={undefined}
        />
      </div>
    </div>
  );
};

export default SidebarHeader;
