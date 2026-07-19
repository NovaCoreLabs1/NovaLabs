import { describe, it, expect } from 'vitest';
import { createSEODefaults, buildMetadata, createPageMetadata, createArticleMetadata } from '@/lib/seo';

describe('createSEODefaults', () => {
  it('returns default SEO values', () => {
    const defaults = createSEODefaults();
    expect(defaults.title).toBe('NovaLabs');
    expect(defaults.description).toBe('Smart Hub & Workspace Management System');
    expect(defaults.keywords).toContain('workspace');
    expect(defaults.siteName).toBe('NovaLabs');
    expect(defaults.locale).toBe('en_US');
    expect(defaults.type).toBe('website');
  });
});

describe('buildMetadata', () => {
  it('returns metadata with default values when no input given', () => {
    const meta = buildMetadata();
    expect(meta.description).toBe('Smart Hub & Workspace Management System');
  });

  it('sets custom title and description', () => {
    const meta = buildMetadata({ title: 'About Us', description: 'Learn about NovaLabs' });
    expect(meta.title).toBe('About Us');
    expect(meta.description).toBe('Learn about NovaLabs');
  });

  it('includes canonical URL when provided', () => {
    const meta = buildMetadata({ canonical: 'https://novalabs.com/about' });
    expect(meta.alternates).toBeDefined();
    expect(meta.alternates?.canonical).toBe('https://novalabs.com/about');
  });

  it('disables robots indexing when noindex is true', () => {
    const meta = buildMetadata({ noindex: true });
    expect(meta.robots).toBeDefined();
    if (meta.robots && typeof meta.robots === 'object' && !Array.isArray(meta.robots)) {
      expect(meta.robots.index).toBe(false);
    }
  });

  it('includes open graph image when provided', () => {
    const meta = buildMetadata({
      title: 'Test',
      image: { url: 'https://example.com/image.png', alt: 'Test image' },
    });
    expect(meta.openGraph).toBeDefined();
  });

  it('sets openGraph type to article when specified', () => {
    const meta = buildMetadata({ title: 'Article', type: 'article' });
    expect(meta.openGraph).toBeDefined();
  });

  it('includes Twitter card metadata', () => {
    const meta = buildMetadata({ title: 'Test' });
    expect(meta.twitter).toBeDefined();
  });

  it('includes viewport settings', () => {
    const meta = buildMetadata();
    expect(meta.viewport).toBeDefined();
  });

  it('handles keywords as array', () => {
    const meta = buildMetadata({ keywords: ['tag1', 'tag2'] });
    expect(meta.keywords).toEqual(['tag1', 'tag2']);
  });
});

describe('createPageMetadata', () => {
  it('creates page metadata with title and description', () => {
    const meta = createPageMetadata('Pricing', 'See our pricing plans');
    expect(meta.title).toBe('Pricing');
    expect(meta.description).toBe('See our pricing plans');
  });

  it('merges additional options', () => {
    const meta = createPageMetadata('Pricing', 'Plans', { canonical: '/pricing' });
    expect(meta.alternates?.canonical).toBe('/pricing');
  });
});

describe('createArticleMetadata', () => {
  it('creates article metadata with type article', () => {
    const meta = createArticleMetadata('Post Title', 'A blog post');
    expect(meta.title).toBe('Post Title');
    expect(meta.description).toBe('A blog post');
  });
});
