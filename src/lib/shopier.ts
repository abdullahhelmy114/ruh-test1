interface CreatePaymentLinkParams {
  liveCourseId?: string;
  bundleId?: string;
  planId?: string;
  title: string;
  price: number;
  type: 'course' | 'bundle' | 'subscription';
}

export async function createShopierPaymentLink(params: CreatePaymentLinkParams): Promise<string> {
  const pat = process.env.SHOPIER_PAT;
  if (!pat) throw new Error('SHOPIER_PAT is not set');

  // بناء order_id فريد
  let orderId = '';
  if (params.type === 'course' && params.liveCourseId) {
    orderId = `course_${params.liveCourseId}`;
  } else if (params.type === 'bundle' && params.bundleId) {
    orderId = `bundle_${params.bundleId}`;
  } else if (params.type === 'subscription' && params.planId) {
    orderId = `subscription_${params.planId}`;
  }

  // حقول البيع السريع الأساسية (بدون media أو شحن)
  const formBody = new URLSearchParams({
    product_name: params.title,
    product_price: params.price.toFixed(2),
    currency: 'TRY',
    order_id: orderId,
    // callback_url: `${process.env.COOLIFY_URL}/api/webhook/shopier`, // يمكن إضافته لاحقاً
  });

  const response = await fetch('https://api.shopier.com/v1/quick-sales', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${pat}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formBody.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Shopier API error: ${errorText}`);
  }

  const data = await response.json();
  return data.payment_url || data.sale_url || `https://www.shopier.com/ShowProductNew.php?order_id=${orderId}`;
}