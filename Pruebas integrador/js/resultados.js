// Historial: lista de ejecuciones con filtro por método y detalle de cada una
// (datos, resultado y gráfica de tiempo por modo del método, con esa ejecución resaltada).
import { etiquetaModo } from './config.js';
import { $, esc, nombreMetodo, fecha, reportar } from './util.js';
import { estado } from './estado.js';

let ejecuciones = [];
let abierta = null; // id de la ejecución cuyo detalle está abierto
let grafica;

export async function cargarResultados() {
  const { data, error } = await estado.sb.from('ejecuciones').select('*').order('id', { ascending: false }).limit(200);
  reportar('el historial', error);
  if (!data) return;
  ejecuciones = data;
  pintarFiltro();
  pintarLista();
  if (abierta !== null) pintarDetalle();
}

export function conectarHistorial() {
  $('#filtro').addEventListener('change', pintarLista);
  $('#tabla').addEventListener('click', e => {
    const id = e.target.dataset.ver;
    if (!id) return;
    abierta = Number(id);
    pintarDetalle();
  });
  $('#detalleCerrar').addEventListener('click', cerrarDetalle);
  $('#exportar').addEventListener('click', exportarCSV);
}

const filtradas = () => { const f = $('#filtro').value; return f ? ejecuciones.filter(r => r.metodo === f) : ejecuciones; };

// Descarga las ejecuciones que se ven (según el filtro) como CSV que Excel abre bien.
// Si un texto empieza con = + - @ se le antepone ' para que Excel no lo trate como fórmula.
function celdaCSV(v) {
  let t = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(t)) t = "'" + t;
  return '"' + t.replace(/"/g, '""') + '"';
}
function exportarCSV() {
  const cab = ['id', 'metodo', 'modo', 'nodos', 'tiempo_segundos', 'lanzado_por', 'fecha', 'resultado'];
  const filas = filtradas().map(r => [r.id, nombreMetodo(r.metodo), r.nodos == null ? '' : etiquetaModo(r.nodos), r.nodos,
    r.tiempo_segundos, r.lanzado_por, r.creada_en, r.resultado]);
  const csv = [cab, ...filas].map(f => f.map(celdaCSV).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
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
}

function pintarLista() {
  const filas = filtradas();
  $('#vacio').hidden = filas.length > 0;
  $('#tabla').innerHTML = filas.map(r => `<tr><td class="num">${esc(r.id)}</td><td>${esc(nombreMetodo(r.metodo))}</td>
      <td>${r.nodos == null ? '—' : esc(etiquetaModo(r.nodos))}</td><td class="num">${esc(r.tiempo_segundos)}</td>
      <td>${esc(r.lanzado_por || '—')}</td><td>${fecha(r.creada_en)}</td>
      <td><button class="btn sec sm" data-ver="${esc(r.id)}">Ver detalle</button></td></tr>`).join('');
}

function pintarDetalle() {
  const r = ejecuciones.find(x => x.id === abierta);
  if (!r) return cerrarDetalle();
  $('#listaEjec').hidden = true;
  $('#detalle').hidden = false;
  $('#detalleTitulo').textContent = `Ejecución #${r.id} · ${nombreMetodo(r.metodo)}`;
  $('#detalleDatos').innerHTML = [
    ['Método', nombreMetodo(r.metodo)],
    ['Modo', r.nodos == null ? '—' : etiquetaModo(r.nodos)],
    ['Tiempo', r.tiempo_segundos == null ? '—' : r.tiempo_segundos + ' s'],
    ['Lanzado por', r.lanzado_por || '—'],
    ['Fecha', fecha(r.creada_en)],
    // Parámetros de la ejecución (n, etc.) si el worker los guarda en la columna "parametros".
    ...(r.parametros && typeof r.parametros === 'object'
      ? Object.entries(r.parametros).filter(([k]) => k !== 'nodos').map(([k, v]) => [k, typeof v === 'number' ? v.toLocaleString('es-CO') : v])
      : []),
  ].map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
  $('#detalleRes').textContent = r.resultado == null ? 'Sin resultado registrado.' : JSON.stringify(r.resultado, null, 2);
  dibujar(r);
}

// Tiempo promedio por modo (0 = serial, 1 = un nodo, 2 = dos nodos) del método de esta ejecución.
// La barra del modo de esta ejecución va resaltada.
function dibujar(sel) {
  const g = {};
  ejecuciones.filter(r => r.metodo === sel.metodo).forEach(r => {
    if (r.nodos != null && r.tiempo_segundos != null) (g[r.nodos] ??= []).push(Number(r.tiempo_segundos));
  });
  const ns = Object.keys(g).sort((a, b) => a - b);
  const prom = ns.map(n => g[n].reduce((a, b) => a + b, 0) / g[n].length);
  if (grafica) grafica.destroy();
  grafica = new Chart($('#grafica'), {
    type: 'bar',
    data: { labels: ns.map(etiquetaModo), datasets: [{
      label: 'Tiempo promedio (s)', data: prom,
      backgroundColor: ns.map(n => (n === String(sel.nodos) ? '#f2b600' : '#1b2a38')),
    }] },
    options: {
      responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, title: { display: true, text: 'Segundos' } } },
    },
  });
  // La base del speedup es el modo serial; si no hay, se usa 1 nodo.
  const base = ns.includes('0') ? '0' : ns.includes('1') ? '1' : null;
  const otros = ns.filter(n => base !== null && Number(n) > Number(base));
  const resalta = sel.nodos == null ? '' : 'Resaltado: el modo de esta ejecución. ';
  $('#speedup').textContent = resalta + (base !== null && otros.length
    ? `Speedup frente a ${base === '0' ? 'serial' : '1 nodo'}: ` + otros.map(n => `${etiquetaModo(n)} ${(prom[ns.indexOf(base)] / prom[ns.indexOf(n)]).toFixed(2)}×`).join(' · ')
    : 'El speedup aparece cuando hay ejecuciones serial (o de 1 nodo) y con más nodos.');
}
