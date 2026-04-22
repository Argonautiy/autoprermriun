import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import * as LucideIcons from "lucide-react";
import { Pencil, Trash2, Plus, X, ShieldAlert, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { OrdersPanel } from "@/components/admin/OrdersPanel";
import { ServicesPanel } from "@/components/admin/ServicesPanel";

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9а-яё\s-]/gi, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({
    meta: [{ title: "Админ-панель — Авто Premium" }],
  }),
});

type Category = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  description: string | null;
};

const ICON_OPTIONS = [
  "CarFront", "Cog", "Settings", "Zap", "CircleDot", "Lightbulb", "Droplets", "Package",
] as const;

type Part = {
  id: string;
  name: string;
  article: string | null;
  description: string | null;
  price: number;
  in_stock: boolean;
  category_id: string;
};

type FormState = {
  name: string;
  article: string;
  description: string;
  price: string;
  in_stock: boolean;
  category_id: string;
};

const emptyForm: FormState = {
  name: "",
  article: "",
  description: "",
  price: "",
  in_stock: true,
  category_id: "",
};

function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin();
  const navigate = useNavigate();

  const [categories, setCategories] = useState<Category[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Part | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  const loadData = async () => {
    setLoading(true);
    const [{ data: cats }, { data: prts }] = await Promise.all([
      supabase.from("parts_categories").select("id,name,slug,icon,description").order("sort_order"),
      supabase.from("parts").select("*").order("name"),
    ]);
    setCategories(cats ?? []);
    setParts(prts ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) loadData();
  }, [isAdmin]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, category_id: categories[0]?.id ?? "" });
    setShowForm(true);
  };

  const openEdit = (p: Part) => {
    setEditing(p);
    setForm({
      name: p.name,
      article: p.article ?? "",
      description: p.description ?? "",
      price: String(p.price),
      in_stock: p.in_stock,
      category_id: p.category_id,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.category_id || !form.price) {
      toast.error("Заполните название, категорию и цену");
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      article: form.article.trim() || null,
      description: form.description.trim() || null,
      price: parseInt(form.price, 10),
      in_stock: form.in_stock,
      category_id: form.category_id,
    };

    const { error } = editing
      ? await supabase.from("parts").update(payload).eq("id", editing.id)
      : await supabase.from("parts").insert(payload);

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editing ? "Запчасть обновлена" : "Запчасть добавлена");
    setShowForm(false);
    loadData();
  };

  const handleDelete = async (p: Part) => {
    if (!confirm(`Удалить «${p.name}»?`)) return;
    const { error } = await supabase.from("parts").delete().eq("id", p.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Удалено");
    loadData();
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
        <h1 className="font-display text-2xl font-bold text-foreground">
          Доступ запрещён
        </h1>
        <p className="max-w-md text-muted-foreground">
          У вас нет прав администратора. Чтобы получить доступ, попросите назначить
          вашему аккаунту роль <code className="text-primary">admin</code> в таблице{" "}
          <code className="text-primary">user_roles</code>.
        </p>
        <p className="text-xs text-muted-foreground">
          Ваш user_id: <code>{user?.id}</code>
        </p>
        <Link to="/" className="text-sm text-primary hover:underline">
          ← На главную
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 pt-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">
              Админ-панель
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Управление каталогом · {parts.length} товаров · {categories.length} категорий
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/analytics">
              <Button variant="outline">
                <LucideIcons.BarChart3 className="mr-2 h-4 w-4" />
                Аналитика
              </Button>
            </Link>
            <Link to="/admin/kanban">
              <Button className="bg-gold-gradient text-primary-foreground">
                <LucideIcons.LayoutGrid className="mr-2 h-4 w-4" />
                Kanban-доска заказов
              </Button>
            </Link>
          </div>
        </div>

        <Tabs defaultValue="orders" className="w-full">
          <TabsList className="mb-6 flex-wrap">
            <TabsTrigger value="orders">Заказы</TabsTrigger>
            <TabsTrigger value="services">Услуги</TabsTrigger>
            <TabsTrigger value="parts">Запчасти</TabsTrigger>
            <TabsTrigger value="categories">Категории</TabsTrigger>
          </TabsList>

          <TabsContent value="orders">
            <OrdersPanel />
          </TabsContent>

          <TabsContent value="services">
            <ServicesPanel />
          </TabsContent>

          <TabsContent value="parts">
            <div className="mb-4 flex justify-end">
              <Button onClick={openCreate} className="bg-gold-gradient text-primary-foreground">
                <Plus className="mr-2 h-4 w-4" />
                Добавить запчасть
              </Button>
            </div>

            {loading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border/50 bg-card">
                <table className="w-full">
                  <thead className="border-b border-border/50 bg-muted/20 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Название</th>
                      <th className="px-4 py-3">Артикул</th>
                      <th className="px-4 py-3">Категория</th>
                      <th className="px-4 py-3">Цена</th>
                      <th className="px-4 py-3">Наличие</th>
                      <th className="px-4 py-3 text-right">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parts.map((p) => {
                      const cat = categories.find((c) => c.id === p.category_id);
                      return (
                        <tr key={p.id} className="border-b border-border/30 last:border-0 hover:bg-muted/10">
                          <td className="px-4 py-3 text-sm font-medium text-foreground">{p.name}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{p.article ?? "—"}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{cat?.name ?? "—"}</td>
                          <td className="px-4 py-3 text-sm text-foreground">{p.price.toLocaleString("ru-RU")} ₸</td>
                          <td className="px-4 py-3 text-sm">
                            <span className={p.in_stock ? "text-green-500" : "text-muted-foreground"}>
                              {p.in_stock ? "В наличии" : "Нет"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => handleDelete(p)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {parts.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                          Пока нет запчастей
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="categories">
            <CategoriesPanel categories={categories} parts={parts} onChange={loadData} />
          </TabsContent>
        </Tabs>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg rounded-xl border border-border/50 bg-card p-6 shadow-xl"
          >
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-foreground">
                {editing ? "Редактировать запчасть" : "Новая запчасть"}
              </h2>
              <Button size="icon" variant="ghost" onClick={() => setShowForm(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <Label>Название *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Тормозные колодки..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Артикул</Label>
                  <Input
                    value={form.article}
                    onChange={(e) => setForm({ ...form, article: e.target.value })}
                    placeholder="ABC-123"
                  />
                </div>
                <div>
                  <Label>Цена (₸) *</Label>
                  <Input
                    type="number"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    placeholder="15000"
                  />
                </div>
              </div>

              <div>
                <Label>Категория *</Label>
                <Select
                  value={form.category_id}
                  onValueChange={(v) => setForm({ ...form, category_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите категорию" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Описание</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border/50 px-4 py-3">
                <Label className="cursor-pointer">В наличии</Label>
                <Switch
                  checked={form.in_stock}
                  onCheckedChange={(v) => setForm({ ...form, in_stock: v })}
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
          </motion.div>
        </div>
      )}
    </div>
  );
}

function CategoriesPanel({
  categories,
  parts,
  onChange,
}: {
  categories: Category[];
  parts: Part[];
  onChange: () => void;
}) {
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState<string>("Package");
  const [newDescription, setNewDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState<string>("Package");
  const [editDescription, setEditDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    const slug = slugify(name) || `cat-${Date.now()}`;
    const maxOrder = Math.max(0, ...categories.map((_, i) => i + 1));
    const { error } = await supabase.from("parts_categories").insert({
      name,
      slug,
      sort_order: maxOrder,
      icon: newIcon,
      description: newDescription.trim() || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Категория создана");
    setNewName("");
    setNewDescription("");
    setNewIcon("Package");
    onChange();
  };

  const startEdit = (c: Category) => {
    setEditingId(c.id);
    setEditName(c.name);
    setEditIcon(c.icon || "Package");
    setEditDescription(c.description || "");
  };

  const saveEdit = async (id: string) => {
    const name = editName.trim();
    if (!name) return;
    setBusy(true);
    const { error } = await supabase
      .from("parts_categories")
      .update({
        name,
        slug: slugify(name) || `cat-${Date.now()}`,
        icon: editIcon,
        description: editDescription.trim() || null,
      })
      .eq("id", id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Обновлено");
    setEditingId(null);
    onChange();
  };

  const remove = async (c: Category) => {
    const count = parts.filter((p) => p.category_id === c.id).length;
    if (count > 0) {
      toast.error(`Нельзя удалить: в категории ${count} запчастей`);
      return;
    }
    if (!confirm(`Удалить категорию «${c.name}»?`)) return;
    const { error } = await supabase.from("parts_categories").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Удалено");
    onChange();
  };

  const renderIcon = (name: string | null) => {
    const Icon = (LucideIcons as any)[name || "Package"] || LucideIcons.Package;
    return <Icon className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border/50 bg-card p-4 space-y-4">
        <div>
          <Label className="mb-2 block">Название новой категории</Label>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Например: Аксессуары"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="mb-2 block">Иконка</Label>
            <Select value={newIcon} onValueChange={setNewIcon}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ICON_OPTIONS.map((name) => (
                  <SelectItem key={name} value={name}>
                    <span className="flex items-center gap-2">
                      {renderIcon(name)}
                      {name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-2 block">Описание</Label>
            <Input
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Краткое описание раздела"
            />
          </div>
        </div>
        <Button
          onClick={create}
          disabled={busy || !newName.trim()}
          className="bg-gold-gradient text-primary-foreground"
        >
          <Plus className="mr-2 h-4 w-4" />
          Добавить категорию
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/50 bg-card">
        <table className="w-full">
          <thead className="border-b border-border/50 bg-muted/20 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Иконка</th>
              <th className="px-4 py-3">Название</th>
              <th className="px-4 py-3">Описание</th>
              <th className="px-4 py-3">Запчастей</th>
              <th className="px-4 py-3 text-right">Действия</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => {
              const count = parts.filter((p) => p.category_id === c.id).length;
              const isEditing = editingId === c.id;
              return (
                <tr key={c.id} className="border-b border-border/30 last:border-0 hover:bg-muted/10 align-top">
                  <td className="px-4 py-3 text-primary">
                    {isEditing ? (
                      <Select value={editIcon} onValueChange={setEditIcon}>
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ICON_OPTIONS.map((name) => (
                            <SelectItem key={name} value={name}>
                              <span className="flex items-center gap-2">
                                {renderIcon(name)}
                                {name}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      renderIcon(c.icon)
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-foreground">
                    {isEditing ? (
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        autoFocus
                      />
                    ) : (
                      <>
                        <div>{c.name}</div>
                        <div className="text-xs text-muted-foreground">{c.slug}</div>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground max-w-xs">
                    {isEditing ? (
                      <Input
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="Описание"
                      />
                    ) : (
                      c.description || "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{count}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {isEditing ? (
                        <>
                          <Button size="sm" onClick={() => saveEdit(c.id)} disabled={busy}>
                            Сохранить
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                            Отмена
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button size="icon" variant="ghost" onClick={() => startEdit(c)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => remove(c)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {categories.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  Категорий пока нет
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
