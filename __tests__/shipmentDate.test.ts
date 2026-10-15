import { shipmentDate } from '../src/services/shipmentDate';
test('shipment date rejects future and invalid dates without changing the order', () => {
  const now = new Date('2026-10-11T12:50:00Z');
  expect(() => shipmentDate('2026-10-12', now)).toThrow('不能晚於今天');
  expect(() => shipmentDate('2026-02-30', now)).toThrow('有效寄件日期');
  expect(shipmentDate('2026-10-11', now)).toBe('2026-10-10T16:00:00.000Z');
});
