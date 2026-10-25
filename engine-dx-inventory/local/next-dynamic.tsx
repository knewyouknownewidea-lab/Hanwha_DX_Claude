import React, {lazy, Suspense, type ComponentType} from 'react';

/** Browser-only equivalent for the workspace's `next/dynamic({ssr:false})`. */
export default function dynamic<P extends object>(
  load: () => Promise<{default: ComponentType<P>}>,
  options: {ssr?: boolean; loading?: ComponentType} = {},
) {
  const Component = lazy(load);
  const Loading = options.loading;
  return function LocalDynamic(props: P) {
    return <Suspense fallback={Loading ? <Loading /> : null}>
      <Component {...props} />
    </Suspense>;
  };
}
