import { requireStaff } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { canManageShifts, type Role } from "@/lib/roles";
import { listTrainingVideos, watchLog } from "@/lib/training";
import { PageHeader } from "@/components/admin/page-header";
import { TrainingPlayer } from "@/components/admin/training-player";
import { TrainingLog } from "@/components/admin/training-log";

export const metadata = { title: "آموزش‌ها" };
export const dynamic = "force-dynamic";

export default async function TrainingPage() {
  const me = await requireStaff();
  const list = listTrainingVideos();
  const videos = list.map((v) => ({
    slug: v.slug,
    title: v.title,
    description: v.description,
    src: `/admin/training/media/${v.file}`,
    poster: v.poster ? `/admin/training/media/${v.poster}` : null,
  }));
  const showLog = canManageShifts(me.role) && list.length > 0;
  const staff = showLog
    ? (getDb()
        .prepare(
          `SELECT id, name, role FROM staff WHERE active = 1
           ORDER BY CASE role WHEN 'expert' THEN 0 WHEN 'supervisor' THEN 1 ELSE 2 END, name`,
        )
        .all() as { id: number; name: string; role: Role }[])
    : [];
  return (
    <>
      <PageHeader title="آموزش‌ها" description="ویدیوهای آموزشی کار با پنل و لندینگ. هر کدام را انتخاب کنید تا پخش شود." />
      <TrainingPlayer videos={videos} />
      {showLog && <TrainingLog staff={staff} videos={list.map((v) => ({ slug: v.slug, title: v.title }))} rows={watchLog()} />}
    </>
  );
}
