export default function App() {
  return (
    <div style={{
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#FAF8F7',
      color: '#292633',
      padding: '2rem',
    }}>
      <div style={{
        background: '#FFFFFF',
        borderRadius: '24px',
        padding: '3rem',
        maxWidth: '540px',
        textAlign: 'center',
        boxShadow: '0 8px 32px rgba(147, 171, 217, 0.15)',
        border: '1px solid #E9E3ED',
      }}>
        <div style={{
          display: 'inline-block',
          backgroundColor: '#E7BEF8',
          color: '#292633',
          padding: '6px 16px',
          borderRadius: '999px',
          fontSize: '0.875rem',
          fontWeight: 600,
          marginBottom: '1.25rem',
        }}>
          ViDashboard v1.0
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 1rem 0' }}>
          Hello from ViDashboard
        </h1>
        <p style={{ color: '#77717F', lineHeight: 1.6, margin: '0 0 2rem 0' }}>
          Product Video Discovery Dashboard backend is running in Phase 1 (Foundation & Database).
        </p>
        <div style={{
          backgroundColor: '#FAF8F7',
          padding: '1rem',
          borderRadius: '12px',
          fontSize: '0.875rem',
          color: '#77717F',
        }}>
          Backend API: <code style={{ color: '#F2619C', fontWeight: 600 }}>/api/health</code>
        </div>
      </div>
    </div>
  );
}
