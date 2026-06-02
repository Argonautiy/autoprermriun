import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Car, Plus, Trash2, LogOut, User, Phone, Save, X, Wrench, Sparkles, AlertTriangle, Info, CheckCircle2, ChevronDown, ChevronUp, Trash, Calendar as CalendarIcon, XCircle, Clock,
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { statusBadge, type RepairStatus } from "@/components/admin/OrdersPanel";
import { format, addDays, startOfDay, isBefore, isSameDay } from "date-fns";
import { ru } from "date-fns/locale";
import { sendTelegramNotification } from "@/lib/notify-telegram.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Личный кабинет — Авто Premium" },
      { name: "description", content: "Управляйте вашими автомобилями и заказами" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);
  const [cars, setCars] = useState<Tables<"user_cars">[]>([]);
  const [orders, setOrders] = useState<Tables<"repair_orders">[]>([]);
  const [diagnostics, setDiagnostics] = useState<Tables<"diagnostics_history">[]>([]);
  const [expandedDiag, setExpandedDiag] = useState<string | null>(null);
  const [showAddCar, setShowAddCar] = useState(false);
  const [newCar, setNewCar] = useState({ make: "", model: "", year: new Date().getFullYear() });
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [reschedOrder, setReschedOrder] = useState<Tables<"repair_orders"> | null>(null);
  const [reschedSlot, setReschedSlot] = useState<Date | null>(null);
  const [reschedDate, setReschedDate] = useState<Date>(startOfDay(addDays(new Date(), 1)));
  const [busy, setBusy] = useState<{ id: string; start: string; duration: number }[]>([]);
  const [services, setServices] = useState<Record<string, { name: string; duration_minutes: number }>>({});
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    const [profRes, carsRes, ordersRes, diagRes, busyRes, svcRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", user.id).single(),
      supabase.from("user_cars").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("repair_orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("diagnostics_history").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
      supabase
        .from("repair_orders")
        .select("id, scheduled_at, services(duration_minutes)")
        .not("scheduled_at", "is", null)
        .neq("status", "cancelled")
        .gte("scheduled_at", new Date().toISOString()),
      supabase.from("services").select("id, name, duration_minutes"),
    ]);
    if (profRes.data) {
      setProfile(profRes.data);
      setEditName(profRes.data.full_name || "");
      setEditPhone(profRes.data.phone || "");
    }
    if (carsRes.data) setCars(carsRes.data);
    if (ordersRes.data) setOrders(ordersRes.data);
    if (diagRes.data) setDiagnostics(diagRes.data);
    if (busyRes.data) {
      setBusy(
        (busyRes.data as any[]).map((o) => ({
          id: o.id,
          start: o.scheduled_at,
          duration: o.services?.duration_minutes ?? 60,
        })),
      );
    }
    if (svcRes.data) {
      const map: Record<string, { name: string; duration_minutes: number }> = {};
      svcRes.data.forEach((s: any) => {
        map[s.id] = { name: s.name, duration_minutes: s.duration_minutes };
      });
      setServices(map);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/login" });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) loadData();
  }, [user, loadData]);

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    await supabase
      .from("profiles")
      .update({ full_name: editName, phone: editPhone })
      .eq("user_id", user.id);
    await loadData();
    setSaving(false);
  };

  const addCar = async () => {
    if (!user || !newCar.make || !newCar.model) return;
    await supabase.from("user_cars").insert({
      user_id: user.id,
      make: newCar.make,
      model: newCar.model,
      year: newCar.year,
    });
    setNewCar({ make: "", model: "", year: new Date().getFullYear() });
    setShowAddCar(false);
    await loadData();
  };

  const deleteCar = async (id: string) => {
    await supabase.from("user_cars").delete().eq("id", id);
    setCars((prev) => prev.filter((c) => c.id !== id));
  };

  const deleteDiagnostic = async (id: string) => {
    await supabase.from("diagnostics_history").delete().eq("id", id);
    setDiagnostics((prev) => prev.filter((d) => d.id !== id));
    if (expandedDiag === id) setExpandedDiag(null);
  };

  const canModify = (o: Tables<"repair_orders">) => {
    if (!o.scheduled_at) return false;
    if (!["waiting_diagnosis", "waiting_price"].includes(o.status)) return false;
    const diffMs = new Date(o.scheduled_at).getTime() - Date.now();
    return diffMs >= 2 * 60 * 60 * 1000;
  };

  const cancelOrder = async (o: Tables<"repair_orders">) => {
    if (!canModify(o)) return toast.error("Отмена возможна не позднее чем за 2 часа до записи");
    if (!confirm("Отменить запись? Это действие нельзя отменить.")) return;
    setActionLoading(true);
    const { error } = await supabase.from("repair_orders").delete().eq("id", o.id);
    if (error) {
      setActionLoading(false);
      return toast.error(error.message);
    }
    if (o.telegram_chat_id) {
      try {
        const when = format(new Date(o.scheduled_at!), "d MMMM в HH:mm", { locale: ru });
        await sendTelegramNotification({
          data: {
            chatId: o.telegram_chat_id,
            message: `<b>❌ Запись отменена — Авто Premium</b>\n\nЗапись на <b>${when}</b> (${o.car_make} ${o.car_model}) отменена.`,
          },
        });
      } catch {}
    }
    toast.success("Запись отменена");
    setActionLoading(false);
    await loadData();
  };

  const isSlotBusyForResched = (slot: Date, durationMin: number, excludeId: string) => {
    const slotStart = slot.getTime();
    const slotEnd = slotStart + durationMin * 60000;
    return busy.some((b) => {
      if (b.id === excludeId) return false;
      const bs = new Date(b.start).getTime();
      const be = bs + b.duration * 60000;
      return slotStart < be && slotEnd > bs;
    });
  };

  const reschedSlots = (() => {
    if (!reschedOrder) return [];
    const dur = (reschedOrder.service_id && services[reschedOrder.service_id]?.duration_minutes) || 60;
    const slots: { time: Date; busy: boolean; past: boolean }[] = [];
    const start = new Date(reschedDate);
    start.setHours(9, 0, 0, 0);
    const end = new Date(reschedDate);
    end.setHours(19, 0, 0, 0);
    const step = Math.max(30, Math.min(dur, 120));
    let cur = start;
    while (cur < end) {
      slots.push({
        time: new Date(cur),
        busy: isSlotBusyForResched(cur, dur, reschedOrder.id),
        past: isBefore(cur, new Date(Date.now() + 2 * 60 * 60 * 1000)),
      });
      cur = new Date(cur.getTime() + step * 60000);
    }
    return slots;
  })();

  const confirmReschedule = async () => {
    if (!reschedOrder || !reschedSlot) return;
    setActionLoading(true);
    const { error } = await supabase
      .from("repair_orders")
      .update({ scheduled_at: reschedSlot.toISOString() })
      .eq("id", reschedOrder.id);
    if (error) {
      setActionLoading(false);
      return toast.error(error.message);
    }
    if (reschedOrder.telegram_chat_id) {
      try {
        const when = format(reschedSlot, "d MMMM, EEEE, в HH:mm", { locale: ru });
        await sendTelegramNotification({
          data: {
            chatId: reschedOrder.telegram_chat_id,
            message: `<b>📅 Запись перенесена — Авто Premium</b>\n\nНовое время: <b>${when}</b>\nАвто: ${reschedOrder.car_make} ${reschedOrder.car_model}`,
          },
        });
      } catch {}
    }
    toast.success("Запись перенесена");
    setReschedOrder(null);
    setReschedSlot(null);
    setActionLoading(false);
    await loadData();
  };

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  if (authLoading) {
    return (
      <>
        <Header />
        <main className="flex min-h-screen items-center justify-center pt-24">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </main>
      </>
    );
  }

  if (!user) return null;

  return (
    <>
      <Header />
      <main className="min-h-screen pt-24 pb-16">
        <div className="mx-auto max-w-3xl px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center justify-between">
              <h1 className="font-display text-3xl font-bold">
                <span className="text-gold-gradient">Личный кабинет</span>
              </h1>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 rounded-lg border border-border/50 bg-card px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-destructive"
              >
                <LogOut className="h-4 w-4" />
                Выйти
              </button>
            </div>

            {/* Profile info */}
            <div className="mt-8 rounded-2xl border border-border/50 bg-card p-6">
              <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold text-foreground">
                <User className="h-5 w-5 text-primary" />
                Профиль
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Имя</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Ваше имя"
                    className="w-full rounded-lg border border-border/50 bg-surface px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Телефон</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="tel"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder="+7 777 123 45 67"
                      className="w-full rounded-lg border border-border/50 bg-surface py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={saveProfile}
                    disabled={saving}
                    className="flex items-center gap-2 rounded-lg bg-gold-gradient px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    {saving ? "Сохранение..." : "Сохранить"}
                  </button>
                </div>
              </div>
            </div>

            {/* Garage */}
            <div className="mt-6 rounded-2xl border border-border/50 bg-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
                  <Car className="h-5 w-5 text-primary" />
                  Мой гараж
                </h2>
                <button
                  onClick={() => setShowAddCar(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-gold-gradient px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                >
                  <Plus className="h-4 w-4" />
                  Добавить авто
                </button>
              </div>

              <AnimatePresence>
                {showAddCar && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4 overflow-hidden"
                  >
                    <div className="rounded-xl border border-primary/30 bg-surface p-4">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <input
                          type="text"
                          placeholder="Марка (Toyota)"
                          value={newCar.make}
                          onChange={(e) => setNewCar({ ...newCar, make: e.target.value })}
                          className="rounded-lg border border-border/50 bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                        />
                        <input
                          type="text"
                          placeholder="Модель (Camry)"
                          value={newCar.model}
                          onChange={(e) => setNewCar({ ...newCar, model: e.target.value })}
                          className="rounded-lg border border-border/50 bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                        />
                        <input
                          type="number"
                          placeholder="Год"
                          value={newCar.year}
                          onChange={(e) => setNewCar({ ...newCar, year: parseInt(e.target.value) || 2024 })}
                          min={1990}
                          max={2026}
                          className="rounded-lg border border-border/50 bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={addCar}
                          className="rounded-lg bg-gold-gradient px-4 py-2 text-sm font-semibold text-primary-foreground"
                        >
                          Добавить
                        </button>
                        <button
                          onClick={() => setShowAddCar(false)}
                          className="flex items-center gap-1 rounded-lg border border-border/50 px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3.5 w-3.5" />
                          Отмена
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {cars.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  У вас пока нет сохранённых автомобилей. Добавьте авто для удобного подбора запчастей.
                </p>
              ) : (
                <div className="space-y-3">
                  {cars.map((car) => (
                    <motion.div
                      key={car.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center justify-between rounded-xl border border-border/50 bg-surface px-5 py-4"
                    >
                      <div className="flex items-center gap-3">
                        <Car className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-display text-sm font-semibold text-foreground">
                            {car.make} {car.model}
                          </p>
                          <p className="text-xs text-muted-foreground">{car.year} г.</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link
                          to="/catalog"
                          className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                        >
                          Подобрать запчасти
                        </Link>
                        <button
                          onClick={() => deleteCar(car.id)}
                          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* My AI diagnostics history */}
            <div className="mt-6 rounded-2xl border border-border/50 bg-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
                  <Sparkles className="h-5 w-5 text-primary" />
                  История AI-диагностик
                </h2>
                <Link to="/diagnostics" className="text-xs font-medium text-primary hover:underline">
                  + Новая диагностика
                </Link>
              </div>
              {diagnostics.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Вы ещё не пользовались AI-диагностикой.{" "}
                  <Link to="/diagnostics" className="text-primary hover:underline">Попробовать</Link>
                </p>
              ) : (
                <div className="space-y-3">
                  {diagnostics.map((d) => {
                    const isOpen = expandedDiag === d.id;
                    const urgencyMeta =
                      d.urgency === "high"
                        ? { label: "Срочно", color: "text-red-500", Icon: AlertTriangle }
                        : d.urgency === "medium"
                        ? { label: "Желательно скоро", color: "text-amber-500", Icon: Info }
                        : { label: "Не срочно", color: "text-emerald-500", Icon: CheckCircle2 };
                    const causes = (d.causes as Array<{ title: string; description: string; probability: string }>) ?? [];
                    const services = (d.recommended_services as Array<{ id: string; name: string; base_price: number }>) ?? [];
                    return (
                      <div key={d.id} className="rounded-xl border border-border/50 bg-surface">
                        <button
                          onClick={() => setExpandedDiag(isOpen ? null : d.id)}
                          className="flex w-full items-start justify-between gap-3 px-5 py-4 text-left"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-display text-sm font-semibold text-foreground">
                                {d.car_make} {d.car_model}{d.car_year ? ` · ${d.car_year}` : ""}
                              </p>
                              <span className={`inline-flex items-center gap-1 text-xs font-medium ${urgencyMeta.color}`}>
                                <urgencyMeta.Icon className="h-3 w-3" />
                                {urgencyMeta.label}
                              </span>
                            </div>
                            <p className="mt-1 truncate text-xs text-muted-foreground">{d.summary}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {new Date(d.created_at).toLocaleString("ru-RU")}
                            </p>
                          </div>
                          {isOpen ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
                        </button>
                        {isOpen && (
                          <div className="space-y-4 border-t border-border/50 px-5 py-4">
                            <div>
                              <p className="text-xs font-medium uppercase text-muted-foreground">Симптомы</p>
                              <p className="mt-1 text-sm text-foreground/90">{d.symptoms}</p>
                            </div>
                            {causes.length > 0 && (
                              <div>
                                <p className="text-xs font-medium uppercase text-muted-foreground">Вероятные причины</p>
                                <ul className="mt-2 space-y-2">
                                  {causes.map((c, i) => (
                                    <li key={i} className="rounded-lg border border-border/50 bg-card p-3">
                                      <p className="text-sm font-semibold text-foreground">{c.title}</p>
                                      <p className="mt-1 text-xs text-muted-foreground">{c.description}</p>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {services.length > 0 && (
                              <div>
                                <p className="text-xs font-medium uppercase text-muted-foreground">Рекомендованные услуги</p>
                                <ul className="mt-2 space-y-1.5">
                                  {services.map((s) => (
                                    <li key={s.id} className="flex items-center justify-between rounded-lg bg-card px-3 py-2 text-sm">
                                      <span className="text-foreground">{s.name}</span>
                                      <span className="font-semibold text-primary">
                                        {Number(s.base_price).toLocaleString("ru-RU")} ₸
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                              <p className="text-xs font-medium uppercase text-primary">Совет AI</p>
                              <p className="mt-1 text-sm text-foreground/90">{d.advice}</p>
                            </div>
                            <div className="flex justify-end">
                              <button
                                onClick={() => deleteDiagnostic(d.id)}
                                className="flex items-center gap-1.5 rounded-lg border border-border/50 px-3 py-1.5 text-xs text-muted-foreground hover:border-destructive/50 hover:text-destructive"
                              >
                                <Trash className="h-3.5 w-3.5" />
                                Удалить
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* My repair orders */}
            <div className="mt-6 rounded-2xl border border-border/50 bg-card p-6">
              <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold text-foreground">
                <Wrench className="h-5 w-5 text-primary" />
                Мои заказы на ремонт
              </h2>
              {orders.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  У вас пока нет заказов.{" "}
                  <Link to="/booking" className="text-primary hover:underline">Записаться онлайн</Link>
                </p>
              ) : (
                <div className="space-y-3">
                  {orders.map((o) => {
                    const modifiable = canModify(o);
                    return (
                      <div
                        key={o.id}
                        className="rounded-xl border border-border/50 bg-surface px-5 py-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-display text-sm font-semibold text-foreground">
                              {o.car_make} {o.car_model}
                              {o.car_year ? ` · ${o.car_year}` : ""}
                            </p>
                            {o.scheduled_at && (
                              <p className="mt-1 flex items-center gap-1.5 text-xs text-primary">
                                <CalendarIcon className="h-3.5 w-3.5" />
                                {format(new Date(o.scheduled_at), "d MMMM, EEEE, в HH:mm", { locale: ru })}
                              </p>
                            )}
                            {o.notes && (
                              <p className="mt-1 text-xs text-muted-foreground">{o.notes}</p>
                            )}
                            <p className="mt-1 text-xs text-muted-foreground">
                              Создан: {new Date(o.created_at).toLocaleDateString("ru-RU")}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {statusBadge(o.status as RepairStatus)}
                            <p className="text-sm font-semibold text-foreground">
                              {Number(o.labor_cost).toLocaleString("ru-RU")} ₸
                            </p>
                          </div>
                        </div>

                        {o.scheduled_at && (
                          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/50 pt-3">
                            {modifiable ? (
                              <>
                                <button
                                  onClick={() => {
                                    setReschedOrder(o);
                                    setReschedDate(startOfDay(addDays(new Date(), 1)));
                                    setReschedSlot(null);
                                  }}
                                  className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
                                >
                                  <CalendarIcon className="h-3.5 w-3.5" />
                                  Перенести
                                </button>
                                <button
                                  onClick={() => cancelOrder(o)}
                                  disabled={actionLoading}
                                  className="flex items-center gap-1.5 rounded-lg border border-border/50 px-3 py-1.5 text-xs text-muted-foreground hover:border-destructive/50 hover:text-destructive disabled:opacity-50"
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                  Отменить
                                </button>
                              </>
                            ) : (
                              <p className="text-[11px] text-muted-foreground">
                                Перенос и отмена доступны не позднее чем за 2 часа до записи. По вопросам — позвоните нам.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Reschedule modal */}
            <AnimatePresence>
              {reschedOrder && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
                  onClick={() => setReschedOrder(null)}
                >
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-lg rounded-2xl border border-border/50 bg-card p-6"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="font-display text-lg font-semibold text-foreground">
                        Перенос записи
                      </h3>
                      <button
                        onClick={() => setReschedOrder(null)}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="mb-3 text-xs text-muted-foreground">
                      {reschedOrder.car_make} {reschedOrder.car_model} ·{" "}
                      {reschedOrder.service_id && services[reschedOrder.service_id]?.name}
                    </p>

                    <div className="mb-4">
                      <p className="mb-2 text-xs uppercase text-muted-foreground">Дата</p>
                      <div className="grid grid-cols-7 gap-1.5">
                        {Array.from({ length: 7 }, (_, i) =>
                          addDays(startOfDay(new Date()), i + 1),
                        ).map((d) => {
                          const active = isSameDay(d, reschedDate);
                          return (
                            <button
                              key={d.toISOString()}
                              onClick={() => {
                                setReschedDate(d);
                                setReschedSlot(null);
                              }}
                              className={`flex flex-col items-center rounded-lg border py-2 text-xs ${
                                active
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border/50 hover:border-primary/50"
                              }`}
                            >
                              <span className="opacity-70">{format(d, "EE", { locale: ru })}</span>
                              <span className="font-bold">{format(d, "d")}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mb-4">
                      <p className="mb-2 flex items-center gap-1.5 text-xs uppercase text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        Свободное время
                      </p>
                      <div className="grid max-h-56 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6">
                        {reschedSlots.map(({ time, busy: b, past }) => {
                          const disabled = b || past;
                          const active = reschedSlot && reschedSlot.getTime() === time.getTime();
                          return (
                            <button
                              key={time.toISOString()}
                              disabled={disabled}
                              onClick={() => setReschedSlot(time)}
                              className={`rounded-md border py-1.5 text-xs ${
                                active
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : disabled
                                    ? "cursor-not-allowed border-border/30 bg-muted/30 text-muted-foreground/50 line-through"
                                    : "border-border/50 hover:border-primary"
                              }`}
                            >
                              {format(time, "HH:mm")}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setReschedOrder(null)}
                        className="rounded-lg border border-border/50 px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
                      >
                        Отмена
                      </button>
                      <button
                        onClick={confirmReschedule}
                        disabled={!reschedSlot || actionLoading}
                        className="rounded-lg bg-gold-gradient px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                      >
                        Подтвердить перенос
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </main>
      <Footer />
    </>
  );
}
