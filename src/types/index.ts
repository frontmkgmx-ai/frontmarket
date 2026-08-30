export interface UserProfile {
  id: string;
  email: string;
  name: string;
  createdAt?: string;
  role?: string;
  stores?: string[]; // IDs of stores this user is part of
}

export interface Store {
  id: string;
  name: string;
  slug: string; // The URL slug (e.g. frontmk.com.br/loja/{slug})
  ownerId: string;
  createdAt: string;
  settings?: StoreSettings;
}

export interface StoreSettings {
  currency: string;
  themeColor: string;
  logoUrl?: string;
  contactEmail?: string;
  supportPhone?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  active: boolean;
  order: number;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  price: number;
  promotionalPrice?: number;
  sku: string;
  categoryId: string;
  images: string[];
  stock: number;
  active: boolean;
  isDigital: boolean;
  weight?: number; // physical
  dimensions?: { length: number; width: number; height: number }; // physical
  digitalFileUrl?: string; // digital
  createdAt: string;
}

export interface Order {
  id: string;
  customerId: string;
  storeId: string;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  status: OrderStatus;
  shippingAddress?: Address;
  paymentMethod?: string;
  createdAt: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  sku: string;
}

export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';

export interface Address {
  zipcode: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
}
