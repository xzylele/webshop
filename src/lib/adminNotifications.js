import { supabaseAdmin } from './supabase';

const LOW_STOCK_THRESHOLD = 5;

export async function createAdminNotification({ type, title, message, link = null, metadata = {} }) {
  try {
    const { error } = await supabaseAdmin
      .from('admin_notifications')
      .insert([{ type, title, message, link, metadata }]);

    if (error) throw error;
  } catch (err) {
    console.error('Failed to create admin notification:', err);
  }
}

export async function notifyNewTicket({ ticketId, title, username }) {
  await createAdminNotification({
    type: 'new_ticket',
    title: 'ตั๋วช่วยเหลือใหม่',
    message: `${username} เปิดตั๋ว: ${title}`,
    link: `/admin?tab=tickets&ticket=${ticketId}`,
    metadata: { ticketId },
  });
}

export async function notifyTicketReply({ ticketId, title, username }) {
  await createAdminNotification({
    type: 'ticket_reply',
    title: 'มีข้อความตอบกลับใหม่',
    message: `${username} ตอบกลับในตั๋ว: ${title}`,
    link: `/admin?tab=tickets&ticket=${ticketId}`,
    metadata: { ticketId },
  });
}

export async function notifyTopup({ username, amount, method }) {
  await createAdminNotification({
    type: 'topup',
    title: 'มีรายการเติมเงินใหม่',
    message: `${username} เติมเงิน ${Number(amount).toLocaleString()} บาท ผ่าน ${method || 'PromptPay'}`,
    link: '/admin?tab=transactions',
    metadata: { amount, method },
  });
}

export async function notifyPurchase({ username, productName, amount, isCart = false }) {
  await createAdminNotification({
    type: 'purchase',
    title: isCart ? 'มีการชำระตะกร้าสินค้า' : 'มีการซื้อสินค้าใหม่',
    message: isCart
      ? `${username} ชำระตะกร้า ยอด ${Number(amount).toLocaleString()} บาท`
      : `${username} ซื้อ ${productName} ยอด ${Number(amount).toLocaleString()} บาท`,
    link: '/admin?tab=transactions',
    metadata: { productName, amount, isCart },
  });
}

export async function notifyLowStock({ productId, productName, stockLeft, stockType }) {
  await createAdminNotification({
    type: 'low_stock',
    title: 'สต็อกสินค้าใกล้หมด',
    message: `"${productName}" เหลือ ${stockLeft} ${stockType === 'code' ? 'โค้ด' : 'ชิ้น'}`,
    link: '/admin?tab=products',
    metadata: { productId, stockLeft, stockType },
  });
}

export async function checkAndNotifyLowStock(product, newStockOverride) {
  const threshold = LOW_STOCK_THRESHOLD;

  if (product.stock_type === 'manual') {
    const stockLeft = newStockOverride !== undefined
      ? newStockOverride
      : Number(product.stock);

    if (stockLeft <= threshold && stockLeft >= 0) {
      await notifyLowStock({
        productId: product.id,
        productName: product.name,
        stockLeft,
        stockType: 'manual',
      });
    }
    return;
  }

  if (product.stock_type === 'code') {
    const { count, error } = await supabaseAdmin
      .from('product_codes')
      .select('*', { count: 'exact', head: true })
      .eq('product_id', product.id)
      .eq('is_used', false);

    if (error) {
      console.error('Low stock check error:', error);
      return;
    }

    if (count !== null && count <= threshold) {
      await notifyLowStock({
        productId: product.id,
        productName: product.name,
        stockLeft: count,
        stockType: 'code',
      });
    }
  }
}
