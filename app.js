/* Launcher estilo Apple TV para Tizen 5.5. Solo ES5 (el motor web de la TV es antiguo). */
(function () {
  var DOCK = (window.CONFIG && window.CONFIG.dock) || ["Netflix", "YouTube", "Prime Video", "Disney+", "HBO Max"];
  var HIDDEN = /^(home|e-manual)$/i;
  // El tiempo solo se consulta si el usuario configura una ciudad.
  var CITY = (window.CONFIG && window.CONFIG.city) || null;

  // Lista de bloqueo integrada: apps de sistema/diagnóstico conocidas que son peligrosas o inútiles.
  // El usuario puede añadir más via CONFIG.blocklist en config.js (array de strings o regex).
  var BUILTIN_BLOCKLIST = [
    /aging/i,           // AgingAPP / Burn-In / Aging Mode
    /burn.?in/i,        // Burn In test
    /diagnostic/i,      // Diagnostic apps
    /factory/i,         // Factory mode apps
    /develop/i,         // Developer/debug apps
    /test/i,            // Test apps
    /calibration/i,     // Calibration tools
    /pattern/i,         // Pattern generators
    /pixel/i,           // Pixel test/fix
    /e.?manual/i,       // E-Manual (ya en HIDDEN, pero por si acaso)
    /smart.?hub/i,      // Smart Hub self
    /tv.?plus/i,        // TV Plus (suele ser servicio)
    /samsung.?health/i, // Samsung Health (no lanza bien en TV)
    /bixby/i,           // Bixby (no lanza bien)
    /game.?mode/i,      // Game mode toggles
    /hdmi.?cec/i,       // HDMI CEC tools
    /edid/i,            // EDID tools
    /hotel/i,           // Hotel mode
    /shop/i,            // Shop/retail mode
    /demo/i,            // Demo mode
    /installer/i,       // Installer apps
    /updater/i,         // Updater services
    /drminfo/i,         // DRM info
    /playready/i,       // PlayReady test
    /widevine/i,        // Widevine test
    /verimatrix/i,      // Verimatrix test
    /secure.?storage/i, // Secure storage test
    /keymanager/i,      // Key manager
    /certificate/i,     // Certificate manager
    /device.?manager/i, // Device manager
    /system.?info/i,    // System info
    /hw.?test/i,        // Hardware test
    /panel.?test/i,     // Panel test
    /audio.?test/i,     // Audio test
    /rf.?test/i,        // RF test
    /wifi.?test/i,      // WiFi test
    /bluetooth.?test/i, // Bluetooth test
    /nfc.?test/i,       // NFC test
    /irda.?test/i,      // IR test
    /cec.?test/i,       // CEC test
    /arc.?test/i,       // ARC/eARC test
    /hdr.?test/i,       // HDR test
    /color.?test/i,     // Color test
    /gamma.?test/i,     // Gamma test
    /white.?balance/i,  // White balance
    /uniformity/i,      // Uniformity test
    /mura/i,            // Mura correction
    /stuck.?pixel/i,    // Stuck pixel
    /image.?retention/i,// Image retention
    /logo.?test/i,      // Logo test
    /boot.?logo/i,      // Boot logo
    /factory.?reset/i,  // Factory reset
    /data.?reset/i,     // Data reset
    /self.?diagnosis/i, // Self diagnosis
    /customer.?service/i, // Customer service
    /field.?test/i,     // Field test
    /service.?mode/i,   // Service mode
    /engineer.?mode/i,  // Engineer mode
    /expert.?setting/i, // Expert setting
    /hidden.?menu/i,    // Hidden menu
    /secret.?menu/i,    // Secret menu
  ];

  function isBlocked(name) {
    if (!name) return false;
    // HIDDEN regex (home, e-manual)
    if (HIDDEN.test(name)) return true;
    // Built-in blocklist
    for (var i = 0; i < BUILTIN_BLOCKLIST.length; i++) {
      if (BUILTIN_BLOCKLIST[i].test(name)) return true;
    }
    // User custom blocklist from config.js
    var userBlocklist = (window.CONFIG && window.CONFIG.blocklist) || [];
    for (var j = 0; j < userBlocklist.length; j++) {
      var entry = userBlocklist[j];
      if (typeof entry === "string") {
        if (entry.toLowerCase() === name.toLowerCase()) return true;
      } else if (entry && typeof entry.test === "function") {
        if (entry.test(name)) return true;
      }
    }
    return false;
  }

  // [patrón, fondo, logo, brillo, texto si no hay logo]
  var BRANDS = [
    [/netflix/i,     "#F2F2F4", "netflix",     "netflix"],
    [/youtube/i,     "#F2F2F4", "youtube",     "youtube"],
    [/prime/i,       "#1560F5", "primevideo",  "prime"],
    [/disney/i,      "#13296F", "disneyplus",  "disney"],
    [/hbo|^max$/i,   "#4A2BEB", "hbomax",      "hbo"],
    [/apple tv/i,    "#000000", "appletv",     "apple"],
    [/movistar/i,    "#0A8BE8", "movistar",    "movistar"],
    [/plex/i,        "#1F1F1F", "plex",        "plex"],
    [/atresplayer/i, "#F2F2F4", "atresplayer", "atres"],
    [/3cat|tv3/i,    "#F2F2F4", "3cat",        "3cat"],
    [/rakuten/i,     "#F2F2F4", "rakuten",     "rakuten"],
    [/skyshowtime/i, "#2A165A", null, "sky",      "SkyShowtime"],
    [/internet|browser/i, "#16233A", null, "internet", "Internet"],
    [/gallery|galer/i,    "#222225", null, "gallery",  "Galería"]
  ];
  var DEFAULT_BRAND = ["#222225", null, "default"];

  var K = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13 };
  var COLS = 5;
  var $ = function (id) { return document.getElementById(id); };
  var pageEl = $("page"), nameEl = $("appname");
  var glows = [$("glow-a"), $("glow-b")], glowIdx = 0, glowName = null;

  var rows = [], cur = { r: 1, c: 0 }, focused = null, scrolled = false;
  var ring = $("ring"), ringHidden = true;

  function brandFor(name) {
    for (var i = 0; i < BRANDS.length; i++) if (BRANDS[i][0].test(name)) return BRANDS[i].slice(1);
    return DEFAULT_BRAND.concat([name]);
  }

  function launch(id) {
    try { tizen.application.launch(id, null, function (e) { $("msg").textContent = e.message; }); }
    catch (e) { $("msg").textContent = e.message; }
  }

  function makeTile(app) {
    var b = brandFor(app.name);
    var el = document.createElement("div");
    el.className = "tile";
    el.style.backgroundColor = b[0];
    el.innerHTML = b[1] ? '<img src="logos/' + b[1] + '.png">' : "<b></b>";
    if (!b[1]) el.firstChild.textContent = b[3] || app.name;
    el.item = { name: app.name, glow: b[2], open: function () { launch(app.id); } };
    return el;
  }

  function setGlow(name) {
    if (name === glowName) return;
    glowName = name;
    var front = glows[glowIdx], back = glows[1 - glowIdx];
    back.style.background = "url(glow/" + name + ".png) no-repeat";
    back.className = "glow on";
    front.className = "glow";
    glowIdx = 1 - glowIdx;
  }

  // Solo se tocan la tarjeta anterior y la nueva: nada de recorrer todas.
  function render() {
    var el = rows[cur.r][cur.c];
    if (focused) focused.className = focused.className.replace(" focus", "");
    el.className += " focus";
    focused = el;
    // Marco de foco: solo se mueve (posiciones calculadas una vez en load).
    if (el.pos) {
      ring.style.transform = "translate(" + (el.pos[0] - 17) + "px," + (el.pos[1] - 11.5) + "px)";
      if (ringHidden) { ring.className = ""; ringHidden = false; }
    } else if (!ringHidden) { ring.className = "hide"; ringHidden = true; }
    if (el.item.name && nameEl.textContent !== el.item.name) nameEl.textContent = el.item.name;
    setGlow(el.item.glow);

    var down = cur.r > 1;
    pageEl.style.transform = "translateY(" + (down ? -(480 + (cur.r - 2) * 262) : 0) + "px)";
    if (down !== scrolled) { pageEl.className = down ? "scrolled" : ""; scrolled = down; }
  }

  function move(key) {
    if (!rows[cur.r] || !rows[cur.r].length) return;
    var r = cur.r, c = cur.c;
    if (key === K.LEFT) c--;
    else if (key === K.RIGHT) c++;
    else if (key === K.DOWN) r++;
    else if (key === K.UP) r--;
    else if (key === K.ENTER) { rows[cur.r][cur.c].item.open(); return; }
    else return;
    if (key === K.UP || key === K.DOWN) {
      var step = key === K.UP ? -1 : 1;
      while (r >= 0 && r < rows.length && !rows[r].length) r += step;
    }
    if (r < 0 || r >= rows.length || !rows[r].length) return;
    if (r !== cur.r) c = r === 0 ? rows[0].length - 1 : Math.min(c, rows[r].length - 1);
    if (c < 0 || c >= rows[r].length) return;
    cur.r = r; cur.c = c;
    render();
  }

  function addRow(apps, dock) {
    var row = document.createElement("div"), holder = row, tiles = [];
    row.className = dock ? "row dock" : "row";
    if (dock) { holder = document.createElement("div"); holder.className = "tray"; row.appendChild(holder); }
    for (var i = 0; i < apps.length; i++) { var t = makeTile(apps[i]); tiles.push(t); holder.appendChild(t); }
    $("rows").appendChild(row);
    rows.push(tiles);
  }

  // Solo apps del panel de la TV (apps.js). Así no salen servicios, daemons ni duplicados.
  function inPanel(a) {
    if (!PANEL_APPS.length) return a.show ? { id: a.id, name: a.name } : null;
    for (var i = 0; i < PANEL_APPS.length; i++) {
      var p = PANEL_APPS[i].id;
      if (a.id === p || a.packageId === p || a.id.indexOf(p + ".") === 0) return PANEL_APPS[i];
    }
    return null;
  }

  function load(all) {
    var self = tizen.application.getAppInfo().id, best = {}, order = [], apps = [], brew = null;
    // Por cada app del panel, elegir la app real (id exacto o visible) y nunca su servicio.
    for (var i = 0; i < all.length; i++) {
      var a = all[i], p = inPanel(a);
      if (!p || a.id === self) continue;
      var score = (a.id === p.id ? 4 : 0) + (a.show ? 2 : 0) + (/service|svc|daemon|widget/i.test(a.id) ? 0 : 1);
      if (!best[p.id]) order.push(p);
      if (!best[p.id] || score > best[p.id].score) best[p.id] = { id: a.id, score: score };
    }
    for (var n = 0; n < order.length; n++) {
      var p = order[n];
      var app = { id: best[p.id].id, name: p.name };
      if (/tizenbrew/i.test(p.name)) { brew = app; continue; }
      if (!isBlocked(p.name)) apps.push(app);
    }

    // Deduplicar por nombre (insensible a mayúsculas) cuando no hay PANEL_APPS.
    // Mantiene la primera ocurrencia (la de mayor score).
    var seenNames = {};
    var deduped = [];
    for (var m = 0; m < apps.length; m++) {
      var key = apps[m].name.toLowerCase();
      if (!seenNames[key]) {
        seenNames[key] = true;
        deduped.push(apps[m]);
      }
    }
    apps = deduped;

    var pills = [];
    addPill(pills, "Ajustes", "default", openSettings);
    if (brew) addPill(pills, "TizenBrew", "brew", function () { launch(brew.id); });
    rows.push(pills);

    var dock = [], rest = [];
    for (var d = 0; d < DOCK.length; d++)
      for (var j = 0; j < apps.length; j++)
        if (apps[j].name.toLowerCase() === DOCK[d].toLowerCase()) dock.push(apps[j]);
    for (var k = 0; k < apps.length; k++) if (dock.indexOf(apps[k]) < 0) rest.push(apps[k]);
    rest.sort(function (x, y) { return x.name.localeCompare(y.name); });

    // Primero el dock y se pinta ya: la pantalla aparece completa cuanto antes.
    addRow(dock, true);
    readPositions(1);
    if (dock.length) { cur.r = 1; render(); }
    else { cur.r = 0; render(); }

    // Construir fuentes y apps después del primer pintado, sin esperar servicios externos.
    setTimeout(function () {
      var built = false;
      function buildRest(inputs) {
        if (built) return;
        built = true;
        addInputsRow(inputs);
        for (var s = 0; s < rest.length; s += COLS) addRow(rest.slice(s, s + COLS), false);
        readPositions(1);
        if (!dock.length) {
          for (var r = 2; r < rows.length; r++) if (rows[r].length) { cur.r = r; cur.c = 0; render(); break; }
        }
        weather(); setInterval(weather, 15 * 60 * 1000);
        preloadGlows();
      }
      tvInputs(buildRest);
      setTimeout(function () { buildRest(null); }, 1600); // Límite por si la API de fuentes no responde.
    }, 0);
  }

  function addPill(list, label, glow, open) {
    var el = document.createElement("div");
    el.className = "pill";
    el.textContent = label;
    el.item = { name: null, glow: glow, open: open };
    $("pills").appendChild(el);
    list.push(el);
  }

  // Leer posiciones de las tarjetas una sola vez (cada lectura de layout en la TV cuesta).
  function readPositions(from) {
    for (var r = from; r < rows.length; r++)
      for (var c = 0; c < rows[r].length; c++)
        if (!rows[r][c].pos) rows[r][c].pos = [rows[r][c].offsetLeft, rows[r][c].offsetTop];
  }

  /* ---------- Hora ---------- */
  var DAYS = ["DOMINGO", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];
  var MONTHS = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO",
                "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
  function clock() {
    var d = new Date(), h = d.getHours();
    $("greeting").textContent = h < 6 ? "BUENAS NOCHES" : h < 13 ? "BUENOS DÍAS" : h < 21 ? "BUENAS TARDES" : "BUENAS NOCHES";
    $("time").textContent = h + ":" + ("0" + d.getMinutes()).slice(-2);
    $("date").textContent = DAYS[d.getDay()] + "  " + d.getDate() + "  " + MONTHS[d.getMonth()];
  }

  /* ---------- Tiempo (Open-Meteo, sin clave) ---------- */
  var CLOUD = '<path d="M14 38h22a8 8 0 0 0 0-16 11 11 0 0 0-21-2 9 9 0 0 0-1 18z" fill="#E5E5EA"/>';
  var CLOUD_HI = '<path d="M14 32h22a8 8 0 0 0 0-16 11 11 0 0 0-21-2 9 9 0 0 0-1 18z" fill="#E5E5EA"/>';
  var ICONS = {
    sun: '<circle cx="24" cy="24" r="9" fill="#FFD60A"/><path stroke="#FFD60A" stroke-width="3" stroke-linecap="round" d="M24 4v5M24 39v5M4 24h5M39 24h5M9.9 9.9l3.5 3.5M34.6 34.6l3.5 3.5M9.9 38.1l3.5-3.5M34.6 13.4l3.5-3.5"/>',
    part: '<circle cx="17" cy="17" r="7" fill="#FFD60A"/>' + CLOUD,
    cloud: CLOUD,
    fog: '<path stroke="#E5E5EA" stroke-width="3" stroke-linecap="round" d="M8 18h32M5 26h38M8 34h32"/>',
    rain: CLOUD_HI + '<path stroke="#64D2FF" stroke-width="3" stroke-linecap="round" d="M17 37l-2 6M25 37l-2 6M33 37l-2 6"/>',
    snow: CLOUD_HI + '<g fill="#fff"><circle cx="16" cy="40" r="2.5"/><circle cx="24" cy="43" r="2.5"/><circle cx="32" cy="40" r="2.5"/></g>',
    storm: CLOUD_HI + '<path d="M25 33l-6 8h5l-3 7 8-10h-5l3-5z" fill="#FFD60A"/>'
  };

  function weatherInfo(code) {
    if (code === 0) return ["sun", "DESPEJADO"];
    if (code <= 2) return ["part", "POCO NUBOSO"];
    if (code === 3) return ["cloud", "NUBLADO"];
    if (code <= 48) return ["fog", "NIEBLA"];
    if (code <= 67 || (code >= 80 && code <= 82)) return ["rain", "LLUVIA"];
    if (code <= 77 || code === 85 || code === 86) return ["snow", "NIEVE"];
    return ["storm", "TORMENTA"];
  }

  function weather() {
    if (!CITY || typeof CITY.lat !== "number" || typeof CITY.lon !== "number") return;
    var x = new XMLHttpRequest();
    x.open("GET", "https://api.open-meteo.com/v1/forecast?latitude=" + CITY.lat + "&longitude=" + CITY.lon +
      "&current=temperature_2m,weather_code&hourly=temperature_2m,weather_code" +
      "&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset&forecast_days=2&timezone=auto");
    x.timeout = 10000;
    x.onload = function () {
      try {
        var r = JSON.parse(x.responseText), c = r.current, w = weatherInfo(c.weather_code);
        $("w-icon").innerHTML = '<svg viewBox="0 0 48 48">' + ICONS[w[0]] + "</svg>";
        $("w-temp").textContent = Math.round(c.temperature_2m) + "°";
        $("w-text").textContent = CITY.name + "  ·  " + w[1];
        if (r.daily) $("w-hilo").textContent = "↑" + Math.round(r.daily.temperature_2m_max[0]) + "°  ↓" + Math.round(r.daily.temperature_2m_min[0]) + "°";
        $("weather").className = "on";
        if (r.hourly) buildHourly(r.hourly);
        if (r.daily && r.daily.sunrise) applyDayNight(r.daily.sunrise[0], r.daily.sunset[0]);
      } catch (e) {}
    };
    x.send();
  }

  // Tira de las próximas horas: hora, icono y temperatura.
  function buildHourly(h) {
    var now = new Date(), out = "", shown = 0;
    for (var i = 0; i < h.time.length && shown < 6; i++) {
      var t = new Date(h.time[i]);
      if (t <= now) continue;
      var w = weatherInfo(h.weather_code[i]);
      out += '<div class="hr"><div class="h">' + t.getHours() + "h</div><svg viewBox=\"0 0 48 48\">" +
        ICONS[w[0]] + '</svg><div class="t">' + Math.round(h.temperature_2m[i]) + "°</div></div>";
      shown++;
    }
    $("hourly").innerHTML = out;
  }

  // Tema día/noche sutil: de día un azul un poco más claro; de noche, el fondo profundo de siempre.
  function applyDayNight(sunrise, sunset) {
    try {
      var now = new Date();
      var day = now >= new Date(sunrise) && now < new Date(sunset);
      document.body.className = day ? "day" : "";
    } catch (e) {}
  }

  /* ---------- Ajustes de la TV ---------- */
  function openSettings() {
    try {
      var c = new tizen.ApplicationControl("http://tizen.org/appcontrol/operation/setting", null, null, null, []);
      tizen.application.launchAppControl(c, null, function () {}, function () { launch("org.tizen.menu"); });
    } catch (e) { launch("org.tizen.menu"); }
  }

  /* ---------- Entradas de vídeo (TV / HDMI) ---------- */
  var INPUT_SYM = {
    tv: '<rect x="6" y="12" width="36" height="24" rx="3" fill="none" stroke="#fff" stroke-width="2.5"/><path d="M17 42h14" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>',
    hdmi: '<path d="M7 20h28l6 4-6 4H7z" fill="none" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/><path d="M14 28v3h20v-3" fill="none" stroke="#fff" stroke-width="2.5"/>'
  };
  function tvInputs(done) {
    try {
      tizen.systeminfo.getPropertyValue("VIDEOSOURCE", function (v) { done(v || null); }, function () { done(null); });
    } catch (e) { done(null); }
  }
  // Muestra TODAS las entradas que tiene la TV (conectadas y no), como el menú de fuentes de Samsung.
  function addInputsRow(v) {
    var conn = (v && v.connected) || [], all = conn.concat((v && v.disconnected) || []);
    var connSet = {}, nums = {};
    for (var i = 0; i < conn.length; i++) if (conn[i].type === "HDMI") connSet[conn[i].number] = 1;
    for (var j = 0; j < all.length; j++) if (all[j].type === "HDMI") nums[all[j].number] = 1;
    var list = [];
    for (var key in nums) if (nums.hasOwnProperty(key)) list.push(+key);
    list.sort(function (a, b) { return a - b; });
    // Sin datos de la TV no inventamos puertos HDMI.
    var items = [{ type: "TV", number: 1, label: "TV", sym: "tv", on: true }];
    for (var m = 0; m < list.length; m++)
      items.push({ type: "HDMI", number: list[m], label: "HDMI " + list[m], sym: "hdmi", on: !!connSet[list[m]] });
    var row = document.createElement("div"), tiles = [];
    row.className = "row";
    for (var n = 0; n < items.length; n++) { var t = makeInputTile(items[n]); tiles.push(t); row.appendChild(t); }
    $("rows").appendChild(row);
    rows.push(tiles);
  }
  function makeInputTile(it) {
    var el = document.createElement("div");
    el.className = "tile input" + (it.on ? "" : " off");
    el.innerHTML = '<div class="in-ico"><svg viewBox="0 0 48 48">' + INPUT_SYM[it.sym] + '</svg></div><div class="in-lbl"></div>';
    el.getElementsByClassName("in-lbl")[0].textContent = it.label;
    el.item = { name: it.label, glow: "default", open: function () { openSource(it.type, it.number); } };
    return el;
  }
  function openSource(type, number) {
    try {
      tizen.systeminfo.getPropertyValue("VIDEOSOURCE", function (v) {
        var all = (((v && v.connected) || []).concat((v && v.disconnected) || []));
        var src = null;
        for (var i = 0; i < all.length; i++) if (all[i].type === type && all[i].number === number) src = all[i];
        function show() { launch("org.tizen.tv-viewer"); }
        if (!src) { if (type === "TV") show(); return; }
        try { tizen.tvwindow.setSource(src, show, show); } catch (e) { show(); }
      }, function () {});
    } catch (e) {}
  }

  // Precargar los brillos (tras el primer render) para que el primer cambio de color no dé tirón.
  function preloadGlows() {
    var done = {};
    for (var g = 0; g < BRANDS.length; g++) {
      var name = BRANDS[g][3];
      if (done[name]) continue;
      done[name] = 1;
      var im = new Image(); im.src = "glow/" + name + ".png";
    }
  }

  // Return: salir de Home y volver al menú de Tizen.
  var RETURN = 10009;
  function toTizen() { try { tizen.application.getCurrentApplication().exit(); } catch (e) {} }

  window.onerror = function (m) { $("msg").textContent = m; };
  // Un movimiento por fotograma, con cola de 2 como máximo:
  // no se pierden pulsaciones rápidas y al mantener una flecha no se acumula retraso.
  var queue = [], ticking = false;
  function tick() {
    move(queue.shift());
    if (queue.length) requestAnimationFrame(tick); else ticking = false;
  }
  window.addEventListener("keydown", function (e) {
    if (e.keyCode === RETURN) { toTizen(); return; }
    if (queue.length < 2) queue.push(e.keyCode);
    if (!ticking) { ticking = true; requestAnimationFrame(tick); }
  });
  // Escenario 1920x1080 escalado para llenar la pantalla real de la TV (arregla el "empequeñecido").
  function fit() {
    var st = $("stage"), s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    st.style.webkitTransform = st.style.transform = s === 1 ? "" : "scale(" + s + ")";
  }
  fit(); window.addEventListener("resize", fit);

  clock(); setInterval(clock, 10000);
  try {
    tizen.application.getAppsInfo(load, function (e) { $("msg").textContent = e.message; });
  } catch (e) { $("msg").textContent = e.message; }
})();
