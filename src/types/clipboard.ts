// src/types/clipboard.ts

export interface ClipboardItem {
    id: string;
    content: string;
    type: 'text' | 'html' | 'image' | 'url';
    title: string;
    timestamp: number;
    folderId?: string;
    size: number;
    preview?: string;
    isFavorite?: boolean; // New favorite property
}

export interface ClipboardFolder {
    id: string;
    name: string;
    parentId?: string;
    children: ClipboardFolder[];
    items: ClipboardItem[];
    createdAt: number;
    expanded: boolean;
}