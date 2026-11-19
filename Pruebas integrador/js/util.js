// Funciones de apoyo usadas por varios módulos.
import { METODOS, etiquetaFiltro } from './config.js';

export const $ = s => document.querySelector(s);

// Evita que un dato de la base de datos se interprete como HTML.
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const nombreMetodo = m => METODOS[m] || m || '—';

export const fecha = f => (f ? new Date(f).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) : '—');

// Aviso visible cuando una consulta falla (antes la página quedaba vacía sin explicar por qué).
const fallos = new Set();
export function reportar(clave, error) {
  if (error) fallos.add(clave); else fallos.delete(clave);
  const a = $('#aviso');
  a.hidden = fallos.size === 0;
  a.textContent = fallos.size ? `No se pudo cargar: ${[...fallos].join(', ')}. Se reintenta solo cada 10 segundos.` : '';
}

// Año y sexo de una ejecución: columnas "ano" / "sexo" o, si no existen, dentro de "parametros".
const val = v => (v == null || v === '' ? null : v);
export const anoDe = r => val(r.ano) ?? val(r.parametros && r.parametros.ano) ?? (r.anos_desde != null && r.anos_desde === r.anos_hasta ? r.anos_desde : null);
export const filtrosDe = r => (r.filtros && typeof r.filtros === 'object' ? r.filtros : {});
export const textoFiltros = r => Object.entries(filtrosDe(r)).map(([k, v]) => etiquetaFiltro(k, v)).join(' · ');
export const claveFiltros = r => Object.entries(filtrosDe(r)).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => k + '=' + v).join('|');
