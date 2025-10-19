// File: /home/khanhromvn/Documents/Coding/Orbit/src/presentation/components/sidebar/SortGroupDrawer.tsx

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { GripVertical, Check } from "lucide-react";
import MotionCustomDrawer from "../common/CustomDrawer";
import CustomButton from "../common/CustomButton";
import { TabGroup } from "../../../types/tab-group";
import { getBrowserAPI } from "@/shared/lib/browser-api";

interface SortGroupDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DragItem {
  id: string;
  type: string;
  index: number;
}

const DraggableGroupItem: React.FC<{
  group: TabGroup;
  index: number;
  moveGroup: (fromIndex: number, toIndex: number) => void;
}> = ({ group, index, moveGroup }) => {
  const groupRef = React.useRef<HTMLDivElement>(null);
  const gapRef = React.useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag] = useDrag(() => ({
    type: "GROUP",
    item: { id: group.id, type: "GROUP", index },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }));

  // Drop zone CHO GROUP (swap)
  const [{ isOverGroup }, dropGroup] = useDrop(() => ({
    accept: "GROUP",
    drop: (item: DragItem) => {
      if (item.index !== index) {
        moveGroup(item.index, index);
      }
    },
    collect: (monitor) => ({
      isOverGroup: !!monitor.isOver({ shallow: true }),
    }),
  }));

  // Drop zone CHO GAP (insert)
  const [{ isOverGap }, dropGap] = useDrop(() => ({
    accept: "GROUP",
    drop: (item: DragItem) => {
      if (item.index !== index) {
        moveGroup(item.index, index);
      }
    },
    collect: (monitor) => ({
      isOverGap: !!monitor.isOver({ shallow: true }),
    }),
  }));

  drag(dropGroup(groupRef));
  dropGap(gapRef);

  return (
    <>
      {/* Gap line - RIÊNG BIỆT */}
      {index > 0 && (
        <div
          ref={gapRef}
          className={`
            h-2 transition-all duration-200 rounded
            ${isOverGap ? "bg-blue-200 dark:bg-blue-700" : ""}
          `}
        />
      )}

      {/* Group item - RIÊNG BIỆT */}
      <div
        ref={groupRef}
        className={`
          flex items-center gap-2 px-2 py-1.5 rounded-md border transition-all duration-200
          ${isDragging ? "opacity-50" : ""}
          ${
            isOverGroup
              ? "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-600"
              : "bg-card-background border-border-default hover:border-blue-200 dark:hover:border-blue-700"
          }
        `}
      >
        <GripVertical className="w-3 h-3 text-text-secondary flex-shrink-0 cursor-grab active:cursor-grabbing" />

        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          <span className="text-xs font-medium text-text-primary truncate">
            {group.name}
          </span>
          {group.type === "container" && (
            <span className="text-[10px] text-primary px-1 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 flex-shrink-0">
              C
            </span>
          )}
        </div>
      </div>
    </>
  );
};

// Component gap line ở trên cùng (insert vào vị trí 0)
const TopGapLine: React.FC<{
  moveGroup: (fromIndex: number, toIndex: number) => void;
}> = ({ moveGroup }) => {
  const gapRef = React.useRef<HTMLDivElement>(null);

  const [{ isOverGap }, dropGap] = useDrop(() => ({
    accept: "GROUP",
    drop: (item: DragItem) => {
      // Insert vào đầu danh sách
      if (item.index !== 0) {
        moveGroup(item.index, 0);
      }
    },
    collect: (monitor) => ({
      isOverGap: !!monitor.isOver({ shallow: true }),
    }),
  }));

  dropGap(gapRef);

  return (
    <div
      ref={gapRef}
      className={`
        h-2 transition-all duration-200 rounded
        ${isOverGap ? "bg-blue-200 dark:bg-blue-700" : ""}
      `}
    />
  );
};

// Component gap line ở dưới cùng (insert vào cuối)
const BottomGapLine: React.FC<{
  moveGroup: (fromIndex: number, toIndex: number) => void;
  totalGroups: number;
}> = ({ moveGroup, totalGroups }) => {
  const gapRef = React.useRef<HTMLDivElement>(null);

  const [{ isOverGap }, dropGap] = useDrop(() => ({
    accept: "GROUP",
    drop: (item: DragItem) => {
      // Insert vào cuối danh sách
      const lastIndex = totalGroups - 1;
      if (item.index !== lastIndex) {
        moveGroup(item.index, lastIndex);
      }
    },
    collect: (monitor) => ({
      isOverGap: !!monitor.isOver({ shallow: true }),
    }),
  }));

  dropGap(gapRef);

  return (
    <div
      ref={gapRef}
      className={`
        h-2 transition-all duration-200 rounded
        ${isOverGap ? "bg-blue-200 dark:bg-blue-700" : ""}
      `}
    />
  );
};

const SortGroupDrawerContent: React.FC<SortGroupDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const [groups, setGroups] = useState<TabGroup[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadGroups();
      setHasChanges(false);
    }
  }, [isOpen]);

  const loadGroups = async () => {
    try {
      const browserAPI = getBrowserAPI();
      const result = await browserAPI.storage.local.get(["tabGroups"]);
      setGroups(result.tabGroups || []);
    } catch (error) {
      console.error("[SortGroupDrawer] Failed to load groups:", error);
    }
  };

  const moveGroup = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;

    setGroups((prevGroups) => {
      const newGroups = [...prevGroups];
      const [movedGroup] = newGroups.splice(fromIndex, 1);
      newGroups.splice(toIndex, 0, movedGroup);
      return newGroups;
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      const browserAPI = getBrowserAPI();
      await browserAPI.storage.local.set({ tabGroups: groups });

      setHasChanges(false);
      onClose();

      // ✅ RELOAD SIDEBAR để hiển thị thứ tự mới
      setTimeout(() => {
        window.location.reload();
      }, 100);
    } catch (error) {
      console.error("[SortGroupDrawer] Failed to save group order:", error);
      alert("Failed to save group order. Please try again.");
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      if (
        confirm("You have unsaved changes. Are you sure you want to cancel?")
      ) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  return (
    <MotionCustomDrawer
      isOpen={isOpen}
      onClose={handleCancel}
      title="Sort Groups"
      subtitle="Drag and drop to reorder your groups"
      direction="right"
      size="full"
      animationType="slide"
      enableBlur={false}
      closeOnOverlayClick={true}
      showCloseButton={true}
      footerActions={
        <>
          <CustomButton variant="secondary" size="sm" onClick={handleCancel}>
            Cancel
          </CustomButton>
          <CustomButton
            variant="primary"
            size="sm"
            icon={Check}
            onClick={handleSave}
            disabled={!hasChanges}
          >
            Save Order
          </CustomButton>
        </>
      }
    >
      <div className="h-full overflow-y-auto bg-drawer-background">
        <div className="p-4">
          <div className="space-y-0.5">
            {/* Gap line ở trên cùng */}
            {groups.length > 0 && <TopGapLine moveGroup={moveGroup} />}

            {groups.map((group, index) => (
              <DraggableGroupItem
                key={group.id}
                group={group}
                index={index}
                moveGroup={moveGroup}
              />
            ))}

            {/* Gap line ở dưới cùng */}
            {groups.length > 0 && (
              <BottomGapLine
                moveGroup={moveGroup}
                totalGroups={groups.length}
              />
            )}

            {groups.length === 0 && (
              <div className="text-center py-6">
                <p className="text-xs text-text-secondary">No groups to sort</p>
              </div>
            )}
          </div>

          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-md">
            <h4 className="text-xs font-medium text-text-primary mb-1.5">
              How to reorder:
            </h4>
            <ul className="text-[10px] text-text-secondary space-y-0.5">
              <li>• Drag to group = swap positions</li>
              <li>• Drag to gap = insert at position</li>
              <li>• Click "Save Order" when done</li>
            </ul>
          </div>
        </div>
      </div>
    </MotionCustomDrawer>
  );
};

const SortGroupDrawer: React.FC<SortGroupDrawerProps> = (props) => {
  return (
    <DndProvider backend={HTML5Backend}>
      {props.isOpen &&
        createPortal(<SortGroupDrawerContent {...props} />, document.body)}
    </DndProvider>
  );
};

export default SortGroupDrawer;
