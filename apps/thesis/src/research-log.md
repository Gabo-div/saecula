# Investigación - Bitácora de Antecedentes y Fuentes

Bitácora de las fuentes y antecedentes analizados para la propuesta de trabajo de grado **"Proyecto Saecula"** (Miguel Nuñez y Gabriel Hernández - UNEG, tutor: Profesor XXX).

Propósito de este documento: registrar el **análisis de cada propuesta/fuente** con sus **enlaces** para poder buscarlas y leerlas manualmente más tarde, y para sustentar cada afirmación del documento de grado con una referencia real.

---

## 1. Antecedentes incluidos en la propuesta (3)

### 1.1 Gao y otros (2023) — Survey de RAG
- **Referencia:** Gao, Y., Xiong, Y., Gao, X., Jia, K., Pan, J., Bi, Y., Dai, Y., Sun, J., Wang, H. y Wang, H. (2023). *Retrieval-augmented generation for large language models: A survey*. arXiv.
- **Enlaces:**
  - arXiv (resumen): https://arxiv.org/abs/2312.10997
  - PDF: https://arxiv.org/pdf/2312.10997
  - DOI: https://doi.org/10.48550/arXiv.2312.10997
- **Análisis:**
  - *Propósito:* examinar de forma integral el estado del arte del paradigma RAG.
  - *Metodología:* analítica y documental; revisión de más de 100 publicaciones.
  - *Conclusiones:* la recuperación vectorial mejora la exactitud fáctica pero falla ante razonamiento multi-salto, consultas sobre datos estructurados y trazabilidad; recomienda arquitecturas híbridas (recuperación + estructuras de conocimiento).
  - *Aporte al trabajo:* sustenta el problema de las alucinaciones en RAG y la necesidad del enfoque determinista del servidor MCP de Saecula.
- **Estado:** leído y citado en Cap. I y II.

### 1.2 Lewis y otros (2020) — RAG original (NeurIPS 2020)
- **Referencia:** Lewis, P., Perez, E., Piktus, A., Petroni, F., Karpukhin, V., Goyal, N., Küttler, H., Lewis, M., Yih, W., Rocktäschel, T., Riedel, S. y Kiela, D. (2020). *Retrieval-augmented generation for knowledge-intensive NLP tasks*. NeurIPS 2020.
- **Enlaces:**
  - arXiv (resumen): https://arxiv.org/abs/2005.11401
  - PDF (NeurIPS proceedings): https://proceedings.neurips.cc/paper_files/paper/2020/file/6b493230205f780e1bc26945df7481e5-Paper.pdf
  - DOI: https://doi.org/10.48550/arXiv.2005.11401
- **Análisis:**
  - *Propósito:* introducir el paradigma RAG, en el que un modelo de lenguaje condiciona su generación a fragmentos recuperados de un índice vectorial (memoria no paramétrica).
  - *Metodología:* experimental; evaluación de dos variantes (token/secuencia) sobre tareas de QA de dominio abierto y verificación de hechos.
  - *Conclusiones:* mejora la exactitud y fluidez, pero el acceso preciso al conocimiento y la **trazabilidad de las decisiones** quedan como problemas abiertos.
  - *Aporte al trabajo:* da el origen del paradigma RAG y de sus limitaciones de trazabilidad, que Saecula aborda con consultas deterministas sobre el grafo.
- **Estado:** leído y citado en Cap. II (Antecedentes).

### 1.3 Peng y otros (2024) — Graph RAG (Microsoft Research)
- **Referencia:** Peng, B., Edge, D., Trinh, H., Cheng, N., Bradley, J., Chao, A., Mody, A., Truitt, S., Metropolitansky, D., Osazuwa Ness, R. y Larson, J. (2024). *From local to global: A graph RAG approach to query-focused summarization*. arXiv.
- **Enlaces:**
  - arXiv (resumen): https://arxiv.org/abs/2404.16130
  - PDF: https://arxiv.org/pdf/2404.16130
  - DOI: https://doi.org/10.48550/arXiv.2404.16130
- **Análisis:**
  - *Propósito:* combinar RAG con grafos de conocimiento para responder consultas globales sobre grandes colecciones de textos.
  - *Metodología:* experimental; índice de grafo sobre corpus masivos y métricas de recuperación de hechos.
  - *Conclusiones:* estructurar los datos en grafos permite responder consultas multi-salto con mayor precisión que la fragmentación vectorial y reduce la invención de información.
  - *Aporte al trabajo:* valida experimentalmente que el grafo mejora la precisión de las consultas; fundamenta la capa semántica de Saecula sobre Neo4j.
- **Estado:** leído y citado en Cap. II (Antecedentes).

---

## 2. Fuentes complementarias candidatas (NO citadas aún en la propuesta)

Fuentes reales que podrían reforzar el marco teórico o servir de antecedente nacional/adicional. Pendiente de lectura manual.

### 2.1 Theographic Bible Metadata (grafo de conocimiento de la Biblia en Neo4j)
- **Qué es:** proyecto open source que modela personas, lugares, periodos y pasajes bíblicos como grafo de conocimiento, con datos exportables a **Neo4j**.
- **Enlaces:**
  - Repositorio: https://github.com/robertrouse/theographic-bible-metadata
  - Documentación del grafo Neo4j: https://github.com/robertrouse/theographic-bible-metadata/blob/master/docs/neo4j-graph-documentation.md
- **Por qué sirve:** ejemplo real de dominio bíblico modelado como grafo en Neo4j, muy cercano al caso de uso de Saecula (Escrituras + relaciones históricas). Útil para justificar el modelado del grafo conceptual.
- **Estado:** pendiente de revisar.

### 2.2 BibleMind (grafo de conocimiento interactivo de la Biblia)
- **Qué es:** grafo interactivo que conecta más de 31.000 versículos mediante referencias cruzadas y similitud semántica.
- **Enlace:** https://github.com/lmy1108/BibleMind
- **Por qué sirve:** referencia de cómo se construyen referencias cruzadas versículo a versículo, similar al sistema de referencias cruzadas universales de Saecula.
- **Estado:** pendiente de revisar.

### 2.3 Bible Knowledge Graph (bibleknowledgegraph.org)
- **Qué es:** fuente de datos semánticos enlazados sobre la Biblia y la teología, orientada a búsqueda semántica.
- **Enlace:** https://bibleknowledgegraph.org/
- **Por qué sirve:** referente del modelado ontológico del dominio bíblico-teológico.
- **Estado:** pendiente de revisar.

### 2.4 Hogan y otros (2021) — Knowledge Graphs (ya citada en la propuesta)
- **Referencia:** Hogan, A. y otros (2021). *Knowledge graphs*. ACM Computing Surveys, 54(4), 1-37.
- **Enlace:** https://doi.org/10.1145/3447772
- **Estado:** leído y citado en Cap. I y II.

### 2.5 Anthropic (2024) — Model Context Protocol
- **Referencia:** Anthropic. (2024). *Introducing the Model Context Protocol*.
- **Enlace:** https://www.anthropic.com/news/model-context-protocol
- **Otros enlaces útiles:**
  - Documentación oficial MCP: https://modelcontextprotocol.io/
- **Estado:** citado en Cap. I y II; la documentación oficial queda pendiente de lectura para la fase de implementación del servidor MCP.

### 2.6 Needham y Hodler (2018) — Graph Algorithms (ya citada)
- **Referencia:** Needham, M. y Hodler, A. E. (2018). *Graph algorithms: Practical examples in Apache Spark and Neo4j*. O'Reilly Media.
- **Enlace:** https://neo4j.com/graph-algorithms-book/ (sitio oficial del libro)
- **Estado:** citado en Cap. I y II.

---

## 3. Cómo buscar y leer cada fuente manualmente

1. **arXiv** (Gao, Lewis, Peng): abrir el enlace de resumen (arxiv.org/abs/...), descargar el PDF desde `arxiv.org/pdf/...` o desde el botón "Download". No requiere registro.
2. **DOI (Gao, Hogan, Lewis, Peng):** escribir el DOI en https://doi.org/ para redirigir al artículo oficial.
3. **NeurIPS proceedings (Lewis):** abrir el PDF directamente desde proceedings.neurips.cc (acceso libre).
4. **Repositorios de GitHub (Theographic, BibleMind):** navegar el README y la documentación; clonar con `git clone <url>` si se quiere explorar los datos.
5. **Documentación MCP:** https://modelcontextprotocol.io/ para la especificación del protocolo.
6. **Leyes venezolanas:** buscar en la Gaceta Oficial indicada (N.º 36.860; 37.148; 40.274; 6.079 Extraordinario) o en bases legales como http://www.tsj.gob.ve/ o https://observatoriolegislativo.com.

---

## 4. Criterios de selección de antecedentes

- La fuente debe ser **real y verificable** (enlace y DOI funcionando).
- Debe **justificar un término o afirmación** del documento con cita intrapárrafo.
- Priorizar: (a) artículos revisados por pares, (b) actas de conferencias reconocidas, (c) documentación oficial de herramientas usadas.
- Los antecedentes deben cubrir: el problema (RAG y sus límites), la solución (grafos de conocimiento) y, si el tutor lo pide, un contexto latinoamericano/venezolano real.
