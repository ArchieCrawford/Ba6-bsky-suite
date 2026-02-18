import { createClient } from '@supabase/supabase-js';

// Environment variables in this environment are typically accessed via process.env
const supabaseUrl = window?.process?.env?.SUPABASE_URL || '';
const supabaseAnonKey = window?.process?.env?.SUPABASE_ANON_KEY || '';

// Only initialize if we have a seemingly valid URL to avoid "Invalid URL" errors
const isConfigured = supabaseUrl && supabaseUrl.startsWith('http') && supabaseAnonKey;

export const supabase = isConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null;

// Helper to handle common Supabase errors without throwing (prevents environment crash overlay)
const handleApiError = (error, tableName) => {
  if (error) {
    if (error.status === 404 || error.code === 'PGRST116') {
      return { error: `Table "${tableName}" not found. Please run the SQL migrations in your Supabase dashboard.` };
    }
    return { error: error.message };
  }
  return { error: null };
};

export const authApi = {
  isConfigured: () => !!isConfigured,
  
  signUp: (email, password, displayName) => 
    supabase.auth.signUp({ 
      email, 
      password,
      options: { data: { display_name: displayName } }
    }),
  
  signIn: (email, password) => 
    supabase.auth.signInWithPassword({ email, password }),
  
  signOut: () => supabase.auth.signOut(),
  
  getUser: () => supabase.auth.getUser(),
  
  onAuthStateChange: (callback) => supabase?.auth.onAuthStateChange(callback)
};

export const dbApi = {
  // Groups
  getGroups: async () => {
    if (!supabase) return { data: [], error: 'Not configured' };
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .order('created_at', { ascending: false });
    
    const { error: processedError } = handleApiError(error, 'groups');
    return { data: data || [], error: processedError };
  },

  createGroup: async (name, description) => {
    if (!supabase) throw new Error('Not configured');
    const { data: { user } } = await supabase.auth.getUser();
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .insert({ name, description, invite_code: inviteCode, created_by: user.id })
      .select()
      .single();
    
    if (groupError) throw new Error(handleApiError(groupError, 'groups').error);

    const { error: memberError } = await supabase
      .from('group_members')
      .insert({ group_id: group.id, user_id: user.id, role: 'admin' });
    
    if (memberError) throw new Error(handleApiError(memberError, 'group_members').error);
    
    return group;
  },

  joinGroupByCode: async (inviteCode) => {
    if (!supabase) throw new Error('Not configured');
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data: group, error: findError } = await supabase
      .from('groups')
      .select('id')
      .eq('invite_code', inviteCode)
      .single();
    
    if (findError) throw new Error(handleApiError(findError, 'groups').error);

    const { error: joinError } = await supabase
      .from('group_members')
      .insert({ group_id: group.id, user_id: user.id });
    
    if (joinError && joinError.code !== '23505') throw new Error(handleApiError(joinError, 'group_members').error);
    
    return group.id;
  },

  getGroupMembers: async (groupId) => {
    if (!supabase) return { data: [], error: 'Not configured' };
    const { data, error } = await supabase
      .from('group_members')
      .select('*, profiles(*)')
      .eq('group_id', groupId);
    return { data: data || [], error: handleApiError(error, 'group_members').error };
  },

  updateProfile: async (displayName, avatarUrl) => {
    if (!supabase) throw new Error('Not configured');
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('profiles')
      .update({ display_name: displayName, avatar_url: avatarUrl })
      .eq('id', user.id)
      .select()
      .single();
    if (error) throw new Error(handleApiError(error, 'profiles').error);
    return data;
  },

  getProfile: async (userId) => {
    if (!supabase) return { data: null, error: 'Not configured' };
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle(); 
    return { data, error: handleApiError(error, 'profiles').error };
  },

  getMessages: async (groupId) => {
    if (!supabase) return { data: [], error: 'Not configured' };
    const { data, error } = await supabase
      .from('messages')
      .select('*, profiles:user_id(*)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true });
    return { data: data || [], error: handleApiError(error, 'messages').error };
  },

  sendMessage: async (groupId, body) => {
    if (!supabase) throw new Error('Not configured');
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('messages')
      .insert({ group_id: groupId, user_id: user.id, body })
      .select('*, profiles:user_id(*)')
      .single();
    if (error) throw new Error(handleApiError(error, 'messages').error);
    return data;
  },

  // Reactions
  getReactions: async (groupId) => {
    if (!supabase) return { data: [], error: 'Not configured' };
    const { data, error } = await supabase
      .from('message_reactions')
      .select('*, messages!inner(group_id)')
      .eq('messages.group_id', groupId);
    return { data: data || [], error: handleApiError(error, 'message_reactions').error };
  },

  toggleReaction: async (messageId, emoji) => {
    if (!supabase) throw new Error('Not configured');
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data: existing } = await supabase
      .from('message_reactions')
      .select('id')
      .eq('message_id', messageId)
      .eq('user_id', user.id)
      .eq('emoji', emoji)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('message_reactions')
        .delete()
        .eq('id', existing.id);
      if (error) throw new Error(handleApiError(error, 'message_reactions').error);
      return { action: 'removed', id: existing.id, messageId, userId: user.id, emoji };
    } else {
      const { data, error } = await supabase
        .from('message_reactions')
        .insert({ message_id: messageId, user_id: user.id, emoji })
        .select()
        .single();
      if (error) throw new Error(handleApiError(error, 'message_reactions').error);
      return { action: 'added', ...data };
    }
  },

  subscribeToReactions: (groupId, onUpdate) => {
    if (!supabase) return { unsubscribe: () => {} };
    return supabase
      .channel(`reactions:${groupId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'message_reactions'
      }, async (payload) => {
        onUpdate(payload);
      })
      .subscribe();
  },

  subscribeToMessages: (groupId, onMessage) => {
    if (!supabase) return { unsubscribe: () => {} };
    return supabase
      .channel(`group:${groupId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: `group_id=eq.${groupId}`
      }, async (payload) => {
        const { data } = await supabase
          .from('messages')
          .select('*, profiles:user_id(*)')
          .eq('id', payload.new.id)
          .single();
        if (data) onMessage(data);
      })
      .subscribe();
  }
};
