import { useEffect, useState } from "react";
import { Pencil, Trash2, Plus, Loader2, X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export type Service = {
  id: string;
  name: string;
  description: string | null;
  base_price: number;
  sort_order: number;
  duration_minutes: number;
};

export function ServicesPanel({ onChanged }: { onChanged?: () => void }) {
  const [items, setItems] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newDuration, setNewDuration] = useState("60");
  const [newDesc, setNewDesc] = useState("");

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editDuration, setEditDuration] = useState("60");
  const [editDesc, setEditDesc] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("services")
      .select("*")
      .order("sort_order")
      .order("name");
    setItems((data as Service[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("services").insert({
      name: newName.trim(),
      base_price: parseFloat(newPrice) || 0,
      duration_minutes: parseInt(newDuration, 10) || 60,
      description: newDesc.trim() || null,
      sort_order: items.length + 1,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Услуга создана");
    setNewName("");
    setNewPrice("");
    setNewDuration("60");
    setNewDesc("");
    load();
    onChanged?.();
  };

  const startEdit = (s: Service) => {
    setEditId(s.id);
    setEditName(s.name);
    setEditPrice(String(s.base_price));
    setEditDuration(String(s.duration_minutes ?? 60));
    setEditDesc(s.description ?? "");
  };

  const saveEdit = async () => {
    if (!editId) return;
    setBusy(true);
    const { error } = await supabase
      .from("services")
      .update({
        name: editName.trim(),
        base_price: parseFloat(editPrice) || 0,
        duration_minutes: parseInt(editDuration, 10) || 60,
        description: editDesc.trim() || null,
      })
      .eq("id", editId);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Сохранено");
    setEditId(null);
    load();
    onChanged?.();
  };

  const remove = async (s: Service) => {
    if (!confirm(`Удалить услугу «${s.name}»?`)) return;
    const { error } = await supabase.from("services").delete().eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success("Удалено");
    load();
    onChanged?.();
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border/50 bg-card p-4 space-y-4">
        <h3 className="font-display text-base font-semibold text-foreground">
          Новая услуга
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label className="mb-2 block">Название *</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Замена масла"
            />
          </div>
          <div>
            <Label className="mb-2 block">Базовая цена (₸)</Label>
            <Input
              type="number"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              placeholder="5000"
            />
          </div>
          <div>
            <Label className="mb-2 block">Длительность (мин)</Label>
            <Input
              type="number"
              value={newDuration}
              onChange={(e) => setNewDuration(e.target.value)}
              placeholder="60"
            />
          </div>
        </div>
        <div>
          <Label className="mb-2 block">Описание</Label>
          <Textarea
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            rows={2}
            placeholder="Краткое описание работ"
          />
        </div>
        <div className="flex justify-end">
          <Button
            onClick={create}
            disabled={busy || !newName.trim()}
            className="bg-gold-gradient text-primary-foreground"
          >
            <Plus className="mr-2 h-4 w-4" />
            Добавить услугу
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/50 bg-card">
          <table className="w-full">
            <thead className="border-b border-border/50 bg-muted/20 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Название</th>
                <th className="px-4 py-3">Описание</th>
                <th className="px-4 py-3">Цена</th>
                <th className="px-4 py-3">Длит.</th>
                <th className="px-4 py-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) =>
                editId === s.id ? (
                  <tr key={s.id} className="border-b border-border/30 bg-muted/10">
                    <td className="px-4 py-3">
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                    </td>
                    <td className="px-4 py-3">
                      <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        className="w-28"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        value={editDuration}
                        onChange={(e) => setEditDuration(e.target.value)}
                        className="w-20"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button size="icon" variant="ghost" onClick={saveEdit} disabled={busy}>
                          <Check className="h-4 w-4 text-green-500" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setEditId(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr
                    key={s.id}
                    className="border-b border-border/30 last:border-0 hover:bg-muted/10"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-foreground">{s.name}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {s.description ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {Number(s.base_price).toLocaleString("ru-RU")} ₸
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button size="icon" variant="ghost" onClick={() => startEdit(s)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => remove(s)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ),
              )}
              {items.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-12 text-center text-sm text-muted-foreground"
                  >
                    Пока нет услуг
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
