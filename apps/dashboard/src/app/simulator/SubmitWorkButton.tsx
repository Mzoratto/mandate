"use client";

import { useFormStatus } from "react-dom";

export default function SubmitWorkButton({ enabled }: { enabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="alexa-submit" type="submit" disabled={pending || !enabled}>
      {pending ? "Preparing bounded work…" : enabled ? "Prepare bounded work" : "MCP unavailable"}
    </button>
  );
}
