---
universidad: "UNIVERSIDAD NACIONAL EXPERIMENTAL DE GUAYANA"
vicerrectorado: "VICERRECTORADO ACADÉMICO"
coordinacion: "COORDINACIÓN GENERAL DE PREGRADO"
carrera: "PROYECTO DE CARRERA: INGENIERÍA EN INFORMÁTICA"
titulo: "Diseño e implementación de una arquitectura híbrida multilingüe basada en bases de datos de grafos y bases de datos relacionales con integración de MCP para el procesamiento de datos históricos, teología e historia católica"
autores: "Miguel Nuñez y Gabriel Hernández"
tutor: "Profesor XXX"
lugar: "Puerto Ordaz"
fecha: "2026"
---

# CAPÍTULO I - EL PROBLEMA

## Planteamiento del Problema

En el marco de la transformación digital de las humanidades, el estudio interconectado de las Sagradas Escrituras, la patrística, los concilios, los dogmas, los santos y los eventos históricos de la Iglesia Católica constituye un dominio de conocimiento profundamente entrelazado, en el que cada entidad remite, de manera directa o jerárquica, a otras miles. Según estudios recientes sobre grafos de conocimiento (Hogan y otros, 2021), las redes de datos históricos poseen una topología compleja que exige herramientas capaces de preservar las relaciones exactas entre sus nodos para sostener consultas de alta precisión. No obstante, la mayoría de los sistemas tradicionales de gestión documental, así como las aplicaciones actuales de estudio teológico, presentan limitaciones estructurales severas que impiden explotar dicha interconexión de manera fiable. Tales limitaciones pueden agruparse en tres órdenes, que se exponen a continuación.

En primer lugar, se encuentra la fragilidad de las arquitecturas RAG tradicionales. Los enfoques habituales basados en búsqueda por vectores tienden a destruir la topología de los datos: al fragmentar los textos en bloques semánticos, un agente de inteligencia artificial pierde la capacidad de mapear las relaciones directas o jerárquicas exactas, lo que provoca alucinaciones ante consultas de alta precisión histórica. Tal como señalan Gao y otros (2023), la recuperación vectorial mejora la fluidez de las respuestas, pero falla en el razonamiento de múltiples saltos sobre datos estructurados, requisito ineludible en dominios donde la exactitud de las referencias no admite margen de error.

En segundo lugar, se advierte la ineficiencia de las bases de datos relacionales puras. Representar redes de conocimiento profundamente interconectadas mediante consultas SQL tradicionales obliga a múltiples operaciones recursivas de cruce de datos, lo que eleva de forma exponencial el costo de procesamiento y degrada el tiempo de respuesta. Por el contrario, los motores de grafos como Neo4j resuelven estas travesías recursivas con una complejidad reducida, al recorrer las aristas de manera directa (Needham y Hodler, 2018); ello evidencia que una arquitectura uniformemente relacional resulta insuficiente para el dominio teológico-histórico.

En tercer lugar, subsiste la complejidad del manejo multilingüe y de las variantes de traducción. Almacenar una misma entidad conceptual en distintos idiomas —español, inglés, latín o griego— y en múltiples ediciones o traducciones bíblicas históricas suele derivar en una duplicación masiva de datos y en la pérdida de integridad de los enlaces de referencias cruzadas. A esta dificultad técnica se suma, en el contexto latinoamericano y particularmente en Venezuela, la carencia de plataformas accesibles que permitan correlacionar fuentes primarias y secundarias con trazabilidad histórica, lo que frena tanto la producción académica de alto nivel como la preservación digital del patrimonio documental católico.

En atención a las limitaciones expuestas, surge la siguiente pregunta de investigación: ¿Cómo diseñar e implementar una arquitectura híbrida multilingüe basada en bases de datos de grafos y bases de datos relacionales con integración del Model Context Protocol (MCP) que permita el procesamiento determinista y sin alucinaciones de datos históricos, teología e historia católica?

De esta interrogante principal se desprenden las siguientes interrogantes derivadas:

- ¿Cuál es la situación actual de los sistemas de gestión documental y de estudio teológico respecto al procesamiento interconectado de datos históricos multilingües?

- ¿Qué requerimientos técnicos y funcionales debe cumplir una arquitectura de persistencia políglota para garantizar la precisión y la integridad de los datos teológico-históricos?

- ¿Cómo debe diseñarse el modelo conceptual del grafo de conocimiento para representar las relaciones entre versículos, concilios, dogmas y santos, junto a sus metadatos temporales?

- ¿Cómo debe implementarse el servidor del Model Context Protocol para que los modelos de lenguaje ejecuten consultas deterministas sobre la base de datos sin incurrir en alucinaciones?

- ¿De qué manera las pruebas de rendimiento y funcionalidad validarán la confiabilidad de la plataforma para su uso en un entorno real de investigación?

## Objetivos de la Investigación

### Objetivo General

Diseñar e implementar una arquitectura híbrida multilingüe basada en bases de datos de grafos y bases de datos relacionales con integración del Model Context Protocol (MCP) para el procesamiento de datos históricos, teología e historia católica.

### Objetivos Específicos

- Diagnosticar las limitaciones estructurales de los sistemas tradicionales de gestión documental y de las arquitecturas RAG para el manejo de redes de datos teológico-históricos interconectados.

- Determinar los requerimientos técnicos y funcionales necesarios para la implementación de una arquitectura de persistencia políglota que combine un grafo conceptual agnóstico al idioma con un depósito relacional de textos localizados.

- Diseñar el modelo de datos del grafo de conocimiento de Saecula y el esquema relacional multilingüe de traducciones, garantizando la integridad de las referencias cruzadas y de la línea de tiempo histórica.

- Codificar los módulos del monorepo Saecula, incluyendo el backend en Go, el servidor MCP, la herramienta CLI de ingesta concurrente y la aplicación móvil en React Native.

- Evaluar el rendimiento y la precisión de la plataforma mediante pruebas comparativas de consultas semánticas recursivas y de funcionalidad de los módulos implementados.

## Justificación de la Investigación

La presente investigación se justifica por la necesidad de dotar al estudio de la historia y la teología católica de una herramienta de alta precisión que preserve la topología exacta del conocimiento. Esta necesidad cobra especial relevancia frente a la incertidumbre que generan las respuestas erróneas de los sistemas de inteligencia artificial basados únicamente en recuperación vectorial, cuyas limitaciones ante el razonamiento de múltiples saltos sobre datos estructurados se encuentran documentadas (Gao y otros, 2023).

Desde una perspectiva teórica, el estudio contribuye a la literatura sobre sistemas de persistencia políglota y grafos de conocimiento analizando la evolución de las arquitecturas de datos estructurados hacia la separación estricta entre concepto y texto. La investigación de Hogan y otros (2021) fundamenta que los grafos de conocimiento permiten integrar y consultar datos heterogéneos profundamente interconectados, mientras que la obra de Gao y otros (2023) demuestra que las arquitecturas RAG tradicionales presentan limitaciones de razonamiento multi-salto, lo cual sustenta la hipótesis de que una arquitectura híbrida superará el rendimiento de una arquitectura uniforme.

En el plano práctico, la plataforma Saecula ofrecerá a investigadores, seminarios y académicos una interfaz que combina un explorador de grafos interactivo, visualización de líneas de tiempo y un lector multitraducción, permitiendo correlacionar fuentes primarias con trazabilidad completa. La integración del Model Context Protocol constituye una aplicación de un estándar emergente de la industria (Anthropic, 2024) como alternativa determinista a la búsqueda por vectores en dominios donde la precisión de los datos no admite margen de error, lo que representa un aporte metodológico original para el desarrollo de sistemas de consulta sobre conocimiento estructurado.

A nivel social y académico, el proyecto promueve la preservación digital del patrimonio documental católico y facilita el acceso equitativo a herramientas de investigación de alta complejidad para instituciones venezolanas y latinoamericanas, democratizando capacidades tecnológicas antes reservadas a grandes corporaciones internacionales de software. La viabilidad de la propuesta se sustenta en la disponibilidad de motores de bases de datos de código abierto, del lenguaje de programación Go y de frameworks modernos de desarrollo móvil, así como en la madurez del estándar MCP.

## Delimitación de la Investigación

La presente investigación se llevará a cabo en el ámbito académico de la Universidad Nacional Experimental de Guayana, estado Bolívar, Venezuela, durante un lapso cronológico correspondiente a un semestre académico del año 2026, periodo en el cual se ejecutarán las etapas de diagnóstico, diseño, codificación y validación funcional del sistema propuesto.

El alcance funcional de la plataforma Saecula se centra en el dominio temático de las Sagradas Escrituras, la patrística, los concilios ecuménicos, los dogmas, las vidas de los santos y los eventos históricos de la Iglesia Católica, considerando las lenguas española, inglesa, latina y griega, así como múltiples ediciones y traducciones históricas de los textos bíblicos. El proyecto se limita a proporcionar la arquitectura de persistencia políglota, el servidor MCP, la herramienta CLI de ingesta y la aplicación móvil cliente, sin abordar la traducción automática de contenidos ni la generación de contenido editorial nuevo. La evaluación de rendimiento se restringirá a un corpus de textos representativo seleccionado durante la fase de diagnóstico.

# CAPÍTULO II - MARCO TEÓRICO

## Antecedentes de la Investigación

A continuación, se presentan investigaciones previas que fundamentan el uso de grafos de conocimiento, la persistencia políglota y la consulta determinista de modelos de lenguaje en dominios de alta precisión:

### Antecedentes Internacionales

Gao y otros (2023), en el artículo científico titulado Retrieval-Augmented Generation for Large Language Models: A Survey, publicado en el repositorio arXiv, tuvieron como propósito examinar de manera integral las arquitecturas de generación aumentada por recuperación. La metodología empleada fue de carácter analítico y documental, revisando más de cien publicaciones sobre el estado del arte del paradigma RAG. En sus conclusiones, los autores destacan que, si bien la recuperación vectorial mejora la exactitud fáctica de los modelos de lenguaje, presenta limitaciones severas frente al razonamiento de múltiples saltos, las consultas sobre datos estructurados y la trazabilidad de las respuestas, recomendando arquitecturas híbridas que combinen la recuperación con estructuras de conocimiento. El aporte de la investigación en este trabajo es el sustento teórico del problema de las alucinaciones en arquitecturas RAG tradicionales, demostrando la necesidad de un enfoque determinista como el propuesto por el servidor MCP de Saecula.

En la misma línea, Lewis y otros (2020), en el artículo científico titulado Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks, presentado en la Conferencia NeurIPS 2020, tuvieron como propósito introducir el paradigma de generación aumentada por recuperación, en el cual un modelo de lenguaje genera sus respuestas condicionado a fragmentos recuperados de un índice vectorial. La metodología empleada fue de carácter experimental, evaluando dos variantes del modelo sobre tareas de respuesta a preguntas de dominio abierto y verificación de hechos. En sus conclusiones, los autores reconocen que la capacidad de los modelos para acceder y manipular conocimiento de manera precisa sigue siendo limitada, y que la trazabilidad de las decisiones y la actualización del conocimiento son problemas abiertos del paradigma. El aporte de la investigación en este trabajo es el sustento del origen del paradigma RAG y de sus limitaciones de trazabilidad, que la arquitectura de Saecula aborda mediante consultas deterministas sobre el grafo de conocimiento.

Por último, Peng y otros (2024), en el artículo científico titulado From Local to Global: A Graph RAG Approach to Query-Focused Summarization, presentado por Microsoft Research, tuvieron como propósito combinar la recuperación aumentada por generación con grafos de conocimiento para responder consultas globales sobre grandes colecciones de textos. Se utilizó una metodología experimental que construyó índices de grafos sobre corpus masivos y evaluó la precisión de las respuestas mediante métricas de recuperación de hechos. Las conclusiones principales señalan que la estructuración de los datos en grafos permite responder consultas que exigen razonamiento multi-salto con mayor precisión que la fragmentación vectorial, reduciendo sustancialmente la invención de información. El aporte de la investigación en este trabajo reside en la validación experimental de que el grafo de conocimiento mejora la precisión de las consultas, lo cual fundamenta el diseño de la capa semántica de Saecula sobre Neo4j.

## Bases Teóricas

### Base de Datos de Grafos (Neo4j)

Una base de datos de grafos es un sistema de almacenamiento que representa las entidades como nodos y las relaciones entre ellas como aristas, ambas capaces de contener propiedades. Según Needham y Hodler (2018), los motores de grafos optimizan las consultas de travesía al recorrer las conexiones de forma directa, sin necesidad de costosas operaciones de cruce de tablas, lo que resulta idóneo para redes profundamente interconectadas. En Saecula, Neo4j almacena únicamente el grafo conceptual agnóstico al idioma, compuesto por nodos abstractos como versículos, concilios, dogmas y santos, y sus relaciones teológico-históricas con metadatos temporales de línea de tiempo.

### Base de Datos Relacional (PostgreSQL)

Una base de datos relacional organiza la información en tablas relacionadas mediante claves primarias y foráneas, garantizando la integridad referencial y las transacciones ACID. PostgreSQL es un motor relacional de código abierto ampliamente utilizado que ofrece soporte robusto para índices, búsquedas de texto completo y tipos de datos avanzados (PostgreSQL Global Development Group, 2025). En la arquitectura de Saecula, PostgreSQL actúa como depósito de textos localizados, almacenando las capas de contenido textual asociadas a los nodos mediante una clave primaria compuesta por el identificador de la entidad, el código de idioma y el identificador de traducción.

### Persistencia Políglota

La persistencia políglota es el patrón arquitectónico que utiliza distintos motores de almacenamiento según la naturaleza de cada tipo de dato dentro de un mismo sistema. Según Fowler (2012), el uso combinado de un motor relacional y un motor de grafos permite explotar las fortalezas de cada uno: la integridad transaccional y la gestión de textos localizados en el relacional, y la travesía recursiva eficiente en el grafo. El principio fundamental de Saecula, denominado Separación Concepto-Texto, constituye una aplicación de la persistencia políglota al separar estrictamente el conocimiento abstracto del contenido lingüístico.

### Grafo de Conocimiento

Un grafo de conocimiento es una red semántica que integra información heterogénea mediante una ontología explícita de entidades y relaciones, permitiendo consultas sobre la estructura del conocimiento y no solo sobre los documentos que lo contienen. De acuerdo con Hogan y otros (2021), los grafos de conocimiento posibilitan la integración de datos procedentes de múltiples fuentes y el razonamiento sobre las conexiones entre entidades. El grafo de Saecula modela las relaciones teológico-históricas entre las Sagradas Escrituras, la patrística, los concilios, los dogmas y los santos, constituyendo el núcleo semántico de la plataforma.

### Model Context Protocol (MCP)

El Model Context Protocol es un estándar abierto que permite a los modelos de lenguaje conectarse con fuentes externas de datos y herramientas a través de una interfaz uniforme, exponiendo recursos y herramientas de forma estandarizada (Anthropic, 2024). En lugar de confiar en la generación libre de texto, el modelo selecciona herramientas cuyos resultados son computados de forma determinista sobre la base de datos, eliminando la alucinación en las consultas de precisión. En Saecula, el servidor MCP en Go expone herramientas que permiten a los modelos de lenguaje explorar el grafo conceptual y ejecutar consultas deterministas sobre Neo4j y PostgreSQL.

### Arquitecturas RAG y sus Limitaciones

La generación aumentada por recuperación (RAG) combina la recuperación de fragmentos de texto con la generación de modelos de lenguaje. Sin embargo, Gao y otros (2023) evidencian que la fragmentación vectorial destruye la topología de los datos, perdiendo las relaciones directas y jerárquicas exactas entre entidades. Esta limitación provoca alucinaciones cuando se realizan consultas de alta precisión histórica, motivo por el cual la presente investigación propone una alternativa basada en la consulta determinista mediante MCP.

### Lenguaje de Programación Go y Concurrencia

Go es un lenguaje de programación compilado y tipado desarrollado por Google, reconocido por su concurrencia nativa basada en goroutines y canales. Según Donovan y Kernighan (2015), la concurrencia de Go permite ejecutar miles de tareas ligeras de forma simultánea con una gestión sencilla de la sincronización. En Saecula, la herramienta CLI de ingesta aprovecha esta capacidad para procesar archivos heterogéneos, mapear el sistema de referencias cruzadas universales y poblar ambas bases de datos en paralelo.

### React Native

React Native es un framework de código abierto desarrollado por Meta que permite construir aplicaciones móviles nativas para iOS y Android utilizando JavaScript y componentes declarativos. Su arquitectura híbrida posibilita el desarrollo de un único código base multiplataforma con alto rendimiento de interfaz (React Native, 2025). En la plataforma Saecula, la aplicación móvil consume la API en Go y ofrece la visualización de líneas de tiempo, el explorador de grafos interactivo y el lector multitraducción.

## Bases Legales

El sustento jurídico de la presente investigación se fundamenta en el marco legal venezolano vigente, el cual promueve el uso de tecnologías de información, protege los datos personales y reconoce el valor de los mensajes de datos:

Constitución de la República Bolivariana de Venezuela (1999), artículo 110: reconoce el interés público de la ciencia, la tecnología y el conocimiento, así como la innovación, como instrumentos fundamentales para el progreso del país.

Ley de Mensajes de Datos y Firmas Electrónicas (2001), artículo 4: otorga pleno valor probatorio y equivalencia funcional a los mensajes de datos, garantizando la validez jurídica de los registros digitales gestionados por la plataforma.

Ley de Infogobierno (2013), artículo 34: obliga a los órganos del Poder Público a adoptar tecnologías de información abiertas que garanticen el acceso a los datos y la interoperabilidad de los sistemas, principio extensible a las plataformas académicas de conocimiento.

Ley Orgánica de Protección de Datos Personales (2012): establece los principios de licitud, lealtad y calidad de los datos personales, que la plataforma Saecula deberá observar al procesar información de sus usuarios e investigadores.

# CAPÍTULO III - MARCO METODOLÓGICO

## Tipo y Diseño de la Investigación

El presente estudio se enmarca en la modalidad de investigación aplicada, debido a que persigue la utilización de conocimientos científicos y tecnológicos orientados a aportar una solución práctica y concreta a una problemática real del procesamiento computacional de datos históricos y teológicos. Según Arias (2012), la investigación aplicada se caracteriza porque busca la aplicación o utilización de los conocimientos adquiridos a la vez que se adquieren otros, posterior a implementar y sistematizar la práctica basada en investigación.

De este modo, los fundamentos de las bases de datos de grafos, las bases de datos relacionales, la concurrencia y el desarrollo móvil son implementados directamente para resolver las limitaciones estructurales de las arquitecturas uniformes y de las consultas no deterministas. Asimismo, posee un carácter proyectivo, el cual, de acuerdo con Hurtado de Barrera (2010), tiene como objetivo diseñar, crear o modificar dispositivos, procesos o proyectos, dado que no solo diagnostica las limitaciones de los sistemas actuales de estudio teológico, sino que formula y propone una arquitectura de software futura fundamentada en la separación concepto-texto y en la integración del Model Context Protocol.

El diseño adoptado para esta investigación combina la modalidad documental y la modalidad de campo, bajo el enfoque no experimental. De acuerdo con Arias (2012), la investigación documental se fundamenta en el análisis de fuentes y documentos, mientras que la investigación de campo consiste en la recolección de datos directamente de los sujetos investigados o de la realidad donde ocurren los hechos, sin manipular o controlar variable alguna.

Este diseño resulta plenamente pertinente, ya que el levantamiento del corpus de textos teológico-históricos y de los requerimientos funcionales se ejecuta sobre fuentes documentales auténticas, mientras que la validación de la precisión y el rendimiento del sistema se realiza en el entorno real de ejecución de la plataforma, interactuando con especialistas del dominio para garantizar que la arquitectura responda con fidelidad a las necesidades de la investigación histórica.

## Población y Muestra

Población: Según Arias (2012), la población es un conjunto finito o infinito de elementos con características comunes para los cuales serán extensivas las conclusiones de la investigación. Para este estudio, la población está constituida por el conjunto de documentos históricos y teológicos del catolicismo, incluyendo las Sagradas Escrituras en sus traducciones al español, inglés, latín y griego, las obras de los Padres de la Iglesia, las actas de los concilios ecuménicos, los documentos dogmáticos, las biografías de los santos y los registros de los eventos históricos de la Iglesia Católica.

Muestra: Siguiendo un muestreo no probabilístico intencional, definido por Arias (2012) como aquel en el que el investigador selecciona los elementos de la población de acuerdo con su propio criterio, la muestra se delimitó a un subconjunto representativo del corpus, conformado por cinco libros del Antiguo Testamento, tres libros del Nuevo Testamento, las actas de los cuatro primeros concilios ecuménicos, obras seleccionadas de dos Padres de la Iglesia y diez biografías de santos, con sus respectivas ediciones en los cuatro idiomas de interés. Asimismo, se contará con la participación de tres especialistas en teología e historia de la Iglesia que validarán la exactitud de las referencias cruzadas y de las consultas ejecutadas por la plataforma.

## Técnicas e Instrumentos de Recolección de Datos

Según Sabino (1992), un instrumento de recolección de datos es, en principio, cualquier recurso de que se vale el investigador para acercarse a los fenómenos y extraer de ellos información. Se definen tres técnicas complementarias:

1. Revisión Documental (Matriz de Análisis del Corpus): Como técnica fundamentada en la investigación documental (Arias, 2012), para la selección y clasificación del corpus teológico-histórico se emplea una matriz de análisis documental que registrará el origen, la edición, el idioma, el año y las referencias cruzadas universales de cada texto incluido en la muestra.

2. Observación Directa Estructurada (Matriz de Pruebas Técnicas): Aplicada para la validación funcional y de rendimiento de la plataforma. La observación directa, definida por Arias (2012) como la técnica que consiste en registrar de manera visual lo que ocurre en una situación real, se instrumenta mediante una matriz técnica de control que registrará de forma objetiva los tiempos de respuesta de las consultas semánticas recursivas, la precisión de los resultados obtenidos mediante el servidor MCP y el consumo de recursos de los módulos implementados.

3. Entrevista Estructurada (Guía de Validación de Expertos): Aplicada a los especialistas en teología e historia de la Iglesia para validar la exactitud conceptual del grafo de conocimiento y la pertinencia de las respuestas generadas por las consultas deterministas. La entrevista estructurada, que según Arias (2012) se caracteriza por desarrollarse con base en un guion fijo de preguntas, utiliza como instrumento una guía de preguntas estandarizada.

## Procedimiento Metodológico de la Investigación

Para dar cumplimiento a los objetivos específicos establecidos en el estudio, se definen los siguientes procedimientos sistemáticos:

1. Diagnosticar las limitaciones de los sistemas actuales de gestión documental y de las arquitecturas RAG mediante la revisión documental del estado del arte y el análisis comparativo de los enfoques de recuperación vectorial frente a las consultas sobre estructuras de conocimiento.

2. Analizar los requerimientos funcionales y no funcionales de la arquitectura híbrida, evaluando criterios de precisión, rendimiento, multilingüismo e integridad de las referencias cruzadas, a fin de definir con precisión el alcance de la plataforma.

3. Modelar el dominio teológico-histórico y diseñar la arquitectura lógica de software aplicando el principio de separación concepto-texto, definiendo el esquema del grafo conceptual en Neo4j y el esquema relacional multilingüe en PostgreSQL.

4. Codificar la solución tecnológica implementando los módulos del monorepo Saecula: el backend en Go con autenticación JWT, el servidor MCP con herramientas deterministas, la herramienta CLI de ingesta concurrente y la aplicación móvil en React Native.

5. Evaluar el rendimiento y la precisión de la plataforma mediante pruebas comparativas de consultas semánticas recursivas entre la arquitectura híbrida y una arquitectura uniforme, así como mediante las matrices de validación técnica y la revisión de los especialistas del dominio, garantizando la fiabilidad del sistema antes de su uso en un entorno real.

## Metodología de Desarrollo del Sistema: SCRUM

Para la gestión del ciclo de vida del software y la construcción de la plataforma Saecula, se adopta la metodología ágil SCRUM. Según Schwaber y Sutherland (2020), Scrum es un marco liviano que ayuda a las personas, equipos y organizaciones a generar valor a través de soluciones adaptativas para problemas complejos.

El marco de trabajo organizará el desarrollo en iteraciones cortas e incrementales denominadas Sprints, permitiendo la revisión continua de la lógica del grafo de conocimiento, de las consultas del servidor MCP y de los flujos de la interfaz móvil en base a la retroalimentación de los interesados. Las iteraciones se dividirán en: Sprint 1 (Configuración del entorno, instalación de Neo4j y PostgreSQL, y diseño preliminar de los esquemas de datos); Sprint 2 (Construcción de la herramienta CLI de ingesta concurrente y población del grafo conceptual con el corpus seleccionado); Sprint 3 (Programación del backend en Go, la API REST y la autenticación JWT, con la consulta simultánea de ambas bases de datos); Sprint 4 (Desarrollo del servidor MCP con las herramientas deterministas de exploración del grafo y consulta de textos multilingües); y Sprint 5 (Integración de la aplicación móvil en React Native, visualización de líneas de tiempo, explorador de grafos, lector multitraducción y ejecución de las pruebas de rendimiento y funcionalidad).

## REFERENCIAS

Anthropic. (2024). Introducing the Model Context Protocol. https://www.anthropic.com/news/model-context-protocol

Arias, F. (2012). El proyecto de investigación: Introducción a la metodología científica (6.ª ed.). Editorial Episteme.

Asamblea Nacional Constituyente. (1999). Constitución de la República Bolivariana de Venezuela. Gaceta Oficial N.º 36.860.

Asamblea Nacional de Venezuela. (2001). Ley de Mensajes de Datos y Firmas Electrónicas. Gaceta Oficial N.º 37.148.

Asamblea Nacional de Venezuela. (2012). Ley Orgánica de Protección de Datos Personales. Gaceta Oficial N.º 6.079 Extraordinario.

Asamblea Nacional de Venezuela. (2013). Ley de Infogobierno. Gaceta Oficial N.º 40.274.

Donovan, A. A. y Kernighan, B. W. (2015). The Go programming language. Addison-Wesley.

Fowler, M. (2012). Polyglot persistence. http://martinfowler.com/bliki/PolyglotPersistence.html

Gao, Y., Xiong, Y., Gao, X., Jia, K., Pan, J., Bi, Y., Dai, Y., Sun, J., Wang, H. y Wang, H. (2023). Retrieval-augmented generation for large language models: A survey. arXiv. https://doi.org/10.48550/arXiv.2312.10997

Hogan, A., Blomqvist, E., Cochez, M., d'Amato, C., de Melo, G., Gutiérrez, C., Kirrane, S., Gayo, J. E. L., Navigli, R., Neumaier, S., Ngonga Ngomo, A.-C., Polleres, A., Rashid, S. M., Rula, A., Schmelzeisen, L., Sequeda, J., Staab, S. y Zimmermann, A. (2021). Knowledge graphs. ACM Computing Surveys, 54(4), 1-37. https://doi.org/10.1145/3447772

Hurtado de Barrera, J. (2010). Metodología de la investigación: Guía para la comprensión holística de la ciencia. Quirón Ediciones.

Lewis, P., Perez, E., Piktus, A., Petroni, F., Karpukhin, V., Goyal, N., Küttler, H., Lewis, M., Yih, W., Rocktäschel, T., Riedel, S. y Kiela, D. (2020). Retrieval-augmented generation for knowledge-intensive NLP tasks. Advances in Neural Information Processing Systems 33 (NeurIPS 2020). https://doi.org/10.48550/arXiv.2005.11401

Needham, M. y Hodler, A. E. (2018). Graph algorithms: Practical examples in Apache Spark and Neo4j. O'Reilly Media.

Peng, B., Edge, D., Trinh, H., Cheng, N., Bradley, J., Chao, A., Mody, A., Truitt, S., Metropolitansky, D., Osazuwa Ness, R. y Larson, J. (2024). From local to global: A graph RAG approach to query-focused summarization. arXiv. https://doi.org/10.48550/arXiv.2404.16130

PostgreSQL Global Development Group. (2025). PostgreSQL 16 documentation. https://www.postgresql.org/docs/

React Native. (2025). React Native documentation. https://reactnative.dev/

Sabino, C. (1992). El proceso de investigación. Panapo.

Schwaber, K. y Sutherland, J. (2020). La guía de Scrum: Las reglas del juego. Scrum.org.
