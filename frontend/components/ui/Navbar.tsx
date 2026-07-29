"use client";
import { Building2, X, Menu } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { RoleGate } from "@/components/RoleGate";

/** Single navigation entry rendered inside the {@link Navbar}. */
type NavItem = {
  label: string;
  href: string;
  /** When true, item is rendered via `<RoleGate role="admin">`. */
  adminOnly?: boolean;
};

/**
 * Items that are always visible (logged out users, regular users, admins).
 *
 * Anchors use `#` hash routes so they work on the public marketing pages
 * where this navbar is mounted.
 */
export const PUBLIC_NAV_ITEMS: NavItem[] = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
];

/**
 * Items rendered only when the signed-in user has the `admin` role. Wrapped
 * in `<RoleGate role="admin">` so they never leak into the DOM for regular
 * users — both visually (no dead `/admin/*` links) and from a11y tools that
 * inspect the DOM.
 */
export const ADMIN_NAV_ITEMS: NavItem[] = [
  { label: "Admin Console", href: "/admin/dashboard", adminOnly: true },
];

/** Default marketing navigation items for the landing-page navbar. */
const NAV_ITEMS: NavItem[] = [...PUBLIC_NAV_ITEMS, ...ADMIN_NAV_ITEMS];

/** Props for the {@link Navbar} component. */
interface NavbarProps {
  /**
   * Navigation entries to render. Defaults to the combined
   * {@link PUBLIC_NAV_ITEMS} + {@link ADMIN_NAV_ITEMS} lists. Admin-only
   * items are still gated by `<RoleGate role="admin">` regardless of how
   * the caller composes this list.
   */
  items?: NavItem[];
}

/**
 * Top-level navbar entry. Renders {@link PUBLIC_NAV_ITEMS} for everyone and
 * adds admin-only entries via {@link RoleGate} when the current user has the
 * `admin` role.
 */
function NavItemLink({
  item,
  onNavigate,
  className,
}: {
  item: NavItem;
  onNavigate?: () => void;
  className: string;
}) {
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={className}
    >
      {item.label}
    </Link>
  );
  if (item.adminOnly) {
    return <RoleGate role="admin">{link}</RoleGate>;
  }
  return link;
}

/**
 * Responsive site navbar with a logo, navigation links, and a mobile menu
 * toggle.
 *
 * Issue #58: the rendered items now respect the signed-in user's role —
 * `{adminOnly: true}` entries are wrapped in `<RoleGate role="admin">` so
 * regular users never see links to `/admin/*`.
 *
 * Renders a desktop inline layout on medium-and-up screens and a dropdown
 * menu below that breakpoint.
 */
export function Navbar({ items = NAV_ITEMS }: NavbarProps) {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-[#faf9f7]/90 backdrop-blur-md border-b border-gray-200/40">
      <nav className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="bg-gray-900 rounded-lg p-2">
            <Building2 className="w-5 h-5" color="#ffffff" />
          </span>
          <span className="font-semibold text-gray-900 text-lg tracking-tight">
            NovaLabs
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-8">
          {items.map((it) => (
            <NavItemLink
              key={it.label}
              item={it}
              className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
            />
          ))}

          <div className="flex items-center gap-3 pl-6 border-l border-gray-200/60">
            <Link
              href="/login"
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="px-5 py-2 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              Sign up
            </Link>
          </div>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setOpen((s) => !s)}
          className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Toggle menu"
        >
          {open ? (
            <X className="w-5 h-5 text-gray-900" />
          ) : (
            <Menu className="w-5 h-5 text-gray-900" />
          )}
        </button>

        {/* Mobile Menu Dropdown */}
        {open && (
          <div className="absolute right-6 top-[60px] w-56 bg-white rounded-xl shadow-xl border border-gray-200 md:hidden overflow-hidden">
            <div className="p-2">
              {items.map((it) => (
                <NavItemLink
                  key={it.label}
                  item={it}
                  onNavigate={() => setOpen(false)}
                  className="block py-2.5 px-4 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors font-medium"
                />
              ))}
            </div>

            <div className="border-t border-gray-100 p-3 space-y-2 bg-gray-50">
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="block w-full px-4 py-2.5 text-center rounded-lg text-gray-700 font-medium hover:bg-gray-100 transition-colors"
              >
                Log in
              </Link>
              <Link
                href="/register"
                onClick={() => setOpen(false)}
                className="block w-full px-4 py-2.5 text-center rounded-full bg-gray-900 text-white font-medium hover:bg-gray-800 transition-colors"
              >
                Sign up
              </Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
