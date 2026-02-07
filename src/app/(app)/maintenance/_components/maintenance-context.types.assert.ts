import type { AuthUser } from "./maintenance-context.types"

type Assert<T extends true> = T

type HasSessionDonVi = AuthUser extends { don_vi?: string | number | null } ? true : false
type HasSessionDiaBanId = AuthUser extends { dia_ban_id?: string | number | null } ? true : false
type HasLegacyDonViId = AuthUser extends { don_vi_id?: unknown } ? true : false

type _authUserSupportsSessionDonVi = Assert<HasSessionDonVi>
type _authUserSupportsSessionDiaBanId = Assert<HasSessionDiaBanId>
type _authUserDoesNotExposeLegacyDonViId = Assert<HasLegacyDonViId extends true ? false : true>
