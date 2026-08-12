# Propuesta de Idea de Tesis: Proyecto Saecula

## Título Definitivo de la Investigación

**Diseño e implementación de una arquitectura híbrida multilingüe basada en bases de datos de grafos y bases de datos relacionales con integración de MCP para el procesamiento de datos históricos, teología e historia católica**

---

## 1. Resumen Ejecutivo de la Propuesta

El proyecto consiste en el desarrollo de **Saecula**, una plataforma de alta precisión para la investigación y el estudio interconectado de las Sagradas Escrituras, la patrística, los concilios, los dogmas, los santos y los eventos históricos de la Iglesia Católica.

La propuesta aborda la complejidad del modelado de datos altamente estructurados mediante un enfoque de **persistencia políglota**, separando la abstracción semántica de las entidades, gestionada en un **grafo**, del almacenamiento físico de los textos multilingües y sus diversas traducciones históricas, gestionado en un **modelo relacional**. Adicionalmente, el sistema expone un **servidor del protocolo MCP** para permitir que modelos de lenguaje ejecuten consultas deterministas sobre la base de datos sin incurrir en alucinaciones, ofreciendo una interfaz de usuario cliente mediante una **aplicación móvil** y herramientas de **ingesta de datos en paralelo**.

---

## 2. Planteamiento de la Problemática Computacional

Los sistemas tradicionales de gestión documental y las aplicaciones actuales de estudio teológico presentan limitaciones estructurales severas al enfrentarse a redes complejas de datos históricos:

- **Incapacidad de las arquitecturas RAG tradicionales:** Las arquitecturas habituales basadas en búsqueda por vectores destruyen la topología de los datos. Al fragmentar los textos en bloques semánticos, un agente de Inteligencia Artificial pierde la capacidad de mapear relaciones directas o jerárquicas exactas, provocando alucinaciones cuando se realizan consultas de alta precisión histórica.

- **Ineficiencia de las bases de datos relacionales puras:** Representar redes de conocimiento profundamente interconectadas mediante consultas SQL tradicionales requiere múltiples operaciones de cruce de datos recursivos, lo que genera un costo de procesamiento exponencial y degrada el tiempo de respuesta.

- **Complejidad del manejo multilingüe y variantes de traducción:** Almacenar una misma entidad conceptual en diferentes idiomas, como español, inglés, latín o griego, y con múltiples ediciones o traducciones bíblicas históricas, suele provocar duplicación masiva de datos y pérdida de integridad en los enlaces de referencias cruzadas.

---

## 3. Solución Arquitectónica Propuesta

### Principio Fundamental: Separación Concepto-Texto

La arquitectura divide estrictamente el conocimiento abstracto del contenido lingüístico:

- **Neo4j como Base de Datos de Grafos:** Funciona como el grafo de conceptos agnóstico al idioma. Almacena únicamente los nodos abstractos, como versículos, concilios, dogmas o santos, y sus relaciones teológico-históricas, junto a metadatos temporales de línea de tiempo.

- **PostgreSQL como Base de Datos Relacional:** Funciona como el depósito de textos localizados. Almacena las capas de contenido textual asociadas a los nodos mediante una clave primaria compuesta por el ID de la entidad, el código de idioma y el ID de traducción, garantizando soporte nativo para múltiples traducciones simultáneas.

### Estructura del Monorepo Saecula

- **Módulo Backend Principal en Go:** API REST o GraphQL que orquesta la persistencia políglota, consulta simultáneamente Neo4j y PostgreSQL, y resuelve de forma eficiente las consultas de lectura y autenticación JWT.

- **Servidor Model Context Protocol:** Módulo en Go que expone herramientas estandarizadas para que los modelos de lenguaje exploren el grafo de Saecula y ejecuten consultas deterministas sobre la base de datos sin alucinaciones.

- **Herramienta CLI de Ingesta:** Aplicación de línea de comandos desarrollada en Go que aprovecha la concurrencia nativa mediante goroutines para procesar archivos heterogéneos, mapear el sistema de referencias cruzadas universales y poblar ambas bases de datos en paralelo.

- **Aplicación Móvil en React Native:** Cliente híbrido que consume la API en Go, ofreciendo una interfaz gráfica con visualización de líneas de tiempo, explorador de grafos interactivo y lector multitraducción.

---

## 4. Innovación e Impacto Académico

Esta propuesta justifica su desarrollo como tesis de grado en Informática debido a los siguientes aportes técnicos:

- **Demostración de Persistencia Políglota Eficiente:** Evaluación cuantitativa de rendimiento sobre cómo la combinación de un motor de grafos y un motor relacional supera el rendimiento de una arquitectura uniforme al procesar consultas semánticas recursivas.

- **Generación Determinista sin Alucinaciones mediante MCP:** Implementación de un estándar emergente de la industria como alternativa superior a la búsqueda por vectores para dominios donde la precisión de los datos no admite margen de error.

- **Ingesta Concurrente de Grafos de Conocimiento:** Diseño de algoritmos de procesamiento paralelo en Go para la construcción y estructuración automática de topologías de datos masivas.
