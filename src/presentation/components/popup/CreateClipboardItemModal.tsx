import React, { useState, useEffect } from "react";
import {
  X,
  FileText,
  Image,
  Link,
  Code,
  Clipboard,
  Folder,
  Type,
  Shield,
  AlertTriangle,
} from "lucide-react";
import { ClipboardFolder, ClipboardItem } from "../../../types/clipboard";
import { sanitizeHTML, isSafeHTML } from "../../../shared/utils/html-sanitizer";

interface CreateClipboardItemModalProps {
  folders: ClipboardFolder[];
  onCreateItem: (itemData: {
    title: string;
    content: string;
    type: ClipboardItem["type"];
    folderId?: string;
  }) => Promise<void>;
  onClose: () => void;
  initialFolderId?: string;
}

const CreateClipboardItemModal: React.FC<CreateClipboardItemModalProps> = ({
  folders,
  onCreateItem,
  onClose,
  initialFolderId,
}) => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState<ClipboardItem["type"]>("text");
  const [folderId, setFolderId] = useState(initialFolderId || "");
  const [isCreating, setIsCreating] = useState(false);
  const [autoDetectType, setAutoDetectType] = useState(true);
  const [htmlSafety, setHtmlSafety] = useState<{
    isSafe: boolean;
    sanitizedContent: string;
  } | null>(null);

  // Auto-detect content type when content changes
  useEffect(() => {
    if (content.trim() && autoDetectType) {
      const detectedType = detectContentType(content);
      setType(detectedType);

      // Auto-generate title if empty
      if (!title.trim()) {
        setTitle(generateTitle(content));
      }

      // Check HTML safety if content is HTML
      if (detectedType === "html") {
        const isSafe = isSafeHTML(content);
        const sanitizedContent = sanitizeHTML(content);
        setHtmlSafety({ isSafe, sanitizedContent });
      } else {
        setHtmlSafety(null);
      }
    }
  }, [content, autoDetectType, title]);

  const detectContentType = (content: string): ClipboardItem["type"] => {
    const trimmedContent = content.trim();

    if (trimmedContent.startsWith("data:image/")) {
      return "image";
    }

    if (
      trimmedContent.startsWith("http://") ||
      trimmedContent.startsWith("https://") ||
      trimmedContent.startsWith("ftp://")
    ) {
      return "url";
    }

    if (
      trimmedContent.includes("<") &&
      trimmedContent.includes(">") &&
      (trimmedContent.includes("<html") ||
        trimmedContent.includes("</") ||
        trimmedContent.includes("<div") ||
        trimmedContent.includes("<p") ||
        trimmedContent.includes("<span"))
    ) {
      return "html";
    }

    return "text";
  };

  const generateTitle = (content: string, maxLength = 50): string => {
    const firstLine = content.split("\n")[0].trim();
    if (firstLine.length === 0) {
      return `New ${type} item`;
    }
    if (firstLine.length <= maxLength) {
      return firstLine;
    }
    return firstLine.substring(0, maxLength) + "...";
  };

  const handleAutoFill = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      if (clipboardText.trim()) {
        setContent(clipboardText);
      }
    } catch (err) {
      // Clipboard access denied, ignore
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !content.trim()) {
      return;
    }

    setIsCreating(true);
    try {
      // For HTML content, use sanitized version if original is unsafe
      let finalContent = content.trim();
      if (type === "html" && htmlSafety && !htmlSafety.isSafe) {
        // Ask user confirmation for unsafe HTML
        const useSafe = confirm(
          "This HTML content contains potentially unsafe elements. Would you like to save the sanitized version instead?"
        );
        if (useSafe) {
          finalContent = htmlSafety.sanitizedContent;
        }
      }

      await onCreateItem({
        title: title.trim(),
        content: finalContent,
        type,
        folderId: folderId || undefined,
      });
    } finally {
      setIsCreating(false);
    }
  };

  const renderFolderOptions = (
    folders: ClipboardFolder[],
    level = 0
  ): JSX.Element[] => {
    const options: JSX.Element[] = [];

    folders.forEach((folder) => {
      const indent = "  ".repeat(level);
      options.push(
        <option key={folder.id} value={folder.id}>
          {indent}
          {folder.name}
        </option>
      );

      if (folder.children.length > 0) {
        options.push(...renderFolderOptions(folder.children, level + 1));
      }
    });

    return options;
  };

  const getTypeIcon = (type: ClipboardItem["type"]) => {
    switch (type) {
      case "image":
        return <Image size={16} className="text-blue-500" />;
      case "url":
        return <Link size={16} className="text-green-500" />;
      case "html":
        return <Code size={16} className="text-orange-500" />;
      default:
        return <FileText size={16} className="text-gray-500" />;
    }
  };

  const renderSafeHTMLPreview = () => {
    if (!htmlSafety || type !== "html") return null;

    return (
      <div className="space-y-3">
        {/* Safety warning */}
        {!htmlSafety.isSafe && (
          <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
            <AlertTriangle
              size={16}
              className="text-yellow-600 dark:text-yellow-400"
            />
            <div className="text-sm text-yellow-800 dark:text-yellow-200">
              <div className="font-medium">Unsafe HTML detected</div>
              <div>
                This content contains potentially dangerous elements that will
                be sanitized.
              </div>
            </div>
          </div>
        )}

        {/* Safe preview */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
            <Shield size={14} className="text-green-500" />
            Safe HTML Preview:
          </div>
          <div className="p-3 bg-white dark:bg-gray-800 border border-border-default rounded max-h-32 overflow-auto">
            <div
              dangerouslySetInnerHTML={{ __html: htmlSafety.sanitizedContent }}
            />
          </div>
        </div>
      </div>
    );
  };

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-drawer-background z-50 flex flex-col">
      {/* Header - Fixed at top */}
      <div className="flex items-center justify-between p-4 border-b border-border-default bg-dialog-background shadow-sm">
        <h2 className="text-lg font-semibold text-text-primary">
          Create Clipboard Item
        </h2>
        <button
          onClick={onClose}
          className="p-1 hover:bg-button-second-bg-hover rounded-lg transition-colors"
        >
          <X size={18} className="text-text-secondary" />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 max-w-3xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title Field */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter item title..."
                className="w-full px-3 py-2 bg-input-background border border-border-default rounded text-text-primary focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                required
                autoFocus
              />
            </div>

            {/* Content Field */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-text-primary">
                  Content *
                </label>
                <button
                  type="button"
                  onClick={handleAutoFill}
                  className="flex items-center gap-2 px-3 py-1 text-xs bg-primary/10 hover:bg-primary/20 text-primary rounded transition-colors"
                >
                  <Clipboard size={12} />
                  Paste from Clipboard
                </button>
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Enter or paste content here..."
                rows={10}
                className="w-full px-3 py-2 bg-input-background border border-border-default rounded text-text-primary font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>

            {/* Type Selection */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Type
              </label>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="auto-detect"
                    checked={autoDetectType}
                    onChange={(e) => setAutoDetectType(e.target.checked)}
                    className="w-4 h-4 text-primary focus:ring-primary rounded"
                  />
                  <label
                    htmlFor="auto-detect"
                    className="text-sm text-text-secondary"
                  >
                    Auto-detect type from content
                  </label>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 px-3 py-2 bg-input-background border border-border-default rounded">
                    <Type size={14} className="text-primary" />
                    <span className="text-sm text-text-secondary">
                      Selected:
                    </span>
                    {getTypeIcon(type)}
                    <span className="text-sm font-medium text-text-primary capitalize">
                      {type}
                    </span>
                  </div>

                  <select
                    value={type}
                    onChange={(e) => {
                      setType(e.target.value as ClipboardItem["type"]);
                      setAutoDetectType(false);
                    }}
                    disabled={autoDetectType}
                    className="px-3 py-2 bg-input-background border border-border-default rounded text-text-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    <option value="text">Text</option>
                    <option value="html">HTML</option>
                    <option value="url">URL</option>
                    <option value="image">Image</option>
                  </select>
                </div>
              </div>
            </div>

            {/* HTML Safety Check */}
            {renderSafeHTMLPreview()}

            {/* Folder Selection */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Folder {initialFolderId ? "(Pre-selected)" : "(Optional)"}
              </label>
              <div className="flex items-center gap-2">
                <Folder
                  size={16}
                  className="text-text-secondary flex-shrink-0"
                />
                <select
                  value={folderId}
                  onChange={(e) => setFolderId(e.target.value)}
                  className="flex-1 px-3 py-2 bg-input-background border border-border-default rounded text-text-primary focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                >
                  <option value="">Root (No Folder)</option>
                  {renderFolderOptions(folders)}
                </select>
              </div>
            </div>

            {/* Preview */}
            {content.trim() && (
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Preview
                </label>
                <div className="p-3 bg-sidebar-background border border-border-default rounded">
                  <div className="flex items-center gap-2 mb-2">
                    {getTypeIcon(type)}
                    <span className="font-medium text-text-primary text-sm">
                      {title || "Untitled"}
                    </span>
                    {type === "html" && htmlSafety && !htmlSafety.isSafe && (
                      <AlertTriangle size={14} className="text-yellow-500" />
                    )}
                  </div>
                  <div className="text-xs text-text-secondary">
                    {type === "image" && content.startsWith("data:image") ? (
                      <div className="text-center py-4">
                        <Image
                          size={24}
                          className="mx-auto text-blue-500 mb-2"
                        />
                        <span>
                          Image content ({Math.round(content.length / 1024)}KB)
                        </span>
                      </div>
                    ) : (
                      <div className="max-h-24 overflow-y-auto">
                        <pre className="whitespace-pre-wrap break-words font-mono">
                          {content.substring(0, 300)}
                          {content.length > 300 && "..."}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Footer - Fixed at bottom */}
      <div className="flex items-center justify-end gap-3 p-4 border-t border-border-default bg-dialog-background shadow-sm">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 bg-button-second-bg hover:bg-button-second-bg-hover text-text-primary rounded transition-colors text-sm"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={isCreating || !title.trim() || !content.trim()}
          className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-w-[100px] justify-center text-sm"
        >
          {isCreating ? (
            <>
              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Creating...
            </>
          ) : (
            "Create Item"
          )}
        </button>
      </div>
    </div>
  );
};

export default CreateClipboardItemModal;
