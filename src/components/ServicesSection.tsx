import { motion } from "framer-motion";
import { Wrench, ShoppingBag, Settings, Gauge, Shield, Zap } from "lucide-react";

const services = [
  { icon: Wrench, title: "Ремонт двигателя", desc: "Капитальный и текущий ремонт двигателей любой сложности" },
  { icon: Settings, title: "Ходовая часть", desc: "Диагностика и ремонт подвески, рулевого управления" },
  { icon: Gauge, title: "Диагностика", desc: "Компьютерная диагностика всех систем автомобиля" },
  { icon: ShoppingBag, title: "Автозапчасти", desc: "Оригинальные и качественные аналоги запчастей" },
  { icon: Shield, title: "ТО и обслуживание", desc: "Плановое техническое обслуживание по регламенту" },
  { icon: Zap, title: "Электрика", desc: "Ремонт электрооборудования и проводки автомобиля" },
];

export function ServicesSection() {
  return (
    <section id="services" className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
            Наши <span className="text-gold-gradient">услуги</span>
          </h2>
          <p className="mt-3 text-muted-foreground">Полный спектр автосервисных услуг</p>
        </motion.div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="group rounded-xl border border-border/50 bg-card p-6 transition-all hover:border-primary/30 hover:shadow-gold"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <s.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-display text-lg font-semibold text-foreground">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
