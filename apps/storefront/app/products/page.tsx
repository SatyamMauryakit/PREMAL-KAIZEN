import { redirect } from 'next/navigation';

/**
 * /shop is the canonical product listing page (full filtering/sorting).
 * Redirect here to avoid maintaining two competing catalog implementations.
 */
export default function ProductsIndexPage() {
  redirect('/shop');
}
