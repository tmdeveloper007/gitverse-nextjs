import { IssueComplexityService } from "../issue-complexity";

const mockChatRaw = jest.fn();
jest.mock("../geminiService", () => ({
  getGeminiService: () => ({
    chatRaw: mockChatRaw,
  }),
}));

describe("IssueComplexityService", () => {
  let service: IssueComplexityService;

  beforeEach(() => {
    service = new IssueComplexityService();
    jest.clearAllMocks();
  });

  describe("estimateComplexity", () => {
    it("should return complexity estimation from AI", async () => {
      mockChatRaw.mockResolvedValueOnce({
        text: JSON.stringify({
          complexity: "M",
          contributorDifficulty: "Intermediate",
          beginnerFriendly: false,
          confidence: 85,
        }),
      });

      const result = await service.estimateComplexity(
        "Bug in login",
        "There is a bug when clicking login"
      );

      expect(result.complexity).toBe("M");
      expect(result.contributorDifficulty).toBe("Intermediate");
      expect(result.beginnerFriendly).toBe(false);
      expect(result.confidence).toBe(85);
    });

    it("should handle JSON with code fences", async () => {
      mockChatRaw.mockResolvedValueOnce({
        text: "```json\n{" +
          '"complexity": "S",' +
          '"contributorDifficulty": "Beginner",' +
          '"beginnerFriendly": true,' +
          '"confidence": 90' +
          "}\n```",
      });

      const result = await service.estimateComplexity(
        "Simple docs fix",
        "Fix typo in README"
      );

      expect(result.complexity).toBe("S");
      expect(result.contributorDifficulty).toBe("Beginner");
      expect(result.beginnerFriendly).toBe(true);
      expect(result.confidence).toBe(90);
    });

    it("should return default values on error", async () => {
      mockChatRaw.mockRejectedValueOnce(new Error("AI Error"));

      const result = await service.estimateComplexity(
        "Some issue",
        "Issue description"
      );

      expect(result.complexity).toBe("M");
      expect(result.contributorDifficulty).toBe("Unknown");
      expect(result.beginnerFriendly).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it("should handle invalid JSON gracefully", async () => {
      mockChatRaw.mockResolvedValueOnce({
        text: "This is not JSON",
      });

      const result = await service.estimateComplexity(
        "Issue",
        "Description"
      );

      expect(result.complexity).toBe("M");
      expect(result.contributorDifficulty).toBe("Unknown");
    });

    it("should handle missing fields in JSON response", async () => {
      mockChatRaw.mockResolvedValueOnce({
        text: JSON.stringify({
          complexity: "XL",
        }),
      });

      const result = await service.estimateComplexity(
        "Complex issue",
        "Very complex description"
      );

      expect(result.complexity).toBe("XL");
      expect(result.contributorDifficulty).toBe("Unknown");
      expect(result.confidence).toBe(50);
    });

    it("should handle non-boolean beginnerFriendly", async () => {
      mockChatRaw.mockResolvedValueOnce({
        text: JSON.stringify({
          complexity: "L",
          contributorDifficulty: "Advanced",
          beginnerFriendly: "yes",
          confidence: 75,
        }),
      });

      const result = await service.estimateComplexity(
        "Advanced issue",
        "Description"
      );

      expect(result.beginnerFriendly).toBe(true);
    });
  });
});
