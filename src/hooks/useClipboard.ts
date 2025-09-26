// src/hooks/useClipboard.ts

import { useState, useEffect, useCallback } from 'react';
import { ClipboardItem, ClipboardFolder } from '../types/clipboard';
import { clipboardStorage } from '@/shared/utils/clipboard-storage';

export const useClipboard = () => {
    const [folders, setFolders] = useState<ClipboardFolder[]>([]);
    const [items, setItems] = useState<ClipboardItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadClipboardData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const [loadedFolders, loadedItems] = await Promise.all([
                clipboardStorage.getClipboardFolders(),
                clipboardStorage.getClipboardItems()
            ]);

            setFolders(loadedFolders);
            setItems(loadedItems);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load clipboard data');
        } finally {
            setLoading(false);
        }
    }, []);

    const addClipboardItem = useCallback(async (itemData: Omit<ClipboardItem, 'id' | 'timestamp'>) => {
        try {
            const newItem = await clipboardStorage.addClipboardItem(itemData);
            setItems(prev => [newItem, ...prev.slice(0, 999)]);
            return newItem;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to add clipboard item');
            return null;
        }
    }, []);

    const deleteClipboardItem = useCallback(async (id: string) => {
        try {
            const success = await clipboardStorage.deleteClipboardItem(id);
            if (success) {
                setItems(prev => prev.filter(item => item.id !== id));
            }
            return success;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete item');
            return false;
        }
    }, []);

    const updateClipboardItem = useCallback(async (id: string, updates: Partial<ClipboardItem>) => {
        try {
            const updatedItems = items.map(item =>
                item.id === id ? { ...item, ...updates } : item
            );
            setItems(updatedItems);
            await clipboardStorage.saveClipboardItems(updatedItems);
            return true;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update item');
            return false;
        }
    }, [items]);

    const createFolder = useCallback(async (name: string, parentId?: string) => {
        try {
            await clipboardStorage.createFolder(name, parentId);
            await loadClipboardData();
            return true;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create folder');
            return false;
        }
    }, [loadClipboardData]);

    const deleteFolder = useCallback(async (id: string) => {
        try {
            const success = await clipboardStorage.deleteFolder(id);
            if (success) {
                await loadClipboardData();
            }
            return success;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete folder');
            return false;
        }
    }, [loadClipboardData]);

    const toggleFolder = useCallback(async (id: string) => {
        const updateFolderExpanded = (folders: ClipboardFolder[]): ClipboardFolder[] => {
            return folders.map(folder => {
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
    }, [folders]);

    const captureFromClipboard = useCallback(async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text.trim()) {
                const detectContentType = (content: string): ClipboardItem['type'] => {
                    if (content.startsWith('data:image/')) return 'image';
                    if (content.startsWith('http://') || content.startsWith('https://')) return 'url';
                    if (content.includes('<') && content.includes('>')) return 'html';
                    return 'text';
                };

                const generateTitle = (content: string, maxLength = 50): string => {
                    const firstLine = content.split('\n')[0].trim();
                    if (firstLine.length <= maxLength) return firstLine;
                    return firstLine.substring(0, maxLength) + '...';
                };

                await addClipboardItem({
                    content: text,
                    type: detectContentType(text),
                    title: generateTitle(text),
                    size: new Blob([text]).size
                });
            }
        } catch (err) {
            // Clipboard access might be denied, ignore silently
        }
    }, [addClipboardItem]);

    useEffect(() => {
        loadClipboardData();
    }, [loadClipboardData]);

    return {
        folders,
        items,
        loading,
        error,
        loadClipboardData,
        addClipboardItem,
        deleteClipboardItem,
        updateClipboardItem,
        createFolder,
        deleteFolder,
        toggleFolder,
        captureFromClipboard,
        clearError: () => setError(null)
    };
};