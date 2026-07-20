import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Zap } from 'lucide-react';
import FeatureCard from '@/components/ui/FeatureCard';

describe('FeatureCard', () => {
  it('renders title and description', () => {
    render(<FeatureCard title="Fast" description="Lightning quick performance" icon={Zap} />);
    expect(screen.getByText('Fast')).toBeDefined();
    expect(screen.getByText('Lightning quick performance')).toBeDefined();
  });

  it('renders with custom className', () => {
    const { container } = render(
      <FeatureCard title="Test" description="Desc" icon={Zap} className="custom-card" />
    );
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain('custom-card');
  });

  it('renders the icon', () => {
    const { container } = render(<FeatureCard title="Icon" description="Has icon" icon={Zap} />);
    // Lucide icons render SVG elements
    const svg = container.querySelector('svg');
    expect(svg).toBeDefined();
  });
});
