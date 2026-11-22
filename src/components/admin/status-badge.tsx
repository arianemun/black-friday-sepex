import { Badge } from "@/components/admin-ui/badge";
import { statusInfo } from "@/lib/catalog";
import { cn } from "@/lib/utils";

const TONE: Record<string, string> = {
  brand: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  info: "bg-blue-100 text-blue-700 hover:bg-blue-100",
  warning: "bg-purple-100 text-purple-700 hover:bg-purple-100",
  success: "bg-green-100 text-green-700 hover:bg-green-100",
  destructive: "bg-red-100 text-red-700 hover:bg-red-100",
  secondary: "bg-gray-100 text-gray-700 hover:bg-gray-100",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const s = statusInfo(status);
  return <Badge className={cn("border-transparent font-medium", TONE[s.tone], className)}>{s.name}</Badge>;
}
