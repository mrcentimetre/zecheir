import { Bot, InlineKeyboard } from "grammy";
import { vaultStatus } from "./schedule";
import { getVault, listVaults, updateVault } from "./store";
import { checkIn } from "./vaults";

/**
 * Telegram bot: check-in reminders for the owner, alerts for the guardian.
 * Link a chat with `/start owner-<vaultId>` or `/start guardian-<vaultId>` (deep links from the PWA).
 * The bot never sees balances or key shares — it only counts check-ins.
 */
export async function startBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not set");
  const bot = new Bot(token);
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  bot.command("start", async (ctx) => {
    const [role, id] = (ctx.match ?? "").split("-");
    const v = id ? await getVault(id) : undefined;
    if (!v || (role !== "owner" && role !== "guardian")) {
      return ctx.reply("Open ZecHeir and tap “Connect Telegram” to link this chat to your vault.");
    }
    await updateVault(id, (x) => (x[role].telegramChatId = ctx.chat.id));
    await ctx.reply(
      role === "owner"
        ? `Linked to ${v.owner.name}'s vault. I'll ask you to check in before each deadline.`
        : `You're now ${v.owner.name}'s guardian. I'll alert you if ${v.owner.name} stops checking in.`
    );
  });

  bot.callbackQuery(/^checkin:(.+)$/, async (ctx) => {
    const v = await checkIn(ctx.match[1]);
    const s = vaultStatus(v);
    await ctx.answerCallbackQuery({ text: "Switch reset" });
    await ctx.editMessageText(
      `✓ Switch reset. Thanks ${v.owner.name}.\nNext check-in: ${new Date(s.nextCheckinAt).toUTCString()}\nMissed in a row: 0 of ${v.schedule.missLimit}`,
      { reply_markup: new InlineKeyboard().url("Open vault", `${appUrl}/vault/${v.id}`) }
    );
  });

  // Reminder loop: one message per state change, so chats aren't spammed.
  const sent = new Map<string, string>();
  setInterval(async () => {
    for (const v of await listVaults()) {
      const s = vaultStatus(v);
      const key = `${s.phase}:${s.missed}`;
      if (sent.get(v.id) === key) continue;
      sent.set(v.id, key);
      try {
        if (v.owner.telegramChatId && (s.phase === "armed" || s.phase === "grace") && s.missed > 0) {
          await bot.api.sendMessage(
            v.owner.telegramChatId,
            `Check-in for ${v.owner.name}'s vault. Still with us?\nMissed in a row: ${s.missed} of ${v.schedule.missLimit}`,
            { reply_markup: new InlineKeyboard().text("I'm here", `checkin:${v.id}`) }
          );
        }
        if (v.guardian.telegramChatId && s.phase === "grace") {
          await bot.api.sendMessage(
            v.guardian.telegramChatId,
            `${v.owner.name} has missed ${s.missed} check-ins. Please try to reach them. The release unlocks when the grace period ends.`
          );
        }
        if (v.guardian.telegramChatId && s.phase === "releasable") {
          await bot.api.sendMessage(v.guardian.telegramChatId, `The grace period for ${v.owner.name}'s vault has ended. Review the release:`, {
            reply_markup: new InlineKeyboard().url("Review release", `${appUrl}/guardian/${v.id}`),
          });
        }
      } catch (err) {
        console.error("bot send failed:", (err as Error).message);
      }
    }
  }, 10_000);

  bot.start({ drop_pending_updates: true });
  console.log("telegram bot running");
}
