export interface Cliente {
  nombre: string;
  direccion: Direccion;
  celular: string;
  correo: string;
}
export interface Flujo {
  paso: string;
  subpaso?: string;
}
export interface UserSession {
  flujo: Flujo;
  destinatario?: Cliente;
  remitente?: Cliente;
  paquetes?: Paquete[];
  envios?: Envio[];
  cotizacion?: Cotizacion;
}
export interface Envio {
  remitente: Cliente;
  destinatario: Cliente;
  paquetes: Paquete[];
  tarifa: Tarifa;
  fechaEnvio: Date;
  fechaEntrega: Date;
  estado: string;
  _id: string;
  checkout_session_id: string;
  costo: number;
}
export interface Paquete {
  alto: number;
  ancho: number;
  largo: number;
  peso: number;
  costo: number;
}
export interface ZipCodeRange {
  zipcode_start: string;
  zipcode_end: string;
  group: string;
}
export interface EstadoZipCodeZone {
  [key: string]: ZipCodeRange[];
}
export interface Tarifa {
  sobres: Record<number, number>; // Zona -> Precio
  Paquetes: Record<number, Record<number, number>>; // Peso -> Zona -> Precio
  adicional: Record<number, number>; // Zona -> Precio adicional
}

export interface Direccion {
  calle: string;
  colonia: string;
  codigoPostal: string;
  ciudad: string;
  estado: string;
}

export interface formatoDatos {
  Remitente: Cliente;
  Destinatario: Cliente;
  Paquete: Paquete;
}

export interface Cotizacion {
  costo_fedex_8_30: number;
  costo_fedex_10_30: number;
  costo_fedex_dia_siguiente: number;
  costo_fedex_economico: number;
}
