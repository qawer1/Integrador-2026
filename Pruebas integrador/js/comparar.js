// Comparación de métodos en el Historial: ranking con el tiempo de Trapecio, Simpson, Monte Carlo
// y Newton-Raphson, del más rápido al más lento. Solo compara ejecuciones del MISMO modo, del MISMO n
// y del MISMO rango de años (si no, no es comparable).
// El panel se crea desde aquí, debajo del título "Ejecuciones registradas"; no necesita cambios en index.html.
import { METODOS, etiquetaModo } from './config.js';
import { $, esc, anoDe, textoFiltros } from './util.js';

const num = v => (v == null || v === '' ? null : Number(v));
const nDe = r => num(r.n) ?? num(r.parametros && r.parametros.n);
const miles = v => v.toLocaleString('es-CO');
const seg = v => v.toLocaleString('es-CO', { maximumFractionDigits: v < 1 ? 4 : 3 });
// Rango de años que analizó la ejecución (columnas anos_desde / anos_hasta); si no hay, "Sin rango".
const anosDe = r => `${anoDe(r) ?? (r.anos_desde != null ? `${r.anos_desde}–${r.anos_hasta}` : 'Sin año')} · ${textoFiltros(r) || 'Sin filtros'}`;

// Qué tiempo se compara. Por defecto el cómputo: el total lo domina la lectura del dataset por NFS.
const METRICAS = {
  computo: { nombre: 'Tiempo de cómputo', de: r => num(r.tiempo_s) },
  total: { nombre: 'Tiempo total', de: r => num(r.tiempo_total_s) ?? num(r.tiempo_segundos) },
  lectura: { nombre: 'Tiempo de lectura de datos', de: r => num(r.tiempo_lectura_s) },
};

let datos = [];        // ejecuciones con método, modo y n conocidos
let grafica = null;
let montado = false;
let tocado = false;    // si la persona ya eligió modo o n, no se los cambiamos al refrescar

function montar() {
  const sec = document.createElement('section');
  sec.id = 'comparar';
  sec.innerHTML = `
    <h3>Comparación de métodos</h3>
    <div class="filtros">
      <div><label for="cmpModo">Modo</label><select id="cmpModo"></select></div>
      <div><label for="cmpN">n</label><select id="cmpN"></select></div>
      <div><label for="cmpAnos">Año y filtros</label><select id="cmpAnos"></select></div>
      <div><label for="cmpMetrica">Tiempo a comparar</label><select id="cmpMetrica">
        <option value="computo">Solo cómputo</option><option value="total">Total</option><option value="lectura">Lectura de datos</option></select></div>
    </div>
    <div class="grafica" id="cmpCaja"><canvas id="cmpGrafica" aria-label="Tiempo de ejecución por método numérico"></canvas></div>
    <p class="nota" id="cmpNota"></p>`;
  $('#listaEjec').querySelector('h2').after(sec);
  ['#cmpModo', '#cmpN', '#cmpAnos'].forEach(s => $(s).addEventListener('change', () => { tocado = true; dibujar(); }));
  $('#cmpMetrica').addEventListener('change', dibujar);
  montado = true;
}

// La combinación (modo, n, años) con más métodos distintos; si empatan, la más reciente.
function mejorCombinacion() {
  const c = {};
  datos.forEach(r => {
    const k = `${r.nodos}|${nDe(r)}|${anosDe(r)}`;
    const x = (c[k] ??= { modo: String(r.nodos), n: String(nDe(r)), anos: anosDe(r), metodos: new Set(), id: 0 });
    x.metodos.add(r.metodo);
    x.id = Math.max(x.id, Number(r.id) || 0);
  });
  return Object.values(c).sort((a, b) => b.metodos.size - a.metodos.size || b.id - a.id)[0] || null;
}

function llenarSelects() {
  const mejor = mejorCombinacion();
  const selModo = $('#cmpModo'), selN = $('#cmpN'), selAnos = $('#cmpAnos');
  const modos = [...new Set(datos.map(r => String(r.nodos)))].sort((a, b) => a - b);
  const ns = [...new Set(datos.map(r => String(nDe(r))))].sort((a, b) => a - b);
  const anosLista = [...new Set(datos.map(anosDe))].sort();
  const modoAntes = selModo.value, nAntes = selN.value, anosAntes = selAnos.value;
  selModo.innerHTML = modos.map(m => `<option value="${esc(m)}">${esc(etiquetaModo(m))}</option>`).join('');
  selN.innerHTML = ns.map(n => `<option value="${esc(n)}">${esc(miles(Number(n)))}</option>`).join('');
  selAnos.innerHTML = anosLista.map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join('');
  const modoOk = tocado && modos.includes(modoAntes), nOk = tocado && ns.includes(nAntes), anosOk = tocado && anosLista.includes(anosAntes);
  selModo.value = modoOk ? modoAntes : (mejor ? mejor.modo : '');
  selN.value = nOk ? nAntes : (mejor ? mejor.n : '');
  selAnos.value = anosOk ? anosAntes : (mejor ? mejor.anos : '');
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

// Barras finas en tonos del tema; la del método más rápido va resaltada con el color de acento.
function dibujar() {
  const m = METRICAS[$('#cmpMetrica').value] || METRICAS.computo;
  const modo = $('#cmpModo').value, n = Number($('#cmpN').value), anos = $('#cmpAnos').value;
  const g = {};
  datos.filter(r => String(r.nodos) === modo && nDe(r) === n && anosDe(r) === anos).forEach(r => {
    const t = m.de(r);
    if (t != null) (g[r.metodo] ??= []).push(t);
  });
  const claves = Object.keys(METODOS);
  const prom = claves.map(k => (g[k] ? g[k].reduce((a, b) => a + b, 0) / g[k].length : null));
  const hay = prom.some(v => v != null);

  $('#cmpCaja').hidden = !hay;
  if (!hay) {
    if (grafica) { grafica.destroy(); grafica = null; }
    $('#cmpNota').textContent = datos.length
      ? 'No hay tiempos de este tipo para ese modo, ese n y esos años.'
      : 'Aún no hay ejecuciones con n registrado para comparar.';
    return;
  }

  const minimo = Math.min(...prom.filter(v => v != null));
  const base = css('--primario'), acento = css('--senal');
  const tonos = [0.1, 0.3, 0.45, 0.6];
  const colores = prom.map((v, i) => (v === minimo ? acento : aclarar(base, tonos[i % tonos.length])));
  if (grafica) grafica.destroy();
  grafica = new Chart($('#cmpGrafica'), {
    type: 'bar',
    plugins: [valoresEnBarras],
    data: { labels: claves.map(k => METODOS[k]), datasets: [{ label: m.nombre + ' promedio (s)', data: prom, backgroundColor: colores, borderRadius: 8, maxBarThickness: 46, categoryPercentage: 0.6 }] },
    options: {
      responsive: true, maintainAspectRatio: false, layout: { padding: { top: 22 } },
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, title: { display: true, text: 'Segundos' }, grid: { color: css('--linea') } }, x: { grid: { display: false } } },
    },
  });

  const faltan = claves.filter((k, i) => prom[i] == null).map(k => METODOS[k]);
  const masRapido = claves[prom.indexOf(minimo)];
  $('#cmpNota').textContent =
    `${m.nombre} promedio, ${etiquetaModo(modo)}, n = ${miles(n)}, años ${anos}. Menor tiempo: ${METODOS[masRapido]} (barra resaltada).` +
    (faltan.length ? ` Falta ejecutar con este modo, este n y estos años: ${faltan.join(', ')}.` : '');
}

export function pintarComparacion(ejecuciones) {
  if (!$('#listaEjec')) return;
  if (!montado) montar();
  datos = ejecuciones.filter(r => r.metodo && r.nodos != null && nDe(r) != null);
  llenarSelects();
  dibujar();
}

// Si cambia el tema de color, se vuelve a dibujar la comparación con los colores nuevos.
document.addEventListener('tema', () => { if (montado) dibujar(); });