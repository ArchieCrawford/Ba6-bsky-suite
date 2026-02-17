import { getSupabase } from "./supabase";

export type Group = {
  id: string;
  name: string;
  description: string | null;
  invite_code: string;
  created_by: string;
  created_at: string;
};

export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
};

export type GroupMessage = {
  id: string;
  group_id: string;
  user_id: string;
  body: string;
  created_at: string;
  profiles?: Profile | null;
};

type ApiResult<T> = { data: T; error: string | null };

function formatError(error: any, table: string) {
  if (!error) return null;
  if (error.status === 404 || error.code === "PGRST116") {
    return `Table "${table}" not found. Run the Supabase migrations for BA6 Groups.`;
  }
  return error.message ?? String(error);
}

export async function getGroups(): Promise<ApiResult<Group[]>> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("groups").select("*").order("created_at", { ascending: false });
  return { data: (data ?? []) as Group[], error: formatError(error, "groups") };
}

export async function getGroupById(groupId: string): Promise<ApiResult<Group | null>> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("groups").select("*").eq("id", groupId).single();
  return { data: (data ?? null) as Group | null, error: formatError(error, "groups") };
}

export async function createGroup(name: string, description = ""): Promise<Group> {
  const supabase = getSupabase();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error(userError?.message ?? "Missing user session");

  const inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase();
  const { data: group, error: groupError } = await supabase
    .from("groups")
    .insert({ name, description, invite_code: inviteCode, created_by: userData.user.id })
    .select("*")
    .single();

  if (groupError) throw new Error(formatError(groupError, "groups") ?? "Failed to create group");

  const { error: memberError } = await supabase
    .from("group_members")
    .insert({ group_id: group.id, user_id: userData.user.id, role: "admin" });

  if (memberError) throw new Error(formatError(memberError, "group_members") ?? "Failed to join group");

  return group as Group;
}

export async function joinGroupByCode(inviteCode: string): Promise<string> {
  const supabase = getSupabase();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error(userError?.message ?? "Missing user session");

  const { data: group, error: findError } = await supabase
    .from("groups")
    .select("id")
    .eq("invite_code", inviteCode)
    .single();

  if (findError || !group) throw new Error(formatError(findError, "groups") ?? "Group not found");

  const { error: joinError } = await supabase
    .from("group_members")
    .insert({ group_id: group.id, user_id: userData.user.id });

  if (joinError && joinError.code !== "23505") {
    throw new Error(formatError(joinError, "group_members") ?? "Unable to join group");
  }

  return group.id as string;
}

export async function getMessages(groupId: string): Promise<ApiResult<GroupMessage[]>> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("messages")
    .select("*, profiles:user_id(id, display_name, avatar_url)")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });
  return { data: (data ?? []) as GroupMessage[], error: formatError(error, "messages") };
}

export async function sendMessage(groupId: string, body: string): Promise<GroupMessage> {
  const supabase = getSupabase();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error(userError?.message ?? "Missing user session");

  const { data, error } = await supabase
    .from("messages")
    .insert({ group_id: groupId, user_id: userData.user.id, body })
    .select("*, profiles:user_id(id, display_name, avatar_url)")
    .single();

  if (error || !data) throw new Error(formatError(error, "messages") ?? "Failed to send message");
  return data as GroupMessage;
}

export function subscribeToMessages(groupId: string, onMessage: (msg: GroupMessage) => void) {
  const supabase = getSupabase();
  const channel = supabase
    .channel(`group:${groupId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `group_id=eq.${groupId}` },
      async (payload) => {
        const { data } = await supabase
          .from("messages")
          .select("*, profiles:user_id(id, display_name, avatar_url)")
          .eq("id", payload.new.id)
          .single();
        if (data) onMessage(data as GroupMessage);
      }
    )
    .subscribe();

  return {
    unsubscribe: () => {
      supabase.removeChannel(channel);
    }
  };
}
