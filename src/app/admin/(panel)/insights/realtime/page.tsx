import { requireInsights } from "@/lib/auth";
import { parseScope, realtime } from "@/lib/rec/analytics";
import { PageHeader } from "@/components/admin/page-header";
import { InsightsNav } from "@/components/admin/insights/insights-nav";
import { RealtimeView } from "@/components/admin/insights/realtime-view";

export const metadata = { title: "لحظه‌ای" };
export const dynamic = "force-dynamic";

export default async function RealtimePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireInsights();
  const scope = parseScope(await searchParams);
  return (
    <>
      <PageHeader title="رفتار بازدیدکننده‌ها" description="همین الان چه کسانی روی سایت هستند و چه می‌کنند. هر ۵ ثانیه به‌روز می‌شود." />
      <InsightsNav active="realtime" scope={scope} filters={false} />
      <RealtimeView initial={realtime()} />
    </>
  );
}
