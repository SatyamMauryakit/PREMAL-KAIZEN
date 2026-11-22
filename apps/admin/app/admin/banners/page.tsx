'use client';

import { Header } from '@/components/Header';
import { RequirePermission } from '@/components/RequirePermission';
import { useEffect, useMemo, useRef, useState } from 'react';
import { adminBannersService, Banner, BannerPlacement, BannerInput } from '@/lib/banners-service';
import { adminUploadsService } from '@/lib/products-service';

const PLACEMENT_INFO: Record<BannerPlacement, { label: string; hint: string }> = {
  hero: { label: 'Hero (big top banner)', hint: 'The large main banner at the top of the homepage.' },
  strip: { label: 'Strip (small tiles row)', hint: 'The row of small dark tiles just below the hero.' },
  sidebar: { label: 'Sidebar (offer cards)', hint: 'The stack of small offer cards beside the hero.' },
};

const EMPTY_FORM: BannerInput = {
  placement: 'hero',
  imageUrl: '',
  mobileImageUrl: '',
  title: '',
  subtitle: '',
  badgeText: '',
  ctaText: '',
  ctaUrl: '',
  textColor: '',
  fontStyle: '',
  isActive: true,
  startAt: '',
  endAt: '',
};

const FONT_STYLE_OPTIONS: { value: '' | 'display' | 'sans'; label: string }[] = [
  { value: '', label: 'Default (Display)' },
  { value: 'display', label: 'Display (Playfair) - bold, editorial' },
  { value: 'sans', label: 'Sans (Inter) - clean, modern' },
];

type DerivedStatus = 'Live' | 'Hidden' | 'Scheduled' | 'Expired';
type StatusFilter = 'all' | DerivedStatus;
type PlacementFilter = 'all' | BannerPlacement;

function getToken() {
  const token = localStorage.getItem('adminSessionToken') || localStorage.getItem('sessionToken');
  if (!token) throw new Error('Not authenticated. Please log in again.');
  return token;
}

/** Live status shown to the admin - derived the same way the storefront's own getActive() filter works, so the table never lies about what's actually visible. */
function deriveStatus(banner: Banner): DerivedStatus {
  if (!banner.isActive) return 'Hidden';
  const now = Date.now();
  if (banner.startAt && new Date(banner.startAt).getTime() > now) return 'Scheduled';
  if (banner.endAt && new Date(banner.endAt).getTime() < now) return 'Expired';
  return 'Live';
}

const STATUS_BADGE: Record<DerivedStatus, string> = {
  Live: 'bg-green-100 text-green-800',
  Hidden: 'bg-gray-100 text-gray-600',
  Scheduled: 'bg-blue-100 text-blue-800',
  Expired: 'bg-accent-red/10 text-accent-red',
};

/** ISO <-> <input type="datetime-local"> round-trip (that input wants local time with no timezone suffix). */
function toDatetimeLocal(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromDatetimeLocal(value: string): string | undefined {
  return value ? new Date(value).toISOString() : undefined;
}

/** Scaled-down preview of exactly what the form will publish, in its real placement style - so the admin never has to save-and-check to see the result. */
function BannerPreview({ form }: { form: BannerInput }) {
  if (!form.imageUrl) {
    return (
      <div className="h-40 flex items-center justify-center bg-gray-50 border border-dashed border-gray-light rounded text-sm text-gray-medium">
        Upload an image to see a preview
      </div>
    );
  }

  const fontClass = form.fontStyle === 'sans' ? 'font-sans' : 'font-display';
  const textStyle = form.textColor ? { color: form.textColor } : undefined;

  if (form.placement === 'strip') {
    return (
      <div className="bg-neutral-900 text-cream rounded px-4 py-4 max-w-[220px]">
        {form.badgeText && <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">{form.badgeText}</p>}
        <p className={`text-sm font-semibold ${fontClass}`} style={textStyle}>{form.title || 'Title'}</p>
        {form.subtitle && <p className="text-xs text-gray-300 mt-0.5">{form.subtitle}</p>}
      </div>
    );
  }

  const isHero = form.placement === 'hero';
  return (
    <div
      className={`relative rounded-lg overflow-hidden bg-neutral-900 ${isHero ? 'aspect-[21/9]' : 'aspect-[4/3] max-w-[220px]'}`}
      style={{ backgroundImage: `url(${form.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      <div className="relative z-10 h-full flex flex-col justify-end p-3">
        {form.badgeText && (
          <span className="inline-block w-fit mb-1.5 bg-cream text-black text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-full">
            {form.badgeText}
          </span>
        )}
        <p className={`font-bold text-cream ${fontClass} ${isHero ? 'text-lg' : 'text-sm'}`} style={textStyle}>
          {form.title || 'Title'}
        </p>
        {form.subtitle && <p className="text-xs text-cream/90" style={textStyle}>{form.subtitle}</p>}
        {form.ctaText && (
          <span className="inline-block w-fit mt-2 px-3 py-1 bg-cream text-black text-[11px] font-semibold rounded">
            {form.ctaText}
          </span>
        )}
      </div>
    </div>
  );
}

export default function BannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isUploadingDesktop, setIsUploadingDesktop] = useState(false);
  const [isUploadingMobile, setIsUploadingMobile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BannerInput>(EMPTY_FORM);
  const [placementFilter, setPlacementFilter] = useState<PlacementFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const desktopFileRef = useRef<HTMLInputElement>(null);
  const mobileFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const result = await adminBannersService.list(getToken());
      setBanners(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load banners');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const handleUpload = async (file: File, onDone: (url: string) => void, setBusy: (v: boolean) => void) => {
    setError(null);
    setBusy(true);
    try {
      if (!file.type.startsWith('image/')) throw new Error('Please select an image file');
      if (file.size > 5 * 1024 * 1024) throw new Error('Image exceeds the 5MB size limit');
      const uploaded = await adminUploadsService.uploadImage(file, getToken());
      onDone(uploaded.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setBusy(false);
    }
  };

  const handleDesktopImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleUpload(file, (url) => setForm((prev) => ({ ...prev, imageUrl: url })), setIsUploadingDesktop);
    if (desktopFileRef.current) desktopFileRef.current.value = '';
  };

  const handleMobileImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleUpload(file, (url) => setForm((prev) => ({ ...prev, mobileImageUrl: url })), setIsUploadingMobile);
    if (mobileFileRef.current) mobileFileRef.current.value = '';
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.imageUrl) {
      setError('Please upload an image for this banner.');
      return;
    }
    if (!form.title.trim()) {
      setError('Title is required.');
      return;
    }
    if (form.startAt && form.endAt && new Date(form.endAt) <= new Date(form.startAt)) {
      setError('End date must be after the start date.');
      return;
    }
    if (form.textColor && !/^#[0-9A-Fa-f]{6}$/.test(form.textColor)) {
      setError('Text color must be a 6-digit hex code, e.g. #FFFFFF.');
      return;
    }
    setIsSaving(true);
    try {
      const token = getToken();
      const payload: BannerInput = {
        ...form,
        mobileImageUrl: form.mobileImageUrl || undefined,
        textColor: form.textColor || undefined,
        fontStyle: form.fontStyle || undefined,
        startAt: fromDatetimeLocal(form.startAt || ''),
        endAt: fromDatetimeLocal(form.endAt || ''),
      };
      if (editingId) {
        const updated = await adminBannersService.update(token, editingId, payload);
        setBanners((prev) => prev.map((b) => (b.id === editingId ? updated : b)));
        setNotice('Banner updated.');
      } else {
        const created = await adminBannersService.create(token, payload);
        setBanners((prev) => [...prev, created]);
        setNotice('Banner created.');
      }
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save banner');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (banner: Banner) => {
    setEditingId(banner.id);
    setForm({
      placement: banner.placement,
      imageUrl: banner.imageUrl,
      mobileImageUrl: banner.mobileImageUrl || '',
      title: banner.title,
      subtitle: banner.subtitle || '',
      badgeText: banner.badgeText || '',
      ctaText: banner.ctaText || '',
      ctaUrl: banner.ctaUrl || '',
      textColor: banner.textColor || '',
      fontStyle: (banner.fontStyle as 'display' | 'sans' | null) || '',
      isActive: banner.isActive,
      startAt: toDatetimeLocal(banner.startAt),
      endAt: toDatetimeLocal(banner.endAt),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this banner? This cannot be undone.')) return;
    try {
      await adminBannersService.remove(getToken(), id);
      setBanners((prev) => prev.filter((b) => b.id !== id));
      if (editingId === id) resetForm();
      setNotice('Banner deleted.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete banner');
    }
  };

  const handleToggleActive = async (banner: Banner) => {
    try {
      const updated = await adminBannersService.update(getToken(), banner.id, { isActive: !banner.isActive });
      setBanners((prev) => prev.map((b) => (b.id === banner.id ? updated : b)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update banner');
    }
  };

  /** Swaps this banner with its neighbor within the same placement group (order is scoped per-placement). */
  const handleMove = async (banner: Banner, direction: 'up' | 'down') => {
    const group = banners.filter((b) => b.placement === banner.placement).sort((a, b) => a.order - b.order);
    const idx = group.findIndex((b) => b.id === banner.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= group.length) return;
    const ids = group.map((b) => b.id);
    [ids[idx], ids[swapIdx]] = [ids[swapIdx], ids[idx]];
    try {
      await adminBannersService.reorder(getToken(), ids);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reorder banners');
    }
  };

  const sorted = useMemo(
    () => [...banners].sort((a, b) => (a.placement === b.placement ? a.order - b.order : a.placement.localeCompare(b.placement))),
    [banners],
  );
  const filtered = sorted.filter((b) => {
    if (placementFilter !== 'all' && b.placement !== placementFilter) return false;
    if (statusFilter !== 'all' && deriveStatus(b) !== statusFilter) return false;
    return true;
  });

  return (
    <RequirePermission permission="content:manage">
      <div className="min-h-screen bg-gray-light">
        <Header title="Homepage Banners" subtitle="Control every image, offer, and text block shown on the storefront homepage" />

        {notice && (
          <div className="mx-6 mt-4 bg-green-50 border border-green-200 text-green-800 px-4 py-2 rounded text-sm">{notice}</div>
        )}

        <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form */}
          <div className="lg:col-span-1">
            <form onSubmit={handleSave} className="bg-white rounded-lg border border-gray-light p-6 space-y-4 sticky top-6">
              <h3 className="font-semibold text-black">{editingId ? 'Edit Banner' : 'Add New Banner'}</h3>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{error}</div>
              )}

              <div>
                <label className="block text-sm font-medium text-black mb-1">Where it appears</label>
                <select
                  value={form.placement}
                  onChange={(e) => setForm((p) => ({ ...p, placement: e.target.value as BannerPlacement }))}
                  className="w-full px-3 py-2 border border-gray-light rounded text-sm focus:outline-none focus:border-black"
                >
                  {Object.entries(PLACEMENT_INFO).map(([key, info]) => (
                    <option key={key} value={key}>{info.label}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-medium mt-1">{PLACEMENT_INFO[form.placement].hint}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-black mb-1">Desktop Image *</label>
                  {form.imageUrl && (
                    <img src={form.imageUrl} alt="" className="w-full h-20 object-cover rounded border border-gray-light mb-2" />
                  )}
                  <input
                    ref={desktopFileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleDesktopImageSelect}
                    disabled={isUploadingDesktop}
                    className="w-full text-xs disabled:opacity-50"
                  />
                  {isUploadingDesktop && <p className="text-xs text-gray-medium mt-1">Uploading...</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-black mb-1">Mobile Image</label>
                  {form.mobileImageUrl && (
                    <img src={form.mobileImageUrl} alt="" className="w-full h-20 object-cover rounded border border-gray-light mb-2" />
                  )}
                  <input
                    ref={mobileFileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleMobileImageSelect}
                    disabled={isUploadingMobile}
                    className="w-full text-xs disabled:opacity-50"
                  />
                  {isUploadingMobile && <p className="text-xs text-gray-medium mt-1">Uploading...</p>}
                  <p className="text-[10px] text-gray-medium mt-1">Optional - falls back to desktop image.</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-black mb-1">Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Winter Collection"
                  className="w-full px-3 py-2 border border-gray-light rounded text-sm focus:outline-none focus:border-black"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-black mb-1">Offer text / subtitle</label>
                <input
                  type="text"
                  value={form.subtitle}
                  onChange={(e) => setForm((p) => ({ ...p, subtitle: e.target.value }))}
                  placeholder="e.g. Flat 40% off"
                  className="w-full px-3 py-2 border border-gray-light rounded text-sm focus:outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-black mb-1">Small badge (optional)</label>
                <input
                  type="text"
                  value={form.badgeText}
                  onChange={(e) => setForm((p) => ({ ...p, badgeText: e.target.value }))}
                  placeholder="e.g. Just Launched"
                  className="w-full px-3 py-2 border border-gray-light rounded text-sm focus:outline-none focus:border-black"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-black mb-1">Button text</label>
                  <input
                    type="text"
                    value={form.ctaText}
                    onChange={(e) => setForm((p) => ({ ...p, ctaText: e.target.value }))}
                    placeholder="Shop Now"
                    className="w-full px-3 py-2 border border-gray-light rounded text-sm focus:outline-none focus:border-black"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-black mb-1">Button link</label>
                  <input
                    type="text"
                    value={form.ctaUrl}
                    onChange={(e) => setForm((p) => ({ ...p, ctaUrl: e.target.value }))}
                    placeholder="/shop?category=..."
                    className="w-full px-3 py-2 border border-gray-light rounded text-sm focus:outline-none focus:border-black"
                  />
                </div>
              </div>
              <p className="text-[10px] text-gray-medium -mt-2">Must start with / or https:// - other link types are rejected for safety.</p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-black mb-1">Text color (optional)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={/^#[0-9A-Fa-f]{6}$/.test(form.textColor || '') ? form.textColor : '#F5F1ED'}
                      onChange={(e) => setForm((p) => ({ ...p, textColor: e.target.value }))}
                      className="w-10 h-9 border border-gray-light rounded cursor-pointer"
                      aria-label="Pick text color"
                    />
                    <input
                      type="text"
                      value={form.textColor || ''}
                      onChange={(e) => setForm((p) => ({ ...p, textColor: e.target.value }))}
                      placeholder="#FFFFFF"
                      className="flex-1 px-3 py-2 border border-gray-light rounded text-sm focus:outline-none focus:border-black"
                    />
                  </div>
                  <p className="text-[10px] text-gray-medium mt-1">Leave blank to use the default cream text.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-black mb-1">Font style</label>
                  <select
                    value={form.fontStyle || ''}
                    onChange={(e) => setForm((p) => ({ ...p, fontStyle: e.target.value as 'display' | 'sans' | '' }))}
                    className="w-full px-3 py-2 border border-gray-light rounded text-sm focus:outline-none focus:border-black"
                  >
                    {FONT_STYLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-black mb-1">Start date (optional)</label>
                  <input
                    type="datetime-local"
                    value={form.startAt ?? ''}
                    onChange={(e) => setForm((p) => ({ ...p, startAt: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-light rounded text-sm focus:outline-none focus:border-black"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-black mb-1">End date (optional)</label>
                  <input
                    type="datetime-local"
                    value={form.endAt ?? ''}
                    onChange={(e) => setForm((p) => ({ ...p, endAt: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-light rounded text-sm focus:outline-none focus:border-black"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-black">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                  className="w-4 h-4"
                />
                Visible on the live site
              </label>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSaving || isUploadingDesktop || isUploadingMobile}
                  className="flex-1 px-4 py-2 bg-black text-cream text-sm font-semibold rounded hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : editingId ? 'Save Changes' : 'Add Banner'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 border border-gray-light text-gray-dark text-sm font-medium rounded hover:border-black transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>

              <div className="pt-3 border-t border-gray-light">
                <p className="text-xs font-medium text-gray-medium mb-2 uppercase tracking-wide">Preview</p>
                <BannerPreview form={form} />
              </div>
            </form>
          </div>

          {/* Management table */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg border border-gray-light overflow-hidden">
              <div className="p-4 border-b border-gray-light flex flex-wrap gap-3 items-center">
                <select
                  value={placementFilter}
                  onChange={(e) => setPlacementFilter(e.target.value as PlacementFilter)}
                  className="px-3 py-1.5 border border-gray-light rounded text-sm focus:outline-none focus:border-black"
                >
                  <option value="all">All placements</option>
                  {Object.entries(PLACEMENT_INFO).map(([key, info]) => (
                    <option key={key} value={key}>{info.label}</option>
                  ))}
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  className="px-3 py-1.5 border border-gray-light rounded text-sm focus:outline-none focus:border-black"
                >
                  <option value="all">All statuses</option>
                  <option value="Live">Live</option>
                  <option value="Scheduled">Scheduled</option>
                  <option value="Hidden">Hidden</option>
                  <option value="Expired">Expired</option>
                </select>
                <span className="text-xs text-gray-medium ml-auto">{filtered.length} of {banners.length} banners</span>
              </div>

              {isLoading ? (
                <p className="p-6 text-gray-medium text-sm">Loading...</p>
              ) : filtered.length === 0 ? (
                <div className="p-10 text-center">
                  <p className="text-sm text-gray-medium">
                    {banners.length === 0 ? 'No banners yet - add one from the form on the left.' : 'No banners match these filters.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-light text-left text-xs text-gray-medium uppercase tracking-wide">
                        <th className="p-3 font-medium">Image</th>
                        <th className="p-3 font-medium">Title</th>
                        <th className="p-3 font-medium">Placement</th>
                        <th className="p-3 font-medium">Status</th>
                        <th className="p-3 font-medium">Order</th>
                        <th className="p-3 font-medium">Created</th>
                        <th className="p-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((banner) => {
                        const status = deriveStatus(banner);
                        return (
                          <tr key={banner.id} className="border-b border-gray-light last:border-0 hover:bg-gray-50">
                            <td className="p-3">
                              <img src={banner.imageUrl} alt={banner.title} className="w-14 h-14 object-cover rounded" />
                            </td>
                            <td className="p-3">
                              <p className="font-medium text-black">{banner.title}</p>
                              {banner.subtitle && <p className="text-xs text-gray-medium">{banner.subtitle}</p>}
                            </td>
                            <td className="p-3 text-gray-dark">{PLACEMENT_INFO[banner.placement].label.split(' ')[0]}</td>
                            <td className="p-3">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded whitespace-nowrap ${STATUS_BADGE[status]}`}>
                                {status}
                              </span>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleMove(banner, 'up')}
                                  aria-label="Move up"
                                  className="w-6 h-6 flex items-center justify-center text-gray-medium hover:text-black border border-gray-light rounded"
                                >
                                  ↑
                                </button>
                                <button
                                  onClick={() => handleMove(banner, 'down')}
                                  aria-label="Move down"
                                  className="w-6 h-6 flex items-center justify-center text-gray-medium hover:text-black border border-gray-light rounded"
                                >
                                  ↓
                                </button>
                              </div>
                            </td>
                            <td className="p-3 text-gray-medium whitespace-nowrap">
                              {new Date(banner.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </td>
                            <td className="p-3">
                              <div className="flex gap-3 justify-end whitespace-nowrap">
                                <button onClick={() => handleEdit(banner)} className="text-xs font-medium text-black underline hover:no-underline">
                                  Edit
                                </button>
                                <button onClick={() => handleToggleActive(banner)} className="text-xs font-medium text-black underline hover:no-underline">
                                  {banner.isActive ? 'Hide' : 'Show'}
                                </button>
                                <button onClick={() => handleDelete(banner.id)} className="text-xs font-medium text-accent-red underline hover:no-underline">
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </RequirePermission>
  );
}
