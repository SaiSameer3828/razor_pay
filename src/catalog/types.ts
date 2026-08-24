export interface ProductVariant {
  id: string;
  sku: string;
  size?: string;
  color?: string;
  material?: string;
  priceInPaise: number; // Storing price in lowest currency unit (paise) avoids float errors
  originalPriceInPaise?: number;
  stock: number;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: 'apparel' | 'footwear' | 'accessories' | 'grooming';
  gender?: 'men' | 'women' | 'unisex';
  brand: string;
  tags: string[];
  variants: ProductVariant[];
  featuredImage: string;
  rating: number;
  reviewCount: number;
}
