'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import api, { getErrorMessage } from '@/lib/api'
import { DashboardStats, Project } from '@/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { getStatusColor } from '@/constants/projectStatuses'
import { FolderKanban, DollarSign, AlertCircle, Clock } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

export default function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true)
        const response = await api.get('/dashboard/stats')
        setStats(response.data.data)
      } catch (error) {
        toast.error(getErrorMessage(error))
      } finally {
        setIsLoading(false)
      }
    }

    fetchStats()
  }, [])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">لوحة التحكم</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded w-3/4"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">لوحة التحكم</h1>
        <p className="text-gray-500 mt-1">نظرة عامة على المشاريع والإحصائيات</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي المشاريع</CardTitle>
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_projects || 0}</div>
            <p className="text-xs text-muted-foreground">
              جميع المشاريع في النظام
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">القيمة الإجمالية</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats?.total_value_usd || 0, 'USD')}
            </div>
            <p className="text-xs text-muted-foreground">
              مجموع قيمة المشاريع بالدولار
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">متأخر في التنفيذ</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats?.delayed_execution || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              مشاريع تأخرت عن الموعد المحدد
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">متأخر في المونتاج</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {stats?.delayed_media || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              مشاريع تأخرت في المونتاج
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Projects */}
      <Card>
        <CardHeader>
          <CardTitle>آخر المشاريع</CardTitle>
          <CardDescription>آخر 10 مشاريع تم إنشاؤها في النظام</CardDescription>
        </CardHeader>
        <CardContent>
          {stats?.recent_projects && stats.recent_projects.length > 0 ? (
            <div className="space-y-4">
              {stats.recent_projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="block p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-medium">{project.serial_number}</h3>
                        <Badge className={getStatusColor(project.status)}>
                          {project.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {project.description}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span>{project.donor_name}</span>
                        <span>•</span>
                        <span>{project.project_type}</span>
                        <span>•</span>
                        <span>{formatDate(project.created_at)}</span>
                      </div>
                    </div>
                    <div className="text-left mr-4">
                      <p className="font-semibold text-lg">
                        {formatCurrency(project.net_amount_usd, 'USD')}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              لا توجد مشاريع حالياً
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

