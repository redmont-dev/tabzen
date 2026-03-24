import { Nav } from './components/Nav';
import { Hero } from './components/Hero';
import { BrowserMockup } from './components/BrowserMockup';
import { FeatureGrid } from './components/FeatureGrid';
import { Showcase } from './components/Showcase';
import { Reviews } from './components/Reviews';
import { FinalCta } from './components/FinalCta';
import { Footer } from './components/Footer';

export function App() {
  return (
    <>
      <Nav />
      <Hero />
      <BrowserMockup />
      <FeatureGrid />
      <Showcase />
      <Reviews />
      <FinalCta />
      <Footer />
    </>
  );
}
