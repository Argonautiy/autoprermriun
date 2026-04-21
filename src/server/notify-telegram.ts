import { createServerFn } from "@tanstack/react-start";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

type NotifyInput = {
  chatId: string;
  message: string;
};

async function sendTelegram(chatId: string, text: string) {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY не настроен");
  const TELEGRAM_API_KEY = process.env.TELEGRAM_API_KEY;
  if (!TELEGRAM_API_KEY) throw new Error("TELEGRAM_API_KEY не настроен");

  const res = await fetch(`${GATEWAY_URL}/sendMessage`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TELEGRAM_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(
      `Telegram ошибка [${res.status}]: ${data?.description ?? JSON.stringify(data)}`,
    );
  }
  return data.result;
}

export const sendTelegramNotification = createServerFn({ method: "POST" })
  .inputValidator((input: NotifyInput) => {
    const chatId = String(input?.chatId ?? "").trim();
    const message = String(input?.message ?? "").trim();
    if (!chatId) throw new Error("Не указан chat_id");
    if (!/^-?\d{3,20}$/.test(chatId)) {
      throw new Error("chat_id должен быть числом (получите его у @userinfobot)");
    }
    if (!message || message.length < 2) throw new Error("Пустое сообщение");
    return { chatId, message: message.slice(0, 3500) };
  })
  .handler(async ({ data }) => {
    await sendTelegram(data.chatId, data.message);
    return { ok: true };
  });
