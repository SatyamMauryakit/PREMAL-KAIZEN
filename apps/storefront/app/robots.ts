import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/metadata';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin/', // this storefront doesn't host /admin itself (apps/admin is a separate app), included defensively per spec
        '/api/',
        '/checkout',
        '/account/',
        '/auth/',
        '/order-confirmation/',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
