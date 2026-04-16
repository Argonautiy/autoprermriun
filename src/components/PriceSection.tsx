import { motion } from "framer-motion";

const categories = [
  {
    title: "Диагностика",
    items: [
      { name: "Компьютерная диагностика двигателя", price: "5 000 ₸" },
      { name: "Диагностика ходовой части", price: "3 000 ₸" },
      { name: "Диагностика электрооборудования", price: "5 000 ₸" },
      { name: "Проверка АКБ и генератора", price: "2 000 ₸" },
    ],
  },
  {
    title: "Техническое обслуживание",
    items: [
      { name: "Замена масла и фильтра", price: "от 5 000 ₸" },
      { name: "Замена воздушного фильтра", price: "от 2 000 ₸" },
      { name: "Замена тормозных колодок (ось)", price: "от 6 000 ₸" },
      { name: "Замена тормозных дисков (ось)", price: "от 8 000 ₸" },
      { name: "Замена антифриза", price: "от 5 000 ₸" },
    ],
  },
  {
    title: "Ходовая часть",
    items: [
      { name: "Замена амортизатора (1 шт.)", price: "от 6 000 ₸" },
      { name: "Замена шаровой опоры", price: "от 4 000 ₸" },
      { name: "Замена рулевого наконечника", price: "от 4 000 ₸" },
      { name: "Замена сайлентблоков рычага", price: "от 5 000 ₸" },
      { name: "Развал-схождение", price: "от 6 000 ₸" },
    ],
  },
  {
    title: "Двигатель и трансмиссия",
    items: [
      { name: "Замена ремня ГРМ", price: "от 15 000 ₸" },
      { name: "Замена сцепления", price: "от 20 000 ₸" },
      { name: "Замена масла в АКПП", price: "от 8 000 ₸" },
      { name: "Капитальный ремонт двигателя", price: "от 80 000 ₸" },
    ],
  },
];

export function PriceSection() {
  return (
    <section id="prices" className="border-t border-border/50 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
            <span className="text-gold-gradient">Прайс-лист</span>
          </h2>
          <p className="mt-3 text-muted-foreground">
            Ориентировочные цены на основные услуги. Точная стоимость — после диагностики.
          </p>
        </motion.div>

        <div className="mt-16 grid gap-8 md:grid-cols-2">
          {categories.map((cat, i) => (
            <motion.div
              key={cat.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="rounded-xl border border-border/50 bg-card p-6"
            >
              <h3 className="mb-4 font-display text-lg font-semibold text-gold-gradient">
                {cat.title}
              </h3>
              <div className="space-y-3">
                {cat.items.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between gap-4 border-b border-border/30 pb-3 last:border-0 last:pb-0"
                  >
                    <span className="text-sm text-muted-foreground">{item.name}</span>
                    <span className="shrink-0 font-display text-sm font-semibold text-foreground">
                      {item.price}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-8 text-center text-xs text-muted-foreground"
        >
          * Цены указаны без учёта стоимости запчастей. Окончательная стоимость зависит от марки и модели автомобиля.
        </motion.p>
      </div>
    </section>
  );
}
