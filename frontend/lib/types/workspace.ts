/** Union type representing available workspace categories in the platform. */
export type WorkspaceType =
  | "PRIVATE_OFFICE"
  | "COWORKING"
  | "MEETING_ROOM"
  | "HOT_DESK"
  | "DEDICATED_DESK";

/** Represents a workspace resource with seat and pricing information. */
export interface Workspace {
  id: string;
  name: string;
  type: WorkspaceType;
  totalSeats: number;
  hourlyRate: number; // in kobo
  description?: string;
  amenities?: string[];
  images?: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Availability check result for a workspace given a requested seat count. */
export interface WorkspaceAvailability {
  workspaceId: string;
  requestedSeats: number;
  available: boolean;
  totalSeats: number;
  availableSeats: number;
  message: string;
}

/** Query parameters for filtering and paginating workspace listings. */
export interface WorkspaceQuery {
  page?: number;
  limit?: number;
  type?: WorkspaceType;
  minSeats?: number;
  search?: string;
}
