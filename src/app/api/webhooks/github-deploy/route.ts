import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { spawn } from "node:child_process";
import { logAudit } from "@/lib/audit";

/**
 * GitHub Webhook endpoint untuk auto-deploy saat push ke main.
 *
 * Alur:
 *  1. GitHub kirim POST setiap push
 *  2. Verify signature X-Hub-Signature-256 dengan HMAC-SHA256(body, secret)
 *  3. Cek event=push AND ref=refs/heads/main
 *  4. Spawn `sudo depot-update` async (detached), tidak tunggu selesai
 *  5. Return 200 cepat (< 10s supaya GitHub tidak retry)
 *  6. Semua deployment tercatat di audit_log
 *
 * Setup: lihat docs/AUTO_DEPLOY.md untuk instruksi lengkap
 * (env var GITHUB_WEBHOOK_SECRET, sudoers, register webhook GitHub).
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TARGET_BRANCH = "main";
const DEPLOY_COMMAND = "sudo /usr/local/bin/depot-update";
const MAX_BODY_SIZE = 1024 * 1024; // 1 MB max payload

function verifySignature(body: string, signature: string, secret: string): boolean {
  if (!signature.startsWith("sha256=")) return false;
  const expected =
    "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return false;
  try {
    return timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    // Tidak diconfigure — reject dengan 503
    return NextResponse.json(
      { error: "Webhook not configured — set GITHUB_WEBHOOK_SECRET" },
      { status: 503 },
    );
  }

  // Baca body raw (butuh untuk HMAC verify)
  const body = await req.text();
  if (body.length > MAX_BODY_SIZE) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  // Verify signature
  const signature = req.headers.get("x-hub-signature-256") ?? "";
  if (!verifySignature(body, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = req.headers.get("x-github-event") ?? "";

  // Ping event = webhook test dari GitHub UI
  if (event === "ping") {
    return NextResponse.json({ status: "pong", zen: "Webhook ready" });
  }

  // Hanya handle push event
  if (event !== "push") {
    return NextResponse.json({
      status: "ignored",
      reason: `event=${event} (only 'push' triggers deploy)`,
    });
  }

  let payload: {
    ref?: string;
    commits?: unknown[];
    head_commit?: {
      id?: string;
      message?: string;
      author?: { name?: string };
    };
  };
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const ref = payload.ref ?? "";
  if (ref !== `refs/heads/${TARGET_BRANCH}`) {
    return NextResponse.json({
      status: "ignored",
      reason: `ref=${ref} (only ${TARGET_BRANCH} triggers deploy)`,
    });
  }

  const commitCount = Array.isArray(payload.commits) ? payload.commits.length : 0;
  const headCommit = payload.head_commit?.id ?? "unknown";
  const authorName = payload.head_commit?.author?.name ?? "unknown";
  const message = (payload.head_commit?.message ?? "").split("\n")[0].slice(0, 200);

  // Log deployment trigger ke audit_log
  await logAudit({
    actorUserId: null,
    action: "deploy.webhook-triggered",
    entity: "system",
    entityId: "github-webhook",
    meta: {
      ref,
      commit: headCommit,
      shortCommit: headCommit.slice(0, 8),
      author: authorName,
      message,
      commitCount,
      triggeredAt: new Date().toISOString(),
    },
  });

  // Trigger deploy async (detached, tidak tunggu selesai)
  // Return response cepat supaya GitHub tidak retry
  try {
    const child = spawn("bash", ["-c", DEPLOY_COMMAND], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
  } catch (err) {
    await logAudit({
      actorUserId: null,
      action: "deploy.spawn-failed",
      entity: "system",
      entityId: "github-webhook",
      meta: {
        error: err instanceof Error ? err.message : String(err),
        commit: headCommit,
      },
    });
    return NextResponse.json(
      { error: "Deploy spawn failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }

  return NextResponse.json({
    status: "deployment_triggered",
    commit: headCommit.slice(0, 8),
    author: authorName,
    message,
    hint: "Cek log: journalctl -u depot-air.service -f atau /admin/audit-log",
  });
}

/**
 * GET handler untuk manual test — cek endpoint reachable & webhook configured.
 * Tidak trigger deploy, tidak butuh signature.
 */
export async function GET() {
  const configured = !!process.env.GITHUB_WEBHOOK_SECRET;
  return NextResponse.json({
    status: "ok",
    endpoint: "GitHub webhook receiver",
    configured,
    hint: configured
      ? "Webhook ready. POST from GitHub akan trigger sudo depot-update."
      : "SET GITHUB_WEBHOOK_SECRET di .env.local dulu — lihat docs/AUTO_DEPLOY.md",
  });
}
