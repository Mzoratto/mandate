import PublicDemo from "@/components/demo/PublicDemo";
import { headShaders } from "@/lib/agent-shaders";

export default function Page() {
  return <PublicDemo shaders={headShaders} />;
}
