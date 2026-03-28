import type { Session } from "next-auth"
import type { AuthUser } from "./types"

type Assert<T extends true> = T

type AuthUserHasName = "name" extends keyof AuthUser ? true : false
type AuthUserHasEmail = "email" extends keyof AuthUser ? true : false
type AuthUserHasImage = "image" extends keyof AuthUser ? true : false
type AuthUserHasAuthMode = "auth_mode" extends keyof AuthUser ? true : false
type SessionUserHasAuthMode = "auth_mode" extends keyof Session["user"] ? true : false

type _authUserHasName = Assert<AuthUserHasName>
type _authUserHasEmail = Assert<AuthUserHasEmail>
type _authUserHasImage = Assert<AuthUserHasImage>
type _authUserHasAuthMode = Assert<AuthUserHasAuthMode>
type _sessionUserHasAuthMode = Assert<SessionUserHasAuthMode>
