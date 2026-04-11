import { describe, it, expect } from "vitest";
import { classifySkills, groupBySource } from "./classify.js";

// ---------------------------------------------------------------------------
// classifySkills
// ---------------------------------------------------------------------------

describe("classifySkills", () => {
  const empty = new Set<string>();

  describe("condition: always", () => {
    it("未インストール → toInstall", () => {
      const skills = {
        "my-skill": { source: "gh:owner/repo", condition: "always" },
      };
      const result = classifySkills(skills, {}, empty, empty);
      expect(result.toInstall).toEqual([
        { name: "my-skill", source: "gh:owner/repo", scope: "project" },
      ]);
      expect(result.alreadyInstalled).toHaveLength(0);
    });

    it("インストール済み → alreadyInstalled", () => {
      const skills = {
        "my-skill": { source: "gh:owner/repo", condition: "always" },
      };
      const localInstalled = new Set(["my-skill"]);
      const result = classifySkills(skills, {}, empty, localInstalled);
      expect(result.alreadyInstalled).toEqual([
        { name: "my-skill", source: "gh:owner/repo", scope: "project" },
      ]);
      expect(result.toInstall).toHaveLength(0);
    });

    it("condition 省略時も always と同じ扱い", () => {
      const skills = {
        "my-skill": { source: "gh:owner/repo" },
      };
      const result = classifySkills(skills, {}, empty, empty);
      expect(result.toInstall).toHaveLength(1);
    });
  });

  describe("condition: 自然言語", () => {
    it("decisions なし → needsEvaluation", () => {
      const skills = {
        "my-skill": {
          source: "gh:owner/repo",
          condition: "use when working with TypeScript",
        },
      };
      const result = classifySkills(skills, {}, empty, empty);
      expect(result.needsEvaluation).toEqual([
        {
          name: "my-skill",
          source: "gh:owner/repo",
          condition: "use when working with TypeScript",
        },
      ]);
      expect(result.toInstall).toHaveLength(0);
    });
  });

  describe("decision あり", () => {
    it("decision.install: true + 未インストール → toInstall", () => {
      const skills = {
        "my-skill": {
          source: "gh:owner/repo",
          condition: "use when working with TypeScript",
        },
      };
      const decisions = { "my-skill": { install: true } };
      const result = classifySkills(skills, decisions, empty, empty);
      expect(result.toInstall).toEqual([
        { name: "my-skill", source: "gh:owner/repo", scope: "project" },
      ]);
    });

    it("decision.install: true + インストール済み → alreadyInstalled", () => {
      const skills = {
        "my-skill": {
          source: "gh:owner/repo",
          condition: "use when working with TypeScript",
        },
      };
      const decisions = { "my-skill": { install: true } };
      const localInstalled = new Set(["my-skill"]);
      const result = classifySkills(skills, decisions, empty, localInstalled);
      expect(result.alreadyInstalled).toEqual([
        { name: "my-skill", source: "gh:owner/repo", scope: "project" },
      ]);
    });

    it("decision.install: false → skippedByDecision (reason なし)", () => {
      const skills = {
        "my-skill": { source: "gh:owner/repo", condition: "always" },
      };
      const decisions = { "my-skill": { install: false } };
      const result = classifySkills(skills, decisions, empty, empty);
      expect(result.skippedByDecision).toEqual([
        { name: "my-skill", reason: "" },
      ]);
      expect(result.toInstall).toHaveLength(0);
    });

    it("decision.install: false + reason あり → skippedByDecision に reason が含まれる", () => {
      const skills = {
        "my-skill": { source: "gh:owner/repo", condition: "always" },
      };
      const decisions = {
        "my-skill": { install: false, reason: "not needed in this project" },
      };
      const result = classifySkills(skills, decisions, empty, empty);
      expect(result.skippedByDecision).toEqual([
        { name: "my-skill", reason: "not needed in this project" },
      ]);
    });
  });

  describe("scope: global", () => {
    it("scope: global は globalInstalledSet を参照する", () => {
      const skills = {
        "global-skill": { source: "gh:owner/repo", scope: "global" },
      };
      const globalInstalled = new Set(["global-skill"]);
      const result = classifySkills(skills, {}, globalInstalled, empty);
      expect(result.alreadyInstalled).toEqual([
        { name: "global-skill", source: "gh:owner/repo", scope: "global" },
      ]);
    });

    it("scope: global + localInstalledSet のみにあっても未インストール扱い", () => {
      const skills = {
        "global-skill": { source: "gh:owner/repo", scope: "global" },
      };
      const localInstalled = new Set(["global-skill"]);
      const result = classifySkills(skills, {}, empty, localInstalled);
      expect(result.toInstall).toEqual([
        { name: "global-skill", source: "gh:owner/repo", scope: "global" },
      ]);
    });
  });

  describe("scope 省略時は project 扱い", () => {
    it("scope 省略 → localInstalledSet を参照する", () => {
      const skills = {
        "local-skill": { source: "gh:owner/repo" },
      };
      const localInstalled = new Set(["local-skill"]);
      const result = classifySkills(skills, {}, empty, localInstalled);
      expect(result.alreadyInstalled).toEqual([
        { name: "local-skill", source: "gh:owner/repo", scope: "project" },
      ]);
    });

    it("scope 省略 + globalInstalledSet のみにあっても未インストール扱い", () => {
      const skills = {
        "local-skill": { source: "gh:owner/repo" },
      };
      const globalInstalled = new Set(["local-skill"]);
      const result = classifySkills(skills, {}, globalInstalled, empty);
      expect(result.toInstall).toEqual([
        { name: "local-skill", source: "gh:owner/repo", scope: "project" },
      ]);
    });
  });

  describe("複数スキルの混在", () => {
    it("各スキルが正しいカテゴリに振り分けられる", () => {
      const skills = {
        "always-new": { source: "gh:a/repo", condition: "always" },
        "always-installed": { source: "gh:a/repo", condition: "always" },
        "conditional-no-decision": {
          source: "gh:b/repo",
          condition: "use when needed",
        },
        "decided-yes": {
          source: "gh:c/repo",
          condition: "use when needed",
        },
        "decided-no": { source: "gh:d/repo", condition: "always" },
      };
      const decisions = {
        "decided-yes": { install: true },
        "decided-no": { install: false, reason: "skip" },
      };
      const localInstalled = new Set(["always-installed"]);
      const result = classifySkills(skills, decisions, empty, localInstalled);

      expect(result.toInstall.map((s) => s.name)).toContain("always-new");
      expect(result.toInstall.map((s) => s.name)).toContain("decided-yes");
      expect(result.alreadyInstalled.map((s) => s.name)).toContain(
        "always-installed"
      );
      expect(result.needsEvaluation.map((s) => s.name)).toContain(
        "conditional-no-decision"
      );
      expect(result.skippedByDecision.map((s) => s.name)).toContain(
        "decided-no"
      );
    });
  });
});

// ---------------------------------------------------------------------------
// classifySkills with profiles
// ---------------------------------------------------------------------------

describe("classifySkills - profiles", () => {
  const empty = new Set<string>();
  const noSkills = {};
  const noDecisions = {};

  describe("decision: apply: true", () => {
    it("スキル未インストール → toInstall", () => {
      const profiles = {
        "my-profile": {
          condition: "always",
          skills: { "skill-a": { source: "gh:owner/repo" } },
        },
      };
      const profileDecisions = { "my-profile": { apply: true } };
      const result = classifySkills(noSkills, noDecisions, empty, empty, profiles, profileDecisions);
      expect(result.toInstall).toEqual([
        { name: "skill-a", source: "gh:owner/repo", scope: "project" },
      ]);
      expect(result.alreadyInstalled).toHaveLength(0);
    });

    it("スキルインストール済み → alreadyInstalled", () => {
      const profiles = {
        "my-profile": {
          condition: "always",
          skills: { "skill-a": { source: "gh:owner/repo" } },
        },
      };
      const profileDecisions = { "my-profile": { apply: true } };
      const localInstalled = new Set(["skill-a"]);
      const result = classifySkills(noSkills, noDecisions, empty, localInstalled, profiles, profileDecisions);
      expect(result.alreadyInstalled).toEqual([
        { name: "skill-a", source: "gh:owner/repo", scope: "project" },
      ]);
      expect(result.toInstall).toHaveLength(0);
    });
  });

  describe("decision: apply: false", () => {
    it("profile 内の全スキルが skippedByDecision に入る", () => {
      const profiles = {
        "my-profile": {
          condition: "always",
          skills: {
            "skill-a": { source: "gh:owner/repo" },
            "skill-b": { source: "gh:owner/repo" },
          },
        },
      };
      const profileDecisions = { "my-profile": { apply: false, reason: "not needed" } };
      const result = classifySkills(noSkills, noDecisions, empty, empty, profiles, profileDecisions);
      expect(result.skippedByDecision).toEqual([
        { name: "skill-a", reason: "not needed" },
        { name: "skill-b", reason: "not needed" },
      ]);
      expect(result.toInstall).toHaveLength(0);
    });
  });

  describe("decision なし + condition: always", () => {
    it("スキル未インストール → toInstall", () => {
      const profiles = {
        "my-profile": {
          condition: "always",
          skills: { "skill-a": { source: "gh:owner/repo" } },
        },
      };
      const result = classifySkills(noSkills, noDecisions, empty, empty, profiles);
      expect(result.toInstall).toEqual([
        { name: "skill-a", source: "gh:owner/repo", scope: "project" },
      ]);
    });

    it("スキルインストール済み → alreadyInstalled", () => {
      const profiles = {
        "my-profile": {
          condition: "always",
          skills: { "skill-a": { source: "gh:owner/repo" } },
        },
      };
      const localInstalled = new Set(["skill-a"]);
      const result = classifySkills(noSkills, noDecisions, empty, localInstalled, profiles);
      expect(result.alreadyInstalled).toEqual([
        { name: "skill-a", source: "gh:owner/repo", scope: "project" },
      ]);
    });
  });

  describe("decision なし + condition: 自然言語", () => {
    it("profile 単位で needsEvaluation に入る", () => {
      const profiles = {
        "ts-profile": {
          condition: "use when working with TypeScript",
          skills: {
            "skill-a": { source: "gh:owner/repo" },
            "skill-b": { source: "gh:owner/repo2" },
          },
        },
      };
      const result = classifySkills(noSkills, noDecisions, empty, empty, profiles);
      expect(result.needsEvaluation).toEqual([
        {
          type: "profile",
          profileName: "ts-profile",
          condition: "use when working with TypeScript",
          skills: [
            { name: "skill-a", source: "gh:owner/repo" },
            { name: "skill-b", source: "gh:owner/repo2" },
          ],
        },
      ]);
      expect(result.toInstall).toHaveLength(0);
    });
  });

  describe("profile の skills に scope 指定がある場合", () => {
    it("scope: global は globalInstalledSet を参照する", () => {
      const profiles = {
        "my-profile": {
          condition: "always",
          skills: { "global-skill": { source: "gh:owner/repo", scope: "global" } },
        },
      };
      const globalInstalled = new Set(["global-skill"]);
      const result = classifySkills(noSkills, noDecisions, globalInstalled, empty, profiles);
      expect(result.alreadyInstalled).toEqual([
        { name: "global-skill", source: "gh:owner/repo", scope: "global" },
      ]);
    });

    it("scope: global + localInstalledSet のみにあっても未インストール扱い", () => {
      const profiles = {
        "my-profile": {
          condition: "always",
          skills: { "global-skill": { source: "gh:owner/repo", scope: "global" } },
        },
      };
      const localInstalled = new Set(["global-skill"]);
      const result = classifySkills(noSkills, noDecisions, empty, localInstalled, profiles);
      expect(result.toInstall).toEqual([
        { name: "global-skill", source: "gh:owner/repo", scope: "global" },
      ]);
    });
  });
});

// ---------------------------------------------------------------------------
// groupBySource
// ---------------------------------------------------------------------------

describe("groupBySource", () => {
  it("同じ source+scope のスキルがひとつのグループにまとまる", () => {
    const toInstall = [
      { name: "skill-a", source: "gh:owner/repo", scope: "project" },
      { name: "skill-b", source: "gh:owner/repo", scope: "project" },
    ];
    const groups = groupBySource(toInstall);
    expect(groups).toHaveLength(1);
    expect(groups[0].source).toBe("gh:owner/repo");
    expect(groups[0].scope).toBe("project");
    expect(groups[0].names).toEqual(["skill-a", "skill-b"]);
  });

  it("異なる source は別グループになる", () => {
    const toInstall = [
      { name: "skill-a", source: "gh:owner/repo1", scope: "project" },
      { name: "skill-b", source: "gh:owner/repo2", scope: "project" },
    ];
    const groups = groupBySource(toInstall);
    expect(groups).toHaveLength(2);
    const sources = groups.map((g) => g.source);
    expect(sources).toContain("gh:owner/repo1");
    expect(sources).toContain("gh:owner/repo2");
  });

  it("同じ source でも scope が違えば別グループになる", () => {
    const toInstall = [
      { name: "skill-a", source: "gh:owner/repo", scope: "project" },
      { name: "skill-b", source: "gh:owner/repo", scope: "global" },
    ];
    const groups = groupBySource(toInstall);
    expect(groups).toHaveLength(2);
    const projectGroup = groups.find((g) => g.scope === "project");
    const globalGroup = groups.find((g) => g.scope === "global");
    expect(projectGroup?.names).toEqual(["skill-a"]);
    expect(globalGroup?.names).toEqual(["skill-b"]);
  });

  it("空配列を渡すと空配列が返る", () => {
    expect(groupBySource([])).toEqual([]);
  });

  it("3つの異なる source+scope の組み合わせがそれぞれ別グループになる", () => {
    const toInstall = [
      { name: "s1", source: "gh:a/r1", scope: "project" },
      { name: "s2", source: "gh:a/r1", scope: "global" },
      { name: "s3", source: "gh:a/r2", scope: "project" },
      { name: "s4", source: "gh:a/r1", scope: "project" },
    ];
    const groups = groupBySource(toInstall);
    expect(groups).toHaveLength(3);
    const r1Project = groups.find(
      (g) => g.source === "gh:a/r1" && g.scope === "project"
    );
    expect(r1Project?.names).toEqual(["s1", "s4"]);
  });
});
