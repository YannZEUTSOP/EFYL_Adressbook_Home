// Survey types - mirror backend models exactly
export type Gender = 'male' | 'female';
export type Education = 'primary' | 'middle' | 'high_school' | 'university' | 'none';
export type IncomeLevel = 'very_low' | 'low' | 'medium' | 'high';
export type Utility = 'stable' | 'unstable' | 'none';
export type Toilets = 'flush' | 'traditional' | 'other';
export type KitchenPosition = 'room' | 'living_room' | 'separate';
export type WallMaterial = 'concrete' | 'adobe' | 'wood' | 'other';
export type RoofMaterial = 'metal' | 'wood' | 'plastic' | 'concrete' | 'other';

export type Person = {
  id?: string;
  name: string;
  phone_or_email: string;
  age: number;
  gender: Gender;
  education: Education;
  profession: string;
  frequented_place: string;
};

export type Commerce = {
  name: string;
  owner: string;
  phone: string;
  products: string;
  hours_weekdays: string;
  hours_saturday: string;
  hours_sunday: string;
};

export type SurveyType = 'household' | 'commerce';

export type HouseholdSurvey = {
  id?: string;
  address_id: string;
  owner_id?: string;
  survey_type: SurveyType;
  total_persons: number;
  main_income_source: string;
  other_income_sources: string;
  income_level: IncomeLevel;
  num_phones: number;
  has_internet: boolean;
  electricity: Utility;
  water: Utility;
  toilets: Toilets;
  toilets_other: string;
  kitchen_position: KitchenPosition;
  num_living_rooms: number;
  num_floors: number;
  wall_materials: WallMaterial;
  wall_materials_other: string;
  has_glass_windows: boolean;
  roof_materials: RoofMaterial;
  roof_materials_other: string;
  vehicles_bicycles: number;
  vehicles_motorcycles: number;
  vehicles_cars: number;
  vehicles_trucks: number;
  is_commerce: boolean;
  commerce: Commerce | null;
  persons: Person[];
  created_at?: string;
};

export const emptySurvey = (address_id: string, survey_type: SurveyType = 'household'): HouseholdSurvey => ({
  address_id,
  owner_id: 'guest',
  survey_type,
  total_persons: 1,
  main_income_source: '',
  other_income_sources: '',
  income_level: 'low',
  num_phones: 0,
  has_internet: false,
  electricity: 'none',
  water: 'none',
  toilets: 'traditional',
  toilets_other: '',
  kitchen_position: 'room',
  num_living_rooms: 1,
  num_floors: 1,
  wall_materials: 'concrete',
  wall_materials_other: '',
  has_glass_windows: false,
  roof_materials: 'metal',
  roof_materials_other: '',
  vehicles_bicycles: 0,
  vehicles_motorcycles: 0,
  vehicles_cars: 0,
  vehicles_trucks: 0,
  is_commerce: survey_type === 'commerce',
  commerce: survey_type === 'commerce' ? emptyCommerce() : null,
  persons: [],
});

export const emptyPerson = (): Person => ({
  name: '', phone_or_email: '', age: 0, gender: 'male',
  education: 'none', profession: '', frequented_place: '',
});

export const emptyCommerce = (): Commerce => ({
  name: '', owner: '', phone: '', products: '',
  hours_weekdays: '', hours_saturday: '', hours_sunday: '',
});
