export const TAG_NAME_MAX_LENGTH = 50;

export interface TagListItem {
  id: string;
  name: string;
  /** How many events use the tag. */
  eventCount: number;
}
