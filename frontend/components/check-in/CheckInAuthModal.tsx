"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Fingerprint, KeyRound, AlertCircle, Loader2 } from "lucide-react";

type AuthMethod = "biometric" | "pin" | "none";

interface CheckInAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticate: (authMethod: AuthMethod, pin?: string) => Promise<void>;
  workspaceName?: string;
  hasPinSetup: boolean;
  hasBiometricSetup: boolean;
  requiresAuth: boolean;
}

export default function CheckInAuthModal({
  isOpen,
  onClose,
  onAuthenticate,
  workspaceName,
  hasPinSetup,
  hasBiometricSetup,
  requiresAuth,
}: CheckInAuthModalProps) {
  const [mode, setMode] = useState<"biometric" | "pin" | "select">("select");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [biometricFailed, setBiometricFailed] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setPin("");
      setError(null);
      setLoading(false);
      setBiometricFailed(false);

      // Auto-select mode based on what's available
      if (!requiresAuth) {
        // No auth required, just proceed
        handleNoAuth();
      } else if (hasBiometricSetup && !hasPinSetup) {
        setMode("biometric");
        attemptBiometric();
      } else if (hasPinSetup && !hasBiometricSetup) {
        setMode("pin");
      } else if (hasBiometricSetup && hasPinSetup) {
        // Both available, try biometric first
        setMode("biometric");
        attemptBiometric();
      } else {
        setMode("select");
      }
    }
  }, [isOpen, hasBiometricSetup, hasPinSetup, requiresAuth]);

  const handleNoAuth = async () => {
    setLoading(true);
    try {
      await onAuthenticate("none");
      onClose();
    } catch (err: any) {
      setError(err?.message || "Check-in failed");
    } finally {
      setLoading(false);
    }
  };

  const attemptBiometric = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Check if WebAuthn is supported
      if (!window.PublicKeyCredential) {
        throw new Error("Biometric authentication not supported on this device");
      }

      // For demo purposes, we simulate a biometric check
      // In production, you would implement full WebAuthn flow here:
      // 1. Get challenge from server
      // 2. Call navigator.credentials.get() with publicKey options
      // 3. Send assertion to server for verification

      // Simulate biometric prompt (in real implementation, this would be WebAuthn)
      const isAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();

      if (!isAvailable) {
        throw new Error("No biometric authenticator available");
      }

      // Simulate biometric success/failure (replace with real WebAuthn)
      // For now, we'll just pass "biometric" as the auth method
      await onAuthenticate("biometric", "biometric-assertion-placeholder");
      onClose();
    } catch (err: any) {
      console.error("Biometric auth failed:", err);
      setBiometricFailed(true);

      if (hasPinSetup) {
        setError("Biometric failed. Please use your PIN instead.");
        setMode("pin");
      } else {
        setError(err?.message || "Biometric authentication failed");
      }
    } finally {
      setLoading(false);
    }
  }, [onAuthenticate, onClose, hasPinSetup]);

  const handlePinSubmit = async () => {
    if (pin.length !== 4) {
      setError("Please enter a 4-digit PIN");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onAuthenticate("pin", pin);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Invalid PIN");
      setPin("");
    } finally {
      setLoading(false);
    }
  };

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, onClose, loading]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={loading ? undefined : onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Verify Check-in
          </h2>
          {!loading && (
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {workspaceName && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 text-center">
              Checking in to <span className="font-medium text-gray-900 dark:text-gray-100">{workspaceName}</span>
            </p>
          )}

          {/* No auth required */}
          {!requiresAuth && (
            <div className="text-center py-4">
              {loading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
                  <p className="text-sm text-gray-500">Processing check-in...</p>
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  No authentication required for check-in.
                </p>
              )}
            </div>
          )}

          {/* Biometric mode */}
          {requiresAuth && mode === "biometric" && !biometricFailed && (
            <div className="text-center py-6">
              {loading ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <Fingerprint className="w-8 h-8 text-gray-400 animate-pulse" />
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Waiting for biometric verification...
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <button
                    onClick={attemptBiometric}
                    className="w-16 h-16 rounded-full bg-gray-900 dark:bg-gray-100 flex items-center justify-center hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
                  >
                    <Fingerprint className="w-8 h-8 text-white dark:text-gray-900" />
                  </button>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Tap to use biometric
                  </p>
                </div>
              )}

              {hasPinSetup && (
                <button
                  onClick={() => setMode("pin")}
                  className="mt-6 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  Use PIN instead
                </button>
              )}
            </div>
          )}

          {/* PIN mode */}
          {requiresAuth && (mode === "pin" || biometricFailed) && hasPinSetup && (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <KeyRound className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Enter your 4-digit PIN
                </p>
              </div>

              <div className="flex justify-center">
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                    setPin(v);
                    setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && pin.length === 4) {
                      handlePinSubmit();
                    }
                  }}
                  autoFocus
                  placeholder="••••"
                  className="w-40 px-4 py-3 text-2xl text-center border border-gray-200 dark:border-gray-700 bg-transparent rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700 text-gray-900 dark:text-gray-100 tracking-[0.5em] font-mono"
                />
              </div>

              <button
                onClick={handlePinSubmit}
                disabled={loading || pin.length !== 4}
                className="w-full py-3 text-sm font-medium rounded-xl bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                {loading ? "Verifying..." : "Verify & Check In"}
              </button>

              {hasBiometricSetup && !biometricFailed && (
                <button
                  onClick={() => {
                    setMode("biometric");
                    setError(null);
                    setPin("");
                  }}
                  className="w-full text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  Use biometric instead
                </button>
              )}
            </div>
          )}

          {/* No auth methods available but auth is required */}
          {requiresAuth && !hasPinSetup && !hasBiometricSetup && (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-3">
                <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-500" />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                No authentication method set up
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Please set up a PIN or biometric in Settings to use authenticated check-in.
              </p>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400 text-center">
                {error}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
