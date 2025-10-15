import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { TabGroup, BrowserContainer } from "@/types/tab-group";
import CustomCombobox from "../common/CustomCombobox";
import CustomInput from "../common/CustomInput";
import MotionCustomDrawer from "../common/CustomDrawer";
import CustomButton from "../common/CustomButton";
import { getBrowserAPI } from "../../../shared/lib/browser-api";

interface GroupDrawerProps {
  isOpen: boolean;
  mode: "create" | "edit";
  group?: TabGroup;
  onClose: () => void;
  onGroupCreated: (group: TabGroup) => void;
  onGroupUpdated: (group: TabGroup) => void;
}

const GroupDrawer: React.FC<GroupDrawerProps> = ({
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
  const [existingGroups, setExistingGroups] = useState<TabGroup[]>([]);
  const [nameError, setNameError] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      loadContainers();
      loadExistingGroups();
      if (mode === "edit" && group) {
        setName(group.name);
        setType(group.type);
        if (group.containerId) {
          setSelectedContainer(group.containerId);
        }
      } else {
        setName("");
        setType("custom");
        setSelectedContainer("");
      }
      setNameError("");
    }
  }, [isOpen, mode, group]);

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

  const loadExistingGroups = async () => {
    try {
      const browserAPI = getBrowserAPI();
      const result = await browserAPI.storage.local.get(["tabGroups"]);
      setExistingGroups(result.tabGroups || []);
    } catch (error) {
      console.error("Failed to load existing groups:", error);
      setExistingGroups([]);
    }
  };

  const validateGroupName = (inputName: string): string => {
    const trimmedName = inputName.trim();

    if (!trimmedName) {
      return "Group name is required";
    }

    if (trimmedName.length > 50) {
      return "Group name must not exceed 50 characters";
    }

    // Check duplicate (ignore current group in edit mode)
    const isDuplicate = existingGroups.some(
      (g) =>
        g.name.toLowerCase() === trimmedName.toLowerCase() && g.id !== group?.id
    );

    if (isDuplicate) {
      return "A group with this name already exists";
    }

    return "";
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (type === "custom") {
      const error = validateGroupName(value);
      setNameError(error);
    }
  };

  const loadContainers = async () => {
    try {
      const browserAPI = getBrowserAPI();

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
    e?.preventDefault();

    // Validate name for custom groups
    if (type === "custom") {
      const error = validateGroupName(name);
      if (error) {
        setNameError(error);
        return;
      }
    }

    if (!name.trim()) return;

    setIsLoading(true);

    const groupData: Omit<TabGroup, "id" | "tabs" | "createdAt"> = {
      name: name.trim(),
      type,
      color: "#3B82F6",
      icon: "📦",
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
                if (chrome.runtime.lastError) {
                  console.error(
                    "[GroupDrawer] ❌ Chrome runtime error:",
                    chrome.runtime.lastError
                  );
                  reject(new Error(chrome.runtime.lastError.message));
                  return;
                }

                if (response?.error) {
                  console.error(
                    "[GroupDrawer] ❌ Service worker error:",
                    response.error
                  );
                  reject(new Error(response.error));
                  return;
                }

                if (!response || !response.id) {
                  console.error("[GroupDrawer] ❌ Invalid response:", response);
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
          console.error("[GroupDrawer] ❌ Create group failed:", error);
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
      console.error("[GroupDrawer] ❌ Failed to save group:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const containerOptions = containers
    .filter((container) => {
      // Ẩn các container đã được tạo thành group (trừ group đang edit)
      const isUsed = existingGroups.some(
        (g) =>
          g.type === "container" &&
          g.containerId === container.cookieStoreId &&
          g.id !== group?.id
      );
      return !isUsed;
    })
    .map((container) => ({
      value: container.cookieStoreId,
      label: container.name,
    }));

  const groupTypeOptions = [
    { value: "custom", label: "Custom" },
    { value: "container", label: "Container" },
  ];

  const handleTypeChange = (value: string | string[]) => {
    const newType = (Array.isArray(value) ? value[0] : value) as
      | "custom"
      | "container";
    setType(newType);
    setNameError("");

    if (newType === "container" && !selectedContainer) {
      setName("");
    } else if (newType === "custom") {
      // Re-validate when switching to custom
      const error = validateGroupName(name);
      setNameError(error);
    }
  };

  const handleContainerChange = (value: string | string[]) => {
    setSelectedContainer(Array.isArray(value) ? value[0] : value);
  };

  const drawerContent = (
    <MotionCustomDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={mode === "create" ? "Create New Group" : "Edit Group"}
      direction="right"
      size="full"
      animationType="slide"
      enableBlur={false}
      closeOnOverlayClick={true}
      showCloseButton={true}
      footerActions={
        <>
          <CustomButton variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </CustomButton>
          <CustomButton
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={
              !name.trim() || (type === "container" && !selectedContainer)
            }
            loading={isLoading}
          >
            {mode === "create" ? "Create Group" : "Update Group"}
          </CustomButton>
        </>
      }
    >
      <div className="h-full overflow-y-auto bg-drawer-background">
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <CustomInput
            label="Group Name"
            value={name}
            onChange={handleNameChange}
            required
            placeholder="Enter group name..."
            variant="primary"
            size="sm"
            disabled={type === "container"}
            maxLength={50}
            showCharCount={type === "custom"}
            error={nameError}
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
            <>
              <CustomCombobox
                label="Select Container"
                value={selectedContainer}
                options={containerOptions}
                onChange={handleContainerChange}
                placeholder="Choose a container..."
                required
                size="sm"
              />
              {containerOptions.length === 0 && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    All containers are already used. Please create a new
                    container in Firefox settings first.
                  </p>
                </div>
              )}
            </>
          )}
        </form>
      </div>
    </MotionCustomDrawer>
  );

  return isOpen ? createPortal(drawerContent, document.body) : null;
};

export default GroupDrawer;
