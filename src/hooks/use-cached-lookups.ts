import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// Query keys for lookup data
export const lookupKeys = {
  departments: ['departments'] as const,
  equipmentTypes: ['equipment-types'] as const,
  users: ['users'] as const,
  profiles: ['profiles'] as const,
}

// Fetch departments - cached for longer periods since they rarely change
export function useDepartments() {
  return useQuery({
    queryKey: lookupKeys.departments,
    queryFn: async () => {
      if (!supabase) {
        throw new Error('Supabase client not initialized')
      }

      const { data, error } = await supabase
        .from('phong_ban')
        .select('*')
        .order('ten_phong_ban')

      if (error) throw error
      return data
    },
    staleTime: 10 * 60 * 1000, // 10 minutes - departments rarely change
    gcTime: 30 * 60 * 1000, // 30 minutes
  })
}

// Fetch equipment types - cached for longer periods
export function useEquipmentTypes() {
  return useQuery({
    queryKey: lookupKeys.equipmentTypes,
    queryFn: async () => {
      if (!supabase) {
        throw new Error('Supabase client not initialized')
      }

      const { data, error } = await supabase
        .from('loai_thiet_bi')
        .select('*')
        .order('ten_loai')

      if (error) throw error
      return data
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  })
}

// Fetch user profiles - cached for moderate periods
export function useProfiles() {
  return useQuery({
    queryKey: lookupKeys.profiles,
    queryFn: async () => {
      if (!supabase) {
        throw new Error('Supabase client not initialized')
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('ho_ten')

      if (error) throw error
      return data
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - user data changes occasionally
    gcTime: 15 * 60 * 1000, // 15 minutes
  })
}

// Get departments as options for select components
export function useDepartmentOptions() {
  const { data: departments, isLoading, error } = useDepartments()
  
  const options = departments?.map(dept => ({
    value: dept.id,
    label: dept.ten_phong_ban
  })) || []

  return {
    options,
    isLoading,
    error
  }
}

// Get equipment types as options for select components
export function useEquipmentTypeOptions() {
  const { data: equipmentTypes, isLoading, error } = useEquipmentTypes()
  
  const options = equipmentTypes?.map(type => ({
    value: type.id,
    label: type.ten_loai
  })) || []

  return {
    options,
    isLoading,
    error
  }
}

// Get user profiles as options for select components
export function useProfileOptions() {
  const { data: profiles, isLoading, error } = useProfiles()
  
  const options = profiles?.map(profile => ({
    value: profile.id,
    label: profile.ho_ten || profile.email
  })) || []

  return {
    options,
    isLoading,
    error
  }
}

// Composite hook for all lookup data - useful for forms and filters
export function useLookupData() {
  const departments = useDepartments()
  const equipmentTypes = useEquipmentTypes()
  const profiles = useProfiles()

  return {
    departments: {
      data: departments.data,
      isLoading: departments.isLoading,
      error: departments.error,
      options: departments.data?.map(dept => ({
        value: dept.id,
        label: dept.ten_phong_ban
      })) || []
    },
    equipmentTypes: {
      data: equipmentTypes.data,
      isLoading: equipmentTypes.isLoading,
      error: equipmentTypes.error,
      options: equipmentTypes.data?.map(type => ({
        value: type.id,
        label: type.ten_loai
      })) || []
    },
    profiles: {
      data: profiles.data,
      isLoading: profiles.isLoading,
      error: profiles.error,
      options: profiles.data?.map(profile => ({
        value: profile.id,
        label: profile.ho_ten || profile.email
      })) || []
    },
    isLoading: departments.isLoading || equipmentTypes.isLoading || profiles.isLoading,
    hasError: !!departments.error || !!equipmentTypes.error || !!profiles.error
  }
} 