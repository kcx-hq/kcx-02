import { useQuery } from "@tanstack/react-query";

import {
  getClientAnnouncements,
  type ClientAnnouncement,
} from "@/features/client-home/api/client-announcements.api";

export const CLIENT_ANNOUNCEMENTS_QUERY_KEY = ["client", "announcements"] as const;

export function useClientAnnouncements(enabled = true) {
  return useQuery<ClientAnnouncement[]>({
    queryKey: CLIENT_ANNOUNCEMENTS_QUERY_KEY,
    queryFn: getClientAnnouncements,
    enabled,
  });
}
