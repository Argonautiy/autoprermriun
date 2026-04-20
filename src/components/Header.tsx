import { Link } from "@tanstack/react-router";
import { Phone, ShoppingBag, User, LogIn, Shield, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";

export function Header() {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();

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

        <nav className="hidden items-center gap-6 md:flex">
          <a href="/#services" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
            Услуги
          </a>
          <Link to="/catalog" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary [&.active]:text-primary">
            Запчасти
          </Link>
          <Link to="/diagnostics" className="flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-primary [&.active]:text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            AI-диагностика
          </Link>
          <a href="/#prices" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
            Цены
          </a>
          <a href="/#reviews" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
            Отзывы
          </a>
          <a href="/#contacts" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
            Контакты
          </a>
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {isAdmin && (
            <Link
              to="/admin"
              className="flex items-center gap-2 rounded-lg border border-primary/50 bg-primary/10 px-3 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
            >
              <Shield className="h-4 w-4" />
              Админ
            </Link>
          )}
          {user ? (
            <Link
              to="/profile"
              className="flex items-center gap-2 rounded-lg border border-border/50 bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-primary/50"
            >
              <User className="h-4 w-4 text-primary" />
              Кабинет
            </Link>
          ) : (
            <Link
              to="/login"
              className="flex items-center gap-2 rounded-lg border border-border/50 bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-primary/50"
            >
              <LogIn className="h-4 w-4 text-primary" />
              Войти
            </Link>
          )}
          <a
            href="tel:+77778747313"
            className="flex items-center gap-2 rounded-lg bg-gold-gradient px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Phone className="h-4 w-4" />
            Позвонить
          </a>
        </div>
      </div>
    </header>
  );
}
