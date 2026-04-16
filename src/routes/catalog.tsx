import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import {
  CarFront, Cog, Settings, Zap, CircleDot, Lightbulb, Droplets,
  Search, Package, Check, X,
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/catalog")({
  head: () => ({
    meta: [
      { title: "Каталог запчастей — Авто Premium" },
      { name: "description", content: "Каталог автозапчастей с ценами: ходовая, двигатель, электрика, тормоза, кузов, фильтры и масла" },
    ],
  }),
  component: CatalogPage,
});

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  CarFront, Cog, Settings, Zap, CircleDot, Lightbulb, Droplets,
};

function CatalogPage() {
  const [categories, setCategories] = useState<Tables<"parts_categories">[]>([]);
  const [parts, setParts] = useState<Tables<"parts">[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [catsRes, partsRes] = await Promise.all([
        supabase.from("parts_categories").select("*").order("sort_order"),
        supabase.from("parts").select("*").eq("in_stock", true).order("name"),
      ]);
      if (catsRes.data) setCategories(catsRes.data);
      if (partsRes.data) setParts(partsRes.data);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = parts.filter((p) => {
    const matchCat = !activeCategory || p.category_id === activeCategory;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.article?.toLowerCase().includes(search.toLowerCase()));
    return matchCat && matchSearch;
  });

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("ru-KZ").format(price) + " ₸";

  return (
    <>
      <Header />
      <main className="min-h-screen pt-24 pb-16">
        <div className="mx-auto max-w-7xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
              <span className="text-gold-gradient">Каталог запчастей</span>
            </h1>
            <p className="mt-3 text-muted-foreground">
              Оригинальные и качественные аналоги для вашего автомобиля
            </p>
          </motion.div>

          {/* Search */}
          <div className="relative mx-auto mt-10 max-w-lg">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Поиск по названию или артикулу..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-border/50 bg-card py-3 pl-11 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Categories */}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => setActiveCategory(null)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                !activeCategory
                  ? "bg-gold-gradient text-primary-foreground shadow-gold"
                  : "border border-border/50 bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              <Package className="h-4 w-4" />
              Все
            </button>
            {categories.map((cat) => {
              const Icon = iconMap[cat.icon || ""] || Package;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                    activeCategory === cat.id
                      ? "bg-gold-gradient text-primary-foreground shadow-gold"
                      : "border border-border/50 bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {cat.name}
                </button>
              );
            })}
          </div>

          {/* Parts grid */}
          {loading ? (
            <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-32 animate-pulse rounded-xl bg-card" />
              ))}
            </div>
          ) : (
            <div className="mt-10">
              {activeCategory && (
                <p className="mb-4 text-sm text-muted-foreground">
                  {categories.find((c) => c.id === activeCategory)?.description}
                </p>
              )}
              <AnimatePresence mode="popLayout">
                {filtered.length === 0 ? (
                  <motion.p
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-16 text-center text-muted-foreground"
                  >
                    Ничего не найдено
                  </motion.p>
                ) : (
                  <motion.div
                    layout
                    className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                  >
                    {filtered.map((part) => (
                      <motion.div
                        key={part.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="rounded-xl border border-border/50 bg-card p-5 transition-colors hover:border-primary/30"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-display text-sm font-semibold text-foreground">
                              {part.name}
                            </h3>
                            {part.article && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                Арт: {part.article}
                              </p>
                            )}
                            {part.description && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {part.description}
                              </p>
                            )}
                          </div>
                          <div className="shrink-0 text-right">
                            <span className="font-display text-lg font-bold text-gold-gradient">
                              {formatPrice(part.price)}
                            </span>
                            <div className="mt-1 flex items-center gap-1 text-xs text-accent">
                              <Check className="h-3 w-3 text-accent" />
                              <span className="text-accent">В наличии</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mt-12 text-center text-xs text-muted-foreground"
          >
            * Цены актуальны на момент публикации. Уточняйте наличие и стоимость по телефону{" "}
            <a href="tel:+77026449244" className="text-primary hover:underline">
              +7 702 644 92 44
            </a>
          </motion.p>
        </div>
      </main>
      <Footer />
    </>
  );
}
