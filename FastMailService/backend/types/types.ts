export interface Cliente {
  nombre: string;
  calle: string;
  codigoPostal: string;
  colonia: string;
  ciudad: string;
  estado: string;
  celular: string;
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
  ultimo_envio?: Envio;
  envios?: Envio[];
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
