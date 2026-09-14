import MandateShell from "@/components/mandate/MandateShell";
import { headShaders } from "@/lib/agent-shaders";
import { loadDashboardSource } from "@/lib/mandate/live";

export default async function DashboardPage() {
  return <MandateShell source={await loadDashboardSource()} shaders={headShaders} />;
}
