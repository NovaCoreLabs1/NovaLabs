import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import {
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  FormField,
} from '@/components/ui/form';
import { Input } from '@/components/ui/Input';

/** Test wrapper that provides react-hook-form context. */
function TestForm({
  children,
  onSubmit = vi.fn(),
}: {
  children: React.ReactNode;
  onSubmit?: (data: any) => void;
}) {
  const form = useForm({ defaultValues: { username: '' } });
  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <Form {...form}>{children}</Form>
    </form>
  );
}

describe('Form', () => {
  it('renders a form item with label, control, and description', () => {
    render(
      <TestForm>
        <FormField
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input placeholder="Enter username" {...field} />
              </FormControl>
              <FormDescription>Your display name</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </TestForm>,
    );

    expect(screen.getByText('Username')).toBeDefined();
    expect(screen.getByPlaceholderText('Enter username')).toBeDefined();
    expect(screen.getByText('Your display name')).toBeDefined();
  });

  it('applies aria attributes to form control', () => {
    const { container } = render(
      <TestForm>
        <FormField
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input placeholder="Enter username" {...field} />
              </FormControl>
              <FormDescription>Your display name</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </TestForm>,
    );

    const control = container.querySelector('[data-slot="form-control"]');
    expect(control).toBeDefined();
    expect(control?.getAttribute('id')).toBeTruthy();
    expect(control?.getAttribute('aria-describedby')).toBeTruthy();
  });

  it('renders form message with data-error attribute on label when error exists', () => {
    function ErrorForm() {
      const form = useForm({ defaultValues: { email: '' } });
      form.setError('email', { type: 'validate', message: 'Invalid email' });

      return (
        <form>
          <Form {...form}>
            <FormField
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="Email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Form>
        </form>
      );
    }

    render(<ErrorForm />);

    expect(screen.getByText('Invalid email')).toBeDefined();
    const label = screen.getByText('Email');
    expect(label.getAttribute('data-error')).toBe('true');
  });

  it('renders multiple form fields', () => {
    render(
      <TestForm>
        <FormField
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input placeholder="Username" {...field} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="Email" {...field} />
              </FormControl>
            </FormItem>
          )}
        />
      </TestForm>,
    );

    expect(screen.getByText('Username')).toBeDefined();
    expect(screen.getByText('Email')).toBeDefined();
    expect(screen.getByPlaceholderText('Username')).toBeDefined();
    expect(screen.getByPlaceholderText('Email')).toBeDefined();
  });
});
