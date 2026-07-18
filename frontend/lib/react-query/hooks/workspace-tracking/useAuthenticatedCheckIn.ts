"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { queryKeys } from "@/lib/react-query/keys/queryKeys";
import { WorkspaceLog } from "@/lib/types/workspace-log";
import { toast } from "sonner";

type AuthMethod = "biometric" | "pin" | "none";

interface AuthenticatedCheckInPayload {
  workspaceId: string;
  bookingId?: string;
  notes?: string;
  authMethod: AuthMethod;
  pin?: string;
  biometricAssertion?: string;
}

export const useAuthenticatedCheckIn = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AuthenticatedCheckInPayload) =>
      apiClient.post<{ success: boolean; data: WorkspaceLog }>(
        "/workspace-tracking/check-in/authenticated",
        payload
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.workspaceTracking.active,
      });
      toast.success("Checked in successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to check in");
    },
  });
};
