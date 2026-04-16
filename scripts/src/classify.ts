export type SkillSpec = {
  source: string;
  scope?: string;
  condition?: string;
};

export type SkillDecision = {
  install: boolean;
  reason?: string;
};

export type ProfileSkillSpec = {
  source: string;
  scope?: string;
};

export type ProfileSpec = {
  condition?: string;
  skills?: Record<string, ProfileSkillSpec>;
};

export type ProfileDecision = {
  apply: boolean;
  reason?: string;
};

export type NeedsEvaluationSkill = {
  name: string;
  source: string;
  condition: string;
};

export type NeedsEvaluationProfile = {
  type: "profile";
  profileName: string;
  condition: string;
  skills: { name: string; source: string }[];
};

export type NeedsEvaluationEntry = NeedsEvaluationSkill | NeedsEvaluationProfile;

export type ClassifiedSkills = {
  alreadyInstalled: { name: string; source: string; scope: string }[];
  toInstall: { name: string; source: string; scope: string }[];
  needsEvaluation: NeedsEvaluationEntry[];
  skippedByDecision: { name: string; reason: string }[];
};

export function classifySkills(
  skills: Record<string, SkillSpec>,
  skillDecisions: Record<string, SkillDecision>,
  globalInstalledSet: Set<string>,
  localInstalledSet: Set<string>,
  profiles?: Record<string, ProfileSpec>,
  profileDecisions?: Record<string, ProfileDecision>
): ClassifiedSkills {
  const alreadyInstalled: ClassifiedSkills["alreadyInstalled"] = [];
  const toInstall: ClassifiedSkills["toInstall"] = [];
  const needsEvaluation: ClassifiedSkills["needsEvaluation"] = [];
  const skippedByDecision: ClassifiedSkills["skippedByDecision"] = [];

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

  if (profiles) {
    const resolvedProfileDecisions = profileDecisions ?? {};

    for (const [profileName, profileSpec] of Object.entries(profiles)) {
      const profileSkills = Object.entries(profileSpec.skills ?? {});
      if (profileSkills.length === 0) continue;

      const condition = profileSpec.condition ?? "always";
      const decision = resolvedProfileDecisions[profileName];

      if (decision) {
        if (decision.apply === false) {
          for (const [skillName] of profileSkills) {
            skippedByDecision.push({ name: skillName, reason: decision.reason ?? "" });
          }
        } else if (decision.apply === true) {
          for (const [skillName, skillSpec] of profileSkills) {
            const scope = skillSpec.scope ?? "project";
            const isGlobal = scope === "global";
            const installedSet = isGlobal ? globalInstalledSet : localInstalledSet;
            const installed = installedSet.has(skillName);
            if (installed) {
              alreadyInstalled.push({ name: skillName, source: skillSpec.source, scope });
            } else {
              toInstall.push({ name: skillName, source: skillSpec.source, scope });
            }
          }
        }
      } else if (condition === "always") {
        for (const [skillName, skillSpec] of profileSkills) {
          const scope = skillSpec.scope ?? "project";
          const isGlobal = scope === "global";
          const installedSet = isGlobal ? globalInstalledSet : localInstalledSet;
          const installed = installedSet.has(skillName);
          if (installed) {
            alreadyInstalled.push({ name: skillName, source: skillSpec.source, scope });
          } else {
            toInstall.push({ name: skillName, source: skillSpec.source, scope });
          }
        }
      } else {
        needsEvaluation.push({
          type: "profile",
          profileName,
          condition,
          skills: profileSkills.map(([name, { source }]) => ({ name, source })),
        });
      }
    }
  }

  return { alreadyInstalled, toInstall, needsEvaluation, skippedByDecision };
}

export type InstallItem = {
  name: string;
  source: string;
  scope: string;
};

export type InstallGroup = {
  source: string;
  scope: string;
  names: string[];
};

// ---------------------------------------------------------------------------
// Plugin classification
// ---------------------------------------------------------------------------

export type PluginSpec = {
  version?: string; // optional; undefined or "latest" = always track latest
  scope?: string; // "user" | "project" | "local", default "user"
  condition?: string;
};

export type PluginDecision = {
  install: boolean;
  reason?: string;
};

export type InstalledPluginInfo = {
  version: string;
};

export type ClassifiedPlugins = {
  alreadyInstalled: { name: string; version: string; scope: string }[];
  toInstall: { name: string; version: string; scope: string }[];
  toUpdate: { name: string; version: string; currentVersion: string; scope: string }[];
  needsEvaluation: { name: string; version: string; condition: string }[];
  skippedByDecision: { name: string; reason: string }[];
};

export function classifyPlugins(
  plugins: Record<string, PluginSpec>,
  pluginDecisions: Record<string, PluginDecision>,
  installedPlugins: Record<string, InstalledPluginInfo>
): ClassifiedPlugins {
  const alreadyInstalled: ClassifiedPlugins["alreadyInstalled"] = [];
  const toInstall: ClassifiedPlugins["toInstall"] = [];
  const toUpdate: ClassifiedPlugins["toUpdate"] = [];
  const needsEvaluation: ClassifiedPlugins["needsEvaluation"] = [];
  const skippedByDecision: ClassifiedPlugins["skippedByDecision"] = [];

  for (const [name, spec] of Object.entries(plugins)) {
    const version: string | undefined = spec.version;
    const scope = spec.scope ?? "user";
    const condition = spec.condition ?? "always";
    const decision = pluginDecisions[name];

    if (decision && decision.install === false) {
      skippedByDecision.push({ name, reason: decision.reason ?? "" });
      continue;
    }

    const shouldInstall = (decision && decision.install === true) || condition === "always";

    if (shouldInstall) {
      const installed = installedPlugins[name];
      const isLatest = version === undefined || version === "latest";
      const manifestVersion = isLatest ? "latest" : version;
      if (!installed) {
        toInstall.push({ name, version: manifestVersion, scope });
      } else if (isLatest) {
        // Always update when tracking latest
        toUpdate.push({ name, version: "latest", currentVersion: installed.version, scope });
      } else if (installed.version !== version) {
        toUpdate.push({ name, version: manifestVersion, currentVersion: installed.version, scope });
      } else {
        alreadyInstalled.push({ name, version: manifestVersion, scope });
      }
    } else {
      needsEvaluation.push({ name, version: version ?? "latest", condition });
    }
  }

  return { alreadyInstalled, toInstall, toUpdate, needsEvaluation, skippedByDecision };
}

export function groupBySource(toInstall: InstallItem[]): InstallGroup[] {
  const groupMap = new Map<string, InstallGroup>();
  for (const { name, source, scope } of toInstall) {
    const key = `${source}\0${scope ?? "project"}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, { source, scope: scope ?? "project", names: [] });
    }
    groupMap.get(key)!.names.push(name);
  }
  return Array.from(groupMap.values());
}
