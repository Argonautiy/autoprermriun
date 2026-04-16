import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";

const reviews = [
  { name: "Алексей М.", rating: 5, text: "Отличный сервис! Ремонт выполнен качественно и в срок. Рекомендую всем!", date: "2 недели назад" },
  { name: "Дмитрий К.", rating: 5, text: "Заказывал запчасти — привезли быстро, цены адекватные. Ребята знают своё дело.", date: "1 месяц назад" },
  { name: "Марат Б.", rating: 4, text: "Хороший автосервис, мастера профессионалы. Сделали диагностику и ремонт ходовой.", date: "2 месяца назад" },
];

export function ReviewsSection() {
  return (
    <section id="reviews" className="border-t border-border/50 bg-surface py-24">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
            <span className="text-gold-gradient">Отзывы</span> клиентов
          </h2>
          <div className="mt-3 flex items-center justify-center gap-2">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-5 w-5 fill-primary text-primary" />
              ))}
            </div>
            <span className="text-lg font-semibold text-foreground">4.7</span>
            <span className="text-muted-foreground">из 198 оценок</span>
          </div>
        </motion.div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {reviews.map((r, i) => (
            <motion.div
              key={r.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="rounded-xl border border-border/50 bg-card p-6"
            >
              <Quote className="mb-4 h-8 w-8 text-primary/30" />
              <p className="text-sm leading-relaxed text-muted-foreground">{r.text}</p>
              <div className="mt-4 flex items-center justify-between">
                <div>
                  <p className="font-display text-sm font-semibold text-foreground">{r.name}</p>
                  <p className="text-xs text-muted-foreground">{r.date}</p>
                </div>
                <div className="flex">
                  {[...Array(r.rating)].map((_, j) => (
                    <Star key={j} className="h-4 w-4 fill-primary text-primary" />
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
