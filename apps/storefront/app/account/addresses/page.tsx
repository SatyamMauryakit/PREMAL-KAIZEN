'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { INDIAN_STATES, isValidIndianMobile, isValidIndianPincode } from '@/lib/india';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

interface Address {
  id: string;
  label: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  street1: string;
  street2?: string;
  landmark?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

const emptyForm = {
  label: '',
  firstName: '',
  lastName: '',
  phoneNumber: '',
  street1: '',
  street2: '',
  landmark: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'India',
  isDefault: false,
};

export default function AddressesPage() {
  const { isLoading: authLoading, sessionToken } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => {
    if (!authLoading && sessionToken) {
      loadAddresses();
    }
  }, [authLoading, sessionToken]);

  const loadAddresses = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/customer/addresses`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (!response.ok) throw new Error('Failed to load addresses');
      setAddresses(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load addresses');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    setFormData({
      ...formData,
      [e.target.name]: value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!isValidIndianMobile(formData.phoneNumber)) {
      setError('Enter a valid 10-digit Indian mobile number');
      return;
    }
    if (!isValidIndianPincode(formData.postalCode)) {
      setError('Enter a valid 6-digit PIN code');
      return;
    }

    setIsSaving(true);
    try {
      const url = editingId
        ? `${API_BASE}/api/customer/addresses/${editingId}`
        : `${API_BASE}/api/customer/addresses`;
      const response = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || 'Failed to save address');
      }

      setSuccess(editingId ? 'Address updated successfully' : 'Address added successfully');
      resetForm();
      await loadAddresses();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (addressId: string) => {
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`${API_BASE}/api/customer/addresses/${addressId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || 'Failed to delete address');
      }
      setSuccess('Address deleted successfully');
      await loadAddresses();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete address');
    }
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setShowForm(false);
    setEditingId(null);
  };

  if (authLoading || isLoading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-black">My Addresses</h2>
        <button
          onClick={() => (showForm ? resetForm() : setShowForm(true))}
          className="bg-black text-cream px-6 py-2 rounded-lg font-medium hover:bg-gray-800 transition-colors"
        >
          {showForm ? 'Cancel' : 'Add Address'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      {/* Address Form */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-md p-8">
          <h3 className="text-xl font-semibold text-black mb-6">
            {editingId ? 'Edit Address' : 'Add New Address'}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="label" className="block text-sm font-medium text-gray-700 mb-2">
                  Label (Home, Office, etc.)
                </label>
                <input
                  id="label"
                  name="label"
                  type="text"
                  value={formData.label}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-beige focus:border-transparent"
                  placeholder="Home"
                  disabled={isSaving}
                />
              </div>

              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                  First Name *
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  value={formData.firstName}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-beige focus:border-transparent"
                  placeholder="John"
                  required
                  disabled={isSaving}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                  Last Name *
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  value={formData.lastName}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-beige focus:border-transparent"
                  placeholder="Doe"
                  required
                  disabled={isSaving}
                />
              </div>

              <div>
                <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-2">
                  Mobile Number *
                </label>
                <input
                  id="phoneNumber"
                  name="phoneNumber"
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-beige focus:border-transparent"
                  placeholder="98765 43210"
                  required
                  disabled={isSaving}
                />
              </div>
            </div>

            <div>
              <label htmlFor="street1" className="block text-sm font-medium text-gray-700 mb-2">
                Flat / House No., Building *
              </label>
              <input
                id="street1"
                name="street1"
                type="text"
                value={formData.street1}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-beige focus:border-transparent"
                placeholder="123 Main Street"
                required
                disabled={isSaving}
              />
            </div>

            <div>
              <label htmlFor="street2" className="block text-sm font-medium text-gray-700 mb-2">
                Area, Street (Optional)
              </label>
              <input
                id="street2"
                name="street2"
                type="text"
                value={formData.street2}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-beige focus:border-transparent"
                placeholder="Apartment 101"
                disabled={isSaving}
              />
            </div>

            <div>
              <label htmlFor="landmark" className="block text-sm font-medium text-gray-700 mb-2">
                Landmark (Optional)
              </label>
              <input
                id="landmark"
                name="landmark"
                type="text"
                value={formData.landmark}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-beige focus:border-transparent"
                placeholder="Near City Mall"
                disabled={isSaving}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-2">
                  City *
                </label>
                <input
                  id="city"
                  name="city"
                  type="text"
                  value={formData.city}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-beige focus:border-transparent"
                  placeholder="Mumbai"
                  required
                  disabled={isSaving}
                />
              </div>

              <div>
                <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-2">
                  State / UT *
                </label>
                <select
                  id="state"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-beige focus:border-transparent bg-white"
                  required
                  disabled={isSaving}
                >
                  <option value="">Select state</option>
                  {INDIAN_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="postalCode" className="block text-sm font-medium text-gray-700 mb-2">
                  PIN Code *
                </label>
                <input
                  id="postalCode"
                  name="postalCode"
                  type="text"
                  value={formData.postalCode}
                  onChange={handleChange}
                  maxLength={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-beige focus:border-transparent"
                  placeholder="400001"
                  required
                  disabled={isSaving}
                />
              </div>

              <div>
                <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-2">
                  Country
                </label>
                <select
                  id="country"
                  name="country"
                  value={formData.country}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-beige focus:border-transparent"
                  disabled={isSaving}
                >
                  <option value="India">India</option>
                </select>
              </div>
            </div>

            <div className="flex items-center">
              <input
                id="isDefault"
                name="isDefault"
                type="checkbox"
                checked={formData.isDefault}
                onChange={handleChange}
                className="w-4 h-4 text-black rounded focus:ring-2 focus:ring-beige cursor-pointer"
                disabled={isSaving}
              />
              <label htmlFor="isDefault" className="ml-2 text-sm font-medium text-gray-700 cursor-pointer">
                Set as default delivery address
              </label>
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={isSaving}
                className="bg-black text-cream px-6 py-2 rounded-lg font-medium hover:bg-gray-800 disabled:bg-gray-400 transition-colors"
              >
                {isSaving ? 'Saving...' : 'Save Address'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                disabled={isSaving}
                className="border border-gray-300 text-black px-6 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Addresses List */}
      <div className="bg-white rounded-lg shadow-md p-8">
        {addresses.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 mb-4">No addresses added yet</p>
            <button
              onClick={() => setShowForm(true)}
              className="text-black font-medium hover:underline"
            >
              Add your first address
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {addresses.map((address) => (
              <div key={address.id} className="border border-gray-200 rounded-lg p-4 flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-black">{address.label}</h3>
                    {address.isDefault && (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Default</span>
                    )}
                  </div>
                  <p className="text-gray-600 text-sm mb-1">
                    {address.firstName} {address.lastName}
                  </p>
                  <p className="text-gray-600 text-sm mb-1">{address.street1}</p>
                  {address.street2 && <p className="text-gray-600 text-sm mb-1">{address.street2}</p>}
                  {address.landmark && <p className="text-gray-600 text-sm mb-1">Near {address.landmark}</p>}
                  <p className="text-gray-600 text-sm mb-1">
                    {address.city}, {address.state} - {address.postalCode}
                  </p>
                  <p className="text-gray-600 text-sm">{address.phoneNumber}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingId(address.id);
                      setFormData({ ...emptyForm, ...address, street2: address.street2 || '', landmark: address.landmark || '' });
                      setShowForm(true);
                      setError('');
                      setSuccess('');
                    }}
                    className="text-blue-600 hover:underline text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(address.id)}
                    className="text-red-600 hover:underline text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
