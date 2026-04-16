'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { portfolioApi } from '@/lib/portfolio.api';

interface SellHoldingModalProps {
  isOpen: boolean;
  symbol: string;
  availableQuantity: number;
  currentPrice: number;
  averageCost: number;
  portfolioId: number;
  onClose: () => void;
  onSuccess?: () => void;
}

export function SellHoldingModal({
  isOpen,
  symbol,
  availableQuantity,
  currentPrice,
  averageCost,
  portfolioId,
  onClose,
  onSuccess,
}: SellHoldingModalProps) {
  const queryClient = useQueryClient();
  const [quantity, setQuantity] = useState<string>('');
  const [sellPrice, setSellPrice] = useState<string>(currentPrice.toString());
  const [error, setError] = useState<string>('');
  const [result, setResult] = useState<{realized_pl: number; remaining: number} | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setSellPrice(currentPrice > 0 ? currentPrice.toString() : '');
      setQuantity('');
      setError('');
      setResult(null);
    }
  }, [isOpen, currentPrice]);

  const { mutate: sellHolding, isPending } = useMutation({
    mutationFn: async () => {
      const qty = parseFloat(quantity);
      const price = parseFloat(sellPrice);
      if (!qty || qty <= 0) throw new Error('Quantity must be greater than 0');
      if (qty > availableQuantity) throw new Error(`Cannot sell more than ${availableQuantity} shares`);
      if (!price || price <= 0) throw new Error('Price must be greater than 0');

      return portfolioApi.sellHolding(portfolioId, symbol, { quantity: qty, price });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-summary'] });
      setResult({
        realized_pl: data.realized_pl,
        remaining: data.remaining_quantity,
      });
      setError('');
      onSuccess?.();
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to sell holding');
    },
  });

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  if (!isOpen) return null;

  const qty = parseFloat(quantity) || 0;
  const price = parseFloat(sellPrice) || 0;
  const proceeds = qty * price;
  const estimatedPL = qty > 0 ? qty * (price - averageCost) : 0;
  const isProfit = estimatedPL >= 0;

  // Show success state after sell
  if (result) {
    const plPositive = result.realized_pl >= 0;
    return (
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
        onClick={handleBackdropClick}
      >
        <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
          <div className="text-center">
            <div className={`text-4xl mb-3`}>{plPositive ? '📈' : '📉'}</div>
            <h2 className="text-lg font-semibold text-text mb-2">Sale Complete</h2>
            <p className="text-[13px] text-muted mb-3">
              Sold {qty} shares of {symbol.split('.')[0]}
            </p>
            <div className="bg-card2 border border-border rounded-xl p-4 mb-5 space-y-2">
              <div className="flex justify-between text-[12px]">
                <span className="text-muted">Proceeds</span>
                <span className="text-text font-medium">₹{proceeds.toLocaleString('en-IN', {maximumFractionDigits:2})}</span>
              </div>
              <div className="flex justify-between text-[12px]">
                <span className="text-muted">Realized P&L</span>
                <span className={`font-semibold ${plPositive ? 'text-green' : 'text-red'}`}>
                  {plPositive ? '+' : ''}₹{result.realized_pl.toLocaleString('en-IN', {maximumFractionDigits:2})}
                </span>
              </div>
              <div className="flex justify-between text-[12px]">
                <span className="text-muted">Remaining Shares</span>
                <span className="text-text font-medium">{result.remaining}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-full px-4 py-2.5 bg-lime text-black rounded-xl font-semibold text-[13px] cursor-pointer hover:brightness-110 transition-all"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-text">
            Sell {symbol.split('.')[0]}
          </h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-text text-lg transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Available info */}
        <div className="bg-card2 border border-border p-3.5 rounded-xl mb-4 flex justify-between text-[12px]">
          <div>
            <div className="text-muted mb-0.5">Available</div>
            <div className="text-text font-semibold text-[14px]">{availableQuantity} shares</div>
          </div>
          <div className="text-right">
            <div className="text-muted mb-0.5">Avg Cost</div>
            <div className="text-text font-semibold text-[14px]">₹{averageCost.toLocaleString('en-IN', {maximumFractionDigits:2})}</div>
          </div>
        </div>

        {/* Quantity Input */}
        <div className="mb-4">
          <label className="block text-[11px] text-muted mb-1.5 tracking-wide uppercase">
            Quantity to Sell
          </label>
          <div className="relative">
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={`Max: ${availableQuantity}`}
              className="w-full px-3 py-2.5 bg-card2 text-text rounded-xl border border-border text-[13px] outline-none focus:border-red/40 transition-colors"
              min="0.01"
              max={availableQuantity}
              step="0.01"
            />
            <button
              onClick={() => setQuantity(availableQuantity.toString())}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] bg-red/10 text-red px-2 py-1 rounded-md font-semibold cursor-pointer hover:bg-red/20 transition-colors"
            >
              SELL ALL
            </button>
          </div>
        </div>

        {/* Sell Price Input */}
        <div className="mb-4">
          <label className="block text-[11px] text-muted mb-1.5 tracking-wide uppercase">
            Sell Price (₹)
          </label>
          <input
            type="number"
            value={sellPrice}
            onChange={(e) => setSellPrice(e.target.value)}
            placeholder="e.g., 2900.00"
            className="w-full px-3 py-2.5 bg-card2 text-text rounded-xl border border-border text-[13px] outline-none focus:border-red/40 transition-colors"
            min="0.01"
            step="0.01"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red/10 border border-red/20 text-red text-[12px] px-3 py-2 rounded-lg mb-4">
            {error}
          </div>
        )}

        {/* Preview */}
        {qty > 0 && price > 0 && (
          <div className="bg-card2 border border-border p-3.5 rounded-xl mb-5 space-y-1.5">
            <div className="flex justify-between text-[12px] text-muted">
              <span>Expected Proceeds</span>
              <span className="text-text font-semibold text-[13px]">
                ₹{proceeds.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-[12px] text-muted">
              <span>Estimated P&L</span>
              <span className={`font-semibold text-[13px] ${isProfit ? 'text-green' : 'text-red'}`}>
                {isProfit ? '+' : ''}₹{estimatedPL.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </span>
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
            onClick={() => sellHolding()}
            className="flex-1 px-4 py-2.5 bg-red text-white rounded-xl font-semibold text-[13px] cursor-pointer hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isPending || !quantity || !sellPrice || qty > availableQuantity}
          >
            {isPending ? 'Selling...' : 'Confirm Sell'}
          </button>
        </div>
      </div>
    </div>
  );
}
