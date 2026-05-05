# Auditoría Técnica — Biolivar Frontend
**Nivel:** Principal Frontend Architect | **Fecha:** 2026-05-05

---

## FASE 1 — AUDITORÍA CRÍTICA

### 🔴 CRÍTICOS (rompen escalabilidad y mantenimiento)

---

#### C-01 · Mezcla de MUI v4 y MUI v5 en el mismo bundle
**Archivos:** `dataController.jsx`, `importController.jsx` vs resto de controladores

```js
// v4 — @material-ui/core
import { createTheme, ThemeProvider } from '@material-ui/core/styles';

// v5 — @mui/material (mismo archivo dataController.jsx)
import { createTheme, ThemeProvider } from '@mui/material/styles';
```

Ambas versiones de Material UI conviven en el bundle. Esto genera:
- Duplicado de estilos (~200 KB extra)
- Conflictos de especificidad CSS imposibles de razonar
- Bugs visuales no reproducibles

**Acción requerida:** Migrar todo a MUI v5 o mantenerse en v4. Sin mezcla.

---

#### C-02 · Event Bus (EventEmitter) como único bus de estado
**Archivo:** `src/utils/events.utils.js`

```js
export default new EventEmitter(); // singleton global
```

Toda la aplicación coordina estado a través de emisión de eventos:
- `emitter.emit('closeAllController')` — broadcast sin destinatario claro
- `emitter.emit('openRusleController')` — 10+ eventos idénticos, uno por panel
- `emitter.emit('moveURL', ...)` — datos viajan por eventos sin tipado ni contrato

**Problema:** El flujo de datos es completamente opaco. Un `emit` puede tener 0 o 5 listeners activos sin saberlo. No hay forma de razonar el estado de la aplicación leyendo el código.

**Acción requerida:** Reemplazar con Context API + `useReducer` para el estado de UI global.

---

#### C-03 · `main.jsx` es un componente dios con 15 controladores planos
**Archivo:** `src/pages/main.jsx`

```jsx
// 15 componentes planos, todos montados en el DOM simultáneamente
<BushEncroacher/>
<BandController/>
<SearchController/>
<SpatioTemporalAnalysisController/>
<BiodiversityController/>
<VegInspectorController/>
<StyleController />
<LayerController />
<ModelController />
<DataController/>
<ImportController/>
<RusleController />
```

- **15 componentes** montados y suscritos a emitter **siempre**, incluso cuando están ocultos (`open: false`)
- Cero code splitting. Todo el JS se descarga en el primer render
- Al añadir un nuevo módulo hay que modificar `main.jsx`

**Acción requerida:** Context API para controlar qué panel está activo + lazy loading con `React.lazy`/`Suspense`.

---

#### C-04 · Bug crítico: `setState({ map: null })` seguido de uso inmediato del mapa
**Archivo:** `src/components/canvas.jsx`, método `removeTempLayer`

```js
removeTempLayer = () => {
    const layers = this.state.map.getStyle().layers;
    this.setState({ map: null });              // ← PONE map a null
    layers.map(layer => {
        if (layer.id === 'custom-temp-point') {
            this.state.map.removeLayer('...');  // ← CRASH: this.state.map es null
        }
    });
}
```

`setState` en React es **asíncrono**, pero incluso si fuera síncrono, el patrón es incorrecto: el mapa se anula mientras aún se itera sobre sus capas. Esto lanza `TypeError: Cannot read properties of null` en producción.

**Acción requerida:** Eliminar `setState({ map: null })` de ese método.

---

#### C-05 · Credencial de API expuesta en código fuente
**Archivo:** `src/config.js`

```js
const ACCESS_TOKEN = 'pk.eyJ1IjoiZ2Fydm94IiwiYSI6ImNseHZucnRpcDB4Y3EycXNkNjRuM3drNWsifQ...';
```

El Mapbox Access Token está hardcodeado en el código fuente. Si este repositorio es versionado (Git), el token está expuesto en el historial permanentemente.

**Adicionalmente:** `http://localhost:5000` aparece hardcodeado en 4 archivos distintos (`login.jsx`, `StepperData.js`, y otros).

**Acción requerida:**
```js
// .env (fuera del repositorio)
REACT_APP_MAPBOX_TOKEN=pk.eyJ1...
REACT_APP_API_URL=http://localhost:5000

// config.js
export const ACCESS_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;
export const API_URL = process.env.REACT_APP_API_URL;
```

---

#### C-06 · MD5 para hash de contraseña en cliente
**Archivo:** `src/components/login.jsx`

```js
import md5 from 'md5';
// ...
password: md5(document.getElementById('password').value)
```

MD5 está completamente roto como función de seguridad. Cualquier base de datos de rainbow tables revierte MD5 en milisegundos. Adicionalmente, hashear en cliente no protege contra replay attacks: el hash viaja en texto plano sobre la red.

**Acción requerida:** Enviar la contraseña en texto plano sobre HTTPS (el servidor debe hacer `bcrypt`/`argon2`). El hashing client-side no aporta seguridad real y crea falsa sensación de protección.

---

#### C-07 · `dataset.utils.js` es estado mutable a nivel de módulo
**Archivo:** `src/utils/dataset.utils.js` — archivo vacío  
**Consumidor:** `src/components/login.jsx`

```js
// login.jsx
import datasets from '@utils/dataset.utils';

updateDatasetUtilsFile(parcels) {
    parcels.forEach(parcel => {
        datasets[parcel.catastral_ref] = { data: parcel.geojson_data }; // mutación directa
    });
}
```

Se muta un objeto importado de otro módulo directamente. Este patrón:
- Hace el estado invisible al sistema de renders de React
- Es no-testeable
- Produce bugs de estado obsoleto difíciles de reproducir

**Acción requerida:** Mover los datasets al estado de un contexto.

---

#### C-08 · Remoción incorrecta de listener en navigator.jsx
**Archivo:** `src/components/navigator.jsx`

```js
componentWillUnmount() {
    emitter.removeListener(this.setLoginStateListener); // ← INCORRECTO
}
```

`EventEmitter.removeListener` espera `(eventName, listener)`. Se está pasando el objeto del listener directamente, lo que resulta en un **memory leak** y listener activo tras desmontar el componente.

---

### 🟡 IMPORTANTES

---

#### I-01 · Copia-pega masiva del objeto `styles` en todos los controladores

El bloque `styles` de ~150 líneas es **idéntico** en 6+ controladores:
`rusleController`, `biodiversityController`, `vegInspectorController`, `spatioTemporalAnalysisController`, `dataController`, `importController`.

Propiedades duplicadas: `searchField`, `searchBox`, `resultWrapperOpen`, `resultWrapperClosed`, `uploadBoxBtnAdd`, `saveBtn`, `saveBtnProgress`, `previewImageContainer`, `locationImage`, y ~20 más.

**Dimensión del problema:** ~900 líneas de código redundante en solo este bloque.

---

#### I-02 · CSS global con `!important` targeting internals de MUI

**Archivos:** `dataController.style.css`, `menu.style.css`

```css
/* Sobrescribe componentes MUI globalmente */
.MuiFab-primary { background-color: #89ca92 !important; }
.MuiInput-formControl { height: 32px !important; margin-top: 13px !important; }
label.MuiFormControlLabel-root { margin-left: 0 !important; }
```

Estos estilos afectan TODOS los componentes MUI en toda la aplicación, no solo los locales. Con MUI v5 esto ya no funciona correctamente (cambió la nomenclatura de clases).

---

#### I-03 · Todos los componentes son clases en lugar de funciones con hooks

100% del código usa `class extends React.Component`. El ecosistema React lleva 5 años migrando a funciones + hooks. Las clases:
- No permiten compartir lógica mediante hooks personalizados
- Son más verbosas (constructor, this, bind)
- Impiden ciertas optimizaciones del compilador

---

#### I-04 · `ACCESS_TOKEN` importado pero sin uso en múltiples controladores

```js
import { ACCESS_TOKEN } from '@/config'; // Importado en biodiversityController, vegInspectorController, spatioTemporalAnalysisController
```

Nunca se usa en el cuerpo del componente. Import dead.

---

#### I-05 · Axios configurado globalmente dentro de un componente de UI

**Archivo:** `src/components/login.jsx`

```js
axios.defaults.baseURL = 'http://localhost:5000';
axios.defaults.withCredentials = true;

axios.interceptors.request.use(config => { ... });
```

La configuración de la capa HTTP vive dentro de un componente de presentación. Si `Login` no se monta, axios no está configurado. Los interceptors se registran **cada vez** que el componente se monta, acumulándose.

---

#### I-06 · `M` (materialize-css) importado en 3 controladores, apenas utilizado

```js
import M from 'materialize-css';
// Único uso: M.Materialbox.init(...)
```

Se importa toda la librería Materialize (CSS framework completo) para un único `.init()`. Genera conflicto de estilos globales con MUI.

---

#### I-07 · Mezcla de `var`, `const`, `let` sin consistencia

```js
// canvas.jsx
var layers = this.state.map.getStyle().layers;
for (var layer in layers) { ... }

// request.utils.js  
var url = options.method === 'GET' ...
var arr = [];
Object.keys(params).map(key => { arr.push(...); return true; });
```

Uso de `var` en código moderno, `for...in` sobre arrays (itera sobre índices como strings), y `.map()` para efectos secundarios donde debe usarse `.forEach()`.

---

#### I-08 · `console.log` en código de producción

Encontrados en: `canvas.jsx` (3 instancias), `login.jsx` (5 instancias), `StepperData.js` (2), `map.utils.js` (1), `rusleController.jsx` (1), `navigator.jsx` (1).

---

#### I-09 · Rutas de importación inconsistentes en main.jsx

```js
// Mezcla de alias y rutas relativas en el mismo archivo
import StyleController from '@components/controllers/styleController';      // alias
import RusleController from '../components/controllers/rusleController';     // relativa
import BushEncroacher from '../components/controllers/bushEncoracherController'; // relativa
```

---

### 🔵 MEJORA OPCIONAL

- **O-01:** `serviceWorker.register()` en producción puede causar cachés obsoletos sin estrategia definida
- **O-02:** Sin Error Boundaries — cualquier error en un controlador tumba toda la aplicación
- **O-03:** `catastralList` hardcodeado en `login.jsx` — datos de dominio en componente UI
- **O-04:** Typo: `styles.rooot` (doble 'o') existe pero nunca se usa — en 2+ archivos
- **O-05:** `buildPolygonStyle` ignora su parámetro `color` y usa `#f08` hardcodeado, con `console.log(color)`
- **O-06:** `model.utils.js` exporta un `default` array — no es un "util", es datos de configuración
- **O-07:** Comentario de autoría `/* Written by Ye Liu */` en todos los archivos — no relevante

---

## FASE 2 — ARQUITECTURA PROPUESTA

### Principios

1. **Feature-based modularity** — cada funcionalidad (rusle, biodiversity, layers...) es una feature autocontenida
2. **Flujo de datos unidireccional** — Context API + `useReducer` reemplaza el event bus
3. **Separación estricta:** UI components | business logic (hooks) | service layer (API)
4. **Un único sistema de UI:** MUI v5 únicamente, sin Materialize

### Cómo se mantiene la funcionalidad intacta

La lógica de negocio (cálculo RUSLE, índices de biodiversidad, análisis espacio-temporal, interacción con Mapbox) no cambia. Solo se reorganiza:

| Antes | Después |
|---|---|
| `emitter.emit('openRusleController')` | `dispatch({ type: 'OPEN_PANEL', panel: 'rusle' })` |
| Estado en 15 clases sueltas | Estado centralizado en `AppContext` |
| `emitter.emit('closeAllController')` | `dispatch({ type: 'CLOSE_ALL_PANELS' })` |
| HTTP en `login.jsx` | `src/services/auth.service.js` |
| Mapbox en `canvas.jsx` (clase) | `useMapbox` hook + `canvas.jsx` (funcional) |

---

## FASE 3 — ESTRUCTURA DE CARPETAS PROPUESTA

```
src/
│
├── config.js                    # Solo referencias a process.env, sin valores hardcoded
│
├── index.js                     # Punto de entrada, ReactDOM.render
│
├── serviceWorker.js
│
│── context/
│   ├── AppContext.js             # Estado global: panel activo, auth, datasets
│   ├── AppReducer.js            # Reducer puro: todas las acciones de estado global
│   └── AppProvider.jsx          # Provider que envuelve la app
│
├── services/                    # Capa HTTP — sin lógica de UI, sin estado React
│   ├── api.client.js            # Instancia axios configurada (baseURL, interceptors)
│   ├── auth.service.js          # login(), logout(), getUserParcels()
│   ├── gee.service.js           # Google Earth Engine API calls
│   ├── sensor.service.js        # Sensor data API (StepperData fetchData)
│   └── catastral.service.js     # Catastral search
│
├── hooks/                       # Lógica de negocio reutilizable
│   ├── useMapbox.js             # Inicialización y control del mapa Mapbox
│   ├── useAuth.js               # Estado de autenticación
│   ├── useLayer.js              # Gestión de capas en el mapa
│   └── useEmitter.js            # Adaptador temporal del event bus (para migración)
│
├── features/                    # Una carpeta por funcionalidad
│   ├── rusle/
│   │   ├── RusleController.jsx  # UI únicamente — sin lógica de negocio directa
│   │   ├── useRusle.js          # Lógica RUSLE, llamadas a GEE
│   │   └── rusle.styles.js      # Estilos SOLO de este feature
│   │
│   ├── biodiversity/
│   │   ├── BiodiversityController.jsx
│   │   ├── useBiodiversity.js
│   │   └── biodiversity.styles.js
│   │
│   ├── veg-inspector/
│   │   ├── VegInspectorController.jsx
│   │   └── useVegInspector.js
│   │
│   ├── spatio-temporal/
│   │   ├── SpatioTemporalController.jsx
│   │   └── useSpatioTemporal.js
│   │
│   ├── band-collector/
│   │   ├── BandController.jsx
│   │   └── useBandCollector.js
│   │
│   ├── layer-manager/
│   │   ├── LayerController.jsx
│   │   ├── useLayerManager.js
│   │   └── LayerLegend.jsx      # Sub-componente extraído del layerController actual
│   │
│   ├── style-manager/
│   │   └── StyleController.jsx
│   │
│   ├── model-runner/
│   │   ├── ModelController.jsx
│   │   └── useModelRunner.js
│   │
│   ├── data-import/
│   │   ├── ImportController.jsx
│   │   └── StepperImport.jsx
│   │
│   └── search/
│       ├── SearchController.jsx
│       └── useSearch.js
│
├── components/                  # Componentes de UI puros, sin lógica de negocio
│   ├── layout/
│   │   ├── Navigator.jsx
│   │   ├── Menu.jsx
│   │   └── Canvas.jsx
│   │
│   ├── common/
│   │   ├── ControllerCard.jsx   # Extrae el Card+Header repetido en 10 controladores
│   │   ├── StepperWizard.jsx    # Stepper genérico (actualmente duplicado 4 veces)
│   │   ├── DateRangePicker.jsx  # Extraído de múltiples steppers
│   │   └── DropzoneUpload.jsx   # Wrapper de material-ui-dropzone
│   │
│   └── feedback/
│       ├── Snackbar.jsx
│       └── LoadingBackdrop.jsx
│
├── pages/
│   └── Main.jsx                 # Solo composición de layout + features (sin lógica)
│
├── router/
│   └── router.js
│
├── utils/
│   ├── events.utils.js          # Mantener durante migración, eliminar en v2
│   ├── map.utils.js             # Constantes y helpers de Mapbox
│   └── method.utils.js          # checkEmptyObject y similares
│
└── styles/
    ├── global.css               # Reset + variables CSS custom properties
    ├── map.style.css            # Solo estilos del canvas Mapbox
    └── shared/
        ├── controller.styles.js # Estilos compartidos de todos los controladores
        └── theme.js             # Definición del tema MUI v5 (una sola vez)
```

---

## FASE 4 — ESTADO Y DATOS

### Estrategia de estado

| Estado | Solución | Razón |
|---|---|---|
| Panel activo (qué controlador está abierto) | `useReducer` en AppContext | Estado de UI global, no de servidor |
| Usuario autenticado / token | `useReducer` en AppContext | Transversal a toda la app |
| Datasets del usuario | `useReducer` en AppContext | Reemplaza la mutación de módulo |
| Capas activas en el mapa | `useReducer` en AppContext | Compartido entre LayerController y Canvas |
| Formulario de cada stepper | `useState` local | Estado de un solo componente |
| Datos de gráficas (Plotly) | `useState` local | Local a cada feature |
| Instancia del mapa Mapbox | `useRef` en `useMapbox` hook | No debe provocar re-renders |

### AppReducer — acciones principales

```js
// context/AppReducer.js
const appReducer = (state, action) => {
    switch (action.type) {
        case 'OPEN_PANEL':
            return { ...state, activePanel: action.panel };
        case 'CLOSE_ALL_PANELS':
            return { ...state, activePanel: null };
        case 'SET_AUTH':
            return { ...state, user: action.user, token: action.token };
        case 'LOGOUT':
            return { ...state, user: null, token: null, datasets: {} };
        case 'SET_DATASETS':
            return { ...state, datasets: action.datasets };
        case 'ADD_LAYER':
            return { ...state, layers: [...state.layers, action.layer] };
        case 'TOGGLE_LAYER_VISIBILITY':
            return {
                ...state,
                layers: state.layers.map(l =>
                    l.id === action.layerId ? { ...l, visible: !l.visible } : l
                )
            };
        default:
            return state;
    }
};
```

### Data fetching

Sin librerías adicionales. Patrón estándar con `useEffect` + estados locales de `loading/error`:

```js
// hooks/useAuth.js
const useAuth = () => {
    const { dispatch } = useApp();

    const login = async (username, passwordPlaintext) => {
        const { user, token } = await authService.login(username, passwordPlaintext);
        localStorage.setItem('token', token);
        dispatch({ type: 'SET_AUTH', user, token });
    };

    return { login };
};
```

---

## FASE 5 — CSS PROFESIONAL

### Problema actual

| Tipo | Problema |
|---|---|
| `dataController.style.css` | Sobrescribe MUI globalmente con `!important` |
| Objeto `styles` en cada controlador | ~150 líneas copy-paste en 6 archivos = ~900 líneas redundantes |
| `menu.style.css` | Targets `.MuiFab-primary` globalmente |
| Mezcla estrategias | inline objects + css files + makeStyles + global overrides |

### Solución: CSS-in-JS unificado con MUI v5 `sx` prop + objeto compartido

**Paso 1:** Un único archivo de tema MUI:
```js
// styles/theme.js
import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
    palette: {
        primary: { main: '#89ca92' },
    },
    typography: {
        fontFamily: 'Lato, Arial, sans-serif',
    },
    components: {
        // Overrides de MUI EN EL TEMA, no en CSS global
        MuiCardContent: {
            styleOverrides: {
                root: { '&:last-child': { paddingBottom: 18 } }
            }
        }
    }
});
```

**Paso 2:** Estilos compartidos de controladores en un único archivo:
```js
// styles/shared/controller.styles.js
export const controllerRootStyle = {
    position: 'fixed',
    top: 74,
    right: 10,
    borderRadius: 1,
    minWidth: 350,
    zIndex: 900,
    boxShadow: '-6px 6px 15px rgba(0,0,0,0.15)',
};

export const controllerCloseBtn = {
    position: 'absolute',
    top: 6,
    right: 8,
    fontSize: 22,
};
```

**Paso 3:** Cada feature solo define sus estilos únicos:
```js
// features/rusle/rusle.styles.js
import { controllerRootStyle, controllerCloseBtn } from '@styles/shared/controller.styles';

export const rusleStyles = {
    root: { ...controllerRootStyle },
    header: { backgroundColor: 'rgba(76,175,80,255)' }, // Solo lo específico de RUSLE
    closeBtn: { ...controllerCloseBtn },
};
```

---

## FASE 6 — PERFORMANCE

### Re-renders innecesarios actuales

- **15 componentes clase** re-renderizan en cualquier `setState` propio, incluso cuando están `open: false` y no renderizan nada visible
- El `EventEmitter` no integra con React: los eventos disparan `setState` que no corresponden al ciclo de React

### Optimizaciones concretas

**1. Lazy loading de features (code splitting):**
```jsx
// pages/Main.jsx
const RusleController = React.lazy(() => import('@features/rusle/RusleController'));
const BiodiversityController = React.lazy(() => import('@features/biodiversity/BiodiversityController'));
// ... etc

// Solo renderizar cuando están activos
{activePanel === 'rusle' && (
    <Suspense fallback={<CircularProgress />}>
        <RusleController />
    </Suspense>
)}
```

Esto reduce el JS inicial de ~15 módulos a solo los cargados on-demand.

**2. `useCallback` para handlers del mapa:**
```js
// hooks/useMapbox.js
const handleLayerVisibility = useCallback((layerId, visible) => {
    map.current.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
}, []); // map.current es una ref, no necesita dependencias
```

**3. Evitar re-renders en Canvas por cambios de panel:**
El mapa Mapbox vive en una `ref`, no en estado. Los cambios de panel no deben re-renderizar el canvas:
```js
const mapInstance = useRef(null); // No useState — no provoca re-renders
```

**4. `React.memo` para componentes de la lista de capas:**
```jsx
const LayerListItem = React.memo(({ layer, onToggle, onTransparencyChange }) => (
    // Solo re-renderiza si sus props cambian
));
```

---

## FASE 7 — ESCALABILIDAD DE EQUIPO

### Convenciones

| Regla | Ejemplo |
|---|---|
| Componentes: PascalCase | `RusleController.jsx` |
| Hooks: `use` prefix | `useRusle.js` |
| Servicios: `.service.js` | `auth.service.js` |
| Estilos del feature junto al feature | `features/rusle/rusle.styles.js` |
| Sin `console.log` en rama main | ESLint rule `no-console: error` |
| Sin `var` | ESLint rule `no-var: error` |
| Imports de alias, nunca rutas relativas `../../` | `@features/rusle/RusleController` |

### Separación por features evita conflictos

- Cada desarrollador trabaja en su carpeta `features/[nombre]/`
- Los estilos son locales al feature, sin riesgo de afectar otros componentes
- Los servicios en `services/` son independientes de la UI
- El estado global en `AppContext` tiene un único punto de modificación (`AppReducer`)

---

## FASE 8 — PLAN DE MIGRACIÓN INCREMENTAL

La migración se hace **sin romper producción**, feature por feature.

---

### Sprint 0 (prerequisito) — Eliminar bugs críticos y seguridad

> Duración estimada: 1-2 días. Sin cambios de arquitectura.

1. **Arreglar bug `removeTempLayer`** en `canvas.jsx` — eliminar `setState({ map: null })`
2. **Mover tokens a `.env`** — `REACT_APP_MAPBOX_TOKEN`, `REACT_APP_API_URL`
3. **Remover MD5** del login — enviar contraseña en texto plano sobre HTTPS
4. **Fijar `componentWillUnmount`** en `navigator.jsx` — usar la firma correcta de `removeListener`
5. **Eliminar todos los `console.log`** del código de producción
6. **Arreglar import duplicado de MUI v4/v5** — elegir uno y unificar (recomendado: v5)
7. **Mover configuración de axios** fuera de `login.jsx` a `services/api.client.js`

---

### Sprint 1 — Extraer la capa de servicios

> Mantiene la arquitectura de clases intacta. Solo reubica código.

1. Crear `src/services/api.client.js` con la instancia axios configurada
2. Crear `src/services/auth.service.js` moviendo `handleLoginClick` y `getUserParcels` de `login.jsx`
3. Crear `src/services/gee.service.js` para las llamadas a Google Earth Engine
4. Los componentes ahora llaman a `authService.login()` en lugar de hacer fetch directamente
5. **Tests:** la lógica HTTP ahora es testeable de forma aislada

---

### Sprint 2 — Crear AppContext (reemplaza el event bus gradualmente)

1. Crear `src/context/AppContext.js` + `AppReducer.js`
2. Mover el estado `open: false` de los controladores a `AppReducer` (`OPEN_PANEL`, `CLOSE_ALL_PANELS`)
3. El event bus sigue funcionando: los listeners existentes hacen `dispatch()` en lugar de `setState()`
4. **Adaptador de transición:**
   ```js
   // hooks/useEmitter.js — puente temporal
   useEffect(() => {
       const handler = () => dispatch({ type: 'OPEN_PANEL', panel: 'rusle' });
       emitter.addListener('openRusleController', handler);
       return () => emitter.removeListener('openRusleController', handler);
   }, [dispatch]);
   ```
5. El `emit` del `Menu` sigue funcionando sin cambios durante la transición

---

### Sprint 3 — Migrar controladores a funciones + hooks (uno por semana)

**Orden recomendado** (de menor a mayor complejidad):

1. `StyleController` — solo abre/cierra, sin lógica
2. `SearchController`
3. `LayerController`
4. `BandController`
5. `VegInspectorController`
6. `SpatioTemporalAnalysisController`
7. `BiodiversityController`
8. `RusleController`
9. `ModelController`
10. `DataController`
11. `ImportController`

**Template de migración de un controlador:**

```jsx
// ANTES: class RusleController extends React.Component { state = {...} }

// DESPUÉS: función + hooks
const RusleController = () => {
    const { activePanel, dispatch } = useApp();
    const { calculateRusle, loading } = useRusle(); // lógica extraída a hook

    const isOpen = activePanel === 'rusle';

    const handleClose = () => dispatch({ type: 'CLOSE_ALL_PANELS' });

    return (
        <Slide direction="left" in={isOpen} mountOnEnter unmountOnExit>
            <Card sx={rusleStyles.root}>
                {/* UI sin lógica de negocio */}
            </Card>
        </Slide>
    );
};
```

---

### Sprint 4 — CSS unificado

1. Crear `src/styles/theme.js` con el tema MUI v5 global
2. Crear `src/styles/shared/controller.styles.js` con los estilos compartidos
3. Eliminar los CSS globales con `!important` targeting MUI (`dataController.style.css`, `menu.style.css`)
4. Mover los overrides al tema en `theme.js`
5. Cada feature usa solo sus estilos únicos + importa los compartidos

---

### Sprint 5 — Lazy loading y code splitting

1. Convertir cada import de controlador en `main.jsx` a `React.lazy()`
2. Envolver renders condicionales con `<Suspense>`
3. Verificar con el bundle analyzer que los chunks se crean correctamente

---

## FASE 9 — EJEMPLOS REALES

### Ejemplo 1: Componente mal hecho → versión profesional

#### ANTES: LayerController (extracto)

```jsx
// ❌ 300 líneas de estilos copy-paste
// ❌ Lógica de negocio mezclada con UI
// ❌ Clase con estado masivo
// ❌ Event bus para todo

class LayerController extends React.Component {
    state = {
        open: false,
        mapp: null,        // typo y valor sin uso
        selected: {},
        resolution: 7,     // sin uso visible
        zoom: 0,
        layerForm: 'Border', // sin uso visible
        datasets: {},
        layers: [],
        assets: [],
        selectedAsset: '',
        mapUrl: ''
    }

    componentDidMount() {
        this.openLayerControllerListener = emitter.addListener('openLayerController', () => {
            this.setState({ open: true });
        });
        this.closeAllControllerListener = emitter.addListener('closeAllController', () => {
            this.setState({ open: false });
        });
        // etc...
    }
}
```

#### DESPUÉS: LayerController profesional

```jsx
// features/layer-manager/LayerController.jsx
import { useApp } from '@context/AppContext';
import { useLayerManager } from './useLayerManager';
import { controllerRootStyle } from '@styles/shared/controller.styles';

const LayerController = () => {
    const { activePanel, dispatch } = useApp();
    const { layers, toggleVisibility, setTransparency, addLayerFromFile } = useLayerManager();

    const isOpen = activePanel === 'layers';

    return (
        <Slide direction="left" in={isOpen} mountOnEnter unmountOnExit>
            <Card sx={controllerRootStyle} onDrop={addLayerFromFile} onDragOver={e => e.preventDefault()}>
                <CardContent>
                    <IconButton sx={{ position: 'absolute', top: 6, right: 8 }}
                        onClick={() => dispatch({ type: 'CLOSE_ALL_PANELS' })}>
                        <Icon>close</Icon>
                    </IconButton>
                    <List>
                        {layers.map(layer => (
                            <LayerListItem
                                key={layer.id}
                                layer={layer}
                                onToggle={toggleVisibility}
                                onTransparencyChange={setTransparency}
                            />
                        ))}
                    </List>
                </CardContent>
            </Card>
        </Slide>
    );
};
```

```js
// features/layer-manager/useLayerManager.js
import { useApp } from '@context/AppContext';
import { useMapbox } from '@hooks/useMapbox';

export const useLayerManager = () => {
    const { layers, dispatch } = useApp();
    const { map } = useMapbox();

    const toggleVisibility = useCallback((layerId) => {
        dispatch({ type: 'TOGGLE_LAYER_VISIBILITY', layerId });
        const layer = layers.find(l => l.id === layerId);
        map.current?.setLayoutProperty(
            layerId,
            'visibility',
            layer?.visible ? 'none' : 'visible'
        );
    }, [layers, dispatch, map]);

    const addLayerFromFile = useCallback((event) => {
        event.preventDefault();
        const file = event.dataTransfer.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const geoJson = JSON.parse(e.target.result);
            dispatch({ type: 'ADD_LAYER', layer: { id: file.name, visible: true, transparency: 100 } });
            dispatch({ type: 'ADD_DATASET', id: file.name, data: geoJson });
        };
        reader.readAsText(file);
    }, [dispatch]);

    return { layers, toggleVisibility, addLayerFromFile };
};
```

---

### Ejemplo 2: Servicio HTTP mal estructurado → versión correcta

#### ANTES: lógica HTTP dentro de login.jsx (componente UI)

```jsx
// ❌ HTTP dentro de un componente UI
// ❌ URL hardcodeada
// ❌ axios configurado dentro del componente
// ❌ MD5 en cliente

axios.defaults.baseURL = 'http://localhost:5000';

handleLoginClick = async () => {
    const newUser = {
        username: document.getElementById('username').value,
        password: md5(document.getElementById('password').value), // ❌ MD5
    };
    const response = await axios.post("http://localhost:5000/login", newUser);
    // ...lógica mezclada con setState UI
}
```

#### DESPUÉS: capa de servicios separada

```js
// services/api.client.js
import axios from 'axios';

const apiClient = axios.create({
    baseURL: process.env.REACT_APP_API_URL,
    withCredentials: true,
});

apiClient.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default apiClient;
```

```js
// services/auth.service.js
import apiClient from './api.client';

export const authService = {
    login: async (username, password) => {
        const { data } = await apiClient.post('/login', { username, password });
        return { userId: data.message[0], token: data.message[1] };
    },
    getUserParcels: async (userId) => {
        const { data } = await apiClient.get(`/users/${userId}/parcels`);
        return data;
    },
};
```

```jsx
// hooks/useAuth.js
import { useApp } from '@context/AppContext';
import { authService } from '@services/auth.service';

export const useAuth = () => {
    const { dispatch } = useApp();

    const login = async (username, password) => {
        const { userId, token } = await authService.login(username, password);
        localStorage.setItem('token', token);
        dispatch({ type: 'SET_AUTH', token });
        const parcels = await authService.getUserParcels(userId);
        dispatch({ type: 'SET_DATASETS', datasets: parseParcels(parcels) });
        return true;
    };

    return { login };
};
```

```jsx
// components/Login.jsx — ahora solo es UI
const Login = () => {
    const [form, setForm] = useState({ username: '', password: '' });
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();

    const handleSubmit = async () => {
        setLoading(true);
        await login(form.username, form.password);
        setLoading(false);
    };

    return (
        <Dialog open={...}>
            <TextField value={form.username} onChange={...} />
            <TextField type="password" value={form.password} onChange={...} />
            <Button onClick={handleSubmit} disabled={loading}>Login</Button>
        </Dialog>
    );
};
```

---

### Ejemplo 3: canvas.jsx — bug crítico corregido

#### ANTES:
```js
removeTempLayer = () => {
    const layers = this.state.map.getStyle().layers;
    this.setState({ map: null }); // ← BUG: invalida el mapa antes de usarlo
    layers.map(layer => {          // ← .map() para side effects — usar .forEach()
        if (layer.id === 'custom-temp-point') {
            this.state.map.removeLayer('custom-temp-point'); // ← CRASH: map es null
            this.state.map.removeSource('custom-temp-point');
        }
        return true; // ← return sin propósito
    });
}
```

#### DESPUÉS:
```js
removeTempLayer = () => {
    const { map, popup } = this.state;
    if (!map) return;

    const layers = map.getStyle().layers;
    layers.forEach(layer => {
        if (layer.id === 'custom-temp-point') {
            map.removeLayer('custom-temp-point');
            map.removeSource('custom-temp-point');
        }
    });

    if (popup?.isOpen()) {
        popup.remove();
    }
}
```

---

## RESUMEN DE PRIORIDADES

| Prioridad | Acción | Impacto |
|---|---|---|
| 🔴 Inmediato | Arreglar bug `removeTempLayer` (crash en producción) | Estabilidad |
| 🔴 Inmediato | Mover tokens/URLs a `.env` | Seguridad |
| 🔴 Inmediato | Eliminar MD5 del cliente | Seguridad |
| 🔴 Inmediato | Unificar MUI v4/v5 | Estabilidad |
| 🔴 Inmediato | Mover axios config fuera de login.jsx | Correctitud |
| 🟡 Sprint 1 | Extraer capa de servicios | Mantenibilidad |
| 🟡 Sprint 2 | AppContext reemplaza event bus | Mantenibilidad |
| 🟡 Sprint 3 | Migrar controladores a hooks | Escalabilidad |
| 🟡 Sprint 4 | Unificar CSS, eliminar duplicación | CSS |
| 🔵 Sprint 5 | Lazy loading + code splitting | Performance |
