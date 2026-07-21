"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { queryKeys } from "@/lib/react-query/keys/queryKeys";
import { Notification } from "@/lib/types/notification";

export interface NotificationsResponse {
  success: boolean;
  data: Notification[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    unreadCount: number;
  };
}

export const useGetNotifications = (
  page = 1,
  limit = 20,
  isRead?: boolean
) => {
  return useQuery({
    queryKey: queryKeys.notifications.list({ page, limit, isRead }),
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (isRead !== undefined) params.set("isRead", String(isRead));
      return apiClient.get<NotificationsResponse>(
        `/notifications?${params.toString()}`
      );
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
};
