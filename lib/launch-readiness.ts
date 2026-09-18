export type LaunchState = "done" | "attention" | "blocking";
export type VerificationKind = "automatic" | "manual" | "external";

export type LaunchCheck = {
  key: string;
  label: string;
  state: LaunchState;
  explanation: string;
  action: string;
  href: string;
  verification: VerificationKind;
};

export type LaunchSummaryKey = "publish" | "leads" | "email" | "measurement" | "meta" | "live";

export function summarizeLaunchChecks(groups: Record<LaunchSummaryKey, LaunchCheck[]>) {
  return Object.fromEntries(Object.entries(groups).map(([key, checks]) => {
    const state: LaunchState = checks.some((item) => item.state === "blocking")
      ? "blocking"
      : checks.some((item) => item.state === "attention") ? "attention" : "done";
    return [key, state];
  })) as Record<LaunchSummaryKey, LaunchState>;
}

export function launchCheck(input: Omit<LaunchCheck, "state"> & { ready: boolean; required: boolean }): LaunchCheck {
  const { ready, required, ...item } = input;
  return { ...item, state: ready ? "done" : required ? "blocking" : "attention" };
}

export function canLaunchLive(checks: LaunchCheck[]) {
  return checks.every((item) => item.state !== "blocking");
}
