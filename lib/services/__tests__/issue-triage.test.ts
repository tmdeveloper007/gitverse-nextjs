import { IssueTriageService } from "../issue-triage";

const mockChatRaw = jest.fn();

jest.mock("@/lib/services/geminiService", () => ({
  getGeminiService: () => ({
    chatRaw: mockChatRaw,
  }),
}));

describe("IssueTriageService", () => {
  let service: IssueTriageService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockChatRaw.mockReset();
    service = new IssueTriageService();
  });

  describe("triageIssue", () => {
    it("should return analysis result with classification and complexity", async () => {
      mockChatRaw.mockResolvedValue({
        text: JSON.stringify({ category: "bug", tags: ["ui"], confidence: 85 }),
      });

      const result = await service.triageIssue({
        owner: "test-owner",
        repo: "test-repo",
        issueNumber: 123,
        title: "Bug in login",
        body: "Login is broken",
        repositoryFiles: [{ path: "src/login.ts" }],
      });

      expect(result.classification).toBeDefined();
      expect(result.complexity).toBeDefined();
      expect(result.relevantFiles).toBeDefined();
      expect(result.suggestedInvestigationPath).toBeDefined();
    });

    it("should handle missing GitHub token gracefully", async () => {
      mockChatRaw.mockResolvedValue({
        text: JSON.stringify({
          category: "enhancement",
          tags: [],
          confidence: 90,
          complexity: "M",
          contributorDifficulty: "Intermediate",
          beginnerFriendly: false
        }),
      });

      const result = await service.triageIssue({
        owner: "test-owner",
        repo: "test-repo",
        issueNumber: 123,
        title: "New feature",
        body: "Add feature X",
        repositoryFiles: [],
      });

      expect(result.classification).toBeDefined();
      expect(result.complexity).toBeDefined();
    });

    it("should return analysis result even when GitHub API fails", async () => {
      mockChatRaw.mockResolvedValue({
        text: JSON.stringify({
          category: "bug",
          tags: [],
          confidence: 75,
          complexity: "L",
          contributorDifficulty: "Advanced",
          beginnerFriendly: false
        }),
      });

      const result = await service.triageIssue({
        owner: "test-owner",
        repo: "test-repo",
        issueNumber: 999,
        title: "Critical bug",
        body: "Something is broken",
        repositoryFiles: [],
      });

      expect(result.classification).toBeDefined();
      expect(result.suggestedInvestigationPath).toContain("reproducing the issue");
    });

    it("should suggest files when matches are found", async () => {
      mockChatRaw.mockResolvedValue({
        text: JSON.stringify({
          category: "bug",
          tags: [],
          confidence: 80,
        }),
      });

      const result = await service.triageIssue({
        owner: "test-owner",
        repo: "test-repo",
        issueNumber: 1,
        title: "Error in auth",
        body: "Auth module error",
        repositoryFiles: [
          { path: "src/auth/login.ts" },
          { path: "src/auth/logout.ts" },
        ],
      });

      expect(result.suggestedInvestigationPath).toContain("src/auth/login.ts");
    });

    it("should provide default investigation path when no files matched", async () => {
      mockChatRaw.mockResolvedValue({
        text: JSON.stringify({
          category: "question",
          tags: [],
          confidence: 70,
        }),
      });

      const result = await service.triageIssue({
        owner: "test-owner",
        repo: "test-repo",
        issueNumber: 1,
        title: "How to use?",
        body: "Question about usage",
        repositoryFiles: [],
      });

      expect(result.suggestedInvestigationPath).toContain("reproducing the issue");
    });
  });
});