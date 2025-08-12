import { LibSQLStore } from '@mastra/libsql';
import { join } from 'path';
import { fileURLToPath } from 'url';

// Get the directory of the current file
const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

// Use absolute path for memory database
export const storage = new LibSQLStore({
  url: `file:${join(__dirname, '..', '..', 'memory.db')}`,
});