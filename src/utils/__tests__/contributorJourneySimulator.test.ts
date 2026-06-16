import { simulateContributorJourney } from "../contributorJourneySimulator";

describe("contributor journey simulator", () => {
  it("infers authentication category and ranks auth files highly", () => {
    const repository = {
      files: [
        { path: "src/auth.ts", size: 18_000 },
        { path: "src/middleware.ts", size: 9_000 },
        { path: "src/sessionService.ts", size: 11_000 },
        { path: "src/components/LoginForm.tsx", size: 12_000 },
        { path: "src/components/OAuthCallback.tsx", size: 14_000 },
        { path: "src/utils/helpers.ts", size: 6_000 },
      ],
      commits: [
        { hash: "a1b2c3d", message: "Fix auth provider flow", author: "Test User", date: new Date("2026-01-01"), filesChanged: 3 },
        { hash: "e4f5g6h", message: "Improve login session handling", author: "Test User", date: new Date("2026-01-02"), filesChanged: 2 },
      ],
    };

    const result = simulateContributorJourney(repository, {
      goal: "Add OAuth Provider",
      experienceLevel: "Intermediate",
      maxSteps: 5,
    });

    expect(result.category).toBe("Authentication");
    expect(result.learningPath[0].file).toBe("src/auth.ts");
    expect(result.learningPath.length).toBe(5);
    expect(result.estimatedTime).toBeGreaterThanOrEqual(10);
    expect(result.learningPath.some((step) => step.file === "src/middleware.ts")).toBe(true);
    expect(result.learningPath.some((step) => step.file === "src/components/OAuthCallback.tsx")).toBe(true);
  });
});
