package qltbyt

import (
	"regexp"
	"strings"
	"unicode"
)

type SQLError struct {
	Code    string
	Message string
}

func (e *SQLError) Error() string {
	if e == nil {
		return ""
	}
	return e.Message
}

func sqlError(code, message string) error {
	return &SQLError{Code: code, Message: message}
}

type validatedSQL struct {
	Statement string
	SQLShape  string
}

var (
	forbiddenKeywordPattern  = regexp.MustCompile(`(?i)\b(?:alter|analyze|call|cluster|comment|copy|create|delete|drop|execute|grant|insert|listen|merge|notify|refresh|reindex|revoke|set|truncate|update|vacuum)\b`)
	forbiddenFunctionPattern = regexp.MustCompile(`(?i)\b(?:set_config)\s*\(`)
	forbiddenSchemaPattern   = regexp.MustCompile(`(?i)\b(?:auth|extensions|graphql_public|information_schema|pg_catalog|pg_temp|public|storage)\s*\.`)
	tableSchemaPattern       = regexp.MustCompile(`(?i)\b(?:from|join)\s+([A-Za-z_][\w$]*)\s*\.`)
	functionSchemaPattern    = regexp.MustCompile(`(?i)\b([A-Za-z_][\w$]*)\s*\.\s*[A-Za-z_][\w$]*\s*\(`)
	dollarQuotePattern       = regexp.MustCompile(`\$[A-Za-z_][\w$]*\$|\$\$`)
	blockCommentPattern      = regexp.MustCompile(`(?s)/\*([\s\S]*?)\*/`)
	lineCommentPattern       = regexp.MustCompile(`--([^\n\r]*)`)
	selectPattern            = regexp.MustCompile(`(?i)^(select|with)\b`)
)

func validateSQL(sql string) (validatedSQL, error) {
	if dollarQuotePattern.MatchString(sql) {
		return validatedSQL{}, sqlError("invalid_statement", "Dollar-quoted strings are not allowed.")
	}
	commentText := normalizeSpace(extractCommentText(sql))
	withoutComments := stripSQLComments(sql)
	normalized := normalizeSpace(withoutComments)
	masked := normalizeSpace(maskQuotedText(withoutComments))
	if normalized == "" {
		return validatedSQL{}, sqlError("invalid_statement", "SQL is required.")
	}
	if err := assertSingleStatement(normalized, masked); err != nil {
		return validatedSQL{}, err
	}
	if hasEscapeString(withoutComments) {
		return validatedSQL{}, sqlError("invalid_statement", "PostgreSQL escape strings are not allowed.")
	}
	statement := strings.TrimSpace(strings.TrimSuffix(normalized, ";"))
	if !selectPattern.MatchString(statement) {
		return validatedSQL{}, sqlError("invalid_statement", "Only SELECT statements are allowed.")
	}
	if err := assertSQLSurface(commentText); err != nil {
		return validatedSQL{}, err
	}
	if err := assertSQLSurface(masked); err != nil {
		return validatedSQL{}, err
	}
	return validatedSQL{Statement: statement, SQLShape: statement}, nil
}

func assertSQLSurface(text string) error {
	if forbiddenFunctionPattern.MatchString(text) {
		return sqlError("forbidden_function", "Forbidden SQL function detected.")
	}
	if forbiddenKeywordPattern.MatchString(text) {
		return sqlError("forbidden_keyword", "Forbidden SQL keyword detected.")
	}
	if forbiddenSchemaPattern.MatchString(text) {
		return sqlError("forbidden_schema", "Only the ai_readonly schema is queryable.")
	}
	for _, match := range tableSchemaPattern.FindAllStringSubmatch(text, -1) {
		if len(match) < 2 || !strings.EqualFold(match[1], "ai_readonly") {
			return sqlError("forbidden_schema", "Only the ai_readonly schema is queryable.")
		}
	}
	for _, match := range functionSchemaPattern.FindAllStringSubmatch(text, -1) {
		if len(match) < 2 || !strings.EqualFold(match[1], "ai_readonly") {
			return sqlError("forbidden_schema", "Only the ai_readonly schema is queryable.")
		}
	}
	return nil
}

func assertSingleStatement(normalized, masked string) error {
	semicolons := strings.Count(masked, ";")
	if semicolons > 1 || (semicolons == 1 && !strings.HasSuffix(normalized, ";")) {
		return sqlError("invalid_statement", "Only one SQL statement is allowed.")
	}
	return nil
}

func extractCommentText(sql string) string {
	var parts []string
	for _, match := range blockCommentPattern.FindAllStringSubmatch(sql, -1) {
		if len(match) > 1 {
			parts = append(parts, match[1])
		}
	}
	for _, match := range lineCommentPattern.FindAllStringSubmatch(sql, -1) {
		if len(match) > 1 {
			parts = append(parts, match[1])
		}
	}
	return strings.Join(parts, " ")
}

func stripSQLComments(sql string) string {
	withoutBlock := blockCommentPattern.ReplaceAllString(sql, " ")
	return lineCommentPattern.ReplaceAllString(withoutBlock, " ")
}

func maskQuotedText(sql string) string {
	var masked strings.Builder
	var quote rune
	runes := []rune(sql)
	for index := 0; index < len(runes); index++ {
		char := runes[index]
		var next rune
		if index+1 < len(runes) {
			next = runes[index+1]
		}
		if quote == 0 {
			if char == '\'' || char == '"' {
				quote = char
				masked.WriteByte(' ')
			} else {
				masked.WriteRune(char)
			}
			continue
		}
		if char == quote {
			if quote == '\'' && next == '\'' {
				masked.WriteString("  ")
				index++
				continue
			}
			quote = 0
		}
		masked.WriteByte(' ')
	}
	return masked.String()
}

func hasEscapeString(sql string) bool {
	var quote rune
	runes := []rune(sql)
	for index := 0; index < len(runes); index++ {
		char := runes[index]
		var next rune
		if index+1 < len(runes) {
			next = runes[index+1]
		}
		if quote == 0 {
			if char == '\'' || char == '"' {
				quote = char
				continue
			}
			if (char == 'E' || char == 'e') && (index == 0 || !isSQLIdentifier(runes[index-1])) {
				nextNonSpace := index + 1
				for nextNonSpace < len(runes) && unicode.IsSpace(runes[nextNonSpace]) {
					nextNonSpace++
				}
				if nextNonSpace < len(runes) && runes[nextNonSpace] == '\'' {
					return true
				}
			}
			continue
		}
		if char == quote {
			if quote == '\'' && next == '\'' {
				index++
				continue
			}
			quote = 0
		}
	}
	return false
}

func isSQLIdentifier(char rune) bool {
	return char == '_' || char == '$' || unicode.IsLetter(char) || unicode.IsDigit(char)
}

func normalizeSpace(value string) string {
	return strings.Join(strings.Fields(value), " ")
}

func sanitizedShape(sql string) string {
	shape := normalizeSpace(sql)
	runes := []rune(shape)
	if len(runes) > QueryShapeMax {
		shape = string(runes[:QueryShapeMax])
	}
	if strings.TrimSpace(shape) == "" {
		return "empty"
	}
	return shape
}
