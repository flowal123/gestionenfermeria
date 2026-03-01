# Deploy con GitHub + Netlify (VS Code)

## 1) Inicializar Git y subir a GitHub
Ejecutar en la carpeta del proyecto:

```powershell
git init
git add .
git commit -m "Initial commit - GuardiaApp"
```

Crear repo vacío en GitHub (sin README) y luego:

```powershell
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git branch -M main
git push -u origin main
```

## 2) Conectar en Netlify
1. Ir a Netlify -> `Add new site` -> `Import an existing project`.
2. Elegir GitHub y autorizar.
3. Seleccionar el repo.
4. Build settings:
   - Build command: *(vacío)*
   - Publish directory: `.`
5. Deploy.

El archivo `netlify.toml` ya está preparado para:
- servir `guardiapp_v13_3.html` en `/`
- fallback SPA a `guardiapp_v13_3.html`

## 3) Dominio público de testing
En Netlify -> `Domain settings`:
1. Usar subdominio `*.netlify.app` (rápido).
2. Opcional: agregar dominio propio y configurar DNS.

## 4) Flujo de cambios
Cada cambio nuevo:

```powershell
git add .
git commit -m "Tu cambio"
git push
```

Netlify redeploya automáticamente.
