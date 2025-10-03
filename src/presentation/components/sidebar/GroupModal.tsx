// File: src/presentation/components/sidebar/GroupModal.tsx
import React, { useState, useEffect } from "react";
import { TabGroup, BrowserContainer } from "@/types/tab-group";
import CustomCombobox from "../common/CustomCombobox";
import CustomInput from "../common/CustomInput";
import CustomModal from "../common/CustomModal";

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
  const [containers, setContainers] = useState<BrowserContainer[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadContainers();
      if (mode === "edit" && group) {
        setName(group.name);
        setType(group.type);
        if (group.containerId) {
          setSelectedContainer(group.containerId);
        }
      } else {
        // Reset form for create mode
        setName("");
        setType("custom");
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

    setIsLoading(true);

    const groupData: Omit<TabGroup, "id" | "tabs" | "createdAt"> = {
      name: name.trim(),
      type,
      color: "#3B82F6", // Default color
      icon: "📦", // Default icon
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
        onClose();
      }
    } catch (error) {
      console.error("Failed to save group:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const containerOptions = containers.map((container) => ({
    value: container.cookieStoreId,
    label: container.name,
  }));

  const groupTypeOptions = [
    { value: "custom", label: "Custom" },
    { value: "container", label: "Container" },
  ];

  return (
    <CustomModal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === "create" ? "Create New Group" : "Edit Group"}
      size="md"
      actionText={mode === "create" ? "Create Group" : "Update Group"}
      onAction={handleSubmit}
      actionDisabled={
        !name.trim() || (type === "container" && !selectedContainer)
      }
      actionLoading={isLoading}
      cancelText="Cancel"
      hideFooter={false}
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <CustomInput
          label="Group Name"
          value={name}
          onChange={setName}
          required
          placeholder="Enter group name..."
          variant="primary"
          size="sm"
          disabled={type === "container"}
        />

        <CustomCombobox
          label="Group Type"
          value={type}
          options={groupTypeOptions}
          onChange={(value) => {
            if (typeof value === "string") {
              setType(value as "custom" | "container");
            }
          }}
          placeholder="Select group type..."
          required
          size="sm"
        />

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
            size="sm"
          />
        )}
      </form>
    </CustomModal>
  );
};

export default GroupModal;
