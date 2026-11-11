'use client';

import { useEffect, useState } from 'react';

interface SizeGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type GarmentType = 'topwear' | 'bottomwear';
type Unit = 'in' | 'cm';

/**
 * General, estimated size charts - NOT per-product or per-category admin data.
 * The Category model (schema.prisma) has no garment-type field, so there is no
 * real signal to auto-select "this product is topwear" - showing both and
 * letting the shopper pick is more honest than guessing. Clearly labelled as
 * estimated in the UI itself, per "do not display misleading universal
 * measurements."
 */
const CHARTS: Record<GarmentType, { label: string; measurements: string[]; rows: Record<string, string>[] }> = {
  topwear: {
    label: 'Topwear (T-Shirts, Hoodies, Shirts)',
    measurements: ['Chest', 'Length'],
    rows: [
      { size: 'S', Chest_in: '36-38', Chest_cm: '91-96', Length_in: '26', Length_cm: '66' },
      { size: 'M', Chest_in: '38-40', Chest_cm: '96-101', Length_in: '27', Length_cm: '69' },
      { size: 'L', Chest_in: '40-42', Chest_cm: '101-107', Length_in: '28', Length_cm: '71' },
      { size: 'XL', Chest_in: '42-44', Chest_cm: '107-112', Length_in: '29', Length_cm: '74' },
      { size: 'XXL', Chest_in: '44-46', Chest_cm: '112-117', Length_in: '30', Length_cm: '76' },
    ],
  },
  bottomwear: {
    label: 'Bottomwear (Pants, Joggers)',
    measurements: ['Waist', 'Inseam'],
    rows: [
      { size: 'S', Waist_in: '28-30', Waist_cm: '71-76', Inseam_in: '30', Inseam_cm: '76' },
      { size: 'M', Waist_in: '30-32', Waist_cm: '76-81', Inseam_in: '31', Inseam_cm: '79' },
      { size: 'L', Waist_in: '32-34', Waist_cm: '81-86', Inseam_in: '32', Inseam_cm: '81' },
      { size: 'XL', Waist_in: '34-36', Waist_cm: '86-91', Inseam_in: '32', Inseam_cm: '81' },
      { size: 'XXL', Waist_in: '36-38', Waist_cm: '91-96', Inseam_in: '33', Inseam_cm: '84' },
    ],
  },
};

export function SizeGuideModal({ isOpen, onClose }: SizeGuideModalProps) {
  const [garmentType, setGarmentType] = useState<GarmentType>('topwear');
  const [unit, setUnit] = useState<Unit>('in');

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const chart = CHARTS[garmentType];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Size guide"
    >
      <div
        className="bg-cream w-full sm:max-w-lg sm:rounded-lg max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-cream border-b border-gray-light px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-black">Size Guide</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close size guide"
            className="text-2xl text-black hover:text-gray-dark w-8 h-8 flex items-center justify-center"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          <p className="text-sm text-gray-dark bg-beige/40 border border-beige rounded px-3 py-2 mb-6">
            These are <strong>general size estimates</strong> for reference only. Actual fit may vary slightly by
            style - check the product description for specifics where noted.
          </p>

          {/* Garment type tabs */}
          <div className="flex gap-2 mb-4">
            {(Object.keys(CHARTS) as GarmentType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setGarmentType(type)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  garmentType === type
                    ? 'bg-black text-cream border-black'
                    : 'bg-white text-black border-gray-300 hover:border-black'
                }`}
              >
                {CHARTS[type].label}
              </button>
            ))}
          </div>

          {/* Unit toggle */}
          <div className="flex gap-2 mb-4">
            {(['in', 'cm'] as Unit[]).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUnit(u)}
                className={`px-3 py-1 rounded text-xs font-semibold border transition-colors ${
                  unit === u
                    ? 'bg-black text-cream border-black'
                    : 'bg-white text-black border-gray-300 hover:border-black'
                }`}
              >
                {u === 'in' ? 'Inches' : 'Centimeters'}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-light">
                  <th className="text-left py-2 pr-4 font-semibold text-black">Size</th>
                  {chart.measurements.map((m) => (
                    <th key={m} className="text-left py-2 pr-4 font-semibold text-black">
                      {m} ({unit})
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chart.rows.map((row) => (
                  <tr key={row.size} className="border-b border-gray-light last:border-0">
                    <td className="py-2 pr-4 font-medium text-black">{row.size}</td>
                    {chart.measurements.map((m) => (
                      <td key={m} className="py-2 pr-4 text-gray-dark">
                        {row[`${m}_${unit}`]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 text-sm text-gray-dark space-y-2">
            <p className="font-semibold text-black">How to measure</p>
            <p>Chest/Waist: measure around the fullest part, keeping the tape level and snug but not tight.</p>
            <p>Length/Inseam: measure from the highest point to the desired hem/leg end.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
