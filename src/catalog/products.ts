import { Product } from './types.js';

export const CATALOG: Product[] = [
  {
    id: 'prod_oxford_shirt',
    name: 'Classic Oxford Cotton Shirt',
    slug: 'classic-oxford-cotton-shirt',
    description: 'Timeless tailored button-down shirt woven from 100% breathable organic Egyptian cotton. Perfect for formal meetings and smart-casual evenings.',
    category: 'apparel',
    gender: 'men',
    brand: 'Aura Threads',
    tags: ['formal', 'cotton', 'shirt', 'workwear', 'office', 'blue', 'white'],
    featuredImage: 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=600&auto=format&fit=crop',
    rating: 4.8,
    reviewCount: 142,
    variants: [
      { id: 'var_ox_wht_s', sku: 'OXF-WHT-S', color: 'Crisp White', size: 'S', priceInPaise: 189900, originalPriceInPaise: 249900, stock: 15 },
      { id: 'var_ox_wht_m', sku: 'OXF-WHT-M', color: 'Crisp White', size: 'M', priceInPaise: 189900, originalPriceInPaise: 249900, stock: 25 },
      { id: 'var_ox_wht_l', sku: 'OXF-WHT-L', color: 'Crisp White', size: 'L', priceInPaise: 189900, originalPriceInPaise: 249900, stock: 18 },
      { id: 'var_ox_blu_s', sku: 'OXF-BLU-S', color: 'Royal Oxford Blue', size: 'S', priceInPaise: 189900, originalPriceInPaise: 249900, stock: 12 },
      { id: 'var_ox_blu_m', sku: 'OXF-BLU-M', color: 'Royal Oxford Blue', size: 'M', priceInPaise: 189900, originalPriceInPaise: 249900, stock: 20 },
      { id: 'var_ox_blu_l', sku: 'OXF-BLU-L', color: 'Royal Oxford Blue', size: 'L', priceInPaise: 189900, originalPriceInPaise: 249900, stock: 10 }
    ]
  },
  {
    id: 'prod_slim_chinos',
    name: 'Stretch Comfort Slim Chinos',
    slug: 'stretch-comfort-slim-chinos',
    description: 'Versatile 4-way stretch twill chinos engineered for maximum mobility without losing shape. Wrinkle-resistant finish.',
    category: 'apparel',
    gender: 'men',
    brand: 'Aura Threads',
    tags: ['casual', 'pants', 'trousers', 'chinos', 'khaki', 'navy', 'workwear'],
    featuredImage: 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=600&auto=format&fit=crop',
    rating: 4.7,
    reviewCount: 98,
    variants: [
      { id: 'var_chn_nvy_30', sku: 'CHN-NVY-30', color: 'Midnight Navy', size: '30', priceInPaise: 219900, stock: 8 },
      { id: 'var_chn_nvy_32', sku: 'CHN-NVY-32', color: 'Midnight Navy', size: '32', priceInPaise: 219900, stock: 14 },
      { id: 'var_chn_nvy_34', sku: 'CHN-NVY-34', color: 'Midnight Navy', size: '34', priceInPaise: 219900, stock: 12 },
      { id: 'var_chn_khk_30', sku: 'CHN-KHK-30', color: 'Desert Khaki', size: '30', priceInPaise: 219900, stock: 10 },
      { id: 'var_chn_khk_32', sku: 'CHN-KHK-32', color: 'Desert Khaki', size: '32', priceInPaise: 219900, stock: 16 },
      { id: 'var_chn_khk_34', sku: 'CHN-KHK-34', color: 'Desert Khaki', size: '34', priceInPaise: 219900, stock: 6 }
    ]
  },
  {
    id: 'prod_linen_blazer',
    name: 'Italian Tailored Linen Blazer',
    slug: 'italian-tailored-linen-blazer',
    description: 'Lightweight, unconstructed Italian linen blazer. Breathable silhouette crafted for destination weddings and summer galas.',
    category: 'apparel',
    gender: 'men',
    brand: 'Vincenzo Milano',
    tags: ['blazer', 'suit', 'linen', 'formal', 'wedding', 'summer', 'navy', 'beige'],
    featuredImage: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=600&auto=format&fit=crop',
    rating: 4.9,
    reviewCount: 65,
    variants: [
      { id: 'var_blz_nvy_38', sku: 'BLZ-NVY-38', color: 'Navy Blue', size: '38 (S)', priceInPaise: 549900, originalPriceInPaise: 699900, stock: 5 },
      { id: 'var_blz_nvy_40', sku: 'BLZ-NVY-40', color: 'Navy Blue', size: '40 (M)', priceInPaise: 549900, originalPriceInPaise: 699900, stock: 7 },
      { id: 'var_blz_nvy_42', sku: 'BLZ-NVY-42', color: 'Navy Blue', size: '42 (L)', priceInPaise: 549900, originalPriceInPaise: 699900, stock: 4 },
      { id: 'var_blz_beg_40', sku: 'BLZ-BEG-40', color: 'Sand Beige', size: '40 (M)', priceInPaise: 549900, originalPriceInPaise: 699900, stock: 5 }
    ]
  },
  {
    id: 'prod_silk_tie',
    name: 'Pure Mulberry Silk Necktie',
    slug: 'pure-mulberry-silk-necktie',
    description: 'Handcrafted jacquard woven 100% mulberry silk necktie with a subtle micro-dot texture. The ultimate complement to formal shirts.',
    category: 'accessories',
    gender: 'unisex',
    brand: 'Vincenzo Milano',
    tags: ['tie', 'silk', 'formal', 'accessories', 'burgundy', 'navy'],
    featuredImage: 'https://images.unsplash.com/photo-1589756823695-278bc923f962?w=600&auto=format&fit=crop',
    rating: 4.9,
    reviewCount: 52,
    variants: [
      { id: 'var_tie_bur_onesize', sku: 'TIE-BUR-OS', color: 'Burgundy Wine', size: 'One Size', priceInPaise: 89900, stock: 25 },
      { id: 'var_tie_nvy_onesize', sku: 'TIE-NVY-OS', color: 'Midnight Navy', size: 'One Size', priceInPaise: 89900, stock: 20 }
    ]
  },
  {
    id: 'prod_leather_chelsea_boots',
    name: 'Handcrafted Full-Grain Leather Chelsea Boots',
    slug: 'handcrafted-leather-chelsea-boots',
    description: 'Premium calfskin leather with Goodyear welt construction, elastic side gussets, and cushioned ergonomic footbed.',
    category: 'footwear',
    gender: 'men',
    brand: 'Cobbler & Co.',
    tags: ['shoes', 'boots', 'chelsea', 'leather', 'brown', 'black', 'footwear'],
    featuredImage: 'https://images.unsplash.com/photo-1638247025967-b4e38f787b76?w=600&auto=format&fit=crop',
    rating: 4.8,
    reviewCount: 110,
    variants: [
      { id: 'var_bts_tan_8', sku: 'BTS-TAN-8', color: 'Cognac Tan', size: 'UK 8', priceInPaise: 429900, originalPriceInPaise: 549900, stock: 6 },
      { id: 'var_bts_tan_9', sku: 'BTS-TAN-9', color: 'Cognac Tan', size: 'UK 9', priceInPaise: 429900, originalPriceInPaise: 549900, stock: 9 },
      { id: 'var_bts_tan_10', sku: 'BTS-TAN-10', color: 'Cognac Tan', size: 'UK 10', priceInPaise: 429900, originalPriceInPaise: 549900, stock: 5 },
      { id: 'var_bts_blk_9', sku: 'BTS-BLK-9', color: 'Matte Black', size: 'UK 9', priceInPaise: 429900, originalPriceInPaise: 549900, stock: 8 }
    ]
  },
  {
    id: 'prod_heavyweight_tee',
    name: 'Heavyweight Minimalist Relaxed Tee',
    slug: 'heavyweight-minimalist-relaxed-tee',
    description: '260 GSM dense combed cotton with structured drop shoulders. Retains its fit wash after wash.',
    category: 'apparel',
    gender: 'unisex',
    brand: 'Urban Core',
    tags: ['tshirt', 'casual', 'streetwear', 'basics', 'black', 'olive', 'white'],
    featuredImage: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&auto=format&fit=crop',
    rating: 4.6,
    reviewCount: 230,
    variants: [
      { id: 'var_tee_blk_s', sku: 'TEE-BLK-S', color: 'Jet Black', size: 'S', priceInPaise: 99900, stock: 30 },
      { id: 'var_tee_blk_m', sku: 'TEE-BLK-M', color: 'Jet Black', size: 'M', priceInPaise: 99900, stock: 45 },
      { id: 'var_tee_blk_l', sku: 'TEE-BLK-L', color: 'Jet Black', size: 'L', priceInPaise: 99900, stock: 35 },
      { id: 'var_tee_olv_m', sku: 'TEE-OLV-M', color: 'Sage Olive', size: 'M', priceInPaise: 99900, stock: 20 },
      { id: 'var_tee_olv_l', sku: 'TEE-OLV-L', color: 'Sage Olive', size: 'L', priceInPaise: 99900, stock: 15 }
    ]
  },
  {
    id: 'prod_leather_belt',
    name: 'Full-Grain Italian Leather Dress Belt',
    slug: 'full-grain-italian-leather-dress-belt',
    description: 'Vegetable-tanned full-grain leather with a brushed nickel buckle. Reversible edge stitch for versatile styling.',
    category: 'accessories',
    gender: 'unisex',
    brand: 'Cobbler & Co.',
    tags: ['belt', 'leather', 'accessories', 'formal', 'brown', 'black'],
    featuredImage: 'https://images.unsplash.com/photo-1624222247344-550fb60583dc?w=600&auto=format&fit=crop',
    rating: 4.8,
    reviewCount: 77,
    variants: [
      { id: 'var_blt_brn_32', sku: 'BLT-BRN-32', color: 'Warm Brown', size: '32-34', priceInPaise: 129900, stock: 15 },
      { id: 'var_blt_brn_36', sku: 'BLT-BRN-36', color: 'Warm Brown', size: '36-38', priceInPaise: 129900, stock: 12 },
      { id: 'var_blt_blk_32', sku: 'BLT-BLK-32', color: 'Classic Black', size: '32-34', priceInPaise: 129900, stock: 18 }
    ]
  },
  {
    id: 'prod_chronograph_watch',
    name: 'Heritage Minimalist Chronograph Watch',
    slug: 'heritage-minimalist-chronograph-watch',
    description: 'Surgical grade 316L stainless steel case with sapphire crystal glass, Japanese quartz movement, and interchangeable leather strap.',
    category: 'accessories',
    gender: 'unisex',
    brand: 'Aethelgard Timepieces',
    tags: ['watch', 'chronograph', 'accessories', 'luxury', 'silver', 'black'],
    featuredImage: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop',
    rating: 4.9,
    reviewCount: 88,
    variants: [
      { id: 'var_wtc_slv_onesize', sku: 'WTC-SLV-OS', color: 'Silver / White Dial', size: '40mm', priceInPaise: 699900, originalPriceInPaise: 899900, stock: 7 },
      { id: 'var_wtc_blk_onesize', sku: 'WTC-BLK-OS', color: 'All Black Stealth', size: '40mm', priceInPaise: 749900, originalPriceInPaise: 949900, stock: 5 }
    ]
  },
  {
    id: 'prod_canvas_duffle',
    name: 'Waxed Canvas Weekender Duffle Bag',
    slug: 'waxed-canvas-weekender-duffle-bag',
    description: 'Water-resistant 18oz waxed cotton canvas with heavy brass hardware and dedicated ventilated shoe compartment.',
    category: 'accessories',
    gender: 'unisex',
    brand: 'Cobbler & Co.',
    tags: ['bag', 'duffle', 'travel', 'canvas', 'leather', 'weekend', 'olive'],
    featuredImage: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&auto=format&fit=crop',
    rating: 4.9,
    reviewCount: 104,
    variants: [
      { id: 'var_dfl_olv_40l', sku: 'DFL-OLV-40L', color: 'Military Olive', size: '40L', priceInPaise: 379900, originalPriceInPaise: 499900, stock: 10 },
      { id: 'var_dfl_khk_40l', sku: 'DFL-KHK-40L', color: 'Field Khaki', size: '40L', priceInPaise: 379900, originalPriceInPaise: 499900, stock: 8 }
    ]
  },
  {
    id: 'prod_merino_wool_sweater',
    name: 'Fine Merino Wool Crewneck Sweater',
    slug: 'fine-merino-wool-crewneck-sweater',
    description: 'Spun from extra-fine 19.5-micron Australian merino wool. Exceptionally soft, lightweight, and thermo-regulating.',
    category: 'apparel',
    gender: 'unisex',
    brand: 'Aura Threads',
    tags: ['sweater', 'wool', 'winter', 'knitwear', 'charcoal', 'navy'],
    featuredImage: 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=600&auto=format&fit=crop',
    rating: 4.7,
    reviewCount: 63,
    variants: [
      { id: 'var_swt_chr_m', sku: 'SWT-CHR-M', color: 'Charcoal Grey', size: 'M', priceInPaise: 299900, stock: 12 },
      { id: 'var_swt_chr_l', sku: 'SWT-CHR-L', color: 'Charcoal Grey', size: 'L', priceInPaise: 299900, stock: 10 },
      { id: 'var_swt_nvy_m', sku: 'SWT-NVY-M', color: 'Deep Navy', size: 'M', priceInPaise: 299900, stock: 14 },
      { id: 'var_swt_nvy_l', sku: 'SWT-NVY-L', color: 'Deep Navy', size: 'L', priceInPaise: 299900, stock: 8 }
    ]
  }
];

export function getProductById(productId: string): Product | undefined {
  return CATALOG.find(p => p.id === productId);
}

export function getVariantById(productId: string, variantId: string): ProductVariant | undefined {
  const product = getProductById(productId);
  if (!product) return undefined;
  return product.variants.find(v => v.id === variantId);
}

export function searchProducts(query: string, options?: { category?: string; maxPriceInPaise?: number; tag?: string }): Product[] {
  const q = query.toLowerCase().trim();
  return CATALOG.filter(product => {
    // Text match
    const matchesText = !q ||
      product.name.toLowerCase().includes(q) ||
      product.description.toLowerCase().includes(q) ||
      product.brand.toLowerCase().includes(q) ||
      product.tags.some(tag => tag.toLowerCase().includes(q)) ||
      product.variants.some(v => (v.color && v.color.toLowerCase().includes(q)) || (v.size && v.size.toLowerCase().includes(q)));

    if (!matchesText) return false;

    // Category filter
    if (options?.category && product.category !== options.category) {
      return false;
    }

    // Tag filter
    if (options?.tag && !product.tags.includes(options.tag.toLowerCase())) {
      return false;
    }

    // Max price filter (checks if at least one variant is within budget)
    if (options?.maxPriceInPaise !== undefined) {
      const hasAffordableVariant = product.variants.some(v => v.priceInPaise <= options.maxPriceInPaise!);
      if (!hasAffordableVariant) return false;
    }

    return true;
  });
}
