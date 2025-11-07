import { Link } from 'react-router-dom';

export default function VendorLink({ slug, className = '' }: Readonly<{ slug: string; className?: string }>) {
  if (!slug) return null;
  return (
    <div className={`text-sm ${className}`}>
      <span>Sold by: </span>
      <Link
        to={`/vendors/${slug}`}
        className="underline decoration-dotted text-[var(--theme-link)] hover:text-[var(--theme-link-hover)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-[var(--theme-surface)] rounded-sm outline-none"
        aria-label={`View vendor ${slug}`}
      >
        {slug}
      </Link>
    </div>
  );
}
