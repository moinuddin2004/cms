// ─── Shared ─────────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export const ITEM_UNITS = [
  'pieces',
  'boxes',
  'pairs',
  'rolls',
  'bottles',
  'packets',
  'cartridges',
  'tubes',
  'ml',
  'gm',
  'kg',
  'liters',
] as const
export type ItemUnit = (typeof ITEM_UNITS)[number]

export type StockMovementType =
  | 'PURCHASE_IN'
  | 'MANUAL_ADJUSTMENT'
  | 'CONSUMPTION'
  | 'WASTAGE'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'RETURN_TO_SUPPLIER'
  | 'INITIAL_STOCK'

export const MANUAL_MOVEMENT_TYPES: StockMovementType[] = [
  'MANUAL_ADJUSTMENT',
  'WASTAGE',
  'RETURN_TO_SUPPLIER',
  'TRANSFER_IN',
  'TRANSFER_OUT',
]

export type PurchaseOrderStatus =
  | 'DRAFT'
  | 'ORDERED'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'CANCELLED'

// ─── Categories ─────────────────────────────────────────────────────
export interface InventoryCategory {
  id: string
  organizationId: string
  name: string
  description: string | null
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CategoryFormData {
  name: string
  description?: string
  sortOrder?: number
}

// ─── Items ──────────────────────────────────────────────────────────
export interface InventoryItem {
  id: string
  organizationId: string
  locationId: string
  categoryId: string | null
  category?: InventoryCategory | null
  name: string
  sku: string | null
  barcode: string | null
  description: string | null
  currentStock: number
  unit: ItemUnit
  unitPrice: number
  sellingPrice: number | null
  reorderLevel: number
  reorderQuantity: number
  maxStock: number | null
  expiryDate: string | null
  expiryAlertDays: number
  isBillable: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
  recentMovements?: StockMovement[]
}

export interface ItemFormData {
  name: string
  sku?: string
  barcode?: string
  description?: string
  categoryId?: string
  initialStock: number
  unit: ItemUnit
  unitPrice: number
  sellingPrice?: number
  reorderLevel?: number
  reorderQuantity?: number
  maxStock?: number
  expiryDate?: string
  expiryAlertDays?: number
  isBillable?: boolean
}

export interface ItemFilterParams {
  categoryId?: string
  lowStockOnly?: boolean
  expiringOnly?: boolean
  outOfStockOnly?: boolean
  search?: string
  page?: number
  limit?: number
}

export interface AdjustStockData {
  quantity: number
  movementType: StockMovementType
  batchNumber?: string
  expiryDate?: string
  notes?: string
}

export interface StockMovement {
  id: string
  inventoryItemId: string
  movementType: StockMovementType
  quantity: number
  previousStock: number
  newStock: number
  referenceType: string | null
  referenceId: string | null
  batchNumber: string | null
  expiryDate: string | null
  notes: string | null
  performedBy: string
  performer?: { id: string; firstName?: string; lastName?: string } | null
  createdAt: string
}

export interface InventoryStats {
  totalItems: number
  totalValue: number
  lowStockCount: number
  expiringCount: number
  outOfStockCount: number
}

// ─── Suppliers ──────────────────────────────────────────────────────
export interface Supplier {
  id: string
  organizationId: string
  name: string
  contactPerson: string | null
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
  website: string | null
  notes: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface SupplierFormData {
  name: string
  contactPerson?: string
  phone?: string
  email?: string
  address?: string
  city?: string
  website?: string
  notes?: string
}

// ─── Purchase Orders ────────────────────────────────────────────────
export interface PurchaseOrderItem {
  id: string
  purchaseOrderId: string
  inventoryItemId: string
  inventoryItem?: InventoryItem
  orderedQuantity: number
  receivedQuantity: number
  unitPrice: number
  totalPrice: number
  batchNumber: string | null
  expiryDate: string | null
  notes: string | null
  sortOrder: number
}

export interface PurchaseOrder {
  id: string
  poNumber: string
  organizationId: string
  locationId: string
  supplierId: string
  supplier?: Supplier
  createdBy: string
  creator?: { id: string; firstName?: string; lastName?: string }
  status: PurchaseOrderStatus
  subtotal: number
  taxRate: number
  taxAmount: number
  totalAmount: number
  orderDate: string | null
  expectedDeliveryDate: string | null
  receivedDate: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  items?: PurchaseOrderItem[]
  itemsCount?: number
}

export interface CreatePOItem {
  inventoryItemId: string
  orderedQuantity: number
  unitPrice: number
  notes?: string
}

export interface CreatePOData {
  supplierId: string
  expectedDeliveryDate?: string
  taxRate?: number
  notes?: string
  items: CreatePOItem[]
}

export interface ReceivePOItem {
  poItemId: string
  receivedQuantity: number
  batchNumber?: string
  expiryDate?: string
}

export interface POFilterParams {
  status?: PurchaseOrderStatus
  supplierId?: string
  page?: number
  limit?: number
}

// ─── Consumption Templates ──────────────────────────────────────────
export interface ConsumptionTemplateItem {
  id: string
  templateId: string
  inventoryItemId: string
  inventoryItem?: InventoryItem
  quantity: number
  notes: string | null
  sortOrder: number
}

export interface ConsumptionTemplate {
  id: string
  organizationId: string
  name: string
  procedureName: string
  appointmentType: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  items: ConsumptionTemplateItem[]
}

export interface TemplateItemFormData {
  inventoryItemId: string
  quantity: number
  notes?: string
  sortOrder?: number
}

export interface TemplateFormData {
  name: string
  procedureName: string
  appointmentType?: string
  items: TemplateItemFormData[]
}

// ─── Patient Consumption ────────────────────────────────────────────
export interface PatientConsumptionItem {
  id: string
  consumptionId: string
  inventoryItemId: string
  inventoryItem?: InventoryItem
  quantity: number
  unitPrice: number
  totalPrice: number
  wasFromTemplate: boolean
  sortOrder: number
}

export interface PatientConsumption {
  id: string
  organizationId: string
  locationId: string
  patientId: string
  appointmentId: string | null
  treatmentPlanId: string | null
  templateId: string | null
  template?: ConsumptionTemplate | null
  performedBy: string
  totalCost: number
  notes: string | null
  createdAt: string
  items: PatientConsumptionItem[]
}

export interface RecordConsumptionItem {
  inventoryItemId: string
  quantity: number
  wasFromTemplate: boolean
}

export interface RecordConsumptionData {
  patientId: string
  appointmentId?: string
  treatmentPlanId?: string
  templateId?: string
  items: RecordConsumptionItem[]
  notes?: string
}

export interface ConsumptionReport {
  mostConsumedItems: Array<{
    inventoryItemId: string
    name: string
    totalQuantity: number
    totalCost: number
  }>
  totalCost: number
  byDoctor: Array<{
    performedBy: string
    consumptionCount: number
    totalCost: number
  }>
  templateUsage: { fromTemplate: number; manual: number }
}
