import api from '@/lib/api'
import type {
  InventoryCategory,
  CategoryFormData,
  InventoryItem,
  ItemFormData,
  ItemFilterParams,
  AdjustStockData,
  StockMovement,
  InventoryStats,
  PaginatedResponse,
  Supplier,
  SupplierFormData,
  PurchaseOrder,
  CreatePOData,
  ReceivePOItem,
  POFilterParams,
  PurchaseOrderStatus,
  ConsumptionTemplate,
  TemplateFormData,
  PatientConsumption,
  RecordConsumptionData,
  ConsumptionReport,
} from '../types'

// ─── Categories ─────────────────────────────────────────────────────
export async function fetchCategories(): Promise<InventoryCategory[]> {
  const { data } = await api.get('/inventory/categories')
  return data.data
}

export async function createCategory(
  payload: CategoryFormData,
): Promise<InventoryCategory> {
  const { data } = await api.post('/inventory/categories', payload)
  return data.data
}

export async function updateCategory(
  id: string,
  payload: Partial<CategoryFormData> & { isActive?: boolean },
): Promise<InventoryCategory> {
  const { data } = await api.patch(`/inventory/categories/${id}`, payload)
  return data.data
}

export async function deleteCategory(id: string): Promise<void> {
  await api.delete(`/inventory/categories/${id}`)
}

// ─── Items ──────────────────────────────────────────────────────────
export async function fetchItems(
  params: ItemFilterParams,
): Promise<PaginatedResponse<InventoryItem>> {
  const { data } = await api.get('/inventory/items', { params })
  return data.data
}

export async function fetchItem(id: string): Promise<InventoryItem> {
  const { data } = await api.get(`/inventory/items/${id}`)
  return data.data
}

export async function createItem(
  payload: ItemFormData,
): Promise<InventoryItem> {
  const { data } = await api.post('/inventory/items', payload)
  return data.data
}

export async function updateItem(
  id: string,
  payload: Partial<ItemFormData>,
): Promise<InventoryItem> {
  const { data } = await api.patch(`/inventory/items/${id}`, payload)
  return data.data
}

export async function deactivateItem(id: string): Promise<void> {
  await api.delete(`/inventory/items/${id}`)
}

export async function adjustStock(
  id: string,
  payload: AdjustStockData,
): Promise<StockMovement> {
  const { data } = await api.post(
    `/inventory/items/${id}/adjust-stock`,
    payload,
  )
  return data.data
}

export async function fetchStockMovements(
  id: string,
  page = 1,
  limit = 20,
): Promise<PaginatedResponse<StockMovement>> {
  const { data } = await api.get(`/inventory/items/${id}/movements`, {
    params: { page, limit },
  })
  return data.data
}

export async function fetchLowStockItems(): Promise<InventoryItem[]> {
  const { data } = await api.get('/inventory/items/low-stock')
  return data.data
}

export async function fetchExpiringItems(
  daysAhead?: number,
): Promise<InventoryItem[]> {
  const { data } = await api.get('/inventory/items/expiring', {
    params: daysAhead ? { daysAhead } : undefined,
  })
  return data.data
}

export async function fetchOutOfStockItems(): Promise<InventoryItem[]> {
  const { data } = await api.get('/inventory/items/out-of-stock')
  return data.data
}

export async function fetchInventoryStats(): Promise<InventoryStats> {
  const { data } = await api.get('/inventory/items/stats')
  return data.data
}

// ─── Suppliers ──────────────────────────────────────────────────────
export async function fetchSuppliers(): Promise<Supplier[]> {
  const { data } = await api.get('/suppliers')
  return data.data
}

export async function createSupplier(
  payload: SupplierFormData,
): Promise<Supplier> {
  const { data } = await api.post('/suppliers', payload)
  return data.data
}

export async function updateSupplier(
  id: string,
  payload: Partial<SupplierFormData>,
): Promise<Supplier> {
  const { data } = await api.patch(`/suppliers/${id}`, payload)
  return data.data
}

export async function deleteSupplier(id: string): Promise<void> {
  await api.delete(`/suppliers/${id}`)
}

// ─── Purchase Orders ────────────────────────────────────────────────
export async function fetchPurchaseOrders(
  params?: POFilterParams,
): Promise<PaginatedResponse<PurchaseOrder>> {
  const { data } = await api.get('/purchase-orders', { params })
  return data.data
}

export async function fetchPurchaseOrder(id: string): Promise<PurchaseOrder> {
  const { data } = await api.get(`/purchase-orders/${id}`)
  return data.data
}

export async function createPurchaseOrder(
  payload: CreatePOData,
): Promise<PurchaseOrder> {
  const { data } = await api.post('/purchase-orders', payload)
  return data.data
}

export async function updatePOStatus(
  id: string,
  status: PurchaseOrderStatus,
): Promise<PurchaseOrder> {
  const { data } = await api.patch(`/purchase-orders/${id}/status`, { status })
  return data.data
}

export async function receivePOItems(
  id: string,
  items: ReceivePOItem[],
): Promise<PurchaseOrder> {
  const { data } = await api.post(`/purchase-orders/${id}/receive`, { items })
  return data.data
}

export async function cancelPO(id: string): Promise<PurchaseOrder> {
  const { data } = await api.delete(`/purchase-orders/${id}`)
  return data.data
}

// ─── Consumption Templates ──────────────────────────────────────────
export async function fetchConsumptionTemplates(): Promise<
  ConsumptionTemplate[]
> {
  const { data } = await api.get('/consumption-templates')
  return data.data
}

export async function fetchTemplateByAppointmentType(
  type: string,
): Promise<ConsumptionTemplate | null> {
  const { data } = await api.get('/consumption-templates/by-type', {
    params: { appointmentType: type },
  })
  return data.data
}

export async function createConsumptionTemplate(
  payload: TemplateFormData,
): Promise<ConsumptionTemplate> {
  const { data } = await api.post('/consumption-templates', payload)
  return data.data
}

export async function updateConsumptionTemplate(
  id: string,
  payload: Partial<TemplateFormData>,
): Promise<ConsumptionTemplate> {
  const { data } = await api.patch(`/consumption-templates/${id}`, payload)
  return data.data
}

export async function deleteConsumptionTemplate(id: string): Promise<void> {
  await api.delete(`/consumption-templates/${id}`)
}

// ─── Patient Consumption ────────────────────────────────────────────
export async function recordConsumption(
  payload: RecordConsumptionData,
): Promise<PatientConsumption> {
  const { data } = await api.post('/patient-consumptions', payload)
  return data.data
}

export async function fetchConsumptionByAppointment(
  appointmentId: string,
): Promise<PatientConsumption | null> {
  const { data } = await api.get(
    `/patient-consumptions/appointment/${appointmentId}`,
  )
  return data.data
}

export async function fetchConsumptionByPatient(
  patientId: string,
  page = 1,
  limit = 20,
): Promise<PaginatedResponse<PatientConsumption>> {
  const { data } = await api.get(`/patient-consumptions/patient/${patientId}`, {
    params: { page, limit },
  })
  return data.data
}

export async function fetchConsumptionReport(
  dateFrom?: string,
  dateTo?: string,
): Promise<ConsumptionReport> {
  const { data } = await api.get('/patient-consumptions/report', {
    params: { dateFrom, dateTo },
  })
  return data.data
}
