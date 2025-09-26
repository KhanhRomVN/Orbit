import React, { useState } from "react";
import {
  Folder,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  FileText,
  Image,
  Link,
  Copy,
  MoreHorizontal,
  Trash2,
  Plus,
  FolderPlus,
  Heart,
} from "lucide-react";
import { ClipboardFolder, ClipboardItem } from "../../../types/clipboard";

interface ClipboardTreeViewProps {
  folders: ClipboardFolder[];
  items: ClipboardItem[];
  selectedItemId?: string;
  onSelectItem: (item: ClipboardItem) => void;
  onDeleteItem: (id: string) => void;
  onDeleteFolder: (id: string) => void;
  onCreateFolder: (name: string, parentId?: string) => void;
  onToggleFolder: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onCreateItemInFolder?: (folderId?: string) => void;
}

const ClipboardTreeView: React.FC<ClipboardTreeViewProps> = ({
  folders,
  items,
  selectedItemId,
  onSelectItem,
  onDeleteItem,
  onDeleteFolder,
  onCreateFolder,
  onToggleFolder,
  onToggleFavorite,
  onCreateItemInFolder,
}) => {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: "item" | "folder";
    target: ClipboardItem | ClipboardFolder;
  } | null>(null);

  const getItemIcon = (type: ClipboardItem["type"]) => {
    switch (type) {
      case "image":
        return <Image size={14} className="text-blue-500" />;
      case "url":
        return <Link size={14} className="text-green-500" />;
      case "html":
        return <FileText size={14} className="text-orange-500" />;
      default:
        return <FileText size={14} className="text-gray-500" />;
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
    return `${Math.round(bytes / (1024 * 1024))}MB`;
  };

  const formatTime = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return "Just now";
  };

  // Calculate total storage usage
  const calculateStorageInfo = () => {
    const totalBytes = items.reduce((sum, item) => sum + item.size, 0);
    const maxBytes = 100 * 1024;
    const usagePercentage = (totalBytes / maxBytes) * 100;

    return {
      used: totalBytes,
      max: maxBytes,
      percentage: Math.min(usagePercentage, 100),
      formattedUsed: formatFileSize(totalBytes),
      formattedMax: formatFileSize(maxBytes),
    };
  };

  const storageInfo = calculateStorageInfo();

  // Sort items: favorites first, then by timestamp
  const sortedItems = [...items].sort((a, b) => {
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;
    return b.timestamp - a.timestamp;
  });

  const handleContextMenu = (
    e: React.MouseEvent,
    type: "item" | "folder",
    target: ClipboardItem | ClipboardFolder
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type,
      target,
    });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  const handleCreateNewFolder = (parentId?: string) => {
    const name = prompt("Enter folder name:");
    if (name?.trim()) {
      onCreateFolder(name.trim(), parentId);
    }
    closeContextMenu();
  };

  const handleCreateItemInFolder = (folderId?: string) => {
    if (onCreateItemInFolder) {
      onCreateItemInFolder(folderId);
    }
    closeContextMenu();
  };

  const renderFolder = (folder: ClipboardFolder, level = 0) => {
    const folderItems = sortedItems.filter(
      (item) => item.folderId === folder.id
    );
    const hasItems = folderItems.length > 0 || folder.children.length > 0;

    return (
      <div key={folder.id} className="folder-container">
        <div
          className="flex items-center py-1 px-2 hover:bg-sidebar-item-hover rounded cursor-pointer group"
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onContextMenu={(e) => handleContextMenu(e, "folder", folder)}
        >
          {hasItems ? (
            <button
              onClick={() => onToggleFolder(folder.id)}
              className="mr-1 p-0.5 hover:bg-button-second-bg-hover rounded"
            >
              {folder.expanded ? (
                <ChevronDown size={12} />
              ) : (
                <ChevronRight size={12} />
              )}
            </button>
          ) : (
            <div className="w-5" />
          )}

          {folder.expanded ? (
            <FolderOpen size={14} className="mr-2 text-blue-500" />
          ) : (
            <Folder size={14} className="mr-2 text-blue-500" />
          )}

          <span className="flex-1 text-sm truncate">{folder.name}</span>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleContextMenu(e, "folder", folder);
            }}
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-button-second-bg-hover rounded"
          >
            <MoreHorizontal size={12} />
          </button>
        </div>

        {folder.expanded && (
          <div className="folder-content">
            {/* Render child folders */}
            {folder.children.map((child) => renderFolder(child, level + 1))}

            {/* Render items in this folder */}
            {folderItems.map((item) => (
              <div
                key={item.id}
                className={`flex items-center py-2 px-2 hover:bg-sidebar-item-hover rounded cursor-pointer group relative ${
                  selectedItemId === item.id
                    ? "bg-primary/10 border-l-2 border-primary"
                    : ""
                }`}
                style={{ paddingLeft: `${(level + 1) * 16 + 8}px` }}
                onClick={() => onSelectItem(item)}
                onContextMenu={(e) => handleContextMenu(e, "item", item)}
              >
                {getItemIcon(item.type)}
                <div className="flex-1 ml-2 min-w-0 pr-6">
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium truncate">
                      {item.title}
                    </span>
                  </div>
                  <div className="text-xs text-text-secondary flex items-center gap-2">
                    <span>{formatFileSize(item.size)}</span>
                    <span>•</span>
                    <span>{formatTime(item.timestamp)}</span>
                  </div>
                </div>

                {/* Favorite heart icon - positioned absolutely */}
                {item.isFavorite && (
                  <div className="absolute right-8 top-1/2 transform -translate-y-1/2">
                    <Heart size={14} className="text-red-500 fill-current" />
                  </div>
                )}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleContextMenu(e, "item", item);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-button-second-bg-hover rounded"
                >
                  <MoreHorizontal size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderRootItems = () => {
    const rootItems = sortedItems.filter((item) => !item.folderId);

    return rootItems.map((item) => (
      <div
        key={item.id}
        className={`flex items-center py-2 px-2 hover:bg-sidebar-item-hover rounded cursor-pointer group relative ${
          selectedItemId === item.id
            ? "bg-primary/10 border-l-2 border-primary"
            : ""
        }`}
        onClick={() => onSelectItem(item)}
        onContextMenu={(e) => handleContextMenu(e, "item", item)}
      >
        {getItemIcon(item.type)}
        <div className="flex-1 ml-2 min-w-0 pr-6">
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium truncate">{item.title}</span>
          </div>
          <div className="text-xs text-text-secondary flex items-center gap-2">
            <span>{formatFileSize(item.size)}</span>
            <span>•</span>
            <span>{formatTime(item.timestamp)}</span>
          </div>
        </div>

        {/* Favorite heart icon - positioned absolutely */}
        {item.isFavorite && (
          <div className="absolute right-8 top-1/2 transform -translate-y-1/2">
            <Heart size={14} className="text-red-500 fill-current" />
          </div>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            handleContextMenu(e, "item", item);
          }}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-button-second-bg-hover rounded"
        >
          <MoreHorizontal size={12} />
        </button>
      </div>
    ));
  };

  return (
    <div className="h-full overflow-y-auto flex flex-col">
      {/* Create Folder Button & Storage Info */}
      <div className="p-2 border-b border-border-default space-y-3">
        <button
          onClick={() => handleCreateNewFolder()}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors"
        >
          <FolderPlus size={14} />
          New Folder
        </button>

        {/* Storage Usage */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-text-secondary">
            <span>Storage Usage</span>
            <span>
              {storageInfo.formattedUsed} / {storageInfo.formattedMax}
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                storageInfo.percentage > 90
                  ? "bg-red-500"
                  : storageInfo.percentage > 70
                  ? "bg-yellow-500"
                  : "bg-primary"
              }`}
              style={{ width: `${storageInfo.percentage}%` }}
            />
          </div>
          <div className="text-xs text-text-secondary">
            {storageInfo.percentage.toFixed(1)}% used
          </div>
        </div>
      </div>

      {/* Tree Content */}
      <div className="flex-1 p-2 space-y-1 overflow-y-auto">
        {/* Render folders */}
        {folders.map((folder) => renderFolder(folder))}

        {/* Render root items */}
        {renderRootItems()}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-dropdown-background border border-border-default rounded-lg shadow-lg py-1 z-50 min-w-[180px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={closeContextMenu}
        >
          {contextMenu.type === "item" ? (
            <>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    (contextMenu.target as ClipboardItem).content
                  );
                  closeContextMenu();
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-dropdown-item-hover"
              >
                <Copy size={14} />
                Copy to Clipboard
              </button>
              <button
                onClick={() => {
                  onToggleFavorite((contextMenu.target as ClipboardItem).id);
                  closeContextMenu();
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-dropdown-item-hover"
              >
                <Heart
                  size={14}
                  className={
                    (contextMenu.target as ClipboardItem).isFavorite
                      ? "text-red-500 fill-current"
                      : "text-text-secondary"
                  }
                />
                {(contextMenu.target as ClipboardItem).isFavorite
                  ? "Remove Favorite"
                  : "Set as Favorite"}
              </button>
              <button
                onClick={() => {
                  onDeleteItem((contextMenu.target as ClipboardItem).id);
                  closeContextMenu();
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-dropdown-item-hover text-red-500"
              >
                <Trash2 size={14} />
                Delete
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() =>
                  handleCreateItemInFolder(
                    (contextMenu.target as ClipboardFolder).id
                  )
                }
                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-dropdown-item-hover"
              >
                <Plus size={14} />
                Create Clipboard Item
              </button>
              <button
                onClick={() =>
                  handleCreateNewFolder(
                    (contextMenu.target as ClipboardFolder).id
                  )
                }
                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-dropdown-item-hover"
              >
                <FolderPlus size={14} />
                New Subfolder
              </button>
              <button
                onClick={() => {
                  onDeleteFolder((contextMenu.target as ClipboardFolder).id);
                  closeContextMenu();
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-dropdown-item-hover text-red-500"
              >
                <Trash2 size={14} />
                Delete Folder
              </button>
            </>
          )}
        </div>
      )}

      {/* Click outside to close context menu */}
      {contextMenu && (
        <div className="fixed inset-0 z-40" onClick={closeContextMenu} />
      )}
    </div>
  );
};

export default ClipboardTreeView;
