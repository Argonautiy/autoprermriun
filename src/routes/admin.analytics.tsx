import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Loader2,
  ShieldAlert,
  Download,
  TrendingUp,
  Wallet,
  Receipt,
  ClipboardList,
  Wrench,
  UserCheck,
  Calendar as CalendarIcon,
  Percent,
  Clock,
  Sparkles,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { format, subDays, startOfDay, endOfDay, differenceInDays, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/analytics")({
  component: AnalyticsPage,
  head: () => ({
    meta: [{ title: "Аналитика — Авто Premium" }],
  }),
});

type RepairStatus =
  | "waiting_diagnosis"
  | "waiting_price"
  | "waiting_parts"
  | "in_repair"
  | "ready_for_pickup"
  | "completed"
  | "cancelled";

type Order = {
  id: string;
  status: RepairStatus;
  client_name: string;
  client_phone: string;
  car_make: string;
  car_model: string;
  car_year: number | null;
  car_plate: string | null;
  service_id: string | null;
  scheduled_at: string | null;
  estimated_completion: string | null;
  assigned_master: string | null;
  notes: string | null;
  labor_cost: number;
  user_id: string | null;
  created_at: string;
  updated_at: string;
};

type Service = { id: string; name: string; base_price: number };

const STATUS_LABEL: Record<RepairStatus, string> = {
  waiting_diagnosis: "Ждёт диагностики",
  waiting_price: "Расчёт цены",
  waiting_parts: "Ждёт запчасти",
  in_repair: "В ремонте",
  ready_for_pickup: "Готов к выдаче",
  completed: "Выполнен",
  cancelled: "Отменён",
};

const STATUS_COLORS: Record<RepairStatus, string> = {
  waiting_diagnosis: "#3b82f6",
  waiting_price: "#f59e0b",
  waiting_parts: "#fb923c",
  in_repair: "#a855f7",
  ready_for_pickup: "#10b981",
  completed: "#22c55e",
  cancelled: "#ef4444",
};

const PRESETS = [
  { label: "Сегодня", days: 1 },
  { label: "7 дней", days: 7 },
  { label: "30 дней", days: 30 },
  { label: "90 дней", days: 90 },
] as const;

const MAX_RANGE_DAYS = 92;

function fmtMoney(n: number) {
  return n.toLocaleString("ru-RU", { maximumFractionDigits: 0 }) + " ₸";
}

function AnalyticsPage() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin();
  const navigate = useNavigate();

  const [from, setFrom] = useState<Date>(startOfDay(subDays(new Date(), 29)));
  const [to, setTo] = useState<Date>(endOfDay(new Date()));
  const [orders, setOrders] = useState<Order[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  const load = async () => {
    setLoading(true);
    const [{ data: o }, { data: s }] = await Promise.all([
      supabase
        .from("repair_orders")
        .select("*")
        .gte("created_at", from.toISOString())
        .lte("created_at", to.toISOString())
        .order("created_at", { ascending: true }),
      supabase.from("services").select("id,name,base_price"),
    ]);
    setOrders((o ?? []) as Order[]);
    setServices(s ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, from, to]);

  const applyPreset = (days: number) => {
    setFrom(startOfDay(subDays(new Date(), days - 1)));
    setTo(endOfDay(new Date()));
  };

  const onFromChange = (val: string) => {
    if (!val) return;
    const d = startOfDay(parseISO(val));
    if (differenceInDays(to, d) > MAX_RANGE_DAYS) {
      toast.error(`Максимальный диапазон — ${MAX_RANGE_DAYS} дней (3 месяца)`);
      return;
    }
    if (d > to) {
      toast.error("Дата начала позже даты конца");
      return;
    }
    setFrom(d);
  };

  const onToChange = (val: string) => {
    if (!val) return;
    const d = endOfDay(parseISO(val));
    if (differenceInDays(d, from) > MAX_RANGE_DAYS) {
      toast.error(`Максимальный диапазон — ${MAX_RANGE_DAYS} дней (3 месяца)`);
      return;
    }
    if (d < from) {
      toast.error("Дата конца раньше начала");
      return;
    }
    setTo(d);
  };

  const stats = useMemo(() => {
    const completed = orders.filter((o) => o.status === "completed");
    const cancelled = orders.filter((o) => o.status === "cancelled");
    const open = orders.filter(
      (o) => o.status !== "completed" && o.status !== "cancelled",
    );
    const revenue = completed.reduce((s, o) => s + Number(o.labor_cost || 0), 0);
    const avgCheck = completed.length ? revenue / completed.length : 0;
    const conversion = orders.length ? (completed.length / orders.length) * 100 : 0;
    const cancelRate = orders.length ? (cancelled.length / orders.length) * 100 : 0;

    // Среднее время ремонта (от created_at до updated_at для completed)
    const avgRepairHours = completed.length
      ? completed.reduce((s, o) => {
          const c = new Date(o.created_at).getTime();
          const u = new Date(o.updated_at).getTime();
          return s + Math.max(0, (u - c) / 3_600_000);
        }, 0) / completed.length
      : 0;

    // Прогноз выручки из открытых заказов: labor_cost (если задан) либо base_price услуги
    const forecast = open.reduce((s, o) => {
      if (o.labor_cost > 0) return s + Number(o.labor_cost);
      const svc = services.find((x) => x.id === o.service_id);
      return s + Number(svc?.base_price ?? 0);
    }, 0);

    return {
      total: orders.length,
      completed: completed.length,
      cancelled: cancelled.length,
      open: open.length,
      revenue,
      avgCheck,
      conversion,
      cancelRate,
      avgRepairHours,
      forecast,
    };
  }, [orders, services]);

  const revenueByDay = useMemo(() => {
    const days = differenceInDays(to, from) + 1;
    const buckets: Record<string, { date: string; revenue: number; orders: number }> = {};
    for (let i = 0; i < days; i++) {
      const d = startOfDay(subDays(to, days - 1 - i));
      const key = format(d, "yyyy-MM-dd");
      buckets[key] = { date: format(d, "d MMM", { locale: ru }), revenue: 0, orders: 0 };
    }
    orders.forEach((o) => {
      const key = format(parseISO(o.created_at), "yyyy-MM-dd");
      if (!buckets[key]) return;
      buckets[key].orders += 1;
      if (o.status === "completed") buckets[key].revenue += Number(o.labor_cost || 0);
    });
    return Object.values(buckets);
  }, [orders, from, to]);

  const byStatus = useMemo(() => {
    const map: Record<string, number> = {};
    orders.forEach((o) => {
      map[o.status] = (map[o.status] ?? 0) + 1;
    });
    return Object.entries(map).map(([status, value]) => ({
      status: STATUS_LABEL[status as RepairStatus],
      value,
      color: STATUS_COLORS[status as RepairStatus],
    }));
  }, [orders]);

  const topServices = useMemo(() => {
    const map: Record<string, { name: string; count: number; revenue: number }> = {};
    orders.forEach((o) => {
      const name = services.find((s) => s.id === o.service_id)?.name ?? "Без услуги";
      const key = o.service_id ?? "none";
      if (!map[key]) map[key] = { name, count: 0, revenue: 0 };
      map[key].count += 1;
      if (o.status === "completed") map[key].revenue += Number(o.labor_cost || 0);
    });
    return Object.values(map)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [orders, services]);

  const byMaster = useMemo(() => {
    const map: Record<string, { name: string; total: number; completed: number; revenue: number }> = {};
    orders.forEach((o) => {
      const name = o.assigned_master?.trim() || "Не назначен";
      if (!map[name]) map[name] = { name, total: 0, completed: 0, revenue: 0 };
      map[name].total += 1;
      if (o.status === "completed") {
        map[name].completed += 1;
        map[name].revenue += Number(o.labor_cost || 0);
      }
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [orders]);

  const exportCSV = () => {
    const headers = [
      "ID",
      "Дата создания",
      "Статус",
      "Клиент",
      "Телефон",
      "Авто",
      "Год",
      "Гос.номер",
      "Услуга",
      "Мастер",
      "Запись на",
      "Готов к",
      "Стоимость, ₸",
    ];
    const rows = orders.map((o) => {
      const svc = services.find((s) => s.id === o.service_id)?.name ?? "";
      return [
        o.id,
        format(parseISO(o.created_at), "yyyy-MM-dd HH:mm"),
        STATUS_LABEL[o.status],
        o.client_name,
        o.client_phone,
        `${o.car_make} ${o.car_model}`,
        o.car_year ?? "",
        o.car_plate ?? "",
        svc,
        o.assigned_master ?? "",
        o.scheduled_at ? format(parseISO(o.scheduled_at), "yyyy-MM-dd HH:mm") : "",
        o.estimated_completion ? format(parseISO(o.estimated_completion), "yyyy-MM-dd HH:mm") : "",
        o.labor_cost,
      ];
    });
    const escape = (v: any) => {
      const s = String(v ?? "");
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv =
      "\uFEFF" + // BOM для корректной кириллицы в Excel
      [headers, ...rows].map((r) => r.map(escape).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders_${format(from, "yyyy-MM-dd")}_${format(to, "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Экспортировано: ${orders.length} заказов`);
  };

  if (authLoading || roleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <ShieldAlert className="h-16 w-16 text-primary" />
        <h1 className="font-display text-2xl font-bold">Доступ запрещён</h1>
        <Link to="/" className="text-sm text-primary hover:underline">← На главную</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-24 pb-10">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-6">
          <Link to="/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
            <ArrowLeft className="h-4 w-4" /> Админ
          </Link>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="font-display text-3xl font-bold">Аналитика</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Финансовая и операционная отчётность для бухгалтерии
              </p>
            </div>
            <Button onClick={exportCSV} variant="outline" disabled={!orders.length}>
              <Download className="mr-2 h-4 w-4" />
              Экспорт CSV
            </Button>
          </div>
        </div>

        {/* Период */}
        <div className="mb-6 rounded-xl border border-border/50 bg-card p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <Button
                  key={p.label}
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset(p.days)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap items-end gap-3 ml-auto">
              <div>
                <Label className="text-xs">С</Label>
                <Input
                  type="date"
                  value={format(from, "yyyy-MM-dd")}
                  onChange={(e) => onFromChange(e.target.value)}
                  className="w-[160px]"
                />
              </div>
              <div>
                <Label className="text-xs">По</Label>
                <Input
                  type="date"
                  value={format(to, "yyyy-MM-dd")}
                  onChange={(e) => onToChange(e.target.value)}
                  className="w-[160px]"
                />
              </div>
              <div className="text-xs text-muted-foreground pb-2">
                {differenceInDays(to, from) + 1} дн. (макс 3 мес)
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* KPI карточки */}
            <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
              <Kpi icon={<Wallet className="h-5 w-5" />} label="Выручка" value={fmtMoney(stats.revenue)} accent />
              <Kpi icon={<Receipt className="h-5 w-5" />} label="Средний чек" value={fmtMoney(stats.avgCheck)} />
              <Kpi icon={<ClipboardList className="h-5 w-5" />} label="Заказов всего" value={String(stats.total)} />
              <Kpi icon={<Wrench className="h-5 w-5" />} label="Выполнено" value={String(stats.completed)} sub={`${stats.open} в работе`} />
              <Kpi icon={<Sparkles className="h-5 w-5" />} label="Прогноз выручки" value={fmtMoney(stats.forecast)} sub="из открытых заказов" />
              <Kpi icon={<Percent className="h-5 w-5" />} label="Конверсия" value={`${stats.conversion.toFixed(1)}%`} sub="заявка → выполнено" />
              <Kpi icon={<TrendingUp className="h-5 w-5" />} label="Отмены" value={`${stats.cancelRate.toFixed(1)}%`} sub={`${stats.cancelled} шт.`} />
              <Kpi icon={<Clock className="h-5 w-5" />} label="Ср. срок ремонта" value={`${stats.avgRepairHours.toFixed(1)} ч`} />
              <Kpi icon={<UserCheck className="h-5 w-5" />} label="Активных мастеров" value={String(byMaster.filter((m) => m.name !== "Не назначен").length)} />
              <Kpi icon={<CalendarIcon className="h-5 w-5" />} label="Период" value={`${differenceInDays(to, from) + 1} дн`} sub={`${format(from, "d MMM", { locale: ru })} — ${format(to, "d MMM", { locale: ru })}`} />
            </div>

            {/* Графики */}
            <div className="mb-6 grid gap-4 lg:grid-cols-3">
              <div className="rounded-xl border border-border/50 bg-card p-5 lg:col-span-2">
                <h3 className="mb-4 font-semibold">Выручка и заказы по дням</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={revenueByDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                      formatter={(v: any, name: string) => name === "Выручка" ? fmtMoney(Number(v)) : v}
                    />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="revenue" name="Выручка" stroke="#22c55e" strokeWidth={2} dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="orders" name="Заказы" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-xl border border-border/50 bg-card p-5">
                <h3 className="mb-4 font-semibold">По статусам</h3>
                {byStatus.length ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={byStatus} dataKey="value" nameKey="status" cx="50%" cy="50%" outerRadius={90} label={(e: any) => e.value}>
                        {byStatus.map((s, i) => <Cell key={i} fill={s.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
                    Нет данных
                  </div>
                )}
              </div>
            </div>

            {/* Топ услуг */}
            <div className="mb-6 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-border/50 bg-card p-5">
                <h3 className="mb-4 font-semibold">Топ услуг</h3>
                {topServices.length ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={topServices} layout="vertical" margin={{ left: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                      <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} width={80} />
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                        formatter={(v: any, name: string) => name === "Выручка" ? fmtMoney(Number(v)) : v}
                      />
                      <Legend />
                      <Bar dataKey="count" name="Заказов" fill="#3b82f6" />
                      <Bar dataKey="revenue" name="Выручка" fill="#22c55e" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
                    Нет данных
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-border/50 bg-card p-5">
                <h3 className="mb-4 font-semibold">Загрузка мастеров</h3>
                {byMaster.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs uppercase text-muted-foreground border-b border-border/50">
                        <tr>
                          <th className="py-2 text-left">Мастер</th>
                          <th className="py-2 text-right">Всего</th>
                          <th className="py-2 text-right">Выполн.</th>
                          <th className="py-2 text-right">Выручка</th>
                        </tr>
                      </thead>
                      <tbody>
                        {byMaster.map((m) => (
                          <tr key={m.name} className="border-b border-border/30 last:border-0">
                            <td className="py-2 font-medium">{m.name}</td>
                            <td className="py-2 text-right">{m.total}</td>
                            <td className="py-2 text-right text-emerald-500">{m.completed}</td>
                            <td className="py-2 text-right font-semibold">{fmtMoney(m.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
                    Нет данных
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        accent
          ? "border-primary/40 bg-gradient-to-br from-primary/10 to-transparent"
          : "border-border/50 bg-card"
      }`}
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className={accent ? "text-primary" : ""}>{icon}</span>
        <span>{label}</span>
      </div>
      <div className="mt-2 text-xl font-bold text-foreground">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
