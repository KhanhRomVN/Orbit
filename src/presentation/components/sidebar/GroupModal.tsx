// File: src/presentation/components/sidebar/GroupModal.tsx
import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { TabGroup, BrowserContainer } from "@/types/tab-group";
import CustomCombobox from "../common/CustomCombobox";
import CustomInput from "../common/CustomInput";

interface GroupModalProps {
  isOpen: boolean;
  mode: "create" | "edit";
  group?: TabGroup;
  onClose: () => void;
  onGroupCreated: (group: TabGroup) => void;
  onGroupUpdated: (group: TabGroup) => void;
}

const GroupModal: React.FC<GroupModalProps> = ({
  isOpen,
  mode,
  group,
  onClose,
  onGroupCreated,
  onGroupUpdated,
}) => {
  const [name, setName] = useState("");
  const [type, setType] = useState<"custom" | "container">("custom");
  const [selectedContainer, setSelectedContainer] = useState<string>("");
  const [color, setColor] = useState("#3B82F6");
  const [icon, setIcon] = useState("📦");
  const [containers, setContainers] = useState<BrowserContainer[]>([]);

  const colorOptions = [
    "#EF4444",
    "#F59E0B",
    "#10B981",
    "#3B82F6",
    "#8B5CF6",
    "#EC4899",
    "#6B7280",
    "#84CC16",
    "#06B6D4",
    "#F97316",
  ];

  const iconOptions = [
    "📦",
    "🏠",
    "💼",
    "🎯",
    "⭐",
    "🚀",
    "🔍",
    "📚",
    "🎨",
    "⚡",
    "❤️",
    "🌟",
    "🔥",
    "💎",
    "🎭",
    "📊",
    "🔧",
    "🎵",
    "📷",
    "🍕",
  ];

  useEffect(() => {
    if (isOpen) {
      loadContainers();
      if (mode === "edit" && group) {
        setName(group.name);
        setType(group.type);
        setColor(group.color);
        setIcon(group.icon);
        if (group.containerId) {
          setSelectedContainer(group.containerId);
        }
      } else {
        // Reset form for create mode
        setName("");
        setType("custom");
        setColor("#3B82F6");
        setIcon("📦");
        setSelectedContainer("");
      }
    }
  }, [isOpen, mode, group]);

  const loadContainers = async () => {
    try {
      const result = await chrome.runtime.sendMessage({
        action: "getContainers",
      });
      setContainers(result || []);
    } catch (error) {
      console.error("Failed to load containers:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) return;

    const groupData: Omit<TabGroup, "id" | "tabs" | "createdAt"> = {
      name: name.trim(),
      type,
      color,
      icon,
      visible: true,
      ...(type === "container" &&
        selectedContainer && { containerId: selectedContainer }),
    };

    try {
      if (mode === "create") {
        try {
          const result = await new Promise<TabGroup>((resolve, reject) => {
            chrome.runtime.sendMessage(
              {
                action: "createGroup",
                groupData,
              },
              (response) => {
                // Kiểm tra lỗi từ Chrome API
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                  return;
                }

                // Kiểm tra response có error từ service worker
                if (response?.error) {
                  reject(new Error(response.error));
                  return;
                }

                // Kiểm tra response hợp lệ
                if (!response || !response.id) {
                  reject(new Error("Invalid response from service worker"));
                  return;
                }

                resolve(response);
              }
            );
          });

          console.log("[DEBUG] Create group success:", result);
          onGroupCreated(result);
          onClose();
        } catch (error) {
          console.error("Create group failed:", error);
          alert(
            `Failed to create group: ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          );
        }
      } else if (mode === "edit" && group) {
        const result = await chrome.runtime.sendMessage({
          action: "updateGroup",
          groupId: group.id,
          groupData,
        });
        onGroupUpdated(result);
      }
    } catch (error) {
      console.error("Failed to save group:", error);
    }
  };

  const containerOptions = containers.map((container) => ({
    value: container.cookieStoreId,
    label: container.name,
  }));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-96 max-w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {mode === "create" ? "Create New Group" : "Edit Group"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <CustomInput
            label="Group Name"
            value={name}
            onChange={setName}
            required
            placeholder="Enter group name..."
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Group Type
            </label>
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => setType("custom")}
                className={`flex-1 py-2 px-3 rounded-lg border transition-colors ${
                  type === "custom"
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                    : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                Custom
              </button>
              <button
                type="button"
                onClick={() => setType("container")}
                className={`flex-1 py-2 px-3 rounded-lg border transition-colors ${
                  type === "container"
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                    : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                Container
              </button>
            </div>
          </div>

          {type === "container" && (
            <CustomCombobox
              label="Select Container"
              value={selectedContainer}
              options={containerOptions}
              onChange={(value) => {
                if (typeof value === "string") {
                  setSelectedContainer(value);
                }
              }}
              placeholder="Choose a container..."
              required
            />
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Color
            </label>
            <div className="flex flex-wrap gap-2">
              {colorOptions.map((colorOption) => (
                <button
                  key={colorOption}
                  type="button"
                  onClick={() => setColor(colorOption)}
                  className={`w-8 h-8 rounded-full border-2 transition-transform ${
                    color === colorOption
                      ? "border-gray-900 dark:border-white scale-110"
                      : "border-gray-300 dark:border-gray-600 hover:scale-105"
                  }`}
                  style={{ backgroundColor: colorOption }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Icon
            </label>
            <div className="flex flex-wrap gap-2">
              {iconOptions.map((iconOption) => (
                <button
                  key={iconOption}
                  type="button"
                  onClick={() => setIcon(iconOption)}
                  className={`w-10 h-10 rounded-lg border text-lg transition-transform ${
                    icon === iconOption
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 scale-110"
                      : "border-gray-300 dark:border-gray-600 hover:scale-105"
                  }`}
                >
                  {iconOption}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-4 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                !name.trim() || (type === "container" && !selectedContainer)
              }
              className="flex-1 py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {mode === "create" ? "Create Group" : "Update Group"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GroupModal;
