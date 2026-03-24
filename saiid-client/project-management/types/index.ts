// User Types
export type UserRole =
    | 'admin'
    | 'project_manager'
    | 'media_manager'
    | 'executed_projects_coordinator'
    | 'executor'
    | 'photographer'

export interface User {
    id: number
    name: string
    email: string
    role: UserRole
    department?: string
    phone_number?: string
    is_active: boolean
    created_at: string
    updated_at: string
}

// Project Types
export type ProjectStatus =
    | 'جديد'
    | 'قيد التوريد'
    | 'تم التوريد'
    | 'قيد التوزيع'
    | 'مؤجل'
    | 'جاهز للتنفيذ'
    | 'تم اختيار المخيم'
    | 'قيد التنفيذ'
    | 'منفذ'
    | 'في المونتاج'
    | 'تم المونتاج'
    | 'معاد مونتاجه'
    | 'وصل للمتبرع'
    | 'منتهي'
    | 'ملغى'

export type ProjectType = 'إغاثي' | 'تنموي' | 'طبي' | 'تعليمي'

export interface Project {
    id: number
    serial_number: string
    project_name?: string
    donor_code?: string
    description: string
    donor_name: string
    project_type: ProjectType
    donation_amount: number
    currency_id: number
    currency?: Currency
    exchange_rate_snapshot: number
    amount_in_usd: number
    discount_percentage: number
    net_amount_usd: number
    quantity: number
    estimated_duration_days: number
    notes?: string
    status: ProjectStatus
    assigned_to_team_id?: number
    assigned_to_team?: Team
    assigned_photographer_id?: number
    assigned_photographer?: User
    selected_shelter_id?: number
    selected_shelter?: Shelter
    created_by: number
    created_by_user?: User
    execution_started_at?: string
    execution_completed_at?: string
    media_status?: string
    media_completed_at?: string
    delivered_to_donor_at?: string
    created_at: string
    updated_at: string
    is_daily_phase?: boolean
    phase_day?: number
    parent_project_id?: number
    parent_project?: Project
    is_divided_into_phases?: boolean
    phase_duration_days?: number
    phase_start_date?: string
    daily_phases?: Project[]
}

export interface ProjectTimeline {
    id: number
    project_proposal_id: number
    status_from: ProjectStatus
    status_to: ProjectStatus
    changed_by: number
    changed_by_user?: User
    notes?: string
    created_at: string
}

// Team Types
export interface Team {
    id: number
    team_name: string
    team_leader_id: number
    team_leader?: User
    team_type: string
    is_active: boolean
    created_at: string
    updated_at: string
    members?: TeamMember[]
}

export interface TeamMember {
    id: number
    team_id: number
    user_id: number
    user?: User
    role_in_team: string
    joined_at: string
}

// Shelter Types
export interface Shelter {
    id: number
    shelter_name: string
    province: string
    area: string
    families_count: number
    is_active: boolean
    created_at: string
    updated_at: string
}

// Currency Types
export interface Currency {
    id: number
    currency_code: string
    currency_name: string
    exchange_rate_to_usd: number
    symbol?: string
    is_active: boolean
    created_at: string
    updated_at: string
}

// Notification Types
export type NotificationType =
    | 'project_created'
    | 'project_assigned'
    | 'project_status_changed'
    | 'shelter_selected'
    | 'media_updated'
    | 'media_completed'
    | 'media_rejected'
    | 'media_accepted'
    | 'daily_phase'
    | 'project_postponed'
    | 'project_resumed'
    | 'project_cancelled'
    | 'project_transferred_to_execution'

export interface Notification {
    id: number
    user_id: number
    type: string
    notification_type?: NotificationType | string
    title: string
    message: string
    related_project_id?: number
    is_read: boolean
    priority?: 'high' | 'medium' | 'low' | string
    metadata?: Record<string, any>
    created_at: string
}

export interface NotificationReply {
    id: number
    notification_id: number
    replied_by: number
    message: string
    rejection_reason: string
    created_at: string
    updated_at: string
}

// API Response Types
export interface ApiResponse<T = any> {
    success: boolean
    data?: T
    message?: string
    errors?: Record<string, string[]>
}

export interface PaginatedResponse<T> {
    data: T[]
    current_page: number
    last_page: number
    per_page: number
    total: number
    from: number
    to: number
}

// Form Types
export interface CreateProjectForm {
    donor_code?: string
    project_name?: string
    description: string
    donor_name: string
    project_type: ProjectType
    donation_amount: number
    currency_id: number
    discount_percentage: number
    quantity: number
    estimated_duration_days: number
    notes?: string
    is_divided_into_phases?: boolean
    phase_duration_days?: number
    phase_start_date?: string
}

export interface AssignProjectForm {
    assigned_to_team_id: number
    assigned_photographer_id: number
}

export interface SelectShelterForm {
    shelter_id: number
}

export interface UpdateMediaStatusForm {
    status: string
    notes?: string
}

export interface CreateTeamForm {
    team_name: string
    team_leader_id: number
    team_type: string
}

export interface AddTeamMemberForm {
    user_id: number
    role_in_team: string
}

export interface CreateUserForm {
    name: string
    email: string
    phone_number?: string
    password: string
    department?: string
}

// Statistics Types
export interface DashboardStats {
    total_projects: number
    total_value_usd: number
    projects_by_status: Record<ProjectStatus, number>
    projects_by_type: Record<ProjectType, number>
    delayed_execution: number
    delayed_media: number
    recent_projects: Project[]
}

