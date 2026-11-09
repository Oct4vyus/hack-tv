/* Copia a config.js. La configuración instalada es legible dentro del .wgt. */
window.CONFIG = {
  city: null, // Opcional: { name: "TU CIUDAD", lat: 0, lon: 0 }, usa tus coordenadas.
  dock: ["Netflix", "YouTube", "Prime Video", "Disney+", "HBO Max"],
  // true lista todas las apps que Tizen reporta, incluidas las ocultas/de sistema.
  // Respeta blocklist; desactívalo para usar solo PANEL_APPS y samsung_apps seleccionadas.
  show_all_apps: false,
  // blocklist: apps que NO quieres que aparezcan (además de la lista interna).
  // Cada entrada puede ser un string (coincidencia exacta, insensible a mayúsculas)
  // o una RegExp (ej: /aging/i, /test/i). La lista interna ya bloquea:
  // AgingAPP/Burn-In, diagnósticos, factory, test, calibration, service mode, etc.
  // blocklist: ["App Exacta", /patrón/i],

  // samsung_apps: apps Samsung seleccionadas por ID exacto o por nombre visible.
  // Los nombres se comparan sin distinguir mayúsculas/minúsculas.
  //   samsung_apps: [
  //     { name: "Channel Manager" },
  //     { id: "org.tizen.tv-viewer", name: "TV" }
  //   ],

  // order: orden personalizado de las apps. Las que estén aquí aparecen primero en el orden
  // que tú digas; el resto se ordena alfabéticamente al final.
  // order: ["Netflix", "YouTube", "Disney+", "Jellyfin", "Flow"]
};
