/**
 * Repository analysis data used for contribution path generation
 */
export interface RepositoryAnalysisData {
  id?: string;
  name?: string;
  url?: string;
  defaultBranch?: string;
  readmeText?: string | null;
  readmePath?: string | null;
  languages?: Array<{
    name: string;
    lines?: number;
  }>;
  commits?: Array<any>;
  contributors?: Array<any>;
  openIssues?: number;
  description?: string;
  stars?: number;
  forks?: number;
  watchers?: number;
  size?: number;
  createdAt?: string;
  updatedAt?: string;
  analyzedAt?: string;
  license?: string;
  fullName?: string;
  primaryLanguage?: string;
  subPackages?: Array<{
    id: string;
    targetDirectory: string;
    status: string;
  }>;
  // File analysis data
  files?: Array<{
    path: string;
    size: number;
    type: 'file' | 'directory';
    importance?: number;
    category?: string;
  }>;
  // Dependencies analysis
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}
