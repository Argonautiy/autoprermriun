import { useEffect, useMemo, useState } from "react";
import { Plus, Loader2, Pencil, Trash2, X, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export const STATUS_OPTIONS = [
  { value: "waiting_diagnosis", label: "Ждёт диагностики", color: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  { value: "waiting_price", label: "Ждёт расчёта цены", color: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  { value: "waiting_parts", label: "Ждёт запчастей", color: "bg-purple-500/15 text-purple-600 dark:text-purple-400" },
  { value: "in_repair", label: "В ремонте", color: "bg-orange-500/15 text-orange-600 dark:text-orange-400" },
  { value: "ready_for_pickup", label: "Готов к выдаче", color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  { value: "completed", label: "Завершён", color: "bg-green-500/15 text-green-600 dark:text-green-400" },
  { value: "cancelled", label: "Отменён", color: "bg-muted text-muted-foreground" },
] as const;

export type RepairStatus = (typeof STATUS_OPTIONS)[number]["value"];

const ACTIVE_STATUSES: RepairStatus[] = [
  "waiting_diagnosis",
  "waiting_price",
  "waiting_parts",
  "in_repair",
  "ready_for_pickup",
];

export function statusBadge(status: RepairStatus) {
  const opt = STATUS_OPTIONS.find((s) => s.value === status);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${opt?.color ?? ""}`}
    >
      {opt?.label ?? status}
    </span>
  );
}

type Service = { id: string; name: string; base_price: number };
type Part = { id: string; name: string; price: number; article: string | null };

type Order = {
  id: string;
  client_name: string;
  client_phone: string;
  car_make: string;
  car_model: string;
  car_year: number | null;
  car_plate: string | null;
  service_id: string | null;
  status: RepairStatus;
  scheduled_at: string | null;
  estimated_completion: string | null;
  labor_cost: number;
  assigned_master: string | null;
  notes: string | null;
  created_at: string;
};

type OrderPart = {
  id: string;
  order_id: string;
  part_id: string;
  quantity: number;
  unit_price: number;
};

type FormState = {
  client_name: string;
  client_phone: string;
  car_make: string;
  car_model: string;
  car_year: string;
  car_plate: string;
  service_id: string;
  status: RepairStatus;
  scheduled_at: string;
  estimated_completion: string;
  labor_cost: string;
  assigned_master: string;
  notes: string;
};

const emptyForm: FormState = {
  client_name: "",
  client_phone: "",
  car_make: "",
  car_model: "",
  car_year: "",
  car_plate: "",
  service_id: "",
  status: "waiting_diagnosis",
  scheduled_at: "",
  estimated_completion: "",
  labor_cost: "",
  assigned_master: "",
  notes: "",
};

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function OrdersPanel() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderParts, setOrderParts] = useState<OrderPart[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [draftParts, setDraftParts] = useState<
    { part_id: string; quantity: number; unit_price: number }[]
  >([]);

  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    const [oRes, opRes, sRes, pRes] = await Promise.all([
      supabase.from("repair_orders").select("*").order("created_at", { ascending: false }),
      supabase.from("repair_order_parts").select("*"),
      supabase.from("services").select("id,name,base_price").order("name"),
      supabase.from("parts").select("id,name,price,article").order("name"),
    ]);
    setOrders((oRes.data as Order[]) ?? []);
    setOrderParts((opRes.data as OrderPart[]) ?? []);
    setServices((sRes.data as Service[]) ?? []);
    setParts((pRes.data as Part[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const o of orders) c[o.status] = (c[o.status] ?? 0) + 1;
    return c;
  }, [orders]);

  const orderTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const op of orderParts) {
      map.set(op.order_id, (map.get(op.order_id) ?? 0) + op.unit_price * op.quantity);
    }
    return map;
  }, [orderParts]);

  const activeRevenue = useMemo(
    () =>
      orders
        .filter((o) => ACTIVE_STATUSES.includes(o.status))
        .reduce((sum, o) => sum + Number(o.labor_cost) + (orderTotals.get(o.id) ?? 0), 0),
    [orders, orderTotals],
  );

  const completedRevenue = useMemo(
    () =>
      orders
        .filter((o) => o.status === "completed")
        .reduce((sum, o) => sum + Number(o.labor_cost) + (orderTotals.get(o.id) ?? 0), 0),
    [orders, orderTotals],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (filterStatus !== "all" && o.status !== filterStatus) return false;
      if (!q) return true;
      return (
        o.client_name.toLowerCase().includes(q) ||
        o.client_phone.toLowerCase().includes(q) ||
        o.car_make.toLowerCase().includes(q) ||
        o.car_model.toLowerCase().includes(q) ||
        (o.car_plate ?? "").toLowerCase().includes(q)
      );
    });
  }, [orders, search, filterStatus]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDraftParts([]);
    setShowForm(true);
  };

  const openEdit = (o: Order) => {
    setEditing(o);
    setForm({
      client_name: o.client_name,
      client_phone: o.client_phone,
      car_make: o.car_make,
      car_model: o.car_model,
      car_year: o.car_year ? String(o.car_year) : "",
      car_plate: o.car_plate ?? "",
      service_id: o.service_id ?? "",
      status: o.status,
      scheduled_at: toLocalInput(o.scheduled_at),
      estimated_completion: toLocalInput(o.estimated_completion),
      labor_cost: String(o.labor_cost ?? ""),
      assigned_master: o.assigned_master ?? "",
      notes: o.notes ?? "",
    });
    setDraftParts(
      orderParts
        .filter((op) => op.order_id === o.id)
        .map((op) => ({ part_id: op.part_id, quantity: op.quantity, unit_price: op.unit_price })),
    );
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.client_name.trim() || !form.client_phone.trim() || !form.car_make.trim() || !form.car_model.trim()) {
      toast.error("Заполните клиента и авто");
      return;
    }
    setSaving(true);
    const payload = {
      client_name: form.client_name.trim(),
      client_phone: form.client_phone.trim(),
      car_make: form.car_make.trim(),
      car_model: form.car_model.trim(),
      car_year: form.car_year ? parseInt(form.car_year, 10) : null,
      car_plate: form.car_plate.trim() || null,
      service_id: form.service_id || null,
      status: form.status,
      scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
      estimated_completion: form.estimated_completion
        ? new Date(form.estimated_completion).toISOString()
        : null,
      labor_cost: parseFloat(form.labor_cost) || 0,
      assigned_master: form.assigned_master.trim() || null,
      notes: form.notes.trim() || null,
    };

    let orderId = editing?.id;
    if (editing) {
      const { error } = await supabase.from("repair_orders").update(payload).eq("id", editing.id);
      if (error) {
        setSaving(false);
        return toast.error(error.message);
      }
    } else {
      const { data, error } = await supabase
        .from("repair_orders")
        .insert(payload)
        .select("id")
        .single();
      if (error || !data) {
        setSaving(false);
        return toast.error(error?.message ?? "Ошибка");
      }
      orderId = data.id;
    }

    if (orderId) {
      // sync parts: simplest — delete all and reinsert
      await supabase.from("repair_order_parts").delete().eq("order_id", orderId);
      if (draftParts.length > 0) {
        const rows = draftParts
          .filter((d) => d.part_id && d.quantity > 0)
          .map((d) => ({
            order_id: orderId!,
            part_id: d.part_id,
            quantity: d.quantity,
            unit_price: d.unit_price,
          }));
        if (rows.length > 0) {
          const { error } = await supabase.from("repair_order_parts").insert(rows);
          if (error) {
            setSaving(false);
            return toast.error(error.message);
          }
        }
      }
    }

    setSaving(false);
    toast.success(editing ? "Заказ обновлён" : "Заказ создан");
    setShowForm(false);
    load();
  };

  const handleDelete = async (o: Order) => {
    if (!confirm(`Удалить заказ для ${o.client_name}?`)) return;
    const { error } = await supabase.from("repair_orders").delete().eq("id", o.id);
    if (error) return toast.error(error.message);
    toast.success("Удалено");
    load();
  };

  const updateStatus = async (o: Order, newStatus: RepairStatus) => {
    const { error } = await supabase
      .from("repair_orders")
      .update({ status: newStatus })
      .eq("id", o.id);
    if (error) return toast.error(error.message);
    setOrders((prev) => prev.map((x) => (x.id === o.id ? { ...x, status: newStatus } : x)));
  };

  const addDraftPart = () => {
    setDraftParts((prev) => [...prev, { part_id: "", quantity: 1, unit_price: 0 }]);
  };

  const updateDraftPart = (idx: number, patch: Partial<(typeof draftParts)[number]>) => {
    setDraftParts((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  };

  const removeDraftPart = (idx: number) => {
    setDraftParts((prev) => prev.filter((_, i) => i !== idx));
  };

  const draftTotal = draftParts.reduce((s, d) => s + d.quantity * d.unit_price, 0);
  const draftGrand = draftTotal + (parseFloat(form.labor_cost) || 0);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STATUS_OPTIONS.filter((s) => ACTIVE_STATUSES.includes(s.value)).map((s) => (
          <Card key={s.value} className="border-border/50 bg-card">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="mt-1 font-display text-2xl font-bold text-foreground">
                {counts[s.value] ?? 0}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="border-primary/30 bg-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Сумма по активным заказам</p>
            <p className="mt-1 font-display text-2xl font-bold text-gold-gradient">
              {activeRevenue.toLocaleString("ru-RU")} ₸
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Выручка (завершённые)</p>
            <p className="mt-1 font-display text-2xl font-bold text-foreground">
              {completedRevenue.toLocaleString("ru-RU")} ₸
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Schedule */}
      <ScheduleStrip orders={orders} services={services} />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по клиенту, телефону, авто..."
            className="pl-9"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={openCreate} className="bg-gold-gradient text-primary-foreground">
          <Plus className="mr-2 h-4 w-4" />
          Запись на ремонт
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/50 bg-card">
          <table className="w-full min-w-[900px]">
            <thead className="border-b border-border/50 bg-muted/20 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Клиент</th>
                <th className="px-4 py-3">Авто</th>
                <th className="px-4 py-3">Услуга</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Сумма</th>
                <th className="px-4 py-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => {
                const partsTotal = orderTotals.get(o.id) ?? 0;
                const total = Number(o.labor_cost) + partsTotal;
                const service = services.find((s) => s.id === o.service_id);
                return (
                  <tr
                    key={o.id}
                    className="border-b border-border/30 last:border-0 hover:bg-muted/10"
                  >
                    <td className="px-4 py-3 text-sm">
                      <p className="font-medium text-foreground">{o.client_name}</p>
                      <p className="text-xs text-muted-foreground">{o.client_phone}</p>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <p className="text-foreground">
                        {o.car_make} {o.car_model}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {o.car_year ?? "—"} {o.car_plate ? `· ${o.car_plate}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {service?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Select
                        value={o.status}
                        onValueChange={(v) => updateStatus(o, v as RepairStatus)}
                      >
                        <SelectTrigger className="h-8 w-44">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-foreground">
                      {total.toLocaleString("ru-RU")} ₸
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(o)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(o)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    Заказов пока нет
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="my-10 w-full max-w-2xl rounded-xl border border-border/50 bg-card p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-foreground">
                {editing ? "Редактировать заказ" : "Запись на ремонт"}
              </h2>
              <Button size="icon" variant="ghost" onClick={() => setShowForm(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-5">
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Клиент
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Имя *</Label>
                    <Input
                      value={form.client_name}
                      onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                      placeholder="Иван Иванов"
                    />
                  </div>
                  <div>
                    <Label>Телефон *</Label>
                    <Input
                      value={form.client_phone}
                      onChange={(e) => setForm({ ...form, client_phone: e.target.value })}
                      placeholder="+7 777 123 45 67"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Автомобиль
                </h3>
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="sm:col-span-1">
                    <Label>Марка *</Label>
                    <Input
                      value={form.car_make}
                      onChange={(e) => setForm({ ...form, car_make: e.target.value })}
                      placeholder="Toyota"
                    />
                  </div>
                  <div className="sm:col-span-1">
                    <Label>Модель *</Label>
                    <Input
                      value={form.car_model}
                      onChange={(e) => setForm({ ...form, car_model: e.target.value })}
                      placeholder="Camry"
                    />
                  </div>
                  <div>
                    <Label>Год</Label>
                    <Input
                      type="number"
                      value={form.car_year}
                      onChange={(e) => setForm({ ...form, car_year: e.target.value })}
                      placeholder="2020"
                    />
                  </div>
                  <div>
                    <Label>Гос. номер</Label>
                    <Input
                      value={form.car_plate}
                      onChange={(e) => setForm({ ...form, car_plate: e.target.value })}
                      placeholder="A 123 BC"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Услуга и статус
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Услуга</Label>
                    <Select
                      value={form.service_id || "none"}
                      onValueChange={(v) => {
                        const svc = services.find((s) => s.id === v);
                        setForm({
                          ...form,
                          service_id: v === "none" ? "" : v,
                          labor_cost:
                            svc && !form.labor_cost ? String(svc.base_price) : form.labor_cost,
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите услугу" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— не выбрана —</SelectItem>
                        {services.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name} · {Number(s.base_price).toLocaleString("ru-RU")} ₸
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Статус</Label>
                    <Select
                      value={form.status}
                      onValueChange={(v) => setForm({ ...form, status: v as RepairStatus })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Дата записи</Label>
                  <Input
                    type="datetime-local"
                    value={form.scheduled_at}
                    onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Планируемая выдача</Label>
                  <Input
                    type="datetime-local"
                    value={form.estimated_completion}
                    onChange={(e) => setForm({ ...form, estimated_completion: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Стоимость работ (₸)</Label>
                  <Input
                    type="number"
                    value={form.labor_cost}
                    onChange={(e) => setForm({ ...form, labor_cost: e.target.value })}
                    placeholder="20000"
                  />
                </div>
                <div>
                  <Label>Ответственный мастер</Label>
                  <Input
                    value={form.assigned_master}
                    onChange={(e) => setForm({ ...form, assigned_master: e.target.value })}
                    placeholder="Иван Петров"
                  />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Использованные запчасти
                  </h3>
                  <Button size="sm" variant="outline" onClick={addDraftPart}>
                    <Plus className="mr-1 h-3 w-3" /> Добавить
                  </Button>
                </div>
                <div className="space-y-2">
                  {draftParts.map((d, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2">
                      <div className="col-span-6">
                        <Select
                          value={d.part_id}
                          onValueChange={(v) => {
                            const part = parts.find((p) => p.id === v);
                            updateDraftPart(i, {
                              part_id: v,
                              unit_price: part?.price ?? d.unit_price,
                            });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Выберите запчасть" />
                          </SelectTrigger>
                          <SelectContent>
                            {parts.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name} {p.article ? `(${p.article})` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Input
                        type="number"
                        min={1}
                        className="col-span-2"
                        value={d.quantity}
                        onChange={(e) =>
                          updateDraftPart(i, { quantity: parseInt(e.target.value, 10) || 1 })
                        }
                      />
                      <Input
                        type="number"
                        className="col-span-3"
                        value={d.unit_price}
                        onChange={(e) =>
                          updateDraftPart(i, { unit_price: parseFloat(e.target.value) || 0 })
                        }
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="col-span-1"
                        onClick={() => removeDraftPart(i)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  {draftParts.length === 0 && (
                    <p className="rounded-lg border border-dashed border-border/50 px-3 py-4 text-center text-xs text-muted-foreground">
                      Запчасти не добавлены
                    </p>
                  )}
                </div>
                <div className="mt-3 flex justify-between rounded-lg bg-muted/30 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">
                    Запчасти: {draftTotal.toLocaleString("ru-RU")} ₸
                  </span>
                  <span className="font-semibold text-foreground">
                    Итого: {draftGrand.toLocaleString("ru-RU")} ₸
                  </span>
                </div>
              </div>

              <div>
                <Label>Комментарий</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  placeholder="Описание проблемы, договорённости..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1">
                  Отмена
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 bg-gold-gradient text-primary-foreground"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Сохранить"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ScheduleStrip({ orders, services }: { orders: Order[]; services: Service[] }) {
  const [dayOffset, setDayOffset] = useState(0);

  const day = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [dayOffset]);

  const dayEnd = useMemo(() => {
    const d = new Date(day);
    d.setDate(d.getDate() + 1);
    return d;
  }, [day]);

  const scheduled = useMemo(
    () =>
      orders
        .filter(
          (o) =>
            o.scheduled_at &&
            o.status !== "cancelled" &&
            new Date(o.scheduled_at) >= day &&
            new Date(o.scheduled_at) < dayEnd,
        )
        .sort(
          (a, b) =>
            new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime(),
        ),
    [orders, day, dayEnd],
  );

  const dayLabel = day.toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="rounded-xl border border-border/50 bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="font-display text-base font-semibold text-foreground">
            Расписание
          </h3>
          <p className="text-xs capitalize text-muted-foreground">{dayLabel}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => setDayOffset((o) => o - 1)}>
            ←
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDayOffset(0)}
            disabled={dayOffset === 0}
          >
            Сегодня
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDayOffset((o) => o + 1)}>
            →
          </Button>
        </div>
      </div>

      {scheduled.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          На этот день записей нет
        </p>
      ) : (
        <div className="space-y-2">
          {scheduled.map((o) => {
            const time = new Date(o.scheduled_at!).toLocaleTimeString("ru-RU", {
              hour: "2-digit",
              minute: "2-digit",
            });
            const svc = services.find((s) => s.id === o.service_id);
            return (
              <div
                key={o.id}
                className="flex items-center gap-3 rounded-lg border border-border/40 bg-background/50 px-3 py-2"
              >
                <div className="flex h-12 w-16 flex-col items-center justify-center rounded-md bg-primary/10 text-primary">
                  <span className="font-display text-sm font-bold">{time}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {o.client_name} · {o.car_make} {o.car_model}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {svc?.name ?? "Без услуги"} · {o.client_phone}
                  </p>
                </div>
                {statusBadge(o.status)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

