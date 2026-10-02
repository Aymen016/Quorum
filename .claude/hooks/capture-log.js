#!/usr/bin/env node
// Agent capture hook for Claude Code.
//
// Wired to UserPromptSubmit and Stop in .claude/settings.json. On every fire it
// rebuilds .agent-logs/<first-prompt-time>_<session-id>.md from the full session
// transcript (the JSONL path Claude Code passes on stdin), so the log is always a
// complete, deterministic projection of the transcript: prompts verbatim, plus the
// final assistant text of each turn. Thinking, tool calls and intermediate text are
// deliberately excluded.
//
// On UserPromptSubmit the new prompt may not be in the transcript yet, so it is
// appended from the hook payload as a pending entry; the next Stop rebuild replaces
// it with the transcript's copy and the response.
//
// The hook never blocks Claude: any failure is written to .agent-logs/hook-errors.log
// and the process exits 0.

const fs = require("fs");
const path = require("path");

const AUTHOR = "Aymen016";
const PROJECT = "quorum";
const TOOL = "claude-code";

const repoRoot = path.resolve(__dirname, "..", "..");
const logDir = path.join(repoRoot, ".agent-logs");

function readStdin() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function textOf(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((b) => b && b.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("\n\n");
}

function hasToolResult(content) {
  return Array.isArray(content) && content.some((b) => b && b.type === "tool_result");
}

function isInterruptMarker(text) {
  return /^\[Request interrupted by user/.test(text.trim());
}

// A user entry that starts a new turn: typed (or injected) text, not a tool result,
// not a harness meta message, not part of a subagent.
function isPromptEntry(o) {
  if (o.type !== "user" || !o.message) return false;
  if (o.isSidechain || o.isMeta || o.isCompactSummary || o.isVisibleInTranscriptOnly) return false;
  const c = o.message.content;
  if (hasToolResult(c)) return false;
  return textOf(c).trim().length > 0;
}

function parseTranscript(transcriptPath) {
  const raw = fs.readFileSync(transcriptPath, "utf8");
  const entries = [];
  const seen = new Set();
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let o;
    try {
      o = JSON.parse(line);
    } catch {
      continue; // a partially written final line
    }
    if (o.uuid) {
      if (seen.has(o.uuid)) continue;
      seen.add(o.uuid);
    }
    entries.push(o);
  }

  const turns = [];
  let cur = null;
  for (const o of entries) {
    if (isPromptEntry(o)) {
      const text = textOf(o.message.content);
      if (isInterruptMarker(text)) {
        if (cur) cur.interrupted = true;
        continue;
      }
      cur = { prompt: text, promptTime: o.timestamp, assistant: [], interrupted: false };
      turns.push(cur);
      continue;
    }
    if (!cur || o.isSidechain) continue;
    if (o.type === "assistant" && o.message && Array.isArray(o.message.content)) {
      cur.assistant.push(o);
    }
  }

  return turns.map((t) => {
    // Final response = assistant text after the last tool call of the turn.
    let tail = [];
    for (const a of t.assistant) {
      const blocks = a.message.content;
      if (blocks.some((b) => b && b.type === "tool_use")) {
        tail = [];
        continue;
      }
      const txt = textOf(blocks);
      if (txt.trim()) tail.push({ text: txt, time: a.timestamp, model: a.message.model });
    }
    const models = t.assistant.map((a) => a.message.model).filter((m) => m && m !== "<synthetic>");
    let response = tail.map((x) => x.text).join("\n\n");
    let responseTime = tail.length ? tail[tail.length - 1].time : null;
    if (!response && t.interrupted) response = "(turn interrupted by user before a final response)";
    return {
      prompt: t.prompt,
      promptTime: t.promptTime,
      response,
      responseTime,
      model: models[0] || null,
      responseModel: tail.length ? tail[tail.length - 1].model : models[models.length - 1] || null,
    };
  });
}

function fileStamp(iso) {
  // 2026-10-02T17:29:06.694Z -> 2026-10-02_17-29-06
  return iso.slice(0, 19).replace("T", "_").replace(/:/g, "-");
}

function render(sessionId, turns) {
  const short = sessionId.slice(0, 8);
  let lastModel = "unknown";
  for (const t of turns) {
    t.model = t.model || lastModel;
    t.responseModel = t.responseModel || t.model;
    lastModel = t.responseModel;
  }
  const models = [...new Set(turns.flatMap((t) => [t.model, t.responseModel]).filter((m) => m && m !== "unknown"))];
  const first = turns[0].promptTime;
  const last = turns[turns.length - 1].promptTime;

  const out = [];
  out.push("---");
  out.push(`session_id: ${sessionId}`);
  out.push(`date: ${first.slice(0, 10)}`);
  out.push(`author: ${AUTHOR}`);
  out.push(`model: ${models.join(", ") || "unknown"}`);
  out.push(`tool: ${TOOL}`);
  out.push(`project: ${PROJECT}`);
  out.push(`total_exchanges: ${turns.length}`);
  out.push(`first_prompt_time: ${first}`);
  out.push(`last_prompt_time: ${last}`);
  out.push("---");
  out.push("");
  out.push(`# Session Log - ${first.slice(0, 10)}`);
  out.push("");
  out.push(`Session: \`${short}\` | Project: \`${PROJECT}\` | Author: \`${AUTHOR}\``);
  out.push("");
  out.push("---");
  out.push("");

  turns.forEach((t, i) => {
    const n = i + 1;
    out.push(`[LOG_ENTRY type=PROMPT num=${n} session=${short}]`);
    out.push(`timestamp: ${t.promptTime}`);
    out.push(`model: ${t.model}`);
    out.push("");
    out.push(t.prompt);
    out.push("");
    out.push("");
    if (t.response) {
      out.push(`[LOG_ENTRY type=RESPONSE num=${n} session=${short}]`);
      out.push(`timestamp: ${t.responseTime || t.promptTime}`);
      out.push(`model: ${t.responseModel}`);
      out.push("");
      out.push(t.response);
      out.push("");
      out.push("");
    }
  });
  return out.join("\n");
}

function main() {
  const input = JSON.parse(readStdin() || "{}");
  const sessionId = input.session_id;
  const transcriptPath = input.transcript_path;
  if (!sessionId || !transcriptPath) throw new Error("hook payload missing session_id/transcript_path");

  const turns = fs.existsSync(transcriptPath) ? parseTranscript(transcriptPath) : [];

  // UserPromptSubmit fires before the prompt is guaranteed to be in the transcript.
  if (input.hook_event_name === "UserPromptSubmit" && typeof input.prompt === "string") {
    const lastTurn = turns[turns.length - 1];
    if (!lastTurn || lastTurn.prompt !== input.prompt || lastTurn.response) {
      turns.push({ prompt: input.prompt, promptTime: new Date().toISOString(), response: "", responseTime: null, model: null, responseModel: null });
    }
  }
  if (!turns.length) return;

  fs.mkdirSync(logDir, { recursive: true });
  const target = path.join(logDir, `${fileStamp(turns[0].promptTime)}_${sessionId}.md`);
  const tmp = `${target}.tmp`;
  fs.writeFileSync(tmp, render(sessionId, turns), "utf8");
  fs.renameSync(tmp, target);

  // A pending first prompt can stamp a different second than the transcript's copy;
  // keep exactly one file per session.
  for (const f of fs.readdirSync(logDir)) {
    if (f.endsWith(`_${sessionId}.md`) && path.join(logDir, f) !== target) fs.unlinkSync(path.join(logDir, f));
  }
}

try {
  main();
} catch (err) {
  try {
    fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(path.join(logDir, "hook-errors.log"), `${new Date().toISOString()} ${err && err.stack ? err.stack : err}\n`);
  } catch {}
}
process.exit(0);
