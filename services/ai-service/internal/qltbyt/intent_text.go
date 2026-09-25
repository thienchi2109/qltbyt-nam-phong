package qltbyt

import (
	"regexp"
	"strings"
	"unicode"

	"golang.org/x/text/unicode/norm"
)

var equipmentIdentifierPattern = regexp.MustCompile(`\b[A-Za-z]{1,8}(?:[._-][A-Za-z0-9]{2,}){1,}\b`)

var genericEquipmentTokens = map[string]bool{
	"tra": true, "cuu": true, "thong": true, "tin": true, "xem": true, "tim": true,
	"kiem": true, "chi": true, "tiet": true, "ho": true, "so": true, "thiet": true,
	"bi": true, "may": true, "toi": true, "giup": true, "cho": true, "voi": true,
	"mot": true, "moi": true, "nay": true, "kia": true, "do": true, "nao": true,
	"can": true, "muon": true, "x": true, "xxx": true,
}

func normalizeIntentText(text string) string {
	var builder strings.Builder
	for _, r := range norm.NFD.String(text) {
		switch {
		case unicode.Is(unicode.Mn, r):
			continue
		case r == 'đ' || r == 'Đ':
			builder.WriteByte('d')
		case unicode.IsLetter(r) || unicode.IsDigit(r):
			builder.WriteRune(unicode.ToLower(r))
		default:
			builder.WriteByte(' ')
		}
	}
	return strings.Join(strings.Fields(builder.String()), " ")
}

func hasEquipmentIdentifier(text string) bool {
	for _, token := range equipmentIdentifierPattern.FindAllString(text, -1) {
		if strings.ContainsAny(token, "0123456789") {
			return true
		}
	}
	return false
}

func hasSpecificEquipmentDescriptor(normalized string) bool {
	for _, token := range strings.Fields(normalized) {
		if len(token) > 1 && !genericEquipmentTokens[token] {
			return true
		}
	}
	return false
}

func containsPhrase(normalized string, phrases []string) bool {
	for _, phrase := range phrases {
		if strings.Contains(normalized, normalizeIntentText(phrase)) {
			return true
		}
	}
	return false
}
