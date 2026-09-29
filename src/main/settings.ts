/** Settings: JSON config persisted in userData. */
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { Settings, DEFAULT_SETTINGS } from '../shared/types';

export class SettingsStore {
  private file: string;
  private data: Settings;

  constructor() {
    this.file = path.join(app.getPath('userData'), 'settings.json');
    this.data = { ...DEFAULT_SETTINGS };
    try {
      if (fs.existsSync(this.file)) {
        this.data = { ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(this.file, 'utf8')) };
      }
    } catch (err) {
      console.error('[settings] failed to read, using defaults:', err);
    }
  }

  get(): Settings {
    return { ...this.data };
  }

  set(patch: Partial<Settings>): void {
    this.data = { ...this.data, ...patch };
    try {
      fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2));
    } catch (err) {
      console.error('[settings] failed to persist:', err);
    }
  }
}
