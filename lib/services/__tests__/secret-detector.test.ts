import { SecretDetectorService } from "../secret-detector";

let mockChatRaw: jest.Mock;

jest.mock("@/lib/services/geminiService", () => ({
  GeminiService: jest.fn().mockImplementation(() => ({
    chatRaw: (...args: any[]) => mockChatRaw(...args),
  })),
}));

describe("SecretDetectorService", () => {
  let service: SecretDetectorService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockChatRaw = jest.fn();
    service = new SecretDetectorService();
  });

  describe("scanFile", () => {
    it("should detect AWS access key pattern", async () => {
      mockChatRaw.mockResolvedValueOnce({
        text: JSON.stringify({ isDummy: false, reason: "Real key" }),
      });

      const content = "AWS_ACCESS_KEY=AKIAIOSFODNN7EXAMPLE";
      const results = await service.scanFile("config.ts", content);

      expect(results.length).toBeGreaterThan(0);
      const awsResult = results.find(r => r.provider === "AWS");
      expect(awsResult).toBeDefined();
      expect(awsResult?.severity).toBe("Critical");
    });

    it("should detect GitHub token pattern", async () => {
      mockChatRaw.mockResolvedValueOnce({
        text: JSON.stringify({ isDummy: false, reason: "Real token" }),
      });

      const content = "const token = 'ghp_Fake00000000000000000000000000000A'";
      const results = await service.scanFile("auth.ts", content);

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.provider === "GitHub")).toBe(true);
    });

    it("should detect GCP API key pattern", async () => {
      mockChatRaw.mockResolvedValueOnce({
        text: JSON.stringify({ isDummy: false, reason: "Real key" }),
      });

      const content = "AIzaSyDi7nY5R2MNOqP8QvT3sL6kE9fGhIjKlMnOpQr";
      const results = await service.scanFile("app.ts", content);

      expect(results.length).toBeGreaterThan(0);
      const gcpResult = results.find(r => r.provider === "GCP");
      expect(gcpResult).toBeDefined();
    });

    it("should detect Stripe test key pattern", async () => {
      mockChatRaw.mockResolvedValueOnce({
        text: JSON.stringify({ isDummy: false, reason: "Test key" }),
      });

      const content = "stripe_key = 'sk_test_Abcd1234Efgh5678IJKL9012MNOP3456'";
      const results = await service.scanFile("payment.ts", content);

      expect(results.length).toBeGreaterThan(0);
      const stripeResult = results.find(r => r.provider === "Stripe");
      expect(stripeResult).toBeDefined();
    });

    it("should mask detected secrets", async () => {
      mockChatRaw.mockResolvedValueOnce({
        text: JSON.stringify({ isDummy: false, reason: "Real" }),
      });

      const content = "const key = 'ghp_Fake00000000000000000000000000000A'";
      const results = await service.scanFile("test.ts", content);

      expect(results[0].maskedMatch).toContain("*");
      expect(results[0].maskedMatch).not.toBe(results[0].match);
    });

    it("should include line number in results", async () => {
      mockChatRaw.mockResolvedValueOnce({
        text: JSON.stringify({ isDummy: false, reason: "Real" }),
      });

      const content = "line1\nline2\nconst key = 'ghp_Fake00000000000000000000000000000A'\nline4";
      const results = await service.scanFile("test.ts", content);

      expect(results[0].lineNumber).toBe(3);
    });

    it("should mark dummy secrets as Low severity", async () => {
      mockChatRaw.mockResolvedValueOnce({
        text: JSON.stringify({ isDummy: true, reason: "Example key" }),
      });

      const content = "const exampleKey = 'ghp_Fake00000000000000000000000000000A'";
      const results = await service.scanFile("test.ts", content);

      expect(results[0].severity).toBe("Low");
      expect(results[0].isLikelySafe).toBe(true);
    });

    it("should calculate entropy for detected secrets", async () => {
      mockChatRaw.mockResolvedValueOnce({
        text: JSON.stringify({ isDummy: false, reason: "Real" }),
      });

      const content = "const key = 'ghp_Fake00000000000000000000000000000A'";
      const results = await service.scanFile("test.ts", content);

      expect(results[0].entropyScore).toBeGreaterThan(0);
    });

    it("should handle multiple secrets in same file", async () => {
      mockChatRaw.mockResolvedValue({
        text: JSON.stringify({ isDummy: false, reason: "Real" }),
      });

      const content = "aws_key='AKIAIOSFODNN7EXAMPLE'\ngh_token='ghp_Fake00000000000000000000000000000A'";
      const results = await service.scanFile("config.ts", content);

      expect(results.length).toBe(2);
    });

    it("should handle empty content", async () => {
      const results = await service.scanFile("empty.ts", "");

      expect(results).toEqual([]);
    });

    it("should handle AI verification failure gracefully", async () => {
      mockChatRaw.mockRejectedValueOnce(new Error("AI Error"));

      const content = "const key = 'ghp_Fake00000000000000000000000000000A'";
      const results = await service.scanFile("test.ts", content);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].isLikelySafe).toBe(false);
    });

    it("should handle malformed AI response", async () => {
      mockChatRaw.mockResolvedValueOnce({
        text: "Not a valid JSON response",
      });

      const content = "const key = 'ghp_Fake00000000000000000000000000000A'";
      const results = await service.scanFile("test.ts", content);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].isLikelySafe).toBe(false);
    });

    it("should detect JWT tokens", async () => {
      mockChatRaw.mockResolvedValueOnce({
        text: JSON.stringify({ isDummy: true, reason: "Example JWT" }),
      });

      const content = "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
      const results = await service.scanFile("auth.ts", content);

      expect(results.length).toBeGreaterThan(0);
      const jwtResult = results.find(r => r.provider === "JWT");
      expect(jwtResult).toBeDefined();
    });

    it("should detect MongoDB connection strings", async () => {
      mockChatRaw.mockResolvedValueOnce({
        text: JSON.stringify({ isDummy: false, reason: "Real connection" }),
      });

      const content = "const db = 'mongodb://user:pass@localhost:27017/test'";
      const results = await service.scanFile("db.ts", content);

      expect(results.length).toBeGreaterThan(0);
      const mongoResult = results.find(r => r.provider === "MongoDB");
      expect(mongoResult).toBeDefined();
    });
  });
});