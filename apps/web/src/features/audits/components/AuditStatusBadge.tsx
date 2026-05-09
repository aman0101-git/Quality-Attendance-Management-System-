import { StatusBadge } from "@/components/ui/StatusBadge";
import type { StatusTone } from "@/types/common";
import { AuditStatus } from "../types";

const TONE: Record<AuditStatus, StatusTone> = {
  [AuditStatus.DRAFT]: "neutral",
  [AuditStatus.IN_PROGRESS]: "info",
  [AuditStatus.SUBMITTED]: "purple",
  [AuditStatus.COMPLETED]: "success",
};

const LABEL: Record<AuditStatus, string> = {
  [AuditStatus.DRAFT]: "Draft",
  [AuditStatus.IN_PROGRESS]: "In progress",
  [AuditStatus.SUBMITTED]: "Submitted",
  [AuditStatus.COMPLETED]: "Completed",
};

interface AuditStatusBadgeProps {
  status: AuditStatus;
}

export function AuditStatusBadge({ status }: AuditStatusBadgeProps) {
  return <StatusBadge tone={TONE[status]}>{LABEL[status]}</StatusBadge>;
}

export default AuditStatusBadge;
