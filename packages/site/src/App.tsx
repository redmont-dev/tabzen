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

  if (path !== '/' && path !== '') {
    return (
      <main style={{ textAlign: 'center', padding: '6rem 2rem' }}>
        <h1>404</h1>
        <p style={{ marginTop: '1rem', color: '#999' }}>Page not found.</p>
        <a href="/" style={{ display: 'inline-block', marginTop: '2rem', color: '#3b82f6' }}>Back to home</a>
      </main>
    );
  }

  return (
    <>
      <a href="#main" class="sr-only-focusable">Skip to main content</a>
      <Nav />
      <Hero />
      <main id="main">
      <BrowserMockup />
      <FeatureGrid />
      <Showcase />
      <Reviews />
      <FinalCta />
      </main>
      <Footer />
    </>
  );
}
