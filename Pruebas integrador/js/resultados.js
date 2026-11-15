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
  a.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
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

// Seis columnas en vez de diez: n, año y filtros van como detalle bajo el método,
// y quién lo lanzó y cuándo van juntos.
function pintarLista() {
  const filas = filtradas();
  $('#vacio').hidden = filas.length > 0;
  $('#tabla').innerHTML = filas.map(r => {
    const f = textoFiltros(r);
    return `<tr><td class="num">${esc(r.id)}</td>
      <td><b>${esc(nombreMetodo(r.metodo))}</b><span class="sub">n = ${esc(miles(nDe(r)))} · ${esc(anoDe(r) ?? '—')}${f ? ' · ' + esc(f) : ''}</span></td>
      <td>${r.nodos == null ? '—' : `<span class="pill modo m${esc(r.nodos)}">${esc(etiquetaModo(r.nodos))}</span>`}</td>
      <td class="num"><b>${esc(seg(tiempoTotal(r)))}</b></td>
      <td>${esc(r.lanzado_por || '—')}<span class="sub">${fecha(r.creada_en)}</span></td>
      <td><button class="btn sec sm" data-ver="${esc(r.id)}">Ver detalle</button></td></tr>`;
  }).join('');
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
  const esNewton = r.metodo === 'newton_raphson';
  $('#bloqueNewton').hidden = !esNewton;
  $('#bloqueGen').hidden = esNewton;
  $('#bloqueRes').hidden = esNewton;
  $('#detalleDatos').hidden = esNewton;
  if (esNewton) {
    pintarNewton(r);
    $('#detalleSerie').innerHTML = tablaSerie(r.serie_mensual);
    pintarRendimiento(r, METRICAS.computo);   // Newton: tiempo del método
    return;
  }
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

// Los colores salen del tema elegido: se lee el color del CSS y se mezclan tonos claros a partir de él.
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const aclarar = (hex, t) => {   // t = 0 → el mismo color; t = 1 → blanco
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const n = parseInt(hex.slice(1), 16), m = c => Math.round(c + (255 - c) * t);
  return `rgb(${m(n >> 16)},${m((n >> 8) & 255)},${m(n & 255)})`;
};
// Escribe el valor (en segundos) encima de cada barra.
const valoresEnBarras = {
  id: 'valoresEnBarras',
  afterDatasetsDraw(ch) {
    const { ctx } = ch;
    ctx.save();
    ctx.font = '700 13px "Atkinson Hyperlegible", system-ui, sans-serif';
    ctx.fillStyle = css('--tinta');
    ctx.textAlign = 'center';
    ch.getDatasetMeta(0).data.forEach((b, i) => { const v = ch.data.datasets[0].data[i]; if (v != null) ctx.fillText(seg(v) + ' s', b.x, b.y - 7); });
    ctx.restore();
  },
};

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
  const base = css('--primario'), acento = css('--senal');
  if (grafica) grafica.destroy();
  grafica = new Chart($('#grafica'), {
    type: 'bar',
    plugins: [valoresEnBarras],
    data: { labels: ns.map(etiquetaModo), datasets: [{
      label: m.nombre + ' promedio (s)', data: prom,
      backgroundColor: ns.map(k => (k === String(sel.nodos) ? acento : aclarar(base, 0.3))),
      borderRadius: 8, maxBarThickness: 46, categoryPercentage: 0.6,
    }] },
    options: {
      responsive: true, maintainAspectRatio: false, layout: { padding: { top: 22 } },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${seg(c.parsed.y)} s (promedio de ${g[ns[c.dataIndex]].length} ejecuciones)` } } },
      scales: { y: { beginAtZero: true, title: { display: true, text: 'Segundos' }, grid: { color: css('--linea') } }, x: { grid: { display: false } } },
    },
  });
  // La base del speedup es el modo serial; si no hay, se usa 1 nodo.
  const bs = ns.includes('0') ? '0' : ns.includes('1') ? '1' : null;
  const otros = ns.filter(k => bs !== null && Number(k) > Number(bs));
  const nombreBase = bs === '0' ? 'serial' : '1 nodo';
  let html;
  if (!ns.length) html = '<p class="nota">No hay tiempos de este tipo registrados para esta ejecución.</p>';
  else if (bs !== null && otros.length) {
    html = '<div class="sp-fila">' + otros.map(k => {
      const x = prom[ns.indexOf(bs)] / prom[ns.indexOf(k)];
      return `<div class="sp ${x >= 1 ? 'bien' : 'mal'}"><b>${x.toFixed(2)}×</b><span>${esc(etiquetaModo(k))} frente a ${nombreBase}</span></div>`;
    }).join('') + '</div><p class="nota">Aceleración (speedup) del ' + esc(m.nombre.toLowerCase()) + '. Más de 1× significa que fue más rápido que ' + nombreBase + '. La barra resaltada es el modo de esta ejecución.</p>';
  } else html = '<p class="nota">La aceleración aparece cuando hay ejecuciones serial (o de 1 nodo) y con más nodos para el mismo n.</p>';
  $('#speedup').innerHTML = html;
  pintarRendimiento(sel, m);
}

// Si cambia el tema de color, se vuelve a dibujar la gráfica abierta con los colores nuevos.
document.addEventListener('tema', () => { const r = ejecuciones.find(x => x.id === abierta); if (r && r.metodo !== 'newton_raphson') dibujar(r); });

// ============ Rendimiento (todos los métodos) ============
// Speedup = T1 / Tp, con T1 el tiempo del modo serial. Eficiencia (%) = speedup / procesos MPI × 100.
// Solo compara ejecuciones del mismo método, n, año y filtros. Sin serial comparable no se calculan.
function pintarRendimiento(sel, m) {
  const caja = $('#rendimiento');
  const n = nDe(sel);
  const ctx = ejecuciones.filter(r => r.metodo === sel.metodo && nDe(r) === n && anoDe(r) === anoDe(sel) && claveFiltros(r) === claveFiltros(sel) && r.nodos != null);
  let metrica = m;
  if (!ctx.some(r => metrica.de(r) != null)) metrica = METRICAS.total;
  const g = {}, pr = {};
  ctx.forEach(r => { const t = metrica.de(r); if (t != null) { (g[r.nodos] ??= []).push(t); (pr[r.nodos] ??= []).push(num(r.procesos)); } });
  const ns = Object.keys(g).sort((a, b) => a - b);
  if (!ns.length) { caja.innerHTML = ''; return; }
  const prom = k => g[k].reduce((a, b) => a + b, 0) / g[k].length;
  const procs = k => { const v = pr[k].filter(x => x != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : (k === '0' ? 1 : null); };
  const T1 = g['0'] ? prom('0') : null;
  const filas = ns.map(k => {
    const tp = prom(k), P = procs(k), s = T1 != null && tp > 0 ? T1 / tp : null, e = s != null && P ? (s / P) * 100 : null;
    return `<tr class="${k === String(sel.nodos) ? 'rend-sel' : ''}"><td>${esc(etiquetaModo(k))}</td><td class="num">${esc(k)}</td><td class="num">${P ?? '—'}</td>
      <td class="num">${esc(seg(tp))}</td><td class="num">${s == null ? '—' : s.toFixed(2) + '×'}</td><td class="num">${e == null ? '—' : e.toFixed(1) + ' %'}</td></tr>`;
  }).join('');
  caja.innerHTML = `<h3>Rendimiento</h3><div class="scroll"><table><thead><tr><th>Modo</th><th>Nodos</th><th>Procesos</th><th>${esc(metrica.nombre)} (s)</th><th>Speedup</th><th>Eficiencia</th></tr></thead><tbody>${filas}</tbody></table></div>
    <p class="nota">Tiempo promedio por modo. Speedup = T1 / Tp (T1 es el tiempo serial). Eficiencia = speedup / procesos × 100. La fila resaltada es esta ejecución.${T1 == null ? ' No hay una ejecución serial comparable (mismo método, n, año y filtros), así que no se calculan el speedup ni la eficiencia.' : ''}</p>`;
}

// ============ Newton-Raphson: sección propia ============
const ABREV = MESES.map(x => x.slice(0, 3));
const fmt = (v, d = 2) => (v == null || Number.isNaN(Number(v)) ? '—' : Number(v).toLocaleString('es-CO', { maximumFractionDigits: d }));
const leer = v => { if (typeof v === 'string') { try { return JSON.parse(v); } catch { return null; } } return v; };

// "raices": lista de posiciones decimales (1 = inicio de enero ... 12 = inicio de diciembre); acepta números u objetos.
function listaRaices(v) {
  let a = leer(v);
  if (a && !Array.isArray(a)) a = Array.isArray(a.raices) ? a.raices : Object.values(a);
  if (!Array.isArray(a)) return [];
  return a.map(x => (x && typeof x === 'object' ? num(x.posicion ?? x.pos ?? x.x ?? x.raiz ?? x.valor) : num(x)))
    .filter(x => x != null && !Number.isNaN(x)).sort((p, q) => p - q);
}
// "serie_mensual": los 12 valores mensuales (lista de números, de objetos o un objeto {mes: valor}).
function valoresMensuales(s) {
  s = leer(s);
  if (Array.isArray(s)) return s.map(v => (v && typeof v === 'object' ? num(Object.values(v).filter(x => typeof x === 'number').pop()) : num(v)));
  if (s && typeof s === 'object') {
    const orden = k => (/^\d+$/.test(k) ? Number(k) : MESES.findIndex(x => x.toLowerCase() === k.toLowerCase()) + 1);
    return Object.entries(s).sort((p, q) => orden(p[0]) - orden(q[0])).map(([, v]) => num(v));
  }
  return [];
}

// Spline cúbica natural (segunda derivada 0 en los extremos) sobre x = 1..n, como "construir_spline" del programa.
function construirSpline(y) {
  const n = y.length, M = new Array(n).fill(0);
  if (n > 2) {
    const m = n - 2, b = new Array(m).fill(4), d = [];
    for (let i = 1; i < n - 1; i++) d.push(6 * (y[i + 1] - 2 * y[i] + y[i - 1]));
    for (let i = 1; i < m; i++) { const w = 1 / b[i - 1]; b[i] -= w; d[i] -= w * d[i - 1]; }
    M[m] = d[m - 1] / b[m - 1];
    for (let i = m - 2; i >= 0; i--) M[i + 1] = (d[i] - M[i + 2]) / b[i];
  }
  return x => {
    const i = Math.min(Math.max(Math.floor(x) - 1, 0), n - 2);   // tramo [i+1, i+2]
    const p = (i + 2) - x, q = x - (i + 1);
    return M[i] * p ** 3 / 6 + M[i + 1] * q ** 3 / 6 + (y[i] - M[i] / 6) * p + (y[i + 1] - M[i + 1] / 6) * q;
  };
}

// 3,0 = inicio de marzo; 3,2 = entre marzo y abril; 9,5 = entre septiembre y octubre.
function mesAprox(p) {
  if (p < 1) return 'antes de Enero';
  const k = Math.min(Math.floor(p), 12), f = p - k;
  if (f < 0.05) return `inicio de ${MESES[k - 1]}`;
  return k >= 12 ? 'finales de Diciembre' : `entre ${MESES[k - 1]} y ${MESES[k]}`;
}

// Gráfica en SVG: la spline, la línea del umbral y un marcador en cada raíz, ubicado evaluando la spline en esa misma x.
function svgSpline(ys, raices, U) {
  const n = ys.length;
  if (n < 3 || ys.some(v => v == null)) return '';
  const S = construirSpline(ys);
  const W = 760, H = 340, ml = 66, mr = 24, mt = 28, mb = 44;
  const xs = []; for (let x = 1; x < n; x += 0.05) xs.push(x); xs.push(n);
  const vs = xs.map(S);
  const todos = [...vs, ...ys, ...(U != null ? [U] : [])];
  let lo = Math.min(0, ...todos), hi = Math.max(...todos);
  const pad = (hi - lo) * 0.1 || 1; hi += pad; if (lo < 0) lo -= pad;
  const X = x => ml + ((x - 1) / (n - 1)) * (W - ml - mr), Y = v => H - mb - ((v - lo) / (hi - lo)) * (H - mt - mb);
  const ticks = [0, 1, 2, 3, 4].map(k => lo + ((hi - lo) * k) / 4);
  const cuadricula = ticks.map(t => `<line x1="${ml}" x2="${W - mr}" y1="${Y(t).toFixed(1)}" y2="${Y(t).toFixed(1)}" class="sp-grid"/><text x="${ml - 8}" y="${(Y(t) + 4).toFixed(1)}" text-anchor="end" class="sp-eje">${esc(fmt(t, t < 10 ? 1 : 0))}</text>`).join('');
  const meses = ys.map((_, i) => `<text x="${X(i + 1).toFixed(1)}" y="${H - 16}" text-anchor="middle" class="sp-eje">${esc(n === 12 ? ABREV[i] : String(i + 1))}</text>`).join('');
  const curva = 'M' + xs.map((x, i) => `${X(x).toFixed(1)},${Y(vs[i]).toFixed(1)}`).join(' L');
  const datos = ys.map((v, i) => `<circle cx="${X(i + 1).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="4" class="sp-dato"><title>${esc((n === 12 ? MESES[i] : 'Mes ' + (i + 1)) + ': ' + fmt(v, 2))}</title></circle>`).join('');
  const umbral = U == null ? '' : `<line x1="${ml}" x2="${W - mr}" y1="${Y(U).toFixed(1)}" y2="${Y(U).toFixed(1)}" class="sp-umbral"/><text x="${W - mr}" y="${(Y(U) - 7).toFixed(1)}" text-anchor="end" class="sp-umbral-txt">Umbral = ${esc(fmt(U, 4))}</text>`;
  const marcas = raices.filter(p => p >= 1 && p <= n).map((p, i) => `<circle cx="${X(p).toFixed(1)}" cy="${Y(S(p)).toFixed(1)}" r="7" class="sp-raiz"><title>Raíz ${i + 1}: posición ${esc(fmt(p, 4))}</title></circle><text x="${X(p).toFixed(1)}" y="${(Y(S(p)) - 12).toFixed(1)}" text-anchor="middle" class="sp-raiz-txt">R${i + 1}</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Curva spline mensual con la línea del umbral y las raíces encontradas">${cuadricula}${meses}${umbral}<path d="${curva}" class="sp-curva"/>${datos}${marcas}</svg>`;
}

function interpretacion(raices, ys, U) {
  if (U == null) return '';
  if (!raices.length) return `<p>No se encontraron puntos en los que la curva alcance el umbral de ${esc(fmt(U, 4))}.</p>`;
  const S = ys.length >= 3 && ys.every(v => v != null) ? construirSpline(ys) : null;
  const items = raices.map((p, i) => {
    const d = S ? S(Math.min(p + 0.02, ys.length)) - S(Math.max(p - 0.02, 1)) : 0;
    const sentido = !S ? 'la curva alcanza el umbral' : d > 0 ? 'la curva sube y pasa por encima del umbral' : d < 0 ? 'la curva baja y queda por debajo del umbral' : 'la curva toca el umbral';
    return `<li><b>Raíz ${i + 1}</b> (posición ${esc(fmt(p, 2))}, ${esc(mesAprox(p))}): ${sentido}.</li>`;
  }).join('');
  return `<p>La curva mensual (spline cúbica natural sobre los valores de cada mes) alcanza el umbral de ${esc(fmt(U, 4))} en ${raices.length} punto${raices.length > 1 ? 's' : ''}. Cada posición es un mes con decimales: 3,0 es el inicio de marzo y 3,5 queda a mitad entre marzo y abril.</p><ul class="interp">${items}</ul>`;
}

function pintarNewton(r) {
  const raices = listaRaices(r.raices), ys = valoresMensuales(r.serie_mensual), U = num(r.umbral);
  const sinRaices = r.raices == null;
  const t = v => (num(v) == null ? '—' : seg(num(v)) + ' s');
  const grupo = (titulo, items) => `<h3>${esc(titulo)}</h3><dl class="datos">${items.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
  let html = grupo('Parámetros de ejecución', [
    ['Año', anoDe(r) ?? '—'], ['Umbral', fmt(U, 4)], ['Puntos de partida (n)', miles(nDe(r))],
    ['Nodos', r.nodos ?? '—'], ['Modo', r.nodos == null ? '—' : etiquetaModo(r.nodos)], ['Procesos', r.procesos ?? '—'],
  ]);
  html += grupo('Resumen', [
    ['Raíces encontradas', sinRaices ? '—' : miles(raices.length)],
    ['Iteraciones (procesos MPI)', miles(num(r.iteraciones))],
    ['Resultado', '—'], ['Referencia', '—'], ['Error absoluto', '—'],
  ]);
  html += grupo('Tiempos', [['Del método', t(r.tiempo_s)], ['Lectura de datos', t(r.tiempo_lectura_s)], ['Total', t(tiempoTotal(r))]]);
  html += '<h3>Tabla de raíces</h3>' + (raices.length
    ? `<div class="scroll"><table><thead><tr><th>Raíz</th><th>Posición</th><th>Mes aproximado</th></tr></thead><tbody>${raices.map((p, i) => `<tr><td class="num">${i + 1}</td><td class="num">${esc(fmt(p, 4))}</td><td>${esc(mesAprox(p))}</td></tr>`).join('')}</tbody></table></div>`
    : `<p class="nota">${sinRaices ? 'Esta ejecución no tiene raíces registradas.' : 'No se encontraron raíces.'}</p>`);
  const svg = svgSpline(ys, raices, U);
  html += '<h3>Curva mensual y umbral</h3>' + (svg ? `<div class="splinebox">${svg}</div><p class="nota">Spline cúbica natural sobre los 12 valores mensuales (puntos). La línea punteada es el umbral y cada marcador numerado es una raíz, ubicado sobre la curva.</p>` : '<p class="nota">No hay serie mensual registrada para dibujar la curva.</p>');
  html += '<h3>Interpretación</h3>' + (interpretacion(raices, ys, U) || '<p class="nota">Sin umbral registrado.</p>');
  html += grupo('Registro', [['Lanzado por', r.lanzado_por || '—'], ['Fecha', fecha(r.creada_en)], ['Solicitud', r.solicitud_id == null ? '—' : '#' + r.solicitud_id]]);
  $('#bloqueNewton').innerHTML = html;
}