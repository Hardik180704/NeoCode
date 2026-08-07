import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

type AuthData = {
  token: string;
};

const AUTH_DIR = join(homedir(), ".neocode");
const AUTH_FILE = join(AUTH_DIR, "auth.json");

export function getAuth(): AuthData | null {
  try {
    const data = readFileSync(AUTH_FILE, "utf-8");
    const parsed = JSON.parse(data) as Partial<AuthData>;

    return typeof parsed.token === "string"
      ? { token: parsed.token }
      : null;
  } catch {
    return null;
  }
}

export function saveAuth(data: AuthData): void {
  if (!existsSync(AUTH_DIR)) {
    // Keep locally stored credentials private to the current OS user.
    mkdirSync(AUTH_DIR, { mode: 0o700 });
  }

  writeFileSync(AUTH_FILE, JSON.stringify(data), { mode: 0o600 });
}

export function clearAuth(): void {
  try {
    unlinkSync(AUTH_FILE);
  } catch {
    // The auth file may not exist yet.
  }
}
