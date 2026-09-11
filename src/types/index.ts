export interface UserProfile {
  id: string;
  email: string;
  name: string;
  createdAt?: string;
  role?: string;
  stores?: string[]; // IDs of stores this user is part of
  kyc?: {
    status?: string;
    provider?: string;
    currentSessionId?: string | null;
    verifiedAt?: any;
    declinedAt?: any;
    lastEventId?: string;
    updatedAt?: any;
  };
  kyc_status?: string;
  kyc_session_id?: string;
  kyc_session_created_at?: number;
  kyc_error?: string;
  verified?: boolean;
  verified_name?: string;
}

export interface Store {
  id: string;
  name: string;
  slug: string; // The URL slug (e.g. frontmk.com.br/loja/{slug})
  ownerId: string;
  createdAt: string;
  settings?: StoreSettings;
  customDomains?: string[];
}

export interface StoreSettings {
  currency: string;
  themeColor: string;
  theme?: string; // name of the selected theme
  logoUrl?: string;
  headerStyle?: string;
  footerStyle?: string;
  loadingStyle?: string;
  pdpStyle?: string;
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
  videoUrl?: string; // YouTube or direct video URL
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

export interface CustomerAddress {
  zipcode: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
}

export type Address = CustomerAddress;

export interface Customer {
  id: string;
  storeId: string;
  username: string;
  usernameLower: string;
  name: string;
  email?: string;
  cpf: string;
  phone: string;
  address?: CustomerAddress;
  totalOrders?: number;
  totalSpent?: number;
  createdAt: string;
  updatedAt?: string;
}
