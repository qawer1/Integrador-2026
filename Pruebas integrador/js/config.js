// Configuración pública de la página.
// Usa SOLO la llave "anon". Nunca pongas aquí la llave service_role.
export const CFG = {
  url: 'https://empqslgxynmqyqwfyjyn.supabase.co',
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtcHFzbGd4eW5tcXlxd2Z5anluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3MTYwMDEsImV4cCI6MjEwNDI5MjAwMX0.ztoQBurScuGeKBJruxmMjZ-cDLUJuzmOCKsBMzKun6M',
};

export const METODOS = {
  trapecio: 'Trapecio',
  simpson: 'Simpson 1/3',
  montecarlo: 'Monte Carlo',
  newton_raphson: 'Newton-Raphson',
};

export const ESTADOS = {
  pendiente: 'En fila',
  en_ejecucion: 'Ejecutando',
  terminada: 'Terminada',
  error: 'Con error',
  cancelada: 'Cancelada',
};

// Convención del campo "nodos": 0 = serial (sin MPI), 1 = un nodo de cómputo, 2 = dos nodos.
export const etiquetaModo = n => (Number(n) === 0 ? 'Serial' : Number(n) === 1 ? '1 nodo' : n + ' nodos');

// Límites de "n" (muestras o subintervalos). Cámbialos aquí; el tope real conviene
// reforzarlo también en la base de datos (CHECK en la tabla "solicitudes").
export const N_MIN = 1000;
export const N_MAX = 100000000;

// Nombre de la columna de "solicitudes" que guarda el id (uuid) de quien pidió la simulación.
// Si lo escribes (por ejemplo 'usuario_id'), cada persona podrá cancelar sus propias solicitudes
// en fila. Con null se mantiene lo de antes: solo el administrador cancela.
// (Además la política RLS de "solicitudes" debe permitir ese UPDATE al dueño.)
export const COL_SOLICITANTE = 'usuario_id';

// Rango de años que acepta el formulario (ajústalo a los años que tiene el dataset).
export const ANO_MIN = 2015;
export const ANO_MAX = 2026;

// Filtros opcionales de la simulación. La clave es la llave dentro de parametros.filtros (y de ejecuciones.filtros);
// cada opción es [valor que entiende el worker, texto que se ve]. Cambia aquí los valores si Nata usa otros.
export const FILTROS = {
  // Sexo: "Ambos" no se envía; se omite el filtro (por eso es la opción vacía).
  sexo: { nombre: 'Sexo', vacio: 'Ambos', opciones: [['Hombre', 'Hombre'], ['Mujer', 'Mujer']] },
  dia: { nombre: 'Día de la semana', opciones: [['lunes', 'Lunes'], ['martes', 'Martes'], ['miercoles', 'Miércoles'], ['jueves', 'Jueves'], ['viernes', 'Viernes'], ['sabado', 'Sábado'], ['domingo', 'Domingo']] },
  mes: { nombre: 'Mes', opciones: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'].map(m => [m, m[0].toUpperCase() + m.slice(1)]) },
  edad: { nombre: 'Edad (ciclo vital)', opciones: [['Primera Infancia', 'Primera Infancia (0 a 5)'], ['Infancia', 'Infancia (6 a 11)'], ['Adolescencia', 'Adolescencia (12 a 17)'], ['Juventud', 'Juventud (18 a 28)'], ['Adultez', 'Adultez (29 a 59)'], ['Adulto Mayor', 'Adulto Mayor (más de 60)']] },
  hora: { nombre: 'Hora', opciones: [['00:00 a 02:59', '00:00 a 02:59'], ['03:00 a 05:59', '03:00 a 05:59'], ['06:00 a 08:59', '06:00 a 08:59'], ['09:00 a 11:59', '09:00 a 11:59'], ['12:00 a 14:59', '12:00 a 14:59'], ['15:00 a 17:59', '15:00 a 17:59'], ['18:00 a 20:59', '18:00 a 20:59'], ['21:00 a 23:59', '21:00 a 23:59']] },
};
export const etiquetaFiltro = (k, v) => { const o = FILTROS[k] && FILTROS[k].opciones.find(([x]) => x === v); return o ? o[1] : String(v); };
