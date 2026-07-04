import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import AdminGachaTierManager from './AdminGachaTierManager';

const tiers = [
  { id: 'tier-1', name: 'Normal', price: 30, isActive: true, isReady: false, reason: 'เปอร์เซ็นต์ไม่ครบ', totalPercentage: 85 },
];

describe('AdminGachaTierManager', () => {
  test('shows percentage progress and selects a tier', () => {
    const onSelect = vi.fn();
    render(<AdminGachaTierManager tiers={tiers} selectedTierId={null} onSelect={onSelect} onCreate={() => {}} onUpdate={() => {}} onDelete={() => {}} />);
    expect(screen.getByText('85/100%')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Normal/ }));
    expect(onSelect).toHaveBeenCalledWith(tiers[0]);
  });

  test('submits a new tier with numeric price', () => {
    const onCreate = vi.fn();
    render(<AdminGachaTierManager tiers={[]} selectedTierId={null} onSelect={() => {}} onCreate={onCreate} onUpdate={() => {}} onDelete={() => {}} />);
    fireEvent.change(screen.getByLabelText('Tier name'), { target: { value: 'Premium' } });
    fireEvent.change(screen.getByLabelText('Spin price'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add tier' }));
    expect(onCreate).toHaveBeenCalledWith({ name: 'Premium', price: 100 });
  });
});
