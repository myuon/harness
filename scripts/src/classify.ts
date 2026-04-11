export type SkillSpec = {
  source: string;
  scope?: string;
  condition?: string;
};

export type SkillDecision = {
  install: boolean;
  reason?: string;
};

export type ClassifiedSkills = {
  alreadyInstalled: { name: string; source: string; scope: string }[];
  toInstall: { name: string; source: string; scope: string }[];
  needsEvaluation: { name: string; source: string; condition: string }[];
  skippedByDecision: { name: string; reason: string }[];
};

export function classifySkills(
  skills: Record<string, SkillSpec>,
  skillDecisions: Record<string, SkillDecision>,
  globalInstalledSet: Set<string>,
  localInstalledSet: Set<string>
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
