export type MarketNotification = {
  id: string;
  kind: 'chat' | 'orders';
  title: string;
  body: string;
  target: { orderId?: string; conversationId?: string; listingId?: string };
  created_at: string;
  read_at: string | null;
};
export type NotificationPreferences = { chat: boolean; orders: boolean };
