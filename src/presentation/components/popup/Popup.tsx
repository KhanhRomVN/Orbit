import React, { useState, useEffect } from "react";
import {
  Send,
  Copy,
  RefreshCw,
  MessageSquare,
  X,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from "lucide-react";

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

const Popup: React.FC = () => {
  const [claudeTabs, setClaudeTabs] = useState<ClaudeTab[]>([]);
  const [selectedTabId, setSelectedTabId] = useState<number | null>(null);
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [responses, setResponses] = useState<Response[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>("");
  const [isLoadingTabs, setIsLoadingTabs] = useState(true);

  // Monitor state changes for debugging
  useEffect(() => {
    console.log(
      "Popup: claudeTabs state changed:",
      claudeTabs.length,
      claudeTabs
    );
  }, [claudeTabs]);

  useEffect(() => {
    console.log("Popup: selectedTabId changed:", selectedTabId);
  }, [selectedTabId]);

  useEffect(() => {
    loadClaudeTabs();
  }, []);

  const loadClaudeTabs = async () => {
    setIsLoadingTabs(true);
    setDebugInfo("Loading Claude tabs...");

    try {
      console.log("Popup: Requesting Claude tabs...");

      // Kiểm tra xem browser API có tồn tại không
      const browserAPI = (window as any).browser || (window as any).chrome;
      if (!browserAPI?.runtime?.sendMessage) {
        console.error("Browser runtime API not available");
        setDebugInfo("Browser runtime API not available");
        setIsLoadingTabs(false);
        return;
      }

      console.log("Popup: Sending message to background script...");

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

      console.log("Popup: Received result:", result);
      console.log("Popup: Result type:", typeof result);
      console.log("Popup: Result success:", (result as any)?.success);
      console.log("Popup: Result tabs:", (result as any)?.tabs);
      console.log("Popup: Tabs length:", (result as any)?.tabs?.length);

      if (
        result &&
        (result as any).success &&
        Array.isArray((result as any).tabs)
      ) {
        const tabs = (result as any).tabs;
        console.log("Popup: Setting tabs:", tabs.length, "tabs");

        // Debug container info
        tabs.forEach((tab: ClaudeTab) => {
          console.log(`Tab: ${tab.title}`);
          console.log(`  - Container ID: ${tab.container}`);
          console.log(`  - Container Name: ${tab.containerName}`);
          console.log(`  - Container Color: ${tab.containerColor}`);
          console.log(`  - Container Icon: ${tab.containerIcon}`);
        });

        setClaudeTabs(tabs);
        if (tabs.length > 0) {
          if (!selectedTabId) {
            console.log("Popup: Auto-selecting first tab:", tabs[0].id);
            setSelectedTabId(tabs[0].id);
          }
          setDebugInfo(`Successfully loaded ${tabs.length} Claude tabs`);
        } else {
          setDebugInfo("No Claude tabs found");
        }
      } else {
        console.error("Popup: Invalid result format:", result);
        console.error("Popup: Expected format: {success: true, tabs: []}");
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

  return (
    <div
      className={`w-80 ${
        isExpanded ? "h-96" : "h-64"
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
            Loading Claude tabs...
          </div>
        )}

        {/* Debug Info - Hiển thị trạng thái và lỗi */}
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

        {/* Tab Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center justify-between">
            <span>Select Claude Tab:</span>
            <span className="text-xs text-gray-500">
              ({claudeTabs.length} found)
            </span>
          </label>
          <select
            value={selectedTabId || ""}
            onChange={(e) => setSelectedTabId(Number(e.target.value))}
            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-800"
            disabled={isLoadingTabs}
          >
            <option value="">
              {isLoadingTabs
                ? "Loading tabs..."
                : claudeTabs.length === 0
                ? "No Claude tabs found"
                : "Select a tab..."}
            </option>
            {claudeTabs.map((tab) => (
              <option key={tab.id} value={tab.id}>
                [{tab.containerName || "Default"}]{" "}
                {tab.title.length > 25
                  ? tab.title.substring(0, 25) + "..."
                  : tab.title}
              </option>
            ))}
          </select>
        </div>

        {/* Show message when no tabs found */}
        {!isLoadingTabs && claudeTabs.length === 0 && (
          <div className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3 rounded border-l-4 border-amber-400">
            <div className="font-medium mb-1">No Claude tabs detected</div>
            <div className="text-xs">
              Please open claude.ai in a tab and click the refresh button above.
            </div>
          </div>
        )}

        {/* Success message when tabs found */}
        {!isLoadingTabs && claudeTabs.length > 0 && (
          <div className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-2 rounded">
            Found {claudeTabs.length} Claude tab
            {claudeTabs.length > 1 ? "s" : ""}. Ready to send prompts!
          </div>
        )}

        {/* Container breakdown */}
        {!isLoadingTabs && claudeTabs.length > 0 && (
          <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-2 rounded">
            <div className="font-medium mb-1">Containers:</div>
            {Object.entries(
              claudeTabs.reduce((acc: Record<string, number>, tab) => {
                const container = tab.containerName || "Default";
                acc[container] = (acc[container] || 0) + 1;
                return acc;
              }, {} as Record<string, number>)
            ).map(([container, count]) => (
              <div key={container} className="flex justify-between">
                <span>{container}:</span>
                <span>
                  {count as number} tab{(count as number) > 1 ? "s" : ""}
                </span>
              </div>
            ))}
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
