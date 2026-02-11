export class SaleItem {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  price: number; // Para compatibilidade com frontend
  discount: number | null;
  total: number;
  createdAt: Date;
}

export class Sale {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  storeId: string;
  status: 'pending' | 'completed' | 'cancelled' | 'refunded';
  totalAmount: number;
  total: number; // Para compatibilidade com frontend
  discount: number | null;
  taxAmount: number | null;
  paymentMethod: 'credit_card' | 'debit_card' | 'cash' | 'pix' | 'transfer';
  documentType?: 'NON_FISCAL' | 'NFC_E' | 'SAT';
  documentNumber?: string | null;
  documentIssuedAt?: Date | null;
  isFiscal?: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  items: SaleItem[];
  userId: string;
}
