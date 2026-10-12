// Punto de entrada: conecta los módulos y arranca la página.
import { $ } from './util.js';
import { crearCliente, sesionActual, conectarLogin, cargarPerfil } from './auth.js';
import { cargarCola, conectarCancelar } from './cola.js';
import { conectarFormulario } from './simulaciones.js';
import { conectarVistas } from './vistas.js';
import { puedeVer } from './estado.js';
import { cargarResultados, conectarHistorial } from './resultados.js';
import { cargarCasos, conectarAyuda } from './ayuda.js';
import { conectarChat } from './chatbot.js';

// Cada rol consulta solo lo de sus pestañas.
const refrescar = () => Promise.all([
  puedeVer('simular') && cargarCola(),
  puedeVer('historial') && cargarResultados(),
  puedeVer('ayuda') && cargarCasos(),
]);

async function entrar(user) {
  await cargarPerfil(user);
  conectarVistas();
  $('#login').hidden = true;
  $('#app').hidden = false;
  refrescar();
  setInterval(refrescar, 10000); // se actualiza sola cada 10 segundos
}

async function iniciar() {
  if (!crearCliente()) return;
  conectarLogin(entrar);
  conectarCancelar(refrescar);
  conectarFormulario(refrescar);
  conectarHistorial();
  conectarAyuda(refrescar);
  conectarChat(refrescar);
  const user = await sesionActual();
  if (user) entrar(user);
}

iniciar();
