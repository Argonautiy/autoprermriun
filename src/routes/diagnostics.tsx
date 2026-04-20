import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  Wrench,
  Phone,
  ArrowRight,
} from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { diagnose } from "@/server/diagnose";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/diagnostics")({
  head: () => ({
    meta: [
      { title: "AI-диагностика автомобиля — Авто Premium" },
      {
        name: "description",
        content:
          "Бесплатная онлайн-диагностика неисправностей авто с помощью искусственного интеллекта. Опишите симптомы — получите вероятные причины и рекомендации по ремонту.",
      },
      { property: "og:title", content: "AI-диагностика автомобиля — Авто Premium" },
      {
        property: "og:description",
        content:
          "Опишите проблему с автомобилем — AI подскажет вероятные причины и рекомендуемые услуги.",
      },
    ],
  }),
  component: DiagnosticsPage,
});

type DiagnosisResult = Awaited<ReturnType<typeof diagnose>>;

const urgencyConfig = {
  low: {
    label: "Не срочно",
    color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
    icon: CheckCircle2,
  },
  medium: {
    label: "Желательно скоро",
    color: "bg-amber-500/10 text-amber-500 border-amber-500/30",
    icon: Info,
  },
  high: {
    label: "Опасно — срочно!",
    color: "bg-red-500/10 text-red-500 border-red-500/30",
    icon: AlertTriangle,
  },
};

const probabilityLabels = {
  high: { label: "Высокая вероятность", color: "bg-primary/15 text-primary" },
  medium: { label: "Средняя вероятность", color: "bg-muted text-foreground" },
  low: { label: "Низкая вероятность", color: "bg-muted/50 text-muted-foreground" },
};

function DiagnosticsPage() {
  const [carMake, setCarMake] = useState("");
  const [carModel, setCarModel] = useState("");
  const [carYear, setCarYear] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiagnosisResult | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await diagnose({
        data: { carMake, carModel, carYear, symptoms },
      });
      setResult(res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Ошибка диагностики";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const UrgencyIcon = result ? urgencyConfig[result.urgency].icon : null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 pt-28 pb-20">
        <div className="mx-auto max-w-4xl px-6">
          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              На базе искусственного интеллекта
            </div>
            <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl">
              AI-<span className="text-gold-gradient">диагностика</span> авто
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Опишите симптомы вашего автомобиля — наш AI-помощник определит
              вероятные причины и подскажет, какие услуги нужны.
            </p>
          </motion.div>

          {/* Form */}
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            onSubmit={handleSubmit}
            className="mt-10 rounded-2xl border border-border/50 bg-card p-6 shadow-gold md:p-8"
          >
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label htmlFor="make">Марка *</Label>
                <Input
                  id="make"
                  required
                  value={carMake}
                  onChange={(e) => setCarMake(e.target.value)}
                  placeholder="Toyota"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="model">Модель *</Label>
                <Input
                  id="model"
                  required
                  value={carModel}
                  onChange={(e) => setCarModel(e.target.value)}
                  placeholder="Camry"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="year">Год выпуска</Label>
                <Input
                  id="year"
                  value={carYear}
                  onChange={(e) => setCarYear(e.target.value)}
                  placeholder="2018"
                  className="mt-1.5"
                />
              </div>
            </div>

            <div className="mt-4">
              <Label htmlFor="symptoms">Опишите проблему *</Label>
              <Textarea
                id="symptoms"
                required
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                placeholder="Например: при торможении на скорости появляется вибрация в руле, слышен скрежет с переднего правого колеса..."
                rows={5}
                maxLength={2000}
                className="mt-1.5 resize-none"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {symptoms.length}/2000 символов
              </p>
            </div>

            <Button
              type="submit"
              disabled={loading}
              size="lg"
              className="mt-6 w-full bg-gold-gradient font-semibold text-primary-foreground hover:opacity-90"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  AI анализирует...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  Получить диагностику
                </>
              )}
            </Button>
          </motion.form>

          {/* Result */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-8 space-y-6"
              >
                {/* Urgency + summary */}
                <div className="rounded-2xl border border-border/50 bg-card p-6 md:p-8">
                  <div
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium ${urgencyConfig[result.urgency].color}`}
                  >
                    {UrgencyIcon && <UrgencyIcon className="h-4 w-4" />}
                    {urgencyConfig[result.urgency].label}
                  </div>
                  <h2 className="mt-4 font-display text-2xl font-bold">
                    Результат диагностики
                  </h2>
                  <p className="mt-2 text-foreground/90">{result.summary}</p>
                </div>

                {/* Causes */}
                <div>
                  <h3 className="font-display text-xl font-semibold">
                    Вероятные причины
                  </h3>
                  <div className="mt-4 space-y-3">
                    {result.causes.map((cause, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.08 }}
                        className="rounded-xl border border-border/50 bg-card p-5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <h4 className="font-semibold text-foreground">
                            {i + 1}. {cause.title}
                          </h4>
                          <Badge
                            variant="outline"
                            className={probabilityLabels[cause.probability].color}
                          >
                            {probabilityLabels[cause.probability].label}
                          </Badge>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {cause.description}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Recommended services */}
                {result.recommended_services.length > 0 && (
                  <div>
                    <h3 className="font-display text-xl font-semibold">
                      Рекомендуем услуги
                    </h3>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {result.recommended_services.map((s) => (
                        <div
                          key={s.id}
                          className="group flex flex-col rounded-xl border border-border/50 bg-card p-5 transition-all hover:border-primary/40 hover:shadow-gold"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                              <Wrench className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1">
                              <h4 className="font-semibold text-foreground">
                                {s.name}
                              </h4>
                              {s.description && (
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {s.description}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="mt-4 flex items-center justify-between">
                            <div>
                              <p className="text-xs text-muted-foreground">от</p>
                              <p className="font-display text-lg font-bold text-primary">
                                {Number(s.base_price).toLocaleString("ru-RU")} ₸
                              </p>
                            </div>
                            <a
                              href="tel:+77778747313"
                              className="inline-flex items-center gap-1.5 rounded-lg bg-gold-gradient px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                            >
                              <Phone className="h-3.5 w-3.5" />
                              Записаться
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Advice */}
                <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 shrink-0 text-primary" />
                    <div>
                      <h4 className="font-semibold text-foreground">
                        Совет от AI
                      </h4>
                      <p className="mt-1 text-sm text-foreground/90">
                        {result.advice}
                      </p>
                    </div>
                  </div>
                </div>

                {/* CTA */}
                <div className="flex flex-col gap-3 rounded-2xl border border-border/50 bg-card p-6 text-center md:flex-row md:items-center md:justify-between md:text-left">
                  <div>
                    <p className="font-display text-lg font-semibold">
                      Готовы записаться на ремонт?
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Позвоните нам или посмотрите все услуги
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      to="/"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 bg-background px-4 py-2.5 text-sm font-medium hover:border-primary/50"
                    >
                      Все услуги
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                    <a
                      href="tel:+77778747313"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-gold-gradient px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
                    >
                      <Phone className="h-4 w-4" />
                      Позвонить
                    </a>
                  </div>
                </div>

                {/* Disclaimer */}
                <p className="text-center text-xs text-muted-foreground">
                  ⚠️ AI-диагностика носит информационный характер. Точный
                  диагноз поставит мастер после осмотра автомобиля.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
      <Footer />
    </div>
  );
}
