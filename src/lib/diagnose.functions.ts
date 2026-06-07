import { createServerFn } from "@tanstack/react-start";


type DiagnoseInput = {
  carMake: string;
  carModel: string;
  carYear?: string;
  symptoms: string;
};

export const diagnose = createServerFn({ method: "POST" })
  .inputValidator((input: DiagnoseInput) => {
    if (!input?.symptoms || input.symptoms.trim().length < 5) {
      throw new Error("Опишите симптомы подробнее (минимум 5 символов)");
    }
    if (!input?.carMake || !input?.carModel) {
      throw new Error("Укажите марку и модель авто");
    }
    return {
      carMake: String(input.carMake).slice(0, 100),
      carModel: String(input.carModel).slice(0, 100),
      carYear: input.carYear ? String(input.carYear).slice(0, 10) : "",
      symptoms: String(input.symptoms).slice(0, 2000),
    };
  })
  .handler(async ({ data }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!LOVABLE_API_KEY && !GEMINI_API_KEY) {
      throw new Error("AI не настроен: добавьте LOVABLE_API_KEY или GEMINI_API_KEY");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    type ServiceRow = { id: string; name: string; description: string | null; base_price: number };
    const { data: servicesData } = await supabaseAdmin
      .from("services")
      .select("id, name, description, base_price")
      .order("sort_order");
    const services: ServiceRow[] = (servicesData ?? []) as ServiceRow[];

    const servicesList = services
      .map(
        (s) =>
          `- id:${s.id} | "${s.name}" | ${Number(s.base_price).toLocaleString("ru-RU")} ₸${s.description ? ` | ${s.description}` : ""}`,
      )
      .join("\n");


    const systemPrompt = `Ты — опытный автомеханик-диагност автосервиса "Авто Premium" в Казахстане. Анализируй симптомы и давай чёткий ответ на русском языке.

Доступные услуги (используй ТОЛЬКО эти id):
${servicesList || "(услуги ещё не добавлены)"}

Правила:
- 2-5 наиболее вероятных причин, по убыванию вероятности
- Рекомендуй услуги ТОЛЬКО из списка выше, по их точным id
- urgency: low / medium / high
- Будь конкретным`;

    const userPrompt = `Авто: ${data.carMake} ${data.carModel}${data.carYear ? ` ${data.carYear} г.` : ""}\nСимптомы: ${data.symptoms}`;

    const parameters = {
      type: "object",
      properties: {
        urgency: { type: "string", enum: ["low", "medium", "high"] },
        summary: { type: "string" },
        causes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              probability: { type: "string", enum: ["high", "medium", "low"] },
            },
            required: ["title", "description", "probability"],
            additionalProperties: false,
          },
        },
        recommended_service_ids: { type: "array", items: { type: "string" } },
        advice: { type: "string" },
      },
      required: ["urgency", "summary", "causes", "recommended_service_ids", "advice"],
      additionalProperties: false,
    };

    type DiagResult = {
      urgency: "low" | "medium" | "high";
      summary: string;
      causes: Array<{ title: string; description: string; probability: "high" | "medium" | "low" }>;
      recommended_service_ids: string[];
      advice: string;
    };

    let result: DiagResult | null = null;

    if (LOVABLE_API_KEY) {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "provide_diagnosis",
                description: "Возвращает структурированную диагностику",
                parameters,
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "provide_diagnosis" } },
        }),
      });

      if (resp.ok) {
        const json = await resp.json();
        const args = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
        if (args) {
          try {
            result = JSON.parse(args);
          } catch {
            // ignore, fall through
          }
        }
      } else if (resp.status === 429) {
        throw new Error("Слишком много запросов. Попробуйте через минуту.");
      } else if (resp.status === 402 && !GEMINI_API_KEY) {
        throw new Error("Закончились кредиты AI. Пополните баланс.");
      } else {
        const errText = await resp.text().catch(() => "");
        console.warn("[diagnose] Lovable AI failed:", resp.status, errText);
        if (!GEMINI_API_KEY) {
          throw new Error(`Lovable AI вернул ${resp.status}: ${errText.slice(0, 200) || "ошибка"}`);
        }
      }
    }

    if (!result && GEMINI_API_KEY) {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            tools: [
              {
                functionDeclarations: [
                  { name: "provide_diagnosis", description: "diag", parameters },
                ],
              },
            ],
            toolConfig: {
              functionCallingConfig: { mode: "ANY", allowedFunctionNames: ["provide_diagnosis"] },
            },
          }),
        },
      );
      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        console.error("[diagnose] Gemini direct error:", resp.status, text);
        throw new Error(`Gemini API ${resp.status}: ${text.slice(0, 200) || "ошибка"}`);
      }
      const json = await resp.json();
      const fnCall = json?.candidates?.[0]?.content?.parts?.find(
        (p: { functionCall?: { args?: unknown } }) => p.functionCall,
      )?.functionCall;
      if (fnCall?.args) {
        result = fnCall.args as DiagResult;
      }
    }

    if (!result) {
      throw new Error("AI не вернул структурированный ответ");
    }

    const recommendedServices = (services ?? []).filter((s) =>
      result!.recommended_service_ids.includes(s.id),
    );

    return {
      ...result,
      recommended_services: recommendedServices,
    };
  });
