/* Generated from intent backend 18756bf98d85fb3615e5166aa3f24d6f8ab158df. Do not edit. */

export type Latitude = number;
export type Longitude = number;
export type ForLocation = string | null;
export type DraftId = string;
export type Revision = number;
export type ExpiresAt = number;
export type Status = 'needs_clarification' | 'awaiting_confirmation' | 'confirmed' | 'rejected' | 'invalid';
export type ProductQuery = string | null;
export type Brand = string | null;
export type Category = string | null;
export type MaxBudget = string | null;
export type MinBudget = string | null;
export type Location = string | null;
export type Radius = string | null;
export type Warranty = string | null;
export type Installments = string | null;
export type ReturnWindow = string | null;
/**
 * @maxItems 5
 */
export type OtherPreferences =
  | []
  | [string]
  | [string, string]
  | [string, string, string]
  | [string, string, string, string]
  | [string, string, string, string, string];
export type Source = 'model_interpretation' | 'user_supplied';
export type Evidence = string;
export type RawText = string;
export type Value = string | null;
export type Currency = ('TOMAN' | 'IRR') | null;
export type Toman = number | null;
export type RequiresClarification = boolean;
export type Q = string | null;
export type MinPriceToman = number | null;
export type MaxPriceToman = number | null;
export type City = string | null;
export type Area = string | null;
export type MaxBudget1 = string | null;
export type PriceUnit = 'TOMAN' | 'IRR';
export type Latitude1 = number | null;
export type Longitude1 = number | null;
export type MaxDistanceKm = number | null;
export type PaymentMethods = [PaymentMethod, ...PaymentMethod[]] | null;
export type PaymentMethod = 'cash' | 'card' | 'installments';
export type WarrantyAvailable = boolean | null;
export type ReturnWindowDays = number | null;
export type ShoppingTime = string | null;
export type Field = string;
export type Code = 'missing' | 'ambiguous' | 'unsupported' | 'resolution_required' | 'irrelevant';
export type Question = string;
export type Issues = Issue[];
export type NextQuestion = string | null;
export type Label = string;
export type Value1 = string;
export type Summary = SummaryLine[];
export type Notices = string[];
export type SearchPerformed = false;
export type AccessToken = string;

export interface IntentContracts {
  Coordinates: Coordinates;
  CreatedIntent: CreatedIntent;
  IntentFields: IntentFields;
  IntentView: IntentView;
  Issue: Issue;
  Money: Money;
  PaymentMethod: PaymentMethod;
  PriceUnit: PriceUnit;
  Provenance: Provenance1;
  PurchaseConditions: PurchaseConditions;
  SearchCriteria: SearchCriteria;
  SummaryLine: SummaryLine;
}
export interface Coordinates {
  latitude: Latitude;
  longitude: Longitude;
  for_location?: ForLocation;
}
export interface CreatedIntent {
  draft: IntentView;
  access_token: AccessToken;
}
export interface IntentView {
  draft_id: DraftId;
  revision: Revision;
  expires_at: ExpiresAt;
  status: Status;
  fields: IntentFields;
  provenance: Provenance;
  max_budget: Money | null;
  min_budget: Money | null;
  criteria: SearchCriteria;
  issues: Issues;
  next_question: NextQuestion;
  summary: Summary;
  notices: Notices;
  search_performed?: SearchPerformed;
}
export interface IntentFields {
  product_query?: ProductQuery;
  brand?: Brand;
  category?: Category;
  max_budget?: MaxBudget;
  min_budget?: MinBudget;
  location?: Location;
  radius?: Radius;
  warranty?: Warranty;
  installments?: Installments;
  return_window?: ReturnWindow;
  other_preferences?: OtherPreferences;
  coordinates?: Coordinates | null;
}
export interface Provenance {
  [k: string]: Provenance1;
}
export interface Provenance1 {
  source: Source;
  evidence: Evidence;
}
export interface Money {
  raw_text: RawText;
  value: Value;
  currency: Currency;
  toman: Toman;
  requires_clarification: RequiresClarification;
}
export interface SearchCriteria {
  q?: Q;
  min_price_toman?: MinPriceToman;
  max_price_toman?: MaxPriceToman;
  city?: City;
  area?: Area;
  max_budget?: MaxBudget1;
  price_unit?: PriceUnit | null;
  latitude?: Latitude1;
  longitude?: Longitude1;
  max_distance_km?: MaxDistanceKm;
  preferred_purchase_conditions?: PurchaseConditions | null;
  shopping_time?: ShoppingTime;
}
export interface PurchaseConditions {
  payment_methods?: PaymentMethods;
  warranty_available?: WarrantyAvailable;
  return_window_days?: ReturnWindowDays;
}
export interface Issue {
  field: Field;
  code: Code;
  question: Question;
}
export interface SummaryLine {
  label: Label;
  value: Value1;
}
