{
  "nextjs_caching_strategies": {
    "overview": {
      "description": "Next.js improves application performance and reduces costs by caching rendering work and data requests",
      "key_principle": "By default, Next.js will cache as much as possible to improve performance and reduce cost",
      "important_note": "Fetch caching is not supported in middleware"
    },
    "caching_mechanisms": {
      "request_memoization": {
        "description": "Automatically memoizes fetch requests with same URL and options during a single render pass",
        "type": "React feature (not Next.js specific)",
        "where": "Server (Memory)",
        "what": "Return values of fetch requests",
        "purpose": "Avoid duplicate requests in React component tree",
        "duration": "Lifetime of a server request until React component tree finishes rendering",
        "characteristics": {
          "applies_to": ["GET method in fetch requests"],
          "scope": ["generateMetadata", "generateStaticParams", "Layouts", "Pages", "Server Components"],
          "not_applicable": ["Route Handlers"],
          "cache_states": ["MISS (first call)", "HIT (subsequent calls)"]
        },
        "opting_out": {
          "method": "Use AbortController signal",
          "example": "const { signal } = new AbortController(); fetch(url, { signal })"
        }
      },
      "data_cache": {
        "description": "Built-in cache that persists fetch results across server requests and deployments",
        "where": "Server (Persistent)",
        "what": "Data from fetch requests",
        "purpose": "Reduce data source requests and improve performance",
        "duration": "Persistent across requests and deployments (unless revalidated)",
        "characteristics": {
          "extends_native_fetch": true,
          "development_mode": "Data reused for HMR, options ignored for hard refreshes"
        },
        "revalidation": {
          "time_based": {
            "description": "Revalidate after specified time interval",
            "method": "next.revalidate option",
            "example": "fetch('https://...', { next: { revalidate: 3600 } })",
            "behavior": "stale-while-revalidate"
          },
          "on_demand": {
            "description": "Revalidate based on events",
            "methods": {
              "by_path": "revalidatePath()",
              "by_tag": "revalidateTag()"
            }
          }
        },
        "opting_out": {
          "method": "Set cache option to 'no-store'",
          "example": "fetch('https://...', { cache: 'no-store' })"
        },
        "caching_options": {
          "force_cache": "Always cache the response",
          "no_store": "Never cache the response"
        }
      },
      "full_route_cache": {
        "description": "Caches rendered HTML and React Server Component Payload at build time",
        "alternate_terms": ["Automatic Static Optimization", "Static Site Generation", "Static Rendering"],
        "where": "Server (Persistent)",
        "what": "HTML and RSC Payload",
        "purpose": "Serve cached routes instead of rendering on every request",
        "duration": "Persistent (cleared on new deployments)",
        "rendering_process": {
          "react_rendering": {
            "steps": [
              "Render Server Components to RSC Payload",
              "Use RSC Payload and Client Component JS to render HTML"
            ],
            "rsc_payload_contains": [
              "Rendered result of Server Components",
              "Placeholders for Client Components",
              "Props passed from Server to Client Components"
            ]
          },
          "caching_behavior": {
            "static_routes": "Cached by default",
            "dynamic_routes": "Rendered at request time, not cached"
          }
        },
        "invalidation": {
          "methods": [
            "Revalidating Data Cache",
            "Redeploying application"
          ]
        },
        "opting_out": {
          "methods": [
            "Using Dynamic APIs (cookies, headers, searchParams)",
            "Setting dynamic = 'force-dynamic'",
            "Setting revalidate = 0",
            "Opting out of Data Cache"
          ]
        }
      },
      "router_cache": {
        "description": "In-memory client-side cache storing RSC payload of visited route segments",
        "where": "Client (Memory)",
        "what": "RSC Payload split by layouts, loading states, and pages",
        "purpose": "Instant navigation and state preservation",
        "duration": {
          "session": "Persists across navigation, cleared on page refresh",
          "automatic_invalidation": {
            "dynamic_pages": "Not cached with default prefetching",
            "static_pages": "5 minutes with default prefetching",
            "full_prefetching": "5 minutes for both static and dynamic"
          }
        },
        "benefits": [
          "Instant back/forward navigation",
          "No full-page reload between navigations",
          "Preservation of browser and React state"
        ],
        "caching_behavior": {
          "layouts": "Cached and reused on navigation",
          "loading_states": "Cached and reused for instant loading",
          "pages": "Not cached by default (Next.js 15+)"
        },
        "invalidation": {
          "server_action_methods": [
            "revalidatePath()",
            "revalidateTag()",
            "cookies.set()",
            "cookies.delete()"
          ],
          "client_method": "router.refresh()"
        },
        "opting_out": {
          "method": "Set prefetch={false} on Link component",
          "default": "Page segments opted out by default in Next.js 15"
        }
      }
    },
    "cache_interactions": {
      "data_cache_and_full_route": {
        "relationship": "Revalidating Data Cache invalidates Full Route Cache",
        "reason": "Render output depends on data"
      },
      "data_cache_and_router_cache": {
        "server_action": "Immediately invalidates both caches",
        "route_handler": "Does not immediately invalidate Router Cache"
      }
    },
    "apis": {
      "link_component": {
        "description": "Automatically prefetches routes",
        "affects": ["Router Cache", "Full Route Cache"],
        "config": {
          "prefetch": {
            "true": "Full prefetching",
            "false": "Disable prefetching",
            "null": "Default prefetching"
          }
        }
      },
      "router_methods": {
        "prefetch": {
          "description": "Manually prefetch a route",
          "affects": ["Router Cache"]
        },
        "refresh": {
          "description": "Clear Router Cache and re-render",
          "affects": ["Router Cache"],
          "preserves": ["React state", "Browser state"]
        }
      },
      "fetch_api": {
        "default_behavior": {
          "dynamic_rendering": "Runs on every request",
          "static_rendering": "Cached in Data Cache and Full Route Cache"
        },
        "options": {
          "cache": {
            "force-cache": "Opt into caching",
            "no-store": "Opt out of caching"
          },
          "next": {
            "revalidate": "Set revalidation period in seconds",
            "tags": "Tag cache entries for granular invalidation"
          }
        }
      },
      "revalidation_functions": {
        "revalidatePath": {
          "description": "Revalidate data and re-render route segments",
          "affects": ["Data Cache", "Full Route Cache", "Router Cache (in Server Actions)"],
          "usage_locations": ["Route Handlers", "Server Actions"]
        },
        "revalidateTag": {
          "description": "Purge cache entries with specific tag",
          "affects": ["Data Cache", "Full Route Cache", "Router Cache (in Server Actions)"],
          "usage_locations": ["Route Handlers", "Server Actions"]
        }
      },
      "dynamic_apis": {
        "cookies": {
          "methods": ["cookies.set()", "cookies.delete()"],
          "affects": ["Router Cache", "Full Route Cache"]
        },
        "headers": {
          "affects": ["Full Route Cache"]
        },
        "searchParams": {
          "affects": ["Full Route Cache"]
        }
      },
      "segment_config": {
        "dynamic": {
          "force-dynamic": "Opt out of Full Route Cache",
          "force-static": "Static rendering with generateStaticParams"
        },
        "revalidate": {
          "0": "Opt out of caching",
          "number": "Time-based revalidation in seconds"
        },
        "fetchCache": {
          "default-no-store": "Opt all fetches out of Data Cache"
        },
        "dynamicParams": {
          "false": "Only serve paths from generateStaticParams"
        }
      },
      "generateStaticParams": {
        "description": "Generate static paths for dynamic segments",
        "affects": ["Full Route Cache"],
        "strategies": {
          "all_paths": "Return full list for build-time generation",
          "partial_paths": "Return subset, rest generated at runtime",
          "empty_array": "All paths generated at first visit"
        }
      },
      "react_cache": {
        "description": "Memoize function return values",
        "use_cases": ["Database queries", "CMS clients", "GraphQL clients"],
        "note": "GET/HEAD fetch requests are auto-memoized"
      }
    },
    "best_practices": {
      "performance_optimization": [
        "Leverage default caching behavior",
        "Use time-based revalidation for infrequently changing data",
        "Use on-demand revalidation for event-based updates",
        "Tag fetch requests for granular cache control"
      ],
      "cache_configuration": [
        "Understand cache interactions when configuring",
        "Use appropriate revalidation strategy based on data freshness needs",
        "Consider using partial static generation with generateStaticParams"
      ],
      "development_considerations": [
        "Caching behavior differs in development mode",
        "HMR reuses fetch data in development",
        "Hard refreshes ignore cache options in development"
      ]
    },
    "experimental_features": {
      "staleTimes": {
        "description": "Configure automatic invalidation times for Router Cache",
        "affects": ["Router Cache"]
      }
    }
  }
}