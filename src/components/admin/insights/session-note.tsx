"use client";

import { useActionState, useState } from "react";
import { Star } from "lucide-react";
import { sessionNoteAction } from "@/app/admin/actions";
import { cn } from "@/lib/utils";

/** Team note + star for one session. Starred sessions are kept past the retention window. */
export function SessionNote({ sid, note, starred }: { sid: string; note: string | null; starred: boolean }) {
  const [state, action, pending] = useActionState(sessionNoteAction.bind(null, sid), null);
  const [star, setStar] = useState(starred);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="starred" value={star ? "1" : "0"} />
      <textarea
        name="note"
        defaultValue={note ?? ""}
        rows={3}
        maxLength={1000}
        placeholder="مثلاً: روی انتخاب کشور گیر کرد"
        className="w-full resize-y rounded-lg border border-[#E4E4E7] bg-white px-3 py-2 text-[13px] text-[#18181B] outline-none placeholder:text-[#A1A1AA] focus-visible:ring-[3px] focus-visible:ring-[#DBEAFE]"
      />
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setStar((v) => !v)}
          aria-pressed={star}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-semibold transition-colors",
            star ? "border-[#FCD34D] bg-[#FFFBEB] text-[#B45309]" : "border-[#E4E4E7] text-[#52525B] hover:bg-[#F4F4F5]",
          )}
        >
          <Star className={cn("size-3.5", star && "fill-[#F59E0B] text-[#F59E0B]")} aria-hidden />
          {star ? "ستاره‌دار (پاک نمی‌شود)" : "ستاره بزن"}
        </button>
        <div className="flex items-center gap-2">
          {state?.ok && !pending && <span className="text-[12px] text-[#15803D]">{state.message}</span>}
          {state?.error && <span className="text-[12px] text-[#B91C1C]">{state.error}</span>}
          <button
            type="submit"
            disabled={pending}
            className="h-8 rounded-lg bg-[#18181B] px-3 text-[12px] font-semibold text-white hover:bg-[#3F3F46] disabled:opacity-50"
          >
            {pending ? "در حال ذخیره…" : "ذخیره"}
          </button>
        </div>
      </div>
    </form>
  );
}
