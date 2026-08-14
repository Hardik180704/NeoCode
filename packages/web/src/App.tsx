import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { ProductTour } from "./components/ProductTour";
import { Install } from "./components/Install";
import { Footer } from "./components/Footer";

export default function App() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <ProductTour />
        <Install />
      </main>
      <Footer />
    </>
  );
}
