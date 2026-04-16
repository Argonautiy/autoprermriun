import { Link } from "@tanstack/react-router";
import { Phone, MapPin, Clock } from "lucide-react";

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gold-gradient">
            <span className="font-display text-lg font-bold text-primary-foreground">A</span>
          </div>
          <div>
            <span className="font-display text-lg font-bold tracking-tight text-foreground">
              Авто <span className="text-gold-gradient">Premium</span>
            </span>
            <p className="text-xs text-muted-foreground">Автосервис и запчасти</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          <a href="#services" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
            Услуги
          </a>
          <a href="#prices" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
            Цены
          </a>
          <a href="#reviews" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
            Отзывы
          </a>
          <a href="#contacts" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
            Контакты
          </a>
        </nav>

        <a
          href="tel:+77778747313"
          className="hidden items-center gap-2 rounded-lg bg-gold-gradient px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 md:inline-flex"
        >
          <Phone className="h-4 w-4" />
          Позвонить
        </a>
      </div>
    </header>
  );
}
