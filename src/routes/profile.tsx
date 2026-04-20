import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Car, Plus, Trash2, LogOut, User, Phone, Save, X, Wrench, Sparkles, AlertTriangle, Info, CheckCircle2, ChevronDown, ChevronUp, Trash,
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { statusBadge, type RepairStatus } from "@/components/admin/OrdersPanel";

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
  const [showAddCar, setShowAddCar] = useState(false);
  const [newCar, setNewCar] = useState({ make: "", model: "", year: new Date().getFullYear() });
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    const [profRes, carsRes, ordersRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", user.id).single(),
      supabase.from("user_cars").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("repair_orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);
    if (profRes.data) {
      setProfile(profRes.data);
      setEditName(profRes.data.full_name || "");
      setEditPhone(profRes.data.phone || "");
    }
    if (carsRes.data) setCars(carsRes.data);
    if (ordersRes.data) setOrders(ordersRes.data);
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

            {/* My repair orders */}
            <div className="mt-6 rounded-2xl border border-border/50 bg-card p-6">
              <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold text-foreground">
                <Wrench className="h-5 w-5 text-primary" />
                Мои заказы на ремонт
              </h2>
              {orders.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  У вас пока нет заказов. Записаться на ремонт можно по телефону.
                </p>
              ) : (
                <div className="space-y-3">
                  {orders.map((o) => (
                    <div
                      key={o.id}
                      className="rounded-xl border border-border/50 bg-surface px-5 py-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-display text-sm font-semibold text-foreground">
                            {o.car_make} {o.car_model}
                            {o.car_year ? ` · ${o.car_year}` : ""}
                          </p>
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
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </main>
      <Footer />
    </>
  );
}
