import { createElement, type PropsWithChildren } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook } from "@testing-library/react"

import { useTechnicalConfigurationAssessments } from "../_hooks/useTechnicalConfigurationAssessments"
import { baselineVersionId, optionId } from "./assessment-test-fixtures"

export function createAssessmentTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
}

export function createAssessmentQueryWrapper(queryClient: QueryClient) {
  return function QueryWrapper({ children }: PropsWithChildren) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

function renderAssessmentHook(collectionMode: "bounded" | "complete", queryClient: QueryClient) {
  const hook = renderHook(
    () => {
      const commonInput = {
        optionId,
        baselineVersionId,
      }
      return collectionMode === "complete"
        ? useTechnicalConfigurationAssessments({
            ...commonInput,
            collectionMode,
          })
        : useTechnicalConfigurationAssessments({
            ...commonInput,
            page: 1,
            pageSize: 25,
          })
    },
    { wrapper: createAssessmentQueryWrapper(queryClient) }
  )
  return { ...hook, queryClient }
}

export function renderAssessmentsHook(queryClient = createAssessmentTestQueryClient()) {
  return renderAssessmentHook("bounded", queryClient)
}

export function renderCompleteAssessmentsHook(queryClient = createAssessmentTestQueryClient()) {
  return renderAssessmentHook("complete", queryClient)
}
