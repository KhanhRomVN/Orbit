import React from "react";
import { MessageSquare } from "lucide-react";
import TabGroup from "./TabGroup";
import EmptyState from "./EmptyState";

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

interface Container {
  cookieStoreId: string;
  name: string;
  color: string;
  icon: string;
}

interface SidebarContentProps {
  tabs: ClaudeTab[];
  containers: Container[];
  isLoading: boolean;
  onFocusTab: (tabId: number) => void;
  onCloseTab: (tabId: number) => void;
}

const SidebarContent: React.FC<SidebarContentProps> = ({
  tabs,
  containers,
  isLoading,
  onFocusTab,
  onCloseTab,
}) => {
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <MessageSquare size={48} className="mx-auto mb-4 opacity-30" />
          <p>Loading managed tabs...</p>
        </div>
      </div>
    );
  }

  if (tabs.length === 0) {
    return <EmptyState />;
  }

  // Group tabs by container
  const groupedTabs = tabs.reduce((groups, tab) => {
    const key = tab.containerName || "Default";
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(tab);
    return groups;
  }, {} as Record<string, ClaudeTab[]>);

  const sortedGroups = Object.entries(groupedTabs).sort(([a], [b]) => {
    if (a === "Default") return -1;
    if (b === "Default") return 1;
    return a.localeCompare(b);
  });

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {sortedGroups.map(([containerName, containerTabs]) => {
        const container = containers.find((c) => c.name === containerName);
        return (
          <TabGroup
            key={containerName}
            containerName={containerName}
            containerColor={container?.color || "blue"}
            containerIcon={container?.icon || "default"}
            tabs={containerTabs}
            onFocusTab={onFocusTab}
            onCloseTab={onCloseTab}
            showContainerHeader={sortedGroups.length > 1}
          />
        );
      })}
    </div>
  );
};

export default SidebarContent;
