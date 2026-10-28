# Hand-back — Chapter 40 (Dental Lab, clinic side)

- File: `src/part5-modules/ch40-dental-lab.md`; 30 features: 26 Implemented, 4 Partial (service categories, cancel one item, send to lab, notifications), 0 Not implemented (four unemitted notification events are described inside the notifications feature).
- Figures: 19 total — 1 existing screenshot (`lab-order-detail.jpg`, former-name note included), 9 placeholders, 9 diagrams (3 ERDs: catalog, orders, production; 6 state diagrams: order, item, stage, shipment, remake, link).
- Diagrams rendered: all OK; wide LR state diagrams checked (readable); no render failures.
- Could not verify: runtime behaviour (no app run); that the item `reject` transition has no caller; item status of a reopened rejected order; which account type to create for lab staff; real notification delivery (dev-log provider only).
- Seeded workflow states are described as defaults; custom published workflow versions were not inspected (data-driven).
- Conflicts and security categories in `work/conflicts/ch40-dental-lab.md`.
