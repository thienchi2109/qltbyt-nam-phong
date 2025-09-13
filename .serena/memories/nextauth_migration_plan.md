# NextAuth Migration Plan

## Migration Strategy
**Recommended Approach**: Hybrid migration with feature flag for gradual rollout

## Phase 1: Setup (Week 1)
- Install NextAuth.js and @next-auth/supabase-adapter
- Create `[...nextauth]/route.ts` configuration
- Set up development environment variables

## Phase 2: Core Authentication (Week 2)
- Implement custom CredentialsProvider
- Create authorization callback calling `authenticate_user_dual_mode`
- Build session callback including role and khoa_phong
- Create custom sign-in page (Vietnamese interface)

## Phase 3: Integration (Week 3)
- Replace `useAuth` with NextAuth `useSession` hooks
- Update route protection middleware
- Migrate session management from localStorage
- Update user management components

## Phase 4: Advanced Features (Week 4)
- Implement password change with NextAuth
- Update admin user management functionality
- Add comprehensive error handling
- Implement feature toggles

## Key Configuration
- **Session Strategy**: JWT (stateless)
- **Provider**: Custom CredentialsProvider
- **Authentication**: Preserve dual-mode compatibility
- **Authorization**: Department-based via callbacks
- **Interface**: Maintain Vietnamese translations

## Risk Mitigation
- Feature flag system for rollback capability
- Extensive testing with all user roles
- Backward compatibility during transition
- Comprehensive fallback mechanisms