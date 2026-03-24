'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import api, { getErrorMessage } from '@/lib/api'
import { Project, PaginatedResponse } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { formatCurrency, formatDate } from '@/lib/utils'
import { getStatusColor, PROJECT_STATUSES, PROJECT_TYPES } from '@/constants/projectStatuses'
import { Search, Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

export default function ProjectsPage() {
  const { user, hasRole } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [pagination, setPagination] = useState({
    currentPage: 1,
    lastPage: 1,
    total: 0,
    perPage: 10,
  })

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  const fetchProjects = async (page: number = 1) => {
    try {
      setIsLoading(true)
      const params: any = {
        page,
        perPage: pagination.perPage,
      }

      if (searchQuery) params.searchQuery = searchQuery
      if (statusFilter && statusFilter !== 'all') params.status = statusFilter
      if (typeFilter && typeFilter !== 'all') params.project_type = typeFilter

      const response = await api.get<{ data: PaginatedResponse<Project> }>('/project-proposals', { params })
      const data = response.data.data
      
      setProjects(data.data)
      setPagination({
        currentPage: data.current_page,
        lastPage: data.last_page,
        total: data.total,
        perPage: data.per_page,
      })
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchProjects(1)
  }, [statusFilter, typeFilter])

  const handleSearch = () => {
    fetchProjects(1)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">المشاريع</h1>
          <p className="text-gray-500 mt-1">إدارة جميع المشاريع في النظام</p>
        </div>
        {hasRole('admin') && (
          <Link href="/projects/new">
            <Button>
              <Plus className="w-4 h-4 ml-2" />
              مشروع جديد
            </Button>
          </Link>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>البحث والفلترة</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="بحث (الوصف، اسم المتبرع، كود المتبرع، الرقم التسلسلي...)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="pr-10"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="الحالة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الحالات</SelectItem>
                  {PROJECT_STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Type Filter */}
            <div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="النوع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الأنواع</SelectItem>
                  {PROJECT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4">
            <Button onClick={handleSearch}>
              <Search className="w-4 h-4 ml-2" />
              بحث
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>النتائج</CardTitle>
            <span className="text-sm text-gray-500">
              إجمالي: {pagination.total} مشروع
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse p-4 border rounded-lg">
                  <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : projects.length > 0 ? (
            <div className="space-y-4">
              {projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="block p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-lg">{project.serial_number}</h3>
                        <Badge className={getStatusColor(project.status)}>
                          {project.status}
                        </Badge>
                        <Badge variant="outline">{project.project_type}</Badge>
                      </div>
                      
                      <p className="text-gray-700 mb-2">{project.description}</p>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">الجهة المتبرعة:</span> {project.donor_name}
                        </div>
                        {project.donor_code && (
                          <div>
                            <span className="font-medium">كود المتبرع:</span> {project.donor_code}
                          </div>
                        )}
                        {project.assigned_to_team && (
                          <div>
                            <span className="font-medium">الفريق:</span> {project.assigned_to_team.team_name}
                          </div>
                        )}
                        <div>
                          <span className="font-medium">التاريخ:</span> {formatDate(project.created_at)}
                        </div>
                      </div>
                    </div>

                    <div className="text-left mr-6">
                      <p className="text-sm text-gray-500">المبلغ الإجمالي</p>
                      <p className="font-bold text-xl text-blue-600">
                        {formatCurrency(project.amount_in_usd, 'USD')}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">الصافي</p>
                      <p className="font-semibold text-green-600">
                        {formatCurrency(project.net_amount_usd, 'USD')}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg mb-2">لا توجد مشاريع</p>
              <p className="text-sm">جرب تغيير معايير البحث أو الفلترة</p>
            </div>
          )}

          {/* Pagination */}
          {pagination.lastPage > 1 && (
            <div className="flex items-center justify-between mt-6 pt-6 border-t">
              <div className="text-sm text-gray-500">
                عرض {((pagination.currentPage - 1) * pagination.perPage) + 1} - {Math.min(pagination.currentPage * pagination.perPage, pagination.total)} من {pagination.total}
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchProjects(pagination.currentPage - 1)}
                  disabled={pagination.currentPage === 1}
                >
                  <ChevronRight className="w-4 h-4" />
                  السابق
                </Button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, pagination.lastPage) }, (_, i) => {
                    let pageNum: number
                    if (pagination.lastPage <= 5) {
                      pageNum = i + 1
                    } else if (pagination.currentPage <= 3) {
                      pageNum = i + 1
                    } else if (pagination.currentPage >= pagination.lastPage - 2) {
                      pageNum = pagination.lastPage - 4 + i
                    } else {
                      pageNum = pagination.currentPage - 2 + i
                    }
                    
                    return (
                      <Button
                        key={pageNum}
                        variant={pagination.currentPage === pageNum ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => fetchProjects(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    )
                  })}
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchProjects(pagination.currentPage + 1)}
                  disabled={pagination.currentPage === pagination.lastPage}
                >
                  التالي
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

