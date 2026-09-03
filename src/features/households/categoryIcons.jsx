import { Shapes } from 'lucide-react';

import { categoryIcons } from './categoryIconDefinitions';

export function CategoryIcon({ category, className = 'size-5' }) {
  const Icon = categoryIcons[category?.icon] ?? Shapes;
  return <Icon aria-hidden="true" className={className} />;
}

export function CategoryIconBadge({ category, className = 'size-10' }) {
  return (
    <span
      aria-hidden="true"
      className={`grid ${className} shrink-0 place-items-center rounded-xl text-white`}
      style={{ backgroundColor: category?.color ?? '#66706B' }}
    >
      <CategoryIcon category={category} />
    </span>
  );
}
