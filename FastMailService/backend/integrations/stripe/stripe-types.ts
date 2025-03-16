export interface Checkout_Session {
  id: string;
  object: string;
  adaptive_pricing: AdaptivePricing;
  after_expiration: any;
  allow_promotion_codes: boolean;
  amount_subtotal: number;
  amount_total: number;
  automatic_tax: AutomaticTax;
  billing_address_collection: string;
  cancel_url: string;
  client_reference_id: any;
  client_secret: any;
  collected_information: any;
  consent: any;
  consent_collection: ConsentCollection;
  created: number;
  currency: string;
  currency_conversion: any;
  custom_fields: any[];
  custom_text: CustomText;
  customer: any;
  customer_creation: string;
  customer_details: CustomerDetails;
  customer_email: any;
  discounts: any[];
  expires_at: number;
  invoice: any;
  invoice_creation: InvoiceCreation;
  livemode: boolean;
  locale: string;
  metadata: Metadata2;
  mode: string;
  payment_intent: string;
  payment_link: string;
  payment_method_collection: string;
  payment_method_configuration_details: PaymentMethodConfigurationDetails;
  payment_method_options: PaymentMethodOptions;
  payment_method_types: string[];
  payment_status: string;
  phone_number_collection: PhoneNumberCollection;
  recovered_from: any;
  saved_payment_method_options: any;
  setup_intent: any;
  shipping_address_collection: any;
  shipping_cost: any;
  shipping_details: any;
  shipping_options: any[];
  status: string;
  submit_type: string;
  subscription: any;
  success_url: string;
  total_details: TotalDetails;
  ui_mode: string;
  url: any;
}

export interface AdaptivePricing {
  enabled: boolean;
}

export interface AutomaticTax {
  enabled: boolean;
  liability: any;
  status: any;
}

export interface ConsentCollection {
  payment_method_reuse_agreement: any;
  promotions: string;
  terms_of_service: string;
}

export interface CustomText {
  after_submit: any;
  shipping_address: any;
  submit: any;
  terms_of_service_acceptance: any;
}

export interface CustomerDetails {
  address: Address;
  email: string;
  name: string;
  phone: string;
  tax_exempt: string;
  tax_ids: any[];
}

export interface Address {
  city: any;
  country: string;
  line1: any;
  line2: any;
  postal_code: any;
  state: any;
}

export interface InvoiceCreation {
  enabled: boolean;
  invoice_data: InvoiceData;
}

export interface Metadata {}

export interface Metadata2 {}

export interface InvoiceData {
  account_tax_ids: any;
  custom_fields: any;
  description: any;
  footer: any;
  issuer: any;
  metadata: Metadata;
  rendering_options: any;
}

export interface PaymentMethodConfigurationDetails {
  id: string;
  parent: any;
}

export interface PaymentMethodOptions {
  card: Card;
}

export interface Card {
  installments: Installments;
  request_three_d_secure: string;
}

export interface Installments {
  enabled: boolean;
}

export interface PhoneNumberCollection {
  enabled: boolean;
}

export interface TotalDetails {
  amount_discount: number;
  amount_shipping: number;
  amount_tax: number;
}

export interface BaseStripeResponse {
  object: string;
  data: any[];
  has_more: boolean;
  url: string;
}
