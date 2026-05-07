export type Realtor = {
  id: string;
  name: string;
  slug: string;
  brokerage_name: string | null;
  email: string | null;
  phone: string | null;
  website_domain: string | null;
  logo_url: string | null;
  headshot_url: string | null;
  brand_color: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
};

export type RealtorDomain = {
  id: string;
  realtor_id: string;
  domain: string;
  domain_type: string | null;
  is_primary: boolean;
  created_at: string;
};

export type Listing = {
  id: string;
  realtor_id: string;
  slug: string;
  title: string | null;
  address: string | null;
  city: string | null;
  price: number | null;
  status: string | null;
  category: string | null;
  transaction_type: string | null;
  listing_type: string | null;
  featured: boolean | null;
  show_in_sold: boolean | null;
  sort_order: number | null;
  sold_sort_order: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  lot_size: string | null;
  property_type: string | null;
  mls_number: string | null;
  description: string | null;
  features: string[] | null;
  paragon_url: string | null;
  pdf_url: string | null;
  primary_image_url: string | null;
  created_at: string;
  updated_at: string;
};

export type ListingPhoto = {
  id: string;
  listing_id: string;
  image_url: string;
  sort_order: number | null;
  alt_text: string | null;
  created_at: string;
};
