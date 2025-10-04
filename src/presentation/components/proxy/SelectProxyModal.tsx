// File: src/presentation/components/proxy/SelectProxyModal.tsx
import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import CustomModal from "../common/CustomModal";
import CustomCombobox from "../common/CustomCombobox";
import CreateProxyModal from "./CreateProxyModal";
import { ProxyConfig, ProxyType } from "@/types/proxy";
import { ProxyManager } from "../../../shared/lib/proxy-manager";
import { Plus, Trash2, Edit } from "lucide-react";

interface SelectProxyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProxySelected: (proxyId: string) => void;
  currentProxyId?: string;
  targetType: "group" | "tab";
}

const SelectProxyModal: React.FC<SelectProxyModalProps> = ({
  isOpen,
  onClose,
  onProxySelected,
  currentProxyId,
  targetType,
}) => {
  const [selectedType, setSelectedType] = useState<ProxyType | "">("");
  const [selectedProxyId, setSelectedProxyId] = useState("");
  const [proxies, setProxies] = useState<ProxyConfig[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProxy, setEditingProxy] = useState<ProxyConfig | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  const proxyTypeOptions = [
    { value: "http", label: "HTTP" },
    { value: "https", label: "HTTPS" },
    { value: "socks5", label: "SOCKS5" },
  ];

  useEffect(() => {
    if (isOpen) {
      loadProxies();
      if (currentProxyId) {
        setSelectedProxyId(currentProxyId);
      }
    }
  }, [isOpen, currentProxyId]);

  const loadProxies = async () => {
    const allProxies = await ProxyManager.getProxies();
    setProxies(allProxies);
  };

  const filteredProxies = selectedType
    ? proxies.filter((p) => p.type === selectedType)
    : [];

  const proxyOptions = filteredProxies.map((proxy) => ({
    value: proxy.id,
    label: `${proxy.name} (${proxy.address}:${proxy.port})`,
  }));

  const handleApply = async () => {
    if (!selectedProxyId) {
      alert("Please select a proxy");
      return;
    }

    setIsLoading(true);
    try {
      onProxySelected(selectedProxyId);
      onClose();
    } catch (error) {
      console.error("Failed to apply proxy:", error);
      alert("Failed to apply proxy");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateProxy = () => {
    setEditingProxy(undefined);
    setShowCreateModal(true);
  };

  const handleEditProxy = (proxyId: string) => {
    const proxy = proxies.find((p) => p.id === proxyId);
    if (proxy) {
      setEditingProxy(proxy);
      setShowCreateModal(true);
    }
  };

  const handleDeleteProxy = async (proxyId: string) => {
    if (!confirm("Are you sure you want to delete this proxy?")) return;

    try {
      await ProxyManager.deleteProxy(proxyId);
      await loadProxies();

      if (selectedProxyId === proxyId) {
        setSelectedProxyId("");
      }
    } catch (error) {
      console.error("Failed to delete proxy:", error);
      alert("Failed to delete proxy");
    }
  };

  const handleProxyCreated = async (proxy: ProxyConfig) => {
    await loadProxies();
    setSelectedType(proxy.type);
    setSelectedProxyId(proxy.id);
    setShowCreateModal(false);
  };

  const handleRemoveProxy = async () => {
    setIsLoading(true);
    try {
      onProxySelected(""); // Empty string means remove proxy
      onClose();
    } catch (error) {
      console.error("Failed to remove proxy:", error);
      alert("Failed to remove proxy");
    } finally {
      setIsLoading(false);
    }
  };

  const selectedProxy = proxies.find((p) => p.id === selectedProxyId);

  const modalContent = (
    <>
      <CustomModal
        isOpen={isOpen && !showCreateModal}
        onClose={onClose}
        title={`Select Proxy for ${targetType === "group" ? "Group" : "Tab"}`}
        size="md"
        actionText="Apply"
        onAction={handleApply}
        actionDisabled={!selectedProxyId || isLoading}
        actionLoading={isLoading}
        cancelText="Cancel"
      >
        <div className="p-6 space-y-4">
          <CustomCombobox
            label="Proxy Type"
            value={selectedType}
            options={proxyTypeOptions}
            onChange={(value) => {
              setSelectedType(value as ProxyType);
              setSelectedProxyId(""); // Reset selection when type changes
            }}
            placeholder="Select proxy type..."
            required
            size="sm"
          />

          {selectedType && (
            <>
              {filteredProxies.length === 0 ? (
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
                  <p className="text-sm text-text-secondary mb-3">
                    No {selectedType.toUpperCase()} proxies available
                  </p>
                  <button
                    onClick={handleCreateProxy}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Create New Proxy
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <CustomCombobox
                      label="Select Proxy"
                      value={selectedProxyId}
                      options={proxyOptions}
                      onChange={setSelectedProxyId}
                      placeholder="Choose a proxy..."
                      required
                      size="sm"
                      className="flex-1"
                    />
                  </div>

                  <button
                    onClick={handleCreateProxy}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-text-primary rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Create New Proxy
                  </button>
                </>
              )}
            </>
          )}

          {/* Display selected proxy details */}
          {selectedProxy && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-text-primary">
                  {selectedProxy.name}
                </h4>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditProxy(selectedProxy.id)}
                    className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-800 rounded"
                    title="Edit Proxy"
                  >
                    <Edit className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </button>
                  <button
                    onClick={() => handleDeleteProxy(selectedProxy.id)}
                    className="p-1.5 hover:bg-red-100 dark:hover:bg-red-800 rounded"
                    title="Delete Proxy"
                  >
                    <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-text-secondary">
                <strong>Type:</strong> {selectedProxy.type.toUpperCase()}
              </p>
              <p className="text-sm text-text-secondary">
                <strong>Address:</strong> {selectedProxy.address}:
                {selectedProxy.port}
              </p>
              {selectedProxy.username && (
                <p className="text-sm text-text-secondary">
                  <strong>Username:</strong> {selectedProxy.username}
                </p>
              )}
              {selectedProxy.expiryDate && (
                <p className="text-sm text-text-secondary">
                  <strong>Expires:</strong>{" "}
                  {new Date(selectedProxy.expiryDate).toLocaleDateString()}
                </p>
              )}
            </div>
          )}

          {/* Remove proxy button if there's a current proxy */}
          {currentProxyId && (
            <button
              onClick={handleRemoveProxy}
              className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm"
            >
              Remove Proxy
            </button>
          )}
        </div>
      </CustomModal>

      {/* Create/Edit Proxy Modal */}
      <CreateProxyModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setEditingProxy(undefined);
        }}
        onProxyCreated={handleProxyCreated}
        editProxy={editingProxy}
      />
    </>
  );

  return isOpen ? createPortal(modalContent, document.body) : null;
};

export default SelectProxyModal;
