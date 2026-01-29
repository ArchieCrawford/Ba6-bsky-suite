export type Space = {
  id: string;
  name: string;
  slug: string;
  join_mode?: string;
  description?: string | null;
  is_gated?: boolean;
  is_member?: boolean;
  unread_count?: number;
};

export type Message = {
  id: string;
  space_id: string;
  author_did: string;
  author_handle?: string | null;
  body: string;
  created_at: string;
};
