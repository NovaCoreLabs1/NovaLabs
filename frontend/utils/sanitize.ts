/**
 * sanitize.ts — Issue #117
 *
 * Centralised HTML sanitisation utility using `isomorphic-dompurify`.
 * Use `sanitizeHtml` wherever user-controlled HTML must be rendered via
 * `dangerouslySetInnerHTML`. This prevents stored-XSS attacks in admin
 * views and newsletter/contact copy.
 *
 * Usage:
 *   import { sanitizeHtml } from '@/utils/sanitize';
 *   <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(userContent) }} />
 */

import DOMPurify, { type Config } from "isomorphic-dompurify";

/**
 * Default allow-list: strips all scripts, event handlers, and
 * javascript: URIs while preserving safe formatting markup.
 */
const DEFAULT_CONFIG: Config = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form"],
  FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur"],
};

/**
 * Sanitise an arbitrary HTML string.
 *
 * @param dirty  - Raw HTML that may contain user-controlled content.
 * @param config - Optional DOMPurify config to override defaults.
 * @returns      Sanitised HTML string, safe for `dangerouslySetInnerHTML`.
 */
export function sanitizeHtml(
  dirty: string,
  config: Config = DEFAULT_CONFIG
): string {
  if (!dirty) return "";
  return DOMPurify.sanitize(dirty, config) as string;
}

/**
 * Sanitise HTML and return only plain text (strips all tags).
 * Useful for tooltips, `aria-label`, or `title` attributes.
 *
 * @param dirty - Raw HTML or plain text.
 * @returns     Plain text with all HTML stripped.
 */
export function sanitizePlainText(dirty: string): string {
  if (!dirty) return "";
  return DOMPurify.sanitize(dirty, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }) as string;
}
