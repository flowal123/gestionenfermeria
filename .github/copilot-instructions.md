# GuardiaApp (MP Enfermería) — AI Assistance Guide

This workspace is a lightweight, self‑contained single‑page application for nursing shift planning. There is no build step or backend code in this repo – everything runs in the browser and talks to a Supabase DB.  The following notes are intended to help any AI coding agent quickly understand how the project is structured and where to make changes.

---

## 🧱 Architecture at a Glance

- **Entry point:** `guardiapp_v13_3.html` – a single HTML file that includes all markup, styles and script tags.
- **Layered JavaScript modules** loaded in order via `<script>` tags under `assets/js/layers/`:
  1. **`contracts-layer.js`** – very small registry (`window.GApp`) that lets other scripts expose and consume APIs by name.
  2. **`core-layer.js`** – holds global state, demo data arrays (`EMPS`, `SUBS`, etc.), role/permission logic, navigation and basic utilities (`toast()`, `openM()`, etc.).  Almost every view function calls something from `core`.
  3. **`features-layer.js`** – the largest file.  Contains all of the UI rendering and event handlers for each page/view, modal and table.  Functions are grouped by feature (`renderCal`, `renderMySched`, `saveEmp`, …).
  4. **`infra-layer.js`** – Supabase configuration and CRUD helpers for the domain tables (`funcionarios`, `turnos`, `licencias`, `cambios`, `alertas`, `usuarios`).  Also manages realtime subscriptions and fifteen‑second loading indicator.
  5. **`bootstrap-layer.js`** – startup code that waits for window `load`, checks that required layers are present, then initializes EmailJS (`features.initEJ`) and Supabase (`infra.initSB`).

The layers expose their APIs via `window.GApp.registerLayer(name, api)` and can be retrieved with `getLayer()`; this is the only inter‑module coupling mechanism.

> The UI is a **plain vanilla SPA**: no bundler, no transpilation, no package.json.  Editing the JS/HTML and refreshing the browser is the only "build" step.


## 📂 Key Files and Directories

- `guardiapp_v13_3.html` – whole application markup and the only HTML file.
- `assets/css/guardiapp_v13_3.css` – styles and layout.  Familiarize yourself with utility classes such as `.btn`, `.chip`, `.sh` (shift code colours) and `.gone` (hides elements).
- `assets/js/layers/*.js` – see architecture above.

There are **no tests**, no configuration files, and no backend code in this repository.


## 🔄 Data Flow & Domain

- The app works with the following domain entities (Spanish names):
  - `funcionarios` (employees / nurses)
  - `suplentes` (substitutes)
  - `turnos` (shifts)
  - `licencias` (leave requests)
  - `cambios` (shift‑swap requests)
  - `alertas` (system alerts)
  - `usuarios` (login accounts)
- The `infra` layer fetches / updates these tables via the Supabase JS client.  Query examples are in `loadDB()` (see `infra-layer.js` lines 17–48).  Most calls simply mirror the table structure; extra computed fields are stripped before sending.
- Loaded rows are stored in the global `DB` object; UI functions read from `DB.*` to render tables and badges.
- Demo data arrays (e.g. `EMPS`, `COV`, `SGRP`, `WK`, `MYSCHED`) provide offline fallback and are hard‑coded in `core-layer.js`.
- Real‑time updates are handled by `infra.initRealtime()` subscribing to `'guardiapp-changes'`; modifications on relevant tables call `loadDB()` again.


## 👩‍💻 Developer Workflow & Debugging

1. **Run the app:** open `guardiapp_v13_3.html` in a browser.  For Supabase access you may need to serve the file over HTTP (e.g. `npx serve .` or any static server).  CORS doesn't usually prevent the public key from working.
2. **Modify UI or logic:** edit HTML/JS files and refresh the page.  Use the browser console to call exported functions (e.g. `window.GApp.getLayer('core').doLogin()`), inspect `DB`, or step through code.
3. **Supabase data:** the project uses a public publishable key defined in `infra-layer.js`.  You can connect to the same Supabase project via [https://app.supabase.com](https://app.supabase.com) and adjust tables manually.
4. **Logging:** `console.log` and `toast()` calls are scattered throughout the code for runtime diagnostics.  Look at `.warn`/`.error` outputs when things go wrong.
5. **Add new views:**
   - Add HTML markup to the appropriate section of `guardiapp_v13_3.html` (follow existing structure: `<div class="view" id="v-...">` for pages, `<div class="ov" id="...M">` for modals).
   - Register any new DOM event handlers using plain `onclick` attributes or by calling them from the `features` layer.
   - Write rendering functions in `features-layer.js` and, if needed, helper utilities in `core-layer.js` or `infra-layer.js`.  Export new functions through the layer registry if another layer must call them.
   - Update permission logic in `core-layer.js` (`PERMS` object) and add navigation entries in the sidebar markup.
6. **No automated tests:** manual testing in all three roles (`admin`, `supervisor`, `nurse`) is the only verification.


## 🧩 Project‑Specific Conventions

- **Spanish variable names & comments** – e.g. `licencias`, `guardias`, `cambio`, `funcionario`, etc.  Keep naming consistent when extending features.
- **Shift codes:** single‑ or multi‑letter codes (M, TS, NO, CPB, GINE, …) are rendered with classes like `sM`, `sT`, `s7` etc.  Helper `shCls(code)` in `core-layer.js` converts codes to CSS classes.
- **Global state variables:** `cRole`, `cUser`, `cWeek`, `cSF` control the current role, logged‑in user, calendar week offset, and sector filter.  Update them through provided functions (`selRole`, `go`, etc.) rather than mutating directly.
- **DOM helpers:** functions such as `openM('modalId')`, `closeM('modalId')`, `toast(type,title,msg)` are defined in `features-layer.js` and used throughout.
- **Layer usage:** whenever a function in one layer needs another layer, retrieve it from the registry:
  ```js
  const infra = window.GApp.getLayer('infra');
  infra.saveTurno(...);
  ```
- **Date hard‑coding:** many examples are fixed to January 2026; update these when adapting for other months.


## 🔌 External Dependencies & Integrations

- **Supabase** – the only backend service.  URL/key in `infra-layer.js`.
- **EmailJS** – used for sending schedule emails; initialized via `features.initEJ()`.
- **xlsx.full.min.js** – generates Excel exports.
- **Fonts** loaded from Google Fonts.

All external libraries are imported directly via `<script>` tags in the HTML.


## 📝 Useful Examples

- **Loading the database:**
  ```js
  // infra-layer.js
  async function loadDB(){
    const [fRes, tRes, ...] = await Promise.all([
      sb.from('funcionarios').select('*, clinica:clinicas(nombre,codigo), sector:sectores(nombre,codigo)').eq('activo',true).order('apellido'),
      sb.from('turnos').select('funcionario_id, fecha, codigo, sector_id').gte('fecha','2026-01-01').lte('fecha','2026-01-31').limit(5000),
      // …
    ]);
    DB.funcionarios = (fRes.data||[]).filter(f=>f.tipo==='fijo');
    // …
  }
  ```
- **Rendering the weekly calendar:**
  ```js
  // features-layer.js
  function renderCal(){
    const ws=cWeek*7;
    // build header / days …
    SGRP.forEach(grp=>{
      html+=`<tr class="csr"><td colspan="${days.length+1}">${grp.sector}</td></tr>`;
      grp.emps.forEach(emp=>{
         const sc=WK[emp]||[];
         html += /* cell generation */;
      });
    });
    tbl.innerHTML=html;
  }
  ```
- **Saving a leave request to Supabase:**
  ```js
  async function saveLicencia(data){
    const {data:res, error} = await sb.from('licencias').insert(data).select(...).single();
    if(error){ toast('er','Error al guardar licencia', error.message); return null; }
    DB.licencias.push(res);
    // also push to LIC_DATA for UI
    LIC_DATA.push({ ... });
    return res;
  }
  ```

Include such snippets when guiding the AI to add similar logic.


## ✅ Summary for Agents

When editing this repository, remember:

1. **Start by locating the right HTML view/modals**.
2. **Add rendering/control code in `features-layer.js`**, utilising helpers in `core` or `infra` and exporting them if cross‑layer access is required.
3. **Respect the Spanish naming conventions and shift‑code helpers**.
4. **No build or test infrastructure exists; manual browser testing is required.**
5. **Supabase is the sole backend – use the existing `infra` helpers for all server interactions.**

Feel free to ask follow‑up questions if any section of the UI/data flow is unclear!  This document will be updated as the project evolves.