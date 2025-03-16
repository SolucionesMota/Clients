export interface Address {
  cp: string; // (obligatorio)
  ciudad: string; // (obligatorio)
  estado: string; // (obligatorio)
  colonia: string; // (obligatorio)
  nombre: string; // (obligatorio)
  email: string; // (obligatorio)
  telefono: string; // (obligatorio)
  empresa: string; // (obligatorio)
  rfc?: string; // (opcional)
  calle: string; // (obligatorio)
  numero: string; // (obligatorio)
  referencia: string; // (obligatorio no mayor a 25 caracteres)
  alias: string; // (obligatorio)
}

export interface envioSigylmex {
  origen: string; // (obligatorio)
  destino: string; // (obligatorio)
  peso: string; // (obligatorio)
  largo: string; // (obligatorio)
  alto: string; // (obligatorio)
  ancho: string; // (obligatorio)
}

export interface CotizacionSigylmex {
  id: string;
  servicio: string;
  total: number;
}
