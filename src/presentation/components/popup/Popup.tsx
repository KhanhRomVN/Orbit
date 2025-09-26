import React, { useState, useEffect } from "react";
import ClipboardTreeView from "./ClipboardTreeView";
import ClipboardContentViewer from "./ClipboardContentViewer";
import CreateClipboardItemModal from "./CreateClipboardItemModal";
import { ClipboardFolder, ClipboardItem } from "../../../types/clipboard";
import { clipboardStorage } from "@/shared/utils/clipboard-storage";
import { logger } from "@/shared/utils/logger";
import {
  Search,
  Filter,
  RefreshCw,
  Loader,
  AlertCircle,
  Plus,
  X,
} from "lucide-react";

const Popup: React.FC = () => {
  const [folders, setFolders] = useState<ClipboardFolder[]>([]);
  const [items, setItems] = useState<ClipboardItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<ClipboardItem | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<
    "all" | "text" | "image" | "url" | "html" | "favorite"
  >("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createModalFolderId, setCreateModalFolderId] = useState<
    string | undefined
  >(undefined);

  // Load data on component mount
  useEffect(() => {
    loadClipboardData();
    logger.info("Popup component mounted");
  }, []);

  const loadClipboardData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      logger.info("Loading clipboard data...");

      const [loadedFolders, loadedItems] = await Promise.all([
        clipboardStorage.getClipboardFolders(),
        clipboardStorage.getClipboardItems(),
      ]);

      setFolders(loadedFolders);
      setItems(loadedItems);
      logger.info(
        `Loaded ${loadedItems.length} items and ${loadedFolders.length} folders`
      );

      // If an item was selected and still exists, keep it selected
      if (selectedItem) {
        const stillExists = loadedItems.find(
          (item) => item.id === selectedItem.id
        );
        if (!stillExists) {
          setSelectedItem(null);
          logger.debug("Previously selected item no longer exists");
        }
      }
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to load clipboard data";
      setError(errorMsg);
      logger.error("Failed to load clipboard data", err);
    } finally {
      setIsLoading(false);
    }
  };

  const addClipboardItem = async (
    itemData: Omit<ClipboardItem, "id" | "timestamp">
  ) => {
    try {
      const newItem = await clipboardStorage.addClipboardItem(itemData);
      setItems((prev) => [newItem, ...prev.slice(0, 999)]);
      logger.info(`Added new clipboard item: ${newItem.title}`);
      return newItem;
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to add clipboard item";
      setError(errorMsg);
      logger.error("Failed to add clipboard item", err);
      return null;
    }
  };

  const handleSelectItem = (item: ClipboardItem) => {
    setSelectedItem(item);
    logger.debug(`Selected item: ${item.title}`);
  };

  const handleDeleteItem = async (id: string) => {
    try {
      const success = await clipboardStorage.deleteClipboardItem(id);
      if (success) {
        setItems((prev) => prev.filter((item) => item.id !== id));
        if (selectedItem?.id === id) {
          setSelectedItem(null);
        }
        logger.info(`Deleted clipboard item: ${id}`);
      }
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to delete item";
      setError(errorMsg);
      logger.error("Failed to delete item", err);
    }
  };

  const handleDeleteFolder = async (id: string) => {
    try {
      const success = await clipboardStorage.deleteFolder(id);
      if (success) {
        await loadClipboardData(); // Reload to update tree structure
        logger.info(`Deleted folder: ${id}`);
      }
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to delete folder";
      setError(errorMsg);
      logger.error("Failed to delete folder", err);
    }
  };

  const handleCreateFolder = async (name: string, parentId?: string) => {
    try {
      await clipboardStorage.createFolder(name, parentId);
      await loadClipboardData(); // Reload to update tree structure
      logger.info(`Created folder: ${name}`);
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to create folder";
      setError(errorMsg);
      logger.error("Failed to create folder", err);
    }
  };

  const handleToggleFolder = async (id: string) => {
    const updateFolderExpanded = (
      folders: ClipboardFolder[]
    ): ClipboardFolder[] => {
      return folders.map((folder) => {
        if (folder.id === id) {
          return { ...folder, expanded: !folder.expanded };
        }
        if (folder.children.length > 0) {
          return { ...folder, children: updateFolderExpanded(folder.children) };
        }
        return folder;
      });
    };

    const updatedFolders = updateFolderExpanded(folders);
    setFolders(updatedFolders);
    await clipboardStorage.saveClipboardFolders(updatedFolders);
    logger.debug(`Toggled folder: ${id}`);
  };

  const handleCopyToClipboard = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      logger.info("Content copied to clipboard");
    } catch (err) {
      setError("Failed to copy to clipboard");
      logger.error("Failed to copy to clipboard", err);
    }
  };

  const handleUpdateItem = async (
    id: string,
    updates: Partial<ClipboardItem>
  ) => {
    try {
      const updatedItems = items.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      );
      setItems(updatedItems);
      await clipboardStorage.saveClipboardItems(updatedItems);

      if (selectedItem?.id === id) {
        setSelectedItem({ ...selectedItem, ...updates });
      }
      logger.info(`Updated item: ${id}`);
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to update item";
      setError(errorMsg);
      logger.error("Failed to update item", err);
    }
  };

  const handleToggleFavorite = async (id: string) => {
    try {
      // First, remove favorite from all other items
      const updatedItems = items.map((item) => ({
        ...item,
        isFavorite: item.id === id ? !item.isFavorite : false,
      }));

      setItems(updatedItems);
      await clipboardStorage.saveClipboardItems(updatedItems);

      if (selectedItem?.id === id) {
        setSelectedItem({
          ...selectedItem,
          isFavorite: !selectedItem.isFavorite,
        });
      }
      logger.info(`Toggled favorite for item: ${id}`);
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to toggle favorite";
      setError(errorMsg);
      logger.error("Failed to toggle favorite", err);
    }
  };

  const handleCreateItem = async (itemData: {
    title: string;
    content: string;
    type: ClipboardItem["type"];
    folderId?: string;
  }) => {
    const newItem = await addClipboardItem({
      ...itemData,
      size: new Blob([itemData.content]).size,
    });

    if (newItem) {
      setShowCreateModal(false);
      setCreateModalFolderId(undefined);
      setSelectedItem(newItem);
    }
  };

  const handleCreateItemInFolder = (folderId?: string) => {
    setCreateModalFolderId(folderId);
    setShowCreateModal(true);
    logger.debug(`Creating item in folder: ${folderId || "root"}`);
  };

  // Filter items based on search and type
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      searchTerm === "" ||
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.content.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType =
      filterType === "all" ||
      (filterType === "favorite" ? item.isFavorite : item.type === filterType);

    return matchesSearch && matchesType;
  });

  if (isLoading) {
    return (
      <div className="w-[800px] h-[600px] bg-drawer-background text-text-primary flex items-center justify-center">
        <div className="text-center">
          <Loader className="animate-spin h-8 w-8 mb-4 mx-auto text-primary" />
          <p className="text-text-secondary">Loading clipboard data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-[800px] h-[600px] bg-drawer-background text-text-primary flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border-default">
        <h1 className="text-xl font-semibold">ShortcutPaste</h1>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm transition-colors"
          >
            <Plus size={14} />
            Create Item
          </button>

          <button
            onClick={loadClipboardData}
            className="flex items-center gap-2 px-3 py-1.5 bg-button-second-bg hover:bg-button-second-bg-hover rounded-lg text-sm transition-colors"
          >
            <RefreshCw size={14} />
            Refresh
          </button>

          <button
            onClick={() => window.close()}
            className="flex items-center gap-2 px-3 py-1.5 bg-button-second-bg hover:bg-button-second-bg-hover rounded-lg text-sm transition-colors"
          >
            <X size={14} />
            Close
          </button>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex items-center gap-3 p-4 border-b border-border-default">
        <div className="flex-1 relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-secondary"
          />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search clipboard items..."
            className="w-full pl-10 pr-4 py-2 bg-input-background border border-border-default rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter size={16} className="text-text-secondary" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="bg-input-background border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Types</option>
            <option value="text">Text</option>
            <option value="image">Images</option>
            <option value="url">URLs</option>
            <option value="html">HTML</option>
            <option value="favorite">Favorites</option>
          </select>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
          <AlertCircle size={16} className="text-red-500" />
          <span className="text-sm text-red-700 dark:text-red-400">
            {error}
          </span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-500 hover:text-red-700"
          >
            ×
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Tree View */}
        <div className="w-72 border-r border-border-default bg-sidebar-background">
          <ClipboardTreeView
            folders={folders}
            items={filteredItems}
            selectedItemId={selectedItem?.id}
            onSelectItem={handleSelectItem}
            onDeleteItem={handleDeleteItem}
            onDeleteFolder={handleDeleteFolder}
            onCreateFolder={handleCreateFolder}
            onToggleFolder={handleToggleFolder}
            onToggleFavorite={handleToggleFavorite}
            onCreateItemInFolder={handleCreateItemInFolder}
          />
        </div>

        {/* Right Panel - Content Viewer */}
        <div className="flex-1 p-3 flex">
          <ClipboardContentViewer
            item={selectedItem}
            onCopyToClipboard={handleCopyToClipboard}
            onUpdateItem={handleUpdateItem}
            onToggleFavorite={handleToggleFavorite}
          />
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between p-2 border-t border-border-default bg-sidebar-background text-xs text-text-secondary">
        <span>{filteredItems.length} items</span>
        <span>Last updated: {new Date().toLocaleTimeString()}</span>
      </div>

      {/* Create Item Modal */}
      {showCreateModal && (
        <CreateClipboardItemModal
          folders={folders}
          onCreateItem={handleCreateItem}
          onClose={() => {
            setShowCreateModal(false);
            setCreateModalFolderId(undefined);
          }}
          initialFolderId={createModalFolderId}
        />
      )}
    </div>
  );
};

export default Popup;
