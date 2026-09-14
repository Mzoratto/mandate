"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prepareAgentWork, validWorkReference } from "@/lib/mandate/mcp-client";
import { viewerAuthorizationMatches } from "@/lib/viewer-auth";

export async function prepareWork(formData: FormData): Promise<never> {
  if (
    process.env.MANDATE_DASHBOARD_MODE === "illustrative"
    || !viewerAuthorizationMatches((await headers()).get("authorization"))
  ) redirect("/simulator?error=service_unavailable");
  const outcomeValue = formData.get("outcome");
  const requestKeyValue = formData.get("requestKey");
  const outcome = typeof outcomeValue === "string" ? outcomeValue.trim() : "";
  const requestKey = typeof requestKeyValue === "string" ? requestKeyValue : "";

  if (outcome.length < 10 || outcome.length > 300 || !validWorkReference(requestKey)) {
    redirect("/simulator?error=invalid_request");
  }

  let reference: string;
  try {
    reference = (await prepareAgentWork(outcome, requestKey)).reference;
  } catch {
    redirect("/simulator?error=service_unavailable");
  }
  redirect(`/simulator?reference=${encodeURIComponent(reference)}&prepared=1`);
}
