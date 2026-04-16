export function Footer() {
  return (
    <footer className="border-t border-border/50 bg-surface py-8">
      <div className="mx-auto max-w-7xl px-6 text-center">
        <p className="font-display text-sm font-semibold text-foreground">
          Авто <span className="text-gold-gradient">Premium</span>
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Авто Premium. Кокшетау, ул. Смагула Садвакасова, 99а
        </p>
      </div>
    </footer>
  );
}
