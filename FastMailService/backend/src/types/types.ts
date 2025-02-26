export interface Person {
  nombre: string;
  calle: string;
  codigoPostal: string;
  colonia: string;
  ciudad: string;
  estado: string;
}

export interface Paquete {
  alto: number;
  ancho: number;
  largo: number;
  peso: number;
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
