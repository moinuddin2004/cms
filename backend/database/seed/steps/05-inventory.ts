import { InventoryItem, ItemUnit } from 'src/inventory/entities/inventory-item.entity';
import { PurchaseOrder, PurchaseOrderStatus } from 'src/inventory/entities/purchase-order.entity';
import { StockMovementType } from 'src/inventory/entities/stock-movement.entity';
import { ConsumptionTemplateService } from 'src/inventory/services/consumption-template.service';
import { InventoryCategoryService } from 'src/inventory/services/inventory-category.service';
import { InventoryService } from 'src/inventory/services/inventory.service';
import { PatientConsumptionService } from 'src/inventory/services/patient-consumption.service';
import { PurchaseOrderService } from 'src/inventory/services/purchase-order.service';
import { SupplierService } from 'src/inventory/services/supplier.service';
import { realNow, travelTo } from '../lib/time-travel';
import {
  SeedClinic,
  SeedContext,
  SeedStaff,
  addDays,
  doctors,
  log,
  staffByRole,
} from '../lib/context';

/**
 * Inventory per clinic location, through the inventory services: categories,
 * suppliers, items (initial stock), purchase orders (one received, one
 * partly received, one open), fortnightly usage, a wastage and a stock-count
 * correction, consumption templates and a few patient consumptions (no
 * visit needed). A couple of items end at/below their reorder level and one
 * batch expires within 30 days, so the alerts have something to show.
 *
 * App bug worked around: every inventory controller passes `req.user.uuid`
 * as `createdBy` / `performedBy`, but those columns reference `employees(id)`
 * (schema 02_tables.sql: fk_stock_movements_performedBy,
 * fk_purchase_orders_createdBy, fk_patient_consumptions_performedBy). The
 * seed passes EMPLOYEE ids, which is what the schema wants.
 */

interface ItemDef {
  code: string;
  name: string;
  category: string;
  unit: ItemUnit;
  /** Cost per unit, rupees. */
  price: number;
  selling?: number;
  reorder: number;
  stock: number;
  /** Weekly usage range (non-patient use), units. */
  weekly?: [number, number];
  /** Ends at/below the reorder level (low-stock alert). */
  endLow?: boolean;
  /** Initial batch expires this many days after the seed's today (expiry alert). */
  expiresInDays?: number;
  supplier: number;
}

const DENTAL_CATEGORIES = 'default'; // InventoryCategoryService.seedDefaults (Disposables, Dental Materials, …)
const GENERAL_CATEGORIES = ['Disposables', 'Medicines', 'IV & Injectables', 'Dressings', 'Sterilization', 'Office Supplies'];

const DENTAL_SUPPLIERS = [
  { name: 'Karachi Dental Depot', contactPerson: 'Asif Lakhani', phone: '02132415566', city: 'Karachi', address: 'Saddar, Karachi' },
  { name: 'Al-Noor Surgical Traders', contactPerson: 'Haji Noor Muhammad', phone: '02132733410', city: 'Karachi', address: 'Denso Hall, Karachi' },
  { name: 'Punjab Dental Supplies', contactPerson: 'Waseem Akram', phone: '04237356620', city: 'Lahore', address: 'Hall Road, Lahore' },
];
const GENERAL_SUPPLIERS = [
  { name: 'Capital Pharma Distributors', contactPerson: 'Zubair Abbasi', phone: '0512261440', city: 'Islamabad', address: 'Blue Area, Islamabad' },
  { name: 'Rawal Surgical Co.', contactPerson: 'Tariq Kiani', phone: '0515530912', city: 'Rawalpindi', address: 'Raja Bazar, Rawalpindi' },
];

const DENTAL_ITEMS: ItemDef[] = [
  { code: 'GLV-M', name: 'Nitrile examination gloves (M)', category: 'Disposables', unit: ItemUnit.PAIRS, price: 15, reorder: 200, stock: 1000, weekly: [120, 180], supplier: 1 },
  { code: 'MASK', name: 'Surgical face mask 3-ply', category: 'Disposables', unit: ItemUnit.PIECES, price: 9, reorder: 100, stock: 500, weekly: [50, 80], supplier: 1 },
  { code: 'LIGNO', name: 'Lignocaine 2% + adrenaline cartridge', category: 'Medicines', unit: ItemUnit.CARTRIDGES, price: 65, reorder: 50, stock: 300, expiresInDays: 20, supplier: 0 },
  { code: 'COMP-A2', name: 'Composite resin A2 (4 g syringe)', category: 'Dental Materials', unit: ItemUnit.TUBES, price: 2800, reorder: 4, stock: 12, supplier: 0 },
  { code: 'COMP-A3', name: 'Composite resin A3 (4 g syringe)', category: 'Dental Materials', unit: ItemUnit.TUBES, price: 2800, reorder: 4, stock: 6, endLow: true, supplier: 0 },
  { code: 'GIC', name: 'GIC restorative (powder + liquid)', category: 'Dental Materials', unit: ItemUnit.PACKETS, price: 3500, reorder: 2, stock: 5, supplier: 0 },
  { code: 'BOND', name: 'Universal bonding agent 5 ml', category: 'Dental Materials', unit: ItemUnit.BOTTLES, price: 4200, reorder: 2, stock: 4, supplier: 0 },
  { code: 'ETCH', name: 'Etchant gel 37% (3 ml syringe)', category: 'Dental Materials', unit: ItemUnit.TUBES, price: 650, reorder: 4, stock: 12, supplier: 0 },
  { code: 'KFILE', name: 'K-files 21 mm #15–40 (pack of 6)', category: 'Instruments', unit: ItemUnit.PACKETS, price: 950, reorder: 8, stock: 30, supplier: 0 },
  { code: 'ROTARY', name: 'Rotary NiTi files (pack of 6)', category: 'Instruments', unit: ItemUnit.PACKETS, price: 5500, reorder: 3, stock: 8, endLow: true, supplier: 0 },
  { code: 'GP', name: 'Gutta-percha points (box of 120)', category: 'Dental Materials', unit: ItemUnit.BOXES, price: 900, reorder: 3, stock: 10, supplier: 0 },
  { code: 'PAPER', name: 'Paper points (box of 200)', category: 'Dental Materials', unit: ItemUnit.BOXES, price: 600, reorder: 3, stock: 8, supplier: 0 },
  { code: 'ALG', name: 'Alginate impression material 450 g', category: 'Dental Materials', unit: ItemUnit.PACKETS, price: 1300, reorder: 3, stock: 10, supplier: 2 },
  { code: 'PVS', name: 'Addition silicone putty + light body kit', category: 'Dental Materials', unit: ItemUnit.BOXES, price: 7800, reorder: 2, stock: 4, supplier: 2 },
  { code: 'SALIVA', name: 'Saliva ejector', category: 'Disposables', unit: ItemUnit.PIECES, price: 6, reorder: 100, stock: 600, weekly: [40, 70], supplier: 1 },
  { code: 'BIB', name: 'Dental bib (2-ply)', category: 'Disposables', unit: ItemUnit.PIECES, price: 7, reorder: 100, stock: 500, weekly: [30, 60], supplier: 1 },
  { code: 'COTTON', name: 'Cotton rolls', category: 'Disposables', unit: ItemUnit.PIECES, price: 1.5, reorder: 300, stock: 2000, weekly: [120, 200], supplier: 1 },
  { code: 'SYR-3', name: 'Disposable syringe 3 ml', category: 'Disposables', unit: ItemUnit.PIECES, price: 12, reorder: 50, stock: 300, supplier: 1 },
  { code: 'POUCH', name: 'Sterilization pouch 90×230 mm', category: 'Sterilization', unit: ItemUnit.PIECES, price: 8, reorder: 200, stock: 1000, weekly: [60, 100], supplier: 2 },
  { code: 'PROPHY', name: 'Prophy paste (single-dose cup)', category: 'Dental Materials', unit: ItemUnit.PIECES, price: 35, reorder: 30, stock: 150, supplier: 0 },
  { code: 'CHX', name: 'Chlorhexidine mouthwash 0.12% 250 ml', category: 'Medicines', unit: ItemUnit.BOTTLES, price: 320, selling: 450, reorder: 10, stock: 30, supplier: 2 },
  { code: 'MEFEN', name: 'Mefenamic acid 500 mg (strip of 10)', category: 'Medicines', unit: ItemUnit.PACKETS, price: 80, selling: 120, reorder: 20, stock: 60, supplier: 2 },
];

const GENERAL_ITEMS: ItemDef[] = [
  { code: 'SYR-5', name: 'Disposable syringe 5 ml', category: 'Disposables', unit: ItemUnit.PIECES, price: 14, reorder: 100, stock: 600, weekly: [60, 110], supplier: 1 },
  { code: 'CAN-22', name: 'IV cannula 22G', category: 'IV & Injectables', unit: ItemUnit.PIECES, price: 45, reorder: 30, stock: 150, supplier: 1 },
  { code: 'CAN-20', name: 'IV cannula 20G', category: 'IV & Injectables', unit: ItemUnit.PIECES, price: 45, reorder: 30, stock: 60, endLow: true, supplier: 1 },
  { code: 'INFSET', name: 'Infusion set', category: 'IV & Injectables', unit: ItemUnit.PIECES, price: 60, reorder: 30, stock: 120, supplier: 1 },
  { code: 'NS-1L', name: 'Normal saline 0.9% 1000 ml', category: 'IV & Injectables', unit: ItemUnit.BOTTLES, price: 180, selling: 300, reorder: 20, stock: 80, supplier: 0 },
  { code: 'RL-1L', name: "Ringer's lactate 1000 ml", category: 'IV & Injectables', unit: ItemUnit.BOTTLES, price: 190, selling: 320, reorder: 20, stock: 40, supplier: 0 },
  { code: 'PCM-IV', name: 'Paracetamol 1 g/100 ml IV infusion', category: 'Medicines', unit: ItemUnit.BOTTLES, price: 350, selling: 600, reorder: 10, stock: 40, supplier: 0 },
  { code: 'DICLO', name: 'Diclofenac sodium 75 mg/3 ml injection', category: 'Medicines', unit: ItemUnit.PIECES, price: 25, selling: 60, reorder: 30, stock: 120, expiresInDays: 25, supplier: 0 },
  { code: 'ORS', name: 'ORS sachet (low osmolarity)', category: 'Medicines', unit: ItemUnit.PACKETS, price: 18, selling: 30, reorder: 50, stock: 200, supplier: 0 },
  { code: 'GAUZE', name: 'Gauze swabs 10×10 cm (pack of 100)', category: 'Dressings', unit: ItemUnit.PACKETS, price: 400, reorder: 5, stock: 20, supplier: 1 },
  { code: 'CREPE', name: 'Crepe bandage 4"', category: 'Dressings', unit: ItemUnit.ROLLS, price: 120, reorder: 10, stock: 40, supplier: 1 },
  { code: 'TAPE', name: 'Micropore surgical tape 1"', category: 'Dressings', unit: ItemUnit.ROLLS, price: 95, reorder: 10, stock: 30, supplier: 1 },
  { code: 'GLV', name: 'Latex examination gloves', category: 'Disposables', unit: ItemUnit.PAIRS, price: 12, reorder: 200, stock: 1000, weekly: [100, 160], supplier: 1 },
  { code: 'MASK', name: 'Surgical face mask 3-ply', category: 'Disposables', unit: ItemUnit.PIECES, price: 9, reorder: 100, stock: 400, weekly: [40, 70], supplier: 1 },
  { code: 'ALC', name: 'Alcohol prep pad', category: 'Disposables', unit: ItemUnit.PIECES, price: 3, reorder: 200, stock: 1000, weekly: [80, 130], supplier: 1 },
  { code: 'STRIPS', name: 'Glucometer test strips (box of 50)', category: 'Disposables', unit: ItemUnit.BOXES, price: 1800, reorder: 3, stock: 6, endLow: true, supplier: 0 },
  { code: 'NEBMASK', name: 'Nebulizer mask kit (adult)', category: 'Disposables', unit: ItemUnit.PIECES, price: 150, selling: 250, reorder: 10, stock: 40, supplier: 1 },
  { code: 'SALB', name: 'Salbutamol respule 2.5 mg', category: 'Medicines', unit: ItemUnit.PIECES, price: 22, selling: 45, reorder: 50, stock: 200, supplier: 0 },
  { code: 'SUTURE', name: 'Silk suture 3-0 with needle', category: 'Dressings', unit: ItemUnit.PIECES, price: 140, reorder: 12, stock: 36, supplier: 1 },
  { code: 'PVI', name: 'Povidone-iodine 10% solution 450 ml', category: 'Sterilization', unit: ItemUnit.BOTTLES, price: 650, reorder: 4, stock: 10, supplier: 0 },
];

/** Templates: name, procedure, appointment type, [item code, qty]. */
const DENTAL_TEMPLATES: [string, string, string, [string, number][]][] = [
  ['Scaling kit', 'Scaling & Polishing', 'scaling', [['GLV-M', 2], ['MASK', 1], ['SALIVA', 1], ['BIB', 1], ['PROPHY', 1], ['COTTON', 4]]],
  ['Composite filling kit', 'Composite Filling', 'filling', [['GLV-M', 2], ['MASK', 1], ['BIB', 1], ['SALIVA', 1], ['COTTON', 6], ['LIGNO', 1], ['ETCH', 0.1], ['BOND', 0.05], ['COMP-A2', 0.25]]],
  ['Root canal visit kit', 'Root Canal', 'root_canal', [['GLV-M', 2], ['MASK', 1], ['BIB', 1], ['SALIVA', 1], ['LIGNO', 2], ['KFILE', 1], ['PAPER', 0.1], ['GP', 0.1], ['SYR-3', 1]]],
  ['Extraction kit', 'Simple Extraction', 'extraction', [['GLV-M', 2], ['MASK', 1], ['BIB', 1], ['LIGNO', 2], ['COTTON', 4]]],
];
const GENERAL_TEMPLATES: [string, string, string, [string, number][]][] = [
  ['IV drip set-up', 'IV Drip', 'drip', [['GLV', 1], ['ALC', 2], ['CAN-22', 1], ['INFSET', 1], ['NS-1L', 1], ['TAPE', 0.05]]],
  ['Nebulization', 'Nebulization', 'nebulization', [['GLV', 1], ['NEBMASK', 1], ['SALB', 1]]],
  ['Wound dressing', 'Wound Dressing', 'dressing', [['GLV', 2], ['GAUZE', 0.1], ['PVI', 0.05], ['CREPE', 1], ['TAPE', 0.05]]],
  ['IM injection', 'Injection (IM/IV) administration', 'injection', [['GLV', 1], ['ALC', 1], ['SYR-5', 1], ['DICLO', 1]]],
];

const CLINIC_PREFIX: Record<string, string> = { smilecare: 'SC', alshifa: 'AS', familycare: 'FC' };

/** UTC instant for a clinic day at hh:mm PKT (UTC+5). */
const pkt = (ymd: string, hh: number, mm = 0) =>
  new Date(`${ymd}T${String(hh - 5).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00Z`);

export async function seedInventory(ctx: SeedContext): Promise<void> {
  for (const clinic of ctx.clinics) {
    const counts = await seedClinicInventory(ctx, clinic);
    log(`${clinic.name}: inventory ${counts}`);
  }
}

async function seedClinicInventory(ctx: SeedContext, clinic: SeedClinic): Promise<string> {
  const dental = clinic.kind === 'dental';
  const start = addDays(ctx.today, -ctx.historyDays - 5);
  travelTo(pkt(start, 10));

  const manager = (staffByRole(clinic, 'admin')[0] ?? staffByRole(clinic, 'accountant')[0])!;

  // ── Categories + suppliers (org level) ──────────────────────────────
  const catSvc = ctx.app.get(InventoryCategoryService);
  if (dental && DENTAL_CATEGORIES === 'default') await catSvc.seedDefaults(clinic.orgId);
  else for (const [i, name] of GENERAL_CATEGORIES.entries()) await catSvc.create(clinic.orgId, { name, sortOrder: i });
  const categories = new Map((await catSvc.findAll(clinic.orgId)).map((c) => [c.name, c.id]));

  const supSvc = ctx.app.get(SupplierService);
  const suppliers: string[] = [];
  for (const s of dental ? DENTAL_SUPPLIERS : GENERAL_SUPPLIERS) {
    const domain = s.name.toLowerCase().replace(/[^a-z]+/g, '');
    suppliers.push((await supSvc.create(clinic.orgId, { ...s, email: `sales@${domain}.seed.test` } as any)).id);
  }

  // ── Items, POs and usage per location (branches stock a smaller set) ─
  let items = 0;
  let pos = 0;
  // Everything after the opening stock runs in date order across the
  // clinic's locations: each movement's previous/new stock follows the one
  // before it in time, and the PO number generator (latest row by
  // created_at, per organization) always sees the newest PO.
  const events: { at: Date; run: () => Promise<void> }[] = [];
  const on = (at: Date, run: () => Promise<void>) => events.push({ at, run });
  for (const [li, loc] of clinic.locations.entries()) {
    const main = li === 0;
    const storeKeeper = staffAt(clinic, loc.key, 'assistant') ?? manager;
    const defs = (dental ? DENTAL_ITEMS : GENERAL_ITEMS).filter((_, i) => main || i % 2 === 0);
    const sku = (code: string) => `${CLINIC_PREFIX[clinic.key] ?? 'XX'}-${loc.key.slice(0, 3).toUpperCase()}-${code}`;

    // 1. Items with their opening stock.
    travelTo(pkt(start, 11));
    const ids: Record<string, string> = {};
    for (const d of defs) {
      const item = await ctx.app.get(InventoryService).create(
        clinic.orgId,
        loc.id,
        {
          name: d.name,
          sku: sku(d.code),
          categoryId: categories.get(d.category),
          initialStock: main ? d.stock : Math.ceil(d.stock / 2),
          unit: d.unit,
          unitPrice: d.price,
          sellingPrice: d.selling,
          isBillable: !!d.selling,
          reorderLevel: main ? d.reorder : Math.ceil(d.reorder / 2),
          reorderQuantity: d.reorder * 2,
          maxStock: d.stock * 2,
          expiryDate: d.expiresInDays ? addDays(ctx.today, d.expiresInDays) : undefined,
          expiryAlertDays: 30,
        } as any,
        storeKeeper.employeeId,
      );
      ids[d.code] = item.id;
      items++;
    }

    const po = (lines: [string, number][]) =>
      lines.filter(([c]) => ids[c]).map(([c, qty]) => ({
        inventoryItemId: ids[c],
        orderedQuantity: qty,
        unitPrice: (dental ? DENTAL_ITEMS : GENERAL_ITEMS).find((d) => d.code === c)!.price,
      }));
    const supplierOf = (code: string) => suppliers[(dental ? DENTAL_ITEMS : GENERAL_ITEMS).find((d) => d.code === code)!.supplier];

    const purchase = (p: Omit<PoPlan, 'lines'> & { lines: [string, number][] }) => {
      const lines = po(p.lines);
      if (!lines.length) return;
      pos++;
      let poId = '';
      on(pkt(p.on, 11, 30), async () => {
        poId = await placePurchaseOrder(ctx, clinic, loc.id, manager, { ...p, lines });
      });
      if (p.receiveOn) on(pkt(p.receiveOn, 15), () => receivePurchaseOrder(ctx, clinic, loc.id, storeKeeper, poId, p));
    };

    // 2. A restock PO two weeks in, received in full three days later.
    purchase({
      supplierId: supplierOf(dental ? 'GLV-M' : 'GLV'),
      on: addDays(start, 14),
      receiveOn: addDays(start, 17),
      lines: dental
        ? [['GLV-M', 1000], ['MASK', 500], ['COTTON', 2000], ['SALIVA', 500], ['BIB', 500]]
        : [['GLV', 1000], ['MASK', 400], ['ALC', 1000], ['SYR-5', 500]],
      receive: 'all',
      notes: 'Monthly disposables restock',
    });

    // 3. Fortnightly usage of the fast movers (non-patient use).
    for (let day = addDays(start, 7); day < addDays(ctx.today, -1); day = addDays(day, 14)) {
      on(pkt(day, 20, 15), async () => {
        for (const d of defs.filter((x) => x.weekly)) {
          const want = 2 * ctx.rng.int(d.weekly![0], d.weekly![1]);
          await consume(ctx, clinic, loc.id, ids[d.code], main ? want : Math.ceil(want / 2), storeKeeper, 'Usage, last two weeks (chairside)');
        }
      });
    }

    if (main) {
      // 4. Medicines/materials PO: ordered 12 days ago, part delivered 8 days ago.
      const materials: [string, number][] = dental
        ? [['LIGNO', 200], ['COMP-A2', 6], ['ETCH', 10], ['KFILE', 20], ['GP', 6]]
        : [['NS-1L', 60], ['RL-1L', 40], ['PCM-IV', 30], ['DICLO', 100], ['ORS', 150]];
      purchase({
        supplierId: supplierOf(materials[0][0]),
        on: addDays(ctx.today, -12),
        receiveOn: addDays(ctx.today, -8),
        lines: materials,
        receive: 'partial',
        notes: 'Supplier short on some items — balance to follow',
      });

      // 5. Open PO for the items running low (placed 3 days ago, not delivered yet).
      const low = defs.filter((d) => d.endLow).map((d): [string, number] => [d.code, d.reorder * 2]);
      purchase({ supplierId: supplierOf(low[0][0]), on: addDays(ctx.today, -3), lines: low, receive: 'none', notes: 'Reorder — stock below reorder level' });

      // 6. Wastage (damaged) and a stock-count correction.
      const inv = ctx.app.get(InventoryService);
      on(pkt(addDays(ctx.today, -20), 18), async () => {
        await inv.adjustStock(ids[dental ? 'ALG' : 'NS-1L'], clinic.orgId, loc.id, {
          quantity: 2,
          movementType: StockMovementType.WASTAGE,
          notes: dental ? 'Packets got damp in storage — discarded' : 'Bottles leaking — discarded',
        } as any, storeKeeper.employeeId);
      });
      on(pkt(addDays(ctx.today, -15), 19), async () => {
        await inv.adjustStock(ids.MASK, clinic.orgId, loc.id, {
          quantity: -10,
          movementType: StockMovementType.MANUAL_ADJUSTMENT,
          notes: 'Monthly stock count: 10 short',
        } as any, manager.employeeId);
      });

      // 7. Consumption templates (org-wide, on the main location's items) and patient use.
      const templates = await seedTemplates(ctx, clinic, ids, dental);
      patientConsumptionEvents(ctx, clinic, loc.key, loc.id, templates, on);

      // 8. The "running low" items really are low today.
      on(pkt(addDays(ctx.today, -1), 20, 30), async () => {
        for (const d of defs.filter((x) => x.endLow)) {
          const item = await ctx.app.ds.getRepository(InventoryItem).findOneByOrFail({ id: ids[d.code] });
          const over = Number(item.currentStock) - Math.max(1, d.reorder - 1);
          if (over > 0) await consume(ctx, clinic, loc.id, ids[d.code], over, storeKeeper, 'Used in procedures this week');
        }
      });
    } else {
      // Branch: a draft PO waiting for the manager.
      purchase({
        supplierId: suppliers[1 % suppliers.length],
        on: addDays(ctx.today, -1),
        lines: dental ? [['GLV-M', 500], ['MASK', 300]] : [['GLV', 500]],
        receive: 'draft',
        notes: 'Branch top-up',
      });
    }

  }
  // At least a minute apart: two POs at the same instant would confuse the
  // PO number generator (it takes the org's latest by created_at).
  let prev = 0;
  for (const e of events.sort((a, b) => a.at.getTime() - b.at.getTime())) {
    const t = Math.max(e.at.getTime(), prev + 60_000);
    if (t > realNow().getTime() - 15 * 60_000) break; // short histories: nothing in the future
    prev = t;
    travelTo(new Date(t));
    await e.run();
  }
  return `${items} items, ${pos} purchase orders, ${suppliers.length} suppliers`;
}

// ─── Helpers ────────────────────────────────────────────────────────────

function staffAt(clinic: SeedClinic, locKey: string, role: 'assistant'): SeedStaff | undefined {
  return staffByRole(clinic, role, locKey)[0];
}

/** CONSUMPTION movement, never more than what is in stock. */
async function consume(
  ctx: SeedContext,
  clinic: SeedClinic,
  locationId: string,
  itemId: string,
  qty: number,
  by: SeedStaff,
  notes: string,
): Promise<void> {
  const item = await ctx.app.ds.getRepository(InventoryItem).findOneByOrFail({ id: itemId });
  const n = Math.min(qty, Math.floor(Number(item.currentStock)));
  if (n <= 0) return;
  await ctx.app.get(InventoryService).adjustStock(
    itemId,
    clinic.orgId,
    locationId,
    { quantity: n, movementType: StockMovementType.CONSUMPTION, notes } as any,
    by.employeeId,
  );
}

interface PoPlan {
  supplierId: string;
  on: string;
  receiveOn?: string;
  lines: { inventoryItemId: string; orderedQuantity: number; unitPrice: number }[];
  receive: 'all' | 'partial' | 'none' | 'draft';
  notes: string;
}

/** Manager creates the PO and, unless it stays a draft, marks it ordered. */
async function placePurchaseOrder(
  ctx: SeedContext,
  clinic: SeedClinic,
  locationId: string,
  manager: SeedStaff,
  p: PoPlan,
): Promise<string> {
  const svc = ctx.app.get(PurchaseOrderService);
  const created = await svc.create(
    clinic.orgId,
    locationId,
    {
      supplierId: p.supplierId,
      expectedDeliveryDate: addDays(p.on, 4),
      taxRate: 0,
      notes: p.notes,
      items: p.lines,
    },
    manager.employeeId,
  );
  // App bug workaround: `poNumber` is UNIQUE across ALL clinics (schema
  // 02_tables.sql:1608) but PurchaseOrderService.generatePoNumber
  // (purchase-order.service.ts:77) numbers per organization, so the second
  // clinic's first PO collides with PO-<year>-00001. Tag the number with the
  // clinic (the generator only reads the last "-" part, so numbering goes on).
  await ctx.app.ds.getRepository(PurchaseOrder).update(created.id, {
    poNumber: created.poNumber.replace(/^PO-(\d{4})-/, `PO-$1-${CLINIC_PREFIX[clinic.key] ?? 'XX'}-`),
  });
  if (p.receive !== 'draft') await svc.updateStatus(created.id, clinic.orgId, PurchaseOrderStatus.ORDERED);
  return created.id;
}

/** Goods arrive (store keeper): all lines, or partly (first in full, middle half, last none). */
async function receivePurchaseOrder(
  ctx: SeedContext,
  clinic: SeedClinic,
  locationId: string,
  storeKeeper: SeedStaff,
  poId: string,
  p: { receive: PoPlan['receive']; receiveOn?: string },
): Promise<void> {
  const svc = ctx.app.get(PurchaseOrderService);
  const po = await svc.findOne(poId, clinic.orgId);
  const batch = `B${p.receiveOn!.replace(/-/g, '').slice(2)}`;
  await svc.receiveItems(
    poId,
    clinic.orgId,
    locationId,
    {
      items: po.items.map((i, idx) => ({
        poItemId: i.id,
        // Partial: first line in full, the rest about half, the last not at all.
        receivedQuantity:
          p.receive === 'all' || idx === 0
            ? Number(i.orderedQuantity)
            : idx === po.items.length - 1
              ? 0
              : Math.floor(Number(i.orderedQuantity) / 2),
        batchNumber: batch,
        expiryDate: addDays(p.receiveOn!, 540),
      })),
    },
    storeKeeper.employeeId,
  );
}

async function seedTemplates(
  ctx: SeedContext,
  clinic: SeedClinic,
  ids: Record<string, string>,
  dental: boolean,
): Promise<{ id: string; lines: [string, number][] }[]> {
  const out: { id: string; lines: [string, number][] }[] = [];
  for (const [name, procedureName, appointmentType, lines] of dental ? DENTAL_TEMPLATES : GENERAL_TEMPLATES) {
    const usable = lines.filter(([c]) => ids[c]);
    const t = await ctx.app.get(ConsumptionTemplateService).create(clinic.orgId, {
      name,
      procedureName,
      appointmentType,
      items: usable.map(([c, quantity], i) => ({ inventoryItemId: ids[c], quantity, sortOrder: i })),
    });
    out.push({ id: t.id, lines: usable.map(([c, q]) => [ids[c], q]) });
  }
  return out;
}

/** A handful of recorded patient consumptions (template kits), no visit attached. */
function patientConsumptionEvents(
  ctx: SeedContext,
  clinic: SeedClinic,
  locKey: string,
  locationId: string,
  templates: { id: string; lines: [string, number][] }[],
  on: (at: Date, run: () => Promise<void>) => void,
): void {
  const docs = doctors(clinic, locKey);
  const patients = clinic.patients.filter((p) => p.locationKey === locKey);
  if (!docs.length || !patients.length || !templates.length) return;
  const n = 6;
  for (let i = 0; i < n; i++) {
    const day = addDays(ctx.today, -ctx.historyDays + 10 + Math.floor((i * (ctx.historyDays - 14)) / n));
    const registered = patients.filter((p) => p.registeredOn <= day);
    if (!registered.length) continue;
    const patient = ctx.rng.pick(registered);
    const doctor = docs[i % docs.length];
    const t = templates[i % templates.length];
    on(pkt(day, 13 + (i % 5), 20), async () => {
      await ctx.app.get(PatientConsumptionService).recordConsumption(
        clinic.orgId,
        locationId,
        {
          patientId: patient.id,
          templateId: t.id,
          items: t.lines.map(([inventoryItemId, quantity]) => ({ inventoryItemId, quantity, wasFromTemplate: true })),
          notes: 'Recorded from kit',
        },
        doctor.employeeId,
      );
    });
  }
}
