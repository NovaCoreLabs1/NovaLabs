import type { Meta, StoryObj } from '@storybook/react';
import { ShieldCheck, Zap, AlertTriangle } from 'lucide-react';
import FeatureCard from './FeatureCard';

const meta: Meta<typeof FeatureCard> = {
  title: 'UI/FeatureCard',
  component: FeatureCard,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof FeatureCard>;

export const Default: Story = {
  args: {
    title: 'Biometric Attendance',
    description: 'Fingerprint clock-in/clock-out system.',
    icon: ShieldCheck,
  },
};

export const HoverFocus: Story = {
  args: {
    title: 'Smart Invoicing',
    description: 'Automated billing and real-time payment status tracking.',
    icon: Zap,
  },
};

export const ErrorState: Story = {
  args: {
    title: 'Connection Offline',
    description: 'Unable to synchronize workspace scanner logs.',
    icon: AlertTriangle,
  },
};