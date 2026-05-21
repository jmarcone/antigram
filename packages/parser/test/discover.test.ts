import { beforeAll, describe, expect, it } from "vitest";
import { discoverExport } from "../src/discover.js";
import { ensureFixture, FIXTURE_ZIP } from "./fixture.js";

beforeAll(async () => {
  await ensureFixture();
});

describe("discoverExport", () => {
  it("finds the posts and comments JSON files inside the fixture", async () => {
    const discovery = await discoverExport(FIXTURE_ZIP);
    try {
      expect(discovery.postsJsonPaths).toEqual(["content/posts_1.json"]);
      expect(discovery.commentsJsonPaths).toEqual(["comments/post_comments_1.json"]);
      expect(discovery.mediaEntryCount).toBe(5);
      expect(discovery.exportVersionGuess).toBe("pre-2024");
      expect(discovery.accountInfoPath).toBe(
        "personal_information/account_information.json",
      );
    } finally {
      await discovery.zip.close();
    }
  });
});
