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
export const COL_SOLICITANTE = null;
