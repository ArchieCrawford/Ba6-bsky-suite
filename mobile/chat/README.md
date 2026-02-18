# BA6 Groups - Setup Guide

BA6 Groups is a full-stack group chat application built with React and Supabase.

## 1. Supabase Configuration

1. Create a new project at [database.new](https://database.new).
2. Go to the **SQL Editor** in your Supabase dashboard.
3. Copy the contents of `/migrations.sql` from this project and run it. This will create all tables, indexes, and RLS policies.
4. Go to **Project Settings > API**.
5. Copy your `Project URL` and `anon public` key.
6. Open `/api.js` in this project and replace `YOUR_SUPABASE_URL` and `YOUR_SUPABASE_ANON_KEY` with your values.

## 2. Authentication Settings

1. In Supabase, go to **Authentication > Providers**.
2. Ensure **Email** is enabled.
3. For local testing, you may want to disable **Confirm Email** under **Authentication > Email Templates** to allow immediate login after signup.

## 3. Realtime Enablement

The migration script already attempts to enable Realtime, but you can verify it:
1. Go to **Database > Replication**.
2. Ensure the `supabase_realtime` publication has the `messages`, `groups`, and `group_members` tables enabled.

## 4. How to Use

- **Signup**: Create an account.
- **Create Group**: Click "New Group" and give it a name.
- **Invite**: Click the "Invite" button or "Info" icon to get your group's unique invite code and link.
- **Join**: Share the link `your-app-url.com/join/CODE` with a friend. If they are logged in, they will join automatically.

## 5. File Structure

- `/index.html`: Main entry and dependencies.
- `/main.js`: React mounting.
- `/App.js`: All UI components and routing logic (now with profile editing and reactions).
- `/api.js`: Supabase client and database wrappers.
- `/migrations.sql`: Database schema (including messages, profiles, and reactions) and security rules.
