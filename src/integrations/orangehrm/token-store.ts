import fs from "node:fs/promises";
import path from "node:path";

export interface OrangeHRMStoredToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

const TOKEN_FILE = path.resolve(process.cwd(), ".orangehrm-token.json");

export async function saveToken(token: OrangeHRMStoredToken): Promise<void> {
  await fs.writeFile(TOKEN_FILE, JSON.stringify(token, null, 2), "utf8");
}

export async function loadToken(): Promise<OrangeHRMStoredToken | null> {
  try {
    const raw = await fs.readFile(TOKEN_FILE, "utf8");

    return JSON.parse(raw);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;

    if (err.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

export async function deleteToken(): Promise<void> {
  try {
    await fs.unlink(TOKEN_FILE);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;

    if (err.code !== "ENOENT") {
      throw error;
    }
  }
}
