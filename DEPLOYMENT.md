# Despliegue

El juego es **100 % cliente**: no hay servidor, ni base de datos, ni claves. La regata, el
astillero y el progreso corren en el navegador, así que desplegar es publicar ficheros estáticos.

Destino: **Firebase Hosting**.

---

## El proyecto de Firebase

Un proyecto de Firebase tiene **dos** identificadores:

| | Ejemplo | Para qué sirve |
|---|---|---|
| **Número de proyecto** | `429136855463` | Facturación e IAM. Es público, no es un secreto |
| **ID de proyecto** | `juego-barcas` | `.firebaserc`, el CLI y el subdominio `*.web.app` |

Los dos son del mismo proyecto y **no son intercambiables**: el ID es una cadena que empieza por
letra, y Firebase no admite identificadores de solo dígitos, así que el número nunca puede ir donde
va el ID.

El ID está puesto en [`.firebaserc`](.firebaserc) y **repetido explícitamente** en
[`deploy.yml`](.github/workflows/deploy.yml) [P-303]: un despliegue que adivina a qué proyecto va
es un despliegue que algún día va al proyecto equivocado.

Una vez desplegado, el juego vive en **https://juego-barcas.web.app**.

> **Antes del primer despliegue** hay que crear el proyecto `juego-barcas` en
> [console.firebase.google.com](https://console.firebase.google.com) y activar Hosting. Mientras no
> exista, `deploy.yml` fallará en el último paso — el resto de la integración continua pasa igual.

## Requisitos, una sola vez

Firebase CLI, solo si vas a desplegar a mano:

```bash
npm install -g firebase-tools
firebase login
firebase projects:list     # comprueba que sale juego-barcas
```

---

## Desplegar a mano

```bash
npm ci
npm run lint
npm test
npm run build
firebase deploy --only hosting
```

`npm run build` deja en `dist/` la aplicación y el service worker. `firebase.json` ya declara lo
que hay que declarar [P-301]:

| Qué | Cómo se sirve | Por qué |
|---|---|---|
| `/assets/**` | `max-age=31536000, immutable` | Llevan hash en el nombre: son inmutables por construcción |
| Todo lo demás | `no-cache` | El armazón, el manifiesto, el service worker y los iconos no llevan hash: tienen que poder sustituirse |
| Cualquier ruta que no sea un fichero | reescritura a `/index.html` | Es una aplicación de una sola página |

Las dos reglas de cabecera van **en ese orden y no en otro**: `**` sin caché primero, `/assets/**`
inmutable después. Cuando dos reglas encajan con la misma petición, **gana la última** — medido
sobre un canal de vista previa, no deducido. Invertirlas dejaría el código con `no-cache` y tiraría
por tierra el único caché que importa.

> **Por qué no basta con `**/*.@(html|json)`** (`DP4`). Esa regla encaja con el fichero
> `/index.html`, pero un navegador no pide `/index.html`: pide `/`, o un enlace profundo que la
> reescritura lleva a `/index.html`. Firebase decide las cabeceras por **la ruta pedida**, no por el
> destino de la reescritura, así que la portada salía con `max-age=3600` y el juego tardaba una
> hora en actualizarse. Se comprueba con `curl -D - https://juego-barcas.web.app/`, nunca leyendo
> `firebase.json`.

---

## Desplegar desde GitHub

Cada push a `main` dispara [`deploy.yml`](.github/workflows/deploy.yml), que:

1. **Reutiliza `ci.yml`** con `workflow_call` [P-302]. La misma puerta que corre en cada PR
   —tipos, tests, construcción, arnés de regata y auditoría de objetos— corre antes de cada
   despliegue, sin duplicar pasos.
2. Construye y publica en el canal `live`.

### La credencial

Vive en los secretos del repositorio como `FIREBASE_SERVICE_ACCOUNT`, **nunca en un fichero**
[P-303]. Para crearla:

```bash
firebase init hosting:github
```

o a mano: en la consola de Google Cloud, **IAM → Cuentas de servicio**, crear una con el rol
*Firebase Hosting Admin*, descargar la clave JSON y pegar su contenido entero en
**Settings → Secrets and variables → Actions → New repository secret**.

`ci.yml` **no pide ninguna credencial de nube** [P-304]: tiene `permissions: contents: read` y
ningún secreto, así que el código de un fork nunca puede llegar a Firebase.

---

## Qué comprobar después de desplegar

- El juego abre y se ve el agua (si no, es WebGL 2: el juego avisa en vez de quedarse en blanco).
- `?diagnostico=1` enseña fotogramas, llamadas de dibujo y triángulos [R-602].
- Se puede instalar desde el navegador en Android y en iOS [P-2xx]. La integración continua ya
  comprueba que el manifiesto, los seis iconos y el service worker están en `dist/`.
