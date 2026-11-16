/** A customer as staff see them; registrationCount only counts registrations the viewer may see. */
export interface CustomerListItem {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  registrationCount: number;
}
