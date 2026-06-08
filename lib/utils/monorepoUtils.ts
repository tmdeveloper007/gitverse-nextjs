import * as fs from "fs/promises";
import * as path from "path";

/**
 * Expands brace patterns like "packages/{admin,api}/*" into individual patterns.
 */
function expandBracePatterns(pattern: string): string[] {
  if (!pattern.includes("{")) return [pattern];

  const results: string[] = [];
  const match = pattern.match(/^([^{]*)\{([^}]+)\}(.*)$/);
  if (!match) return [pattern];

  const [, prefix, variants, suffix] = match;
  const parts = variants.split(",").map((v) => v.trim()).filter(Boolean);

  for (const variant of parts) {
    const expanded = prefix + variant + suffix;
    // Recursively expand nested braces
    const nested = expandBracePatterns(expanded);
    results.push(...nested);
  }

  return results;
}

/**
 * Finds all directories matching glob patterns including:
 * - Simple wildcards like "packages/*" or "apps/*"
 * - Brace expansion like "packages/{admin,api}/*"
 * - Nested patterns like "packages/*/services/*"
 */
async function resolveWorkspaceGlobs(baseDir: string, globs: string[]): Promise<string[]> {
  const packages = new Set<string>();

  for (const rawPattern of globs) {
    // Expand brace patterns first (e.g., "packages/{admin,api}/*" -> ["packages/admin/*", "packages/api/*"])
    const expandedPatterns = expandBracePatterns(rawPattern);

    for (const pattern of expandedPatterns) {
      // Handle nested patterns with multiple * segments
      if (pattern.includes("*")) {
        const parts = pattern.split("/");
        let currentDir = baseDir;
        let partialPath = "";

        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          partialPath = partialPath ? `${partialPath}/${part}` : part;

          if (part === "*") {
            // Wildcard segment: list all directories in currentDir
            try {
              const entries = await fs.readdir(currentDir, { withFileTypes: true });
              for (const entry of entries) {
                if (entry.isDirectory()) {
                  const wildcardDir = path.join(currentDir, entry.name);
                  const wildcardPath = partialPath.replace("/*", `/${entry.name}`);
                  // If there are more segments after this wildcard, recurse
                  const remainingParts = parts.slice(i + 1);
                  if (remainingParts.length === 0) {
                    packages.add(wildcardPath);
                  } else {
                    // Recursively resolve remaining pattern from wildcardDir
                    const remainingPattern = remainingParts.join("/");
                    const subResults = await resolveWorkspaceGlobsSingle(wildcardDir, remainingPattern);
                    for (const sub of subResults) {
                      packages.add(sub);
                    }
                  }
                }
              }
            } catch (err) {
              // Directory might not exist, ignore
            }
            break; // Wildcard segment was handled
          } else {
            // Normal segment: descend into it
            currentDir = path.join(currentDir, part);
          }
        }
      } else if (pattern.endsWith("/*")) {
        // Simple pattern: parentDir/*
        const parentDir = pattern.slice(0, -2);
        try {
          const fullParent = path.join(baseDir, parentDir);
          const entries = await fs.readdir(fullParent, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory()) {
              packages.add(path.posix.join(parentDir, entry.name));
            }
          }
        } catch (err) {
          // Directory might not exist, ignore
        }
      } else {
        // Direct path (e.g., "core", "packages/utils")
        try {
          const fullPath = path.join(baseDir, pattern);
          const stat = await fs.stat(fullPath);
          if (stat.isDirectory()) {
            packages.add(pattern);
          }
        } catch (err) {
          // Path might not exist, ignore
        }
      }
    }
  }

  return Array.from(packages);
}

/**
 * Resolves a single glob pattern from a base directory.
 * Used for nested wildcard resolution.
 */
async function resolveWorkspaceGlobsSingle(baseDir: string, pattern: string): Promise<string[]> {
  if (!pattern.includes("*")) {
    try {
      const fullPath = path.join(baseDir, pattern);
      const stat = await fs.stat(fullPath);
      if (stat.isDirectory()) {
        return [pattern];
      }
    } catch {
      // Ignore
    }
    return [];
  }

  const results: string[] = [];
  const parts = pattern.split("/");

  async function traverse(dir: string, patternParts: string[], accumulated: string): Promise<void> {
    if (patternParts.length === 0) {
      try {
        const stat = await fs.stat(dir);
        if (stat.isDirectory()) {
          results.push(accumulated);
        }
      } catch {
        // Ignore
      }
      return;
    }

    const [head, ...tail] = patternParts;
    if (head === "*") {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const subDir = path.join(dir, entry.name);
            const newAccumulated = accumulated ? `${accumulated}/${entry.name}` : entry.name;
            await traverse(subDir, tail, newAccumulated);
          }
        }
      } catch {
        // Ignore
      }
    } else {
      const subDir = path.join(dir, head);
      const newAccumulated = accumulated ? `${accumulated}/${head}` : head;
      await traverse(subDir, tail, newAccumulated);
    }
  }

  await traverse(baseDir, parts, "");
  return results;
}

export async function detectMonorepoPackages(repoTempDir: string): Promise<string[]> {
  const globs = new Set<string>();

  // 1. Check package.json for npm/yarn workspaces
  try {
    const pkgJsonPath = path.join(repoTempDir, "package.json");
    const pkgContent = await fs.readFile(pkgJsonPath, "utf8");
    const pkg = JSON.parse(pkgContent);

    if (pkg.workspaces) {
      if (Array.isArray(pkg.workspaces)) {
        pkg.workspaces.forEach((w: string) => globs.add(w));
      } else if (pkg.workspaces.packages && Array.isArray(pkg.workspaces.packages)) {
        pkg.workspaces.packages.forEach((w: string) => globs.add(w));
      }
    }
  } catch (err) {
    // No package.json or invalid
  }

  // 2. Check pnpm-workspace.yaml
  try {
    const pnpmPath = path.join(repoTempDir, "pnpm-workspace.yaml");
    const pnpmContent = await fs.readFile(pnpmPath, "utf8");

    // Try parsing as YAML-like structure
    const lines = pnpmContent.split("\n");
    let inPackages = false;
    let isArrayFormat = false;

    for (const line of lines) {
      const trimmed = line.trim();

      // Detect array format: packages: ["apps/*", "packages/*"]
      if (trimmed.startsWith("packages:") && trimmed.includes("[")) {
        inPackages = true;
        isArrayFormat = true;
        continue;
      }

      if (inPackages && isArrayFormat) {
        // Parse array items: ["apps/*"] or ["packages/*"]
        const itemMatch = trimmed.match(/^\[?\s*['"]?([^'"\]]+)['"]?/);
        if (itemMatch && itemMatch[1]) {
          globs.add(itemMatch[1]);
        }
        // Exit array format if we hit a line without quotes or brackets
        if (trimmed.includes("]")) {
          inPackages = false;
          isArrayFormat = false;
        }
        continue;
      }

      if (trimmed.startsWith("packages:")) {
        inPackages = true;
        isArrayFormat = false;
        continue;
      }

      if (inPackages && !isArrayFormat) {
        const match = trimmed.match(/^\s*-\s*['"]?([^'"]+)['"]?/);
        if (match && match[1]) {
          globs.add(match[1]);
        } else if (trimmed && !trimmed.startsWith("#") && !trimmed.startsWith("-")) {
          // If we hit a line that's not a list item or comment, we're likely out of the block
          inPackages = false;
        }
      }
    }
  } catch (err) {
    // No pnpm-workspace.yaml
  }

  if (globs.size === 0) {
    return [];
  }

  return resolveWorkspaceGlobs(repoTempDir, Array.from(globs));
}