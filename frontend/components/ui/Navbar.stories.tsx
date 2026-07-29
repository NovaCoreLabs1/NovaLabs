import type { Meta, StoryObj } from "@storybook/react";
import { within, expect } from "@storybook/test";

import { Navbar, PUBLIC_NAV_ITEMS, ADMIN_NAV_ITEMS } from "./Navbar";
import { useAuthStore } from "@/lib/store/authStore";

/**
 * Test helper: directly inject a known role into the Zustand auth store.
 *
 * The Vite/Storybook browser test runner renders stories inside the same
 * React tree, so mutating the global Zustand store from a story `loader`
 * is observed by every `<RoleGate>` and `useAuthState()` in the rendered
 * Navbar. To avoid cross-test pollution from the `persist` middleware we
 * also reset the partialised keys (`user`, `accessToken`,
 * `isAuthenticated`).
 */
const setAuthRole = (role: "user" | "admin" | null) => {
  const user = role
    ? {
        id: "storybook",
        firstname: "Story",
        lastname: "Book",
        email: "story@example.com",
        username: "storybook",
        role,
        isActive: true,
        isSuspended: false,
        isDeleted: false,
        hasCompletedOnboarding: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      }
    : null;
  useAuthStore.setState({
    user,
    accessToken: role ? "storybook-token" : null,
    isAuthenticated: !!role,
    isLoading: false,
  });
  if (typeof window !== "undefined") {
    // Clear persisted storage so subsequent stories start from a known state.
    try {
      window.localStorage.removeItem("AuthStore");
    } catch {
      /* ignore */
    }
  }
};

const meta = {
  title: "Example/Navbar",
  component: Navbar,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story: React.ComponentType) => {
      // Make sure the underlying store starts empty so decorators/loaders
      // can fully determine what the navbar renders.
      setAuthRole(null);
      return <Story />;
    },
  ],
} satisfies Meta<typeof Navbar>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Anonymous visitor — public items render, admin-only items do not.
 */
export const GuestLoggedOut: Story = {
  loaders: [
    async () => {
      setAuthRole(null);
    },
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Features")).toBeInTheDocument();
    await expect(canvas.getByText("How it works")).toBeInTheDocument();
    await expect(canvas.queryByText("Admin Console")).not.toBeInTheDocument();
  },
};

/**
 * Regular signed-in user — public items render, admin-only items do not
 * even when `ADMIN_NAV_ITEMS` is in the `items` prop (i.e. RoleGate hides
 * them rather than the caller having to filter).
 */
export const RegularUser: Story = {
  loaders: [
    async () => {
      setAuthRole("user");
    },
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Features")).toBeInTheDocument();
    await expect(canvas.queryByText("Admin Console")).not.toBeInTheDocument();
  },
};

/**
 * Administrator — both public and admin-only items render. Accepts issue
 * #58 acceptance criterion: ``Snapshot test asserts rendered items for
 * USER + ADMIN``.
 */
export const Administrator: Story = {
  loaders: [
    async () => {
      setAuthRole("admin");
    },
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Features")).toBeInTheDocument();
    await expect(canvas.getByText("Admin Console")).toBeInTheDocument();
  },
};

// Re-export the canonical lists so other components can import them from
// a Storybook-friendly path.
export { PUBLIC_NAV_ITEMS, ADMIN_NAV_ITEMS };
