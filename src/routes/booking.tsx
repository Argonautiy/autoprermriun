import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { format, addDays, isSameDay, startOfDay, isBefore } from "date-fns";
import { ru } from "date-fns/locale";
import {
  CalendarIcon,
  Clock,
  Loader2,
  CheckCircle2,
  Phone,
  User as UserIcon,
  Car,
  ChevronLeft,
  ChevronRight,
  Wrench,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { sendTelegramNotification } from "@/server/notify-telegram";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Header } from "@/components/Header";

export const Route = createFileRoute("/booking")({
  component: BookingPage,
  head: () => ({
    meta: [
      { title: "Онлайн-запись на ремонт — Авто Premium" },
      {
        name: "description",
        content:
          "Запишитесь на ремонт онлайн: выберите услугу, удобную дату и время. Подтверждение мгновенно — без звонков.",
      },
      { property: "og:title", content: "Онлайн-запись на ремонт — Авто Premium" },
      {
        property: "og:description",
        content: "Выберите услугу, дату и свободный временной слот в пару кликов.",
      },
    ],
  }),
});

type Service = {
  id: string;
  name: string;
  description: string | null;
  base_price: number;
  duration_minutes: number;
};

const WORK_START = 9; // 09:00
const WORK_END = 19; // 19:00 last slot starts before this
const DAYS_AHEAD = 14;

function generateSlots(date: Date, durationMin: number) {
  const slots: Date[] = [];
  const step = Math.max(30, Math.min(durationMin, 120));
  const start = new Date(date);
  start.setHours(WORK_START, 0, 0, 0);
  const end = new Date(date);
  end.setHours(WORK_END, 0, 0, 0);
  let cur = start;
  while (cur < end) {
    slots.push(new Date(cur));
    cur = new Date(cur.getTime() + step * 60000);
  }
  return slots;
}

function BookingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [services, setServices] = useState<Service[]>([]);
  const [busy, setBusy] = useState<{ start: string; duration: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ when: Date; service: string } | null>(null);

  const [serviceId, setServiceId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(addDays(new Date(), 1)));
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);

  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [carMake, setCarMake] = useState("");
  const [carModel, setCarModel] = useState("");
  const [carYear, setCarYear] = useState("");
  const [carPlate, setCarPlate] = useState("");
  const [notes, setNotes] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");

  useEffect(() => {
    const load = async () => {
      const [{ data: svc }, { data: orders }] = await Promise.all([
        supabase.from("services").select("id,name,description,base_price,duration_minutes").order("sort_order"),
        supabase
          .from("repair_orders")
          .select("scheduled_at, services(duration_minutes)")
          .not("scheduled_at", "is", null)
          .neq("status", "cancelled")
          .gte("scheduled_at", new Date().toISOString()),
      ]);
      setServices((svc as Service[]) ?? []);
      if (svc && svc.length > 0 && !serviceId) setServiceId(svc[0].id);
      setBusy(
        ((orders ?? []) as any[]).map((o) => ({
          start: o.scheduled_at,
          duration: o.services?.duration_minutes ?? 60,
        })),
      );
      setLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pre-fill from logged-in user profile
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("user_id", user.id)
        .maybeSingle();
      if (profile?.full_name && !clientName) setClientName(profile.full_name);
      if (profile?.phone && !clientPhone) setClientPhone(profile.phone);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const selectedService = useMemo(
    () => services.find((s) => s.id === serviceId),
    [services, serviceId],
  );

  const days = useMemo(() => {
    const today = startOfDay(new Date());
    return Array.from({ length: 7 }, (_, i) =>
      addDays(today, weekOffset * 7 + i + 1), // start from tomorrow
    );
  }, [weekOffset]);

  const slots = useMemo(() => {
    if (!selectedService) return [];
    return generateSlots(selectedDate, selectedService.duration_minutes);
  }, [selectedDate, selectedService]);

  const isSlotBusy = (slot: Date) => {
    if (!selectedService) return false;
    const slotStart = slot.getTime();
    const slotEnd = slotStart + selectedService.duration_minutes * 60000;
    return busy.some((b) => {
      const bs = new Date(b.start).getTime();
      const be = bs + b.duration * 60000;
      return slotStart < be && slotEnd > bs;
    });
  };

  const isSlotPast = (slot: Date) => isBefore(slot, new Date());

  const submit = async () => {
    if (!selectedService) return toast.error("Выберите услугу");
    if (!selectedSlot) return toast.error("Выберите время");
    if (!clientName.trim() || !clientPhone.trim())
      return toast.error("Укажите имя и телефон");
    if (!carMake.trim() || !carModel.trim()) return toast.error("Укажите марку и модель");

    setSubmitting(true);
    const tgId = telegramChatId.trim() || null;
    const { error } = await supabase.from("repair_orders").insert({
      client_name: clientName.trim(),
      client_phone: clientPhone.trim(),
      car_make: carMake.trim(),
      car_model: carModel.trim(),
      car_year: carYear ? parseInt(carYear, 10) : null,
      car_plate: carPlate.trim() || null,
      service_id: selectedService.id,
      scheduled_at: selectedSlot.toISOString(),
      labor_cost: selectedService.base_price,
      notes: notes.trim() || null,
      status: "waiting_diagnosis",
      user_id: user?.id ?? null,
      telegram_chat_id: tgId,
    });
    if (error) {
      setSubmitting(false);
      return toast.error(error.message);
    }

    if (tgId) {
      const when = `${format(selectedSlot, "d MMMM, EEEE", { locale: ru })} в ${format(selectedSlot, "HH:mm")}`;
      const message =
        `<b>✅ Запись подтверждена — Авто Premium</b>\n\n` +
        `🔧 Услуга: <b>${selectedService.name}</b>\n` +
        `📅 Когда: <b>${when}</b>\n` +
        `🚗 Авто: ${carMake.trim()} ${carModel.trim()}${carYear ? ` ${carYear}` : ""}\n` +
        `💰 Стоимость: ~${Number(selectedService.base_price).toLocaleString("ru-RU")} ₸\n\n` +
        (user
          ? `Перенести или отменить запись можно в личном кабинете не позднее чем за 2 часа до начала.`
          : `Перенос и отмена доступны после входа в личный кабинет — не позднее чем за 2 часа до начала.`);
      try {
        await sendTelegramNotification({ data: { chatId: tgId, message } });
        toast.success("Подтверждение отправлено в Telegram");
      } catch (e: any) {
        toast.warning(`Запись создана, но Telegram не отправлен: ${e.message ?? e}`);
      }
    }

    setSubmitting(false);
    setSuccess({ when: selectedSlot, service: selectedService.name });
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 pt-24">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md rounded-2xl border border-primary/30 bg-card p-8 text-center shadow-xl"
        >
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle2 className="h-9 w-9 text-primary" />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">Запись подтверждена!</h1>
          <p className="mt-3 text-muted-foreground">
            <span className="font-medium text-foreground">{success.service}</span>
            <br />
            {format(success.when, "d MMMM, EEEE", { locale: ru })} в{" "}
            {format(success.when, "HH:mm")}
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            Мы свяжемся с вами для уточнения деталей. Спасибо, что выбрали нас!
          </p>
          <div className="mt-6 flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => navigate({ to: "/" })}>
              На главную
            </Button>
            {user && (
              <Button
                className="flex-1 bg-gold-gradient text-primary-foreground"
                onClick={() => navigate({ to: "/profile" })}
              >
                Мои заказы
              </Button>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 pt-28">
      <div className="mx-auto max-w-5xl px-6">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <CalendarIcon className="h-6 w-6 text-primary" />
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground sm:text-4xl">
            Онлайн-запись на ремонт
          </h1>
          <p className="mt-2 text-muted-foreground">
            Выберите услугу, удобную дату и свободное время
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : services.length === 0 ? (
          <Card className="border-border/50 bg-card">
            <CardContent className="py-16 text-center text-muted-foreground">
              Услуги пока не добавлены. Зайдите позже.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <div className="space-y-6">
              {/* Step 1: Service */}
              <Card className="border-border/50 bg-card">
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      1
                    </span>
                    <h2 className="font-display text-lg font-semibold text-foreground">
                      Выберите услугу
                    </h2>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {services.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          setServiceId(s.id);
                          setSelectedSlot(null);
                        }}
                        className={cn(
                          "flex flex-col items-start rounded-lg border p-3 text-left transition-all",
                          serviceId === s.id
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-border/50 hover:border-primary/50",
                        )}
                      >
                        <div className="flex w-full items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Wrench className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium text-foreground">{s.name}</span>
                          </div>
                          <span className="whitespace-nowrap text-xs font-semibold text-gold-gradient">
                            {Number(s.base_price).toLocaleString("ru-RU")} ₸
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          ≈ {s.duration_minutes} мин
                        </p>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Step 2: Date & Slot */}
              <Card className="border-border/50 bg-card">
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      2
                    </span>
                    <h2 className="font-display text-lg font-semibold text-foreground">
                      Дата и время
                    </h2>
                  </div>

                  <div className="flex items-center justify-between">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={weekOffset === 0}
                      onClick={() => setWeekOffset((w) => Math.max(0, w - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {format(days[0], "d MMM", { locale: ru })} —{" "}
                      {format(days[6], "d MMM", { locale: ru })}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={weekOffset >= Math.floor(DAYS_AHEAD / 7) - 1}
                      onClick={() => setWeekOffset((w) => w + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-7 gap-1.5">
                    {days.map((d) => {
                      const active = isSameDay(d, selectedDate);
                      return (
                        <button
                          key={d.toISOString()}
                          onClick={() => {
                            setSelectedDate(d);
                            setSelectedSlot(null);
                          }}
                          className={cn(
                            "flex flex-col items-center rounded-lg border py-2 transition-all",
                            active
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border/50 hover:border-primary/50",
                          )}
                        >
                          <span className="text-[10px] uppercase opacity-70">
                            {format(d, "EE", { locale: ru })}
                          </span>
                          <span className="font-display text-base font-bold">
                            {format(d, "d")}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      Свободное время
                    </p>
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                      {slots.map((slot) => {
                        const past = isSlotPast(slot);
                        const taken = isSlotBusy(slot);
                        const disabled = past || taken;
                        const active = selectedSlot && isSameDay(selectedSlot, slot) && selectedSlot.getTime() === slot.getTime();
                        return (
                          <button
                            key={slot.toISOString()}
                            disabled={disabled}
                            onClick={() => setSelectedSlot(slot)}
                            className={cn(
                              "rounded-md border py-2 text-sm font-medium transition-all",
                              active
                                ? "border-primary bg-primary text-primary-foreground"
                                : disabled
                                  ? "cursor-not-allowed border-border/30 bg-muted/30 text-muted-foreground/50 line-through"
                                  : "border-border/50 text-foreground hover:border-primary hover:bg-primary/5",
                            )}
                          >
                            {format(slot, "HH:mm")}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Step 3: Contact + Car */}
              <Card className="border-border/50 bg-card">
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      3
                    </span>
                    <h2 className="font-display text-lg font-semibold text-foreground">
                      Контакты и авто
                    </h2>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label className="mb-1.5 flex items-center gap-1.5 text-xs">
                        <UserIcon className="h-3.5 w-3.5" />
                        Имя *
                      </Label>
                      <Input
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        placeholder="Иван Иванов"
                      />
                    </div>
                    <div>
                      <Label className="mb-1.5 flex items-center gap-1.5 text-xs">
                        <Phone className="h-3.5 w-3.5" />
                        Телефон *
                      </Label>
                      <Input
                        value={clientPhone}
                        onChange={(e) => setClientPhone(e.target.value)}
                        placeholder="+7 777 777 77 77"
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-4">
                    <div className="sm:col-span-1">
                      <Label className="mb-1.5 flex items-center gap-1.5 text-xs">
                        <Car className="h-3.5 w-3.5" />
                        Марка *
                      </Label>
                      <Input
                        value={carMake}
                        onChange={(e) => setCarMake(e.target.value)}
                        placeholder="Toyota"
                      />
                    </div>
                    <div>
                      <Label className="mb-1.5 block text-xs">Модель *</Label>
                      <Input
                        value={carModel}
                        onChange={(e) => setCarModel(e.target.value)}
                        placeholder="Camry"
                      />
                    </div>
                    <div>
                      <Label className="mb-1.5 block text-xs">Год</Label>
                      <Input
                        type="number"
                        value={carYear}
                        onChange={(e) => setCarYear(e.target.value)}
                        placeholder="2018"
                      />
                    </div>
                    <div>
                      <Label className="mb-1.5 block text-xs">Гос. номер</Label>
                      <Input
                        value={carPlate}
                        onChange={(e) => setCarPlate(e.target.value)}
                        placeholder="A123BC"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="mb-1.5 block text-xs">Комментарий</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      placeholder="Дополнительные пожелания..."
                    />
                  </div>

                  <div>
                    <Label className="mb-1.5 flex items-center gap-1.5 text-xs">
                      <Send className="h-3.5 w-3.5" />
                      Telegram chat ID (опционально — для уведомления)
                    </Label>
                    <Input
                      value={telegramChatId}
                      onChange={(e) => setTelegramChatId(e.target.value)}
                      placeholder="123456789"
                      inputMode="numeric"
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      1) Откройте{" "}
                      <a
                        href="https://t.me/AutopremWork_bot"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        @AutopremWork_bot
                      </a>{" "}
                      и нажмите Start. 2) Узнайте свой ID у{" "}
                      <a
                        href="https://t.me/userinfobot"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        @userinfobot
                      </a>{" "}
                      и вставьте сюда.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar summary */}
            <div className="lg:sticky lg:top-24 lg:self-start">
              <Card className="border-primary/30 bg-card">
                <CardContent className="space-y-4 p-5">
                  <h3 className="font-display text-lg font-semibold text-foreground">
                    Ваша запись
                  </h3>

                  <div className="space-y-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-muted-foreground">Услуга</span>
                      <span className="text-right font-medium text-foreground">
                        {selectedService?.name ?? "—"}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-muted-foreground">Дата</span>
                      <span className="text-right font-medium text-foreground">
                        {format(selectedDate, "d MMM, EEE", { locale: ru })}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-muted-foreground">Время</span>
                      <span className="text-right font-medium text-foreground">
                        {selectedSlot ? format(selectedSlot, "HH:mm") : "—"}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-muted-foreground">Длительность</span>
                      <span className="text-right text-foreground">
                        ≈ {selectedService?.duration_minutes ?? 0} мин
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-border/50 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Стоимость</span>
                      <span className="font-display text-xl font-bold text-gold-gradient">
                        {Number(selectedService?.base_price ?? 0).toLocaleString("ru-RU")} ₸
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      *итоговая сумма уточняется после диагностики
                    </p>
                  </div>

                  <Button
                    onClick={submit}
                    disabled={submitting || !selectedSlot}
                    className="w-full bg-gold-gradient text-primary-foreground"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Подтвердить запись"
                    )}
                  </Button>

                  {!user && (
                    <p className="text-center text-[11px] text-muted-foreground">
                      <Link to="/login" className="text-primary hover:underline">
                        Войдите
                      </Link>
                      , чтобы видеть запись в личном кабинете
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
