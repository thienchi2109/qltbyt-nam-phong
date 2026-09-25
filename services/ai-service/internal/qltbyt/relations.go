package qltbyt

import (
	"regexp"
	"strings"
)

var relationTokens = regexp.MustCompile(`"(?:""|[^"])*"|[A-Za-z_][\w$]*|[(),]`)

// ponytail: comma joins are unsupported; use explicit JOIN until a full SQL parser is adopted.
// Track query depth so column lists, function arguments and CTE separators still work.
func rejectCommaRelations(sql string) error {
	from := []bool{false}
	for _, token := range relationTokens.FindAllString(sql, -1) {
		depth := len(from) - 1
		switch strings.ToLower(token) {
		case "(":
			from = append(from, false)
		case ")":
			if depth > 0 {
				from = from[:depth]
			}
		case "from":
			from[depth] = true
		case "where", "group", "order", "having", "limit", "offset", "fetch", "union", "intersect", "except", "window":
			from[depth] = false
		case ",":
			if from[depth] {
				return sqlError("unapproved_relation", "Comma joins are not allowed; use an explicit JOIN.")
			}
		}
	}
	return nil
}
