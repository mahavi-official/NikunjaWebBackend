import { describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { bylineRows } from "./posts.service";

function db(existing: string[]) {
  return {
    author: {
      findMany: async ({ where }: any) =>
        existing.filter((id) => where.id.in.includes(id)).map((id) => ({ id })),
    },
  } as unknown as PrismaClient;
}

describe("bylineRows", () => {
  it("keeps the chosen order as 0-based positions", async () => {
    expect(await bylineRows(db(["a", "b", "c"]), ["c", "a"])).toEqual([
      { authorId: "c", order: 0 },
      { authorId: "a", order: 1 },
    ]);
  });

  it("drops duplicates, keeping the first position", async () => {
    expect(await bylineRows(db(["a", "b"]), ["b", "a", "b"])).toEqual([
      { authorId: "b", order: 0 },
      { authorId: "a", order: 1 },
    ]);
  });

  it("returns nothing for an empty list without querying", async () => {
    expect(await bylineRows({} as PrismaClient, [])).toEqual([]);
  });

  it("rejects ids that are not in the Authors directory", async () => {
    await expect(bylineRows(db(["a"]), ["a", "gone"])).rejects.toMatchObject({
      statusCode: 422,
      details: [{ field: "authorIds", message: expect.stringContaining("gone") }],
    });
  });
});
