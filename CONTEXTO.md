# CONTEXTO: English Reader (app en desarrollo con Claude)

## Qué es
Web app personal para mejorar inglés, basada en 3 pilares: Lectura,
Listening, Speaking. Se construye en etapas, empezando por Lectura.
Vanilla JS/HTML/CSS, sin frameworks, sin backend — corre 100% en el
navegador con localStorage. Mismo patrón que el proyecto Chaos Disc Golf.

## Dónde vive
- Repo GitHub (privado): 
  https://github.com/jorgevazquezcamacho-collab/english-reader
- Local: C:\Users\JorgeVazquez\Claude code\english-reader
- Herramienta: VS Code + terminal PowerShell + Git + Claude Code

## Etapa 1: Lectura + diccionario contextual (la que estamos construyendo)

### Función principal
El usuario pega un texto en inglés. CADA palabra del texto es clickeable
(no solo algunas). Un click sobre una palabra despliega una ficha con su
explicación. Un segundo click sobre la misma palabra la cierra.

### Contenido de la ficha (en este orden)
1. Palabra + fonética (IPA) + aproximación fácil de pronunciar en español
   (ej: work → /wɜːrk/ → "uork")
2. Traducciones principales
3. Si es verbo: sus tiempos (base, past, past participle) en tabla
4. Usos correctos de la palabra, organizados por contexto/área si aplica
   (ej: "assessment" tiene usos distintos en educación, negocios, medicina,
   finanzas — cada uno con su propio ejemplo)
5. Phrasal verbs más comunes relacionados (si aplica)
6. Ejemplos de uso bilingües (inglés + traducción)
7. SIEMPRE AL FINAL: sección "en este texto" — explicación específica de
   cómo se está usando ESA palabra en la oración exacta donde aparece en
   el texto que el usuario pegó. Esta sección es la más importante de
   toda la ficha: no es un ejemplo genérico, es el análisis puntual de
   ese uso específico.

### Fuente de datos
Llamada a la API de Claude (api.anthropic.com/v1/messages) directo desde
el navegador, con el header `anthropic-dangerous-direct-browser-access: true`
para evitar el problema de CORS. Patrón BYOK (Bring Your Own Key):

- El usuario pega su propia API key en una pantalla de Ajustes
- La key se guarda solo en localStorage, nunca se sube al repo, nunca
  se hardcodea en el código
- App 100% personal (solo la usa Jorge), así que el riesgo de exponer
  la key en el navegador es mínimo — no se necesita backend ni proxy
- NO se usa Supabase para esto (Jorge ya tiene 2 proyectos activos ahí
  y no quiere meter un tercero)

### Entrada de texto (en orden de prioridad para construir)
1. Pegar texto libre en un textarea (primera versión, la más simple)
2. Foto con texto (OCR) — usando la visión de Claude directamente en el
   mismo request, no una librería de OCR aparte
3. Biblioteca de textos precargados de dominio público (Project Gutenberg,
   Wikipedia) — por temas de copyright, nunca libros con derechos vigentes
4. Noticias vía RSS público + servicio tipo rss2json (más frágil, al final)

## Diseño visual
Mismo lenguaje que Chaos Disc Golf:
- Tema oscuro, acento lima (#D4F521)
- Tipografía: Space Mono (headers/mono) + Sora (cuerpo)
- Bordes sutiles, cards con radius ~12-14px
- La ficha de palabra se despliega como bottom-sheet (modal desde abajo)

## Estructura de archivos propuesta
index.html
css/style.css
js/app.js              — estado y UI principal
js/dictionary-api.js   — llamada a Claude API para generar la ficha
js/reading.js          — parser de texto: convierte párrafo en palabras
                          clickeables, maneja el evento de click/toggle
js/storage.js          — localStorage: API key, historial de palabras
                          consultadas, textos guardados

## Etapas futuras (no construir todavía)
- Etapa 2: Listening (escucha activa, entrenamiento de fonética real
  con audio, no solo texto)
- Etapa 3: Speaking (práctica de habla)

## Cómo trabajamos (mismo flujo que Chaos Disc Golf)
1. Discutimos el diseño antes de programar
2. Claude Code edita, valida sintaxis antes de entregar
3. Jorge prueba en el navegador, reporta bugs
4. Cuando confirma que funciona: git add / commit / push, un comando
   a la vez