import React, { useEffect } from 'react';

export interface HeadProps {
  readonly title?: string;
  readonly children?: React.ReactNode;
}

export function Head({ title, children }: HeadProps): React.ReactElement | null {
  useEffect(() => {
    if (title !== undefined) {
      document.title = title;
    }
  }, [title]);

  return <>{children}</>;
}
