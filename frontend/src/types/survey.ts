// Survey types - mirror backend models exactly
// Choice fields use '' (or null for booleans) to mean "not answered yet" — no defaults.
export type Gender = 'male' | 'female';
export type Education = 'primary' | 'middle' | 'high_school' | 'university' | 'none';
export type IncomeLevel = 'very_low' | 'low' | 'medium' | 'high';
export type Utility = 'stable' | 'unstable' | 'none';
export type Toilets = 'flush' | 'traditional' | 'other';
export type KitchenPosition = 'room' | 'living_room' | 'separate';
export type WallMaterial = 'concrete' | 'adobe' | 'wood' | 'other';
export type RoofMaterial = 'metal' | 'wood' | 'plastic' | 'concrete' | 'other';
export type PublicCategory = 'school' | 'health' | 'government' | 'community' | 'water_point' | 'antenna' | 'religious' | 'other';
export type HeritageKind = 'sacred' | 'tourist' | 'both';
export type HeritageAccess = 'free' | 'paid' | 'permission';
export type RoadAccess = 'good' | 'average' | 'difficult';
export type PlaceCategory = 'shop' | 'work' | 'school' | 'leisure' | 'friend';
export type PlaceFrequency = 'daily' | 'weekly' | 'monthly' | 'rarely';

export type PersonPlace = {
  category: PlaceCategory | '';
  name: string;
  frequency: PlaceFrequency | '';
  reason: string;
};

export type Person = {
  id?: string;
  name: string;
  phone_or_email: string;
  age: number;
  gender: Gender | '';
  education: Education | '';
  profession: string;
  frequented_place: string;
  places: PersonPlace[];
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

export type SurveyType = 'household' | 'commerce' | 'public' | 'heritage';

export type PublicService = {
  name: string;
  category: PublicCategory | '';
  category_other: string;
  managing_org: string;
  phone: string;
  notes: string;
};

export type HeritageSite = {
  name: string;
  kind: HeritageKind | '';
  category: string;              // chiefdom|sacred_forest|worship|tomb|waterfall|cave|museum|monument|viewpoint|craft_market|other
  category_other: string;
  description: string;
  manager: string;
  access: HeritageAccess | '';
  entry_fee: string;
  hours: string;                 // "HH:MM-HH:MM" | "closed" | ""
  best_period: string;
  photos_allowed: boolean | null;
  restrictions: string;
  facilities: string;            // comma-separated: parking, toilets, guide, food, lodging
  road_access: RoadAccess | '';
  phone: string;
  notes: string;
};

export type HouseholdSurvey = {
  id?: string;
  address_id: string;
  owner_id?: string;
  survey_type: SurveyType;
  family_name: string;
  total_persons: number;
  main_income_source: string;
  other_income_sources: string;
  income_level: IncomeLevel | '';
  num_phones: number;
  has_internet: boolean | null;
  electricity: Utility | '';
  water: Utility | '';
  toilets: Toilets | '';
  toilets_other: string;
  kitchen_position: KitchenPosition | '';
  num_living_rooms: number;
  num_floors: number;
  wall_materials: WallMaterial | '';
  wall_materials_other: string;
  has_glass_windows: boolean | null;
  roof_materials: RoofMaterial | '';
  roof_materials_other: string;
  vehicles_bicycles: number;
  vehicles_motorcycles: number;
  vehicles_cars: number;
  vehicles_trucks: number;
  is_commerce: boolean;
  is_public: boolean;
  is_heritage: boolean;
  commerce: Commerce | null;
  public_service: PublicService | null;
  heritage: HeritageSite | null;
  persons: Person[];
  created_at?: string;
};

export const emptySurvey = (address_id: string, survey_type: SurveyType = 'household'): HouseholdSurvey => ({
  address_id,
  owner_id: 'guest',
  survey_type,
  family_name: '',
  total_persons: 1,
  main_income_source: '',
  other_income_sources: '',
  income_level: '',
  num_phones: 0,
  has_internet: null,
  electricity: '',
  water: '',
  toilets: '',
  toilets_other: '',
  kitchen_position: '',
  num_living_rooms: 1,
  num_floors: 1,
  wall_materials: '',
  wall_materials_other: '',
  has_glass_windows: null,
  roof_materials: '',
  roof_materials_other: '',
  vehicles_bicycles: 0,
  vehicles_motorcycles: 0,
  vehicles_cars: 0,
  vehicles_trucks: 0,
  is_commerce: survey_type === 'commerce',
  is_public: survey_type === 'public',
  is_heritage: survey_type === 'heritage',
  commerce: survey_type === 'commerce' ? emptyCommerce() : null,
  public_service: survey_type === 'public' ? emptyPublicService() : null,
  heritage: survey_type === 'heritage' ? emptyHeritage() : null,
  persons: [],
});

export const emptyPerson = (): Person => ({
  name: '', phone_or_email: '', age: 0, gender: '',
  education: '', profession: '', frequented_place: '', places: [],
});

export const emptyPlace = (): PersonPlace => ({
  category: '', name: '', frequency: '', reason: '',
});

export const emptyCommerce = (): Commerce => ({
  name: '', owner: '', phone: '', products: '',
  hours_weekdays: '', hours_saturday: '', hours_sunday: '',
});

export const emptyPublicService = (): PublicService => ({
  name: '', category: '', category_other: '', managing_org: '', phone: '', notes: '',
});

export const emptyHeritage = (): HeritageSite => ({
  name: '', kind: '', category: '', category_other: '', description: '', manager: '',
  access: '', entry_fee: '', hours: '', best_period: '', photos_allowed: null,
  restrictions: '', facilities: '', road_access: '', phone: '', notes: '',
});
