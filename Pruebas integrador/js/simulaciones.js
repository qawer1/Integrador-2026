// Formulario para solicitar simulaciones.
import { N_MIN, N_MAX, ANO_MIN, ANO_MAX, FILTROS } from './config.js';
import { $, esc } from './util.js';
import { estado } from './estado.js';

const miles = n => n.toLocaleString('es-CO');

export function conectarFormulario(alEnviar) {
  $('#n').min = N_MIN;
  $('#n').max = N_MAX;
  $('#ano').min = ANO_MIN;
  $('#ano').max = ANO_MAX;
  $('#anoAyuda').textContent = `Obligatorio, entre ${ANO_MIN} y ${ANO_MAX}.`;
  $('#filtrosSim').innerHTML = Object.entries(FILTROS).map(([k, f]) =>
    `<label for="s_${k}">${esc(f.nombre)} (opcional)</label><select id="s_${k}"><option value="">${esc(f.vacio || 'Sin especificar')}</option>${f.opciones.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('')}</select>`).join('');
  $('#nAyuda').textContent = `Entre ${miles(N_MIN)} y ${miles(N_MAX)}.`;

  $('#formSim').addEventListener('submit', async e => {
    e.preventDefault();
    const msg = $('#simMsg');
    msg.className = 'msg';
    msg.textContent = '';
    const n = Number($('#n').value);
    if (!Number.isInteger(n) || n < N_MIN || n > N_MAX) {
      msg.textContent = `El valor de n debe ser un entero entre ${miles(N_MIN)} y ${miles(N_MAX)}.`;
      return;
    }
    const ano = Number($('#ano').value);
    if (!Number.isInteger(ano) || ano < ANO_MIN || ano > ANO_MAX) {
      msg.textContent = `El año es obligatorio y debe estar entre ${ANO_MIN} y ${ANO_MAX}.`;
      return;
    }
    const filtros = {}; // solo los filtros elegidos; sin ninguno queda {}
    Object.keys(FILTROS).forEach(k => { const v = $('#s_' + k).value; if (v) filtros[k] = v; });
    const boton = $('#btnSim');
    boton.disabled = true; // evita enviar dos veces la misma solicitud
    // nodos: 0 = serial, 1 = un nodo, 2 = dos nodos (ver js/config.js)
    const { error } = await estado.sb.from('solicitudes').insert({
      usuario_id: estado.user.id,
      metodo: $('#metodo').value,
      estado: 'pendiente',
      parametros: { nodos: Number($('#nodos').value), n, ano, filtros },
    });
    boton.disabled = false;
        if (error) {
      msg.textContent = error.message.includes('Límite')
        ? error.message
        : 'No se pudo enviar la solicitud. Verifica que tu rol permita simular.';
      return;
    }
    msg.className = 'msg ok';
    msg.textContent = 'Solicitud enviada. Quedó en la cola.';
    alEnviar();
  });
}
