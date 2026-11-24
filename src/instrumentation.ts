/** Starts the background check for requests nobody has picked up (Node server only). */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.ESCALATION_DISABLED === "1") return;
  const { runEscalation } = await import("./lib/escalation");
  const tick = () => void runEscalation();
  setTimeout(tick, 60_000).unref();
  setInterval(tick, 5 * 60_000).unref();
}
