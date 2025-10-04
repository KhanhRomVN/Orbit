// File: src/presentation/components/sidebar/GroupModal.tsx
import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { TabGroup, BrowserContainer } from "@/types/tab-group";
import CustomCombobox from "../common/CustomCombobox";
import CustomInput from "../common/CustomInput";
import CustomModal from "../common/CustomModal";
import { getBrowserAPI } from "../../../shared/lib/browser-api";

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

  // THÊM: Tự động điền tên group khi chọn container
  useEffect(() => {
    if (type === "container" && selectedContainer) {
      const selectedContainerObj = containers.find(
        (container) => container.cookieStoreId === selectedContainer
      );
      if (selectedContainerObj) {
        setName(selectedContainerObj.name);
      }
    }
  }, [selectedContainer, type, containers]);

  const loadContainers = async () => {
    try {
      const browserAPI = getBrowserAPI();

      // Kiểm tra nếu browser hỗ trợ contextualIdentities
      if (
        browserAPI.contextualIdentities &&
        typeof browserAPI.contextualIdentities.query === "function"
      ) {
        const containers = await browserAPI.contextualIdentities.query({});
        setContainers(containers || []);
      } else {
        console.warn("Contextual identities not supported in this browser");
        setContainers([]);
      }
    } catch (error) {
      console.error("Failed to load containers:", error);
      setContainers([]);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault(); // Optional chaining
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
                  console.error(
                    "[GroupModal] ❌ Chrome runtime error:",
                    chrome.runtime.lastError
                  );
                  reject(new Error(chrome.runtime.lastError.message));
                  return;
                }

                // Kiểm tra response có error từ service worker
                if (response?.error) {
                  console.error(
                    "[GroupModal] ❌ Service worker error:",
                    response.error
                  );
                  reject(new Error(response.error));
                  return;
                }

                // Kiểm tra response hợp lệ
                if (!response || !response.id) {
                  console.error("[GroupModal] ❌ Invalid response:", response);
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
          console.error("[GroupModal] ❌ Create group failed:", error);
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
      console.error("[GroupModal] ❌ Failed to save group:", error);
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

  // THÊM: Xử lý khi thay đổi type
  const handleTypeChange = (value: string) => {
    const newType = value as "custom" | "container";
    setType(newType);

    // Nếu chuyển từ container sang custom, giữ nguyên tên hiện tại
    // Nếu chuyển từ custom sang container, reset tên nếu chưa có container được chọn
    if (newType === "container" && !selectedContainer) {
      setName("");
    }
  };

  // THÊM: Xử lý khi thay đổi container
  const handleContainerChange = (value: string) => {
    setSelectedContainer(value);
    // Tên sẽ tự động được cập nhật qua useEffect ở trên
  };

  const modalContent = (
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
          disabled={type === "container"} // VÔ HIỆU HÓA input khi là container type
        />

        <CustomCombobox
          label="Group Type"
          value={type}
          options={groupTypeOptions}
          onChange={handleTypeChange}
          placeholder="Select group type..."
          required
          size="sm"
        />

        {type === "container" && (
          <CustomCombobox
            label="Select Container"
            value={selectedContainer}
            options={containerOptions}
            onChange={handleContainerChange}
            placeholder="Choose a container..."
            required
            size="sm"
          />
        )}
      </form>
    </CustomModal>
  );

  // Sử dụng portal để render modal ra ngoài phạm vi của zoom
  return isOpen ? createPortal(modalContent, document.body) : null;
};

export default GroupModal;
