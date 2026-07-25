export interface Profile {
  id: string;
  auth_user_id: string;
  full_name: string;
  email: string;
  whatsapp_number: string | null;
  mobile_number: string | null;
  area: string | null;
  city: string | null;
  pincode: string | null;
  avatar_url: string | null;
  provider: 'email' | 'google';
  profile_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProfileInsert {
  auth_user_id: string;
  email?: string;
  full_name?: string;
  whatsapp_number?: string | null;
  mobile_number?: string | null;
  area?: string | null;
  city?: string | null;
  pincode?: string | null;
  avatar_url?: string | null;
  provider?: string;
  profile_completed?: boolean;
}

export interface ProfileUpdate {
  full_name?: string;
  whatsapp_number?: string | null;
  mobile_number?: string | null;
  area?: string | null;
  city?: string | null;
  pincode?: string | null;
  avatar_url?: string | null;
  profile_completed?: boolean;
}

export type AuthProvider = 'email' | 'google';

export interface AuthState {
  user: {
    id: string;
    email: string | null;
    phone: string | null;
    user_metadata: {
      full_name?: string;
      avatar_url?: string;
      provider?: string;
    };
    app_metadata: {
      provider?: string;
    };
  } | null;
  profile: Profile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface AuthModalState {
  isOpen: boolean;
  view: 'login' | 'register' | 'forgot' | 'forgot-success';
  email?: string;
  redirectTo?: string;
}

export interface UserDrawerState {
  isOpen: boolean;
}
