import { ValidationRunnerService } from "../validation-runner";

describe("ValidationRunnerService", () => {
  let service: ValidationRunnerService;

  beforeEach(() => {
    service = new ValidationRunnerService();
  });

  describe("runValidation", () => {
    it("should return validation result for repository", async () => {
      const result = await service.runValidation("/path/to/repo", true);

      expect(result.passed).toBe(true);
      expect(result.testOutput).toBeDefined();
      expect(result.buildOutput).toBeDefined();
      expect(result.lintOutput).toBeDefined();
    });

    it("should return passed true when refactored is true", async () => {
      const result = await service.runValidation("/path/to/repo", true);

      expect(result.passed).toBe(true);
      expect(result.testOutput).toContain("PASS");
    });

    it("should return passed true when refactored is false", async () => {
      const result = await service.runValidation("/path/to/repo", false);

      expect(result.passed).toBe(true);
    });

    it("should include test output in result", async () => {
      const result = await service.runValidation("/path/to/repo", true);

      expect(result.testOutput).toContain("PASS src/index.test.ts");
    });

    it("should include build output in result", async () => {
      const result = await service.runValidation("/path/to/repo", true);

      expect(result.buildOutput).toContain("tsc --noEmit");
    });

    it("should include lint output in result", async () => {
      const result = await service.runValidation("/path/to/repo", true);

      expect(result.lintOutput).toContain("npm run lint");
    });

    it("should handle long repo paths", async () => {
      const longPath = "/very/long/path/to/some/repository/that/is/deeply/nested/and/may/cause/issues";
      const result = await service.runValidation(longPath, true);

      expect(result.passed).toBe(true);
    });

    it("should handle empty repo path", async () => {
      const result = await service.runValidation("", true);

      expect(result.passed).toBe(true);
    });
  });
});