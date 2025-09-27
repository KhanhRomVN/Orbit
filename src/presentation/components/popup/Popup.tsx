import React, { useState, useEffect, useMemo } from "react";
import {
  Send,
  Copy,
  RefreshCw,
  MessageSquare,
  X,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Sidebar,
  Folder,
  Users,
} from "lucide-react";
import CustomCombobox from "../common/CustomCombobox";

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

interface Response {
  tabId: number;
  tabTitle: string;
  groupName: string;
  response: string;
  timestamp: Date;
}

interface GroupOption {
  value: string;
  label: string;
  type: "container" | "custom";
  tabCount: number;
}

const Popup: React.FC = () => {
  const [groups, setGroups] = useState<TabGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedTabId, setSelectedTabId] = useState<number | null>(null);
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [responses, setResponses] = useState<Response[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>("");
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);

  useEffect(() => {
    loadGroups();
  }, []);

  // Create group options from groups data
  const groupOptions = useMemo((): GroupOption[] => {
    return groups
      .filter((group) => group.tabs.length > 0)
      .map((group) => ({
        value: group.id,
        label: `${group.name} (${group.tabs.length} tab${
          group.tabs.length > 1 ? "s" : ""
        })`,
        type: group.type,
        tabCount: group.tabs.length,
      }))
      .sort((a, b) => {
        // Container groups first
        if (a.type !== b.type) {
          return a.type === "container" ? -1 : 1;
        }
        // Default container first within container groups
        if (a.type === "container") {
          if (a.label.includes("Default Container")) return -1;
          if (b.label.includes("Default Container")) return 1;
        }
        return a.label.localeCompare(b.label);
      });
  }, [groups]);

  // Filter tabs by selected group
  const selectedGroup = useMemo((): TabGroup | null => {
    return selectedGroupId
      ? groups.find((g) => g.id === selectedGroupId) || null
      : null;
  }, [groups, selectedGroupId]);

  // Create tab options for the selected group
  const tabOptions = useMemo(() => {
    if (!selectedGroup) return [];

    return selectedGroup.tabs
      .sort((a, b) => {
        // Active tabs first
        if (a.active && !b.active) return -1;
        if (!a.active && b.active) return 1;
        return a.title.localeCompare(b.title);
      })
      .map((tab) => ({
        value: tab.id.toString(),
        label:
          tab.title.length > 35
            ? tab.title.substring(0, 35) + "..."
            : tab.title,
      }));
  }, [selectedGroup]);

  // Auto-select first group and tab when data loads
  useEffect(() => {
    if (groupOptions.length > 0) {
      // Check localStorage first
      const savedGroupId = localStorage.getItem(
        "claude-assistant-selected-group"
      );
      if (
        savedGroupId &&
        groupOptions.some((opt) => opt.value === savedGroupId)
      ) {
        setSelectedGroupId(savedGroupId);
      } else if (!selectedGroupId) {
        const firstGroup = groupOptions[0].value;
        setSelectedGroupId(firstGroup);
      }
    }
  }, [groupOptions, selectedGroupId]);

  useEffect(() => {
    if (selectedGroup && selectedGroup.tabs.length > 0 && !selectedTabId) {
      const firstTab = selectedGroup.tabs[0];
      setSelectedTabId(firstTab.id);
    } else if (!selectedGroup || selectedGroup.tabs.length === 0) {
      setSelectedTabId(null);
    }
  }, [selectedGroup, selectedTabId]);

  const loadGroups = async () => {
    setIsLoadingGroups(true);
    setDebugInfo("Loading groups and managed tabs...");

    try {
      const browserAPI = (window as any).browser || (window as any).chrome;
      if (!browserAPI?.runtime?.sendMessage) {
        console.error("Browser runtime API not available");
        setDebugInfo("Browser runtime API not available");
        setIsLoadingGroups(false);
        return;
      }

      const result = await new Promise((resolve, reject) => {
        browserAPI.runtime.sendMessage(
          { action: "getGroups" },
          (response: any) => {
            if (browserAPI.runtime.lastError) {
              reject(new Error(browserAPI.runtime.lastError.message));
            } else {
              resolve(response);
            }
          }
        );
      });

      if (
        result &&
        (result as any).success &&
        Array.isArray((result as any).groups)
      ) {
        const groupsData = (result as any).groups as TabGroup[];
        setGroups(groupsData);

        const totalTabs = groupsData.reduce(
          (sum, group) => sum + group.tabs.length,
          0
        );

        if (totalTabs > 0) {
          setDebugInfo(
            `Successfully loaded ${totalTabs} managed tabs across ${groupsData.length} groups`
          );
        } else {
          setDebugInfo("No managed Claude tabs found");
        }
      } else {
        console.error("Popup: Invalid result format:", result);
        setGroups([]);
        setDebugInfo(`Invalid response from background script`);
      }
    } catch (error: any) {
      console.error("Popup: Error loading groups:", error);
      setGroups([]);
      setDebugInfo(`Error: ${error?.message || "Unknown error"}`);
    } finally {
      setIsLoadingGroups(false);
    }
  };

  const sendPrompt = async () => {
    if (!selectedTabId || !prompt.trim()) return;

    setIsLoading(true);
    try {
      const browserAPI = (window as any).browser || (window as any).chrome;

      const result = await new Promise((resolve, reject) => {
        browserAPI.runtime.sendMessage(
          {
            action: "sendPrompt",
            tabId: selectedTabId,
            prompt: prompt.trim(),
          },
          (response: any) => {
            if (browserAPI.runtime.lastError) {
              reject(new Error(browserAPI.runtime.lastError.message));
            } else {
              resolve(response);
            }
          }
        );
      });

      if ((result as any).success) {
        const selectedTab = selectedGroup?.tabs.find(
          (tab) => tab.id === selectedTabId
        );
        const newResponse: Response = {
          tabId: selectedTabId,
          tabTitle: selectedTab?.title || "Unknown Tab",
          groupName: selectedGroup?.name || "Unknown Group",
          response: (result as any).response,
          timestamp: new Date(),
        };

        setResponses((prev) => [newResponse, ...prev]);
        setPrompt("");
      } else {
        console.error("Failed to send prompt:", (result as any).error);
        alert(`Error: ${(result as any).error}`);
      }
    } catch (error: any) {
      console.error("Error sending prompt:", error);
      alert("Error sending prompt to Claude");
    } finally {
      setIsLoading(false);
    }
  };

  const openSidebar = async () => {
    try {
      const browserAPI = (window as any).browser || (window as any).chrome;
      if (browserAPI.sidebarAction && browserAPI.sidebarAction.open) {
        await browserAPI.sidebarAction.open();
      } else {
        // Fallback: try to open sidebar via runtime message
        browserAPI.runtime.sendMessage({ action: "openSidebar" });
      }
    } catch (error) {
      console.error("Error opening sidebar:", error);
      alert(
        "Could not open sidebar. Please use F1 or View > Sidebar > Claude Assistant"
      );
    }
  };

  const copyResponse = async (response: string) => {
    try {
      await navigator.clipboard.writeText(response);
      // You could add a toast notification here
    } catch (error) {
      console.error("Error copying response:", error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && e.ctrlKey) {
      sendPrompt();
    }
  };

  const handleGroupChange = (value: string | string[]) => {
    const groupValue = Array.isArray(value) ? value[0] : value;
    setSelectedGroupId(groupValue);
    // Save to localStorage
    if (groupValue) {
      localStorage.setItem("claude-assistant-selected-group", groupValue);
    }
    // Reset tab selection when changing group
    setSelectedTabId(null);
  };

  const handleTabChange = (value: string | string[]) => {
    const tabValue = Array.isArray(value) ? value[0] : value;
    setSelectedTabId(tabValue ? parseInt(tabValue, 10) : null);
  };

  const selectedGroupLabel =
    groupOptions.find((g) => g.value === selectedGroupId)?.label || "";
  const selectedTabCount = selectedGroup?.tabs.length || 0;

  const getGroupIcon = (type: "container" | "custom") => {
    return type === "container" ? <Users size={14} /> : <Folder size={14} />;
  };

  return (
    <div
      className={`w-[640px] ${
        isExpanded ? "h-[768px]" : "h-[512px]"
      } bg-white dark:bg-gray-900 text-gray-900 dark:text-white transition-all duration-300`}
    >
      {/* Header */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare size={20} className="text-blue-500" />
            <h1 className="font-semibold text-lg">Claude Assistant</h1>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={openSidebar}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
              title="Open sidebar to manage groups"
            >
              <Sidebar size={16} />
            </button>
            <button
              onClick={loadGroups}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
              title="Refresh groups"
              disabled={isLoadingGroups}
            >
              <RefreshCw
                size={16}
                className={isLoadingGroups ? "animate-spin" : ""}
              />
            </button>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
              title={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            <button
              onClick={() => window.close()}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-3 space-y-3">
        {/* Loading State */}
        {isLoadingGroups && (
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <RefreshCw size={16} className="animate-spin" />
            Loading groups and managed tabs...
          </div>
        )}

        {/* Debug Info */}
        {debugInfo && (
          <div
            className={`text-xs p-2 rounded flex items-start gap-2 ${
              debugInfo.includes("Error") || debugInfo.includes("Invalid")
                ? "text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400"
                : debugInfo.includes("Successfully")
                ? "text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400"
                : "text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400"
            }`}
          >
            {debugInfo.includes("Error") && (
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
            )}
            <span>Debug: {debugInfo}</span>
          </div>
        )}

        {/* Show message when no managed tabs found */}
        {!isLoadingGroups && groups.length === 0 && (
          <div className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3 rounded border-l-4 border-amber-400">
            <div className="font-medium mb-1">
              No managed Claude groups detected
            </div>
            <div className="text-xs mb-2">
              Use the sidebar to create groups and manage Claude tabs. Only tabs
              managed through the sidebar will appear here.
            </div>
            <button
              onClick={openSidebar}
              className="flex items-center gap-2 text-xs bg-amber-100 dark:bg-amber-800 px-2 py-1 rounded hover:bg-amber-200 dark:hover:bg-amber-700 transition-colors"
            >
              <Sidebar size={12} />
              Open Sidebar
            </button>
          </div>
        )}

        {/* Success message when groups found */}
        {!isLoadingGroups && groups.length > 0 && (
          <div className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-2 rounded">
            Found {groups.reduce((sum, g) => sum + g.tabs.length, 0)} managed
            tab
            {groups.reduce((sum, g) => sum + g.tabs.length, 0) > 1
              ? "s"
              : ""}{" "}
            across {groups.length} group
            {groups.length > 1 ? "s" : ""}
          </div>
        )}

        {/* Group Selection */}
        {!isLoadingGroups && groupOptions.length > 0 && (
          <CustomCombobox
            label="Tab Group"
            value={selectedGroupId || ""}
            options={groupOptions.map((group) => ({
              value: group.value,
              label: `${getGroupIcon(group.type)} ${group.label}`,
            }))}
            onChange={handleGroupChange}
            placeholder="Select a group..."
            size="sm"
            searchable={groupOptions.length >= 5}
          />
        )}

        {/* Tab Selection */}
        {!isLoadingGroups && selectedGroupId && selectedGroup && (
          <CustomCombobox
            label={`Claude Tabs in ${selectedGroup.name}`}
            value={selectedTabId ? selectedTabId.toString() : ""}
            options={tabOptions}
            onChange={handleTabChange}
            placeholder={
              selectedTabCount === 0
                ? "No tabs in this group"
                : "Select a Claude tab..."
            }
            size="sm"
            searchable={tabOptions.length >= 5}
          />
        )}

        {/* Tab count info */}
        {!isLoadingGroups && selectedGroupId && selectedTabCount > 0 && (
          <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-2 rounded flex items-center gap-2">
            {getGroupIcon(selectedGroup?.type || "container")}
            <span>
              {selectedTabCount} managed Claude tab
              {selectedTabCount > 1 ? "s" : ""} in {selectedGroup?.type} group
            </span>
          </div>
        )}

        {/* Prompt Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Prompt:</label>
          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your prompt here... (Ctrl+Enter to send)"
              rows={3}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded text-sm resize-none bg-white dark:bg-gray-800"
              disabled={isLoading || isLoadingGroups}
            />
          </div>
        </div>

        {/* Send Button */}
        <button
          onClick={sendPrompt}
          disabled={
            !selectedTabId ||
            !prompt.trim() ||
            isLoading ||
            isLoadingGroups ||
            groups.length === 0
          }
          className="w-full flex items-center justify-center gap-2 p-2 bg-blue-500 text-white rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
        >
          {isLoading ? (
            <RefreshCw size={16} className="animate-spin" />
          ) : (
            <Send size={16} />
          )}
          {isLoading ? "Sending..." : "Send to Claude"}
        </button>

        {/* Responses (Only show when expanded) */}
        {isExpanded && responses.length > 0 && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
            <h3 className="font-medium text-sm mb-2">Recent Responses:</h3>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {responses.map((response, index) => (
                <div
                  key={index}
                  className="p-2 bg-gray-50 dark:bg-gray-800 rounded text-xs"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium truncate flex-1">
                      {response.tabTitle}
                    </span>
                    <button
                      onClick={() => copyResponse(response.response)}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded flex-shrink-0"
                      title="Copy response"
                    >
                      <Copy size={12} />
                    </button>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    {response.groupName}
                  </div>
                  <p className="text-gray-600 dark:text-gray-300 line-clamp-2">
                    {response.response}
                  </p>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {response.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Show expand hint when there are responses but not expanded */}
        {!isExpanded && responses.length > 0 && (
          <div className="text-xs text-center text-gray-500">
            Click expand (↑) to view {responses.length} response
            {responses.length > 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  );
};

export default Popup;
