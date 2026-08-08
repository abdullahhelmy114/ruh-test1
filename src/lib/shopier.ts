interface CreatePaymentLinkParams {
  liveCourseId?: string;
  bundleId?: string;
  planId?: string;
  title: string;
  price: number; // السعر بالليرة التركية
  type: 'course' | 'bundle' | 'subscription';
}

export async function createShopierPaymentLink(params: CreatePaymentLinkParams): Promise<string> {
  const pat = process.env.SHOPIER_PAT;
  if (!pat) throw new Error('SHOPIER_PAT is not set');

  // بناء معرّف مخصص نمرره لـ Shopier لربط الكورس / الباقة / الخطة لاحقًا في webhook
  let productId = '';
  if (params.type === 'course' && params.liveCourseId) {
    productId = `course_${params.liveCourseId}`;
  } else if (params.type === 'bundle' && params.bundleId) {
    productId = `bundle_${params.bundleId}`;
  } else if (params.type === 'subscription' && params.planId) {
    productId = `subscription_${params.planId}`;
  }

  const formBody = new URLSearchParams({
    product_name: params.title,
    product_price: params.price.toFixed(2),
    currency: 'TRY',
    product_id: productId,
    // حقول إضافية مفيدة
    buyer_name: '',
    buyer_surname: '',
    buyer_email: '',
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
  // Shopier يعيد product_url أو product_id لبناء الرابط
  return data.product_url || `https://www.shopier.com/ShowProductNew.php?product_id=${data.product_id}`;
}