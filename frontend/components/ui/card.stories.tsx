import type { Meta, StoryObj } from '@storybook/react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './card';

const meta: Meta<typeof Card> = {
  title: 'UI/Card',
  component: Card,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>Workspace Overview</CardTitle>
        <CardDescription>Manage active seat reservations.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm">3 seats occupied out of 10 available.</p>
      </CardContent>
    </Card>
  ),
};

export const HoverFocus: Story = {
  render: () => (
    <Card className="w-[350px] transition-all hover:border-primary hover:shadow-md cursor-pointer">
      <CardHeader>
        <CardTitle>Interactive Plan Card</CardTitle>
        <CardDescription>Hover over this card to view focus effects.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm">Click to select this workspace plan.</p>
      </CardContent>
    </Card>
  ),
};

export const ErrorState: Story = {
  render: () => (
    <Card className="w-[350px] border-destructive bg-destructive/10">
      <CardHeader>
        <CardTitle className="text-destructive">System Alert</CardTitle>
        <CardDescription className="text-destructive/80">Failed to load booking history.</CardDescription>
      </CardHeader>
    </Card>
  ),
};