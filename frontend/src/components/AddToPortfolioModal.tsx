'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { portfolioApi } from '@/lib/portfolio.api';

interface AddToPortfolioModalProps {
  isOpen: boolean;
  symbol: string;
  currentPrice: number;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddToPortfolioModal({
  isOpen,
  symbol,
  currentPrice,
  onClose,
  onSuccess,
}: AddToPortfolioModalProps) {
  const queryClient = useQueryClient();
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState<string>('');
  const [purchasePrice, setPurchasePrice] = useState<string>(currentPrice.toString());
  const [error, setError] = useState<string>('');

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setPurchasePrice(currentPrice > 0 ? currentPrice.toString() : '');
      setQuantity('');
      setError('');
    }
  }, [isOpen, currentPrice]);

  // Fetch user's portfolios for dropdown
  const { data: portfolios = [], isLoading: portfoliosLoading } = useQuery({
    queryKey: ['portfolios'],
    queryFn: portfolioApi.list,
    enabled: isOpen,
  });

  // Auto-select if only 1 portfolio
  useEffect(() => {
    if (portfolios.length === 1 && !selectedPortfolioId) {
      setSelectedPortfolioId(portfolios[0].id);
    }
  }, [portfolios, selectedPortfolioId]);

  // Mutation to add holding
  const { mutate: addHolding, isPending } = useMutation({
    mutationFn: async () => {
      if (!selectedPortfolioId) throw new Error('Please select a portfolio');
      const qty = parseFloat(quantity);
      const price = parseFloat(purchasePrice);
      if (!qty || qty <= 0) throw new Error('Quantity must be greater than 0');
      if (!price || price <= 0) throw new Error('Price must be greater than 0');

      await portfolioApi.buyHolding(selectedPortfolioId, symbol, qty, price);
    },
    onSuccess: () => {
      // Invalidate portfolio queries so data refreshes
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-summary'] });
      setQuantity('');
      setPurchasePrice(currentPrice.toString());
      setError('');
      onSuccess?.();
      onClose();
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to add holding');
    },
  });

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  if (!isOpen) return null;

  const qty = parseFloat(quantity) || 0;
  const price = parseFloat(purchasePrice) || 0;
  const totalCost = qty * price;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-text">
            Add {symbol.split('.')[0]} to Portfolio
          </h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-text text-lg transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Portfolio Selection */}
        <div className="mb-4">
          <label className="block text-[11px] text-muted mb-1.5 tracking-wide uppercase">
            Portfolio
          </label>
          {portfoliosLoading ? (
            <div className="text-muted text-sm py-2">Loading portfolios...</div>
          ) : portfolios.length === 0 ? (
            <div className="text-red text-sm py-2">
              No portfolios found. Please create a portfolio first.
            </div>
          ) : (
            <select
              value={selectedPortfolioId || ''}
              onChange={(e) => setSelectedPortfolioId(parseInt(e.target.value))}
              className="w-full px-3 py-2.5 bg-card2 text-text rounded-xl border border-border text-[13px] outline-none focus:border-lime/40 transition-colors cursor-pointer"
            >
              <option value="">Choose a portfolio...</option>
              {portfolios.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Quantity Input */}
        <div className="mb-4">
          <label className="block text-[11px] text-muted mb-1.5 tracking-wide uppercase">
            Quantity (shares)
          </label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="e.g., 10"
            className="w-full px-3 py-2.5 bg-card2 text-text rounded-xl border border-border text-[13px] outline-none focus:border-lime/40 transition-colors"
            min="0.01"
            step="0.01"
          />
        </div>

        {/* Purchase Price Input */}
        <div className="mb-4">
          <label className="block text-[11px] text-muted mb-1.5 tracking-wide uppercase">
            Purchase Price (₹)
          </label>
          <input
            type="number"
            value={purchasePrice}
            onChange={(e) => setPurchasePrice(e.target.value)}
            placeholder="e.g., 2800.00"
            className="w-full px-3 py-2.5 bg-card2 text-text rounded-xl border border-border text-[13px] outline-none focus:border-lime/40 transition-colors"
            min="0.01"
            step="0.01"
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red/10 border border-red/20 text-red text-[12px] px-3 py-2 rounded-lg mb-4">
            {error}
          </div>
        )}

        {/* Calculation Preview */}
        {qty > 0 && price > 0 && (
          <div className="bg-card2 border border-border p-3.5 rounded-xl mb-5">
            <div className="flex justify-between text-[12px] text-muted">
              <span>Total Cost</span>
              <span className="text-text font-semibold text-[13px]">
                ₹{totalCost.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-[12px] text-muted mt-1.5">
              <span>{qty} shares × ₹{price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-2.5">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-card2 border border-border text-muted rounded-xl hover:text-text text-[13px] font-medium cursor-pointer transition-colors"
            disabled={isPending}
          >
            Cancel
          </button>
          <button
            onClick={() => addHolding()}
            className="flex-1 px-4 py-2.5 bg-lime text-black rounded-xl font-semibold text-[13px] cursor-pointer hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isPending || !quantity || !purchasePrice || !selectedPortfolioId}
          >
            {isPending ? 'Adding...' : 'Add to Portfolio'}
          </button>
        </div>
      </div>
    </div>
  );
}
