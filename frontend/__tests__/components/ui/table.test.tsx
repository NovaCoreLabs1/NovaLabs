import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from '@/components/ui/table';

describe('Table', () => {
  it('renders a full table with all parts', () => {
    render(
      <Table>
        <TableCaption>Test Caption</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Role</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>John</TableCell>
            <TableCell>Admin</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>Total</TableCell>
            <TableCell>2</TableCell>
          </TableRow>
        </TableFooter>
      </Table>,
    );

    expect(screen.getByText('Test Caption')).toBeDefined();
    expect(screen.getByText('Name')).toBeDefined();
    expect(screen.getByText('Role')).toBeDefined();
    expect(screen.getByText('John')).toBeDefined();
    expect(screen.getByText('Admin')).toBeDefined();
    expect(screen.getByText('Total')).toBeDefined();
  });

  it('renders a table with header only', () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Column 1</TableHead>
          </TableRow>
        </TableHeader>
      </Table>,
    );

    expect(screen.getByText('Column 1')).toBeDefined();
  });

  it('renders a table with body only', () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>Data cell</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByText('Data cell')).toBeDefined();
  });

  it('applies custom className to table parts', () => {
    const { container } = render(
      <Table>
        <TableHeader className="custom-header">
          <TableRow>
            <TableHead className="custom-head">Head</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell className="custom-cell">Cell</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    // The className should be applied (class attribute contains the custom class)
    expect(container.querySelector('.custom-header')).toBeTruthy();
    expect(container.querySelector('.custom-head')).toBeTruthy();
    expect(container.querySelector('.custom-cell')).toBeTruthy();
  });
});
