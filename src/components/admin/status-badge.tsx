import { Badge, requestStatusVariant } from "@/components/admin-ui";
import { statusInfo } from "@/lib/catalog";

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge variant={requestStatusVariant(status)} className={className}>
      {statusInfo(status).name}
    </Badge>
  );
}
