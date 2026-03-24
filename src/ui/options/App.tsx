export function App() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <nav style={{ width: 200, padding: 20, borderRight: '1px solid var(--border)' }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 16, letterSpacing: '-0.2px' }}>Tabzen</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Settings</div>
      </nav>
      <main style={{ flex: 1, padding: 24 }}>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Settings loading...</div>
      </main>
    </div>
  );
}
