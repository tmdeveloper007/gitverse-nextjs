"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { AnalysisDetailSkeleton } from "@/components/analysis/AnalysisDetailSkeleton";
import { AnalysisFailureState } from "@/components/analysis/AnalysisFailureState";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { EmptyState } from "@/components/ui";
import { Activity } from "lucide-react";

export default function AnalysisJobPage() {
  const router = useRouter();
  const params = useParams();

  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params?.jobId) {
      setLoading(false); // don't leave skeleton stuck forever
      return;
    }

    let cancelled = false;
    setLoading(true);
    setData(null);
    setError(null);

    const token = localStorage.getItem("gitverse_token");

    fetch(`/api/analysis-jobs/${params.jobId}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
      .then(async (res) => {
        if (!res.ok) {
          await res.json().catch(() => null);
          // Fix 2 applied here — sanitized message, not raw API error
          const status = res.status;
          if (status === 401 || status === 403) {
            throw new Error("You do not have permission to view this analysis.");
          }
          if (status === 404) {
            throw new Error("This analysis could not be found.");
          }
          throw new Error("Failed to load analysis. Please try again.");
        }
        return res.json();
      })
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true; // cancel stale responses on cleanup
    };
  }, [params?.jobId]);

  if (loading) return <AnalysisDetailSkeleton />;

  if (error) return <AnalysisFailureState message={error} />;

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      textAlign: "center",
      padding: "2rem"
    }}>
      <h2 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
        No Analysis Jobs Found
      </h2>
      <p style={{ color: "#888", marginBottom: "1.5rem" }}>
        {data ? "Analysis job details will appear here." : "You haven't created any analysis jobs yet."}
      </p>
      <button
        onClick={() => router.push("/analyze")}
        style={{
          backgroundColor: "#2563eb",
          color: "white",
          padding: "0.5rem 1.5rem",
          borderRadius: "8px",
          border: "none",
          cursor: "pointer",
          fontSize: "1rem"
        }}
      >
        + Create New Job
      </button>
    </div>
    <DashboardLayout>
      <div className="flex items-center justify-center min-h-[60vh]">
        <EmptyState
          icon={Activity}
          title="No Analysis Jobs Found"
          description="You haven't created any analysis jobs yet."
          actionLabel="Create New Job"
          onAction={() => router.push("/analyze")}
        />
      </div>
    </DashboardLayout>
  );
}
