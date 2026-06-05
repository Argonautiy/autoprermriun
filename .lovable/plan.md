## Что делаю

Добавляю фолбэк в две серверные функции — если Lovable Gateway недоступен (нет `LOVABLE_API_KEY` или возвращает ошибку), код использует прямые ключи `GEMINI_API_KEY` / `TELEGRAM_BOT_TOKEN` из `.env`.

## .env — всё ок

`SUPABASE_*`, `VITE_SUPABASE_*` уже были, я их не трогаю. Новые три строки правильные:
- `GEMINI_API_KEY="AQ.Ab8..."` ✓ (новый формат от Google AI Studio)
- `TELEGRAM_BOT_TOKEN="8756893804:AAH..."` ✓
- `TELEGRAM_DEFAULT_CHAT_ID="5469680123"` ✓

## Изменения в коде

### 1. `src/lib/diagnose.functions.ts`
- Сейчас: ходит только в `https://ai.gateway.lovable.dev/v1/chat/completions` (требует `LOVABLE_API_KEY`).
- Станет: если `LOVABLE_API_KEY` есть → Gateway как раньше. Иначе если `GEMINI_API_KEY` есть → прямой вызов `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=...` с тем же tool-calling схемой (Gemini native формат: `contents`, `tools.functionDeclarations`, `toolConfig.functionCallingConfig`). Результат маппится в тот же JSON, что и сейчас.

### 2. `src/lib/notify-telegram.functions.ts`
- Сейчас: только Lovable connector gateway (требует `LOVABLE_API_KEY` + `TELEGRAM_API_KEY`).
- Станет: если оба ключа гейтвея есть → как раньше. Иначе если `TELEGRAM_BOT_TOKEN` есть → прямой `https://api.telegram.org/bot<TOKEN>/sendMessage` с тем же телом (`chat_id`, `text`, `parse_mode: "HTML"`).

### 3. (опционально) В форме брони подставлять `TELEGRAM_DEFAULT_CHAT_ID` как дефолт
Не трогаю, если не попросишь — может ломать существующую логику ввода chat_id.

## Что нужно от тебя

После моих правок: `bun run dev`, открой страницу диагностики и брони — проверь что ИИ отвечает и в Telegram приходит сообщение. Если на проде у тебя есть `LOVABLE_API_KEY` — старый путь продолжит работать без изменений.

Скажи «го» — переключаюсь в build mode и правлю оба файла.