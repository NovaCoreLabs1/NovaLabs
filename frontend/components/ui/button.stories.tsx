import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './button';

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {
  args: {
    children: 'Click me',
    variant: 'default',
  },
};

export const HoverFocus: Story = {
  args: {
    children: 'Outline Button',
    variant: 'outline',
  },
};

export const ErrorState: Story = {
  args: {
    children: 'Delete Account',
    variant: 'destructive',
  },
};