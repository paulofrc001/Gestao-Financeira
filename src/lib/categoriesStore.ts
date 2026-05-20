import { supabase, isSupabaseConfigured } from './supabase';

export interface Category {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  type: 'income' | 'expense';
  is_preset?: boolean;
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-alimentacao', name: 'Alimentação', icon: 'Utensils', color: '#f59e0b', type: 'expense', is_preset: true },
  { id: 'cat-moradia', name: 'Moradia', icon: 'Home', color: '#ef4444', type: 'expense', is_preset: true },
  { id: 'cat-lazer', name: 'Lazer', icon: 'Sparkles', color: '#10b981', type: 'expense', is_preset: true },
  { id: 'cat-transporte', name: 'Transporte', icon: 'Car', color: '#3b82f6', type: 'expense', is_preset: true },
  { id: 'cat-salario', name: 'Salário', icon: 'Briefcase', color: '#10b981', type: 'income', is_preset: true },
  { id: 'cat-saude', name: 'Saúde', icon: 'Heart', color: '#ec4899', type: 'expense', is_preset: true },
  { id: 'cat-educacao', name: 'Educação', icon: 'BookOpen', color: '#8b5cf6', type: 'expense', is_preset: true },
  { id: 'cat-outros', name: 'Outros', icon: 'HelpCircle', color: '#64748b', type: 'expense', is_preset: true }
];

export async function fetchCategories(): Promise<Category[]> {
  try {
    // 1. Get custom categories from LocalStorage
    const localSaved = localStorage.getItem('finna_custom_categories');
    let customCategories: Category[] = [];
    if (localSaved) {
      customCategories = JSON.parse(localSaved);
    }

    // 2. If Supabase is configured, try fetching custom ones from Supabase
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('*');
        
        if (error) {
          console.warn('[CategoriesStore] Error fetching categories from Supabase:', error);
        } else if (data && data.length > 0) {
          const supabaseCustom = data.map((item: any) => ({
            id: item.id,
            name: item.name,
            icon: item.icon || 'HelpCircle',
            color: item.color || '#64748b',
            type: (item.type || 'expense') as 'income' | 'expense',
            is_preset: !!item.is_preset
          }));
          
          // Merge Supabase categories, avoiding duplicates
          supabaseCustom.forEach((sc) => {
            if (!customCategories.some(c => c.name.toLowerCase() === sc.name.toLowerCase())) {
              customCategories.push(sc);
            }
          });
        }
      } catch (sbErr) {
        console.warn('[CategoriesStore] Ignored Supabase fetch error inside categories fallback:', sbErr);
      }
    }

    // Return preset categories merged with custom ones
    return [...DEFAULT_CATEGORIES, ...customCategories];
  } catch (err) {
    console.error('[CategoriesStore] Error loading categories, returning defaults:', err);
    return DEFAULT_CATEGORIES;
  }
}

export async function saveCategory(name: string, type: 'income' | 'expense', color?: string, icon?: string): Promise<Category> {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error('O nome da categoria não pode ser vazio');
  }

  const newCategory: Category = {
    id: 'cat-' + Math.random().toString(36).substring(2, 9),
    name: trimmedName,
    icon: icon || 'HelpCircle',
    color: color || '#820ad1',
    type: type,
    is_preset: false
  };

  // Check if category already exists in preset or local
  const current = await fetchCategories();
  if (current.some(c => c.name.toLowerCase() === trimmedName.toLowerCase())) {
    throw new Error(`A categoria "${trimmedName}" já existe!`);
  }

  // 1. Always save to LocalStorage to ensure fallback / demo works seamlessly
  const localSaved = localStorage.getItem('finna_custom_categories');
  const customList: Category[] = localSaved ? JSON.parse(localSaved) : [];
  customList.push(newCategory);
  localStorage.setItem('finna_custom_categories', JSON.stringify(customList));

  // 2. If Supabase is active, insert to categories table
  if (isSupabaseConfigured) {
    try {
      const { data: userSession } = await supabase.auth.getSession();
      const userUUID = userSession?.session?.user?.id;
      
      const sbRecord = {
        name: trimmedName,
        type: type,
        color: color || '#820ad1',
        icon: icon || 'HelpCircle',
        is_preset: false,
        // Wait, does it need a family_id? Our RLS uses family_id or user session. Let's see if we can get family_id from first account, family member, or leave NULL
        // Let's omit user_id and family_id if not strictly required, or let's attach user_id if we have it
      };

      // Let's fetch user's family_id to keep it in sync with the current family model
      let familyId: string | null = null;
      try {
        const { data: memberData } = await supabase
          .from('family_members')
          .select('family_id')
          .limit(1);
        if (memberData && memberData.length > 0) {
          familyId = memberData[0].family_id;
        }
      } catch (fErr) {
        console.warn('Could not fetch family_id for categories inserts:', fErr);
      }

      const { data, error } = await supabase
        .from('categories')
        .insert({
          ...sbRecord,
          ...(familyId ? { family_id: familyId } : {})
        })
        .select();

      if (error) {
        console.warn('[CategoriesStore] Supabase insert failed, but saved locally:', error);
      } else if (data && data.length > 0) {
        // Update the ID to the Supabase UUID
        newCategory.id = data[0].id;
        // Re-align local storage with exact Supabase ID
        const updatedList = customList.map(item => item.name === trimmedName ? { ...item, id: data[0].id } : item);
        localStorage.setItem('finna_custom_categories', JSON.stringify(updatedList));
      }
    } catch (sbErr) {
      console.warn('[CategoriesStore] Sync with Supabase categories failed, saved locally only:', sbErr);
    }
  }

  return newCategory;
}
