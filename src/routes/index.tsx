import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { HeroSection } from "@/components/HeroSection";
import { ServicesSection } from "@/components/ServicesSection";
import { ReviewsSection } from "@/components/ReviewsSection";
import { ContactsSection } from "@/components/ContactsSection";
import { PriceSection } from "@/components/PriceSection";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Авто Premium — Автосервис и магазин запчастей в Кокшетау" },
      { name: "description", content: "Профессиональный ремонт автомобилей и оригинальные запчасти в Кокшетау. Диагностика, ремонт двигателя, ходовой части, электрики. ☎ +7 777 874 73 13" },
      { property: "og:title", content: "Авто Premium — Автосервис и запчасти в Кокшетау" },
      { property: "og:description", content: "Профессиональный ремонт автомобилей и магазин запчастей. Рейтинг 4.7 из 198 оценок." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <>
      <Header />
      <main>
        <HeroSection />
        <ServicesSection />
        <ReviewsSection />
        <ContactsSection />
      </main>
      <Footer />
    </>
  );
}
