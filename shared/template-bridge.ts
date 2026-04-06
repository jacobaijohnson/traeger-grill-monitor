/**
 * Bridge utility to convert legacy CookTemplate (from cook-templates.ts)
 * into the richer CookProgram format used by the unified Cook Programs page.
 */
import type { CookTemplate, CookStage } from "./traeger-types";
import type { CookProgram, ProgramStep, StepTrigger, StepAction } from "./cook-programs";

/**
 * Convert a legacy CookStage to a ProgramStep.
 */
function stageToStep(stage: CookStage, index: number): ProgramStep {
  // Map legacy trigger types
  const trigger: StepTrigger = {
    type: stage.triggerType === "time" ? "timer"
      : stage.triggerType === "probe_temp" ? "probe_temp"
      : "manual",
    value: stage.triggerType === "manual" ? undefined : stage.triggerValue,
  };

  // Entry actions: set grill temp + optional super smoke
  const entryActions: StepAction[] = [
    { type: "set_grill_temp", params: { temp: stage.grillTemp } },
  ];
  if (stage.superSmoke) {
    entryActions.push({ type: "super_smoke_on" });
  }

  // Trigger actions: notification
  const actions: StepAction[] = [];
  if (stage.alertMessage) {
    actions.push({ type: "send_notification", params: { message: stage.alertMessage } });
  }

  return {
    name: stage.name,
    description: stage.alertMessage || undefined,
    trigger,
    entryActions,
    actions,
    alertOnTrigger: stage.alertMessage ? {
      type: "notification",
      message: stage.alertMessage,
    } : undefined,
  };
}

/**
 * Convert a legacy CookTemplate to a CookProgram.
 * The resulting program can be displayed alongside native CookPrograms
 * in the unified Cook Programs page.
 */
export function templateToProgram(template: CookTemplate): CookProgram & { sourceTemplateId: string } {
  const methodMap: Record<string, CookProgram["method"]> = {
    smoke: "smoke",
    grill: "grill",
    reverse_sear: "reverse_sear",
    roast: "roast",
    bake: "bake",
  };

  const variables = [];
  if (template.weightBased && template.timePerPound) {
    variables.push({
      name: "meat_weight_lbs",
      label: "Meat Weight",
      type: "number" as const,
      default: 10,
      min: 2,
      max: 30,
      unit: "lbs",
      description: `Estimated ${template.timePerPound} min/lb cook time`,
    });
  }

  return {
    sourceTemplateId: template.id,
    name: template.name,
    description: template.description,
    category: template.category as CookProgram["category"],
    method: methodMap[template.method] || "smoke",
    meatCut: template.cut,
    difficulty: "intermediate",
    estimatedTime: template.estimatedTime,
    tags: [template.category, template.method, template.cut.toLowerCase()],
    variables,
    steps: template.stages.map((stage, i) => stageToStep(stage, i)),
    tips: template.tips,
  };
}

/**
 * Convert an array of legacy CookTemplates to CookPrograms.
 */
export function templatesToPrograms(templates: CookTemplate[]): (CookProgram & { sourceTemplateId: string })[] {
  return templates.map(templateToProgram);
}
