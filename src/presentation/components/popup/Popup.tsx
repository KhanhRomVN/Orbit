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
} from "lucide-react";
import CustomCombobox from "../common/CustomCombobox";

interface ClaudeTab {
  id: number;
  title: string;
  url: string;
  container?: string;
  containerName?: string;
  containerIcon?: string;
  containerColor?: string;
}

interface Response {
  tabId: number;
  tabTitle: string;
  response: string;
  timestamp: Date;
}

interface ContainerOption {
  value: string;
  label: string;
  color?: string;
  icon?: string;
  count: number;
}

const Popup: React.FC = () => {
  const [claudeTabs, setClaudeTabs] = useState<ClaudeTab[]>([]);
  const [selectedContainer, setSelectedContainer] = useState<string | null>(
    null
  );
  const [selectedTabId, setSelectedTabId] = useState<number | null>(null);
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [responses, setResponses] = useState<Response[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>("");
  const [isLoadingTabs, setIsLoadingTabs] = useState(true);

  useEffect(() => {
    loadClaudeTabs();
  }, []);

  // Create container options from Claude tabs
  const containerOptions = useMemo((): ContainerOption[] => {
    const containerMap = new Map<string, ContainerOption>();

    claudeTabs.forEach((tab) => {
      const containerId = tab.container || "firefox-default";
      const containerName = tab.containerName || "Default";

      if (containerMap.has(containerId)) {
        const existing = containerMap.get(containerId)!;
        existing.count += 1;
      } else {
        containerMap.set(containerId, {
          value: containerId,
          label: `${containerName} (${tab.containerColor || "default"})`,
          color: tab.containerColor,
          icon: tab.containerIcon,
          count: 1,
        });
      }
    });

    return Array.from(containerMap.values()).sort((a, b) => {
      // Default container first
      if (a.value === "firefox-default") return -1;
      if (b.value === "firefox-default") return 1;
      return a.label.localeCompare(b.label);
    });
  }, [claudeTabs]);

  // Filter tabs by selected container
  const filteredTabs = useMemo((): ClaudeTab[] => {
    if (!selectedContainer || selectedContainer === "") return [];

    return claudeTabs
      .filter((tab) => {
        const tabContainer = tab.container || "firefox-default";
        return tabContainer === selectedContainer;
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [claudeTabs, selectedContainer]);

  // Create tab options for the selected container
  const tabOptions = useMemo(() => {
    return filteredTabs.map((tab) => ({
      value: tab.id.toString(),
      label:
        tab.title.length > 40 ? tab.title.substring(0, 40) + "..." : tab.title,
    }));
  }, [filteredTabs]);

  // Auto-select first container and tab when data loads
  useEffect(() => {
    if (containerOptions.length > 0) {
      // Check localStorage first
      const savedContainer = localStorage.getItem(
        "claude-assistant-selected-container"
      );
      if (
        savedContainer &&
        containerOptions.some((opt) => opt.value === savedContainer)
      ) {
        setSelectedContainer(savedContainer);
      } else if (!selectedContainer) {
        const firstContainer = containerOptions[0].value;
        setSelectedContainer(firstContainer);
      }
    }
  }, [containerOptions, selectedContainer]);

  useEffect(() => {
    if (filteredTabs.length > 0 && !selectedTabId && selectedContainer) {
      const firstTab = filteredTabs[0];
      setSelectedTabId(firstTab.id);
    } else if (filteredTabs.length === 0) {
      setSelectedTabId(null);
    }
  }, [filteredTabs, selectedTabId]);

  const loadClaudeTabs = async () => {
    setIsLoadingTabs(true);
    setDebugInfo("Loading managed Claude tabs...");

    try {
      const browserAPI = (window as any).browser || (window as any).chrome;
      if (!browserAPI?.runtime?.sendMessage) {
        console.error("Browser runtime API not available");
        setDebugInfo("Browser runtime API not available");
        setIsLoadingTabs(false);
        return;
      }

      const result = await new Promise((resolve, reject) => {
        browserAPI.runtime.sendMessage(
          { action: "getClaudeTabs" },
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
        Array.isArray((result as any).tabs)
      ) {
        const tabs = (result as any).tabs;

        setClaudeTabs(tabs);
        if (tabs.length > 0) {
          setDebugInfo(
            `Successfully loaded ${tabs.length} managed Claude tabs`
          );
        } else {
          setDebugInfo("No managed Claude tabs found");
        }
      } else {
        console.error("Popup: Invalid result format:", result);
        setClaudeTabs([]);
        setDebugInfo(`Invalid response from background script`);
      }
    } catch (error: any) {
      console.error("Popup: Error loading Claude tabs:", error);
      setClaudeTabs([]);
      setDebugInfo(`Error: ${error?.message || "Unknown error"}`);
    } finally {
      setIsLoadingTabs(false);
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
        const selectedTab = claudeTabs.find((tab) => tab.id === selectedTabId);
        const newResponse: Response = {
          tabId: selectedTabId,
          tabTitle: selectedTab?.title || "Unknown Tab",
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

  useEffect(() => {
    if (containerOptions.length > 0 && selectedContainer === null) {
      const savedContainer = localStorage.getItem(
        "claude-assistant-selected-container"
      );
      if (
        savedContainer &&
        containerOptions.some((opt) => opt.value === savedContainer)
      ) {
        setSelectedContainer(savedContainer);
      } else {
        const firstContainer = containerOptions[0].value;
        setSelectedContainer(firstContainer);
      }
    }
  }, [containerOptions]);

  const handleTabChange = (value: string | string[]) => {
    const tabValue = Array.isArray(value) ? value[0] : value;
    setSelectedTabId(tabValue ? parseInt(tabValue, 10) : null);
  };

  const selectedContainerLabel =
    containerOptions.find((container) => container.value === selectedContainer)
      ?.label || "";

  const selectedTabCount = filteredTabs.length;

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
              title="Open sidebar to manage tabs"
            >
              <Sidebar size={16} />
            </button>
            <button
              onClick={loadClaudeTabs}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
              title="Refresh tabs"
              disabled={isLoadingTabs}
            >
              <RefreshCw
                size={16}
                className={isLoadingTabs ? "animate-spin" : ""}
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
        {isLoadingTabs && (
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <RefreshCw size={16} className="animate-spin" />
            Loading managed Claude tabs...
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
        {!isLoadingTabs && claudeTabs.length === 0 && (
          <div className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3 rounded border-l-4 border-amber-400">
            <div className="font-medium mb-1">
              No managed Claude tabs detected
            </div>
            <div className="text-xs mb-2">
              Use the sidebar to open and manage Claude tabs. Only tabs opened
              through the sidebar will appear here.
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

        {/* Success message when managed tabs found */}
        {!isLoadingTabs && claudeTabs.length > 0 && (
          <div className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-2 rounded">
            Found {claudeTabs.length} managed Claude tab
            {claudeTabs.length > 1 ? "s" : ""} across {containerOptions.length}{" "}
            container
            {containerOptions.length > 1 ? "s" : ""}
          </div>
        )}

        {/* Container Selection */}
        {!isLoadingTabs && containerOptions.length > 0 && (
          <CustomCombobox
            label="Firefox Container"
            value={selectedContainer || ""}
            options={containerOptions.map((container) => ({
              value: container.value,
              label: `${container.label} - ${container.count} tab${
                container.count > 1 ? "s" : ""
              }`,
            }))}
            onChange={(value: string | string[]) => {
              const containerValue = Array.isArray(value) ? value[0] : value;
              setSelectedContainer(containerValue);
              // Save to localStorage
              if (containerValue) {
                localStorage.setItem(
                  "claude-assistant-selected-container",
                  containerValue
                );
              }
              // Reset tab selection when changing container
              setSelectedTabId(null);
            }}
            placeholder="Select a container..."
            size="sm"
            searchable={containerOptions.length >= 5}
          />
        )}

        {/* Tab Selection */}
        {!isLoadingTabs && selectedContainer && (
          <CustomCombobox
            label={`Claude Tabs in ${selectedContainerLabel}`}
            value={selectedTabId ? selectedTabId.toString() : ""}
            options={tabOptions}
            onChange={handleTabChange}
            placeholder={
              selectedTabCount === 0
                ? "No managed tabs in this container"
                : "Select a Claude tab..."
            }
            size="sm"
            searchable={tabOptions.length >= 5}
          />
        )}

        {/* Tab count info */}
        {!isLoadingTabs && selectedContainer && selectedTabCount > 0 && (
          <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-2 rounded">
            {selectedTabCount} managed Claude tab
            {selectedTabCount > 1 ? "s" : ""} available in this container
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
              disabled={isLoading || isLoadingTabs}
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
            isLoadingTabs ||
            claudeTabs.length === 0
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
