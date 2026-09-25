package qltbyt

import "strings"

const (
	facilitySourceSelected = "selected"
	facilitySourceSession  = "session"
	roleGlobal             = "global"
	roleAdmin              = "admin"
	roleRegionalLeader     = "regional_leader"
)

// Scope is the facility decision copied from resolveAssistantScope.
// identity.tenant and the display name are not inputs.
type Scope struct {
	EffectiveFacilityID int64
	FacilitySource      string
	NormalizedRole      string
	RawRole             string
	RequestedFacilityID *int64
	SessionFacilityID   *int64
	UserID              int64
	Guidance            string
}

func resolveScope(cred Credential, requireFacility bool) Scope {
	rawRole := strings.TrimSpace(cred.RawRole)
	normalized := normalizeScopeRole(rawRole)
	privileged := isPrivilegedRole(rawRole)
	var requested *int64
	if cred.RequestedFacilityID != nil && *cred.RequestedFacilityID > 0 {
		value := *cred.RequestedFacilityID
		requested = &value
	}
	var session *int64
	if cred.SessionFacilityID != nil && *cred.SessionFacilityID > 0 {
		value := *cred.SessionFacilityID
		session = &value
	}
	var selected *int64
	source := facilitySourceSession
	if session != nil {
		value := *session
		selected = &value
	}
	if privileged {
		if requireFacility && requested == nil {
			return Scope{Guidance: FacilityRequiredMessage, RawRole: rawRole, NormalizedRole: normalized, UserID: cred.UserID}
		}
		if requested != nil {
			value := *requested
			selected = &value
			source = facilitySourceSelected
		}
	}
	if requireFacility && selected == nil {
		return Scope{Guidance: UnresolvedFacilityMessage, RawRole: rawRole, NormalizedRole: normalized, UserID: cred.UserID, RequestedFacilityID: requested, SessionFacilityID: session}
	}
	resolved := Scope{
		FacilitySource:      source,
		NormalizedRole:      normalized,
		RawRole:             rawRole,
		RequestedFacilityID: requested,
		SessionFacilityID:   session,
		UserID:              cred.UserID,
	}
	if selected != nil {
		resolved.EffectiveFacilityID = *selected
	} else {
		resolved.FacilitySource = ""
	}
	return resolved
}

func normalizeScopeRole(role string) string {
	normalized := strings.ToLower(strings.TrimSpace(role))
	if normalized == "" {
		return ""
	}
	if isGlobalRole(normalized) {
		return roleGlobal
	}
	switch normalized {
	case roleRegionalLeader, "to_qltb", "technician", "qltb_khoa", "user", "chuyen_gia":
		return normalized
	default:
		return ""
	}
}

func isGlobalRole(role string) bool {
	normalized := strings.ToLower(strings.TrimSpace(role))
	return normalized == roleGlobal || normalized == roleAdmin
}

func isPrivilegedRole(role string) bool {
	normalized := strings.ToLower(strings.TrimSpace(role))
	return normalized == roleGlobal || normalized == roleAdmin || normalized == roleRegionalLeader
}
