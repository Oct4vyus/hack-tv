**Español** | [English](INSTALL.md)

# Instalación

Home se abre como aplicación y no sustituye Samsung Smart Hub. Se ha usado con éxito en una Samsung de 2020. Requiere Tizen 5.5 o superior; no se garantiza la compatibilidad con otros modelos y versiones de firmware.

Esta guía asume que no has instalado nunca una app "no oficial" en una Samsung. Cada término técnico se explica la primera vez que aparece. Sigue los pasos en orden; no te saltes ninguno.

## Antes de empezar: qué vas a necesitar

- **Python 3.9 o superior** en tu ordenador. Es lo que ejecuta los scripts de este proyecto.
- **Tu ordenador y tu TV en la misma red local** (el mismo Wi-Fi o el mismo cable de red). Usa una red local de confianza donde los dispositivos puedan comunicarse; una red de invitados o el aislamiento de clientes pueden impedir la conexión.
- **El mando de la TV** a mano.
- Para firmar e instalar el paquete final necesitas además:
  - **Tizen Studio**: el programa oficial de Samsung para desarrollar apps de TV.
  - Dentro de Tizen Studio, las extensiones **TV Extension** y **Samsung Certificate Extension** (se instalan desde su propio gestor de paquetes).
  - Los comandos `tizen` y `sdb` deben quedar accesibles desde tu terminal (es decir, en el `PATH`). El instalador de Tizen Studio normalmente te pregunta si quiere hacer esto por ti; dile que sí.
  - Una **cuenta de Samsung Developer** (gratuita, se crea en developer.samsung.com).
  - Tus propios certificados de firma (se explica más abajo cómo generarlos).

Descarga siempre las versiones oficiales para tu sistema (macOS, Windows o Linux) y tu arquitectura (Intel/AMD o Apple Silicon). Esta guía no ha sido probada en todas las combinaciones posibles.

En Windows usa `python` en vez de `python3` en todos los comandos de esta guía. El archivo `deploy.sh` es un atajo para macOS/Linux; en Windows ignóralo y usa directamente `python instalar.py` con las mismas opciones.

## Paso 1 · Activar el modo desarrollador en la TV

El "modo desarrollador" es un ajuste oculto que permite instalar apps que no vienen de la tienda oficial de Samsung. Sin él, la TV rechaza cualquier app externa.

En la interfaz de una Samsung de 2020 (la usada para probar este proyecto):

1. Ve a **Apps** (la pantalla donde se ven los iconos de Netflix, YouTube, etc.).
2. Con el mando, escribe **12345** (sin pulsar nada más; algunos modelos abren el menú automáticamente al terminar de teclear).
3. Se abre un panel. Pon **Developer Mode** en **On**.
4. Te pedirá una **Host PC IP**: aquí va **la IP local de tu ordenador** (no la de la TV). En macOS la ves en Ajustes del Sistema → Red; en Windows, en `ipconfig` dentro de una terminal; en Linux, con `ip addr`.
5. Confirma y **reinicia la TV** cuando lo pida.

El menú varía según el modelo. Si no aparece el panel, revisa **Apps → App Settings**, si existe, y la documentación de tu televisor.

Por separado, en los **ajustes de red de la propia TV** (no en el router) apunta la **IP de la TV**. La necesitarás en el paso siguiente. No la confundas con la IP de tu ordenador que acabas de introducir.

## Paso 2 · Conectar tu ordenador a la TV por SDB

**SDB** (Smart Development Bridge) es la herramienta de Samsung para hablar con una Tizen TV desde la terminal — el equivalente, en el mundo Tizen, a lo que ADB es para Android. Viene incluida con Tizen Studio.

Con la TV **encendida** y en modo desarrollador, abre una terminal en tu ordenador y ejecuta esto, **sustituyendo `IP_DE_TU_TV` por la IP real de tu TV**:

```sh
sdb connect IP_DE_TU_TV
sdb devices
```

Si todo va bien, el segundo comando muestra una línea con un número de serie y la palabra `device`. **Copia ese serial exacto**: lo necesitarás varias veces más adelante, para instalar, desinstalar y depurar.

El puerto de desarrollo que usa este flujo es el **26101**. No necesitas abrir nada en tu router — la conexión es solo dentro de tu red local. No conectes nunca a una TV que no sea tuya.

Este proyecto incluye además un cliente experimental (`tools/minisdb.py`) que usa ese mismo puerto directamente para una función opcional (listar tus apps instaladas). No sustituye a Certificate Manager ni a las herramientas oficiales; es solo un atajo para un paso concreto.

## Paso 3 · Crear tus propios certificados de firma

Las TVs Samsung no instalan ninguna app sin firmar: por eso necesitas certificados propios. Esto se hace **una sola vez** (los certificados se reutilizan en instalaciones futuras).

1. Abre **Certificate Manager** dentro de Tizen Studio.
2. Crea un perfil nuevo del tipo **Samsung → TV**.
3. El asistente te pedirá un **certificado de autor** (lo genera el propio programa) y un **certificado de distribuidor**, que debes asociar al **DUID** de tu TV. El DUID es un identificador único de tu televisor; Tizen Studio normalmente te permite obtenerlo conectando la TV (con SDB ya conectado, como en el paso 2) y pidiéndolo desde el propio asistente, o consultándolo en los ajustes "About" de la TV.
4. Guarda los certificados generados y la contraseña que elijas **en un lugar seguro, fuera de este repositorio**. Si pierdes el certificado de autor, no podrás actualizar la app más adelante con el mismo identificador.
5. Si en **Device Manager** ves la opción **Permit to install applications**, actívala para tu dispositivo: es necesaria para poder instalar el paquete que firmes.

No compartas tu cuenta de Samsung Developer, tu DUID ni tus certificados en chats públicos, capturas de pantalla ni repositorios: son datos ligados a tu identidad de desarrollador y a tu dispositivo concreto.

Cada persona que instale Home debe crear su propio perfil de certificados.

Si ya habías instalado una versión anterior de Home firmada con otro certificado, la nueva firma puede impedir **actualizarla**: Tizen trata cada certificado de autor como una identidad distinta. Si te ocurre, desinstala la versión antigua antes de instalar la nueva (se eliminarán los datos que esa aplicación haya guardado).

## Paso 4 · Preparar el paquete de la app

Desde la carpeta del proyecto, ejecuta:

```sh
python3 instalar.py
```

Esto crea dos archivos locales (que Git ignora, así que son solo tuyos):

- `launcher/config.js`: tu configuración personal.
- `launcher/apps.js`: una lista opcional de aplicaciones. La lista vacía predeterminada permite que Home detecte las aplicaciones visibles mediante Tizen.

Y genera `build/Home-unsigned.wgt`: un paquete **sin firmar** (`.wgt` es el formato de paquete de Tizen, equivalente a un `.apk` de Android). Este archivo concreto **no se puede instalar todavía** — es solo una comprobación intermedia de que todo se ha copiado bien. El comando no descarga nada de internet ni se conecta a ninguna TV.

### Personalizar qué se muestra

Abre con un editor de texto el `launcher/config.js` que se acaba de crear:

- `city: null` significa que el reloj del tiempo está desactivado. Para activarlo, sustituye `null` por algo como `{ name: "Barcelona", lat: 41.38, lon: 2.17 }`, usando el nombre y las coordenadas de tu propia ciudad.
- `dock` es la lista de apps que aparecen en la primera fila, en ese orden. Si hay más de cinco, Home reduce automáticamente el ancho de las tarjetas para que quepan en pantalla.
- `show_all_apps: true` muestra todas las apps que Tizen informa, incluidas las ocultas y de fábrica. Algunas pueden abrir pruebas, menús de servicio o restablecimientos; para volver a una lista seleccionada, ponlo en `false` y usa `apps.js` y `samsung_apps`.
- `blocklist` sigue excluyendo los nombres que indiques incluso con `show_all_apps: true`; por ejemplo, `blocklist: [/aging/i]` oculta Aging Mode.
- `samsung_apps` acepta apps seleccionadas con `{ name: "Nombre visible" }` o `{ id: "ID", name: "Nombre" }`. Las entradas añadidas explícitamente por nombre permiten usar apps que normalmente bloquea el filtro interno; `blocklist` personalizada sigue aplicándose.

El resto de aplicaciones se detectan a partir de lo que Tizen muestra como visible. Vuelve a ejecutar el comando de preparación después de cambiar la configuración.

Mantén los archivos personales fuera de `launcher/logos` y `launcher/glow`: el preparador solo acepta los recursos de su lista y rechaza los enlaces simbólicos. Las consultas del tiempo envían tus coordenadas a Open-Meteo; consulta [Seguridad y privacidad](SECURITY.es.md).

### (Opcional) Generar la lista de apps manualmente

Si el listado automático no refleja bien lo que tienes instalado, puedes generarlo tú mismo conectándote por SDB (con la TV ya conectada como en el paso 2):

```sh
python3 tools/panel_apps.py --tv IP_DE_TU_TV
```

Esto es un protocolo experimental propio del proyecto, no una API oficial de Samsung, así que puede no funcionar en todos los firmwares. Genera un `apps.js` local con tu inventario de apps. No es necesario para instalar Home. Para recuperar la detección automática, pon `PANEL_APPS` en `[]` dentro de `launcher/apps.js` y prepara de nuevo el paquete.

### Firmar el paquete

Una vez tengas tu perfil de certificados del paso 3, vuelve a ejecutar el script indicando ese perfil:

```sh
python3 instalar.py --profile "NOMBRE_DE_TU_PERFIL"
```

Sustituye `NOMBRE_DE_TU_PERFIL` por el nombre exacto que le diste al perfil en Certificate Manager. Conserva las comillas si el nombre contiene espacios. El script:

1. Copia solo los archivos necesarios a `build/package`.
2. Llama internamente a `tizen package -t wgt -s PERFIL -- DIRECTORIO` (el comando oficial de Samsung para firmar).
3. Comprueba que el paquete resultante contiene ambas firmas XML esperadas antes de darte el visto bueno — aunque esa comprobación es solo una verificación local; la TV hace su propia validación criptográfica al instalar.

Si todo sale bien, verás un mensaje confirmando que el `.wgt` **firmado** está en `build/package`. A partir de ahí, no modifiques ese archivo: cualquier cambio invalidaría la firma.

## Paso 5 · Instalar en la TV

Con el serial que copiaste en el paso 2 y el mismo perfil de certificados:

```sh
python3 instalar.py --profile "NOMBRE_DE_TU_PERFIL" --target "SERIAL_DE_TU_TV" --install
```

Por dentro, esto ejecuta `tizen install -n ARCHIVO -s SERIAL -- DIRECTORIO` (el comando oficial de instalación). El script no escanea tu red buscando TVs ni elige un dispositivo por ti — tienes que indicar el serial exacto a propósito, para evitar instalar por error en el dispositivo equivocado. Tampoco toca tus perfiles de certificados.

Si prefieres macOS/Linux con un atajo más corto, `./deploy.sh` acepta exactamente los mismos argumentos que `instalar.py`.

## Usar la app

Abre **Home** desde la pantalla de Apps de la TV, como cualquier otra app. Navega con las flechas del mando y confirma con OK. El botón **Return** del mando cierra Home y te devuelve a donde estabas; el botón **Home** del mando te lleva siempre a Smart Hub, sin pasar por esta app. Si tu modelo lo permite, puedes añadir Home a tu barra de accesos rápidos desde el propio menú de Apps.

Home no se abre automáticamente al encender la TV; ábrelo desde Apps. Consulta las [Limitaciones](LIMITATIONS.es.md) para conocer las funciones que dependen del modelo o del firmware.

## Desinstalar

```sh
python3 instalar.py --target "SERIAL_DE_TU_TV" --desinstalar
```

También puedes desinstalarla directamente desde el mando: en Apps, selecciona Home y usa la opción **Eliminar**. No borres por error ninguna otra app de la lista.

Si ya no vas a seguir desarrollando, es buena idea desactivar el modo desarrollador (repite el paso 1 y pon **Developer Mode** en **Off**) y reiniciar la TV, además de revertir a mano cualquier cambio de red que hicieras. Desinstalar Home no deshace ningún otro ajuste ni afecta a herramientas de terceros que hayas instalado por tu cuenta (como TizenBrew).

## ¿Algo no funciona?

Antes de repetir pasos al azar, revisa la [tabla de problemas habituales](TROUBLESHOOTING.es.md) — cubre los errores más típicos de cada fase (conexión, firma, instalación).

## Documentación oficial

Flujo de desarrollo y conexión: [Samsung TV Device](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/tv-device.html). Firma: [Creating Certificates](https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/creating-certificates.html). Comandos: [Samsung CLI](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/command-line-interface.html) y [ejemplo oficial con SDB](https://developer.samsung.com/smarttv/develop/extension-libraries/webassembly/tizen-sockets-extension/building-curl-applications-using-cli-tools.html).
