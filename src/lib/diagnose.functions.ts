import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
    try {
      return await runDiagnose(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[diagnose] failed:", msg, e);
      throw new Error(msg || "Неизвестная ошибка диагностики");
    }
  });

async function runDiagnose(data: { carMake: string; carModel: string; carYear: string; symptoms: string }) {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!LOVABLE_API_KEY && !GEMINI_API_KEY) {
      throw new Error("Не настроен AI: нужен LOVABLE_API_KEY или GEMINI_API_KEY");
    }




    // Загружаем каталог услуг
    const { data: services } = await supabaseAdmin
      .from("services")
      .select("id, name, description, base_price")
      .order("sort_order");

    const servicesList = (services ?? [])
      .map(
        (s) =>
          `- id:${s.id} | "${s.name}" | ${Number(s.base_price).toLocaleString("ru-RU")} ₸${s.description ? ` | ${s.description}` : ""}`,
      )
      .join("\n");

    const systemPrompt = `Ты — опытный автомеханик-диагност автосервиса "Авто Premium" в Казахстане. Анализируй симптомы и давай чёткий ответ на русском языке.

Доступные услуги нашего автосервиса (используй ТОЛЬКО эти id для рекомендаций):
${servicesList || "(услуги ещё не добавлены)"}

Правила:
- Указывай 2-5 наиболее вероятных причин, отсортированных по вероятности
- Рекомендуй услуги ТОЛЬКО из списка выше, используя их точные id
- Указывай уровень срочности: low (можно отложить), medium (нужно сделать в ближайшее время), high (опасно ездить)
- Будь конкретным, избегай общих фраз`;

    const userPrompt = `Авто: ${data.carMake} ${data.carModel}${data.carYear ? ` ${data.carYear} г.` : ""}
Симптомы: ${data.symptoms}`;

    const tools = [
      {
        type: "function",
        function: {
          name: "provide_diagnosis",
          description: "Возвращает структурированную диагностику неисправности",
          parameters: {
            type: "object",
            properties: {
              urgency: {
                type: "string",
                enum: ["low", "medium", "high"],
                description: "Уровень срочности ремонта",
              },
              summary: {
                type: "string",
                description: "Краткое резюме диагноза в 1-2 предложения",
              },
              causes: {
                type: "array",
                description: "Вероятные причины неисправности",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string", description: "Название причины" },
                    description: {
                      type: "string",
                      description: "Подробное объяснение причины",
                    },
                    probability: {
                      type: "string",
                      enum: ["high", "medium", "low"],
                    },
                  },
                  required: ["title", "description", "probability"],
                  additionalProperties: false,
                },
              },
              recommended_service_ids: {
                type: "array",
                description: "ID услуг из каталога, которые мы рекомендуем",
                items: { type: "string" },
              },
              advice: {
                type: "string",
                description: "Совет клиенту: что делать прямо сейчас",
              },
            },
            required: [
              "urgency",
              "summary",
              "causes",
              "recommended_service_ids",
              "advice",
            ],
            additionalProperties: false,
          },
        },
      },
    ];

    let result: {
      urgency: "low" | "medium" | "high";
      summary: string;
      causes: Array<{
        title: string;
        description: string;
        probability: "high" | "medium" | "low";
      }>;
      recommended_service_ids: string[];
      advice: string;
    } | null = null;

    const diagnosisParams = tools[0].function.parameters;

    // Путь 1: Lovable AI Gateway
    if (LOVABLE_API_KEY) {
      const resp = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
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
            tools,
            tool_choice: {
              type: "function",
              function: { name: "provide_diagnosis" },
            },
          }),
        },
      );

      if (resp.ok) {
        const json = await resp.json();
        const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
        if (args) result = JSON.parse(args);
      } else {
        if (resp.status === 429) throw new Error("Слишком много запросов. Попробуйте через минуту.");
        if (resp.status === 402 && !GEMINI_API_KEY) {
          throw new Error("Закончились кредиты AI. Пополните баланс или добавьте GEMINI_API_KEY.");
        }
        console.warn("Lovable AI gateway failed, trying direct Gemini:", resp.status);
      }
    }

    // Путь 2: прямой Gemini API
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
                  {
                    name: "provide_diagnosis",
                    description: "Возвращает структурированную диагностику неисправности",
                    parameters: diagnosisParams,
                  },
                ],
              },
            ],
            toolConfig: {
              functionCallingConfig: {
                mode: "ANY",
                allowedFunctionNames: ["provide_diagnosis"],
              },
            },
          }),
        },
      );

      if (!resp.ok) {
        const text = await resp.text();
        console.error("Gemini direct error:", resp.status, text);
        throw new Error(`Ошибка Gemini API [${resp.status}]. Проверьте GEMINI_API_KEY.`);
      }
      const json = await resp.json();
      const fnCall = json.candidates?.[0]?.content?.parts?.find(
        (p: { functionCall?: { args?: unknown } }) => p.functionCall,
      )?.functionCall;
      if (fnCall?.args) {
        result = fnCall.args;
      }
    }

    if (!result) throw new Error("AI не вернул структурированный ответ");

    // Подмешиваем полные данные рекомендованных услуг
    const recommendedServices = (services ?? []).filter((s) =>
      result!.recommended_service_ids.includes(s.id),
    );

    return {
      ...result,
      recommended_services: recommendedServices,
    };
  });

