<p align="center">
<a href="https://vitejs.dev/" target="blank"><img src="https://www.google.com/search?q=https://vitejs.dev/logo.svg" width="120" alt="Vite Logo" /></a>
</p>

<p align="center">
<h1>Librería Frontend Compartida (vite_privado)</h1>
</p>

<p align="center">
Un paquete privado para centralizar componentes de UI (React) y lógica de cliente del ecosistema POS-SII.
</p>

<p align="center">
<a href="#" target="_blank"><img src="https://www.google.com/search?q=https://img.shields.io/badge/framework-React%2520%252B%2520Vite-blue.svg" alt="Framework React + Vite" /></a>
<a href="#" target="_blank"><img src="https://www.google.com/search?q=https://img.shields.io/badge/status-privado-red.svg" alt="Paquete Privado" /></a>
<a href="#" target="_blank"><img src="https://www.google.com/search?q=https://img.shields.io/badge/npm-v1.0.0-blue.svg" alt="NPM Version" /></a>
<a href="#" target="_blank"><img src="https://www.google.com/search?q=https://img.shields.io/badge/license-MIT-blue.svg" alt="Package License" /></a>
</p>

Descripción

Esta librería es un paquete privado de npm/pnpm que centraliza todos los componentes de UI, hooks, y utilidades de cliente compartidas para el ecosistema de aplicaciones frontend (Vite/React) del proyecto POS-SII.

Decisiones de Diseño y Justificación

El objetivo de este paquete es mantener una consistencia visual y funcional en todas las interfaces de usuario de la plataforma.

Separar esta lógica en una librería dedicada fue una decisión de diseño para:

Crear un Sistema de Diseño (Design System) unificado: Todos los botones, modales, formularios y tablas se definen aquí, asegurando que se vean y funcionen igual en todas partes.

Centralizar la Lógica de API: Se provee una instancia de axios preconfigurada (con interceptores para tokens JWT y manejo de errores) para que todos los componentes la consuman.

Reutilizar Lógica Compleja: Se exportan Custom Hooks (ej. useAuth, useDataTable) para abstraer la lógica de estado y fetching, limpiando el código de las vistas principales.

Componentes y Hooks Principales

Componentes UI:

Button: Botón estandarizado con variantes (primary, secondary, danger).

Modal: Componente modal genérico.

DataGrid: Tabla de datos avanzada con paginación, búsqueda y filtros.

FormInput: Wrapper para inputs de formulario con integración de react-hook-form y validación.

Hooks:

useApi(): Hook que utiliza la instancia centralizada de Axios.

useAuth(): Hook para gestionar el estado de autenticación, login, logout y roles de usuario.

Utils:

apiClient.ts: Instancia de Axios preconfigurada con interceptores.

formatters.ts: Funciones para formatear moneda (CLP), fechas, etc.

Uso

Este paquete se instala como una dependencia en la aplicación principal de Vite/React (AFierroH/pos_sii_nest).

# Ejemplo de instalación local durante el desarrollo
# (Desde la carpeta de pos_sii_nest/frontend)
npm install ../vite_privado
