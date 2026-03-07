import { LibSQLStore } from '@mastra/libsql';

export const storage = new LibSQLStore({
  id: 'main-libsql',
  url: 'file:../../memory.db',
});