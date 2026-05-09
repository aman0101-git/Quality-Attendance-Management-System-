import { StatusBadge } from "@/components/ui/StatusBadge";
import { ScorecardStatus } from "../types";

interface ScorecardStatusBadgeProps {
  status: ScorecardStatus;
}

export function ScorecardStatusBadge({ status }: ScorecardStatusBadgeProps) {
  return (
    <StatusBadge tone={status === ScorecardStatus.ACTIVE ? "success" : "neutral"}>
      {status === ScorecardStatus.ACTIVE ? "Active" : "Inactive"}
    </StatusBadge>
  );
}

export default ScorecardStatusBadge;
