import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="landing">
      <header>
        <a className="brand" href="/">
          <span className="brand-mark">S</span>
          Saecula
        </a>
        <nav>
          <Link href="/biblia">Lector</Link>
          <a href="#arquitectura">Arquitectura</a>
          <a href="#funciones">Funciones</a>
          <Link href="/admin">Panel admin</Link>
        </nav>
      </header>

      <section className="hero">
        <h1>
          El estudio católico, <em>interconectado</em>.
        </h1>
        <p>
          Biblia, Catecismo, Santos, Concilios, Dogmas y eventos históricos conectados en un
          grafo de conocimiento y mapeados sobre una línea de tiempo maestra. En español,
          inglés y latín.
        </p>
        <div className="cta-row">
          <Link className="btn btn-primary" href="/biblia">
            Abrir lector
          </Link>
          <a className="btn" href="#funciones">
            Conocer más
          </a>
          <Link className="btn" href="/admin">
            Panel de administración
          </Link>
        </div>
      </section>

      <section className="section" id="funciones">
        <h2>Funciones</h2>
        <div className="feature-grid">
          <Link href="/biblia" className="feature-card" style={{ textDecoration: 'none' }}>
            <h3>Lector de Biblia</h3>
            <p>Los 73 libros con varias traducciones históricas y búsqueda de texto completo.</p>
          </Link>
          <Link href="/catecismo" className="feature-card" style={{ textDecoration: 'none' }}>
            <h3>Catecismo completo</h3>
            <p>Los 2865 párrafos del Catecismo de la Iglesia Católica en español, inglés y latín.</p>
          </Link>
          <Link href="/lecturas" className="feature-card" style={{ textDecoration: 'none' }}>
            <h3>Lecturas del día</h3>
            <p>El santoral, las celebraciones litúrgicas y las lecturas diarias de la Misa.</p>
          </Link>
          <Link href="/prayers" className="feature-card" style={{ textDecoration: 'none' }}>
            <h3>Oraciones</h3>
            <p>Oraciones tradicionales en español, inglés y latín.</p>
          </Link>
          <Link href="/chat" className="feature-card" style={{ textDecoration: 'none' }}>
            <h3>Asistente con IA</h3>
            <p>Un chat que consulta las Escrituras, el Catecismo y el grafo con citas verificables.</p>
          </Link>
          <div className="feature-card">
            <h3>Grafo de conocimiento</h3>
            <p>Santos, concilios, dogmas y versículos conectados por relaciones teológico-históricas.</p>
          </div>
        </div>
      </section>

      <section className="section" id="arquitectura">
        <h2>Arquitectura</h2>
        <div className="arch">
          <div className="arch-card">
            <h3>Grafo de conceptos</h3>
            <p>
              <code>Neo4j</code> guarda las realidades históricas objetivas — agnósticas al
              idioma — con su ubicación temporal.
            </p>
            <p>Sin texto largo: solo estructura y relaciones.</p>
          </div>
          <div className="arch-card">
            <h3>Depósito de traducciones</h3>
            <p>
              <code>PostgreSQL</code> guarda los textos multilingües, claves por{' '}
              <code>entity_id</code>, idioma y edición.
            </p>
            <p>Una misma entidad, muchas traducciones, cero duplicación estructural.</p>
          </div>
          <div className="arch-card">
            <h3>API única</h3>
            <p>
              Una API Go autenticada con JWT sirve la app móvil nativa, la web y el panel de
              administración desde la misma fuente de datos.
            </p>
          </div>
        </div>
      </section>

      <footer>
        Saecula — proyecto de tesis de Ingeniería en Informática (UNEG) · Miguel Nuñez y Gabriel Hernández
      </footer>
    </div>
  )
}
