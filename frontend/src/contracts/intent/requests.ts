/* Generated from intent backend 18756bf98d85fb3615e5166aa3f24d6f8ab158df. Do not edit. */

export type ExpectedRevision = number;
export type Confirm = true;
export type Latitude = number;
export type Longitude = number;
export type ForLocation = string | null;
export type Message = string;
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
export type ExpectedRevision1 = number;
export type Message1 = string | null;
export type ExpectedRevision2 = number;

export interface IntentContracts {
  ConfirmIntent: ConfirmIntent;
  Coordinates: Coordinates;
  CreateIntent: CreateIntent;
  IntentPatch: IntentPatch;
  ReviseIntent: ReviseIntent;
  VersionRequest: VersionRequest;
}
export interface ConfirmIntent {
  expected_revision: ExpectedRevision;
  confirm: Confirm;
}
export interface Coordinates {
  latitude: Latitude;
  longitude: Longitude;
  for_location?: ForLocation;
}
export interface CreateIntent {
  message: Message;
}
/**
 * Only model_fields_set entries change; explicit null clears a value.
 */
export interface IntentPatch {
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
export interface ReviseIntent {
  expected_revision: ExpectedRevision1;
  message?: Message1;
  changes?: IntentPatch | null;
}
export interface VersionRequest {
  expected_revision: ExpectedRevision2;
}
