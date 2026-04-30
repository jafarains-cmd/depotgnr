import { randomBytes } from "crypto";

export function generateTrackingToken(): string {
  return randomBytes(8).toString("hex");
}
