/** Background jobs for the Node server: the unattended-request alert, database backups, old recordings. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  if (process.env.ESCALATION_DISABLED !== "1") {
    const { runEscalation } = await import("./lib/escalation");
    const tick = () => void runEscalation();
    setTimeout(tick, 60_000).unref();
    setInterval(tick, 5 * 60_000).unref();
  }

  if (process.env.BACKUP_DISABLED !== "1") {
    const { backupIfDue } = await import("./lib/backup");
    const tick = () => void backupIfDue();
    setTimeout(tick, 2 * 60_000).unref();
    setInterval(tick, 15 * 60_000).unref();
  }

  if (process.env.REC_DISABLED !== "1") {
    const { pruneRecordings } = await import("./lib/rec/store");
    const tick = () => {
      try {
        const n = pruneRecordings();
        if (n) console.log(`[rec] removed ${n} old session(s)`);
      } catch (e) {
        console.error("[rec] prune failed:", (e as Error).message);
      }
    };
    setTimeout(tick, 5 * 60_000).unref();
    setInterval(tick, 6 * 3_600_000).unref();
  }

  // Store icons for the landing: fetch missing ones shortly after start; weekly check, each icon refreshed after 30 days.
  {
    const { warmStoreIcons } = await import("./lib/store-icons");
    const tick = () =>
      warmStoreIcons()
        .then((n) => console.log(`[store-icon] ${n} icon(s) ready`))
        .catch((e) => console.error("[store-icon] warm-up failed:", (e as Error).message));
    setTimeout(tick, 20_000).unref();
    setInterval(tick, 7 * 86_400_000).unref();
  }

  // Landing deals: seed once, stock/price check every 30 min, next pooled product every 2 hours.
  if (process.env.DEALS_DISABLED !== "1") {
    const { checkAllDeals, publishIfDue, removeAmazonDe, seedDeals, CHECK_EVERY_MS } = await import("./lib/deals");
    let running = false;
    const check = async () => {
      if (running) return;
      running = true;
      try {
        const r = await checkAllDeals();
        const out = r.filter((x) => x.stock === "out").length;
        const blocked = r.filter((x) => x.note === "blocked").length;
        console.log(`[deals] checked ${r.length}: ${out} sold out, ${blocked} blocked`);
      } catch (e) {
        console.error("[deals] check failed:", (e as Error).message);
      } finally {
        running = false;
      }
    };
    const publish = () => publishIfDue().catch((e) => console.error("[deals] publish failed:", (e as Error).message));
    setTimeout(() => {
      try {
        seedDeals();
      } catch (e) {
        console.error("[deals] seed failed:", (e as Error).message);
      }
      void removeAmazonDe()
        .catch((e) => console.error("[deals] cleanup failed:", (e as Error).message))
        .finally(() => void check());
    }, 30_000).unref();
    setInterval(check, CHECK_EVERY_MS).unref();
    setInterval(publish, 5 * 60_000).unref();
  }
}
