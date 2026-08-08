interface CreatePaymentLinkParams {
  liveCourseId?: string;
  bundleId?: string;
  planId?: string;
  title: string;
  price: number; // بالليرة التركية
  type: 'course' | 'bundle' | 'subscription';
}

export async function createShopierPaymentLink(params: CreatePaymentLinkParams): Promise<string> {
  const pat = process.env.SHOPIER_PAT;
  if (!pat) throw new Error('SHOPIER_PAT is not set');

  // بناء معرّف مخصص لربط الكورس لاحقًا في webhook
  let productId = '';
  if (params.type === 'course' && params.liveCourseId) {
    productId = `course_${params.liveCourseId}`;
  } else if (params.type === 'bundle' && params.bundleId) {
    productId = `bundle_${params.bundleId}`;
  } else if (params.type === 'subscription' && params.planId) {
    productId = `subscription_${params.planId}`;
  }

  // الحقول المطلوبة من Shopier API
  const formBody = new URLSearchParams({
    title: params.title,               // جرب استخدام "title" بدلاً من "product_name"
    price: params.price.toFixed(2),   // السعر
    currency: 'TRY',                  // الليرة التركية
    product_id: productId,           // معرّف المنتج المخصص
  });

  const response = await fetch('https://api.shopier.com/v1/products', {
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
  return data.product_url || `https://www.shopier.com/ShowProductNew.php?product_id=${data.product_id}`;
}