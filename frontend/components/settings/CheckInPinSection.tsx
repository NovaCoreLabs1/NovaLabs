"use client";

import { useState } from "react";
import { KeyRound, Check, X } from "lucide-react";
import { apiClient } from "@/lib/apiClient";

interface CheckInPinSectionProps {
  hasPinSetup: boolean;
  onPinChange: () => void;
}

export default function CheckInPinSection({
  hasPinSetup,
  onPinChange,
}: CheckInPinSectionProps) {
  const [mode, setMode] = useState<"view" | "setup" | "change" | "remove">("view");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const resetForm = () => {
    setPin("");
    setConfirmPin("");
    setCurrentPin("");
    setTotpCode("");
    setError(null);
    setSuccess(null);
  };

  const handleSetupPin = async () => {
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      setError("PIN must be exactly 4 digits");
      return;
    }
    if (pin !== confirmPin) {
      setError("PINs do not match");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await apiClient.post("/workspace-tracking/auth/pin/setup", {
        pin,
        confirmPin,
      });
      setSuccess("PIN set up successfully!");
      onPinChange();
      setTimeout(() => {
        setMode("view");
        resetForm();
      }, 1500);
    } catch (err: any) {
      setError(err?.message || "Failed to set up PIN");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePin = async () => {
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      setError("New PIN must be exactly 4 digits");
      return;
    }
    if (pin !== confirmPin) {
      setError("New PINs do not match");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await apiClient.patch("/workspace-tracking/auth/pin/change", {
        currentPin,
        newPin: pin,
        confirmNewPin: confirmPin,
        ...(totpCode && { totpCode }),
      });
      setSuccess("PIN changed successfully!");
      onPinChange();
      setTimeout(() => {
        setMode("view");
        resetForm();
      }, 1500);
    } catch (err: any) {
      setError(err?.message || "Failed to change PIN");
    } finally {
      setLoading(false);
    }
  };

  const handleRemovePin = async () => {
    if (currentPin.length !== 4) {
      setError("Please enter your current PIN");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await apiClient.delete("/workspace-tracking/auth/pin", {
        data: { currentPin },
      });
      setSuccess("PIN removed successfully!");
      onPinChange();
      setTimeout(() => {
        setMode("view");
        resetForm();
      }, 1500);
    } catch (err: any) {
      setError(err?.message || "Failed to remove PIN");
    } finally {
      setLoading(false);
    }
  };

  const PinInput = ({
    value,
    onChange,
    placeholder,
  }: {
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
  }) => (
    <input
      type="password"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={4}
      value={value}
      onChange={(e) => {
        const v = e.target.value.replace(/\D/g, "").slice(0, 4);
        onChange(v);
      }}
      placeholder={placeholder}
      className="w-full px-3.5 py-2.5 text-sm border border-gray-200 dark:border-gray-700 bg-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700 text-gray-900 dark:text-gray-100 text-center tracking-[0.5em] font-mono"
    />
  );

  return (
    <div className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-800">
      <div className="flex items-center gap-2 mb-3">
        <KeyRound className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
          Check-in PIN
        </h3>
      </div>

      {mode === "view" && (
        <div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
            {hasPinSetup
              ? "Your 4-digit PIN is set up for quick check-in authentication."
              : "Set up a 4-digit PIN as a fallback for biometric check-in failures."}
          </p>
          <div className="flex gap-2">
            {hasPinSetup ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setMode("change");
                  }}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Change PIN
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setMode("remove");
                  }}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-red-200 dark:border-red-900 text-red-600 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                >
                  Remove PIN
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setMode("setup");
                }}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200 transition-colors"
              >
                Set up PIN
              </button>
            )}
          </div>
        </div>
      )}

      {mode === "setup" && (
        <div className="space-y-4">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Create a 4-digit PIN for check-in fallback authentication.
          </p>
          <div className="max-w-xs space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                Enter PIN
              </label>
              <PinInput value={pin} onChange={setPin} placeholder="••••" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                Confirm PIN
              </label>
              <PinInput
                value={confirmPin}
                onChange={setConfirmPin}
                placeholder="••••"
              />
            </div>
          </div>

          {error && <p className="text-red-500 text-xs">{error}</p>}
          {success && <p className="text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-1"><Check className="w-3 h-3" />{success}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSetupPin}
              disabled={loading || pin.length !== 4}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200 disabled:opacity-50 transition-colors"
            >
              {loading ? "Setting up..." : "Set PIN"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("view");
                resetForm();
              }}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {mode === "change" && (
        <div className="space-y-4">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Enter your current PIN and choose a new one.
          </p>
          <div className="max-w-xs space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                Current PIN
              </label>
              <PinInput
                value={currentPin}
                onChange={setCurrentPin}
                placeholder="••••"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                New PIN
              </label>
              <PinInput value={pin} onChange={setPin} placeholder="••••" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                Confirm new PIN
              </label>
              <PinInput
                value={confirmPin}
                onChange={setConfirmPin}
                placeholder="••••"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                2FA code (if enabled)
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={totpCode}
                onChange={(e) =>
                  setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="Optional"
                className="w-full px-3.5 py-2.5 text-sm border border-gray-200 dark:border-gray-700 bg-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>

          {error && <p className="text-red-500 text-xs">{error}</p>}
          {success && <p className="text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-1"><Check className="w-3 h-3" />{success}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleChangePin}
              disabled={loading || pin.length !== 4 || currentPin.length !== 4}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200 disabled:opacity-50 transition-colors"
            >
              {loading ? "Changing..." : "Change PIN"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("view");
                resetForm();
              }}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {mode === "remove" && (
        <div className="space-y-4">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Enter your current PIN to remove it. You won&apos;t be able to use PIN fallback for check-in.
          </p>
          <div className="max-w-xs">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              Current PIN
            </label>
            <PinInput
              value={currentPin}
              onChange={setCurrentPin}
              placeholder="••••"
            />
          </div>

          {error && <p className="text-red-500 text-xs">{error}</p>}
          {success && <p className="text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-1"><Check className="w-3 h-3" />{success}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleRemovePin}
              disabled={loading || currentPin.length !== 4}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 disabled:opacity-50 transition-colors"
            >
              {loading ? "Removing..." : "Remove PIN"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("view");
                resetForm();
              }}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
