"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Activity, 
  Database, 
  Clock, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Download,
  Zap,
  Users,
  Filter
} from "lucide-react"
import { useDepartmentPerformance } from "@/hooks/use-department-performance"
import { useSession } from "next-auth/react"
import { cn } from "@/lib/utils"

export function PerformanceDashboard() {
  const { data: session } = useSession()
  const user = session?.user as any
  const {
    metrics,
    alerts,
    cacheScope,
    clearAlerts,
    getPerformanceSummary,
    getOptimizationSuggestions,
    exportPerformanceData,
    isMonitoring
  } = useDepartmentPerformance()

  // Only show to admin users
  if (!user || user.role !== 'admin') {
    return null
  }

  if (!isMonitoring) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Performance Monitoring
          </CardTitle>
          <CardDescription>
            Performance monitoring is not active for this user session.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const summary = getPerformanceSummary()
  const suggestions = getOptimizationSuggestions()

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'text-green-600 bg-green-50 border-green-200'
      case 'warning': return 'text-amber-600 bg-amber-50 border-amber-200'
      case 'poor': return 'text-red-600 bg-red-50 border-red-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`
  }

  return (
    <div className="space-y-6">
      {/* Performance Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Department Filtering Performance
              </CardTitle>
              <CardDescription>
                Real-time performance monitoring for department-based filtering
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={cn("border", getStatusColor(summary.status))}>
                {summary.status.toUpperCase()}
              </Badge>
              <Button variant="outline" size="sm" onClick={exportPerformanceData}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Performance Score */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Performance Score</span>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold">{summary.score}/100</div>
                <Progress value={summary.score} className="h-2" />
              </div>
            </div>

            {/* Average Query Time */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">Avg Query Time</span>
              </div>
              <div className="text-2xl font-bold">
                {formatTime(metrics.avgQueryTime)}
              </div>
              <div className="text-xs text-muted-foreground">
                {metrics.totalQueries} total queries
              </div>
            </div>

            {/* Cache Hit Rate */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium">Cache Hit Rate</span>
              </div>
              <div className="text-2xl font-bold">
                {formatPercentage(metrics.cacheHitRate)}
              </div>
              <div className="text-xs text-muted-foreground">
                {metrics.totalCacheRequests} cache requests
              </div>
            </div>

            {/* Department Items */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium">Department Items</span>
              </div>
              <div className="text-2xl font-bold">
                {metrics.departmentItemCount}
              </div>
              <div className="text-xs text-muted-foreground">
                {cacheScope.scope === 'department' ? cacheScope.department : 'Global view'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="alerts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="alerts" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Alerts ({alerts.length})
          </TabsTrigger>
          <TabsTrigger value="suggestions" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Suggestions ({suggestions.length})
          </TabsTrigger>
          <TabsTrigger value="details" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Details
          </TabsTrigger>
        </TabsList>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Performance Alerts</h3>
            {alerts.length > 0 && (
              <Button variant="outline" size="sm" onClick={clearAlerts}>
                Clear All
              </Button>
            )}
          </div>
          
          {alerts.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <div className="text-center space-y-2">
                  <CheckCircle className="h-8 w-8 text-green-600 mx-auto" />
                  <p className="text-sm text-muted-foreground">No performance alerts</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {alerts.map((alert, index) => (
                <Alert key={index} className={cn(
                  alert.type === 'error' && "border-red-200 bg-red-50",
                  alert.type === 'warning' && "border-amber-200 bg-amber-50",
                  alert.type === 'info' && "border-blue-200 bg-blue-50"
                )}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="flex items-center justify-between">
                    <span>{alert.message}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </span>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Suggestions Tab */}
        <TabsContent value="suggestions" className="space-y-4">
          <h3 className="text-lg font-semibold">Optimization Suggestions</h3>
          
          {suggestions.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <div className="text-center space-y-2">
                  <CheckCircle className="h-8 w-8 text-green-600 mx-auto" />
                  <p className="text-sm text-muted-foreground">
                    Performance is optimal - no suggestions at this time
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {suggestions.map((suggestion, index) => (
                <Card key={index}>
                  <CardContent className="flex items-start gap-3 pt-4">
                    <Zap className="h-5 w-5 text-amber-600 mt-0.5" />
                    <p className="text-sm">{suggestion}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-4">
          <h3 className="text-lg font-semibold">Detailed Metrics</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Query Performance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm">Total Queries:</span>
                  <span className="font-medium">{metrics.totalQueries}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Slow Queries (&gt;1s):</span>
                  <span className="font-medium">{metrics.slowQueries}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Average Response:</span>
                  <span className="font-medium">{formatTime(metrics.avgQueryTime)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cache Performance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm">Hit Rate:</span>
                  <span className="font-medium">{formatPercentage(metrics.cacheHitRate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Total Requests:</span>
                  <span className="font-medium">{metrics.totalCacheRequests}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Last Update:</span>
                  <span className="font-medium text-xs">
                    {new Date(metrics.lastUpdateTime).toLocaleTimeString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
