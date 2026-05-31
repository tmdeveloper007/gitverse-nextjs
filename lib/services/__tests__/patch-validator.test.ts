import { PatchValidatorService } from "../patch-validator";

describe("PatchValidatorService", () => {
  let service: PatchValidatorService;
  const SELF_HEAL_CONFIDENCE_THRESHOLD = 85;

  beforeEach(() => {
    service = new PatchValidatorService();
  });

  describe("validatePatch", () => {
    it("should return valid status for high confidence patch", () => {
      const patch = {
        file: "test.ts",
        startLine: 1,
        endLine: 2,
        suggestionBody: "const x = 1;",
        confidenceScore: 90,
        status: "pending" as const,
      };

      const result = service.validatePatch(patch, "const y = 2;");

      expect(result.status).toBe("valid");
      expect(result.confidenceScore).toBe(90);
    });

    it("should return low_confidence status for patch below threshold", () => {
      const patch = {
        file: "test.ts",
        startLine: 1,
        endLine: 2,
        suggestionBody: "const x = 1;",
        confidenceScore: SELF_HEAL_CONFIDENCE_THRESHOLD - 1,
        status: "pending" as const,
      };

      const result = service.validatePatch(patch, "const y = 2;");

      expect(result.status).toBe("low_confidence");
    });

    it("should return low_confidence at exactly threshold boundary", () => {
      const patch = {
        file: "test.ts",
        startLine: 1,
        endLine: 2,
        suggestionBody: "const x = 1;",
        confidenceScore: 50,
        status: "pending" as const,
      };

      const result = service.validatePatch(patch, "const y = 2;");

      expect(result.status).toBe("low_confidence");
    });

    it("should return valid for .js file with valid syntax", () => {
      const patch = {
        file: "test.js",
        startLine: 1,
        endLine: 2,
        suggestionBody: "function test() { return 1; }",
        confidenceScore: 90,
        status: "pending" as const,
      };

      const result = service.validatePatch(patch, "var x = 1;");

      expect(result.status).toBe("valid");
    });

    it("should return valid for .jsx file with valid syntax", () => {
      const patch = {
        file: "Test.jsx",
        startLine: 1,
        endLine: 2,
        suggestionBody: "const Test = () => <div>Hello</div>;",
        confidenceScore: 90,
        status: "pending" as const,
      };

      const result = service.validatePatch(patch, "const Test = () => null;");

      expect(result.status).toBe("valid");
    });

    it("should return invalid_syntax for TypeScript file with syntax error", () => {
      const patch = {
        file: "test.ts",
        startLine: 1,
        endLine: 2,
        suggestionBody: "const x = {;",  // syntax error
        confidenceScore: 90,
        status: "pending" as const,
      };

      const result = service.validatePatch(patch, "const y = 2;");

      expect(result.status).toBe("invalid_syntax");
    });

    it("should return valid for non-TS/JS files without syntax check", () => {
      const patch = {
        file: "test.py",
        startLine: 1,
        endLine: 2,
        suggestionBody: "print('hello')",
        confidenceScore: 90,
        status: "pending" as const,
      };

      const result = service.validatePatch(patch, "puts 'hello'");

      expect(result.status).toBe("valid");
    });

    it("should handle empty original content", () => {
      const patch = {
        file: "test.ts",
        startLine: 1,
        endLine: 1,
        suggestionBody: "const x = 1;",
        confidenceScore: 90,
        status: "pending" as const,
      };

      const result = service.validatePatch(patch, "");

      expect(result.status).toBe("valid");
    });

    it("should handle multi-line suggestion bodies", () => {
      const patch = {
        file: "test.ts",
        startLine: 1,
        endLine: 2,
        suggestionBody: "const x = 1;\nconst y = 2;\nconst z = 3;",
        confidenceScore: 90,
        status: "pending" as const,
      };

      const result = service.validatePatch(patch, "// original\nconst x = 0;");

      expect(result.status).toBe("valid");
    });

    it("should handle startLine equal to endLine", () => {
      const patch = {
        file: "test.ts",
        startLine: 5,
        endLine: 5,
        suggestionBody: "const x = 1;",
        confidenceScore: 90,
        status: "pending" as const,
      };

      const result = service.validatePatch(patch, "line1\nline2\nline3\nline4\nline5\nline6");

      expect(result.status).toBe("valid");
    });
  });
});