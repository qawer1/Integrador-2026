// Historial: lista de ejecuciones con filtro por método y detalle de cada una
// (datos, resultado y gráfica de tiempo por modo, con esa ejecución resaltada).
//
// Columnas que escribe el worker del nodo maestro en "ejecuciones":
//   n, procesos, tiempo_s (cómputo), tiempo_lectura_s, tiempo_total_s, resultado, referencia, error_abs, ...
// Las filas antiguas (de ejemplo) solo traen "tiempo_segundos"; se usan como respaldo.
import { etiquetaModo, FILTROS, etiquetaFiltro } from './config.js';
import { $, esc, nombreMetodo, fecha, reportar, anoDe, filtrosDe, textoFiltros, claveFiltros } from './util.js';
import { estado } from './estado.js';
import { pintarComparacion } from './comparar.js';
import { mostrarVista } from './vistas.js';

let ejecuciones = [];
let abierta = null; // id de la ejecución cuyo detalle está abierto
let grafica;

const num = v => (v == null || v === '' ? null : Number(v));
const tiempoTotal = r => num(r.tiempo_total_s) ?? num(r.tiempo_segundos);
const nDe = r => num(r.n) ?? num(r.parametros && r.parametros.n);

// Qué tiempo se grafica: total (con lectura del dataset), solo cómputo o solo lectura.
const METRICAS = {
  total: { nombre: 'Tiempo total', de: tiempoTotal },
  computo: { nombre: 'Tiempo de cómputo', de: r => num(r.tiempo_s) },
  lectura: { nombre: 'Tiempo de lectura de datos', de: r => num(r.tiempo_lectura_s) },
};

const seg = v => (v == null ? '—' : v.toLocaleString('es-CO', { maximumFractionDigits: 3 }));
const miles = v => (v == null ? '—' : v.toLocaleString('es-CO'));
const cientifica = v => (v == null ? '—' : Number(v).toExponential(2));

export async function cargarResultados() {
  const { data, error } = await estado.sb.from('ejecuciones').select('*').order('id', { ascending: false }).limit(200);
  reportar('el historial', error);
  if (!data) return;
  // El worker guarda Newton como 'newton'; la página lo reconoce como 'newton_raphson'.
  ejecuciones = data.map(r => (r.metodo === 'newton' ? { ...r, metodo: 'newton_raphson' } : r));
  try { pintarComparacion(ejecuciones); } catch (e) { console.error('Comparación de métodos:', e); }
  pintarFiltro();
  pintarLista();
  if (abierta !== null) pintarDetalle();
}

export function conectarHistorial() {
  Object.entries(FILTROS).forEach(([k, f]) => {
    const d = document.createElement('div');
    d.innerHTML = `<label for="f_${k}">${esc(f.nombre)}</label><select id="f_${k}"><option value="">Todos</option></select>`;
    $('#exportar').before(d);
  });
  ['#filtro', '#fAno', ...Object.keys(FILTROS).map(k => '#f_' + k)].forEach(s => $(s).addEventListener('change', pintarLista));
  $('#tabla').addEventListener('click', e => {
    const id = e.target.dataset.ver;
    if (!id) return;
    abierta = Number(id);
    $('#metrica').value = 'total';
    pintarDetalle();
  });
  // "Ver resultado" en la cola: abre el detalle de la ejecución ligada a esa solicitud (solicitud_id).
  $('#cola').addEventListener('click', async e => {
    const id = e.target.dataset.resultado;
    if (!id) return;
    await cargarResultados();
    const r = ejecuciones.find(x => String(x.solicitud_id) === id);
    if (!r) { alert(`Aún no hay resultado registrado para la solicitud #${id}. Intenta de nuevo en unos segundos.`); return; }
    mostrarVista('historial');
    abierta = r.id;
    $('#metrica').value = 'total';
    pintarDetalle();
  });
  $('#detalleCerrar').addEventListener('click', cerrarDetalle);
  $('#metrica').addEventListener('change', () => { const r = ejecuciones.find(x => x.id === abierta); if (r) dibujar(r); });
  $('#exportar').addEventListener('click', exportarCSV);
}

const filtradas = () => {
  const f = $('#filtro').value, a = $('#fAno').value;
  return ejecuciones.filter(r => (!f || r.metodo === f) && (!a || String(anoDe(r)) === a) && Object.keys(FILTROS).every(k => !$('#f_' + k).value || filtrosDe(r)[k] === $('#f_' + k).value));
};

// Descarga las ejecuciones que se ven (según el filtro) como CSV que Excel abre bien.
// Si un texto empieza con = + - @ se le antepone ' para que Excel no lo trate como fórmula.
function celdaCSV(v) {
  let t = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(t)) t = "'" + t;
  return '"' + t.replace(/"/g, '""') + '"';
}
function exportarCSV() {
  const cab = ['id', 'metodo', 'modo', 'nodos', 'procesos', 'n', 'ano', 'filtros', 'tiempo_total_s', 'tiempo_computo_s', 'tiempo_lectura_s',
    'resultado', 'referencia', 'error_abs', 'lanzado_por', 'fecha'];
  const filas = filtradas().map(r => [r.id, nombreMetodo(r.metodo), r.nodos == null ? '' : etiquetaModo(r.nodos), r.nodos, r.procesos,
    nDe(r), anoDe(r), textoFiltros(r), tiempoTotal(r), r.tiempo_s, r.tiempo_lectura_s, r.resultado, r.referencia, r.error_abs, r.lanzado_por, r.creada_en]);
  const csv = [cab, ...filas].map(f => f.map(celdaCSV).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = 'ejecuciones.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

function cerrarDetalle() {
  abierta = null;
  if (grafica) { grafica.destroy(); grafica = null; }
  $('#detalle').hidden = true;
  $('#listaEjec').hidden = false;
}

function pintarFiltro() {
  const sel = $('#filtro');
  const actual = sel.value;
  const metodos = [...new Set(ejecuciones.map(r => r.metodo).filter(Boolean))];
  sel.innerHTML = '<option value="">Todos</option>' + metodos.map(m => `<option value="${esc(m)}">${esc(nombreMetodo(m))}</option>`).join('');
  sel.value = metodos.includes(actual) ? actual : '';
  const rellenar = (id, valores, etiqueta) => {
    const s = $(id), a = s.value;
    s.innerHTML = '<option value="">Todos</option>' + valores.map(v => `<option value="${esc(v)}">${esc(etiqueta(v))}</option>`).join('');
    s.value = valores.map(String).includes(a) ? a : '';
  };
  rellenar('#fAno', [...new Set(ejecuciones.map(anoDe).filter(v => v != null))].sort(), String);
  Object.keys(FILTROS).forEach(k => rellenar('#f_' + k, [...new Set(ejecuciones.map(r => filtrosDe(r)[k]).filter(Boolean))], v => etiquetaFiltro(k, v)));
}

function pintarLista() {
  const filas = filtradas();
  $('#vacio').hidden = filas.length > 0;
  $('#tabla').innerHTML = filas.map(r => `<tr><td class="num">${esc(r.id)}</td><td>${esc(nombreMetodo(r.metodo))}</td>
      <td>${r.nodos == null ? '—' : esc(etiquetaModo(r.nodos))}</td><td class="num">${esc(miles(nDe(r)))}</td><td>${esc(anoDe(r) ?? '—')}</td><td>${esc(textoFiltros(r) || '—')}</td>
      <td class="num">${esc(seg(tiempoTotal(r)))}</td><td>${esc(r.lanzado_por || '—')}</td><td>${fecha(r.creada_en)}</td>
      <td><button class="btn sec sm" data-ver="${esc(r.id)}">Ver detalle</button></td></tr>`).join('');
}

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
// serie_mensual puede venir como lista de números, lista de objetos o un objeto {mes: valor}.
function tablaSerie(s) {
  let filas = [];
  if (Array.isArray(s)) filas = s.map((v, i) => (v && typeof v === 'object' ? [v.mes ?? MESES[i], Object.values(v).filter(x => typeof x === 'number').pop()] : [MESES[i], v]));
  else if (s && typeof s === 'object') filas = Object.entries(s);
  if (!filas.length) return '';
  return `<h3>Distribución mensual</h3><div class="scroll"><table><thead><tr><th>Mes</th><th>Registros</th></tr></thead><tbody>${filas.map(([m, v]) => `<tr><td>${esc(m)}</td><td class="num">${esc(miles(num(v)))}</td></tr>`).join('')}</tbody></table></div>`;
}

function pintarDetalle() {
  const r = ejecuciones.find(x => x.id === abierta);
  if (!r) return cerrarDetalle();
  $('#listaEjec').hidden = true;
  $('#detalle').hidden = false;
  $('#detalleTitulo').textContent = `Ejecución #${r.id} · ${nombreMetodo(r.metodo)}`;
  const datos = [
    ['Método', nombreMetodo(r.metodo)],
    ['Modo', r.nodos == null ? '—' : etiquetaModo(r.nodos) + (r.procesos != null ? ` (${r.procesos} procesos)` : '')],
    ['n', miles(nDe(r))],
    ['Tiempo total', tiempoTotal(r) == null ? '—' : seg(tiempoTotal(r)) + ' s'],
    ['Cómputo', num(r.tiempo_s) == null ? null : seg(num(r.tiempo_s)) + ' s'],
    ['Lectura de datos', num(r.tiempo_lectura_s) == null ? null : seg(num(r.tiempo_lectura_s)) + ' s'],
    ['Valor de referencia', r.referencia == null ? null : String(r.referencia)],
    ['Error absoluto', r.error_abs == null ? null : cientifica(r.error_abs)],
    ['Años', r.anos_desde != null ? `${r.anos_desde}–${r.anos_hasta}` : null],
    ['Año', anoDe(r)],
    ['Registros leídos', num(r.conteo_registros) == null ? null : miles(num(r.conteo_registros))],
    ['Filas válidas', num(r.filas_validas) == null ? null : miles(num(r.filas_validas))],
    ['Registros sin mes', num(r.sin_mes) == null ? null : miles(num(r.sin_mes))],
    ...Object.entries(filtrosDe(r)).map(([k, v]) => [FILTROS[k] ? FILTROS[k].nombre : k, etiquetaFiltro(k, v)]),
    ['Localidad', r.localidad],
    ['Solicitud', r.solicitud_id == null ? null : '#' + r.solicitud_id],
    ['Lanzado por', r.lanzado_por || '—'],
    ['Fecha', fecha(r.creada_en)],
    // Parámetros guardados como JSON (si el worker los usa), sin repetir lo ya mostrado.
    ...(r.parametros && typeof r.parametros === 'object'
      ? Object.entries(r.parametros).filter(([k]) => !['nodos', 'n', 'ano', 'filtros'].includes(k)).map(([k, v]) => [k, String(v)])
      : []),
  ].filter(([, v]) => v != null && v !== '');   // las columnas vacías no se muestran
  $('#detalleDatos').innerHTML = datos.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
  $('#detalleRes').textContent = r.resultado == null ? 'Sin resultado registrado.' : JSON.stringify(r.resultado, null, 2);
  $('#detalleSerie').innerHTML = tablaSerie(r.serie_mensual);
  dibujar(r);
}

// Tiempo promedio por modo (0 = serial, 1 = un nodo, 2 = dos nodos) del mismo método y del mismo n
// que la ejecución abierta (así se compara lo comparable). La barra del modo de esta ejecución va resaltada.
function dibujar(sel) {
  const m = METRICAS[$('#metrica').value] || METRICAS.total;
  const n = nDe(sel);
  $('#grafTitulo').textContent = `${m.nombre} promedio de ${nombreMetodo(sel.metodo)}${n != null ? ' con n = ' + miles(n) : ''}, según el modo`;
  const g = {};
  ejecuciones.filter(r => r.metodo === sel.metodo && nDe(r) === n && anoDe(r) === anoDe(sel) && claveFiltros(r) === claveFiltros(sel)).forEach(r => {
    const t = m.de(r);
    if (r.nodos != null && t != null) (g[r.nodos] ??= []).push(t);
  });
  const ns = Object.keys(g).sort((a, b) => a - b);
  const prom = ns.map(k => g[k].reduce((a, b) => a + b, 0) / g[k].length);
  if (grafica) grafica.destroy();
  grafica = new Chart($('#grafica'), {
    type: 'bar',
    data: { labels: ns.map(etiquetaModo), datasets: [{
      label: m.nombre + ' promedio (s)', data: prom,
      backgroundColor: ns.map(k => (k === String(sel.nodos) ? '#f2b600' : '#1b2a38')),
    }] },
    options: {
      responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, title: { display: true, text: 'Segundos' } } },
    },
  });
  // La base del speedup es el modo serial; si no hay, se usa 1 nodo.
  const base = ns.includes('0') ? '0' : ns.includes('1') ? '1' : null;
  const otros = ns.filter(k => base !== null && Number(k) > Number(base));
  const texto = !ns.length
    ? 'No hay tiempos de este tipo registrados para esta ejecución.'
    : base !== null && otros.length
      ? `Speedup del ${m.nombre.toLowerCase()} frente a ${base === '0' ? 'serial' : '1 nodo'}: ` + otros.map(k => `${etiquetaModo(k)} ${(prom[ns.indexOf(base)] / prom[ns.indexOf(k)]).toFixed(2)}×`).join(' · ')
      : 'El speedup aparece cuando hay ejecuciones serial (o de 1 nodo) y con más nodos para el mismo n.';
  $('#speedup').textContent = (ns.length ? 'Resaltado: el modo de esta ejecución. ' : '') + texto;
}