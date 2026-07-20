import { ChevronRightIcon } from 'lucide-react';
import Link from 'next/link';
import React from 'react';

/** Single entry rendered inside a {@link BreadCrumb} trail. */
interface LinkItem {
  label: string;
  href?: string;
}

/** Props for the {@link BreadCrumb} component. */
interface LinkList {
  links: LinkItem[];
}

/**
 * Renders an accessible breadcrumb navigation trail from a list of links.
 *
 * The final segment is rendered as a non-link pill when {@link LinkItem.href}
 * is omitted, marking it as the current location.
 */
const BreadCrumb = ({ links }: LinkList) => {
  return (
    <nav className='flex' aria-label='Breadcrumb'>
      <ul className=' flex items-center gap-2'>
        {links.map((link, index) => (
          <li
            key={link.href || `crumb-${index}`}
            className='text-sm font-medium flex items-center gap-2'
          >
            {link.href ? (
              <>
                <Link href={link.href}>{link.label}</Link>
                <ChevronRightIcon size={13} />
              </>
            ) : (
              <span className='block px-2 py-0.5 rounded-sm bg-gray-200'>
                {link.label}
              </span>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default BreadCrumb;
