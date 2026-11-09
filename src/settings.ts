/**
 * One setting: the folder for new drawings. Empty means where Obsidian puts new notes (Settings > Files and links).
 * Obsidian builds the tab from getSettingDefinitions(), so the setting shows up in the settings search, with a folder
 * picker.
 */
import { PluginSettingTab, type SettingDefinitionItem } from 'obsidian';
import type ExcaliboardPlugin from './main';

export type Settings = { folder: string };
export const DEFAULT_SETTINGS: Settings = { folder: '' };

const NAME = 'Folder for new drawings';
const DESC = 'Leave empty to put new drawings where Obsidian puts new notes (Settings > Files and links).';
const PLACEHOLDER = 'Example: Drawings';

export class SettingsTab extends PluginSettingTab {
  constructor(private readonly plugin: ExcaliboardPlugin) {
    super(plugin.app, plugin);
  }

  override getSettingDefinitions(): SettingDefinitionItem[] {
    return [{ name: NAME, desc: DESC, control: { type: 'folder', key: 'folder', placeholder: PLACEHOLDER } }];
  }

  override getControlValue(key: string): unknown {
    return key === 'folder' ? this.plugin.settings.folder : undefined;
  }

  // Not the default, which would save the settings alone and drop the view states kept in the same data.json.
  override async setControlValue(key: string, value: unknown): Promise<void> {
    if (key === 'folder' && typeof value === 'string') await this.plugin.setFolder(value);
  }
}
