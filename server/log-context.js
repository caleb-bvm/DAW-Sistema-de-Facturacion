import { AsyncLocalStorage } from 'node:async_hooks';

const context = new AsyncLocalStorage();
export const withLogContext = (value, work) => context.run(value, work);
export const currentLogContext = () => context.getStore() || { origen: 'consola' };
