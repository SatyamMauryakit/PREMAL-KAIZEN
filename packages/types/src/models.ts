// Core domain models

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'customer' | 'admin' | 'staff';
  createdAt: Date;
  updatedAt: Date;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  sku: string;
  price: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Order {
  id: string;
  userId: string;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  total: number;
  createdAt: Date;
  updatedAt: Date;
}
