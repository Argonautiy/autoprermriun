import { motion } from "framer-motion";
import { Phone, MapPin, Clock, Navigation } from "lucide-react";

const phones = [
  { number: "+7 702 644 92 44", label: "Магазин", href: "tel:+77026449244" },
  { number: "+7 705 451 51 92", label: "Магазин", href: "tel:+77054515192" },
  { number: "+7 (7162) 40-11-05", label: "Магазин", href: "tel:+77162401105" },
  { number: "+7 777 874 73 13", label: "Автосервис", href: "tel:+77778747313" },
];

export function ContactsSection() {
  return (
    <section id="contacts" className="border-t border-border/50 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
            <span className="text-gold-gradient">Контакты</span>
          </h2>
        </motion.div>

        <div className="mt-16 grid gap-8 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-8"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <MapPin className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-foreground">Адрес</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  ул. Смагула Садвакасова, 99а<br />
                  Кокшетау, 020000
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-foreground">Время работы</h3>
                <div className="mt-1 space-y-1 text-sm text-muted-foreground">
                  <p>Пн–Пт: 09:00 – 18:00</p>
                  <p>Сб: 10:00 – 15:00</p>
                  <p>Вс: выходной</p>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Phone className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-foreground">Телефоны</h3>
                <div className="mt-1 space-y-2">
                  {phones.map((p) => (
                    <a
                      key={p.number}
                      href={p.href}
                      className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
                    >
                      {p.number}
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                        {p.label}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            </div>

            <a
              href="https://2gis.kz/kokshetau/search/%D0%A1%D0%B0%D0%B4%D0%B2%D0%B0%D0%BA%D0%B0%D1%81%D0%BE%D0%B2%D0%B0%2099%D0%B0"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-gold-gradient px-6 py-3 font-display text-sm font-semibold text-primary-foreground shadow-gold transition-opacity hover:opacity-90"
            >
              <Navigation className="h-4 w-4" />
              Открыть в 2ГИС
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="overflow-hidden rounded-xl border border-border/50"
          >
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2513.5!2d69.3889!3d53.2833!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNTPCsDE3JzAwLjAiTiA2OcKwMjMnMjAuMCJF!5e0!3m2!1sru!2skz!4v1700000000000"
              width="100%"
              height="100%"
              className="min-h-[400px]"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Авто Premium на карте"
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
