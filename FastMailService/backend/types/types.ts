import { CotizacionSigylmex } from "../integrations/sigylmex/sigylmex-types";

export interface Cliente {
  nombre: string;
  direccion: Direccion;
  celular: string;
  correo: string;
}

export interface Direccion {
  calle: string;
  colonia: string;
  codigoPostal: string;
  ciudad: string;
  estado: string;
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
  cotizacionSigylmex?: CotizacionSigylmex[]; // Agregado para cotizaciones de Sigylmex
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
  paqueteria: string;
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
  sobres?: Record<number, number>; // Zona -> Precio - Hacer opcional
  Paquetes?: Record<number, Record<number, number>>; // Peso -> Zona -> Precio - Hacer opcional
  adicional?: Record<number, number>; // Zona -> Precio adicional - Hacer opcional
  nombre?: string; // Agregado para nombre genérico de tarifa (ej: Sigylmex service name)
  costo?: number; // Agregado para costo genérico de tarifa (ej: Sigylmex total cost)
}

export interface Cotizacion {
  costo_fedex_8_30: number;
  costo_fedex_10_30: number;
  costo_fedex_dia_siguiente: number;
  costo_fedex_economico: number;
}

// Interfaz para las cotizaciones de Sigylmex basada en la respuesta de la API
