// File: src/presentation/components/proxy/CreateProxyModal.tsx
import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import CustomModal from "../common/CustomModal";
import CustomInput from "../common/CustomInput";
import CustomCombobox from "../common/CustomCombobox";
import { ProxyConfig, ProxyType } from "@/types/proxy";
import { ProxyManager } from "@/shared/lib/proxy-manager";
import { CheckCircle, XCircle, Loader } from "lucide-react";

interface CreateProxyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProxyCreated: (proxy: ProxyConfig) => void;
  editProxy?: ProxyConfig;
}

const CreateProxyModal: React.FC<CreateProxyModalProps> = ({
  isOpen,
  onClose,
  onProxyCreated,
  editProxy,
}) => {
  const [name, setName] = useState("");
  const [type, setType] = useState<ProxyType>("http");
  const [address, setAddress] = useState("");
  const [port, setPort] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [quickInput, setQuickInput] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [duration, setDuration] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [testStatus, setTestStatus] = useState<
    "idle" | "testing" | "success" | "failed"
  >("idle");
  const [useQuickInput, setUseQuickInput] = useState(false);

  const proxyTypeOptions = [
    { value: "http", label: "HTTP" },
    { value: "https", label: "HTTPS" },
    { value: "socks5", label: "SOCKS5" },
  ];

  useEffect(() => {
    if (isOpen && editProxy) {
      setName(editProxy.name);
      setType(editProxy.type);
      setAddress(editProxy.address);
      setPort(editProxy.port.toString());
      setUsername(editProxy.username || "");
      setPassword(editProxy.password || "");
      setPurchaseDate(editProxy.purchaseDate || "");
      setDuration(editProxy.duration?.toString() || "");
      setExpiryDate(editProxy.expiryDate || "");
      setTestStatus(editProxy.testStatus || "idle");
    } else if (isOpen) {
      resetForm();
    }
  }, [isOpen, editProxy]);

  // Auto-calculate expiry date
  useEffect(() => {
    if (purchaseDate && duration) {
      const durationNum = parseInt(duration, 10);
      if (!isNaN(durationNum) && durationNum > 0) {
        const expiry = ProxyManager.calculateExpiryDate(
          purchaseDate,
          durationNum
        );
        setExpiryDate(expiry);
      }
    }
  }, [purchaseDate, duration]);

  const resetForm = () => {
    setName("");
    setType("http");
    setAddress("");
    setPort("");
    setUsername("");
    setPassword("");
    setQuickInput("");
    setPurchaseDate("");
    setDuration("");
    setExpiryDate("");
    setTestStatus("idle");
    setUseQuickInput(false);
  };

  const handleQuickInputParse = () => {
    const parsed = ProxyManager.parseQuickInput(quickInput);
    if (parsed) {
      setAddress(parsed.address || "");
      setPort(parsed.port?.toString() || "");
      setUsername(parsed.username || "");
      setPassword(parsed.password || "");
    } else {
      alert("Invalid format. Use: address:port:username:password");
    }
  };

  const handleTestConnection = async () => {
    if (!address || !port) {
      alert("Please enter address and port first");
      return;
    }

    setTestStatus("testing");

    const testProxy: ProxyConfig = {
      id: editProxy?.id || "test",
      name: name || "Test Proxy",
      type,
      address,
      port: parseInt(port, 10),
      username: username || undefined,
      password: password || undefined,
      isActive: true,
      createdAt: Date.now(),
    };

    const success = await ProxyManager.testProxyConnection(testProxy);
    setTestStatus(success ? "success" : "failed");

    setTimeout(() => {
      setTestStatus("idle");
    }, 3000);
  };

  const handleSubmit = async () => {
    if (!name.trim() || !address.trim() || !port) {
      alert("Please fill in all required fields");
      return;
    }

    const portNum = parseInt(port, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      alert("Invalid port number");
      return;
    }

    setIsLoading(true);

    const proxyConfig: ProxyConfig = {
      id:
        editProxy?.id ||
        `proxy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: name.trim(),
      type,
      address: address.trim(),
      port: portNum,
      username: username.trim() || undefined,
      password: password.trim() || undefined,
      purchaseDate: purchaseDate || undefined,
      duration: duration ? parseInt(duration, 10) : undefined,
      expiryDate: expiryDate || undefined,
      isActive: true,
      lastTested:
        testStatus === "success" ? new Date().toISOString() : undefined,
      testStatus:
        testStatus === "success"
          ? "success"
          : testStatus === "failed"
          ? "failed"
          : undefined,
      createdAt: editProxy?.createdAt || Date.now(),
    };

    try {
      await ProxyManager.saveProxy(proxyConfig);
      onProxyCreated(proxyConfig);
      onClose();
      resetForm();
    } catch (error) {
      console.error("Failed to save proxy:", error);
      alert("Failed to save proxy");
    } finally {
      setIsLoading(false);
    }
  };

  const modalContent = (
    <CustomModal
      isOpen={isOpen}
      onClose={onClose}
      title={editProxy ? "Edit Proxy" : "Create New Proxy"}
      size="md"
      actionText={editProxy ? "Update" : "Create"}
      onAction={handleSubmit}
      actionDisabled={!name.trim() || !address.trim() || !port || isLoading}
      actionLoading={isLoading}
      cancelText="Cancel"
    >
      <div className="p-6 space-y-4">
        <CustomInput
          label="Proxy Name"
          value={name}
          onChange={setName}
          required
          placeholder="My Proxy"
          variant="primary"
          size="sm"
        />

        <CustomCombobox
          label="Proxy Type"
          value={type}
          options={proxyTypeOptions}
          onChange={(value) => setType(value as ProxyType)}
          placeholder="Select proxy type..."
          required
          size="sm"
        />

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="useQuickInput"
            checked={useQuickInput}
            onChange={(e) => setUseQuickInput(e.target.checked)}
            className="w-4 h-4"
          />
          <label htmlFor="useQuickInput" className="text-sm text-text-primary">
            Use Quick Input (address:port:username:password)
          </label>
        </div>

        {useQuickInput ? (
          <div className="space-y-2">
            <CustomInput
              label="Quick Input"
              value={quickInput}
              onChange={setQuickInput}
              placeholder="192.168.1.1:8080:user:pass"
              variant="primary"
              size="sm"
              hint="Format: address:port:username:password (username and password are optional)"
            />
            <button
              onClick={handleQuickInputParse}
              className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Parse Input
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <CustomInput
              label="Address"
              value={address}
              onChange={setAddress}
              required
              placeholder="192.168.1.1"
              variant="primary"
              size="sm"
            />

            <CustomInput
              label="Port"
              value={port}
              onChange={setPort}
              required
              type="number"
              placeholder="8080"
              variant="primary"
              size="sm"
            />

            <CustomInput
              label="Username (Optional)"
              value={username}
              onChange={setUsername}
              placeholder="username"
              variant="primary"
              size="sm"
            />

            <CustomInput
              label="Password (Optional)"
              value={password}
              onChange={setPassword}
              type="password"
              placeholder="password"
              variant="primary"
              size="sm"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <CustomInput
            label="Purchase Date (Optional)"
            value={purchaseDate}
            onChange={setPurchaseDate}
            type="datetime-local"
            variant="primary"
            size="sm"
          />

          <CustomInput
            label="Duration (Days)"
            value={duration}
            onChange={setDuration}
            type="number"
            placeholder="30"
            variant="primary"
            size="sm"
          />
        </div>

        {expiryDate && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm text-text-primary">
              <strong>Expiry Date:</strong>{" "}
              {new Date(expiryDate).toLocaleDateString()}
            </p>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={handleTestConnection}
            disabled={!address || !port || testStatus === "testing"}
            className="px-4 py-2 text-sm bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {testStatus === "testing" && (
              <Loader className="w-4 h-4 animate-spin" />
            )}
            {testStatus === "success" && <CheckCircle className="w-4 h-4" />}
            {testStatus === "failed" && <XCircle className="w-4 h-4" />}
            {testStatus === "testing" ? "Testing..." : "Test Connection"}
          </button>

          {testStatus === "success" && (
            <span className="text-sm text-green-600 dark:text-green-400">
              Connection successful!
            </span>
          )}
          {testStatus === "failed" && (
            <span className="text-sm text-red-600 dark:text-red-400">
              Connection failed
            </span>
          )}
        </div>
      </div>
    </CustomModal>
  );

  return isOpen ? createPortal(modalContent, document.body) : null;
};

export default CreateProxyModal;
