import React, { useState, useRef, useEffect } from "react";
import { FolderPlus, ExternalLink, Grid, List, Eye } from "lucide-react";
import CustomCombobox from "../common/CustomCombobox";

interface Container {
  cookieStoreId: string;
  name: string;
  color: string;
  icon: string;
}

interface SidebarHeaderProps {
  containers: Container[];
  onCreateTabInContainer: (containerCookieStoreId: string) => void;
  onCreateCustomGroup: (name: string) => void;
  viewMode?: "compact" | "normal" | "detailed";
  onViewModeChange?: (mode: "compact" | "normal" | "detailed") => void;
}

const SidebarHeader: React.FC<SidebarHeaderProps> = ({
  containers,
  onCreateTabInContainer,
  onCreateCustomGroup,
  viewMode = "normal",
  onViewModeChange,
}) => {
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showViewDropdown, setShowViewDropdown] = useState(false);
  const [selectedGroupOption, setSelectedGroupOption] = useState("");
  const [zoomLevel, setZoomLevel] = useState(100);

  const viewDropdownRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const browserAPI = (window as any).browser || (window as any).chrome;

  // Function to calculate zoom level
  const calculateZoomLevel = () => {
    const ratio = Math.round(window.devicePixelRatio * 100) / 100;
    const zoomPercent = Math.round(ratio * 100);
    return zoomPercent;
  };

  // Update zoom level on component mount
  useEffect(() => {
    const savedZoom = localStorage.getItem("sidebar-zoom-level");
    if (savedZoom) {
      const parsedZoom = parseInt(savedZoom, 10);
      if (parsedZoom && parsedZoom > 0) {
        setZoomLevel(parsedZoom);
      } else {
        const currentZoom = calculateZoomLevel();
        setZoomLevel(currentZoom);
        localStorage.setItem("sidebar-zoom-level", currentZoom.toString());
      }
    } else {
      const currentZoom = calculateZoomLevel();
      setZoomLevel(currentZoom);
      localStorage.setItem("sidebar-zoom-level", currentZoom.toString());
    }
  }, []);

  // Listen for zoom changes
  useEffect(() => {
    const handleZoomChange = () => {
      const newZoom = calculateZoomLevel();
      setZoomLevel(newZoom);
      localStorage.setItem("sidebar-zoom-level", newZoom.toString());
    };

    // Listen for resize events which can indicate zoom changes
    window.addEventListener("resize", handleZoomChange);

    // Listen for devicePixelRatio changes (more reliable for zoom detection)
    const mediaQuery = window.matchMedia(
      `(resolution: ${window.devicePixelRatio}dppx)`
    );

    // Modern browsers support addEventListener on MediaQueryList
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleZoomChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleZoomChange);
    }

    // Also check for zoom changes periodically as a fallback
    const zoomCheckInterval = setInterval(() => {
      const currentZoom = calculateZoomLevel();
      if (currentZoom !== zoomLevel) {
        setZoomLevel(currentZoom);
        localStorage.setItem("sidebar-zoom-level", currentZoom.toString());
      }
    }, 1000);

    return () => {
      window.removeEventListener("resize", handleZoomChange);
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleZoomChange);
      } else {
        mediaQuery.removeListener(handleZoomChange);
      }
      clearInterval(zoomCheckInterval);
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        viewDropdownRef.current &&
        !viewDropdownRef.current.contains(event.target as Node)
      ) {
        setShowViewDropdown(false);
      }
      if (
        modalRef.current &&
        !modalRef.current.contains(event.target as Node) &&
        showGroupModal
      ) {
        handleCancelGroupModal();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showGroupModal]);

  // Create options for the combobox
  const groupOptions = [
    // Default container option
    {
      value: "firefox-default",
      label: "Default Container",
    },
    // Container options
    ...containers.map((container) => ({
      value: container.cookieStoreId,
      label: container.name,
    })),
  ];

  const handleShowGroupModal = () => {
    setShowGroupModal(true);
    setSelectedGroupOption("");
  };

  const handleCancelGroupModal = () => {
    setShowGroupModal(false);
    setSelectedGroupOption("");
  };

  const handleGroupSelection = (value: string | string[]) => {
    const selectedValue = Array.isArray(value) ? value[0] : value;
    console.log("[DEBUG] SidebarHeader: Group selection:", selectedValue);

    // Check if it's one of the existing container options
    const existingOption = groupOptions.find(
      (opt) => opt.value === selectedValue
    );

    if (existingOption) {
      // Create container group for selected container
      const containerName = existingOption.label;
      console.log(
        `[DEBUG] SidebarHeader: Creating container group for: ${containerName} (${selectedValue})`
      );

      // Call create group with container type
      const browserAPI = (window as any).browser || (window as any).chrome;
      browserAPI.runtime.sendMessage(
        {
          action: "createGroup",
          name: containerName,
          type: "container",
          containerCookieStoreId: existingOption.value,
        },
        (response: any) => {
          console.log("[DEBUG] SidebarHeader: createGroup response:", response);
          if (response?.success) {
            console.log(
              `[DEBUG] Container group "${containerName}" created successfully`
            );
          } else {
            console.error(
              "[DEBUG] Failed to create container group:",
              response?.error
            );
          }
        }
      );
    } else if (selectedValue && selectedValue.trim()) {
      // It's a new custom group name - create group only, no tab
      console.log(
        "[DEBUG] SidebarHeader: Creating custom group:",
        selectedValue
      );
      onCreateCustomGroup(selectedValue.trim());
    }

    setShowGroupModal(false);
    setSelectedGroupOption("");
  };

  const openTabManager = async () => {
    try {
      await new Promise((resolve, reject) => {
        browserAPI.runtime.sendMessage(
          { action: "openTabManager" },
          (response: any) => {
            if (browserAPI.runtime.lastError) {
              reject(new Error(browserAPI.runtime.lastError.message));
            } else {
              resolve(response);
            }
          }
        );
      });
    } catch (error) {
      console.error("Error opening tab manager:", error);
    }
  };

  const getViewModeIcon = () => {
    switch (viewMode) {
      case "compact":
        return <List size={18} />;
      case "detailed":
        return <Eye size={18} />;
      default:
        return <Grid size={18} />;
    }
  };

  const getViewModeLabel = () => {
    switch (viewMode) {
      case "compact":
        return "Compact View";
      case "detailed":
        return "Detailed View";
      default:
        return "Normal View";
    }
  };

  // Get zoom level display color based on value
  const getZoomLevelColor = (zoom: number) => {
    if (zoom === 100) return "text-green-400";
    if (zoom > 100) return "text-blue-400";
    return "text-yellow-400";
  };

  return (
    <>
      <div className="bg-slate-800 text-white p-4 border-b border-slate-700">
        {/* Main Header */}
        <div className="flex items-center justify-between">
          {/* Title */}
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-white">Sigil</h1>
          </div>

          {/* Zoom Level Badge */}
          <div className="flex items-center gap-2">
            <div
              className="px-2 py-1 bg-slate-700 rounded-lg text-xs font-medium cursor-default"
              title={`Browser zoom level: ${zoomLevel}%`}
            >
              <span className={getZoomLevelColor(zoomLevel)}>{zoomLevel}%</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Tab Manager Button */}
            <button
              onClick={openTabManager}
              className="p-2 hover:bg-slate-700 text-white rounded-lg transition-colors"
              title="Open Tab Manager"
            >
              <ExternalLink size={18} />
            </button>

            {/* Create Group Button */}
            <button
              onClick={handleShowGroupModal}
              className="p-2 hover:bg-slate-700 text-white rounded-lg transition-colors"
              title="Create Group"
            >
              <FolderPlus size={18} />
            </button>

            {/* View Mode Button */}
            <div className="relative" ref={viewDropdownRef}>
              <button
                onClick={() => setShowViewDropdown(!showViewDropdown)}
                className="p-2 hover:bg-slate-700 text-white rounded-lg transition-colors"
                title={getViewModeLabel()}
              >
                {getViewModeIcon()}
              </button>

              {/* View Mode Dropdown */}
              {showViewDropdown && onViewModeChange && (
                <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg shadow-lg z-50 min-w-48">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        onViewModeChange("compact");
                        setShowViewDropdown(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-600 flex items-center gap-3 ${
                        viewMode === "compact"
                          ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                          : "text-gray-900 dark:text-gray-100"
                      }`}
                    >
                      <List size={16} />
                      <span>Compact View</span>
                    </button>

                    <button
                      onClick={() => {
                        onViewModeChange("normal");
                        setShowViewDropdown(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-600 flex items-center gap-3 ${
                        viewMode === "normal"
                          ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                          : "text-gray-900 dark:text-gray-100"
                      }`}
                    >
                      <Grid size={16} />
                      <span>Normal View</span>
                    </button>

                    <button
                      onClick={() => {
                        onViewModeChange("detailed");
                        setShowViewDropdown(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-600 flex items-center gap-3 ${
                        viewMode === "detailed"
                          ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                          : "text-gray-900 dark:text-gray-100"
                      }`}
                    >
                      <Eye size={16} />
                      <span>Detailed View</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Group Creation Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div
            ref={modalRef}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Create or Select Group
            </h3>

            <div className="space-y-4">
              <CustomCombobox
                label="Group Type"
                value={selectedGroupOption}
                options={groupOptions.map((opt) => ({
                  value: opt.value,
                  label: `🏢 ${opt.label} (Container)`,
                }))}
                onChange={handleGroupSelection}
                placeholder="Search containers or type custom group name..."
                creatable={true}
                searchable={true}
                size="md"
              />

              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                <p>
                  <strong>Container Groups:</strong> Select from existing
                  Firefox containers. Groups are created automatically when you
                  create tabs.
                </p>
                <p>
                  <strong>Custom Groups:</strong> Type a custom name and press
                  Enter to create a new empty project-based group.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={handleCancelGroupModal}
                  className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SidebarHeader;
