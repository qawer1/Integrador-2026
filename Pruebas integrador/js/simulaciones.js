// Formulario para solicitar simulaciones.
import { N_MIN, N_MAX } from './config.js';
import { $ } from './util.js';
import { estado } from './estado.js';

const miles = n => n.toLocaleString('es-CO');

export function conectarFormulario(alEnviar) {
  $('#n').min = N_MIN;
  $('#n').max = N_MAX;
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
    const boton = $('#btnSim');
    boton.disabled = true; // evita enviar dos veces la misma solicitud
    // nodos: 0 = serial, 1 = un nodo, 2 = dos nodos (ver js/config.js)
    const { error } = await estado.sb.from('solicitudes').insert({
      metodo: $('#metodo').value,
      parametros: { nodos: Number($('#nodos').value), n },
    });
    boton.disabled = false;
    if (error) {
      msg.textContent = 'No se pudo enviar la solicitud. Verifica que tu rol permita simular.';
      return;
    }
    msg.className = 'msg ok';
    msg.textContent = 'Solicitud enviada. Quedó en la cola.';
    alEnviar();
  });
}
