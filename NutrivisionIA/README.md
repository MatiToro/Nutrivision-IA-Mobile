# NutriVision IA — App Mobile (React Native + Expo)

App mobile de NutriVision IA, hecha con **React Native (JavaScript)** sobre **Expo SDK 57** y **Expo Router**.

## Requisitos

- Node.js 20 o superior
- Android Studio con un emulador (AVD) creado, o un celular Android con la app **Expo Go**

## Cómo correrla

```bash
npm install
npx expo start
```

Con el emulador de Android Studio abierto, apretá **`a`** en la terminal para abrir la app en él.
También podés escanear el QR con Expo Go desde tu celular.

> Más adelante, cuando sumemos módulos nativos (cámara, Google Sign-In, anuncios), se va a usar
> `npx expo run:android`, que genera la carpeta `android/` y compila con Gradle desde Android Studio.

## Estructura

```
src/
├── app/                    ← pantallas (Expo Router: cada archivo es una ruta)
│   ├── _layout.js          ← raíz: providers + stack
│   ├── premium.js          ← Plan y suscripción (modal)
│   └── (tabs)/
│       ├── _layout.js      ← barra inferior con botón central de escaneo
│       ├── index.js        ← Inicio (dashboard)
│       ├── historial.js    ← Historial por día
│       ├── escanear.js     ← Escáner IA (todavía sin cámara)
│       ├── cocina.js       ← Heladera · Lista de compras · Recetas (Premium)
│       └── perfil.js       ← Perfil
├── components/             ← TabBar, UI común, anillo de calorías, agua, modal de ítems
├── context/AppContext.js   ← estado global (agua, heladera, compras; perfil/comidas a futuro)
├── theme/                  ← colores (mismos que la Web), radios, sombras
└── utils/                  ← fechas, confirmaciones
```

## Estado de los requisitos

| RF | Estado |
|---|---|
| RF08 Dashboard diario | Pantalla lista (espera datos reales del backend) |
| RF09 Agua | **Funcional** (se guarda en el teléfono por día) |
| RF11 Historial | Pantalla lista con navegación por día/semana |
| RF12 Heladera | **Funcional**: agregar, editar, ver, eliminar (guardado local) |
| RF13 Lista de compras | **Funcional**: agregar, editar, tachar, eliminar, limpiar comprados |
| RF14/15 Recetas | Bloqueado para plan Gratuito con acceso a Premium |
| RF16 Perfil | Pantalla lista (espera datos del backend) |
| RF21 Suscripción | Comparativa de planes; sin cobro (no hay pasarela integrada) |
| RF03–RF06 Escáner | Pantalla y límite de 4/día listos; cámara e IA pendientes |
| RF01/02 Login | Pendiente |

No se muestran datos inventados: donde falta información del backend se muestra "—" o un estado vacío.
