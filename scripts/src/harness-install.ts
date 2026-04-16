import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { classifySkills, classifyPlugins, groupBySource } from "./classify.js";

const execFileAsync = promisify(execFile);

async function readJsonFile<T>(filePath: string, fallback: T | null = null): Promise<T | null> {
  try {
    const content = await readFile(filePath, "utf8");
    return JSON.parse(content) as T;
  } catch {
    return fallback;
  }
}

async function runCommand(
  command: string,
  args: string[]
): Promise<{ ok: true; stdout: string } | { ok: false; error: string; stdout: string }> {
  try {
    const { stdout } = await execFileAsync(command, args, { encoding: "utf8" });
    return { ok: true, stdout };
  } catch (err: unknown) {
    const e = err as { message: string; stdout?: string };
    return { ok: false, error: e.message, stdout: e.stdout ?? "" };
  }
}

async function getInstalledSkills(globalFlag: boolean): Promise<string[]> {
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
      return parsed.map((s) => (typeof s === "string" ? s : (s.name ?? s)));
    }
    return [];
  } catch {
    return [];
  }
}

async function installSkillGroup({
  source,
  scope,
  names,
}: {
  source: string;
  scope: string;
  names: string[];
}): Promise<{ name: string; source: string; scope: string; result: string; error?: string }[]> {
  const isGlobal = scope === "global";
  const args = ["skills", "add", source];
  for (const name of names) {
    args.push("--skill", name);
  }
  args.push("-y");
  if (isGlobal) {
    args.push("-g");
  }
  const result = await runCommand("npx", args);
  return names.map((name) => ({
    name,
    source,
    scope: scope ?? "project",
    result: result.ok ? "success" : "error",
    ...(result.ok ? {} : { error: (result as { ok: false; error: string }).error }),
  }));
}

async function installPlugin(name: string, scope: string): Promise<{ ok: boolean; error?: string }> {
  const result = await runCommand("claude", ["plugins", "install", name, "-s", scope]);
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

async function updatePlugin(name: string, scope: string): Promise<{ ok: boolean; error?: string }> {
  const result = await runCommand("claude", ["plugins", "update", name, "-s", scope]);
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

async function getInstalledPlugins(): Promise<Record<string, { version: string }>> {
  const pluginsPath = join(homedir(), ".claude", "plugins", "installed_plugins.json");
  const data = await readJsonFile<Record<string, { version: string }>>(pluginsPath, {});
  return data ?? {};
}

async function fetchManifestFromUrl(url: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (err: unknown) {
    throw new Error(`fetch failed: ${(err as Error).message}`);
  }
  if (!response.ok) {
    throw new Error(`fetch failed: ${response.status} ${response.statusText}`);
  }
  try {
    return await response.json();
  } catch (err: unknown) {
    throw new Error(`failed to parse JSON from ${url}: ${(err as Error).message}`);
  }
}

async function main(): Promise<void> {
  const urlArg = process.env.HARNESS_MANIFEST_URL ?? process.argv[2];
  const isUrl =
    typeof urlArg === "string" &&
    (urlArg.startsWith("http://") || urlArg.startsWith("https://"));

  const decisionsPath = join(process.cwd(), ".harness-decisions.json");

  type ProfileSkillSpec = { source: string; scope?: string };
  type ProfileSpec = { condition?: string; skills?: Record<string, ProfileSkillSpec> };
  let manifest: {
    skills?: Record<string, { source: string; scope?: string; condition?: string }>;
    profiles?: Record<string, ProfileSpec>;
    plugins?: Record<string, { version?: string; scope?: string; condition?: string }>;
  } | null;
  if (isUrl) {
    try {
      manifest = (await fetchManifestFromUrl(urlArg)) as typeof manifest;
    } catch (err: unknown) {
      process.stdout.write(
        JSON.stringify({
          installed: [],
          already_installed: [],
          needs_evaluation: [],
          skipped_by_decision: [],
          errors: [{ message: (err as Error).message }],
        }) + "\n"
      );
      process.exit(1);
    }
  } else {
    const manifestPath = join(homedir(), ".config", "harness", "manifest.json");
    manifest = await readJsonFile<typeof manifest>(manifestPath, null);
    if (!manifest) {
      process.stdout.write(
        JSON.stringify({
          installed: [],
          already_installed: [],
          needs_evaluation: [],
          skipped_by_decision: [],
          errors: [{ message: `manifest not found: ${manifestPath}` }],
        }) + "\n"
      );
      process.exit(1);
    }
  }

  const decisions = await readJsonFile<{
    decisions?: {
      skills?: Record<string, { install: boolean; reason?: string }>;
      profiles?: Record<string, { apply: boolean; reason?: string }>;
      plugins?: Record<string, { install: boolean; reason?: string }>;
    };
  }>(decisionsPath, { decisions: { skills: {}, profiles: {}, plugins: {} } } as never);
  const skillDecisions = decisions?.decisions?.skills ?? {};
  const profileDecisions = decisions?.decisions?.profiles ?? {};
  const pluginDecisions = decisions?.decisions?.plugins ?? {};

  const [globalInstalled, localInstalled] = await Promise.all([
    getInstalledSkills(true),
    getInstalledSkills(false),
  ]);

  const globalInstalledSet = new Set(globalInstalled);
  const localInstalledSet = new Set(localInstalled);

  const skills = manifest!.skills ?? {};
  const profiles = manifest!.profiles ?? {};
  const manifestPlugins = manifest!.plugins ?? {};

  const { alreadyInstalled, toInstall, needsEvaluation, skippedByDecision } =
    classifySkills(skills, skillDecisions, globalInstalledSet, localInstalledSet, profiles, profileDecisions);

  const groups = groupBySource(toInstall);

  const groupResults = await Promise.all(groups.map((group) => installSkillGroup(group)));
  const installResults = groupResults.flat();

  const installed = installResults.filter((r) => r.result === "success");
  const errors = installResults
    .filter((r) => r.result === "error")
    .map((r) => ({ name: r.name, source: r.source, message: r.error }));

  // Plugin classification and installation
  const installedPlugins = await getInstalledPlugins();
  const classifiedPlugins = classifyPlugins(manifestPlugins, pluginDecisions, installedPlugins);

  const pluginInstallResults = await Promise.all(
    classifiedPlugins.toInstall.map(async (p) => {
      const result = await installPlugin(p.name, p.scope);
      return { ...p, result: result.ok ? "success" as const : "error" as const, error: result.error };
    })
  );

  const pluginUpdateResults = await Promise.all(
    classifiedPlugins.toUpdate.map(async (p) => {
      const result = await updatePlugin(p.name, p.scope);
      return { ...p, result: result.ok ? "success" as const : "error" as const, error: result.error };
    })
  );

  const pluginsInstalled = pluginInstallResults.filter((r) => r.result === "success");
  const pluginsUpdated = pluginUpdateResults.filter((r) => r.result === "success");
  const pluginErrors = [
    ...pluginInstallResults.filter((r) => r.result === "error"),
    ...pluginUpdateResults.filter((r) => r.result === "error"),
  ].map((r) => ({ name: r.name, message: r.error }));

  process.stdout.write(
    JSON.stringify(
      {
        installed,
        already_installed: alreadyInstalled,
        needs_evaluation: needsEvaluation,
        skipped_by_decision: skippedByDecision,
        errors: [...errors, ...pluginErrors],
        plugins_installed: pluginsInstalled,
        plugins_updated: pluginsUpdated,
        plugins_already_installed: classifiedPlugins.alreadyInstalled,
        plugins_needs_evaluation: classifiedPlugins.needsEvaluation,
        plugins_skipped_by_decision: classifiedPlugins.skippedByDecision,
      },
      null,
      2
    ) + "\n"
  );
}

main().catch((err: unknown) => {
  process.stdout.write(
    JSON.stringify({
      installed: [],
      already_installed: [],
      needs_evaluation: [],
      skipped_by_decision: [],
      errors: [{ message: (err as Error).message }],
    }) + "\n"
  );
  process.exit(1);
});
