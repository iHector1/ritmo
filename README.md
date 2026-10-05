# Ritmo

Un diario de entrenamiento minimalista, mobile first y en español. Angular 22, sin backend, con datos en localStorage.

## Incluye

- Programa de octubre transcrito del PDF proporcionado, separado en `public/routine.json`.
- Sugerencia de rutina según la fecha local, con selección manual de cualquier día.
- Peso y unidad (kg/lb) solo para fuerza con carga. Cardio, movilidad y peso corporal muestran tiempo, distancia, calorías o repeticiones.
- Modos claro, oscuro y automático, con preferencia persistente. Navegación inferior y controles táctiles.
- PWA instalable con service worker de Angular: interfaz, rutina y guías locales disponibles sin conexión después de la primera carga.
- Activación, fuerza, AMRAP, metcon, core y finisher; resultados libres por bloque.
- Borradores por programa, fecha y día. Las sesiones parciales pueden continuarse.
- Historial con una copia de la rutina de cada sesión, aunque después cambies de programa.
- Último registro anterior del ejercicio, notas y temporizador de descanso / bloque.
- Importación de rutina, exportación y restauración de respaldo.
- Instrucciones abiertas incluidas localmente para 13 movimientos coincidentes y búsqueda de técnica en YouTube para todos. Video integrado cuando el JSON tiene `videoUrl`.

## Desarrollo

Node.js 24 y npm.

```sh
npm ci
npm start
```

Abre `http://localhost:4200`. Para comprobar y compilar:

```sh
npm test
npm run build
```

La salida está en `dist/ritmo/browser/`. No abras index.html directamente con file://: se carga un JSON por fetch y necesita un servidor HTTP.

## GitHub Pages

El workflow `.github/workflows/pages.yml` comprueba el programa, compila y publica con el base-href del repositorio automáticamente. También admite repositorios `usuario.github.io`. Los pull requests compilan sin desplegar.

1. Crea un repositorio y sube este proyecto a su raíz, en la rama `main`.
2. En **Settings → Pages → Build and deployment → Source**, selecciona **GitHub Actions**.
3. Haz un push a `main` o ejecuta manualmente el workflow **Build and deploy GitHub Pages**.
4. La dirección será `https://TU_USUARIO.github.io/TU_REPOSITORIO/`.

No se necesitan secrets ni claves API. El workflow utiliza permissions mínimas para Pages. No hay rutas internas que requieran reescritura del servidor; se genera además 404.html.

Puedes crear y configurar el repositorio con GitHub CLI autenticado:

```sh
git init -b main
git add .
git commit -m "Add Angular workout journal"
gh repo create ritmo --public --source=. --remote=origin --push
gh api --method POST repos/$(gh api user --jq .login)/ritmo/pages -f build_type=workflow
gh workflow run pages.yml
```

## Formato de rutina

Edita `public/routine.json` y publica, o importa un JSON desde **Ajustes**. Los cambios importados se aplican solo a tu navegador. Puedes descargar el programa actual como plantilla. `public/routine.schema.json` documenta el formato.

```json
{
  "schemaVersion": 1,
  "id": "mi-programa-noviembre",
  "name": "Programa noviembre",
  "description": "Mi rutina de fuerza",
  "days": [
    {
      "id": "lunes",
      "label": "Lunes",
      "weekday": 1,
      "focus": "Pecho y hombros",
      "blocks": [
        {
          "id": "lunes-fuerza",
          "name": "Fuerza",
          "notes": "Descansa entre series",
          "timerSeconds": 90,
          "exercises": [
            {
              "id": "lunes-bench",
              "name": "Bench press · banco plano",
              "target": "8 reps",
              "sets": 4,
              "tracking": "weighted",
              "metric": "reps",
              "catalogId": "Barbell_Bench_Press_-_Medium_Grip"
            }
          ]
        }
      ]
    }
  ]
}
```

- `weekday`: 0 domingo, 1 lunes, …, 6 sábado; un solo bloque de día por weekday.
- Todos los `id` deben ser únicos en el programa. Conserva el ID de un ejercicio para comparar su registro previo entre programas.
- `target` admite reps, segundos, metros, calorías y movimientos combinados sin forzar una unidad equivocada.
- `tracking`: `weighted` muestra peso; `bodyweight`, `cardio` y `mobility` lo ocultan. Opcional para compatibilidad con rutinas anteriores; se infiere por el nombre si falta. Indícalo explícitamente para tus ejercicios personalizados.
- `metric`: `reps`, `time`, `distance`, `calories` o `mixed`. Define la etiqueta del resultado; también es opcional. Por ejemplo bici: `cardio`/`time`; remo: `cardio`/`distance`; cuerda y lagartijas: `bodyweight`/`reps`.
- `sets`: cantidad de filas que quieres registrar (1–30). En un circuito se usa una fila por movimiento y el resultado del bloque para las rondas.
- `notes` y `timerSeconds` son opcionales. El timer es una cuenta regresiva simple; no alterna fases de Tabata automáticamente.
- `catalogId` es opcional. Los IDs disponibles se encuentran en `src/app/exercise-catalog.json`. Solo se asociaron coincidencias exactas de movimientos, no variantes parecidas.
- `videoUrl` es opcional y acepta `https://www.youtube.com/watch?v=ID` o `https://youtu.be/ID`, con un ID de 11 caracteres. El reproductor solo se carga al abrir la guía. Sin video específico se ofrece una búsqueda, no un video verificado.
- Usa un `id` nuevo para cada versión de programa. Importar un programa reinicia los borradores; exporta primero si quieres conservarlos.

Se mantuvieron las indicaciones `#115` y `#45` en notas: su unidad no aparece en el PDF. El finisher del jueves tampoco indica número de rondas. No se inventaron estas cantidades.

## Instalación en celular

Abre [Ritmo](https://ihector1.github.io/ritmo/) en el navegador. En Android, usa **Ajustes → Instalar Ritmo**, o el menú del navegador → Instalar aplicación. En iPhone, abre en Safari → Compartir → Añadir a pantalla de inicio. La instalación depende del navegador. Espera a que la primera carga termine antes de usarla sin conexión. Una nueva versión ofrece un aviso para actualizar; tus registros permanecen en localStorage.

## Datos y privacidad

Clave: `ritmo:v1`. No hay login, nube ni telemetría. Los registros permanecen en este origen, navegador y dispositivo. Cambiar de dominio, dispositivo o borrar datos del navegador no conserva el historial: exporta un respaldo y restáuralo en el nuevo origen. La PWA necesita una primera carga con internet en HTTPS (o localhost). Su service worker precarga la interfaz, rutina, esquema e iconos. Los videos externos requieren internet. Los datos anteriores se conservan al actualizar; cualquier peso anterior de un ejercicio sin carga permanece en el respaldo aunque se oculte en la interfaz. La apariencia usa la clave independiente `ritmo:theme`.

Guardar de nuevo una sesión con el mismo programa, fecha y día actualiza ese registro. Una sesión parcial guarda también series pendientes. Las sesiones guardadas incluyen una copia del día, para mantener un historial comprensible al actualizar el programa. El backup incluye rutina, borradores e historial; la restauración valida el archivo antes de modificar los datos.

## Reutilización open source

Se reutilizan Angular y Angular Forms para el framework y los formularios. Se incluye un subconjunto de instrucciones y metadatos del proyecto **[yuhonas/free-exercise-db](https://github.com/yuhonas/free-exercise-db)**, bajo **Unlicense**:

- `src/app/exercise-catalog.json`: 13 ejercicios con sus instrucciones originales en inglés.
- `third-party/free-exercise-db-LICENSE.txt`: licencia original.

Se reutiliza el dataset como fuente del catálogo; no se presenta su frontend Vue como código Angular. No se redistribuyen imágenes ni videos externos. Los enlaces de YouTube abren búsquedas o reproducen URLs configuradas por el usuario.

## Validación

`npm test` comprueba estructura e integridad del programa, IDs, importaciones inválidas, URLs de video, fechas locales y consistencia de series de los respaldos. `npm run build` comprueba plantillas y tipos con el compilador Angular en modo estricto.

## Licencia

Código de la aplicación: MIT. Datos del catálogo: Unlicense, ver `third-party/`. La rutina personal no incluye una licencia de redistribución independiente del entrenador original.
