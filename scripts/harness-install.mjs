#!/usr/bin/env node

import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function readJsonFile(filePath, fallback = null) {
  try {
    const content = await readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch {
    return fallback;
  }
}

async function runCommand(command, args) {
  try {
    const { stdout } = await execFileAsync(command, args, { encoding: "utf8" });
    return { ok: true, stdout };
  } catch (err) {
    return { ok: false, error: err.message, stdout: err.stdout || "" };
  }
}

async function getInstalledSkills(globalFlag) {
  const args = globalFlag
    ? ["skills", "ls", "-g", "--json"]
    : ["skills", "ls", "--json"];
  const result = await runCommand("npx", args);
  if (!result.ok) {
    return [];
  }
  try {
    const parsed = JSON.parse(result.stdout);
    if (Array.isArray(parsed)) {
      return parsed.map((s) => (typeof s === "string" ? s : s.name ?? s));
    }
    return [];
  } catch {
    return [];
  }
}

async function installSkill(name, source, scope) {
  const isGlobal = scope === "global";
  const args = ["skills", "add", source, "--skill", name, "-y"];
  if (isGlobal) {
    args.push("-g");
  }
  const result = await runCommand("npx", args);
  return {
    name,
    source,
    scope: scope ?? "project",
    result: result.ok ? "success" : "error",
    ...(result.ok ? {} : { error: result.error }),
  };
}

async function main() {
  const manifestPath = join(homedir(), ".config", "harness", "manifest.json");
  const decisionsPath = join(process.cwd(), ".harness-decisions.json");

  const manifest = await readJsonFile(manifestPath, null);
  if (!manifest) {
    process.stdout.write(
      JSON.stringify({
        installed: [],
        already_installed: [],
        needs_evaluation: [],
        skipped_by_decision: [],
        errors: [
          {
            message: `manifest not found: ${manifestPath}`,
          },
        ],
      }) + "\n"
    );
    process.exit(1);
  }

  const decisions = await readJsonFile(decisionsPath, {
    decisions: { skills: {}, profiles: {} },
  });
  const skillDecisions = decisions?.decisions?.skills ?? {};

  const [globalInstalled, localInstalled] = await Promise.all([
    getInstalledSkills(true),
    getInstalledSkills(false),
  ]);

  const globalInstalledSet = new Set(globalInstalled);
  const localInstalledSet = new Set(localInstalled);

  const skills = manifest.skills ?? {};

  const alreadyInstalled = [];
  const toInstall = [];
  const needsEvaluation = [];
  const skippedByDecision = [];

  for (const [name, spec] of Object.entries(skills)) {
    const source = spec.source;
    const scope = spec.scope ?? "project";
    const condition = spec.condition ?? "always";
    const decision = skillDecisions[name];

    const isGlobal = scope === "global";
    const installedSet = isGlobal ? globalInstalledSet : localInstalledSet;
    const installed = installedSet.has(name);

    if (decision) {
      if (decision.install === false) {
        skippedByDecision.push({ name, reason: decision.reason ?? "" });
      } else if (decision.install === true) {
        if (installed) {
          alreadyInstalled.push({ name, source, scope });
        } else {
          toInstall.push({ name, source, scope });
        }
      }
    } else if (condition === "always") {
      if (installed) {
        alreadyInstalled.push({ name, source, scope });
      } else {
        toInstall.push({ name, source, scope });
      }
    } else {
      needsEvaluation.push({ name, source, condition });
    }
  }

  const installResults = await Promise.all(
    toInstall.map(({ name, source, scope }) => installSkill(name, source, scope))
  );

  const installed = installResults.filter((r) => r.result === "success");
  const errors = installResults
    .filter((r) => r.result === "error")
    .map((r) => ({ name: r.name, source: r.source, message: r.error }));

  process.stdout.write(
    JSON.stringify(
      {
        installed,
        already_installed: alreadyInstalled,
        needs_evaluation: needsEvaluation,
        skipped_by_decision: skippedByDecision,
        errors,
      },
      null,
      2
    ) + "\n"
  );
}

main().catch((err) => {
  process.stdout.write(
    JSON.stringify({
      installed: [],
      already_installed: [],
      needs_evaluation: [],
      skipped_by_decision: [],
      errors: [{ message: err.message }],
    }) + "\n"
  );
  process.exit(1);
});
