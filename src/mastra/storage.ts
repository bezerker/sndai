import { LibSQLStore } from '@mastra/libsql';

export const storage = new LibSQLStore({
  url: 'file:../../memory.db',
})