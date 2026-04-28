import React from 'react';
import type { LinkProps } from './types';
import { visit } from './router';

export function Link({
  href,
  method = 'get',
  children,
  className,
  preserveScroll = false,
  ...rest
}: LinkProps): React.ReactElement {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>): void => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    void visit(href, method.toUpperCase(), undefined).then(() => {
      if (!preserveScroll) window.scrollTo(0, 0);
    });
  };

  return (
    <a href={href} className={className} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}
