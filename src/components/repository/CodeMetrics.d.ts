import type { FunctionComponent } from 'react';

interface CodeMetricsProps {
  repository?: {
    languages?: Array<{ name: string; percentage: number; files: number; lines: number; color: string }>;
    files?: Array<{ type: string; count: number; percentage: number; icon: string }>;
    commits?: any[];
    contributors?: any[];
    branches?: any[];
    size: number;
  };
}

export const CodeMetrics: FunctionComponent<CodeMetricsProps>;
