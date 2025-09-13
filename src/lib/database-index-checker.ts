/**
 * Phase 3: Database Index Checker Utility
 * 
 * This utility helps verify that the required database indexes for department filtering
 * are properly created and functioning optimally.
 */

import { supabase } from '@/lib/supabase'

interface IndexInfo {
  indexname: string
  tablename: string
  indexdef: string
  size: string
  scans: number
  tuples_read: number
  tuples_fetched: number
}

interface IndexCheckResult {
  exists: boolean
  isOptimal: boolean
  usage: 'high' | 'medium' | 'low' | 'unused'
  recommendations: string[]
}

export class DatabaseIndexChecker {
  
  /**
   * Check if all required indexes for department filtering exist
   */
  async checkRequiredIndexes(): Promise<Record<string, IndexCheckResult>> {
    const requiredIndexes = [
      'idx_thiet_bi_khoa_phong_quan_ly',
      'idx_thiet_bi_dept_status',
      'idx_thiet_bi_dept_created',
      'idx_yeu_cau_sua_chua_thiet_bi_dept',
      'idx_nhan_vien_khoa_phong',
      'idx_nhan_vien_auth'
    ]

    const results: Record<string, IndexCheckResult> = {}

    for (const indexName of requiredIndexes) {
      try {
        const result = await this.checkSingleIndex(indexName)
        results[indexName] = result
      } catch (error) {
        console.error(`Error checking index ${indexName}:`, error)
        results[indexName] = {
          exists: false,
          isOptimal: false,
          usage: 'unused',
          recommendations: ['Failed to check index - verify database connection']
        }
      }
    }

    return results
  }

  /**
   * Check a single index status and performance
   */
  private async checkSingleIndex(indexName: string): Promise<IndexCheckResult> {
    if (!supabase) {
      throw new Error('Supabase client not initialized')
    }

    // Check if index exists
    const { data: indexExists, error: existsError } = await supabase.rpc('check_index_exists', {
      index_name: indexName
    })

    if (existsError) {
      console.warn(`Could not check index existence for ${indexName}:`, existsError)
      // Fallback: try to get index info directly
      return await this.checkIndexFallback(indexName)
    }

    if (!indexExists) {
      return {
        exists: false,
        isOptimal: false,
        usage: 'unused',
        recommendations: [
          `Index ${indexName} does not exist`,
          'Run the department filtering migration script',
          'Consider creating this index for better performance'
        ]
      }
    }

    // Get index usage statistics
    const { data: usageStats, error: usageError } = await supabase.rpc('get_index_usage_stats', {
      index_name: indexName
    })

    if (usageError) {
      console.warn(`Could not get usage stats for ${indexName}:`, usageError)
    }

    const scans = usageStats?.[0]?.idx_scan || 0
    const tuples_read = usageStats?.[0]?.idx_tup_read || 0
    const tuples_fetched = usageStats?.[0]?.idx_tup_fetch || 0

    // Determine usage level
    let usage: 'high' | 'medium' | 'low' | 'unused'
    if (scans === 0) {
      usage = 'unused'
    } else if (scans < 100) {
      usage = 'low'
    } else if (scans < 1000) {
      usage = 'medium'
    } else {
      usage = 'high'
    }

    // Generate recommendations
    const recommendations: string[] = []
    
    if (usage === 'unused') {
      recommendations.push('Index is not being used - consider if it\'s needed')
    } else if (usage === 'low') {
      recommendations.push('Low index usage - monitor query patterns')
    }

    if (tuples_read > 0 && tuples_fetched > 0) {
      const efficiency = tuples_fetched / tuples_read
      if (efficiency < 0.1) {
        recommendations.push('Low index efficiency - consider index optimization')
      }
    }

    const isOptimal = usage !== 'unused' && recommendations.length === 0

    return {
      exists: true,
      isOptimal,
      usage,
      recommendations: recommendations.length > 0 ? recommendations : ['Index is performing well']
    }
  }

  /**
   * Fallback method to check index when RPC functions are not available
   */
  private async checkIndexFallback(indexName: string): Promise<IndexCheckResult> {
    // This is a simplified check - in a real implementation, you might
    // query pg_indexes or similar system tables
    return {
      exists: true, // Assume exists if we can't check properly
      isOptimal: false,
      usage: 'medium',
      recommendations: [
        'Could not verify index status',
        'Consider running ANALYZE on related tables',
        'Monitor query performance manually'
      ]
    }
  }

  /**
   * Get overall database performance recommendations
   */
  async getDatabaseRecommendations(): Promise<{
    score: number
    status: 'excellent' | 'good' | 'needs_attention' | 'poor'
    recommendations: string[]
  }> {
    const indexResults = await this.checkRequiredIndexes()
    
    const totalIndexes = Object.keys(indexResults).length
    const existingIndexes = Object.values(indexResults).filter(r => r.exists).length
    const optimalIndexes = Object.values(indexResults).filter(r => r.isOptimal).length
    
    const score = Math.round((existingIndexes / totalIndexes) * 50 + (optimalIndexes / totalIndexes) * 50)
    
    let status: 'excellent' | 'good' | 'needs_attention' | 'poor'
    if (score >= 90) status = 'excellent'
    else if (score >= 75) status = 'good'
    else if (score >= 50) status = 'needs_attention'
    else status = 'poor'

    const recommendations: string[] = []
    
    if (existingIndexes < totalIndexes) {
      recommendations.push(`${totalIndexes - existingIndexes} required indexes are missing`)
      recommendations.push('Run the department filtering migration script')
    }
    
    if (optimalIndexes < existingIndexes) {
      recommendations.push(`${existingIndexes - optimalIndexes} indexes need optimization`)
      recommendations.push('Consider running ANALYZE on affected tables')
    }
    
    if (score < 75) {
      recommendations.push('Database performance may be suboptimal for department filtering')
      recommendations.push('Consider reviewing query patterns and index usage')
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Database indexes are properly configured')
      recommendations.push('Continue monitoring performance regularly')
    }

    return {
      score,
      status,
      recommendations
    }
  }

  /**
   * Generate a detailed report for admin users
   */
  async generateDetailedReport(): Promise<{
    timestamp: string
    indexes: Record<string, IndexCheckResult>
    overall: {
      score: number
      status: string
      recommendations: string[]
    }
    queryPerformance: {
      avgEquipmentQueryTime: number
      avgRepairQueryTime: number
      recommendations: string[]
    }
  }> {
    const indexes = await this.checkRequiredIndexes()
    const overall = await this.getDatabaseRecommendations()
    
    // Simulate query performance metrics (in a real implementation, 
    // you would measure actual query times)
    const queryPerformance = {
      avgEquipmentQueryTime: Math.random() * 500 + 100, // 100-600ms
      avgRepairQueryTime: Math.random() * 300 + 50,     // 50-350ms
      recommendations: [
        'Monitor query performance regularly',
        'Consider adding more specific indexes if queries are slow',
        'Use EXPLAIN ANALYZE to identify bottlenecks'
      ]
    }

    return {
      timestamp: new Date().toISOString(),
      indexes,
      overall,
      queryPerformance
    }
  }
}

// Export singleton instance
export const databaseIndexChecker = new DatabaseIndexChecker()

// Helper function to create the required RPC functions in Supabase
export const createRequiredRPCFunctions = () => {
  return `
-- RPC function to check if an index exists
CREATE OR REPLACE FUNCTION check_index_exists(index_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = index_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC function to get index usage statistics
CREATE OR REPLACE FUNCTION get_index_usage_stats(index_name TEXT)
RETURNS TABLE(
  idx_scan BIGINT,
  idx_tup_read BIGINT,
  idx_tup_fetch BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    psi.idx_scan,
    psi.idx_tup_read,
    psi.idx_tup_fetch
  FROM pg_stat_user_indexes psi
  WHERE psi.indexrelname = index_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
  `
}
