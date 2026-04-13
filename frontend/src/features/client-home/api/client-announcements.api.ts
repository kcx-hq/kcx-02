import { apiGet } from "@/lib/api";

export type ClientAnnouncement = {
  id: string;
  title: string;
  body: string;
  publishAt: string | null;
  expiresAt: string | null;
  updatedAt: string;
};

export async function getClientAnnouncements(): Promise<ClientAnnouncement[]> {
  return apiGet<ClientAnnouncement[]>("/announcements/client");
}
