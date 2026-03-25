import { useState, useEffect } from 'preact/hooks';
import { Nav } from './components/Nav';
import { Hero } from './components/Hero';
import { BrowserMockup } from './components/BrowserMockup';
import { FeatureGrid } from './components/FeatureGrid';
import { Showcase } from './components/Showcase';
import { Reviews } from './components/Reviews';
import { FinalCta } from './components/FinalCta';
import { Footer } from './components/Footer';
import { Privacy } from './components/Privacy';

function getPath() {
  return window.location.pathname;
}

export function App() {
  const [path, setPath] = useState(getPath());

  useEffect(() => {
    const onPop = () => setPath(getPath());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  if (path === '/privacy' || path === '/privacy/') {
    return <Privacy />;
  }

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
