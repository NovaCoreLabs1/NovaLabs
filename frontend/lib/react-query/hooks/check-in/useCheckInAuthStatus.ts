import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";

interface CheckInAuthStatus {
  hasPinSetup: boolean;
  hasBiometricSetup: boolean;
  requiresAuth: boolean;
}

interface AuthStatusResponse {
  message: string;
  data: CheckInAuthStatus;
}

export function useCheckInAuthStatus() {
  return useQuery({
    queryKey: ["checkInAuthStatus"],
    queryFn: async (): Promise<AuthStatusResponse> => {
      const response = await apiClient.get<AuthStatusResponse>("/workspace-tracking/auth/status");
      return response;
    },
    staleTime: 30000, // 30 seconds
  });
}
