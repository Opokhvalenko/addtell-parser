export function createZustandStore<T>(initialState: T) {
  return {
    state: initialState,
    setState: (newState: Partial<T>) => ({ ...initialState, ...newState }),
  };
}
