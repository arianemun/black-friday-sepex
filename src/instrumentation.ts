/** Background jobs for the Node server: the unattended-request alert and database backups. */
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
}
