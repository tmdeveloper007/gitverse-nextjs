import { RiskAssessmentService } from "../risk-assessment";

const mockChatRaw = jest.fn();

jest.mock("@/lib/services/geminiService", () => ({
  getGeminiService: () => ({
    chatRaw: mockChatRaw,
  }),
}));

describe("RiskAssessmentService", () => {
  let service: RiskAssessmentService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockChatRaw.mockReset();
    service = new RiskAssessmentService();
  });

  describe("assessRisk", () => {
    it("should return risk assessment from AI", async () => {
      mockChatRaw.mockResolvedValueOnce({
        text: JSON.stringify({
          riskLevel: "High",
          reasoning: "Breaking API change detected",
          suggestedFollowUpChecks: ["Check imports", "Run tests"],
          confidenceScore: 90,
        }),
      });

      const result = await service.assessRisk(
        [{ path: "test.ts", content: "export function test() {}" }],
        ["consumer.ts"]
      );

      expect(result.riskLevel).toBe("High");
      expect(result.reasoning).toBe("Breaking API change detected");
      expect(result.suggestedFollowUpChecks).toEqual(["Check imports", "Run tests"]);
      expect(result.confidenceScore).toBe(90);
    });

    it("should handle JSON with code fences", async () => {
      mockChatRaw.mockResolvedValueOnce({
        text: "```json\n{" +
          '"riskLevel": "Low",' +
          '"reasoning": "Safe change",' +
          '"suggestedFollowUpChecks": [],' +
          '"confidenceScore": 95' +
          "}\n```",
      });

      const result = await service.assessRisk([], []);

      expect(result.riskLevel).toBe("Low");
      expect(result.confidenceScore).toBe(95);
    });

    it("should return default values on AI error", async () => {
      mockChatRaw.mockRejectedValueOnce(new Error("AI Error"));

      const result = await service.assessRisk([], []);

      expect(result.riskLevel).toBe("Medium");
      expect(result.reasoning).toBe("AI analysis failed or was unable to parse the result. Manual review recommended.");
      expect(result.suggestedFollowUpChecks).toEqual(["Verify downstream consumers manually."]);
      expect(result.confidenceScore).toBe(0);
    });

    it("should handle invalid JSON gracefully", async () => {
      mockChatRaw.mockResolvedValueOnce({
        text: "This is not JSON",
      });

      const result = await service.assessRisk([], []);

      expect(result.riskLevel).toBe("Medium");
      expect(result.confidenceScore).toBe(0);
    });

    it("should handle missing fields in JSON response", async () => {
      mockChatRaw.mockResolvedValueOnce({
        text: JSON.stringify({
          riskLevel: "Low",
        }),
      });

      const result = await service.assessRisk([], []);

      expect(result.riskLevel).toBe("Low");
      expect(result.reasoning).toBe("Failed to determine reasoning.");
      expect(result.suggestedFollowUpChecks).toEqual([]);
      expect(result.confidenceScore).toBe(50);
    });

    it("should handle invalid riskLevel value", async () => {
      mockChatRaw.mockResolvedValueOnce({
        text: JSON.stringify({
          riskLevel: "Invalid",
          reasoning: "Test",
          suggestedFollowUpChecks: [],
          confidenceScore: 80,
        }),
      });

      const result = await service.assessRisk([], []);

      expect(result.riskLevel).toBe("Medium");
    });

    it("should truncate long file content", async () => {
      mockChatRaw.mockResolvedValueOnce({
        text: JSON.stringify({
          riskLevel: "Low",
          reasoning: "Safe",
          suggestedFollowUpChecks: [],
          confidenceScore: 90,
        }),
      });

      const longContent = "a".repeat(10000);
      await service.assessRisk([{ path: "test.ts", content: longContent }], []);

      expect(mockChatRaw).toHaveBeenCalled();
    });

    it("should handle empty changedFilesContent", async () => {
      mockChatRaw.mockResolvedValueOnce({
        text: JSON.stringify({
          riskLevel: "Low",
          reasoning: "No files changed",
          suggestedFollowUpChecks: [],
          confidenceScore: 100,
        }),
      });

      const result = await service.assessRisk([], []);

      expect(result.riskLevel).toBe("Low");
      expect(result.confidenceScore).toBe(100);
    });
  });
});