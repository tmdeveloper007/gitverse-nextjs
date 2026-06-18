/**
 * Secret Redaction Utility
 *
 * Provides reusable secret detection and redaction functionality to prevent
 * sensitive information from being exposed in logs, API calls, or other outputs.
 */

const REDACTED_PLACEHOLDER = "[REDACTED]";

/**
 * High-confidence secret patterns that should be blocked entirely.
 */
const BLOCKED_PATTERNS = [
  { name: "GitHub Token (Classic)", pattern: /gh[pousr]_[a-zA-Z0-9]{36}/g },
  { name: "GitHub Token (Fine-grained)", pattern: /github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}/g },
  { name: "Google API Key", pattern: /AIza[0-9A-Za-z\-_]{35}/g },
  { name: "AWS Access Key", pattern: /AKIA[0-9A-Z]{16}/g },
  { name: "Slack Token", pattern: /xox[baprs]-[0-9]{12}-[0-9]{12}-[a-zA-Z0-9]{24}/g },
  { name: "RSA Private Key", pattern: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END \1?PRIVATE KEY-----/g },
] as const;

/**
 * Patterns for secrets that should be redacted rather than blocked.
 */
const REDACT_PATTERNS = [
  { name: "JWT Token", pattern: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g },
  { name: "Bearer Token", pattern: /bearer\s+([a-zA-Z0-9\-\._~+\/]+=*)/gi },
  { name: "Generic Secret Assignment", pattern: /(?:secret|key|token|password|passwd|pwd)\s*[:=]\s*['"]?([a-zA-Z0-9\-_=]{8,})['"]?/gi },
  { name: "Generic Secret Value", pattern: /['"](?:secret|key|token|password|passwd|pwd)['"]\s*[:=]\s*['"]([a-zA-Z0-9\-_=]{8,})['"]/gi },
] as const;

/**
 * Pattern to detect if text has already been redacted.
 */
const ALREADY_REDACTED_PATTERN = /\[REDACTED\]/g;

/**
 * Maximum input length before warning/truncation.
 * Set to 1MB to prevent memory issues with extremely large inputs.
 */
const MAX_INPUT_LENGTH = 1024 * 1024;

export interface RedactionResult {
  redacted: string;
  count: number;
  truncated: boolean;
}

export interface SecretDetectionResult {
  blocked: boolean;
  blockedBy?: string;
  redacted: string;
  secretsFound: number;
  truncated: boolean;
}

/**
 * Redacts secrets from the given text.
 *
 * @param text - The input text to redact secrets from
 * @returns An object containing the redacted text and the count of secrets found
 */
export function redactSecrets(text: string): RedactionResult {
  if (!text || typeof text !== "string") {
    return { redacted: "", count: 0, truncated: false };
  }

  let truncated = false;
  let processedText = text;

  // Handle very long inputs
  if (text.length > MAX_INPUT_LENGTH) {
    processedText = text.substring(0, MAX_INPUT_LENGTH);
    truncated = true;
  }

  // Skip if already redacted
  const alreadyRedacted = ALREADY_REDACTED_PATTERN.test(processedText);
  if (alreadyRedacted) {
    return { redacted: processedText, count: 0, truncated };
  }

  let count = 0;

  // Apply all redaction patterns
  for (const rule of REDACT_PATTERNS) {
    const matches = processedText.match(rule.pattern);
    if (matches) {
      count += matches.length;
      processedText = processedText.replace(rule.pattern, REDACTED_PLACEHOLDER);
    }
  }

  return { redacted: processedText, count, truncated };
}

/**
 * Scans for high-confidence secrets that should be blocked.
 * Throws an error if a high-confidence secret is detected.
 *
 * @param text - The input text to scan
 * @returns The original text if no blocked secrets are found
 * @throws Error if a high-confidence secret is detected
 */
export function detectBlockedSecrets(text: string): void {
  if (!text || typeof text !== "string") {
    return;
  }

  for (const rule of BLOCKED_PATTERNS) {
    // Reset lastIndex since patterns have /g flag
    rule.pattern.lastIndex = 0;
    if (rule.pattern.test(text)) {
      throw new Error(
        `High-confidence secret detected: ${rule.name}. Operation halted to prevent secret leak.`
      );
    }
  }
}

/**
 * Combined function that both blocks high-confidence secrets and redacts others.
 *
 * @param text - The input text to process
 * @returns SecretDetectionResult with detection and redaction info
 * @throws Error if a high-confidence secret is detected
 */
export function scanAndRedactSecrets(text: string): SecretDetectionResult {
  // First check for blocked secrets (throws if found)
  detectBlockedSecrets(text);

  // Then redact remaining secrets
  const result = redactSecrets(text);

  return {
    blocked: false,
    redacted: result.redacted,
    secretsFound: result.count,
    truncated: result.truncated,
  };
}

/**
 * Re-export the original geminiService function signature for backwards compatibility.
 * Prefer using scanAndRedactSecrets for new code.
 *
 * @deprecated Use scanAndRedactSecrets instead
 */
export function scanAndRedactPayload(payload: string): string {
  return scanAndRedactSecrets(payload).redacted;
}
