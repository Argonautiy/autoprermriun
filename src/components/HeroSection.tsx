import { motion } from "framer-motion";
import { Star, MapPin, Clock } from "lucide-react";
import heroBg from "@/assets/hero-bg.jpg";

export function HeroSection() {
  return (
    <section className="relative flex min-h-screen items-center overflow-hidden">
      <img
        src={heroBg}
        alt="Премиальный автосервис Авто Premium"
        width={1920}
        height={1080}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="hero-overlay absolute inset-0" />

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-32">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-2xl"
        >
          <div className="mb-6 flex items-center gap-3">
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`h-5 w-5 ${i < 5 ? "fill-primary text-primary" : "text-muted-foreground"}`}
                />
              ))}
            </div>
            <span className="text-sm font-medium text-primary">4.7</span>
            <span className="text-sm text-muted-foreground">198 оценок</span>
          </div>

          <h1 className="font-display text-5xl font-bold leading-tight tracking-tight md:text-7xl">
            Авто{" "}
            <span className="text-gold-gradient">Premium</span>
          </h1>

          <p className="mt-4 text-lg text-muted-foreground md:text-xl">
            Автосервис и магазин автозапчастей в Кокшетау. Профессиональный ремонт и оригинальные запчасти.
          </p>

          <div className="mt-8 flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:gap-6">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              ул. Смагула Садвакасова, 99а
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Пн–Пт: 09:00–18:00
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <a
              href="tel:+77778747313"
              className="inline-flex items-center justify-center rounded-lg bg-gold-gradient px-8 py-3.5 font-display text-sm font-semibold text-primary-foreground shadow-gold transition-opacity hover:opacity-90"
            >
              Записаться на сервис
            </a>
            <a
              href="tel:+77026449244"
              className="inline-flex items-center justify-center rounded-lg border border-primary/30 bg-primary/10 px-8 py-3.5 font-display text-sm font-semibold text-primary transition-colors hover:bg-primary/20"
            >
              Заказать запчасти
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
