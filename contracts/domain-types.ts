/** Reference domain types, not a ready-made implementation or runtime validator. */
export type UUID = string;
export type IsoInstant = string;
export type CalendarBasis = 'jalali' | 'gregorian';
export type Locale = 'fa' | 'en';
export type DateOnly = { calendar: CalendarBasis; year: number; month: number; day: number };
export type WallTime = { hour: number; minute: number; second?: number };
export interface VersionedRecord {
  id: UUID; revision: number; createdAt: IsoInstant; updatedAt: IsoInstant;
}
export interface WorkspacePreferences {
  schemaVersion: number; locale: Locale; numeralSystem: 'persian'|'latin';
  calendarDisplay: 'jalali'|'gregorian'|'both'; timeZone: string;
  hourFormat: 12|24; weekStart: 0|1|6;
  quietHours: { enabled:boolean; startHHmm:string; endHHmm:string; allowPriorityOverride:boolean };
}
export interface LayoutProfile extends VersionedRecord {
  name:string; widgetIds:UUID[]; backgroundId?:string; themeMode?:'light'|'dark'|'system';
  appearance?:Record<string,string|number|boolean>;
}
export interface WidgetInstance extends VersionedRecord {
  profileId: UUID; widgetType:string; pluginId?:string; grid:{x:number;y:number;w:number;h:number};
  visible:boolean; settings:Record<string,unknown>;
}
export interface Note extends VersionedRecord {
  title:string; bodyJson:unknown; folderId?:UUID; tagIds:UUID[];
  pinned:boolean; archived:boolean; trashedAt?:IsoInstant;
}
export interface Folder extends VersionedRecord {
  scope:'notes'|'localBookmarks'; parentId?:UUID; name:string; order:number;
}
export interface Task extends VersionedRecord {
  title:string; details?:string; status:'open'|'done'; priority:1|2|3;
  dueDate?:DateOnly; eventId?:UUID; focusRank?:number;
}
export interface LocalBookmark extends VersionedRecord {
  title:string; url:string; folderId?:UUID; sortOrder:number; iconAssetId?:string;
}
export type Weekday = 0|1|2|3|4|5|6; // 0 Sunday as a data convention, UI week start independent
export interface RecurrenceSpec {
  basis: CalendarBasis; freq:'DAILY'|'WEEKLY'|'MONTHLY'|'YEARLY'; interval:number;
  byWeekdays?:Weekday[];
  ordinalWeekday?:{ordinal:-1|1|2|3|4;weekday:Weekday};
  monthDay?:number; count?:number; untilLocalDate?:DateOnly;
  invalidDayPolicy:'skip'|'last_day'; exclusions:string[];
}
export interface CalendarEvent extends VersionedRecord {
  title:string; description?:string; allDay:boolean; sourceDate:DateOnly;
  sourceTime?:WallTime; durationMinutes?:number; timeZone:string;
  recurrence?:RecurrenceSpec; occurrenceOverrides?:Record<string,unknown>;
}
export interface ReminderRule extends VersionedRecord {
  eventId?:UUID; taskId?:UUID; offsetMinutes?:number;
  absoluteTime?:IsoInstant; severity:'normal'|'important'; allowDuringQuietHours:boolean;
}
export interface NotificationOccurrence extends VersionedRecord {
  idempotencyKey:string; reminderRuleId:UUID; occurrenceKey:string;
  dueAt:IsoInstant; status:'pending'|'due'|'missed'|'snoozed'|'completed'|'dismissed';
  nativeState:'not_attempted'|'shown'|'blocked'|'failed'|'quiet_suppressed';
  readAt?:IsoInstant; snoozedUntil?:IsoInstant;
}
export interface TimerSession extends VersionedRecord {
  mode:'countdown'|'pomodoro'; durationMs:number; startedAt:IsoInstant;
  endsAt?:IsoInstant; elapsedBeforePauseMs:number;
  status:'idle'|'running'|'paused'|'finished'|'cancelled';
  cycleIndex?:number;
}
export interface PluginPackage extends VersionedRecord {
  pluginId:string; packageVersion:string; specVersion:'1.0';
  enabled:boolean; manifest:unknown; sha256:string;
}
// Data contracts are validated at every persistence/import boundary with Zod/JSON Schema.
