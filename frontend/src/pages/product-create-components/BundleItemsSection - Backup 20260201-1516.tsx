import React, { useState } from 'react';
import { BundleItem } from './types';
import ProductSearchModal from './ProductSearchModal';

interface Props {
  items: BundleItem[];
  onChange: (items: BundleItem[]) => void;
}

export default function BundleItemsSection({ items, onChange }: Props) {
  const [showSearchModal, setShowSearchModal] = useState(false);

  const handleAddItems = (newItems: BundleItem[]) => {
    onChange([...items, ...newItems]);
  };

  const removeItem = (productId: string) => {
    onChange(items.filter(item => item.product_id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity >= 1) {
      onChange(
        items.map(item =>
          item.product_id === productId ? { ...item, quantity } : item
        )
      );
    }
  };

  const getTotalItems = () => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  };

  return (
    <>
      <div className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
        <div className="card-header">
          <div className="flex items-center justify-between">
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Bundle Items</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Select products to include in this bundle
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowSearchModal(true)}
              className="btn btn-primary"
            >
              <i className="ri-add-line mr-2"></i>
              Add Products
            </button>
          </div>
        </div>
        <div style={{ padding: 'var(--spacing-xl)' }}>
          {items.length === 0 ? (
            <div className="text-center py-12">
              <i className="ri-gift-line text-4xl text-[var(--text-muted)] mb-3"></i>
              <p className="text-[var(--text-muted)] mb-4">
                No products added to bundle yet
              </p>
              <button
                type="button"
                onClick={() => setShowSearchModal(true)}
                className="btn btn-primary"
              >
                <i className="ri-search-line mr-2"></i>
                Search Products
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Bundle Items Table */}
              <div className="border border-[var(--border)] rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-[var(--bg-tertiary)] border-b border-[var(--border)]">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">
                        Product
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">
                        SKU
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-[var(--text-muted)] uppercase">
                        Quantity
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-[var(--text-muted)] uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {items.map(item => (
                      <tr key={item.product_id} className="hover:bg-[var(--bg-tertiary)] transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {item.image && (
                              <img
                                src={item.image}
                                alt={item.title}
                                className="w-10 h-10 object-cover rounded border border-[var(--border)]"
                              />
                            )}
                            <div>
                              <div className="font-medium text-sm text-[var(--text-primary)]">
                                {item.title}
                              </div>
                              {item.brand && (
                                <div className="text-xs text-[var(--text-muted)] mt-0.5">
                                  {item.brand}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm text-[var(--accent-cyan)]">
                            {item.sku || 'N/A'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                              disabled={item.quantity <= 1}
                              className="w-8 h-8 flex items-center justify-center rounded bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                            >
                              <i className="ri-subtract-line"></i>
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateQuantity(item.product_id, parseInt(e.target.value) || 1)}
                              className="input w-16 text-center text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                              className="w-8 h-8 flex items-center justify-center rounded bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] cursor-pointer transition-colors"
                            >
                              <i className="ri-add-line"></i>
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => removeItem(item.product_id)}
                            className="px-3 py-1.5 text-[var(--danger)] hover:bg-[var(--danger)]/10 rounded-lg transition-colors cursor-pointer"
                          >
                            <i className="ri-delete-bin-line"></i>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Bundle Summary */}
              <div className="bg-[var(--bg-tertiary)] rounded-lg p-4 border border-[var(--border)]">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-[var(--text-muted)]">
                    Total Items in Bundle
                  </div>
                  <div className="text-lg font-semibold text-[var(--text-primary)]">
                    {getTotalItems()} {getTotalItems() === 1 ? 'item' : 'items'}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="text-sm text-[var(--text-muted)]">
                    Unique Products
                  </div>
                  <div className="text-lg font-semibold text-[var(--text-primary)]">
                    {items.length}
                  </div>
                </div>
              </div>

              {items.length < 2 && (
                <div className="bg-[var(--warning)]/10 border border-[var(--warning)]/30 rounded-lg p-3 flex items-start gap-3">
                  <i className="ri-alert-line text-[var(--warning)] text-lg mt-0.5"></i>
                  <div className="text-sm text-[var(--text-primary)]">
                    <div className="font-medium mb-1">Bundle Requirement</div>
                    A bundle must contain at least 2 different products.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <ProductSearchModal
        show={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        onAddItems={handleAddItems}
        excludeIds={items.map(item => item.product_id)}
      />
    </>
  );
}
