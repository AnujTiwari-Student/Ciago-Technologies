import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaClient } from "@prisma/client";
import {
  provisionClerkUser,
  lookupClerkIdByAuthUserId,
  type ClerkIdentity,
} from "@/integrations/clerk/provision-neon.server";

// Mock the admin Prisma client
const mockClerkUserMap = {
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  upsert: vi.fn(),
  create: vi.fn(),
};

const mockPrisma = {
  clerkUserMap: mockClerkUserMap,
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
} as unknown as PrismaClient;

const baseIdentity: ClerkIdentity = {
  clerkUserId: "clerk_test123",
  email: "test@example.com",
  emailVerified: true,
  fullName: "Test User",
};

describe("provisionClerkUser (Neon/Prisma)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns existing mapping when found by clerk_user_id", async () => {
    mockClerkUserMap.findUnique.mockResolvedValueOnce({
      authUserId: "auth-uuid-123",
    });

    const res = await provisionClerkUser(mockPrisma, baseIdentity);

    expect(res).toEqual({
      authUserId: "auth-uuid-123",
      created: false,
      reused: true,
    });
    expect(mockClerkUserMap.findUnique).toHaveBeenCalledWith({
      where: { clerkUserId: "clerk_test123" },
      select: { authUserId: true },
    });
  });

  it("returns error when clerkUserId is missing", async () => {
    const res = await provisionClerkUser(mockPrisma, {
      ...baseIdentity,
      clerkUserId: "",
    });

    expect(res).toEqual({ kind: "missing_clerk_user_id" });
  });

  it("returns error when email is missing", async () => {
    const res = await provisionClerkUser(mockPrisma, {
      ...baseIdentity,
      email: null,
    });

    expect(res).toEqual({ kind: "missing_email" });
  });

  it("links to existing mapping by verified email", async () => {
    mockClerkUserMap.findUnique.mockResolvedValueOnce(null);
    mockClerkUserMap.findFirst.mockResolvedValueOnce({
      authUserId: "existing-auth-uuid",
    });
    mockClerkUserMap.upsert.mockResolvedValueOnce({});

    const res = await provisionClerkUser(mockPrisma, baseIdentity);

    expect(res).toEqual({
      authUserId: "existing-auth-uuid",
      created: false,
      reused: true,
    });
    expect(mockClerkUserMap.findFirst).toHaveBeenCalledWith({
      where: { email: "test@example.com" },
      select: { authUserId: true },
    });
    expect(mockClerkUserMap.upsert).toHaveBeenCalled();
  });

  it("creates new auth.users row and mapping when none exist", async () => {
    mockClerkUserMap.findUnique.mockResolvedValueOnce(null);
    mockClerkUserMap.findFirst.mockResolvedValueOnce(null);

    const newAuthUserId = "new-auth-uuid-456";
    (mockPrisma.$transaction as any).mockImplementationOnce(async (fn: any) => {
      return fn({
        $queryRaw: vi.fn().mockResolvedValueOnce([{ id: newAuthUserId }]),
        clerkUserMap: {
          create: vi.fn().mockResolvedValueOnce({}),
        },
      });
    });

    const res = await provisionClerkUser(mockPrisma, baseIdentity);

    expect(res).toEqual({
      authUserId: newAuthUserId,
      created: true,
      reused: false,
    });
  });
});

describe("lookupClerkIdByAuthUserId (Neon/Prisma)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns clerk_user_id when mapping exists", async () => {
    mockClerkUserMap.findUnique.mockResolvedValueOnce({
      clerkUserId: "clerk_found",
    });

    const res = await lookupClerkIdByAuthUserId(mockPrisma, "auth-uuid-123");

    expect(res).toBe("clerk_found");
    expect(mockClerkUserMap.findUnique).toHaveBeenCalledWith({
      where: { authUserId: "auth-uuid-123" },
      select: { clerkUserId: true },
    });
  });

  it("returns null when no mapping exists", async () => {
    mockClerkUserMap.findUnique.mockResolvedValueOnce(null);

    const res = await lookupClerkIdByAuthUserId(mockPrisma, "auth-uuid-999");

    expect(res).toBeNull();
  });

  it("returns null on error", async () => {
    mockClerkUserMap.findUnique.mockRejectedValueOnce(new Error("DB error"));

    const res = await lookupClerkIdByAuthUserId(mockPrisma, "auth-uuid-123");

    expect(res).toBeNull();
  });
});
