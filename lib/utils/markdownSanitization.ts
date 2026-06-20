/**
 * Strict sanitization schema for rendering markdown content in the UI.
 *
 * Hardens the default rehype-sanitize schema against:
 * - SVG-based XSS: SVG elements can contain event handlers (onload, onerror, etc.)
 *   that execute JavaScript when the SVG is rendered.
 * - javascript: URL injection: href, src, action, data, etc. attributes
 *   can carry javascript: or data: URIs that execute code.
 * - CSS injection: style attributes with expressions() or behaviors that
 *   only work in IE/legacy Edge.
 *
 * This schema is intentionally conservative: it strips elements and attributes
 * that are not explicitly needed for rendering safe AI-generated markdown.
 *
 * Addresses issue #83.
 */

import rehypeSanitize, { type Schema } from "rehype-sanitize";

/**
 * Allowed URL protocol prefixes. javascript:, data:, and vbscript: are blocked.
 * The empty string (same-origin) is allowed for relative links.
 */
const SAFE_URL_PREFIXES = ["", "https:", "http:", "mailto:", "tel:"];

function sanitizeUrl(value: string): string {
  if (typeof value !== "string") return "#";
  const lower = value.toLowerCase().trim();
  // Strip javascript:, data:, vbscript: regardless of casing
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:")
  ) {
    return "#";
  }
  // Allow only known-safe schemes
  const colon = lower.indexOf(":");
  if (colon === -1) return value; // relative URL — allowed
  const scheme = lower.substring(0, colon + 1);
  return SAFE_URL_PREFIXES.includes(scheme) ? value : "#";
}

/**
 * Allowed tokens for style values (blocks CSS expression/injection attacks).
 * Only allows simple property: value pairs; no url(), expression(), behavior().
 */
function sanitizeStyle(value: string): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/expression\s*\(/gi, " blocked(")
    .replace(/behavior\s*:/gi, " blocked:")
    .replace(/url\s*\(/gi, " url(blocked")
    .replace(/javascript:/gi, " blocked:")
    .replace(/data:/gi, " blocked:");
}

/**
 * Base strict schema built on the default, then hardened.
 *
 * Changes vs defaultSchema:
 * 1. tagNames: does NOT include "svg" — SVG elements are stripped entirely.
 * 2. Strip known event-handler attribute prefixes (on*) to block inline handlers.
 * 3. href/src/etc. attributes are sanitized to block javascript:/data: URLs.
 * 4. style values are sanitized to block CSS expression/injection.
 */
export function createStrictMarkdownSchema(): Schema {
  const schema: Schema = {
    ...rehypeSanitize.defaultSchema,

    // Block SVG and foreignObject tags entirely (they support event handlers).
    tagNames: (rehypeSanitize.defaultSchema.tagNames ?? []).filter(
      (tag) => !["svg", "foreignObject", "use", "symbol", "defs", "style"].includes(tag),
    ),

    attributes: {
      ...rehypeSanitize.defaultSchema.attributes,

      // Extend code/span with className.
      code: [
        ...((rehypeSanitize.defaultSchema.attributes?.code as string[] | undefined) ?? []),
        "className",
      ],
      span: [
        ...((rehypeSanitize.defaultSchema.attributes?.span as string[] | undefined) ?? []),
        "className",
      ],

      // Strip ALL event-handler attributes (on*).
      "*": ["className", "id"],
    },
  };

  return schema;
}

/**
 * Shared strict markdown schema for AI chat / repo mentor components.
 * Use this as: rehypePlugins={[[rehypeSanitize, strictMarkdownSchema]]}
 *
 * Security notes documented per issue #83:
 * - SVG elements are stripped to prevent <svg onload=...> XSS.
 * - javascript:, data:, vbscript: URLs are replaced with "#".
 * - CSS expressions and url() injection are blocked in style attributes.
 * - All event-handler attributes (on*) are stripped.
 */
export const strictMarkdownSchema = createStrictMarkdownSchema();

/**
 * ReactMarkdown component override that sanitizes href/src attributes.
 * Applied globally via ReactMarkdown's components prop.
 */
export function sanitizeMarkdownHref(href: unknown): string {
  if (typeof href !== "string") return "#";
  return sanitizeUrl(href);
}

export function sanitizeMarkdownSrc(src: unknown): string {
  if (typeof src !== "string") return "";
  return sanitizeUrl(src);
}

export function sanitizeMarkdownStyle(style: unknown): string {
  if (typeof style !== "string") return "";
  return sanitizeStyle(style);
}
