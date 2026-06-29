import { SaintFrancisDB } from './server/db';

async function run() {
  try {
    SaintFrancisDB.initialize();
    console.log('DB Initialized. Loading state...');
    const state = await SaintFrancisDB.loadFromDB(true);
    console.log('DB State Loaded successfully.');
    console.log('Users count:', state.users.length);
  } catch (err: any) {
    console.error('CRASH/ERROR during loadFromDB:', err);
  }
}

run();
